// GHOST-OFFICIAL-V1 Security System
// RAK Realm - Copyright RAK

const fs = require('fs-extra');
const path = require('path');
const { Boom } = require('@hapi/boom');
const config = require('../config');
const { getString } = require('../language-system');

class SecuritySystem {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.warnedUsers = new Map();
        this.blacklistedJIDs = new Set(config.BLOCKED_JIDS || []);
        this.allowedJIDs = new Set(config.ALLOWED_JIDS || []);
        this.requestCounts = new Map();
        
        this.logger.info('Security System initialized');
    }

    async initialize() {
        try {
            // Load additional blacklist/whitelist from files if they exist
            await this.loadSecurityLists();
            this.logger.success('Security lists loaded successfully');
            
            // Start cleanup job for request counts
            setInterval(() => this.cleanupRequestCounts(), 60000); // Cleanup every minute
            
        } catch (error) {
            this.logger.error(`Security initialization failed: ${error.message}`);
        }
    }

    async loadSecurityLists() {
        try {
            const blacklistPath = path.join(__dirname, '../data/blacklist.json');
            const whitelistPath = path.join(__dirname, '../data/whitelist.json');
            
            if (await fs.pathExists(blacklistPath)) {
                const data = await fs.readJson(blacklistPath);
                data.forEach(jid => this.blacklistedJIDs.add(jid));
            }
            
            if (await fs.pathExists(whitelistPath)) {
                const data = await fs.readJson(whitelistPath);
                data.forEach(jid => this.allowedJIDs.add(jid));
            }
        } catch (error) {
            this.logger.warn(`Could not load security lists: ${error.message}`);
        }
    }

    async scanMessage(message) {
        const jid = message.key.remoteJid;
        const userId = message.key.participant || jid;
        
        // Check if user is blacklisted
        if (this.blacklistedJIDs.has(jid) || this.blacklistedJIDs.has(userId)) {
            return {
                safe: false,
                reason: 'BLACKLISTED',
                action: 'BLOCK'
            };
        }
        
        // Check if bot is restricted to specific users only
        if (this.allowedJIDs.size > 0 && 
            !this.allowedJIDs.has(jid) && 
            !this.allowedJIDs.has(userId)) {
            return {
                safe: false,
                reason: 'NOT_WHITELISTED',
                action: 'BLOCK'
            };
        }
        
        // Rate limiting check
        const rateLimitCheck = this.checkRateLimit(userId);
        if (!rateLimitCheck.allowed) {
            return {
                safe: false,
                reason: 'RATE_LIMITED',
                action: 'BLOCK',
                retryAfter: rateLimitCheck.retryAfter
            };
        }
        
        // Anti-spam check
        const spamCheck = this.checkSpam(message);
        if (!spamCheck.safe) {
            return {
                safe: false,
                reason: spamCheck.reason,
                action: 'WARN',
                warningCount: this.addWarning(userId, spamCheck.reason)
            };
        }
        
        // Content safety check (basic implementation)
        const contentCheck = this.checkContentSafety(message);
        if (!contentCheck.safe) {
            return {
                safe: false,
                reason: contentCheck.reason,
                action: 'DELETE',
                warningCount: this.addWarning(userId, contentCheck.reason)
            };
        }
        
        return { safe: true, reason: 'CLEAN' };
    }

    checkRateLimit(userId) {
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window
        
        if (!this.requestCounts.has(userId)) {
            this.requestCounts.set(userId, []);
        }
        
        const userRequests = this.requestCounts.get(userId);
        // Remove requests outside the current window
        const recentRequests = userRequests.filter(time => time > windowStart);
        this.requestCounts.set(userId, recentRequests);
        
        if (recentRequests.length >= config.MAX_REQUESTS_PER_MINUTE) {
            const oldestRequest = Math.min(...recentRequests);
            const retryAfter = Math.ceil((oldestRequest + 60000 - now) / 1000);
            return { allowed: false, retryAfter };
        }
        
        recentRequests.push(now);
        return { allowed: true };
    }

    checkSpam(message) {
        const messageText = this.extractMessageText(message);
        if (!messageText) return { safe: true };
        
        // Check for excessive capitalization
        const upperCaseRatio = (messageText.replace(/[^A-Z]/g, '').length / messageText.length);
        if (upperCaseRatio > 0.7 && messageText.length > 10) {
            return { safe: false, reason: 'EXCESSIVE_CAPS' };
        }
        
        // Check for repetitive messages
        if (this.isRepetitiveText(messageText)) {
            return { safe: false, reason: 'REPETITIVE_TEXT' };
        }
        
        return { safe: true };
    }

    checkContentSafety(message) {
        const messageText = this.extractMessageText(message);
        if (!messageText) return { safe: true };
        
        const forbiddenPatterns = [
            /discord\.gg\/\w+/i, // Discord invites
            /t\.me\/\w+/i, // Telegram invites
            /http(s)?:\/\/[^\s]+/i, // URLs (basic check)
        ];
        
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(messageText)) {
                return { safe: false, reason: 'FORBIDDEN_CONTENT' };
            }
        }
        
        return { safe: true };
    }

    extractMessageText(message) {
        if (message.message?.conversation) return message.message.conversation;
        if (message.message?.extendedTextMessage?.text) return message.message.extendedTextMessage.text;
        if (message.message?.imageMessage?.caption) return message.message.imageMessage.caption;
        if (message.message?.videoMessage?.caption) return message.message.videoMessage.caption;
        return null;
    }

    isRepetitiveText(text) {
        if (text.length < 20) return false;
        
        // Check if text consists of repeating patterns
        const words = text.split(/\s+/);
        if (words.length < 5) return false;
        
        const uniqueWords = new Set(words);
        const uniquenessRatio = uniqueWords.size / words.length;
        
        return uniquenessRatio < 0.3; // More than 70% repetition
    }

    addWarning(userId, reason) {
        if (!this.warnedUsers.has(userId)) {
            this.warnedUsers.set(userId, { count: 0, reasons: [] });
        }
        
        const userWarnings = this.warnedUsers.get(userId);
        userWarnings.count += 1;
        userWarnings.reasons.push({ timestamp: Date.now(), reason });
        
        // If user exceeds warning limit, add to blacklist
        if (userWarnings.count >= config.WARN_COUNT) {
            this.blacklistedJIDs.add(userId);
            this.logger.warn(`User ${userId} blacklisted due to excessive warnings`);
            
            // Save updated blacklist
            this.saveBlacklist();
        }
        
        return userWarnings.count;
    }

    async saveBlacklist() {
        try {
            const dataDir = path.join(__dirname, '../data');
            await fs.ensureDir(dataDir);
            
            const blacklistPath = path.join(dataDir, 'blacklist.json');
            await fs.writeJson(blacklistPath, Array.from(this.blacklistedJIDs), { spaces: 2 });
        } catch (error) {
            this.logger.error(`Failed to save blacklist: ${error.message}`);
        }
    }

    cleanupRequestCounts() {
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window
        
        for (const [userId, requests] of this.requestCounts.entries()) {
            const recentRequests = requests.filter(time => time > windowStart);
            if (recentRequests.length === 0) {
                this.requestCounts.delete(userId);
            } else {
                this.requestCounts.set(userId, recentRequests);
            }
        }
        
        // Clean up old warnings (older than 24 hours)
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
        for (const [userId, warnings] of this.warnedUsers.entries()) {
            const recentWarnings = warnings.reasons.filter(w => w.timestamp > twentyFourHoursAgo);
            if (recentWarnings.length === 0) {
                this.warnedUsers.delete(userId);
            } else {
                warnings.reasons = recentWarnings;
                warnings.count = recentWarnings.length;
            }
        }
    }

    isAdmin(userId) {
        return config.SUDO_USERS.includes(userId) || config.MOD_USERS.includes(userId);
    }

    isOwner(userId) {
        return config.SUDO_USERS.includes(userId);
    }

    async addToBlacklist(jid) {
        this.blacklistedJIDs.add(jid);
        await this.saveBlacklist();
        return true;
    }

    async removeFromBlacklist(jid) {
        this.blacklistedJIDs.delete(jid);
        await this.saveBlacklist();
        return true;
    }

    getSecurityReport() {
        return {
            blacklistedCount: this.blacklistedJIDs.size,
            allowedCount: this.allowedJIDs.size,
            warnedUsers: this.warnedUsers.size,
            activeRequests: this.requestCounts.size
        };
    }
}

module.exports = { SecuritySystem };