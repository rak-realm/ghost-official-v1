// GHOST-OFFICIAL-V1 Media Processor
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');

class MediaProcessor {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.tempDir = path.join(__dirname, '../temp');
    }

    async initialize() {
        this.logger.info('Initializing media processor...');
        await fs.ensureDir(this.tempDir);
    }

    async processImage(buffer, operation, parameters = {}) {
        try {
            let image = sharp(buffer);

            switch (operation) {
                case 'rotate':
                    image = image.rotate(parameters.degrees || 90);
                    break;
                case 'flip':
                    image = image.flip();
                    break;
                case 'flop':
                    image = image.flop();
                    break;
                case 'grayscale':
                    image = image.grayscale();
                    break;
                case 'blur':
                    image = image.blur(parameters.sigma || 5);
                    break;
                case 'sharpen':
                    image = image.sharpen(parameters.sigma || 2);
                    break;
                case 'resize':
                    image = image.resize(parameters.width, parameters.height, {
                        fit: parameters.fit || 'cover'
                    });
                    break;
                case 'crop':
                    image = image.extract({
                        left: parameters.left || 0,
                        top: parameters.top || 0,
                        width: parameters.width,
                        height: parameters.height
                    });
                    break;
                default:
                    throw new Error(`Unknown image operation: ${operation}`);
            }

            return await image.toBuffer();
        } catch (error) {
            this.logger.error(`Image processing failed: ${error.message}`);
            throw error;
        }
    }

    async processAudio(buffer, operation, parameters = {}) {
        const inputPath = path.join(this.tempDir, `input_${Date.now()}.mp3`);
        const outputPath = path.join(this.tempDir, `output_${Date.now()}.mp3`);

        try {
            await fs.writeFile(inputPath, buffer);

            return new Promise((resolve, reject) => {
                let command = ffmpeg(inputPath);

                switch (operation) {
                    case 'reverse':
                        command = command.audioFilters('areverse');
                        break;
                    case 'bass':
                        command = command.audioFilters(`bass=g=${parameters.strength || 10}`);
                        break;
                    case 'treble':
                        command = command.audioFilters(`treble=g=${parameters.strength || 10}`);
                        break;
                    case 'speed':
                        command = command.audioFilters(`atempo=${parameters.factor || 1.5}`);
                        break;
                    case 'volume':
                        command = command.audioFilters(`volume=${parameters.level || 2}`);
                        break;
                    case 'cut':
                        command = command.setStartTime(parameters.start || 0)
                                       .setDuration(parameters.duration || 30);
                        break;
                    default:
                        throw new Error(`Unknown audio operation: ${operation}`);
                }

                command
                    .on('end', async () => {
                        try {
                            const outputBuffer = await fs.readFile(outputPath);
                            await this.cleanupFiles([inputPath, outputPath]);
                            resolve(outputBuffer);
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        reject(error);
                    })
                    .save(outputPath);
            });
        } catch (error) {
            await this.cleanupFiles([inputPath, outputPath]);
            throw error;
        }
    }

    async processVideo(buffer, operation, parameters = {}) {
        const inputPath = path.join(this.tempDir, `input_${Date.now()}.mp4`);
        const outputPath = path.join(this.tempDir, `output_${Date.now()}.mp4`);

        try {
            await fs.writeFile(inputPath, buffer);

            return new Promise((resolve, reject) => {
                let command = ffmpeg(inputPath);

                switch (operation) {
                    case 'reverse':
                        command = command.videoFilters('reverse')
                                       .audioFilters('areverse');
                        break;
                    case 'rotate':
                        const transpose = parameters.degrees === 90 ? 1 :
                                         parameters.degrees === 180 ? 2 :
                                         parameters.degrees === 270 ? 3 : 0;
                        command = command.videoFilters(`transpose=${transpose}`);
                        break;
                    case 'compress':
                        command = command.videoCodec('libx264')
                                       .audioCodec('aac')
                                       .outputOptions(['-crf 23', '-preset fast']);
                        break;
                    case 'trim':
                        command = command.setStartTime(parameters.start || 0)
                                       .setDuration(parameters.duration || 30);
                        break;
                    case 'merge':
                        // This would handle video merging logic
                        break;
                    case 'extract_audio':
                        command = command.noVideo()
                                       .audioCodec('libmp3lame');
                        break;
                    default:
                        throw new Error(`Unknown video operation: ${operation}`);
                }

                command
                    .on('end', async () => {
                        try {
                            const outputBuffer = await fs.readFile(outputPath);
                            await this.cleanupFiles([inputPath, outputPath]);
                            resolve(outputBuffer);
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        reject(error);
                    })
                    .save(outputPath);
            });
        } catch (error) {
            await this.cleanupFiles([inputPath, outputPath]);
            throw error;
        }
    }

    async convertToSticker(buffer, isVideo = false) {
        try {
            if (isVideo) {
                // Convert video to webm sticker
                return await this.processVideo(buffer, 'compress', {
                    width: 512,
                    height: 512
                });
            } else {
                // Convert image to webp sticker
                return await sharp(buffer)
                    .resize(512, 512, {
                        fit: 'contain',
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp({ quality: 90 })
                    .toBuffer();
            }
        } catch (error) {
            throw new Error(`Sticker conversion failed: ${error.message}`);
        }
    }

    async createAudioVisualization(buffer, style = 'histogram') {
        const inputPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);
        const outputPath = path.join(this.tempDir, `visual_${Date.now()}.mp4`);

        try {
            await fs.writeFile(inputPath, buffer);

            return new Promise((resolve, reject) => {
                let command = ffmpeg(inputPath);

                switch (style) {
                    case 'histogram':
                        command = command.complexFilter([
                            'aformat=channel_layouts=mono',
                            'showwavespic=s=512x512:colors=white:mode=line',
                            'format=rgba,colorchannelmixer=aa=0.5[wave]',
                            '[wave]format=rgba,colorchannelmixer=aa=0.5[wave]'
                        ]);
                        break;
                    case 'spectrum':
                        command = command.complexFilter([
                            'aformat=channel_layouts=mono',
                            'showspectrumpic=s=512x512:mode=combined:color=fire',
                            'format=rgba[spec]',
                            '[spec]format=rgba[spec]'
                        ]);
                        break;
                    default:
                        throw new Error(`Unknown visualization style: ${style}`);
                }

                command
                    .on('end', async () => {
                        try {
                            const outputBuffer = await fs.readFile(outputPath);
                            await this.cleanupFiles([inputPath, outputPath]);
                            resolve(outputBuffer);
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        reject(error);
                    })
                    .save(outputPath);
            });
        } catch (error) {
            await this.cleanupFiles([inputPath, outputPath]);
            throw error;
        }
    }

    async mergeAudioVideo(audioBuffer, videoBuffer) {
        const audioPath = path.join(this.tempDir, `audio_${Date.now()}.mp3`);
        const videoPath = path.join(this.tempDir, `video_${Date.now()}.mp4`);
        const outputPath = path.join(this.tempDir, `merged_${Date.now()}.mp4`);

        try {
            await Promise.all([
                fs.writeFile(audioPath, audioBuffer),
                fs.writeFile(videoPath, videoBuffer)
            ]);

            return new Promise((resolve, reject) => {
                ffmpeg()
                    .input(videoPath)
                    .input(audioPath)
                    .outputOptions(['-c:v copy', '-c:a aac', '-shortest'])
                    .on('end', async () => {
                        try {
                            const outputBuffer = await fs.readFile(outputPath);
                            await this.cleanupFiles([audioPath, videoPath, outputPath]);
                            resolve(outputBuffer);
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        reject(error);
                    })
                    .save(outputPath);
            });
        } catch (error) {
            await this.cleanupFiles([audioPath, videoPath, outputPath]);
            throw error;
        }
    }

    async cleanupFiles(filePaths) {
        for (const filePath of filePaths) {
            if (await fs.pathExists(filePath)) {
                await fs.remove(filePath);
            }
        }
    }

    async getMediaInfo(buffer) {
        try {
            const metadata = await sharp(buffer).metadata();
            return {
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                size: buffer.length,
                hasAlpha: metadata.hasAlpha
            };
        } catch {
            // Not an image, try to get video/audio info
            return {
                format: 'unknown',
                size: buffer.length
            };
        }
    }
}

// Media Processing Commands
module.exports = {
    name: 'media',
    version: '1.0.0',
    description: 'Advanced media processing and manipulation',
    category: 'media',
    cooldown: 10,

    commands: {
        rotate: {
            description: 'Rotate media',
            usage: '/media rotate <degrees>'
        },
        resize: {
            description: 'Resize media',
            usage: '/media resize <width>x<height>'
        },
        sticker: {
            description: 'Convert to sticker',
            usage: '/media sticker'
        },
        reverse: {
            description: 'Reverse media',
            usage: '/media reverse'
        },
        bass: {
            description: 'Adjust bass',
            usage: '/media bass <strength>'
        }
    },

    async execute({ message, args, sock, bot }) {
        const processor = new MediaProcessor(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            if (!message.reply_message) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('MEDIA.REPLY_REQUIRED')
                });
            }

            const mediaBuffer = await message.reply_message.downloadMediaMessage();
            if (!mediaBuffer) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('MEDIA.DOWNLOAD_FAILED')
                });
            }

            switch (subCommand) {
                case 'rotate':
                    return await this.handleRotate(message, args.slice(1), processor, mediaBuffer, sock);
                case 'resize':
                    return await this.handleResize(message, args.slice(1), processor, mediaBuffer, sock);
                case 'sticker':
                    return await this.handleSticker(message, processor, mediaBuffer, sock);
                case 'reverse':
                    return await this.handleReverse(message, processor, mediaBuffer, sock);
                case 'bass':
                    return await this.handleBass(message, args.slice(1), processor, mediaBuffer, sock);
                default:
                    return await this.showHelp(message, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Media command error: ${error.message}`);
        }
    },

    async handleRotate(message, args, processor, buffer, sock) {
        const degrees = parseInt(args[0]) || 90;
        
        try {
            const processedBuffer = await processor.processImage(buffer, 'rotate', { degrees });
            await sock.sendMessage(message.key.remoteJid, {
                image: processedBuffer,
                quoted: message
            });
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.ROTATE_FAILED')
            });
        }
    },

    async handleResize(message, args, processor, buffer, sock) {
        const dimensions = args[0]?.split('x');
        if (!dimensions || dimensions.length !== 2) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.RESIZE_FORMAT')
            });
        }

        const width = parseInt(dimensions[0]);
        const height = parseInt(dimensions[1]);

        try {
            const processedBuffer = await processor.processImage(buffer, 'resize', { width, height });
            await sock.sendMessage(message.key.remoteJid, {
                image: processedBuffer,
                quoted: message
            });
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.RESIZE_FAILED')
            });
        }
    },

    async handleSticker(message, processor, buffer, sock) {
        try {
            const isVideo = message.reply_message.video || message.reply_message.gif;
            const stickerBuffer = await processor.convertToSticker(buffer, isVideo);
            
            await sock.sendMessage(message.key.remoteJid, {
                sticker: stickerBuffer,
                quoted: message
            });
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.STICKER_FAILED')
            });
        }
    },

    async handleReverse(message, processor, buffer, sock) {
        try {
            let processedBuffer;
            if (message.reply_message.video) {
                processedBuffer = await processor.processVideo(buffer, 'reverse');
                await sock.sendMessage(message.key.remoteJid, {
                    video: processedBuffer,
                    quoted: message
                });
            } else if (message.reply_message.audio) {
                processedBuffer = await processor.processAudio(buffer, 'reverse');
                await sock.sendMessage(message.key.remoteJid, {
                    audio: processedBuffer,
                    quoted: message
                });
            } else {
                await sock.sendMessage(message.key.remoteJid, {
                    text: getString('MEDIA.REVERSE_UNSUPPORTED')
                });
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.REVERSE_FAILED')
            });
        }
    },

    async handleBass(message, args, processor, buffer, sock) {
        const strength = parseInt(args[0]) || 10;

        try {
            const processedBuffer = await processor.processAudio(buffer, 'bass', { strength });
            await sock.sendMessage(message.key.remoteJid, {
                audio: processedBuffer,
                quoted: message
            });
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.BASS_FAILED')
            });
        }
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Media Processing Commands*

*/media rotate <degrees>* - Rotate image/video
*/media resize <width>x<height>* - Resize image
*/media sticker* - Convert to sticker
*/media reverse* - Reverse audio/video
*/media bass <strength>* - Boost bass in audio
*/media treble <strength>* - Boost treble in audio
*/media compress* - Compress video

?? *Usage:* Reply to a media message with the command`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};