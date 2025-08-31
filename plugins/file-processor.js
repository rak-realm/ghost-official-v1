// GHOST-OFFICIAL-V1 File Processor
// RAK Realm - Copyright RAK

const fs = require('fs-extra');
const path = require('path');
const { getString } = require('../utils/language-system');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class FileProcessor {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.supportedConversions = {
            'docx': ['pdf', 'txt', 'html'],
            'pdf': ['docx', 'txt', 'html'],
            'txt': ['pdf', 'docx', 'html'],
            'html': ['pdf', 'docx', 'txt']
        };
    }

    async convertFile(inputBuffer, fromFormat, toFormat) {
        try {
            const tempDir = path.join(__dirname, '../temp');
            await fs.ensureDir(tempDir);
            
            const inputFile = path.join(tempDir, `input.${fromFormat}`);
            const outputFile = path.join(tempDir, `output.${toFormat}`);
            
            // Write input buffer to file
            await fs.writeFile(inputFile, inputBuffer);
            
            let command;
            
            switch (`${fromFormat}-${toFormat}`) {
                case 'docx-pdf':
                    command = `libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${inputFile}"`;
                    break;
                case 'pdf-docx':
                    command = `pdftohtml -c -s -i "${inputFile}" "${outputFile}"`;
                    break;
                case 'txt-pdf':
                    command = `pandoc "${inputFile}" -o "${outputFile}"`;
                    break;
                default:
                    throw new Error(`Unsupported conversion: ${fromFormat} to ${toFormat}`);
            }
            
            await execAsync(command);
            
            if (!await fs.pathExists(outputFile)) {
                throw new Error('Conversion failed - output file not created');
            }
            
            const outputBuffer = await fs.readFile(outputFile);
            
            // Cleanup
            await fs.remove(inputFile);
            await fs.remove(outputFile);
            
            return outputBuffer;
            
        } catch (error) {
            this.logger.error(`File conversion failed: ${error.message}`);
            throw error;
        }
    }

    async detectFileType(buffer) {
        // Simple file type detection based on magic numbers
        const signatures = {
            'pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]),
            'docx': Buffer.from([0x50, 0x4B, 0x03, 0x04]),
            'png': Buffer.from([0x89, 0x50, 0x4E, 0x47]),
            'jpg': Buffer.from([0xFF, 0xD8, 0xFF])
        };

        for (const [type, signature] of Object.entries(signatures)) {
            if (buffer.slice(0, signature.length).equals(signature)) {
                return type;
            }
        }

        return 'unknown';
    }

    async validateFileSize(buffer, maxSizeMB = 10) {
        const sizeMB = buffer.length / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
            throw new Error(`File size too large: ${sizeMB.toFixed(2)}MB (max: ${maxSizeMB}MB)`);
        }
        return true;
    }

    async processDocument(message, targetFormat) {
        try {
            if (!message.reply_message || !message.reply_message.document) {
                throw new Error('Please reply to a document message');
            }

            const documentBuffer = await message.reply_message.downloadMediaMessage();
            await this.validateFileSize(documentBuffer);

            const detectedType = await this.detectFileType(documentBuffer);
            if (detectedType === 'unknown') {
                throw new Error('Unsupported file type');
            }

            if (!this.supportedConversions[detectedType]?.includes(targetFormat)) {
                throw new Error(`Cannot convert ${detectedType} to ${targetFormat}`);
            }

            const convertedBuffer = await this.convertFile(documentBuffer, detectedType, targetFormat);

            return {
                success: true,
                buffer: convertedBuffer,
                filename: `converted.${targetFormat}`,
                originalType: detectedType,
                targetFormat: targetFormat
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// File Processing Commands
module.exports = {
    name: 'file',
    version: '1.0.0',
    description: 'Advanced file conversion and processing utilities',
    category: 'tools',
    cooldown: 10,

    commands: {
        topdf: {
            description: 'Convert document to PDF',
            usage: 'Reply to a document with /topdf'
        },
        todocx: {
            description: 'Convert document to DOCX',
            usage: 'Reply to a document with /todocx'
        },
        totxt: {
            description: 'Convert document to TXT',
            usage: 'Reply to a document with /totxt'
        }
    },

    async execute({ message, args, sock, bot }) {
        const processor = new FileProcessor(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            let result;
            let targetFormat;

            switch (subCommand) {
                case 'topdf':
                    targetFormat = 'pdf';
                    break;
                case 'todocx':
                    targetFormat = 'docx';
                    break;
                case 'totxt':
                    targetFormat = 'txt';
                    break;
                default:
                    return await this.showHelp(message, sock);
            }

            result = await processor.processDocument(message, targetFormat);

            if (!result.success) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('FILE.CONVERSION_FAILED', { error: result.error })
                });
            }

            await sock.sendMessage(message.key.remoteJid, {
                document: result.buffer,
                fileName: result.filename,
                mimetype: `application/${result.targetFormat}`,
                quoted: message
            });

            bot.logger.info(`File converted: ${result.originalType} -> ${result.targetFormat}`);

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`File command error: ${error.message}`);
        }
    },

    async showHelp(message, sock) {
        const helpText = `
?? *File Processing Commands*

*/file topdf* - Convert document to PDF
*/file todocx* - Convert document to DOCX  
*/file totxt* - Convert document to TXT

?? *Usage:* Reply to a document message with the command

? *Supported formats:* DOCX, PDF, TXT, HTML
?? *Max file size:* 10MB`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};