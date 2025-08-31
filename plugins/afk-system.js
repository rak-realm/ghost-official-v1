// GHOST-OFFICIAL-V1 AFK System
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');

class AFKSystem {
    constructor(bot) {
        this.bot = bot;
        this.afkUsers = new Map(); // userJid -> AFK data
        this.logger = bot.logger;
    }

    async initialize() {
        this.logger.info('Initializing AFK system...');
        // Load persistent AFK states if needed
    }

    async setAFK(userJid, reason = '', duration = 0) {
        const afkData = {
            isAFK: true,
            reason: reason,
            startTime: Date.now(),
            duration: duration, // 0 = indefinite
            notified: new Set() // Users who have been notified
        };

        this.afkUsers.set(userJid, afkData);
        
        this.logger.info(`AFK set for ${userJid}: ${reason}`);
        return afkData;
    }

    async removeAFK(userJid) {
        const afkData = this.afkUsers.get(userJid);
        if (afkData) {
            const duration = Date.now() - afkData.startTime;
            this.afkUsers.delete(userJid);
            
            this.logger.info(`AFK removed for ${userJid}. Duration: ${this.formatDuration(duration)}`);
            return { wasAFK: true, duration };
        }
        return { wasAFK: false };
    }

    async checkAFK(message, sock) {
        if (!message.key?.remoteJid || !message.message) return;

        const userJid = message.key.participant || message.key.remoteJid;
        
        // Check if sender is AFK
        if (this.afkUsers.has(userJid)) {
            await this.handleAFKReturn(userJid, message, sock);
            return;
        }

        // Check if message mentions AFK users
        await this.handleAFKMentions(message, sock);
    }

    async handleAFKReturn(userJid, message, sock) {
        const afkData = this.afkUsers.get(userJid);
        const { wasAFK, duration } = await this.removeAFK(userJid);

        if (wasAFK) {
            const durationText = this.formatDuration(duration);
            const returnMessage = getString('AFK.RETURN_MESSAGE', {
                duration: durationText,
                reason: afkData.reason || getString('AFK.NO_REASON')
            });

            await sock.sendMessage(message.key.remoteJid, {
                text: returnMessage,
                quoted: message
            });
        }
    }

    async handleAFKMentions(message, sock) {
        const mentionedJids = this.extractMentions(message);
        if (!mentionedJids.length) return;

        for (const mentionedJid of mentionedJids) {
            const afkData = this.afkUsers.get(mentionedJid);
            if (afkData && !afkData.notified.has(message.key.remoteJid)) {
                await this.notifyAFK(mentionedJid, afkData, message, sock);
                afkData.notified.add(message.key.remoteJid);
            }
        }
    }

    async notifyAFK(afkJid, afkData, originalMessage, sock) {
        const duration = Date.now() - afkData.startTime;
        const durationText = this.formatDuration(duration);

        const afkMessage = getString('AFK.AFK_MESSAGE', {
            user: afkJid.split('@')[0],
            reason: afkData.reason || getString('AFK.NO_REASON'),
            duration: durationText,
            durationShort: this.formatDurationShort(duration)
        });

        await sock.sendMessage(originalMessage.key.remoteJid, {
            text: afkMessage,
            quoted: originalMessage,
            mentions: [afkJid]
        });
    }

    extractMentions(message) {
        const mentions = [];
        
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
            mentions.push(...message.message.extendedTextMessage.contextInfo.mentionedJid);
        }
        
        // Also check for reply mentions
        if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            mentions.push(message.message.extendedTextMessage.contextInfo.participant);
        }

        return mentions.filter(jid => this.afkUsers.has(jid));
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return getString('AFK.DURATION_DAYS', { days, hours: hours % 24 });
        } else if (hours > 0) {
            return getString('AFK.DURATION_HOURS', { hours, minutes: minutes % 60 });
        } else if (minutes > 0) {
            return getString('AFK.DURATION_MINUTES', { minutes, seconds: seconds % 60 });
        } else {
            return getString('AFK.DURATION_SECONDS', { seconds });
        }
    }

    formatDurationShort(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d`;
        if (hours > 0) return `${hours}h`;
        if (minutes > 0) return `${minutes}m`;
        return `${seconds}s`;
    }

    getAFKStatus(userJid) {
        return this.afkUsers.get(userJid);
    }

    getAllAFKUsers() {
        return Array.from(this.afkUsers.entries()).map(([jid, data]) => ({
            jid,
            reason: data.reason,
            duration: Date.now() - data.startTime,
            startTime: data.startTime
        }));
    }

    async cleanupExpiredAFK() {
        const now = Date.now();
        for (const [jid, data] of this.afkUsers.entries()) {
            if (data.duration > 0 && (now - data.startTime) > data.duration * 60000) {
                this.afkUsers.delete(jid);
                this.logger.info(`Expired AFK auto-removed for ${jid}`);
            }
        }
    }
}

// AFK Command Implementation
module.exports = {
    name: 'afk',
    version: '1.0.0',
    description: 'Away From Keyboard system with automatic replies',
    category: 'utility',
    cooldown: 5,

    async execute({ message, args, sock, bot }) {
        const afkSystem = bot.afkSystem || new AFKSystem(bot);
        
        if (args.length === 0) {
            // Check AFK status
            const afkStatus = afkSystem.getAFKStatus(message.key.participant);
            if (afkStatus) {
                const duration = Date.now() - afkStatus.startTime;
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('AFK.CURRENT_STATUS', {
                        reason: afkStatus.reason || getString('AFK.NO_REASON'),
                        duration: afkSystem.formatDuration(duration)
                    })
                });
            } else {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('AFK.NOT_AFK')
                });
            }
        }

        if (args[0] === 'off') {
            const result = await afkSystem.removeAFK(message.key.participant);
            if (result.wasAFK) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('AFK.RETURN_CONFIRMATION', {
                        duration: afkSystem.formatDuration(result.duration)
                    })
                });
            } else {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('AFK.NOT_AFK')
                });
            }
        }

        if (args[0] === 'list') {
            const afkUsers = afkSystem.getAllAFKUsers();
            if (afkUsers.length === 0) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('AFK.NO_AFK_USERS')
                });
            }

            let listMessage = getString('AFK.USER_LIST_HEADER');
            afkUsers.forEach((user, index) => {
                listMessage += `\n${index + 1}. @${user.jid.split('@')[0]} - ${user.reason || 'No reason'} (${afkSystem.formatDurationShort(user.duration)})`;
            });

            await sock.sendMessage(message.key.remoteJid, {
                text: listMessage,
                mentions: afkUsers.map(user => user.jid)
            });
            return;
        }

        // Set AFK with reason
        const reason = args.join(' ');
        const durationMatch = reason.match(/(\d+)([mhd])/);
        let duration = 0;

        if (durationMatch) {
            const value = parseInt(durationMatch[1]);
            const unit = durationMatch[2];
            
            switch (unit) {
                case 'm': duration = value; break;
                case 'h': duration = value * 60; break;
                case 'd': duration = value * 60 * 24; break;
            }
        }

        const cleanReason = reason.replace(/(\d+)([mhd])/, '').trim();
        
        await afkSystem.setAFK(message.key.participant, cleanReason, duration);
        
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('AFK.SET_CONFIRMATION', {
                reason: cleanReason || getString('AFK.NO_REASON'),
                duration: duration > 0 ? `for ${duration}m` : 'indefinitely'
            })
        });
    },

    // Handle incoming messages for AFK checks
    async onMessage({ message, sock, bot }) {
        const afkSystem = bot.afkSystem || new AFKSystem(bot);
        await afkSystem.checkAFK(message, sock);
    }
};