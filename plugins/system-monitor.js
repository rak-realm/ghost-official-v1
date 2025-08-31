// GHOST-OFFICIAL-V1 System Monitor
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const os = require('os');
const process = require('process');
const fs = require('fs-extra');
const path = require('path');

class SystemMonitor {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.startTime = Date.now();
        this.commandStats = new Map();
        this.userStats = new Map();
    }

    async initialize() {
        this.logger.info('Initializing system monitor...');
        this.startTime = Date.now();
    }

    getSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            hostname: os.hostname(),
            uptime: this.formatUptime(os.uptime()),
            memory: {
                total: this.formatBytes(os.totalmem()),
                free: this.formatBytes(os.freemem()),
                used: this.formatBytes(os.totalmem() - os.freemem()),
                usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
            },
            cpu: {
                cores: os.cpus().length,
                model: os.cpus()[0]?.model || 'Unknown',
                speed: os.cpus()[0]?.speed || 0
            },
            load: os.loadavg(),
            bot: {
                uptime: this.formatUptime((Date.now() - this.startTime) / 1000),
                version: this.bot.config.VERSION,
                commands: this.commandStats.size,
                users: this.userStats.size
            }
        };
    }

    getProcessInfo() {
        const memoryUsage = process.memoryUsage();
        return {
            pid: process.pid,
            uptime: this.formatUptime(process.uptime()),
            memory: {
                rss: this.formatBytes(memoryUsage.rss),
                heapTotal: this.formatBytes(memoryUsage.heapTotal),
                heapUsed: this.formatBytes(memoryUsage.heapUsed),
                external: this.formatBytes(memoryUsage.external)
            },
            cpu: {
                user: process.cpuUsage().user,
                system: process.cpuUsage().system
            }
        };
    }

    getBotStats() {
        return {
            commands: Array.from(this.commandStats.entries()).map(([cmd, stats]) => ({
                command: cmd,
                count: stats.count,
                lastUsed: stats.lastUsed
            })),
            users: Array.from(this.userStats.entries()).map(([user, stats]) => ({
                user: user,
                commands: stats.commands,
                lastActive: stats.lastActive
            })),
            groups: this.getGroupStats()
        };
    }

    getGroupStats() {
        // This would track group-specific statistics
        return {
            total: 0,
            active: 0,
            large: 0
        };
    }

    trackCommand(command, user) {
        const now = Date.now();
        
        // Track command usage
        if (!this.commandStats.has(command)) {
            this.commandStats.set(command, { count: 0, lastUsed: now });
        }
        const cmdStats = this.commandStats.get(command);
        cmdStats.count++;
        cmdStats.lastUsed = now;

        // Track user activity
        if (user) {
            if (!this.userStats.has(user)) {
                this.userStats.set(user, { commands: new Set(), lastActive: now });
            }
            const userStats = this.userStats.get(user);
            userStats.commands.add(command);
            userStats.lastActive = now;
        }
    }

    getCommandRankings(limit = 10) {
        const commands = Array.from(this.commandStats.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, limit);

        return commands.map(([cmd, stats], index) => ({
            rank: index + 1,
            command: cmd,
            count: stats.count,
            lastUsed: new Date(stats.lastUsed).toLocaleString()
        }));
    }

    getUserRankings(limit = 10) {
        const users = Array.from(this.userStats.entries())
            .sort((a, b) => b[1].commands.size - a[1].commands.size)
            .slice(0, limit);

        return users.map(([user, stats], index) => ({
            rank: index + 1,
            user: user,
            commands: stats.commands.size,
            lastActive: new Date(stats.lastActive).toLocaleString()
        }));
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m ${secs}s`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async getStorageInfo() {
        try {
            const diskInfo = [];
            const drives = ['/', './', '../']; // Common paths to check

            for (const drive of drives) {
                try {
                    const stats = fs.statSync(drive);
                    if (stats.isDirectory()) {
                        const total = stats.size;
                        const free = fs.statfsSync ? fs.statfsSync(drive).free : total;
                        diskInfo.push({
                            path: drive,
                            total: this.formatBytes(total),
                            free: this.formatBytes(free),
                            used: this.formatBytes(total - free),
                            usage: ((total - free) / total * 100).toFixed(2)
                        });
                    }
                } catch (error) {
                    // Drive not accessible, skip
                }
            }

            return diskInfo;
        } catch (error) {
            this.logger.error(`Storage info failed: ${error.message}`);
            return [];
        }
    }

    async getNetworkInfo() {
        return {
            interfaces: os.networkInterfaces(),
            hostname: os.hostname(),
            uptime: this.formatUptime(os.uptime())
        };
    }

    async generateReport() {
        const systemInfo = this.getSystemInfo();
        const processInfo = this.getProcessInfo();
        const storageInfo = await this.getStorageInfo();
        const commandRankings = this.getCommandRankings(5);
        const userRankings = this.getUserRankings(5);

        let report = `?? *System Report*\n\n`;

        report += `?? *Bot Information:*\n`;
        report += `• Version: ${systemInfo.bot.version}\n`;
        report += `• Uptime: ${systemInfo.bot.uptime}\n`;
        report += `• Commands: ${systemInfo.bot.commands}\n`;
        report += `• Users: ${systemInfo.bot.users}\n\n`;

        report += `?? *System Information:*\n`;
        report += `• Platform: ${systemInfo.platform} ${systemInfo.arch}\n`;
        report += `• Release: ${systemInfo.release}\n`;
        report += `• Hostname: ${systemInfo.hostname}\n`;
        report += `• System Uptime: ${systemInfo.uptime}\n\n`;

        report += `?? *Memory Usage:*\n`;
        report += `• Total: ${systemInfo.memory.total}\n`;
        report += `• Used: ${systemInfo.memory.used} (${systemInfo.memory.usage}%)\n`;
        report += `• Free: ${systemInfo.memory.free}\n\n`;

        report += `? *Process Information:*\n`;
        report += `• PID: ${processInfo.pid}\n`;
        report += `• Uptime: ${processInfo.uptime}\n`;
        report += `• Memory: ${processInfo.memory.heapUsed} / ${processInfo.memory.heapTotal}\n\n`;

        if (storageInfo.length > 0) {
            report += `?? *Storage Information:*\n`;
            storageInfo.forEach(disk => {
                report += `• ${disk.path}: ${disk.used} used (${disk.usage}%)\n`;
            });
            report += `\n`;
        }

        report += `?? *Top Commands:*\n`;
        commandRankings.forEach(cmd => {
            report += `• ${cmd.rank}. /${cmd.command}: ${cmd.count} uses\n`;
        });
        report += `\n`;

        report += `?? *Top Users:*\n`;
        userRankings.forEach(user => {
            report += `• ${user.rank}. ${user.user}: ${user.commands} commands\n`;
        });

        return report;
    }

    async cleanupOldStats(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days
        const now = Date.now();
        let cleaned = 0;

        // Clean old user stats
        for (const [user, stats] of this.userStats.entries()) {
            if (now - stats.lastActive > maxAge) {
                this.userStats.delete(user);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.logger.info(`Cleaned ${cleaned} inactive user stats`);
        }
    }
}

// System Monitor Commands
module.exports = {
    name: 'stats',
    version: '1.0.0',
    description: 'Advanced system monitoring and statistics',
    category: 'system',
    cooldown: 5,

    commands: {
        system: {
            description: 'Show system information',
            usage: '/stats system'
        },
        bot: {
            description: 'Show bot statistics',
            usage: '/stats bot'
        },
        report: {
            description: 'Generate full system report',
            usage: '/stats report'
        },
        top: {
            description: 'Show top commands and users',
            usage: '/stats top [commands|users]'
        }
    },

    async execute({ message, args, sock, bot }) {
        const systemMonitor = new SystemMonitor(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            switch (subCommand) {
                case 'system':
                    return await this.showSystemInfo(message, systemMonitor, sock);
                case 'bot':
                    return await this.showBotStats(message, systemMonitor, sock);
                case 'report':
                    return await this.generateReport(message, systemMonitor, sock);
                case 'top':
                    return await this.showTopRankings(message, args.slice(1), systemMonitor, sock);
                default:
                    return await this.showSystemInfo(message, systemMonitor, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Stats command error: ${error.message}`);
        }
    },

    async showSystemInfo(message, systemMonitor, sock) {
        const systemInfo = systemMonitor.getSystemInfo();
        const processInfo = systemMonitor.getProcessInfo();

        let infoMessage = `??? *System Information*\n\n`;
        
        infoMessage += `?? *Bot:*\n`;
        infoMessage += `• Version: ${systemInfo.bot.version}\n`;
        infoMessage += `• Uptime: ${systemInfo.bot.uptime}\n\n`;

        infoMessage += `?? *Hardware:*\n`;
        infoMessage += `• CPU: ${systemInfo.cpu.cores} cores, ${systemInfo.cpu.model}\n`;
        infoMessage += `• Memory: ${systemInfo.memory.used} / ${systemInfo.memory.total} (${systemInfo.memory.usage}%)\n`;
        infoMessage += `• System Uptime: ${systemInfo.uptime}\n\n`;

        infoMessage += `? *Process:*\n`;
        infoMessage += `• PID: ${processInfo.pid}\n`;
        infoMessage += `• Memory: ${processInfo.memory.heapUsed} / ${processInfo.memory.heapTotal}\n`;
        infoMessage += `• Uptime: ${processInfo.uptime}\n`;

        await sock.sendMessage(message.key.remoteJid, { text: infoMessage });
    },

    async showBotStats(message, systemMonitor, sock) {
        const botStats = systemMonitor.getBotStats();

        let statsMessage = `?? *Bot Statistics*\n\n`;
        
        statsMessage += `?? *Usage:*\n`;
        statsMessage += `• Total Commands: ${botStats.commands.length}\n`;
        statsMessage += `• Active Users: ${botStats.users.length}\n`;
        statsMessage += `• Groups: ${botStats.groups.total}\n\n`;

        statsMessage += `?? *Top Commands:*\n`;
        systemMonitor.getCommandRankings(5).forEach(cmd => {
            statsMessage += `• ${cmd.rank}. /${cmd.command}: ${cmd.count} uses\n`;
        });
        statsMessage += `\n`;

        statsMessage += `?? *Top Users:*\n`;
        systemMonitor.getUserRankings(5).forEach(user => {
            statsMessage += `• ${user.rank}. ${user.user}: ${user.commands} commands\n`;
        });

        await sock.sendMessage(message.key.remoteJid, { text: statsMessage });
    },

    async generateReport(message, systemMonitor, sock) {
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('STATS.GENERATING_REPORT')
        });

        try {
            const report = await systemMonitor.generateReport();
            
            // Split long reports
            if (report.length > 4000) {
                const parts = report.match(/[\s\S]{1,4000}/g) || [];
                for (const part of parts) {
                    await sock.sendMessage(message.key.remoteJid, { text: part });
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } else {
                await sock.sendMessage(message.key.remoteJid, { text: report });
            }

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('STATS.REPORT_FAILED', { error: error.message })
            });
        }
    },

    async showTopRankings(message, args, systemMonitor, sock) {
        const type = args[0]?.toLowerCase() || 'commands';
        let rankingsMessage = '';

        if (type === 'commands') {
            const rankings = systemMonitor.getCommandRankings(10);
            rankingsMessage = `?? *Top Commands*\n\n`;
            rankings.forEach(cmd => {
                rankingsMessage += `• ${cmd.rank}. /${cmd.command}: ${cmd.count} uses\n`;
            });
        } else if (type === 'users') {
            const rankings = systemMonitor.getUserRankings(10);
            rankingsMessage = `?? *Top Users*\n\n`;
            rankings.forEach(user => {
                rankingsMessage += `• ${user.rank}. ${user.user}: ${user.commands} commands\n`;
            });
        } else {
            rankingsMessage = getString('STATS.INVALID_RANKING_TYPE');
        }

        await sock.sendMessage(message.key.remoteJid, { text: rankingsMessage });
    },

    async showHelp(message, sock) {
        const helpText = `
?? *System Statistics Commands*

*/stats system* - Show system information
*/stats bot* - Show bot usage statistics
*/stats report* - Generate full system report
*/stats top commands* - Show top commands
*/stats top users* - Show top users

?? *Note:* Statistics are reset when the bot restarts`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};