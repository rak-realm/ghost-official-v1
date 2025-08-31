// GHOST-OFFICIAL-V1 Group Manager
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');

class GroupManager {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.groupSettings = new Map(); // jid -> settings
        this.welcomeMessages = new Map();
        this.goodbyeMessages = new Map();
        this.banbyeMessages = new Map();
    }

    async initialize() {
        this.logger.info('Initializing group management system...');
        // Load persistent group settings
    }

    // Welcome/Goodbye/Banbye Messages
    async setWelcomeMessage(jid, message) {
        this.welcomeMessages.set(jid, message);
        this.logger.info(`Welcome message set for ${jid}`);
        return true;
    }

    async setGoodbyeMessage(jid, message) {
        this.goodbyeMessages.set(jid, message);
        this.logger.info(`Goodbye message set for ${jid}`);
        return true;
    }

    async setBanbyeMessage(jid, message) {
        this.banbyeMessages.set(jid, message);
        this.logger.info(`Banbye message set for ${jid}`);
        return true;
    }

    async getWelcomeMessage(jid) {
        return this.welcomeMessages.get(jid);
    }

    async getGoodbyeMessage(jid) {
        return this.goodbyeMessages.get(jid);
    }

    async getBanbyeMessage(jid) {
        return this.banbyeMessages.get(jid);
    }

    async clearWelcomeMessage(jid) {
        const hadMessage = this.welcomeMessages.has(jid);
        this.welcomeMessages.delete(jid);
        return hadMessage;
    }

    async clearGoodbyeMessage(jid) {
        const hadMessage = this.goodbyeMessages.has(jid);
        this.goodbyeMessages.delete(jid);
        return hadMessage;
    }

    async clearBanbyeMessage(jid) {
        const hadMessage = this.banbyeMessages.has(jid);
        this.banbyeMessages.delete(jid);
        return hadMessage;
    }

    // Group Protection
    async setAntiLink(jid, enabled, allowedDomains = []) {
        if (!this.groupSettings.has(jid)) {
            this.groupSettings.set(jid, {});
        }

        this.groupSettings.get(jid).antiLink = {
            enabled,
            allowedDomains,
            lastChecked: Date.now()
        };

        this.logger.info(`Anti-link ${enabled ? 'enabled' : 'disabled'} for ${jid}`);
        return true;
    }

    async setAntiFake(jid, enabled, allowedCountries = []) {
        if (!this.groupSettings.has(jid)) {
            this.groupSettings.set(jid, {});
        }

        this.groupSettings.get(jid).antiFake = {
            enabled,
            allowedCountries,
            lastChecked: Date.now()
        };

        this.logger.info(`Anti-fake ${enabled ? 'enabled' : 'disabled'} for ${jid}`);
        return true;
    }

    async setAntiBadWords(jid, enabled, wordList = []) {
        if (!this.groupSettings.has(jid)) {
            this.groupSettings.set(jid, {});
        }

        this.groupSettings.get(jid).antiBadWords = {
            enabled,
            wordList,
            lastChecked: Date.now()
        };

        this.logger.info(`Anti-bad-words ${enabled ? 'enabled' : 'disabled'} for ${jid}`);
        return true;
    }

    // Event Handlers
    async handleParticipantUpdate(update, sock) {
        const { jid, participants, action } = update;

        try {
            switch (action) {
                case 'add':
                    await this.handleWelcome(jid, participants, sock);
                    break;
                case 'remove':
                    await this.handleGoodbye(jid, participants, sock);
                    break;
            }
        } catch (error) {
            this.logger.error(`Error handling participant update: ${error.message}`);
        }
    }

    async handleWelcome(jid, newParticipants, sock) {
        const welcomeMessage = await this.getWelcomeMessage(jid);
        if (!welcomeMessage) return;

        for (const participant of newParticipants) {
            const formattedMessage = this.formatMessage(welcomeMessage, participant, jid);
            await sock.sendMessage(jid, { text: formattedMessage });
        }
    }

    async handleGoodbye(jid, leftParticipants, sock) {
        const goodbyeMessage = await this.getGoodbyeMessage(jid);
        if (!goodbyeMessage) return;

        for (const participant of leftParticipants) {
            const formattedMessage = this.formatMessage(goodbyeMessage, participant, jid);
            await sock.sendMessage(jid, { text: formattedMessage });
        }
    }

    async handleBanbye(jid, bannedParticipants, sock) {
        const banbyeMessage = await this.getBanbyeMessage(jid);
        if (!banbyeMessage) return;

        for (const participant of bannedParticipants) {
            const formattedMessage = this.formatMessage(banbyeMessage, participant, jid);
            await sock.sendMessage(jid, { text: formattedMessage });
        }
    }

    formatMessage(template, participant, groupJid) {
        let message = template;
        
        const variables = {
            '{user}': participant.split('@')[0],
            '{group}': groupJid.split('@')[0],
            '{time}': new Date().toLocaleTimeString(),
            '{date}': new Date().toLocaleDateString(),
            '{mention}': `@${participant.split('@')[0]}`
        };

        for (const [key, value] of Object.entries(variables)) {
            message = message.replace(new RegExp(key, 'g'), value);
        }

        return message;
    }

    // Security Checks
    async checkAntiLink(jid, message) {
        const settings = this.groupSettings.get(jid)?.antiLink;
        if (!settings || !settings.enabled) return true;

        const text = this.extractText(message);
        if (!text) return true;

        // Basic URL detection
        const urlRegex = /https?:\/\/[^\s]+/g;
        const urls = text.match(urlRegex);
        if (!urls) return true;

        for (const url of urls) {
            const domain = new URL(url).hostname;
            if (!settings.allowedDomains.includes(domain)) {
                return false; // Block message
            }
        }

        return true;
    }

    extractText(message) {
        if (message.message?.conversation) return message.message.conversation;
        if (message.message?.extendedTextMessage?.text) {
            return message.message.extendedTextMessage.text;
        }
        return null;
    }
}

// Group Management Commands
module.exports = {
    name: 'group',
    version: '1.0.0',
    description: 'Advanced group management and automation',
    category: 'moderation',
    cooldown: 5,

    commands: {
        welcome: {
            description: 'Set welcome message for new members',
            usage: '/group welcome "message"'
        },
        goodbye: {
            description: 'Set goodbye message for leaving members',
            usage: '/group goodbye "message"'
        },
        banbye: {
            description: 'Set message for banned members',
            usage: '/group banbye "message"'
        },
        antilink: {
            description: 'Configure anti-link protection',
            usage: '/group antilink on/off'
        }
    },

    async execute({ message, args, sock, bot }) {
        const groupManager = new GroupManager(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            if (!message.key.remoteJid.endsWith('@g.us')) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('GROUP.ONLY_GROUPS')
                });
            }

            switch (subCommand) {
                case 'welcome':
                    return await this.handleWelcome(message, args.slice(1), groupManager, sock);
                case 'goodbye':
                    return await this.handleGoodbye(message, args.slice(1), groupManager, sock);
                case 'banbye':
                    return await this.handleBanbye(message, args.slice(1), groupManager, sock);
                case 'antilink':
                    return await this.handleAntiLink(message, args.slice(1), groupManager, sock);
                default:
                    return await this.showHelp(message, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Group command error: ${error.message}`);
        }
    },

    async handleWelcome(message, args, groupManager, sock) {
        if (args.length === 0) {
            const current = await groupManager.getWelcomeMessage(message.key.remoteJid);
            return await sock.sendMessage(message.key.remoteJid, {
                text: current 
                    ? getString('GROUP.CURRENT_WELCOME', { message: current })
                    : getString('GROUP.NO_WELCOME')
            });
        }

        if (args[0] === 'clear') {
            const cleared = await groupManager.clearWelcomeMessage(message.key.remoteJid);
            return await sock.sendMessage(message.key.remoteJid, {
                text: cleared 
                    ? getString('GROUP.WELCOME_CLEARED')
                    : getString('GROUP.NO_WELCOME')
            });
        }

        const welcomeMessage = args.join(' ');
        await groupManager.setWelcomeMessage(message.key.remoteJid, welcomeMessage);

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('GROUP.WELCOME_SET', { message: welcomeMessage })
        });
    },

    async handleGoodbye(message, args, groupManager, sock) {
        // Similar implementation to handleWelcome
    },

    async handleBanbye(message, args, groupManager, sock) {
        // Similar implementation to handleWelcome
    },

    async handleAntiLink(message, args, groupManager, sock) {
        if (args.length === 0) {
            const settings = groupManager.groupSettings.get(message.key.remoteJid)?.antiLink;
            return await sock.sendMessage(message.key.remoteJid, {
                text: settings?.enabled 
                    ? getString('GROUP.ANTILINK_ENABLED')
                    : getString('GROUP.ANTILINK_DISABLED')
            });
        }

        const action = args[0].toLowerCase();
        if (action === 'on' || action === 'off') {
            await groupManager.setAntiLink(message.key.remoteJid, action === 'on');
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('GROUP.ANTILINK_UPDATED', { status: action })
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('GROUP.INVALID_ANTILINK_ACTION')
        });
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Group Management Commands*

*/group welcome "message"* - Set welcome message
*/group goodbye "message"* - Set goodbye message  
*/group banbye "message"* - Set ban message
*/group antilink on/off* - Toggle anti-link protection

?? *Usage:* These commands work only in groups
? *Variables:* Use {user}, {group}, {time}, {date} in messages`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};