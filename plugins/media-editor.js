// GHOST-OFFICIAL-V1 Media Editor
// RAK Realm - Copyright RAK

const sharp = require('sharp');
const { getString } = require('../utils/language-system');
const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs-extra');

class MediaEditor {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.effects = {
            // Filter effects
            'grayscale': (image) => image.grayscale(),
            'sepia': (image) => image.sepia(),
            'blur': (image, value = 5) => image.blur(value),
            'sharpen': (image, value = 2) => image.sharpen(value),
            'negate': (image) => image.negate(),
            'normalize': (image) => image.normalize(),
            
            // Color adjustments
            'brighten': (image, value = 50) => image.modulate({ brightness: 1 + value/100 }),
            'darken': (image, value = 50) => image.modulate({ brightness: 1 - value/100 }),
            'saturate': (image, value = 50) => image.modulate({ saturation: 1 + value/100 }),
            'desaturate': (image, value = 50) => image.modulate({ saturation: 1 - value/100 }),
            
            // Transformations
            'flip': (image) => image.flip(),
            'flop': (image) => image.flop(),
            'rotate': (image, degrees = 90) => image.rotate(degrees)
        };
    }

    async applyEffect(imageBuffer, effectName, parameters = {}) {
        try {
            let image = sharp(imageBuffer);
            
            if (this.effects[effectName]) {
                image = this.effects[effectName](image, parameters.value);
            } else {
                throw new Error(`Unknown effect: ${effectName}`);
            }

            return await image.toBuffer();
            
        } catch (error) {
            this.logger.error(`Effect application failed: ${error.message}`);
            throw error;
        }
    }

    async createSticker(imageBuffer, options = {}) {
        try {
            const { quality = 80, removeBg = false, crop = false } = options;
            
            let image = sharp(imageBuffer);
            
            if (removeBg) {
                // This would integrate with remove.bg API
                image = await this.removeBackground(image);
            }
            
            if (crop) {
                const metadata = await image.metadata();
                const size = Math.min(metadata.width, metadata.height);
                image = image.extract({
                    left: Math.floor((metadata.width - size) / 2),
                    top: Math.floor((metadata.height - size) / 2),
                    width: size,
                    height: size
                });
            }
            
            // Resize for sticker (512x512 max for WhatsApp)
            image = image.resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            });
            
            return await image.webp({ quality }).toBuffer();
            
        } catch (error) {
            this.logger.error(`Sticker creation failed: ${error.message}`);
            throw error;
        }
    }

    async generateTriggeredEffect(imageBuffer) {
        try {
            const image = await loadImage(imageBuffer);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
            
            const encoder = new GIFEncoder(image.width, image.height);
            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(50);
            encoder.setQuality(10);
            
            // Create animated triggered effect
            for (let i = 0; i < 10; i++) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Apply red tint and shake effect
                ctx.globalAlpha = 0.8;
                ctx.drawImage(
                    image, 
                    Math.random() * 10 - 5, 
                    Math.random() * 10 - 5
                );
                
                // Add red overlay
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                encoder.addFrame(ctx);
            }
            
            encoder.finish();
            return encoder.out.getData();
            
        } catch (error) {
            this.logger.error(`Triggered effect failed: ${error.message}`);
            throw error;
        }
    }

    async createWantedPoster(imageBuffer) {
        try {
            const image = await loadImage(imageBuffer);
            const canvas = createCanvas(800, 1000);
            const ctx = canvas.getContext('2d');
            
            // Draw background
            ctx.fillStyle = 'beige';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw image with oval frame
            const size = Math.min(image.width, image.height);
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(400, 400, 300, 350, 0, 0, 2 * Math.PI);
            ctx.clip();
            ctx.drawImage(image, 100, 50, 600, 700);
            ctx.restore();
            
            // Draw text
            ctx.font = 'bold 60px Arial';
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.fillText('WANTED', 400, 800);
            
            ctx.font = '40px Arial';
            ctx.fillText('DEAD OR ALIVE', 400, 870);
            
            ctx.font = '30px Arial';
            ctx.fillText('REWARD: $50,000', 400, 930);
            
            return canvas.toBuffer('image/png');
            
        } catch (error) {
            this.logger.error(`Wanted poster failed: ${error.message}`);
            throw error;
        }
    }

    async removeBackground(image) {
        // This would integrate with remove.bg API
        // For now, return original image
        return image;
    }

    async processMedia(message, effectType, parameters = {}) {
        try {
            if (!message.reply_message || !message.reply_message.image) {
                throw new Error('Please reply to an image message');
            }

            const mediaBuffer = await message.reply_message.downloadMediaMessage();
            
            let processedBuffer;
            
            switch (effectType) {
                case 'sticker':
                    processedBuffer = await this.createSticker(mediaBuffer, parameters);
                    break;
                case 'triggered':
                    processedBuffer = await this.generateTriggeredEffect(mediaBuffer);
                    break;
                case 'wanted':
                    processedBuffer = await this.createWantedPoster(mediaBuffer);
                    break;
                case 'filter':
                    processedBuffer = await this.applyEffect(mediaBuffer, parameters.effect, parameters);
                    break;
                default:
                    throw new Error(`Unknown effect type: ${effectType}`);
            }

            return {
                success: true,
                buffer: processedBuffer,
                format: effectType === 'sticker' ? 'webp' : 'png'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Media Editor Commands
module.exports = {
    name: 'edit',
    version: '1.0.0',
    description: 'Advanced media editing and manipulation tools',
    category: 'media',
    cooldown: 15,

    commands: {
        sticker: {
            description: 'Create sticker from image',
            usage: 'Reply to an image with /edit sticker'
        },
        triggered: {
            description: 'Create triggered GIF effect',
            usage: 'Reply to an image with /edit triggered'
        },
        wanted: {
            description: 'Create wanted poster',
            usage: 'Reply to an image with /edit wanted'
        },
        filter: {
            description: 'Apply filter to image',
            usage: '/edit filter <effect> [value]'
        }
    },

    async execute({ message, args, sock, bot }) {
        const editor = new MediaEditor(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            let result;
            let options = {};

            switch (subCommand) {
                case 'sticker':
                    result = await editor.processMedia(message, 'sticker', {
                        crop: true,
                        quality: 90
                    });
                    break;

                case 'triggered':
                    result = await editor.processMedia(message, 'triggered');
                    break;

                case 'wanted':
                    result = await editor.processMedia(message, 'wanted');
                    break;

                case 'filter':
                    const effect = args[1];
                    const value = parseInt(args[2]);
                    
                    if (!effect || !editor.effects[effect]) {
                        return await this.showFilters(message, sock, editor);
                    }
                    
                    result = await editor.processMedia(message, 'filter', {
                        effect: effect,
                        value: value
                    });
                    break;

                default:
                    return await this.showHelp(message, sock);
            }

            if (!result.success) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('MEDIA.EDIT_FAILED', { error: result.error })
                });
            }

            const sendOptions = {
                quoted: message
            };

            if (result.format === 'webp') {
                await sock.sendMessage(message.key.remoteJid, {
                    sticker: result.buffer
                }, sendOptions);
            } else {
                await sock.sendMessage(message.key.remoteJid, {
                    image: result.buffer
                }, sendOptions);
            }

            bot.logger.info(`Media edited: ${subCommand} effect applied`);

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Edit command error: ${error.message}`);
        }
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Media Editor Commands*

*/edit sticker* - Create sticker from image
*/edit triggered* - Create triggered GIF effect  
*/edit wanted* - Create wanted poster
*/edit filter <effect>* - Apply filter to image

?? *Usage:* Reply to an image message with the command

? *Try:* /edit filters to see available filters`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    },

    async showFilters(message, sock, editor) {
        let filtersText = '?? *Available Filters:*\n\n';
        const filterNames = Object.keys(editor.effects);
        
        filterNames.forEach((filter, index) => {
            filtersText += `• ${filter}`;
            if ((index + 1) % 3 === 0) filtersText += '\n';
            else filtersText += '   ';
        });

        filtersText += '\n\n?? *Usage:* /edit filter <name> [value]';

        await sock.sendMessage(message.key.remoteJid, { text: filtersText });
    }
};