// GHOST-OFFICIAL-V1 Command Handler
// RAK Realm - Copyright RAK

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { getString } = require('../utils/language-system');
const { SecuritySystem } = require('../core/security');
const { ThemeManager } = require('../core/theme');

class CommandHandler {
    constructor(bot) {
        this.bot = bot;
        this.commands = new Map();
        this.aliases = new Map();
        this.cooldowns = new Map();
        this.commandDir = path.join(__dirname, '../commands');
        
        this.logger = bot.logger;
        this.security = new SecuritySystem(bot);
        this.themeManager = new ThemeManager(bot);
    }

    async initialize() {
        try {
            this.logger.info('Loading command system...');
            
            // Load all commands
            await this.loadCommands();
            
            // Load command aliases
            await this.loadAliases();
            
            this.logger.success(`Loaded ${this.commands.size} commands with ${this.aliases.size} aliases`);
            
        } catch (error) {
            this.logger.error(`Command handler initialization failed: ${error.message}`);
        }
    }

    async loadCommands() {
        try {
            // Ensure commands directory exists
            await fs.ensureDir(this.commandDir);
            
            const categories = await fs.readdir(this.commandDir);
            
            for (const category of categories) {
                const categoryPath = path.join(this.commandDir, category);
                
                if ((await fs.stat(categoryPath)).isDirectory()) {
                    const commandFiles = (await fs.readdir(categoryPath)).filter(file => 
                        file.endsWith('.js') && !file.startsWith('_')
                    );

                    for (const file of commandFiles) {
                        await this.loadCommand(category, file);
                    }
                }
            }
            
        } catch (error) {
            this.logger.error(`Error loading commands: ${error.message}`);
        }
    }

    async loadCommand(category, file) {
        try {
            const commandPath = path.join(this.commandDir, category, file);
            const command = require(commandPath);
            
            if (!command.name || !command.execute) {
                this.logger.warn(`Skipping invalid command: ${file}`);
                return;
            }

            // Add command to registry
            this.commands.set(command.name, {
                ...command,
                category,
                file: path.basename(file, '.js'),
                loadedAt: new Date()
            });

            // Register aliases
            if (command.aliases && Array.isArray(command.aliases)) {
                command.aliases.forEach(alias => {
                    this.aliases.set(alias, command.name);
                });
            }

            this.logger.debug(`Loaded command: /${command.name} (${category})`);
            
        } catch (error) {
            this.logger.error(`Error loading command ${file}: ${error.message}`);
        }
    }

    async loadAliases() {
        // Load custom aliases from database or file
        const customAliases = await this.loadCustomAliases();
        
        customAliases.forEach(({ alias, command }) => {
            if (this.commands.has(command)) {
                this.aliases.set(alias, command);
            }
        });
    }

    async processMessage(message, sock) {
        try {
            if (!message.message || !message.key.remoteJid) return;

            const text = this.extractText(message);
            if (!text || !text.startsWith(this.bot.config.PREFIX)) return;

            // Extract command and arguments
            const [commandName, ...args] = text.slice(this.bot.config.PREFIX.length).trim().split(/\s+/);
            const command = this.resolveCommand(commandName.toLowerCase());

            if (!command) return;

            // Security check
            const securityCheck = await this.security.checkCommandSafety(command, message, args);
            if (!securityCheck.safe) {
                await this.sendSecurityWarning(message, securityCheck, sock);
                return;
            }

            // Check cooldown
            if (await this.isOnCooldown(command.name, message.key.remoteJid)) {
                await this.sendCooldownMessage(message, command, sock);
                return;
            }

            // Execute command
            await this.executeCommand(command, message, args, sock);

            // Update cooldown
            this.setCooldown(command.name, message.key.remoteJid);

        } catch (error) {
            this.logger.error(`Error processing message: ${error.message}`);
        }
    }

    async executeCommand(command, message, args, sock) {
        try {
            // Apply theme to message context
            const themedMessage = await this.themeManager.applyTheme(message);
            
            // Execute command with enhanced context
            await command.execute({
                message: themedMessage,
                args,
                sock,
                bot: this.bot,
                security: this.security,
                theme: this.themeManager,
                logger: this.logger,
                reply: (content, options) => this.reply(message, content, options, sock)
            });

            // Log successful command execution
            this.logger.info(`Command executed: /${command.name} by ${message.key.remoteJid}`);

        } catch (error) {
            this.logger.error(`Command execution failed: /${command.name} - ${error.message}`);
            await this.sendError(message, error, sock);
        }
    }

    resolveCommand(input) {
        return this.commands.get(input) || this.commands.get(this.aliases.get(input));
    }

    async sendSecurityWarning(message, securityCheck, sock) {
        const warningMessage = await this.themeManager.format(
            'SECURITY_WARNING',
            {
                reason: securityCheck.reason,
                command: securityCheck.command,
                riskLevel: securityCheck.riskLevel
            }
        );

        await sock.sendMessage(message.key.remoteJid, {
            text: warningMessage,
            quoted: message
        });
    }

    async sendCooldownMessage(message, command, sock) {
        const cooldownMessage = await this.themeManager.format(
            'COOLDOWN_WARNING',
            {
                command: command.name,
                cooldown: command.cooldown || 3
            }
        );

        await sock.sendMessage(message.key.remoteJid, {
            text: cooldownMessage,
            quoted: message
        });
    }

    async sendError(message, error, sock) {
        const errorMessage = await this.themeManager.format(
            'COMMAND_ERROR',
            {
                error: error.message.substring(0, 100)
            }
        );

        await sock.sendMessage(message.key.remoteJid, {
            text: errorMessage,
            quoted: message
        });
    }

    async reply(originalMessage, content, options = {}, sock) {
        const finalOptions = {
            quoted: originalMessage,
            ...options
        };

        if (typeof content === 'string') {
            return await sock.sendMessage(originalMessage.key.remoteJid, {
                text: content,
                ...finalOptions
            });
        }

        return await sock.sendMessage(originalMessage.key.remoteJid, content, finalOptions);
    }

    extractText(message) {
        if (message.message.conversation) return message.message.conversation;
        if (message.message.extendedTextMessage?.text) return message.message.extendedTextMessage.text;
        return null;
    }

    async isOnCooldown(commandName, userId) {
        const key = `${commandName}:${userId}`;
        const cooldown = this.cooldowns.get(key);
        
        if (!cooldown) return false;
        return Date.now() - cooldown < (this.commands.get(commandName)?.cooldown || 3) * 1000;
    }

    setCooldown(commandName, userId) {
        const key = `${commandName}:${userId}`;
        this.cooldowns.set(key, Date.now());
        
        // Clean up old cooldowns periodically
        setTimeout(() => {
            this.cooldowns.delete(key);
        }, 300000); // 5 minutes
    }

    async loadCustomAliases() {
        // Load from database or file
        try {
            const aliasFile = path.join(__dirname, '../data/aliases.json');
            if (await fs.pathExists(aliasFile)) {
                return await fs.readJson(aliasFile);
            }
        } catch (error) {
            this.logger.warn('Could not load custom aliases');
        }
        return [];
    }

    getCommandList(category = null) {
        if (category) {
            return Array.from(this.commands.values())
                .filter(cmd => cmd.category === category && !cmd.hidden);
        }
        return Array.from(this.commands.values()).filter(cmd => !cmd.hidden);
    }

    async reloadCommand(category, commandName) {
        try {
            const commandPath = path.join(this.commandDir, category, `${commandName}.js`);
            
            // Clear cache
            delete require.cache[require.resolve(commandPath)];
            
            // Reload command
            await this.loadCommand(category, `${commandName}.js`);
            
            this.logger.success(`Reloaded command: /${commandName}`);
            return true;
            
        } catch (error) {
            this.logger.error(`Error reloading command ${commandName}: ${error.message}`);
            return false;
        }
    }
}

module.exports = CommandHandler;