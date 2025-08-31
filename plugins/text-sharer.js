// GHOST-OFFICIAL-V1 Text Sharer
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const axios = require('axios');

class TextSharer {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.services = {
            'nekobin': this.uploadToNekobin.bind(this),
            'pastebin': this.uploadToPastebin.bind(this),
            'hastebin': this.uploadToHastebin.bind(this),
            'ghostbin': this.uploadToGhostbin.bind(this)
        };
    }

    async initialize() {
        this.logger.info('Initializing text sharing system...');
    }

    async uploadText(text, service = 'nekobin', options = {}) {
        try {
            if (!this.services[service]) {
                throw new Error(`Service "${service}" not supported`);
            }

            if (text.length > 10000) {
                throw new Error('Text too long (max 10,000 characters)');
            }

            return await this.services[service](text, options);
        } catch (error) {
            this.logger.error(`Text upload failed: ${error.message}`);
            throw error;
        }
    }

    async uploadToNekobin(text, options = {}) {
        try {
            const response = await axios.post('https://nekobin.com/api/documents', {
                content: text,
                title: options.title || 'GHOST-OFFICIAL-V1 Paste',
                author: options.author || 'RAK Realm Bot'
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            if (!response.data.ok) {
                throw new Error('Nekobin upload failed');
            }

            return {
                success: true,
                url: `https://nekobin.com/${response.data.result.key}`,
                raw: `https://nekobin.com/raw/${response.data.result.key}`,
                service: 'nekobin'
            };
        } catch (error) {
            throw new Error(`Nekobin error: ${error.message}`);
        }
    }

    async uploadToPastebin(text, options = {}) {
        // Pastebin requires API key and has more restrictions
        // This would be a more complex implementation
        throw new Error('Pastebin integration not implemented');
    }

    async uploadToHastebin(text, options = {}) {
        try {
            const response = await axios.post('https://hastebin.com/documents', text, {
                headers: {
                    'Content-Type': 'text/plain'
                },
                timeout: 10000
            });

            if (!response.data.key) {
                throw new Error('Hastebin upload failed');
            }

            return {
                success: true,
                url: `https://hastebin.com/${response.data.key}`,
                raw: `https://hastebin.com/raw/${response.data.key}`,
                service: 'hastebin'
            };
        } catch (error) {
            throw new Error(`Hastebin error: ${error.message}`);
        }
    }

    async uploadToGhostbin(text, options = {}) {
        try {
            const response = await axios.post('https://ghostbin.com/paste/new', {
                text: text,
                title: options.title || 'GHOST-OFFICIAL-V1 Paste',
                language: options.language || 'text'
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000
            });

            // Ghostbin returns HTML, would need parsing
            throw new Error('Ghostbin integration not fully implemented');
        } catch (error) {
            throw new Error(`Ghostbin error: ${error.message}`);
        }
    }

    async downloadFromUrl(url) {
        try {
            const service = this.detectServiceFromUrl(url);
            
            switch (service) {
                case 'nekobin':
                    return await this.downloadFromNekobin(url);
                case 'hastebin':
                    return await this.downloadFromHastebin(url);
                default:
                    throw new Error('Unsupported service for download');
            }
        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    async downloadFromNekobin(url) {
        try {
            const key = url.split('/').pop();
            const response = await axios.get(`https://nekobin.com/raw/${key}`, {
                timeout: 10000
            });

            return {
                success: true,
                content: response.data,
                service: 'nekobin'
            };
        } catch (error) {
            throw new Error(`Nekobin download failed: ${error.message}`);
        }
    }

    async downloadFromHastebin(url) {
        try {
            const key = url.split('/').pop();
            const response = await axios.get(`https://hastebin.com/raw/${key}`, {
                timeout: 10000
            });

            return {
                success: true,
                content: response.data,
                service: 'hastebin'
            };
        } catch (error) {
            throw new Error(`Hastebin download failed: ${error.message}`);
        }
    }

    detectServiceFromUrl(url) {
        if (url.includes('nekobin.com')) return 'nekobin';
        if (url.includes('pastebin.com')) return 'pastebin';
        if (url.includes('hastebin.com')) return 'hastebin';
        if (url.includes('ghostbin.com')) return 'ghostbin';
        return null;
    }

    validateTextLength(text, maxLength = 10000) {
        return text.length <= maxLength;
    }

    async getServiceInfo(service) {
        const info = {
            'nekobin': {
                name: 'Nekobin',
                maxLength: 10000,
                features: ['raw', 'highlighting', 'expiration'],
                url: 'https://nekobin.com'
            },
            'hastebin': {
                name: 'Hastebin',
                maxLength: 10000,
                features: ['raw', 'simple'],
                url: 'https://hastebin.com'
            },
            'pastebin': {
                name: 'Pastebin',
                maxLength: 500000,
                features: ['raw', 'highlighting', 'expiration', 'private'],
                url: 'https://pastebin.com'
            }
        };

        return info[service] || null;
    }
}

// Text Sharing Commands
module.exports = {
    name: 'paste',
    version: '1.0.0',
    description: 'Advanced text sharing and pastebin services',
    category: 'tools',
    cooldown: 5,

    commands: {
        create: {
            description: 'Create a new paste',
            usage: '/paste create [service]'
        },
        get: {
            description: 'Download from paste URL',
            usage: '/paste get <url>'
        },
        services: {
            description: 'List available services',
            usage: '/paste services'
        }
    },

    async execute({ message, args, sock, bot }) {
        const textSharer = new TextSharer(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            switch (subCommand) {
                case 'create':
                    return await this.createPaste(message, args.slice(1), textSharer, sock);
                case 'get':
                    return await this.getPaste(message, args.slice(1), textSharer, sock);
                case 'services':
                    return await this.listServices(message, textSharer, sock);
                default:
                    return await this.showHelp(message, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Paste command error: ${error.message}`);
        }
    },

    async createPaste(message, args, textSharer, sock) {
        if (!message.reply_message && args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('PASTE.REPLY_REQUIRED')
            });
        }

        const text = message.reply_message?.text || args.join(' ');
        const service = args[0]?.toLowerCase() || 'nekobin';

        if (!textSharer.validateTextLength(text)) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('PASTE.TEXT_TOO_LONG')
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('PASTE.UPLOADING', { service })
        });

        try {
            const result = await textSharer.uploadText(text, service, {
                title: `Shared from GHOST-OFFICIAL-V1`,
                author: 'RAK Realm Bot'
            });

            await sock.sendMessage(message.key.remoteJid, {
                text: getString('PASTE.UPLOAD_SUCCESS', {
                    url: result.url,
                    service: result.service
                })
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('PASTE.UPLOAD_FAILED', { error: error.message })
            });
        }
    },

    async getPaste(message, args, textSharer, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('PASTE.URL_REQUIRED')
            });
        }

        const url = args[0];
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('PASTE.DOWNLOADING')
        });

        try {
            const result = await textSharer.downloadFromUrl(url);
            
            if (result.content.length > 500) {
                // Send as document if content is long
                await sock.sendMessage(message.key.remoteJid, {
                    text: result.content.substring(0, 500) + '...',
                    quoted: message
                });
                
                await sock.sendMessage(message.key.remoteJid, {
                    document: Buffer.from(result.content),
                    fileName: `paste.txt`,
                    mimetype: 'text/plain'
                });
            } else {
                await sock.sendMessage(message.key.remoteJid, {
                    text: result.content,
                    quoted: message
                });
            }

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('PASTE.DOWNLOAD_FAILED', { error: error.message })
            });
        }
    },

    async listServices(message, textSharer, sock) {
        let servicesMessage = getString('PASTE.SERVICES_LIST');
        
        const services = ['nekobin', 'hastebin', 'pastebin'];
        for (const service of services) {
            const info = await textSharer.getServiceInfo(service);
            if (info) {
                servicesMessage += `\n\n?? *${info.name}*`;
                servicesMessage += `\n?? Max: ${info.maxLength} chars`;
                servicesMessage += `\n? Features: ${info.features.join(', ')}`;
                servicesMessage += `\n?? ${info.url}`;
            }
        }

        await sock.sendMessage(message.key.remoteJid, { text: servicesMessage });
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Text Sharing Commands*

*/paste create [service]* - Create paste (reply to text)
*/paste get <url>* - Download from paste URL
*/paste services* - List available services

?? *Supported Services:*
• Nekobin (default) - 10k chars, highlighting
• Hastebin - 10k chars, simple
• Pastebin - 500k chars, advanced features

?? *Usage:* Reply to a text message or provide text as argument`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};