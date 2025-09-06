// GHOST-OFFICIAL-V1 Configuration
// RAK Realm - Copyright RAK

const fs = require('fs-extra');
const path = require('path');

// Load environment variables from .env file if it exists
if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
}

// Utility function to convert string to boolean
const toBool = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        if (value === '1') return true;
        if (value === '0') return false;
    }
    return defaultValue;
};

// Utility function to convert string to array
const toArray = (value, separator = ',') => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return value.split(separator).map(item => item.trim()).filter(item => item);
};

// Utility function to get number with default
const toNumber = (value, defaultValue = 0) => {
    if (value === undefined || value === null) return defaultValue;
    const num = parseInt(value);
    return isNaN(num) ? defaultValue : num;
};

// Main Configuration
module.exports = {
    // Core Identity
    BOT_NAME: process.env.BOT_NAME || "GHOST-OFFICIAL-V1",
    OWNER_NAME: process.env.OWNER_NAME || "RAK",
    REALM: process.env.REALM || "RAK Realm",
    VERSION: process.env.VERSION || "1.0.0",

    // Session & Security
    SESSION: process.env.RAK_SESSION || "",
    PREFIX: process.env.PREFIX || "/",
    ANTI_BAN: toBool(process.env.ANTI_BAN, true),

    // User Management
    SUDO_USERS: toArray(process.env.SUDO_USERS),
    MOD_USERS: toArray(process.env.MOD_USERS),
    ALLOWED_JIDS: toArray(process.env.ALLOWED_JIDS),
    BLOCKED_JIDS: toArray(process.env.BLOCKED_JIDS),

    // Features
    LANGUAGE: process.env.LANGUAGE || "EN",
    VC_MODE: process.env.VC_MODE || "off",
    AUTO_UPDATE: toBool(process.env.AUTO_UPDATE, true),
    SEND_READ: toBool(process.env.SEND_READ, false),
    NO_ONLINE: toBool(process.env.NO_ONLINE, true),

    // Platform Specific
    HEROKU: {
        ENABLED: toBool(process.env.HEROKU, false),
        API_KEY: process.env.HEROKU_API_KEY || "",
        APP_NAME: process.env.HEROKU_APP_NAME || ""
    },

    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    ENCRYPT_LOGS: toBool(process.env.ENCRYPT_LOGS, true),

    // External APIs
    BRAINSHOP_KEY: process.env.BRAINSHOP_KEY || "",
    REMOVEBG_KEY: process.env.REMOVEBG_KEY || "",
    OPENAI_KEY: process.env.OPENAI_KEY || "",

    // Safety Settings
    WARN_COUNT: toNumber(process.env.WARN_COUNT, 3),
    MAX_REQUESTS_PER_MINUTE: toNumber(process.env.MAX_REQUESTS_PER_MINUTE, 30),

    // Theme System
    DEFAULT_THEME: process.env.DEFAULT_THEME || "RAK",

    // Server Settings
    PORT: toNumber(process.env.PORT, 3000),
    HOST: process.env.HOST || "0.0.0.0"
};

// Export utility functions for external use
module.exports.utils = {
    toBool,
    toArray,
    toNumber
};
