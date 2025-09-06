// GHOST-OFFICIAL-V1 Language System
// RAK Realm - Copyright RAK

const fs = require('fs-extra');
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

    async initialize() {
        try {
            // Create languages directory if it doesn't exist
            await fs.ensureDir(this.languageDir);
            
            // Check if directory is empty, create default languages
            const files = await fs.readdir(this.languageDir);
            if (files.length === 0) {
                await this.createDefaultLanguages();
            }

            // Load all available languages
            await this.loadAllLanguages();
            
            // Validate current language
            if (!this.languages[this.currentLanguage]) {
                console.log(chalk.yellow.bold(
                    `Language '${this.currentLanguage}' not found. Using default '${this.defaultLanguage}'.`
                ));
                this.currentLanguage = this.defaultLanguage;
            }

            console.log(chalk.green.bold(
                `✓ Loaded ${Object.keys(this.languages).length} languages. Using: ${this.currentLanguage}`
            ));

        } catch (error) {
            console.log(chalk.red.bold('✗ Language system initialization failed:'), error.message);
            this.createEmergencyLanguage();
        }
    }

    async loadAllLanguages() {
        try {
            const files = await fs.readdir(this.languageDir);
            
            for (const file of files) {
                if (path.extname(file) === '.json') {
                    try {
                        const langCode = path.basename(file, '.json');
                        const filePath = path.join(this.languageDir, file);
                        const data = await fs.readFile(filePath, 'utf8');
                        this.languages[langCode] = JSON.parse(data);
                        
                        console.log(chalk.blue.bold(`✓ Loaded language: ${langCode}`));
                    } catch (error) {
                        console.log(chalk.red.bold(`✗ Error loading language file ${file}:`), error.message);
                    }
                }
            }
        } catch (error) {
            console.log(chalk.red.bold('✗ Error reading language directory:'), error.message);
        }
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

        // If value is still an object, return the key
        if (typeof value === 'object') {
            return `{INVALID_KEY:${key}}`;
        }

        // Replace variables in the string
        if (typeof value === 'string' && variables) {
            for (const [varKey, varValue] of Object.entries(variables)) {
                value = value.replace(new RegExp(`{{${varKey}}}`, 'g'), varValue);
            }
        }

        return value;
    }

    async createDefaultLanguages() {
        const defaultLanguages = {
            'EN': this.getEnglishStrings(),
            'UR': this.getUrduStrings(),
            'HI': this.getHindiStrings(),
            'AR': this.getArabicStrings()
        };

        for (const [langCode, strings] of Object.entries(defaultLanguages)) {
            try {
                const filePath = path.join(this.languageDir, `${langCode}.json`);
                await fs.writeFile(filePath, JSON.stringify(strings, null, 2), 'utf8');
                console.log(chalk.green.bold(`✓ Created default language: ${langCode}`));
            } catch (error) {
                console.log(chalk.red.bold(`✗ Error creating language ${langCode}:`), error.message);
            }
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
                BOT_START: "✓ *GHOST-OFFICIAL-V1* started successfully!",
                COMMAND_EXECUTED: "Command executed successfully!",
                SETTING_UPDATED: "Setting updated successfully!"
            },
            ERRORS: {
                COMMAND_NOT_FOUND: "✗ Command not found. Use /help to see available commands.",
                NO_PERMISSION: "✗ You don't have permission to use this command.",
                INVALID_SYNTAX: "✗ Invalid command syntax.",
                ONLY_GROUP: "✗ This command can only be used in groups.",
                ONLY_PRIVATE: "✗ This command can only be used in private chat."
            },
            GROUP: {
                WELCOME: "✓ Welcome {{user}} to {{group}}!",
                GOODBYE: "✗ Goodbye {{user}}! We'll miss you.",
                PROMOTED: "✓ {{user}} has been promoted to admin!",
                DEMOTED: "✗ {{user}} has been demoted from admin."
            },
            COMMON: {
                HELP: "📖 *Available Commands:*\n{{commands}}",
                PING: "🏓 Pong! {{responseTime}}ms",
                ABOUT: `ℹ️ *GHOST-OFFICIAL-V1* ℹ️\nVersion: {{version}}\nOwner: {{owner}}\nRealm: {{realm}}`,
                STATUS: "✓ Bot is online and operational!"
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
                BOT_START: "✓ *GHOST-OFFICIAL-V1* کامیابی سے شروع ہو گیا ہے!",
                COMMAND_EXECUTED: "کمانڈ کامیابی سے عمل میں آئی!",
                SETTING_UPDATED: "ترتیب کامیابی سے اپ ڈیٹ ہو گئی!"
            },
            ERRORS: {
                COMMAND_NOT_FOUND: "✗ کمانڈ نہیں ملی۔ دستیاب کمانڈز دیکھنے کے لیے /help استعمال کریں۔",
                NO_PERMISSION: "✗ آپ کو اس کمانڈ کو استعمال کرنے کی اجازت نہیں ہے۔",
                INVALID_SYNTAX: "✗ غلط کمانڈ نحو۔",
                ONLY_GROUP: "✗ یہ کمانڈ صرف گروپس میں استعمال کی جا سکتی ہے۔",
                ONLY_PRIVATE: "✗ یہ کمانڈ صرف پرائیویٹ چیٹ میں استعمال کی جا سکتی ہے۔"
            },
            GROUP: {
                WELCOME: "✓ {{group}} میں خوش آمدید {{user}}!",
                GOODBYE: "✗ الوداع {{user}}! ہم آپ کو یاد کریں گے۔",
                PROMOTED: "✓ {{user}} کو ایڈمن بنایا گیا ہے!",
                DEMOTED: "✗ {{user}} کو ایڈمن کے عہدے سے ہٹا دیا گیا ہے۔"
            },
            COMMON: {
                HELP: "📖 *دستیاب کمانڈز:*\n{{commands}}",
                PING: "🏓 پونگ! {{responseTime}}ms",
                ABOUT: `ℹ️ *GHOST-OFFICIAL-V1* ℹ️\nورژن: {{version}}\nمالک: {{owner}}\nریلم: {{realm}}`,
                STATUS: "✓ بوٹ آن لائن اور کام کر رہا ہے!"
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
                BOT_START: "✓ *GHOST-OFFICIAL-V1* सफलतापूर्वक शुरू हो गया है!",
                COMMAND_EXECUTED: "कमांड सफलतापूर्वक निष्पादित हुई!",
                SETTING_UPDATED: "सेटिंग सफलतापूर्वक अपडेट हो गई!"
            },
            ERRORS: {
                COMMAND_NOT_FOUND: "✗ कमांड नहीं मिली। उपलब्ध कमांड देखने के लिए /help का उपयोग करें।",
                NO_PERMISSION: "✗ आपके पास इस कमांड का उपयोग करने की अनुमति नहीं है।",
                INVALID_SYNTAX: "✗ अमान्य कमांड सिंटैक्स।",
                ONLY_GROUP: "✗ यह कमांड केवल समूहों में उपयोग की जा सकती है।",
                ONLY_PRIVATE: "✗ यह कमांड केवल निजी चैट में उपयोग की जा सकती है।"
            },
            GROUP: {
                WELCOME: "✓ {{group}} में आपका स्वागत है {{user}}!",
                GOODBYE: "✗ अलविदा {{user}}! हम आपको याद करेंगे।",
                PROMOTED: "✓ {{user}} को एडमिन बनाया गया है!",
                DEMOTED: "✗ {{user}} को एडमिन के पद से हटा दिया गया है।"
            },
            COMMON: {
                HELP: "📖 *उपलब्ध कमांड:*\n{{commands}}",
                PING: "🏓 पोंग! {{responseTime}}ms",
                ABOUT: `ℹ️ *GHOST-OFFICIAL-V1* ℹ️\nसंस्करण: {{version}}\nमालिक: {{owner}}\nरीम: {{realm}}`,
                STATUS: "✓ बॉट ऑनलाइन और कार्यशील है!"
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
                BOT_START: "✓ *GHOST-OFFICIAL-V1* بدأ بنجاح!",
                COMMAND_EXECUTED: "تم تنفيذ الأمر بنجاح!",
                SETTING_UPDATED: "تم تحديث الإعداد بنجاح!"
            },
            ERRORS: {
                COMMAND_NOT_FOUND: "✗ الأمر غير موجود. استخدم /help لرؤية الأوامر المتاحة.",
                NO_PERMISSION: "✗ ليس لديك إذن لاستخدام هذا الأمر.",
                INVALID_SYNTAX: "✗ بناء جملة أمر غير صالح.",
                ONLY_GROUP: "✗ يمكن استخدام هذا الأمر فقط في المجموعات.",
                ONLY_PRIVATE: "✗ يمكن استخدام هذا الأمر فقط في الدردشة الخاصة."
            },
            GROUP: {
                WELCOME: "✓ مرحبًا بك {{user}} في {{group}}!",
                GOODBYE: "✗ وداعًا {{user}}! سنشتاق إليك.",
                PROMOTED: "✓ تمت ترقية {{user}} إلى مسؤول!",
                DEMOTED: "✗ تمت إزالة {{user}} من منصب المسؤول."
            },
            COMMON: {
                HELP: "📖 *الأوامر المتاحة:*\n{{commands}}",
                PING: "🏓 بونج! {{responseTime}}ms",
                ABOUT: `ℹ️ *GHOST-OFFICIAL-V1* ℹ️\nالإصدار: {{version}}\nالمالك: {{owner}}\nالمملكة: {{realm}}`,
                STATUS: "✓ البوت يعمل ومتصل!"
            }
        };
    }

    createEmergencyLanguage() {
        // Fallback in case of complete failure
        this.languages = {
            EN: this.getEnglishStrings()
        };
        this.currentLanguage = 'EN';
        console.log(chalk.yellow.bold('⚠️  Using emergency fallback language (EN)'));
    }

    // Method to add new language at runtime
    async addLanguage(langCode, strings) {
        try {
            this.languages[langCode] = strings;
            const filePath = path.join(this.languageDir, `${langCode}.json`);
            await fs.writeFile(filePath, JSON.stringify(strings, null, 2), 'utf8');
            console.log(chalk.green.bold(`✓ Added new language: ${langCode}`));
            return true;
        } catch (error) {
            console.log(chalk.red.bold(`✗ Error adding language ${langCode}:`), error.message);
            return false;
        }
    }

    // Method to switch language
    setLanguage(langCode) {
        if (this.languages[langCode]) {
            this.currentLanguage = langCode;
            console.log(chalk.green.bold(`✓ Language switched to: ${langCode}`));
            return true;
        }
        console.log(chalk.red.bold(`✗ Language not available: ${langCode}`));
        return false;
    }

    // Get all available languages
    getAvailableLanguages() {
        return Object.keys(this.languages).map(code => ({
            code,
            name: this.languages[code]?.META?.LANGUAGE || code,
            direction: this.languages[code]?.META?.DIRECTION || 'ltr'
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
