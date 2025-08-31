// GHOST-OFFICIAL-V1 Auto-Reply System
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');

class AutoReplySystem {
    constructor(bot) {
        this.bot = bot;
        this.filters = new Map(); // jid -> filter array
        this.logger = bot.logger;
    }

    async initialize() {
        this.logger.info('Initializing auto-reply system...');
        // Load persistent filters if needed
    }

    async addFilter(jid, pattern, response, options = {}) {
        const filter = {
            pattern: pattern,
            response: response,
            regex: options.regex || false,
            caseSensitive: options.caseSensitive || false,
            exactMatch: options.exactMatch || false,
            created: Date.now(),
            creator: options.creator || 'system'
        };

        if (!this.filters.has(jid)) {
            this.filters.set(jid, []);
        }

        this.filters.get(jid).push(filter);
        this.logger.info(`Filter added to ${jid}: ${pattern} -> ${response.substring(0, 50)}...`);
        
        return filter;
    }

    async removeFilter(jid, pattern) {
        if (!this.filters.has(jid)) return false;

        const initialLength = this.filters.get(jid).length;
        this.filters.set(
            jid,
            this.filters.get(jid).filter(f => f.pattern !== pattern)
        );

        const removed = initialLength !== this.filters.get(jid).length;
        if (removed) {
            this.logger.info(`Filter removed from ${jid}: ${pattern}`);
        }

        return removed;
    }

    async getFilters(jid) {
        return this.filters.get(jid) || [];
    }

    async clearFilters(jid) {
        const hadFilters = this.filters.has(jid);
        this.filters.delete(jid);
        
        if (hadFilters) {
            this.logger.info(`All filters cleared from ${jid}`);
        }
        
        return hadFilters;
    }

    async processMessage(message) {
        if (!message.key?.remoteJid || !message.message) return null;

        const jid = message.key.remoteJid;
        const text = this.extractText(message);
        if (!text) return null;

        const filters = await this.getFilters(jid);
        if (filters.length === 0) return null;

        for (const filter of filters) {
            if (this.matchesFilter(text, filter)) {
                return this.prepareResponse(filter.response, message);
            }
        }

        return null;
    }

    matchesFilter(text, filter) {
        if (filter.exactMatch) {
            return filter.caseSensitive 
                ? text === filter.pattern
                : text.toLowerCase() === filter.pattern.toLowerCase();
        }

        if (filter.regex) {
            try {
                const flags = filter.caseSensitive ? 'g' : 'gi';
                const regex = new RegExp(filter.pattern, flags);
                return regex.test(text);
            } catch (error) {
                this.logger.error(`Invalid regex pattern: ${filter.pattern}`);
                return false;
            }
        }

        // Default: contains match
        return filter.caseSensitive
            ? text.includes(filter.pattern)
            : text.toLowerCase().includes(filter.pattern.toLowerCase());
    }

    prepareResponse(response, originalMessage) {
        // Replace variables in response
        let finalResponse = response;
        
        // Add support for dynamic variables
        const variables = {
            '{user}': originalMessage.key.participant?.split('@')[0] || 'User',
            '{group}': originalMessage.key.remoteJid.split('@')[0],
            '{time}': new Date().toLocaleTimeString(),
            '{date}': new Date().toLocaleDateString()
        };

        for (const [key, value] of Object.entries(variables)) {
            finalResponse = finalResponse.replace(new RegExp(key, 'g'), value);
        }

        return {
            text: finalResponse,
            quoted: originalMessage
        };
    }

    extractText(message) {
        if (message.message?.conversation) return message.message.conversation;
        if (message.message?.extendedTextMessage?.text) {
            return message.message.extendedTextMessage.text;
        }
        return null;
    }

    exportFilters(jid) {
        const filters = this.filters.get(jid);
        if (!filters) return null;

        return filters.map(f => ({
            pattern: f.pattern,
            response: f.response,
            options: {
                regex: f.regex,
                caseSensitive: f.caseSensitive,
                exactMatch: f.exactMatch
            }
        }));
    }

    importFilters(jid, filterData) {
        if (!Array.isArray(filterData)) return false;

        filterData.forEach(async (data) => {
            await this.addFilter(jid, data.pattern, data.response, data.options);
        });

        return true;
    }
}

// Auto-Reply Commands
module.exports = {
    name: 'filter',
    version: '1.0.0',
    description: 'Advanced auto-reply filter system',
    category: 'automation',
    cooldown: 3,

    commands: {
        add: {
            description: 'Add a new auto-reply filter',
            usage: '/filter add "pattern" "response" [options]'
        },
        remove: {
            description: 'Remove a filter',
            usage: '/filter remove "pattern"'
        },
        list: {
            description: 'List all filters',
            usage: '/filter list'
        },
        clear: {
            description: 'Clear all filters',
            usage: '/filter clear'
        }
    },

    async execute({ message, args, sock, bot }) {
        const filterSystem = new AutoReplySystem(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            switch (subCommand) {
                case 'add':
                    return await this.addFilter(message, args.slice(1), filterSystem, sock);
                case 'remove':
                    return await this.removeFilter(message, args.slice(1), filterSystem, sock);
                case 'list':
                    return await this.listFilters(message, filterSystem, sock);
                case 'clear':
                    return await this.clearFilters(message, filterSystem, sock);
                default:
                    return await this.showHelp(message, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Filter command error: ${error.message}`);
        }
    },

    async addFilter(message, args, filterSystem, sock) {
        if (args.length < 2) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('FILTER.ADD_USAGE')
            });
        }

        // Extract pattern and response from quotes
        const patternMatch = args.join(' ').match(/"([^"]+)"/);
        const responseMatch = args.join(' ').match(/"([^"]+)"/g);

        if (!patternMatch || !responseMatch || responseMatch.length < 2) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('FILTER.INVALID_FORMAT')
            });
        }

        const pattern = patternMatch[1];
        const response = responseMatch[1].replace(/^"|"$/g, '');
        const options = this.parseOptions(args.join(' '));

        await filterSystem.addFilter(message.key.remoteJid, pattern, response, options);

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('FILTER.ADDED', { pattern, response: response.substring(0, 50) })
        });
    },

    async removeFilter(message, args, filterSystem, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('FILTER.REMOVE_USAGE')
            });
        }

        const pattern = args.join(' ').replace(/^"|"$/g, '');
        const removed = await filterSystem.removeFilter(message.key.remoteJid, pattern);

        await sock.sendMessage(message.key.remoteJid, {
            text: removed 
                ? getString('FILTER.REMOVED', { pattern })
                : getString('FILTER.NOT_FOUND', { pattern })
        });
    },

    async listFilters(message, filterSystem, sock) {
        const filters = await filterSystem.getFilters(message.key.remoteJid);

        if (filters.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('FILTER.NO_FILTERS')
            });
        }

        let listMessage = getString('FILTER.LIST_HEADER');
        filters.forEach((filter, index) => {
            listMessage += `\n${index + 1}. "${filter.pattern}" -> "${filter.response.substring(0, 30)}..."`;
        });

        await sock.sendMessage(message.key.remoteJid, { text: listMessage });
    },

    async clearFilters(message, filterSystem, sock) {
        const cleared = await filterSystem.clearFilters(message.key.remoteJid);

        await sock.sendMessage(message.key.remoteJid, {
            text: cleared 
                ? getString('FILTER.CLEARED')
                : getString('FILTER.NO_FILTERS')
        });
    },

    parseOptions(text) {
        const options = {};
        
        if (text.includes('--regex')) options.regex = true;
        if (text.includes('--case')) options.caseSensitive = true;
        if (text.includes('--exact')) options.exactMatch = true;

        return options;
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Auto-Reply Filter System*

*/filter add "pattern" "response"* - Add new filter
*/filter remove "pattern"* - Remove filter
*/filter list* - List all filters
*/filter clear* - Clear all filters

?? *Options:*
--regex - Use regex pattern matching
--case - Case-sensitive matching  
--exact - Exact match only

?? *Examples:*
*/filter add "hello" "Hi there!"*
*/filter add "bot" "I'm a bot!" --exact*
*/filter add "time" "Current time: {time}"*`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    },

    // Handle incoming messages for auto-replies
    async onMessage({ message, sock, bot }) {
        const filterSystem = new AutoReplySystem(bot);
        const response = await filterSystem.processMessage(message);
        
        if (response) {
            await sock.sendMessage(message.key.remoteJid, response);
        }
    }
};