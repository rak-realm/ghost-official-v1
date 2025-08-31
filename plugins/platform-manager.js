// GHOST-OFFICIAL-V1 Platform Manager
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const axios = require('axios');

class PlatformManager {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.platforms = new Map();
    }

    async initialize() {
        this.logger.info('Initializing platform management system...');
        
        // Initialize supported platforms
        await this.initHeroku();
        // Add other platforms here as needed
    }

    async initHeroku() {
        if (!this.bot.config.HEROKU.ENABLED) {
            this.logger.info('Heroku integration disabled');
            return;
        }

        try {
            this.heroku = {
                apiKey: this.bot.config.HEROKU.API_KEY,
                appName: this.bot.config.HEROKU.APP_NAME,
                baseURL: `https://api.heroku.com/apps/${this.bot.config.HEROKU.APP_NAME}`
            };

            // Test Heroku connection
            await this.testHerokuConnection();
            this.logger.success('Heroku integration initialized successfully');

        } catch (error) {
            this.logger.error(`Heroku initialization failed: ${error.message}`);
        }
    }

    async testHerokuConnection() {
        try {
            const response = await axios.get(`${this.heroku.baseURL}`, {
                headers: {
                    'Accept': 'application/vnd.heroku+json; version=3',
                    'Authorization': `Bearer ${this.heroku.apiKey}`
                }
            });

            return response.status === 200;
        } catch (error) {
            throw new Error(`Heroku connection test failed: ${error.message}`);
        }
    }

    async restartDyno() {
        try {
            await axios.delete(`${this.heroku.baseURL}/dynos`, {
                headers: {
                    'Accept': 'application/vnd.heroku+json; version=3',
                    'Authorization': `Bearer ${this.heroku.apiKey}`
                }
            });

            return { success: true, message: getString('PLATFORM.RESTART_SUCCESS') };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async shutdownApp() {
        try {
            const response = await axios.get(`${this.heroku.baseURL}/formation`, {
                headers: {
                    'Accept': 'application/vnd.heroku+json; version=3',
                    'Authorization': `Bearer ${this.heroku.apiKey}`
                }
            });

            const formationId = response.data[0]?.id;
            if (!formationId) {
                throw new Error('Formation ID not found');
            }

            await axios.patch(`${this.heroku.baseURL}/formation/${formationId}`, {
                quantity: 0
            }, {
                headers: {
                    'Accept': 'application/vnd.heroku+json; version=3',
                    'Authorization': `Bearer ${this.heroku.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            return { success: true, message: getString('PLATFORM.SHUTDOWN_SUCCESS') };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getDynoUsage() {
        try {
            // Get account quota information
            const accountResponse = await axios.get('https://api.heroku.com/account', {
                headers: {
                    'Accept': 'application/vnd.heroku+json; version=3',
                    'Authorization': `Bearer ${this.heroku.apiKey}`
                }
            });

            const quotaResponse = await axios.get(
                `https://api.heroku.com/accounts/${accountResponse.data.id}/actions/get-quota`,
                {
                    headers: {
                        'User-Agent': 'GHOST-OFFICIAL-V1',
                        'Authorization': `Bearer ${this.heroku.apiKey}`,
                        'Accept': 'application/vnd.heroku+json; version=3.account-quotas'
                    }
                }
            );

            const quotaData = quotaResponse.data;
            return this.formatDynoInfo(quotaData);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    formatDynoInfo(quotaData) {
        const totalQuota = Math.floor(quotaData.account_quota);
        const usedQuota = Math.floor(quotaData.quota_used);
        const remainingQuota = totalQuota - usedQuota;
        const percentage = Math.round((usedQuota / totalQuota) * 100);

        return {
            success: true,
            data: {
                total: this.formatTime(totalQuota),
                used: this.formatTime(usedQuota),
                remaining: this.formatTime(remainingQuota),
                percentage: percentage
            }
        };
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    async manageEnvironmentVariables(action, key, value = null) {
        try {
            switch (action) {
                case 'get':
                    return await this.getEnvVar(key);
                case 'set':
                    return await this.setEnvVar(key, value);
                case 'delete':
                    return await this.deleteEnvVar(key);
                case 'list':
                    return await this.listEnvVars();
                default:
                    return { success: false, error: 'Invalid action' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getEnvVar(key) {
        const response = await axios.get(`${this.heroku.baseURL}/config-vars`, {
            headers: {
                'Accept': 'application/vnd.heroku+json; version=3',
                'Authorization': `Bearer ${this.heroku.apiKey}`
            }
        });

        const value = response.data[key.toUpperCase()];
        if (!value) {
            throw new Error(`Environment variable ${key} not found`);
        }

        return { success: true, key: key.toUpperCase(), value: value };
    }

    async setEnvVar(key, value) {
        await axios.patch(`${this.heroku.baseURL}/config-vars`, {
            [key.toUpperCase()]: value
        }, {
            headers: {
                'Accept': 'application/vnd.heroku+json; version=3',
                'Authorization': `Bearer ${this.heroku.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        return { success: true, message: getString('PLATFORM.VAR_SET', { key: key.toUpperCase() }) };
    }

    async deleteEnvVar(key) {
        const currentVars = await axios.get(`${this.heroku.baseURL}/config-vars`, {
            headers: {
                'Accept': 'application/vnd.heroku+json; version=3',
                'Authorization': `Bearer ${this.heroku.apiKey}`
            }
        });

        if (!currentVars.data[key.toUpperCase()]) {
            throw new Error(`Environment variable ${key} not found`);
        }

        await axios.patch(`${this.heroku.baseURL}/config-vars`, {
            [key.toUpperCase()]: null
        }, {
            headers: {
                'Accept': 'application/vnd.heroku+json; version=3',
                'Authorization': `Bearer ${this.heroku.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        return { success: true, message: getString('PLATFORM.VAR_DELETED', { key: key.toUpperCase() }) };
    }

    async listEnvVars() {
        const response = await axios.get(`${this.heroku.baseURL}/config-vars`, {
            headers: {
                'Accept': 'application/vnd.heroku+json; version=3',
                'Authorization': `Bearer ${this.heroku.apiKey}`
            }
        });

        return { success: true, variables: response.data };
    }
}

// Platform Management Commands
module.exports = {
    name: 'platform',
    version: '1.0.0',
    description: 'Platform management and deployment control',
    category: 'system',
    cooldown: 10,
    permissions: ['OWNER'],

    commands: {
        restart: {
            description: 'Restart the application',
            usage: '/platform restart'
        },
        shutdown: {
            description: 'Shutdown the application',
            usage: '/platform shutdown'
        },
        status: {
            description: 'Check platform status',
            usage: '/platform status'
        },
        env: {
            description: 'Manage environment variables',
            usage: '/platform env <get|set|delete|list> [key] [value]'
        }
    },

    async execute({ message, args, sock, bot }) {
        const platformManager = new PlatformManager(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            if (!bot.config.HEROKU.ENABLED) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('PLATFORM.DISABLED')
                });
            }

            switch (subCommand) {
                case 'restart':
                    return await this.handleRestart(message, platformManager, sock);
                case 'shutdown':
                    return await this.handleShutdown(message, platformManager, sock);
                case 'status':
                    return await this.handleStatus(message, platformManager, sock);
                case 'env':
                    return await this.handleEnvVars(message, args.slice(1), platformManager, sock);
                default:
                    return await this.showHelp(message, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Platform command error: ${error.message}`);
        }
    },

    async handleRestart(message, platformManager, sock) {
        const result = await platformManager.restartDyno();

        await sock.sendMessage(message.key.remoteJid, {
            text: result.success 
                ? result.message
                : getString('PLATFORM.RESTART_FAILED', { error: result.error })
        });
    },

    async handleShutdown(message, platformManager, sock) {
        const result = await platformManager.shutdownApp();

        await sock.sendMessage(message.key.remoteJid, {
            text: result.success 
                ? result.message
                : getString('PLATFORM.SHUTDOWN_FAILED', { error: result.error })
        });
    },

    async handleStatus(message, platformManager, sock) {
        const result = await platformManager.getDynoUsage();

        if (!result.success) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('PLATFORM.STATUS_FAILED', { error: result.error })
            });
        }

        const statusMessage = getString('PLATFORM.STATUS_INFO', {
            total: result.data.total,
            used: result.data.used,
            remaining: result.data.remaining,
            percentage: result.data.percentage
        });

        await sock.sendMessage(message.key.remoteJid, { text: statusMessage });
    },

    async handleEnvVars(message, args, platformManager, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('PLATFORM.ENV_USAGE')
            });
        }

        const action = args[0].toLowerCase();
        const key = args[1];
        const value = args.slice(2).join(' ');

        let result;
        switch (action) {
            case 'get':
                if (!key) {
                    return await sock.sendMessage(message.key.remoteJid, {
                        text: getString('PLATFORM.ENV_GET_USAGE')
                    });
                }
                result = await platformManager.manageEnvironmentVariables('get', key);
                break;
            case 'set':
                if (!key || !value) {
                    return await sock.sendMessage(message.key.remoteJid, {
                        text: getString('PLATFORM.ENV_SET_USAGE')
                    });
                }
                result = await platformManager.manageEnvironmentVariables('set', key, value);
                break;
            case 'delete':
                if (!key) {
                    return await sock.sendMessage(message.key.remoteJid, {
                        text: getString('PLATFORM.ENV_DELETE_USAGE')
                    });
                }
                result = await platformManager.manageEnvironmentVariables('delete', key);
                break;
            case 'list':
                result = await platformManager.manageEnvironmentVariables('list');
                break;
            default:
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('PLATFORM.ENV_INVALID_ACTION')
                });
        }

        if (!result.success) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('PLATFORM.ENV_ERROR', { error: result.error })
            });
        }

        if (action === 'list') {
            let listMessage = getString('PLATFORM.ENV_LIST_HEADER');
            for (const [key, value] of Object.entries(result.variables)) {
                listMessage += `\n${key}: ${value}`;
            }
            await sock.sendMessage(message.key.remoteJid, { text: listMessage });
        } else if (action === 'get') {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('PLATFORM.ENV_GET_RESULT', {
                    key: result.key,
                    value: result.value
                })
            });
        } else {
            await sock.sendMessage(message.key.remoteJid, { text: result.message });
        }
    },

    async showHelp(message, sock) {
        const helpText = `
??? *Platform Management Commands*

*/platform restart* - Restart the application
*/platform shutdown* - Shutdown the application
*/platform status* - Check resource usage
*/platform env list* - List environment variables
*/platform env get <key>* - Get environment variable
*/platform env set <key> <value>* - Set environment variable
*/platform env delete <key>* - Delete environment variable

?? *Owner only commands*
?? *Requires Heroku deployment*`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};