// GHOST-OFFICIAL-V1 Meme Generator
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const sharp = require('sharp');
const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs-extra');

class MemeGenerator {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.templates = new Map();
        this.fonts = new Map();
        
        this.loadFonts();
        this.loadTemplates();
    }

    async initialize() {
        this.logger.info('Initializing meme generator...');
    }

    loadFonts() {
        // Register available fonts
        this.fonts.set('impact', {
            path: path.join(__dirname, '../assets/fonts/Impact.ttf'),
            family: 'Impact'
        });
        
        this.fonts.set('arial', {
            path: path.join(__dirname, '../assets/fonts/Arial.ttf'),
            family: 'Arial'
        });
        
        this.fonts.set('comic', {
            path: path.join(__dirname, '../assets/fonts/ComicSans.ttf'),
            family: 'Comic Sans MS'
        });

        // Register fonts with canvas
        this.fonts.forEach((font, name) => {
            if (fs.existsSync(font.path)) {
                registerFont(font.path, { family: font.family });
            }
        });
    }

    loadTemplates() {
        // Predefined meme templates
        this.templates.set('drake', {
            image: path.join(__dirname, '../assets/memes/drake.jpg'),
            positions: [
                { top: 50, left: 300, width: 200, height: 200 }, // Top box
                { top: 300, left: 300, width: 200, height: 200 }  // Bottom box
            ]
        });

        this.templates.set('disaster', {
            image: path.join(__dirname, '../assets/memes/disaster.jpg'),
            positions: [
                { top: 50, left: 50, width: 400, height: 200 } // Single text area
            ]
        });

        // Add more templates as needed
    }

    async createMeme(imageBuffer, options = {}) {
        try {
            const {
                topText = '',
                bottomText = '',
                font = 'impact',
                fontSize = 40,
                textColor = 'white',
                strokeColor = 'black',
                strokeWidth = 2
            } = options;

            // Load the base image
            const image = await loadImage(imageBuffer);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');

            // Draw the base image
            ctx.drawImage(image, 0, 0, image.width, image.height);

            // Configure text styling
            ctx.font = `${fontSize}px "${this.fonts.get(font)?.family || 'Impact'}"`;
            ctx.fillStyle = textColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Add top text
            if (topText) {
                this.addText(ctx, topText, image.width / 2, fontSize + 10, image.width - 40);
            }

            // Add bottom text
            if (bottomText) {
                this.addText(ctx, bottomText, image.width / 2, image.height - fontSize - 10, image.width - 40);
            }

            // Convert canvas to buffer
            return canvas.toBuffer('image/png');
        } catch (error) {
            this.logger.error(`Meme creation failed: ${error.message}`);
            throw error;
        }
    }

    addText(ctx, text, x, y, maxWidth) {
        // Split text into multiple lines if needed
        const words = text.split(' ');
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const testLine = currentLine + ' ' + words[i];
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && i > 0) {
                lines.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine);

        // Draw each line of text
        for (let i = 0; i < lines.length; i++) {
            const lineY = y + (i * (parseInt(ctx.font) + 5));
            
            // Draw text with stroke (outline)
            ctx.strokeText(lines[i], x, lineY);
            ctx.fillText(lines[i], x, lineY);
        }
    }

    async createFromTemplate(templateName, texts = []) {
        try {
            const template = this.templates.get(templateName);
            if (!template) {
                throw new Error(`Template "${templateName}" not found`);
            }

            if (!fs.existsSync(template.image)) {
                throw new Error(`Template image not found: ${template.image}`);
            }

            const imageBuffer = await fs.readFile(template.image);
            const image = await loadImage(imageBuffer);
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');

            // Draw template image
            ctx.drawImage(image, 0, 0, image.width, image.height);

            // Configure text styling
            ctx.font = '40px "Impact"';
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Add text to each position
            template.positions.forEach((position, index) => {
                if (texts[index]) {
                    this.addText(
                        ctx,
                        texts[index],
                        position.left + position.width / 2,
                        position.top + position.height / 2,
                        position.width - 20
                    );
                }
            });

            return canvas.toBuffer('image/png');
        } catch (error) {
            this.logger.error(`Template meme creation failed: ${error.message}`);
            throw error;
        }
    }

    async listTemplates() {
        return Array.from(this.templates.keys());
    }

    async listFonts() {
        return Array.from(this.fonts.keys());
    }

    async getTemplateInfo(templateName) {
        const template = this.templates.get(templateName);
        if (!template) return null;

        return {
            name: templateName,
            textAreas: template.positions.length,
            dimensions: await this.getImageDimensions(template.image)
        };
    }

    async getImageDimensions(imagePath) {
        try {
            const metadata = await sharp(imagePath).metadata();
            return { width: metadata.width, height: metadata.height };
        } catch {
            return null;
        }
    }
}

// Meme Generator Commands
module.exports = {
    name: 'meme',
    version: '1.0.0',
    description: 'Advanced meme generator with templates and customization',
    category: 'fun',
    cooldown: 8,

    commands: {
        create: {
            description: 'Create a custom meme',
            usage: '/meme create "top text" "bottom text"'
        },
        template: {
            description: 'Create meme from template',
            usage: '/meme template <name> "text1" "text2"'
        },
        list: {
            description: 'List available templates',
            usage: '/meme list templates'
        },
        fonts: {
            description: 'List available fonts',
            usage: '/meme list fonts'
        }
    },

    async execute({ message, args, sock, bot }) {
        const memeGenerator = new MemeGenerator(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            if (!message.reply_message && subCommand !== 'list') {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('MEME.REPLY_REQUIRED')
                });
            }

            switch (subCommand) {
                case 'create':
                    return await this.createMeme(message, args.slice(1), memeGenerator, sock);
                case 'template':
                    return await this.createTemplateMeme(message, args.slice(1), memeGenerator, sock);
                case 'list':
                    return await this.listItems(message, args.slice(1), memeGenerator, sock);
                default:
                    return await this.showHelp(message, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Meme command error: ${error.message}`);
        }
    },

    async createMeme(message, args, memeGenerator, sock) {
        let topText = '';
        let bottomText = '';
        let options = {};

        // Parse text from quotes or arguments
        const textMatch = args.join(' ').match(/"([^"]+)"/g);
        if (textMatch) {
            topText = textMatch[0]?.replace(/"/g, '') || '';
            bottomText = textMatch[1]?.replace(/"/g, '') || '';
        } else {
            // Fallback to simple space separation
            [topText, bottomText] = args;
        }

        const imageBuffer = await message.reply_message.downloadMediaMessage();
        const memeBuffer = await memeGenerator.createMeme(imageBuffer, {
            topText,
            bottomText,
            font: 'impact',
            fontSize: 40,
            textColor: 'white',
            strokeColor: 'black',
            strokeWidth: 2
        });

        await sock.sendMessage(message.key.remoteJid, {
            image: memeBuffer,
            quoted: message
        });
    },

    async createTemplateMeme(message, args, memeGenerator, sock) {
        if (args.length < 1) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEME.TEMPLATE_USAGE')
            });
        }

        const templateName = args[0].toLowerCase();
        const texts = args.slice(1).map(text => text.replace(/"/g, ''));

        const templateInfo = await memeGenerator.getTemplateInfo(templateName);
        if (!templateInfo) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEME.TEMPLATE_NOT_FOUND', { name: templateName })
            });
        }

        if (texts.length < templateInfo.textAreas) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEME.TEMPLATE_NEED_TEXT', { count: templateInfo.textAreas })
            });
        }

        const memeBuffer = await memeGenerator.createFromTemplate(templateName, texts);
        await sock.sendMessage(message.key.remoteJid, {
            image: memeBuffer,
            quoted: message
        });
    },

    async listItems(message, args, memeGenerator, sock) {
        const listType = args[0]?.toLowerCase();

        if (listType === 'templates') {
            const templates = await memeGenerator.listTemplates();
            let listMessage = getString('MEME.TEMPLATE_LIST');
            templates.forEach(template => {
                listMessage += `\n• ${template}`;
            });

            await sock.sendMessage(message.key.remoteJid, { text: listMessage });
        } else if (listType === 'fonts') {
            const fonts = await memeGenerator.listFonts();
            let listMessage = getString('MEME.FONT_LIST');
            fonts.forEach(font => {
                listMessage += `\n• ${font}`;
            });

            await sock.sendMessage(message.key.remoteJid, { text: listMessage });
        } else {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEME.LIST_USAGE')
            });
        }
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Meme Generator Commands*

*/meme create "top" "bottom"* - Create custom meme (reply to image)
*/meme template <name> "text1" "text2"* - Use predefined template
*/meme list templates* - Show available templates
*/meme list fonts* - Show available fonts

?? *Popular Templates:*
drake, disaster, button, expand

? *Tip:* Use quotes for multi-word text`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};