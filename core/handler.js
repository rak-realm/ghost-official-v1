// GHOST-OFFICIAL-V1 Command Handler
// RAK Realm - Copyright RAK

const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const { getString } = require('../language-system');

class CommandHandler {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.security = bot.security;
        this.commands = new Map();
        this.aliases = new Map();
        
        this.logger.info('Command Handler initialized');
    }

    async loadCommands() {
        try {
            const commandsDir = path.join(__dirname, '../plugins');
            await fs.ensureDir(commandsDir);
            
            // Load core commands
            await this.loadCoreCommands();
            
            // Load plugin commands
            const files = await fs.readdir(commandsDir);
            const jsFiles = files.filter(f => f.endsWith('.js'));
            
            for (const file of jsFiles) {
                try {
                    const filePath = path.join(commandsDir, file);
                    const commandModule = require(filePath);
                    
                    if (commandModule.command && commandModule.execute) {
                        this.registerCommand(commandModule);
                        this.logger.debug(`Loaded plugin command: ${commandModule.command}`);
                    }
                } catch (error) {
                    this.logger.error(`Error loading command ${file}: ${error.message}`);
                }
            }
            
            this.logger.success(`Loaded ${this.commands.size} commands with ${this.aliases.size} aliases`);
            
        } catch (error) {
            this.logger.error(`Command loading failed: ${error.message}`);
        }
    }

    async loadCoreCommands() {
        // Basic core commands
        const coreCommands = [
            {
                command: 'help',
                description: 'Show available commands',
                category: 'general',
                execute: async (sock, message, args) => {
                    await this.showHelp(sock, message, args);
                }
            },
            {
                command: 'ping',
                description: 'Check bot response time',
                category: 'general',
                execute: async (sock, message) => {
                    const start = Date.now();
                    const reply = await sock.sendMessage(message.key.remoteJid, { 
                        text: getString('COMMON.PING', { responseTime: Date.now() - start })
                    }, { quoted: message });
                }
            },
            {
                command: 'stats',
                description: 'Show bot statistics',
                category: 'general',
                execute: async (sock, message) => {
                    const stats = this.bot.getStats();
                    await sock.sendMessage(message.key.remoteJid, { 
                        text: `📊 *Bot Statistics*\n\n` +
                              `⏰ Uptime: ${this.formatUptime(stats.uptime)}\n` +
                              `💬 Commands Handled: ${stats.commandsHandled}\n` +
                              `👥 Users Served: ${stats.usersServed}\n` +
                              `🛡️ Security Blocks: ${stats.securityBlocks}`
                    }, { quoted: message });
                }
            }
        ];
        
        coreCommands.forEach(cmd => this.registerCommand(cmd));
    }

    registerCommand(commandModule) {
        this.commands.set(commandModule.command, commandModule);
        
        // Register aliases if they exist
        if (commandModule.aliases && Array.isArray(commandModule.aliases)) {
            commandModule.aliases.forEach(alias => {
                this.aliases.set(alias, commandModule.command);
            });
        }
    }

    async processMessage(message, sock) {
        try {
            const messageText = this.extractMessageText(message);
            if (!messageText) return;
            
            const jid = message.key.remoteJid;
            const isGroup = jid.endsWith('@g.us');
            const prefix = config.PREFIX;
            
            // Check if message starts with prefix
            if (!messageText.startsWith(prefix)) return;
            
            // Extract command and arguments
            const args = messageText.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            
            // Get the actual command from command or alias
            const actualCommand = this.aliases.get(commandName) || commandName;
            const command = this.commands.get(actualCommand);
            
            if (!command) {
                await sock.sendMessage(jid, { 
                    text: getString('ERRORS.COMMAND_NOT_FOUND')
                }, { quoted: message });
                return;
            }
            
            // Check permissions
            const userId = message.key.participant || jid;
            if (command.adminOnly && !this.security.isAdmin(userId)) {
                await sock.sendMessage(jid, { 
                    text: getString('ERRORS.NO_PERMISSION')
                }, { quoted: message });
                return;
            }
            
            if (command.ownerOnly && !this.security.isOwner(userId)) {
                await sock.sendMessage(jid, { 
                    text: getString('ERRORS.NO_PERMISSION')
                }, { quoted: message });
                return;
            }
            
            if (command.groupOnly && !isGroup) {
                await sock.sendMessage(jid, { 
                    text: getString('ERRORS.ONLY_GROUP')
                }, { quoted: message });
                return;
            }
            
            if (command.privateOnly && isGroup) {
                await sock.sendMessage(jid, { 
                    text: getString('ERRORS.ONLY_PRIVATE')
                }, { quoted: message });
                return;
            }
            
            // Execute the command
            try {
                await command.execute(sock, message, args);
                this.logger.info(`Command executed: ${actualCommand} by ${userId}`);
            } catch (error) {
                this.logger.error(`Command execution failed: ${actualCommand} - ${error.message}`);
                await sock.sendMessage(jid, { 
                    text: `❌ Command execution failed: ${error.message}`
                }, { quoted: message });
            }
            
        } catch (error) {
            this.logger.error(`Message processing error: ${error.message}`);
        }
    }

    extractMessageText(message) {
        if (message.message?.conversation) return message.message.conversation;
        if (message.message?.extendedTextMessage?.text) return message.message.extendedTextMessage.text;
        return null;
    }

    async showHelp(sock, message, args) {
        const jid = message.key.remoteJid;
        const userId = message.key.participant || jid;
        const isAdmin = this.security.isAdmin(userId);
        
        let helpText = getString('COMMON.HELP_HEADER') + '\n\n';
        const categories = {};
        
        // Organize commands by category
        for (const [name, cmd] of this.commands.entries()) {
            // Skip admin commands for non-admins
            if ((cmd.adminOnly || cmd.ownerOnly) && !isAdmin) continue;
            
            if (!categories[cmd.category]) {
                categories[cmd.category] = [];
            }
            
            categories[cmd.category].push({
                name,
                description: cmd.description,
                usage: cmd.usage
            });
        }
        
        // Build help text
        for (const [category, commands] of Object.entries(categories)) {
            helpText += `*${category.toUpperCase()} COMMANDS:*\n`;
            
            for (const cmd of commands) {
                helpText += `• ${config.PREFIX}${cmd.name}`;
                if (cmd.usage) helpText += ` ${cmd.usage}`;
                helpText += ` - ${cmd.description}\n`;
            }
            
            helpText += '\n';
        }
        
        helpText += getString('COMMON.HELP_FOOTER');
        
        await sock.sendMessage(jid, { text: helpText }, { quoted: message });
    }

    formatUptime(uptime) {
        const seconds = Math.floor(uptime / 1000);
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (parts.length === 0) parts.push(`${seconds}s`);
        
        return parts.join(' ');
    }

    getCommandList() {
        return Array.from(this.commands.keys());
    }

    getCommandInfo(commandName) {
        return this.commands.get(commandName);
    }
}

module.exports = { CommandHandler };
