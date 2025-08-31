// GHOST-OFFICIAL-V1 Main Core
// RAK Realm - Copyright RAK - Exclusive Ownership

const { Boom } = require('@hapi/boom');
const { DEFAULT_CONNECTION_CONFIG, makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Sequelize } = require('sequelize');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

// Import Config
const config = require('./config');

// Import Core Modules
const { SecuritySystem } = require('./core/security');
const { ThemeManager } = require('./core/theme');
const { CommandHandler } = require('./core/handler');
const { Database } = require('./core/database');
const { Logger, encryptedLogs } = require('./utils/logger');

class GHOSTOFFICIALV1 {
    constructor() {
        this.botName = config.BOT_NAME;
        this.owner = config.OWNER_NAME;
        this.realm = config.REALM;
        this.version = config.VERSION;
        this.isConnected = false;
        
        // Initialize Core Systems
        this.logger = new Logger(config.LOG_LEVEL);
        this.security = new SecuritySystem(this);
        this.themeManager = new ThemeManager(this);
        this.commandHandler = new CommandHandler(this);
        this.database = new Database(this);
        
        this.logger.system(`Initializing ${this.botName} for ${this.owner}`);
    }

    async initialize() {
        try {
            this.logger.info('Starting RAK Realm initialization...');
            
            // Step 1: Initialize Database
            await this.database.connect();
            this.logger.success('Database initialized successfully');
            
            // Step 2: Load Themes
            await this.themeManager.loadThemes();
            this.logger.success('Themes loaded successfully');
            
            // Step 3: Initialize Security System
            await this.security.initialize();
            this.logger.success('Security system initialized');
            
            // Step 4: Establish WhatsApp Connection
            await this.connectToWhatsApp();
            
            // Step 5: Load Commands and Plugins
            await this.commandHandler.loadCommands();
            this.logger.success('Commands loaded successfully');
            
            // Step 6: Start Background Services
            await this.startBackgroundServices();
            
            this.isConnected = true;
            this.logger.success(`${this.botName} is now operational and ready`);
            
            // Send welcome message to owner
            await this.sendStartupNotification();
            
        } catch (error) {
            this.logger.error(`Initialization failed: ${error.message}`);
            this.logger.error(error.stack);
            process.exit(1);
        }
    }

    async connectToWhatsApp() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState('session');
            
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: true,
                logger: this.logger.pinoLogger,
                browser: ['GHOST-OFFICIAL-V1', 'Chrome', '1.0.0']
            });
            
            this.sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    this.logger.info('Scan the QR code above to login');
                }
                
                if (connection === 'close') {
                    const shouldReconnect = new Boom(lastDisconnect?.error).output.statusCode !== 401;
                    this.logger.warn(`Connection closed. Reconnecting: ${shouldReconnect}`);
                    if (shouldReconnect) {
                        this.connectToWhatsApp();
                    }
                } else if (connection === 'open') {
                    this.logger.success('Successfully connected to WhatsApp');
                    this.isConnected = true;
                }
            });
            
            this.sock.ev.on('creds.update', saveCreds);
            this.sock.ev.on('messages.upsert', this.handleMessages.bind(this));
            
        } catch (error) {
            this.logger.error(`WhatsApp connection failed: ${error.message}`);
            throw error;
        }
    }

    async handleMessages({ messages }) {
        try {
            if (!messages || !Array.isArray(messages)) return;
            
            const message = messages[0];
            if (!message.message) return;
            
            // Security Check: Anti-Ban Protection
            const securityCheck = await this.security.scanMessage(message);
            if (!securityCheck.safe) {
                this.logger.warn(`Blocked potentially risky message: ${securityCheck.reason}`);
                return;
            }
            
            // Process Message through Command Handler
            await this.commandHandler.processMessage(message, this.sock);
            
        } catch (error) {
            this.logger.error(`Error handling message: ${error.message}`);
        }
    }

    async startBackgroundServices() {
        // Auto-update service
        if (config.AUTO_UPDATE) {
            setInterval(() => this.checkForUpdates(), 3600000); // Check every hour
        }
        
        // Self-healing monitor
        setInterval(() => this.healthCheck(), 300000); // Check every 5 minutes
        
        this.logger.info('Background services started');
    }

    async checkForUpdates() {
        // Implementation for auto-update from GitHub
        this.logger.debug('Checking for updates...');
    }

    async healthCheck() {
        if (!this.isConnected) {
            this.logger.warn('Bot disconnected. Attempting to reconnect...');
            await this.connectToWhatsApp();
        }
    }

    async sendStartupNotification() {
        // Send notification to owner that bot is online
        const startupMessage = 
            `♰ ${this.botName} Activated ♰\n` +
            `✅ Version: ${this.version}\n` +
            `✅ Owner: ${this.owner}\n` +
            `✅ Realm: ${this.realm}\n` +
            `✅ Uptime: ${new Date().toLocaleString()}\n` +
            `✅ Status: Operational\n\n` +
            `✦ Powered by RAK Realm ✦`;
        
        // Implementation to send message to owner's number
        this.logger.system(startupMessage);
    }

    // Graceful shutdown
    async shutdown() {
        this.logger.info('Shutting down GHOST-OFFICIAL-V1...');
        await this.database.disconnect();
        process.exit(0);
    }
}

// Handle process events
process.on('SIGINT', () => new GHOSTOFFICIALV1().shutdown());
process.on('SIGTERM', () => new GHOSTOFFICIALV1().shutdown());
process.on('uncaughtException', (error) => {
    new Logger('error').error(`Uncaught Exception: ${error.message}`);
    process.exit(1);
});

// Start the bot
const bot = new GHOSTOFFICIALV1();
bot.initialize().catch(console.error);

module.exports = GHOSTOFFICIALV1;