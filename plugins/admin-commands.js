// GHOST-OFFICIAL-V1 Admin Commands
// RAK Realm - Copyright RAK

const fs = require('fs-extra');
const path = require('path');
const { getString } = require('../utils/language-system');

module.exports = {
    name: 'admin',
    version: '1.0.0',
    description: 'Group administration and management commands',
    category: 'moderation',
    cooldown: 3,
    permissions: ['ADMINISTRATOR'],
    
    async execute({ message, args, sock, bot, security }) {
        const subCommand = args[0]?.toLowerCase();
        
        switch (subCommand) {
            case 'kick':
                return await this.kickUser(message, args.slice(1), sock);
            case 'ban':
                return await this.banUser(message, args.slice(1), sock);
            case 'promote':
                return await this.promoteUser(message, args.slice(1), sock);
            case 'demote':
                return await this.demoteUser(message, args.slice(1), sock);
            case 'mute':
                return await this.muteGroup(message, args.slice(1), sock);
            case 'unmute':
                return await this.unmuteGroup(message, sock);
            case 'add':
                return await this.addUser(message, args.slice(1), sock);
            case 'invite':
                return await this.getInvite(message, sock);
            case 'revoke':
                return await this.revokeInvite(message, sock);
            case 'settings':
                return await this.groupSettings(message, args.slice(1), sock);
            default:
                return await this.showHelp(message, sock);
        }
    },

    async kickUser(message, args, sock) {
        try {
            // Security check
            const securityCheck = await security.checkAdminAction('kick', message);
            if (!securityCheck.allowed) {
                return await this.sendSecurityWarning(message, securityCheck, sock);
            }

            const targetUser = await this.resolveUser(message, args);
            if (!targetUser) {
                return await this.sendUsage(message, 'kick @user', sock);
            }

            // Check if target is admin
            if (await this.isUserAdmin(message.key.remoteJid, targetUser, sock)) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('ERRORS.CANNOT_KICK_ADMIN')
                });
            }

            await sock.groupParticipantsUpdate(message.key.remoteJid, [targetUser], 'remove');
            
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ADMIN.USER_KICKED', { user: targetUser.split('@')[0] }),
                mentions: [targetUser]
            });

        } catch (error) {
            await this.handleError(message, error, 'kick', sock);
        }
    },

    async banUser(message, args, sock) {
        try {
            // Similar implementation to kick but with ban logic
            // Would include duration-based bans and ban list management
        } catch (error) {
            await this.handleError(message, error, 'ban', sock);
        }
    },

    async promoteUser(message, args, sock) {
        try {
            const securityCheck = await security.checkAdminAction('promote', message);
            if (!securityCheck.allowed) {
                return await this.sendSecurityWarning(message, securityCheck, sock);
            }

            const targetUser = await this.resolveUser(message, args);
            if (!targetUser) {
                return await this.sendUsage(message, 'promote @user', sock);
            }

            if (await this.isUserAdmin(message.key.remoteJid, targetUser, sock)) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('ADMIN.ALREADY_ADMIN')
                });
            }

            await sock.groupParticipantsUpdate(message.key.remoteJid, [targetUser], 'promote');
            
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ADMIN.USER_PROMOTED', { user: targetUser.split('@')[0] }),
                mentions: [targetUser]
            });

        } catch (error) {
            await this.handleError(message, error, 'promote', sock);
        }
    },

    async demoteUser(message, args, sock) {
        try {
            // Similar implementation to promote but for demotion
        } catch (error) {
            await this.handleError(message, error, 'demote', sock);
        }
    },

    async muteGroup(message, args, sock) {
        try {
            const securityCheck = await security.checkAdminAction('mute', message);
            if (!securityCheck.allowed) {
                return await this.sendSecurityWarning(message, securityCheck, sock);
            }

            const duration = args[0] ? parseInt(args[0]) : null;
            await sock.groupSettingUpdate(message.key.remoteJid, 'announcement');

            let responseText;
            if (duration) {
                responseText = getString('ADMIN.GROUP_MUTED_DURATION', { duration });
                // Set timer to unmute
                setTimeout(() => {
                    sock.groupSettingUpdate(message.key.remoteJid, 'not_announcement');
                }, duration * 60000);
            } else {
                responseText = getString('ADMIN.GROUP_MUTED');
            }

            await sock.sendMessage(message.key.remoteJid, { text: responseText });

        } catch (error) {
            await this.handleError(message, error, 'mute', sock);
        }
    },

    async unmuteGroup(message, sock) {
        try {
            const securityCheck = await security.checkAdminAction('unmute', message);
            if (!securityCheck.allowed) {
                return await this.sendSecurityWarning(message, securityCheck, sock);
            }

            await sock.groupSettingUpdate(message.key.remoteJid, 'not_announcement');
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ADMIN.GROUP_UNMUTED')
            });

        } catch (error) {
            await this.handleError(message, error, 'unmute', sock);
        }
    },

    async addUser(message, args, sock) {
        try {
            // Implementation for adding users to group
        } catch (error) {
            await this.handleError(message, error, 'add', sock);
        }
    },

    async getInvite(message, sock) {
        try {
            const securityCheck = await security.checkAdminAction('invite', message);
            if (!securityCheck.allowed) {
                return await this.sendSecurityWarning(message, securityCheck, sock);
            }

            const inviteCode = await sock.groupInviteCode(message.key.remoteJid);
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ADMIN.INVITE_LINK', { link: inviteLink })
            });

        } catch (error) {
            await this.handleError(message, error, 'invite', sock);
        }
    },

    async revokeInvite(message, sock) {
        try {
            const securityCheck = await security.checkAdminAction('revoke', message);
            if (!securityCheck.allowed) {
                return await this.sendSecurityWarning(message, securityCheck, sock);
            }

            await sock.groupRevokeInvite(message.key.remoteJid);
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ADMIN.INVITE_REVOKED')
            });

        } catch (error) {
            await this.handleError(message, error, 'revoke', sock);
        }
    },

    async groupSettings(message, args, sock) {
        try {
            // Implementation for group settings management
        } catch (error) {
            await this.handleError(message, error, 'settings', sock);
        }
    },

    async resolveUser(message, args) {
        // Extract user from message mentions, reply, or arguments
        if (message.message.extendedTextMessage?.contextInfo?.mentionedJid) {
            return message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        
        if (args[0] && args[0].includes('@')) {
            return args[0];
        }

        return null;
    },

    async isUserAdmin(groupJid, userJid, sock) {
        try {
            const metadata = await sock.groupMetadata(groupJid);
            return metadata.participants.find(p => p.id === userJid)?.admin !== undefined;
        } catch (error) {
            return false;
        }
    },

    async sendUsage(message, usage, sock) {
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('ERRORS.INVALID_SYNTAX', { usage: `${this.bot.config.PREFIX}admin ${usage}` })
        });
    },

    async sendSecurityWarning(message, securityCheck, sock) {
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('SECURITY.ACTION_BLOCKED', { reason: securityCheck.reason })
        });
    },

    async handleError(message, error, action, sock) {
        this.bot.logger.error(`Admin action failed: ${action} - ${error.message}`);
        
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('ERRORS.ACTION_FAILED', { action })
        });
    },

    async showHelp(message, sock) {
        const helpText = `
👑 *Admin Commands* 👑

*/admin kick @user* - Remove user from group
*/admin ban @user* - Ban user from group  
*/admin promote @user* - Make user admin
*/admin demote @user* - Remove admin status
*/admin mute [minutes]* - Mute group
*/admin unmute* - Unmute group
*/admin add number* - Add user to group
*/admin invite* - Get group invite link
*/admin revoke* - Revoke current invite
*/admin settings* - Manage group settings

🔒 *Requires admin privileges*`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};