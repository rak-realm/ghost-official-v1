// GHOST-OFFICIAL-V1 Language System
// RAK Realm - Copyright RAK

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const config = require('./config');

class LanguageSystem {
    constructor() {
        this.languages = {};
        this.defaultLanguage = 'EN';
        this.currentLanguage = config.LANGUAGE || this.defaultLanguage;
        this.languageDir = path.join(__dirname, 'languages');
        
        this.initialize();
    }

    initialize() {
        try {
            // Create languages directory if it doesn't exist
            if (!fs.existsSync(this.languageDir)) {
                fs.mkdirSync(this.languageDir, { recursive: true });
                this.createDefaultLanguages();
            }

            // Load all available languages
            this.loadAllLanguages();
            
            // Validate current language
            if (!this.languages[this.currentLanguage]) {
                console.log(chalk.yellow.bold(
                    `Language '${this.currentLanguage}' not found. Using default '${this.defaultLanguage}'.`
                ));
                this.currentLanguage = this.defaultLanguage;
            }

            console.log(chalk.green.bold(
                `? Loaded ${Object.keys(this.languages).length} languages. Using: ${this.currentLanguage}`
            ));

        } catch (error) {
            console.log(chalk.red.bold('? Language system initialization failed:'), error.message);
            this.createEmergencyLanguage();
        }
    }

    loadAllLanguages() {
        const files = fs.readdirSync(this.languageDir);
        
        files.forEach(file => {
            if (path.extname(file) === '.json') {
                try {
                    const langCode = path.basename(file, '.json');
                    const filePath = path.join(this.languageDir, file);
                    const data = fs.readFileSync(filePath, 'utf8');
                    this.languages[langCode] = JSON.parse(data);
                    
                    console.log(chalk.blue.bold(`? Loaded language: ${langCode}`));
                } catch (error) {
                    console.log(chalk.red.bold(`? Error loading language file ${file}:`), error.message);
                }
            }
        });
    }

    getString(key, variables = {}, language = null) {
        const lang = language || this.currentLanguage;
        const langData = this.languages[lang] || this.languages[this.defaultLanguage];
        
        if (!langData) {
            return `{LANGUAGE_ERROR:${key}}`;
        }

        // Support nested keys with dot notation: "GROUP.WELCOME"
        const keys = key.split('.');
        let value = langData;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Fallback to default language
                if (lang !== this.defaultLanguage) {
                    return this.getString(key, variables, this.defaultLanguage);
                }
                return `{MISSING:${key}}`;
            }
        }

        // Replace variables in the string
        if (typeof value === 'string' && variables) {
            for (const [varKey, varValue] of Object.entries(variables)) {
                value = value.replace(new RegExp(`{{${varKey}}}`, 'g'), varValue);
            }
        }

        return value;
    }

    createDefaultLanguages() {
        const defaultLanguages = {
            'EN': this.getEnglishStrings(),
            'UR': this.getUrduStrings(),
            'HI': this.getHindiStrings(),
            'AR': this.getArabicStrings()
        };

        for (const [langCode, strings] of Object.entries(defaultLanguages)) {
            const filePath = path.join(this.languageDir, `${langCode}.json`);
            fs.writeFileSync(filePath, JSON.stringify(strings, null, 2), 'utf8');
        }
    }

    getEnglishStrings() {
        return {
            META: {
                LANGUAGE: "English",
                CODE: "EN",
                DIRECTION: "ltr"
            },
            SUCCESS: {
                BOT_START: "? *GHOST-OFFICIAL-V1* started successfully!",
                COMMAND_EXECUTED: "Command executed successfully!",
                SETTING_UPDATED: "Setting updated successfully!"
            },
            ERRORS: {
                COMMAND_NOT_FOUND: "? Command not found. Use /help to see available commands.",
                NO_PERMISSION: "? You don't have permission to use this command.",
                INVALID_SYNTAX: "? Invalid command syntax.",
                ONLY_GROUP: "? This command can only be used in groups.",
                ONLY_PRIVATE: "? This command can only be used in private chat."
            },
            GROUP: {
                WELCOME: "? Welcome {{user}} to {{group}}!",
                GOODBYE: "?? Goodbye {{user}}! We'll miss you.",
                PROMOTED: "?? {{user}} has been promoted to admin!",
                DEMOTED: "?? {{user}} has been demoted from admin."
            },
            COMMON: {
                HELP: "?? *Available Commands:*\n{{commands}}",
                PING: "?? Pong! {{responseTime}}ms",
                ABOUT: `? *GHOST-OFFICIAL-V1* ?\nVersion: {{version}}\nOwner: {{owner}}\nRealm: {{realm}}`,
                STATUS: "? Bot is online and operational!"
            }
        };
    }

    getUrduStrings() {
        return {
            META: {
                LANGUAGE: "Urdu",
                CODE: "UR",
                DIRECTION: "rtl"
            },
            SUCCESS: {
                BOT_START: "? *GHOST-OFFICIAL-V1* ???? ?? ??? ??!",
                COMMAND_EXECUTED: "????? ??????? ?? ????? ???!",
                SETTING_UPDATED: "????? ??????? ?? ?? ??? ?? ???!"
            },
            ERRORS: {
                COMMAND_NOT_FOUND: "? ????? ???? ???? /help ??????? ?????",
                NO_PERMISSION: "? ?? ?? ?? ????? ?? ??????? ???? ?? ????? ???? ???",
                INVALID_SYNTAX: "? ??? ????? syntax?",
                ONLY_GROUP: "? ?? ????? ??? ???? ??? ??????? ?? ???? ???",
                ONLY_PRIVATE: "? ?? ????? ??? ???????? ??? ??? ??????? ?? ???? ???"
            },
            GROUP: {
                WELCOME: "? {{group}} ??? ??? ????? {{user}}!",
                GOODBYE: "?? ???? ???? {{user}}! ?? ?? ??? ????? ?? ???",
                PROMOTED: "?? {{user}} ?? ????? ??? ??? ??? ??!",
                DEMOTED: "?? {{user}} ?? ????? ?? ??? ?? ?? ??? ???"
            },
            COMMON: {
                HELP: "?? *?????? ??????:*\n{{commands}}",
                PING: "?? ????! {{responseTime}}ms",
                ABOUT: `? *GHOST-OFFICIAL-V1* ?\n????: {{version}}\n????: {{owner}}\n????: {{realm}}`,
                STATUS: "? ??? ?? ???? ??? ??? ?? ??? ??!"
            }
        };
    }

    getHindiStrings() {
        return {
            META: {
                LANGUAGE: "Hindi",
                CODE: "HI",
                DIRECTION: "ltr"
            },
            SUCCESS: {
                BOT_START: "? *GHOST-OFFICIAL-V1* ??????????? ???? ?? ???!",
                COMMAND_EXECUTED: "????? ??????????? ?????????!",
                SETTING_UPDATED: "?????? ??????????? ????? ?? ??!"
            },
            ERRORS: {
                COMMAND_NOT_FOUND: "? ????? ???? ????? /help ?? ????? ?????",
                NO_PERMISSION: "? ???? ??? ?? ????? ?? ????? ???? ?? ?????? ???? ???",
                INVALID_SYNTAX: "? ?????? ????? ?????????",
                ONLY_GROUP: "? ?? ????? ???? ????? ??? ????? ?? ?? ???? ???",
                ONLY_PRIVATE: "? ?? ????? ???? ???????? ??? ??? ????? ?? ?? ???? ???"
            },
            GROUP: {
                WELCOME: "? {{group}} ??? ???? ?????? ?? {{user}}!",
                GOODBYE: "?? ?????? {{user}}! ?? ???? ??? ???????",
                PROMOTED: "?? {{user}} ?? ????? ????? ??? ??!",
                DEMOTED: "?? {{user}} ?? ???????? ??? ?? ?? ???"
            },
            COMMON: {
                HELP: "?? *?????? ???????:*\n{{commands}}",
                PING: "?? ????! {{responseTime}}ms",
                ABOUT: `? *GHOST-OFFICIAL-V1* ?\n???????: {{version}}\n?????: {{owner}}\n???: {{realm}}`,
                STATUS: "? ??? ?????? ?? ???????? ??!"
            }
        };
    }

    getArabicStrings() {
        return {
            META: {
                LANGUAGE: "Arabic",
                CODE: "AR",
                DIRECTION: "rtl"
            },
            SUCCESS: {
                BOT_START: "? *GHOST-OFFICIAL-V1* ??? ?????!",
                COMMAND_EXECUTED: "?? ????? ????? ?????!",
                SETTING_UPDATED: "?? ????? ??????? ?????!"
            },
            ERRORS: {
                COMMAND_NOT_FOUND: "? ????? ??? ?????. ?????? /help ????? ??????? ???????.",
                NO_PERMISSION: "? ??? ???? ??? ???????? ??? ?????.",
                INVALID_SYNTAX: "? ???? ???? ??? ??? ????.",
                ONLY_GROUP: "? ??? ????? ???? ???????? ??? ?? ?????????.",
                ONLY_PRIVATE: "? ??? ????? ???? ???????? ??? ?? ??????? ??????."
            },
            GROUP: {
                WELCOME: "? ????? ?? {{user}} ?? {{group}}!",
                GOODBYE: "?? ?????? {{user}}! ?????? ????.",
                PROMOTED: "?? ?? ????? {{user}} ??? ????!",
                DEMOTED: "?? ?? ????? {{user}} ?? ???????."
            },
            COMMON: {
                HELP: "?? *??????? ???????:*\n{{commands}}",
                PING: "?? ????! {{responseTime}}ms",
                ABOUT: `? *GHOST-OFFICIAL-V1* ?\n???????: {{version}}\n??????: {{owner}}\n???????: {{realm}}`,
                STATUS: "? ????? ???? ?????!"
            }
        };
    }

    createEmergencyLanguage() {
        // Fallback in case of complete failure
        this.languages = {
            EN: this.getEnglishStrings()
        };
        this.currentLanguage = 'EN';
    }

    // Method to add new language at runtime
    addLanguage(langCode, strings) {
        try {
            this.languages[langCode] = strings;
            const filePath = path.join(this.languageDir, `${langCode}.json`);
            fs.writeFileSync(filePath, JSON.stringify(strings, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.log(chalk.red.bold(`? Error adding language ${langCode}:`), error.message);
            return false;
        }
    }

    // Method to switch language
    setLanguage(langCode) {
        if (this.languages[langCode]) {
            this.currentLanguage = langCode;
            return true;
        }
        return false;
    }

    // Get all available languages
    getAvailableLanguages() {
        return Object.keys(this.languages).map(code => ({
            code,
            name: this.languages[code]?.META?.LANGUAGE || code
        }));
    }
}

// Create singleton instance
const languageSystem = new LanguageSystem();

// Helper function for easy access
function getString(key, variables = {}) {
    return languageSystem.getString(key, variables);
}

module.exports = {
    LanguageSystem,
    getString,
    instance: languageSystem
};