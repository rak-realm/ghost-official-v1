// GHOST-OFFICIAL-V1 Sticker Engine
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

class StickerEngine {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.stickerDir = path.join(__dirname, '../temp/stickers');
        this.supportedFormats = ['webp', 'png', 'gif', 'mp4'];
    }

    async initialize() {
        this.logger.info('Initializing sticker engine...');
        await fs.ensureDir(this.stickerDir);
    }

    async createSticker(imageBuffer, options = {}) {
        try {
            const {
                format = 'webp',
                quality = 90,
                crop = true,
                removeBg = false,
                resize = true,
                dimensions = { width: 512, height: 512 }
            } = options;

            if (!this.supportedFormats.includes(format)) {
                throw new Error(`Unsupported format: ${format}`);
            }

            let processedBuffer = imageBuffer;

            // Remove background if requested
            if (removeBg) {
                processedBuffer = await this.removeBackground(processedBuffer);
            }

            // Process image based on format
            switch (format) {
                case 'webp':
                    processedBuffer = await this.createWebpSticker(processedBuffer, quality, crop, resize, dimensions);
                    break;
                case 'png':
                    processedBuffer = await this.createPngSticker(processedBuffer, crop, resize, dimensions);
                    break;
                case 'gif':
                    processedBuffer = await this.createGifSticker(processedBuffer, options);
                    break;
                default:
                    throw new Error(`Format ${format} not implemented`);
            }

            return {
                success: true,
                buffer: processedBuffer,
                format: format,
                size: processedBuffer.length
            };
        } catch (error) {
            this.logger.error(`Sticker creation failed: ${error.message}`);
            throw error;
        }
    }

    async createWebpSticker(buffer, quality, crop, resize, dimensions) {
        let image = sharp(buffer);

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

        if (resize) {
            image = image.resize(dimensions.width, dimensions.height, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            });
        }

        return await image.webp({ quality, lossless: quality === 100 }).toBuffer();
    }

    async createPngSticker(buffer, crop, resize, dimensions) {
        let image = sharp(buffer);

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

        if (resize) {
            image = image.resize(dimensions.width, dimensions.height, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            });
        }

        return await image.png().toBuffer();
    }

    async createGifSticker(buffer, options) {
        const tempInput = path.join(this.stickerDir, `input_${Date.now()}.gif`);
        const tempOutput = path.join(this.stickerDir, `output_${Date.now()}.gif`);

        try {
            await fs.writeFile(tempInput, buffer);

            return new Promise((resolve, reject) => {
                let command = ffmpeg(tempInput);

                if (options.resize) {
                    command = command.size('512x512');
                }

                if (options.fps) {
                    command = command.fps(options.fps);
                }

                command
                    .outputOptions(['-loop 0', '-f gif'])
                    .on('end', async () => {
                        try {
                            const outputBuffer = await fs.readFile(tempOutput);
                            await this.cleanupFiles([tempInput, tempOutput]);
                            resolve(outputBuffer);
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        reject(error);
                    })
                    .save(tempOutput);
            });
        } catch (error) {
            await this.cleanupFiles([tempInput, tempOutput]);
            throw error;
        }
    }

    async removeBackground(buffer) {
        // This would integrate with remove.bg or similar service
        // For now, return original buffer
        return buffer;
    }

    async convertToVideo(stickerBuffer, options = {}) {
        try {
            const tempInput = path.join(this.stickerDir, `input_${Date.now()}.webp`);
            const tempOutput = path.join(this.stickerDir, `output_${Date.now()}.mp4`);

            await fs.writeFile(tempInput, stickerBuffer);

            return new Promise((resolve, reject) => {
                ffmpeg(tempInput)
                    .outputOptions([
                        '-c:v libx264',
                        '-preset fast',
                        '-crf 23',
                        '-pix_fmt yuv420p'
                    ])
                    .on('end', async () => {
                        try {
                            const outputBuffer = await fs.readFile(tempOutput);
                            await this.cleanupFiles([tempInput, tempOutput]);
                            resolve(outputBuffer);
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        reject(error);
                    })
                    .save(tempOutput);
            });
        } catch (error) {
            await this.cleanupFiles([tempInput, tempOutput]);
            throw new Error(`Video conversion failed: ${error.message}`);
        }
    }

    async addStickerMetadata(buffer, metadata = {}) {
        try {
            // This would add metadata to stickers (pack name, author, etc.)
            // Implementation would depend on the format
            return buffer; // Return original for now
        } catch (error) {
            throw new Error(`Metadata addition failed: ${error.message}`);
        }
    }

    async extractStickerMetadata(buffer) {
        try {
            // Extract metadata from stickers
            const metadata = {
                format: await this.detectFormat(buffer),
                size: buffer.length,
                dimensions: await this.getImageDimensions(buffer)
            };
            return metadata;
        } catch (error) {
            throw new Error(`Metadata extraction failed: ${error.message}`);
        }
    }

    async detectFormat(buffer) {
        try {
            const metadata = await sharp(buffer).metadata();
            return metadata.format;
        } catch {
            return 'unknown';
        }
    }

    async getImageDimensions(buffer) {
        try {
            const metadata = await sharp(buffer).metadata();
            return { width: metadata.width, height: metadata.height };
        } catch {
            return null;
        }
    }

    async validateSticker(buffer, maxSize = 1 * 1024 * 1024) {
        try {
            if (buffer.length > maxSize) {
                return {
                    valid: false,
                    error: `Sticker too large (max ${maxSize / 1024}KB)`
                };
            }

            const dimensions = await this.getImageDimensions(buffer);
            if (!dimensions || dimensions.width > 512 || dimensions.height > 512) {
                return {
                    valid: false,
                    error: 'Sticker dimensions too large (max 512x512)'
                };
            }

            return { valid: true, dimensions };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    async cleanupFiles(filePaths) {
        for (const filePath of filePaths) {
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
            }
        }
    }

    async createStickerPack(name, stickers, options = {}) {
        try {
            // This would create a sticker pack from multiple stickers
            // Implementation would depend on the platform
            throw new Error('Sticker pack creation not implemented');
        } catch (error) {
            throw new Error(`Sticker pack creation failed: ${error.message}`);
        }
    }
}

// Sticker Commands
module.exports = {
    name: 'sticker',
    version: '1.0.0',
    description: 'Advanced sticker creation and management',
    category: 'media',
    cooldown: 8,

    commands: {
        create: {
            description: 'Create sticker from media',
            usage: '/sticker create [options]'
        },
        convert: {
            description: 'Convert sticker to video',
            usage: '/sticker convert'
        },
        info: {
            description: 'Get sticker information',
            usage: '/sticker info'
        }
    },

    async execute({ message, args, sock, bot }) {
        const stickerEngine = new StickerEngine(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            if (!message.reply_message && subCommand !== 'pack') {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('STICKER.REPLY_REQUIRED')
                });
            }

            switch (subCommand) {
                case 'create':
                    return await this.createSticker(message, args.slice(1), stickerEngine, sock);
                case 'convert':
                    return await this.convertSticker(message, stickerEngine, sock);
                case 'info':
                    return await this.getStickerInfo(message, stickerEngine, sock);
                default:
                    return await this.createSticker(message, args, stickerEngine, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Sticker command error: ${error.message}`);
        }
    },

    async createSticker(message, args, stickerEngine, sock) {
        const options = this.parseStickerOptions(args.join(' '));

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('STICKER.CREATING')
        });

        try {
            const mediaBuffer = await message.reply_message.downloadMediaMessage();
            const result = await stickerEngine.createSticker(mediaBuffer, options);

            await sock.sendMessage(message.key.remoteJid, {
                sticker: result.buffer,
                quoted: message
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('STICKER.CREATION_FAILED', { error: error.message })
            });
        }
    },

    async convertSticker(message, stickerEngine, sock) {
        if (!message.reply_message || !message.reply_message.sticker) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('STICKER.REPLY_STICKER')
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('STICKER.CONVERTING')
        });

        try {
            const stickerBuffer = await message.reply_message.downloadMediaMessage();
            const videoBuffer = await stickerEngine.convertToVideo(stickerBuffer);

            await sock.sendMessage(message.key.remoteJid, {
                video: videoBuffer,
                quoted: message
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('STICKER.CONVERSION_FAILED', { error: error.message })
            });
        }
    },

    async getStickerInfo(message, stickerEngine, sock) {
        if (!message.reply_message || !message.reply_message.sticker) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('STICKER.REPLY_STICKER')
            });
        }

        try {
            const stickerBuffer = await message.reply_message.downloadMediaMessage();
            const metadata = await stickerEngine.extractStickerMetadata(stickerBuffer);
            const validation = await stickerEngine.validateSticker(stickerBuffer);

            let infoMessage = getString('STICKER.INFO_HEADER');
            infoMessage += `\n?? Format: ${metadata.format}`;
            infoMessage += `\n?? Size: ${this.formatBytes(metadata.size)}`;
            
            if (metadata.dimensions) {
                infoMessage += `\n?? Dimensions: ${metadata.dimensions.width}x${metadata.dimensions.height}`;
            }

            infoMessage += `\n? Valid: ${validation.valid ? 'Yes' : 'No'}`;
            if (!validation.valid) {
                infoMessage += `\n? Reason: ${validation.error}`;
            }

            await sock.sendMessage(message.key.remoteJid, { text: infoMessage });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('STICKER.INFO_FAILED', { error: error.message })
            });
        }
    },

    parseStickerOptions(text) {
        const options = {};
        
        if (text.includes('--format')) {
            const match = text.match(/--format\s+(\w+)/);
            if (match) options.format = match[1];
        }
        
        if (text.includes('--quality')) {
            const match = text.match(/--quality\s+(\d+)/);
            if (match) options.quality = parseInt(match[1]);
        }
        
        if (text.includes('--no-crop')) options.crop = false;
        if (text.includes('--remove-bg')) options.removeBg = true;
        if (text.includes('--no-resize')) options.resize = false;

        return options;
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Sticker Commands*

*/sticker* - Create sticker (reply to media)
*/sticker convert* - Convert sticker to video
*/sticker info* - Get sticker information

?? *Options:*
--format <webp|png|gif> - Output format
--quality <1-100> - Quality level
--no-crop - Disable auto-cropping
--remove-bg - Remove background (if available)
--no-resize - Disable resizing

?? *Tips:*
• Reply to images, videos, or GIFs
• WebP format is recommended for best quality
• Max sticker size: 1MB`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};