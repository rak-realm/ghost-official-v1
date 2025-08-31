// GHOST-OFFICIAL-V1 Group Manager
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');

class GroupManager {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.groupStats = new Map();
        this.userActivity = new Map();
    }

    async initialize() {
        this.logger.info('Initializing group manager...');
    }

    async tagAllParticipants(jid, options = {}) {
        try {
            const metadata = await this.bot.sock.groupMetadata(jid);
            const participants = metadata.participants;
            
            let message = '';
            let mentionedJid = [];

            if (options.filter === 'admins') {
                const admins = participants.filter(p => p.admin);
                mentionedJid = admins.map(p => p.id);
                message = admins.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`).join('\n');
            } else if (options.filter === 'non-admins') {
                const nonAdmins = participants.filter(p => !p.admin);
                mentionedJid = nonAdmins.map(p => p.id);
                message = nonAdmins.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`).join('\n');
            } else {
                mentionedJid = participants.map(p => p.id);
                message = participants.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`).join('\n');
            }

            return {
                success: true,
                message: message,
                mentionedJid: mentionedJid,
                count: mentionedJid.length
            };
        } catch (error) {
            throw new Error(`Tag all failed: ${error.message}`);
        }
    }

    async getMessageStatistics(jid, period = 'all') {
        try {
            // This would track message statistics per user
            // Implementation would require message tracking
            throw new Error('Message statistics not implemented');
        } catch (error) {
            throw new Error(`Statistics failed: ${error.message}`);
        }
    }

    async findInactiveMembers(jid, options = {}) {
        try {
            const { daysInactive = 7, minMessages = 0 } = options;
            const metadata = await this.bot.sock.groupMetadata(jid);
            const inactiveMembers = [];

            // This would check member activity based on tracked data
            // For now, return empty array
            return inactiveMembers;
        } catch (error) {
            throw new Error(`Inactive members search failed: ${error.message}`);
        }
    }

    async manageInactiveMembers(jid, options = {}) {
        try {
            const inactiveMembers = await this.findInactiveMembers(jid, options);
            
            if (options.action === 'kick' && inactiveMembers.length > 0) {
                await this.kickMembers(jid, inactiveMembers);
                return {
                    success: true,
                    action: 'kick',
                    count: inactiveMembers.length
                };
            }

            return {
                success: true,
                action: 'list',
                members: inactiveMembers,
                count: inactiveMembers.length
            };
        } catch (error) {
            throw new Error(`Inactive management failed: ${error.message}`);
        }
    }

    async kickMembers(jid, members) {
        try {
            for (const member of members) {
                await this.bot.sock.groupParticipantsUpdate(jid, [member], 'remove');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
            }
            return { success: true, count: members.length };
        } catch (error) {
            throw new Error(`Kick members failed: ${error.message}`);
        }
    }

    async createPoll(jid, question, options) {
        try {
            const pollMessage = {
                name: question,
                values: options,
                selectableCount: 1
            };

            await this.bot.sock.sendMessage(jid, {
                poll: pollMessage
            });

            return { success: true, question, options: options.length };
        } catch (error) {
            throw new Error(`Poll creation failed: ${error.message}`);
        }
    }

    async getGroupInfo(jid) {
        try {
            const metadata = await this.bot.sock.groupMetadata(jid);
            return {
                id: metadata.id,
                subject: metadata.subject,
                creation: metadata.creation,
                owner: metadata.owner,
                participants: metadata.participants.length,
                admins: metadata.participants.filter(p => p.admin).length,
                description: metadata.desc
            };
        } catch (error) {
            throw new Error(`Group info failed: ${error.message}`);
        }
    }

    async updateGroupSettings(jid, settings) {
        try {
            if (settings.subject) {
                await this.bot.sock.groupUpdateSubject(jid, settings.subject);
            }
            if (settings.description) {
                await this.bot.sock.groupUpdateDescription(jid, settings.description);
            }
            if (settings.lock !== undefined) {
                await this.bot.sock.groupSettingUpdate(jid, settings.lock ? 'announcement' : 'not_announcement');
            }
            return { success: true, updated: Object.keys(settings) };
        } catch (error) {
            throw new Error(`Group settings update failed: ${error.message}`);
        }
    }

    async exportGroupData(jid) {
        try {
            const metadata = await this.bot.sock.groupMetadata(jid);
            const participants = metadata.participants.map(p => ({
                id: p.id,
                name: p.name || 'Unknown',
                isAdmin: !!p.admin,
                isSuperAdmin: p.admin === 'superadmin'
            }));

            return {
                group: {
                    id: metadata.id,
                    subject: metadata.subject,
                    creation: metadata.creation,
                    owner: metadata.owner,
                    description: metadata.desc
                },
                participants: participants,
                total: participants.length,
                admins: participants.filter(p => p.isAdmin).length
            };
        } catch (error) {
            throw new Error(`Group export failed: ${error.message}`);
        }
    }

    async trackUserActivity(jid, user, action) {
        if (!this.userActivity.has(jid)) {
            this.userActivity.set(jid, new Map());
        }

        const groupActivity = this.userActivity.get(jid);
        if (!groupActivity.has(user)) {
            groupActivity.set(user, {
                messages: 0,
                commands: 0,
                lastActive: Date.now(),
                joins: 0,
                leaves: 0
            });
        }

        const userStats = groupActivity.get(user);
        userStats.lastActive = Date.now();

        switch (action) {
            case 'message':
                userStats.messages++;
                break;
            case 'command':
                userStats.commands++;
                break;
            case 'join':
                userStats.joins++;
                break;
            case 'leave':
                userStats.leaves++;
                break;
        }
    }

    async getUserActivity(jid, user) {
        if (this.userActivity.has(jid)) {
            return this.userActivity.get(jid).get(user) || null;
        }
        return null;
    }
}

// Group Management Commands
module.exports = {
    name: 'group',
    version: '1.0.0',
    description: 'Advanced group management and administration',
    category: 'moderation',
    cooldown: 10,
    permissions: ['ADMINISTRATOR'],

    commands: {
        tagall: {
            description: 'Tag all group members',
            usage: '/group tagall [filter]'
        },
        inactive: {
            description: 'Manage inactive members',
            usage: '/group inactive [days] [action]'
        },
        info: {
            description: 'Get group information',
            usage: '/group info'
        },
        poll: {
            description: 'Create a poll',
            usage: '/group poll "question" "option1,option2,option3"'
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
                case 'tagall':
                    return await this.tagAllMembers(message, args.slice(1), groupManager, sock);
                case 'inactive':
                    return await this.manageInactive(message, args.slice(1), groupManager, sock);
                case 'info':
                    return await this.getGroupInfo(message, groupManager, sock);
                case 'poll':
                    return await this.createPoll(message, args.slice(1), groupManager, sock);
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

    async tagAllMembers(message, args, groupManager, sock) {
        const filter = args[0]?.toLowerCase();
        const validFilters = ['all', 'admins', 'non-admins', 'nonadmins'];

        if (filter && !validFilters.includes(filter)) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('GROUP.INVALID_FILTER', { filters: validFilters.join(', ') })
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('GROUP.TAGGING_MEMBERS')
        });

        try {
            const result = await groupManager.tagAllParticipants(message.key.remoteJid, {
                filter: filter || 'all'
            });

            await sock.sendMessage(message.key.remoteJid, {
                text: result.message,
                mentions: result.mentionedJid
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('GROUP.TAGALL_FAILED', { error: error.message })
            });
        }
    },

    async manageInactive(message, args, groupManager, sock) {
        const days = parseInt(args[0]) || 7;
        const action = args[1]?.toLowerCase();

        if (days < 1 || days > 365) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('GROUP.INVALID_DAYS')
            });
        }

        if (action && action !== 'kick' && action !== 'list') {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('GROUP.INVALID_ACTION')
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('GROUP.CHECKING_INACTIVE')
        });

        try {
            const result = await groupManager.manageInactiveMembers(message.key.remoteJid, {
                daysInactive: days,
                action: action || 'list'
            });

            if (result.action === 'kick') {
                await sock.sendMessage(message.key.remoteJid, {
                    text: getString('GROUP.KICKED_INACTIVE', { count: result.count })
                });
            } else {
                if (result.count === 0) {
                    await sock.sendMessage(message.key.remoteJid, {
                        text: getString('GROUP.NO_INACTIVE')
                    });
                } else {
                    let messageText = getString('GROUP.INACTIVE_MEMBERS', {
                        count: result.count,
                        days: days
                    });
                    
                    result.members.forEach((member, index) => {
                        messageText += `\n${index + 1}. @${member.split('@')[0]}`;
                    });

                    await sock.sendMessage(message.key.remoteJid, {
                        text: messageText,
                        mentions: result.members
                    });
                }
            }

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('GROUP.INACTIVE_FAILED', { error: error.message })
            });
        }
    },

    async getGroupInfo(message, groupManager, sock) {
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('GROUP.FETCHING_INFO')
        });

        try {
            const info = await groupManager.getGroupInfo(message.key.remoteJid);
            
            let infoMessage = `?? *Group Information*\n\n`;
            infoMessage += `?? *Name:* ${info.subject}\n`;
            infoMessage += `?? *ID:* ${info.id}\n`;
            infoMessage += `?? *Created:* ${new Date(info.creation * 1000).toLocaleDateString()}\n`;
            infoMessage += `?? *Owner:* ${info.owner?.split('@')[0] || 'Unknown'}\n`;
            infoMessage += `?? *Members:* ${info.participants}\n`;
            infoMessage += `? *Admins:* ${info.admins}\n`;
            if (info.description) {
                infoMessage += `?? *Description:* ${info.description}\n`;
            }

            await sock.sendMessage(message.key.remoteJid, { text: infoMessage });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('GROUP.INFO_FAILED', { error: error.message })
            });
        }
    },

    async createPoll(message, args, groupManager, sock) {
        if (args.length < 2) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('GROUP.POLL_USAGE')
            });
        }

        const question = args[0].replace(/["']/g, '');
        const options = args[1].split(',').map(opt => opt.trim()).filter(opt => opt);

        if (options.length < 2 || options.length > 10) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('GROUP.INVALID_OPTIONS')
            });
        }

        try {
            const result = await groupManager.createPoll(message.key.remoteJid, question, options);
            
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('GROUP.POLL_CREATED', {
                    question: question,
                    options: result.options
                })
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('GROUP.POLL_FAILED', { error: error.message })
            });
        }
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Group Management Commands*

*/group tagall* - Tag all members
*/group tagall admins* - Tag only admins
*/group tagall non-admins* - Tag non-admins
*/group inactive <days>* - Show inactive members
*/group inactive <days> kick* - Kick inactive members
*/group info* - Get group information
*/group poll "question" "opt1,opt2,opt3"* - Create poll

?? *Admin commands only*
?? *Use responsibly in groups*`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};