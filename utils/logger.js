// GHOST-OFFICIAL-V1 Logger System
// RAK Realm - Copyright RAK

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;
const config = require('../config');

class Logger {
    constructor(logLevel = 'info') {
        this.logLevel = logLevel;
        this.logDir = path.join(__dirname, '../logs');
        this.setupLogDirectory();
        this.winstonLogger = this.createWinstonLogger();
        
        console.log(chalk.blue.bold('📝 Logger initialized'));
    }

    setupLogDirectory() {
        try {
            fs.ensureDirSync(this.logDir);
            
            // Create log files if they don't exist
            const logFiles = ['error.log', 'combined.log', 'debug.log'];
            logFiles.forEach(file => {
                const filePath = path.join(this.logDir, file);
                if (!fs.existsSync(filePath)) {
                    fs.writeFileSync(filePath, '');
                }
            });
        } catch (error) {
            console.error('Failed to setup log directory:', error.message);
        }
    }

    createWinstonLogger() {
        const logFormat = printf(({ level, message, timestamp }) => {
            return `${timestamp} [${level}]: ${message}`;
        });

        const logger = createLogger({
            level: this.logLevel,
            format: combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                logFormat
            ),
            transports: [
                // Write all logs with level 'error' and below to error.log
                new transports.File({ 
                    filename: path.join(this.logDir, 'error.log'),
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                // Write all logs with level 'info' and below to combined.log
                new transports.File({ 
                    filename: path.join(this.logDir, 'combined.log'),
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                // Additional debug log if debug level is enabled
                ...(this.logLevel === 'debug' ? [
                    new transports.File({
                        filename: path.join(this.logDir, 'debug.log'),
                        level: 'debug',
                        maxsize: 5242880,
                        maxFiles: 3
                    })
                ] : [])
            ]
        });

        // Add console transport for development
        if (process.env.NODE_ENV !== 'production') {
            logger.add(new transports.Console({
                format: combine(
                    timestamp({ format: 'HH:mm:ss' }),
                    logFormat
                )
            }));
        }

        return logger;
    }

    // Custom log methods with colors
    error(message) {
        this.winstonLogger.error(message);
        console.log(chalk.red.bold(`❌ ${new Date().toLocaleTimeString()} [ERROR]: ${message}`));
    }

    warn(message) {
        this.winstonLogger.warn(message);
        console.log(chalk.yellow.bold(`⚠️ ${new Date().toLocaleTimeString()} [WARN]: ${message}`));
    }

    info(message) {
        this.winstonLogger.info(message);
        console.log(chalk.blue.bold(`ℹ️ ${new Date().toLocaleTimeString()} [INFO]: ${message}`));
    }

    debug(message) {
        this.winstonLogger.debug(message);
        console.log(chalk.gray(`🐛 ${new Date().toLocaleTimeString()} [DEBUG]: ${message}`));
    }

    success(message) {
        this.winstonLogger.info(message);
        console.log(chalk.green.bold(`✅ ${new Date().toLocaleTimeString()} [SUCCESS]: ${message}`));
    }

    system(message) {
        this.winstonLogger.info(message);
        console.log(chalk.magenta.bold(`⚙️ ${new Date().toLocaleTimeString()} [SYSTEM]: ${message}`));
    }

    // Method to get log file contents
    async getLogs(level = 'combined', lines = 100) {
        try {
            const logFile = level === 'error' ? 'error.log' : 
                           level === 'debug' ? 'debug.log' : 'combined.log';
            
            const filePath = path.join(this.logDir, logFile);
            if (!await fs.pathExists(filePath)) {
                return `Log file not found: ${logFile}`;
            }
            
            const content = await fs.readFile(filePath, 'utf8');
            const logLines = content.split('\n').filter(line => line.trim());
            
            return lines > 0 ? logLines.slice(-lines).join('\n') : content;
        } catch (error) {
            this.error(`Failed to read logs: ${error.message}`);
            return null;
        }
    }

    // Method to clear logs
    async clearLogs(level = 'all') {
        try {
            const filesToClear = level === 'all' ? 
                ['error.log', 'combined.log', 'debug.log'] : 
                [`${level}.log`];
            
            for (const file of filesToClear) {
                const filePath = path.join(this.logDir, file);
                if (await fs.pathExists(filePath)) {
                    await fs.writeFile(filePath, '');
                    this.info(`Cleared log file: ${file}`);
                }
            }
            
            return true;
        } catch (error) {
            this.error(`Failed to clear logs: ${error.message}`);
            return false;
        }
    }

    // Method to get log statistics
    async getLogStats() {
        try {
            const files = ['error.log', 'combined.log', 'debug.log'];
            const stats = {};
            
            for (const file of files) {
                const filePath = path.join(this.logDir, file);
                if (await fs.pathExists(filePath)) {
                    const content = await fs.readFile(filePath, 'utf8');
                    const lines = content.split('\n').filter(line => line.trim());
                    stats[file] = {
                        lineCount: lines.length,
                        size: (await fs.stat(filePath)).size
                    };
                }
            }
            
            return stats;
        } catch (error) {
            this.error(`Failed to get log stats: ${error.message}`);
            return null;
        }
    }

    // Pino-style logger for Baileys compatibility
    get pinoLogger() {
        return {
            level: this.logLevel,
            trace: (msg) => this.debug(msg),
            debug: (msg) => this.debug(msg),
            info: (msg) => this.info(msg),
            warn: (msg) => this.warn(msg),
            error: (msg) => this.error(msg),
            fatal: (msg) => this.error(`FATAL: ${msg}`)
        };
    }
}

// Export encrypted logs utility function
function encryptedLogs(message, level = 'info') {
    // Simple encryption for sensitive logs (basic implementation)
    const crypto = require('crypto');
    const algorithm = 'aes-256-ctr';
    const secretKey = process.env.LOG_SECRET || 'default-log-secret-key';
    
    const cipher = crypto.createCipher(algorithm, secretKey);
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const logger = new Logger();
    logger[level](`ENCRYPTED:${encrypted}`);
    
    return encrypted;
}

module.exports = { Logger, encryptedLogs };