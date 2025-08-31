// GHOST-OFFICIAL-V1 Profile Manager
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');

class ProfileManager {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.blockedUsers = new Set();
        this.contactCache = new Map();
    }

    async initialize() {
        this.logger.info('Initializing profile management system...');
        await this.loadBlockedUsers();
    }

    async updateProfilePicture(jid, imageBuffer) {
        try {
            // Validate and process image
            const processedImage = await this.processProfileImage(imageBuffer);
            
            // Update profile picture
            await this.bot.sock.updateProfilePicture(jid, processedImage);
            
            this.logger.info(`Profile picture updated for ${jid}`);
            return { success: true, message: getString('PROFILE.PP_UPDATED') };
        } catch (error) {
            this.logger.error(`Profile picture update failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async processProfileImage(buffer) {
        try {
            // Validate image size
            if (buffer.length > 5 * 1024 * 1024) { // 5MB limit
                throw new Error('Image too large (max 5MB)');
            }

            // Process image for profile (square crop, resize)
            const metadata = await sharp(buffer).metadata();
            const size = Math.min(metadata.width, metadata.height);
            
            return await sharp(buffer)
                .resize(640, 640, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 90 })
                .toBuffer();
        } catch (error) {
            throw new Error(`Image processing failed: ${error.message}`);
        }
    }

    async updateProfileStatus(status) {
        try {
            await this.bot.sock.updateProfileStatus(status);
            this.logger.info('Profile status updated');
            return { success: true, message: getString('PROFILE.STATUS_UPDATED') };
        } catch (error) {
            this.logger.error(`Status update failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async updateProfileName(name) {
        try {
            await this.bot.sock.updateProfileName(name);
            this.logger.info('Profile name updated');
            return { success: true, message: getString('PROFILE.NAME_UPDATED') };
        } catch (error) {
            this.logger.error(`Name update failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async blockUser(jid) {
        try {
            await this.bot.sock.updateBlockStatus(jid, 'block');
            this.blockedUsers.add(jid);
            await this.saveBlockedUsers();
            
            this.logger.info(`User blocked: ${jid}`);
            return { success: true, message: getString('PROFILE.USER_BLOCKED') };
        } catch (error) {
            this.logger.error(`Block user failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async unblockUser(jid) {
        try {
            await this.bot.sock.updateBlockStatus(jid, 'unblock');
            this.blockedUsers.delete(jid);
            await this.saveBlockedUsers();
            
            this.logger.info(`User unblocked: ${jid}`);
            return { success: true, message: getString('PROFILE.USER_UNBLOCKED') };
        } catch (error) {
            this.logger.error(`Unblock user failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async getBlockedUsers() {
        return Array.from(this.blockedUsers);
    }

    async isUserBlocked(jid) {
        return this.blockedUsers.has(jid);
    }

    async loadBlockedUsers() {
        try {
            const blockedFile = path.join(__dirname, '../data/blocked.json');
            if (await fs.pathExists(blockedFile)) {
                const data = await fs.readJson(blockedFile);
                this.blockedUsers = new Set(data);
            }
        } catch (error) {
            this.logger.warn('Could not load blocked users list');
        }
    }

    async saveBlockedUsers() {
        try {
            const blockedFile = path.join(__dirname, '../data/blocked.json');
            await fs.writeJson(blockedFile, Array.from(this.blockedUsers), { spaces: 2 });
        } catch (error) {
            this.logger.error('Could not save blocked users list');
        }
    }

    async getContactInfo(jid) {
        try {
            if (this.contactCache.has(jid)) {
                return this.contactCache.get(jid);
            }

            const contact = await this.bot.sock.getContact(jid);
            this.contactCache.set(jid, contact);
            
            return contact;
        } catch (error) {
            this.logger.error(`Get contact info failed: ${error.message}`);
            return null;
        }
    }

    async getAllContacts() {
        try {
            const contacts = await this.bot.sock.getContacts();
            return contacts.filter(contact => contact.id && !contact.id.includes('status'));
        } catch (error) {
            this.logger.error(`Get contacts failed: ${error.message}`);
            return [];
        }
    }

    async getGroupContacts(jid) {
        try {
            const metadata = await this.bot.sock.groupMetadata(jid);
            return metadata.participants;
        } catch (error) {
            this.logger.error(`Get group contacts failed: ${error.message}`);
            return [];
        }
    }

    async exportContacts(format = 'json') {
        try {
            const contacts = await this.getAllContacts();
            
            switch (format) {
                case 'json':
                    return JSON.stringify(contacts, null, 2);
                case 'csv':
                    return this.convertToCSV(contacts);
                case 'text':
                    return this.convertToText(contacts);
                default:
                    throw new Error('Unsupported export format');
            }
        } catch (error) {
            throw new Error(`Export failed: ${error.message}`);
        }
    }

    convertToCSV(contacts) {
        let csv = 'Name,JID,Is Business\n';
        contacts.forEach(contact => {
            csv += `"${contact.name || ''}","${contact.id}",${contact.isBusiness || false}\n`;
        });
        return csv;
    }

    convertToText(contacts) {
        let text = '';
        contacts.forEach((contact, index) => {
            text += `${index + 1}. ${contact.name || 'Unknown'} - ${contact.id}\n`;
        });
        return text;
    }

    async leaveGroup(jid) {
        try {
            await this.bot.sock.groupLeave(jid);
            this.logger.info(`Left group: ${jid}`);
            return { success: true, message: getString('PROFILE.GROUP_LEFT') };
        } catch (error) {
            this.logger.error(`Leave group failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

// Profile Management Commands
module.exports = {
    name: 'profile',
    version: '1.0.0',
    description: 'Advanced profile and contact management',
    category: 'utility',
    cooldown: 5,

    commands: {
        pp: {
            description: 'Update profile picture',
            usage: '/profile pp (reply to image)'
        },
        status: {
            description: 'Update profile status',
            usage: '/profile status <text>'
        },
        block: {
            description: 'Block a user',
            usage: '/profile block @user'
        },
        unblock: {
            description: 'Unblock a user',
            usage: '/profile unblock @user'
        },
        contacts: {
            description: 'Manage contacts',
            usage: '/profile contacts list'
        }
    },

    async execute({ message, args, sock, bot }) {
        const profileManager = new ProfileManager(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            switch (subCommand) {
                case 'pp':
                    return await this.updateProfilePicture(message, profileManager, sock);
                case 'status':
                    return await this.updateStatus(message, args.slice(1), profileManager, sock);
                case 'block':
                    return await this.blockUser(message, args.slice(1), profileManager, sock);
                case 'unblock':
                    return await this.unblockUser(message, args.slice(1), profileManager, sock);
                case 'contacts':
                    return await this.manageContacts(message, args.slice(1), profileManager, sock);
                case 'leave':
                    return await this.leaveGroup(message, profileManager, sock);
                default:
                    return await this.showHelp(message, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Profile command error: ${error.message}`);
        }
    },

    async updateProfilePicture(message, profileManager, sock) {
        if (!message.reply_message || !message.reply_message.image) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('PROFILE.REPLY_IMAGE')
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('PROFILE.UPDATING_PP')
        });

        try {
            const imageBuffer = await message.reply_message.downloadMediaMessage();
            const result = await profileManager.updateProfilePicture(message.key.participant, imageBuffer);

            await sock.sendMessage(message.key.remoteJid, {
                text: result.success ? result.message : getString('PROFILE.PP_FAILED', { error: result.error })
            });
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('PROFILE.PP_FAILED', { error: error.message })
            });
        }
    },

    async updateStatus(message, args, profileManager, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('PROFILE.STATUS_REQUIRED')
            });
        }

        const status = args.join(' ');
        const result = await profileManager.updateProfileStatus(status);

        await sock.sendMessage(message.key.remoteJid, {
            text: result.success ? result.message : getString('PROFILE.STATUS_FAILED', { error: result.error })
        });
    },

    async blockUser(message, args, profileManager, sock) {
        const jid = await this.resolveUserJid(message, args);
        if (!jid) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('PROFILE.USER_REQUIRED')
            });
        }

        const result = await profileManager.blockUser(jid);
        
        await sock.sendMessage(message.key.remoteJid, {
            text: result.success 
                ? getString('PROFILE.USER_BLOCKED_CONFIRM') 
                : getString('PROFILE.BLOCK_FAILED', { error: result.error })
        });
    },

    async unblockUser(message, args, profileManager, sock) {
        const jid = await this.resolveUserJid(message, args);
        if (!jid) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('PROFILE.USER_REQUIRED')
            });
        }

        const result = await profileManager.unblockUser(jid);
        
        await sock.sendMessage(message.key.remoteJid, {
            text: result.success 
                ? getString('PROFILE.USER_UNBLOCKED_CONFIRM') 
                : getString('PROFILE.UNBLOCK_FAILED', { error: result.error })
        });
    },

    async manageContacts(message, args, profileManager, sock) {
        const action = args[0]?.toLowerCase();

        if (action === 'list') {
            const contacts = await profileManager.getAllContacts();
            let contactList = getString('PROFILE.CONTACTS_HEADER');
            
            contacts.slice(0, 50).forEach((contact, index) => {
                contactList += `\n${index + 1}. ${contact.name || 'Unknown'} - ${contact.id}`;
            });

            if (contacts.length > 50) {
                contactList += `\n\n... and ${contacts.length - 50} more contacts`;
            }

            await sock.sendMessage(message.key.remoteJid, { text: contactList });
        } else {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('PROFILE.CONTACTS_USAGE')
            });
        }
    },

    async leaveGroup(message, profileManager, sock) {
        if (!message.key.remoteJid.endsWith('@g.us')) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('PROGROUP.ONLY_GROUPS')
            });
        }

        const result = await profileManager.leaveGroup(message.key.remoteJid);
        
        await sock.sendMessage(message.key.remoteJid, {
            text: result.success ? result.message : getString('PROFILE.LEAVE_FAILED', { error: result.error })
        });
    },

    async resolveUserJid(message, args) {
        if (message.reply_message) {
            return message.reply_message.jid;
        } else if (message.mention && message.mention.length > 0) {
            return message.mention[0];
        } else if (args.length > 0) {
            return args[0].includes('@') ? args[0] : args[0] + '@s.whatsapp.net';
        }
        return null;
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Profile Management Commands*

*/profile pp* - Update profile picture (reply to image)
*/profile status <text>* - Update profile status
*/profile block @user* - Block a user
*/profile unblock @user* - Unblock a user
*/profile contacts list* - List contacts
*/profile leave* - Leave current group

?? *Privacy Note:* Use these commands responsibly`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};