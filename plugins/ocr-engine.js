// GHOST-OFFICIAL-V1 OCR Engine
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');

class OCREngine {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.supportedLanguages = this.getSupportedLanguages();
        this.worker = null;
    }

    async initialize() {
        this.logger.info('Initializing OCR engine...');
        // Preload worker for better performance
        await this.initWorker();
    }

    async initWorker() {
        try {
            this.worker = await Tesseract.createWorker();
            await this.worker.loadLanguage('eng');
            await this.worker.initialize('eng');
            this.logger.success('OCR worker initialized');
        } catch (error) {
            this.logger.error(`OCR worker initialization failed: ${error.message}`);
        }
    }

    getSupportedLanguages() {
        return {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'ko': 'Korean',
            'tr': 'Turkish',
            'ur': 'Urdu'
        };
    }

    async extractText(imageBuffer, options = {}) {
        try {
            const {
                language = 'en',
                preprocess = true,
                confidenceThreshold = 60
            } = options;

            // Preprocess image for better OCR results
            let processedBuffer = imageBuffer;
            if (preprocess) {
                processedBuffer = await this.preprocessImage(imageBuffer);
            }

            // Initialize worker if not already done
            if (!this.worker) {
                await this.initWorker();
            }

            // Set language
            if (language !== 'en') {
                await this.worker.loadLanguage(language);
                await this.worker.initialize(language);
            }

            // Perform OCR
            const result = await this.worker.recognize(processedBuffer);
            
            // Filter results by confidence
            const filteredText = this.filterByConfidence(result.data, confidenceThreshold);

            return {
                success: true,
                text: filteredText,
                confidence: result.data.confidence,
                language: language,
                fullResult: result.data
            };
        } catch (error) {
            this.logger.error(`OCR extraction failed: ${error.message}`);
            throw error;
        }
    }

    async preprocessImage(buffer) {
        try {
            return await sharp(buffer)
                .grayscale() // Convert to grayscale
                .normalize() // Normalize contrast
                .sharpen() // Sharpen image
                .threshold(128) // Apply threshold
                .toBuffer();
        } catch (error) {
            this.logger.warn(`Image preprocessing failed: ${error.message}`);
            return buffer; // Return original if preprocessing fails
        }
    }

    filterByConfidence(ocrResult, threshold) {
        let filteredText = '';

        if (ocrResult.words) {
            for (const word of ocrResult.words) {
                if (word.confidence >= threshold) {
                    filteredText += word.text + ' ';
                }
            }
        }

        return filteredText.trim();
    }

    async detectLanguage(text) {
        // Simple language detection based on character patterns
        // This could be enhanced with a proper language detection library
        const patterns = {
            'ar': /[\u0600-\u06FF]/, // Arabic
            'zh': /[\u4E00-\u9FFF]/, // Chinese
            'ja': /[\u3040-\u309F\u30A0-\u30FF]/, // Japanese
            'ko': /[\uAC00-\uD7AF]/, // Korean
            'ru': /[\u0400-\u04FF]/, // Russian
            'hi': /[\u0900-\u097F]/ // Hindi
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) {
                return lang;
            }
        }

        // Default to English for Latin script
        return 'en';
    }

    async batchProcess(images, options = {}) {
        try {
            const results = [];
            
            for (const imageBuffer of images) {
                try {
                    const result = await this.extractText(imageBuffer, options);
                    results.push(result);
                } catch (error) {
                    results.push({
                        success: false,
                        error: error.message,
                        text: ''
                    });
                }
            }

            return results;
        } catch (error) {
            throw new Error(`Batch processing failed: ${error.message}`);
        }
    }

    async getTextFromPDF(pdfBuffer, options = {}) {
        try {
            // This would require pdf.js or similar library
            // For now, we'll extract text from the first page as image
            throw new Error('PDF text extraction not implemented');
        } catch (error) {
            throw new Error(`PDF processing failed: ${error.message}`);
        }
    }

    async validateLanguage(language) {
        return this.supportedLanguages.hasOwnProperty(language);
    }

    async getLanguageName(code) {
        return this.supportedLanguages[code] || 'Unknown';
    }

    async cleanup() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
}

// OCR Commands
module.exports = {
    name: 'ocr',
    version: '1.0.0',
    description: 'Advanced Optical Character Recognition system',
    category: 'tools',
    cooldown: 15,

    commands: {
        extract: {
            description: 'Extract text from image',
            usage: '/ocr [language]'
        },
        languages: {
            description: 'List supported languages',
            usage: '/ocr languages'
        },
        detect: {
            description: 'Detect text language',
            usage: '/ocr detect'
        }
    },

    async execute({ message, args, sock, bot }) {
        const ocrEngine = new OCREngine(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            if (!message.reply_message && subCommand !== 'languages') {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('OCR.REPLY_REQUIRED')
                });
            }

            switch (subCommand) {
                case 'extract':
                    return await this.extractText(message, args.slice(1), ocrEngine, sock);
                case 'languages':
                    return await this.listLanguages(message, ocrEngine, sock);
                case 'detect':
                    return await this.detectLanguage(message, ocrEngine, sock);
                default:
                    // Default to extract with auto language
                    return await this.extractText(message, args, ocrEngine, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`OCR command error: ${error.message}`);
        } finally {
            await ocrEngine.cleanup();
        }
    },

    async extractText(message, args, ocrEngine, sock) {
        let language = 'en';
        
        if (args.length > 0) {
            const langCode = args[0].toLowerCase();
            if (!await ocrEngine.validateLanguage(langCode)) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('OCR.INVALID_LANGUAGE', { language: langCode })
                });
            }
            language = langCode;
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('OCR.PROCESSING', { language: await ocrEngine.getLanguageName(language) })
        });

        try {
            const imageBuffer = await message.reply_message.downloadMediaMessage();
            const result = await ocrEngine.extractText(imageBuffer, {
                language: language,
                preprocess: true,
                confidenceThreshold: 60
            });

            if (!result.text) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('OCR.NO_TEXT_FOUND')
                });
            }

            let response = getString('OCR.RESULT_HEADER', {
                language: await ocrEngine.getLanguageName(language),
                confidence: Math.round(result.confidence)
            });

            response += `\n\n${result.text}`;

            // Split long messages
            if (response.length > 4000) {
                await sock.sendMessage(message.key.remoteJid, {
                    text: response.substring(0, 4000)
                });
                await sock.sendMessage(message.key.remoteJid, {
                    text: response.substring(4000)
                });
            } else {
                await sock.sendMessage(message.key.remoteJid, { text: response });
            }

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('OCR.EXTRACTION_FAILED', { error: error.message })
            });
        }
    },

    async listLanguages(message, ocrEngine, sock) {
        let languagesMessage = getString('OCR.LANGUAGES_HEADER');
        
        for (const [code, name] of Object.entries(ocrEngine.supportedLanguages)) {
            languagesMessage += `\n• ${code} - ${name}`;
        }

        languagesMessage += `\n\n${getString('OCR.LANGUAGE_USAGE')}`;

        await sock.sendMessage(message.key.remoteJid, { text: languagesMessage });
    },

    async detectLanguage(message, ocrEngine, sock) {
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('OCR.DETECTING')
        });

        try {
            const imageBuffer = await message.reply_message.downloadMediaMessage();
            const result = await ocrEngine.extractText(imageBuffer, {
                language: 'en',
                preprocess: true
            });

            if (!result.text) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('OCR.NO_TEXT_FOUND')
                });
            }

            const detectedLang = await ocrEngine.detectLanguage(result.text);
            const langName = await ocrEngine.getLanguageName(detectedLang);

            await sock.sendMessage(message.key.remoteJid, {
                text: getString('OCR.DETECTION_RESULT', {
                    language: langName,
                    code: detectedLang
                })
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('OCR.DETECTION_FAILED', { error: error.message })
            });
        }
    },

    async showHelp(message, sock) {
        const helpText = `
?? *OCR Commands*

*/ocr [language]* - Extract text from image (reply to image)
*/ocr languages* - List supported languages
*/ocr detect* - Detect text language

?? *Supported Languages:*
English (en), Spanish (es), French (fr), German (de)
Arabic (ar), Hindi (hi), Chinese (zh), Japanese (ja)
Korean (ko), Russian (ru), Turkish (tr), Urdu (ur)

?? *Tip:* Use language codes for better accuracy`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};