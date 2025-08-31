// GHOST-OFFICIAL-V1 Image Processor
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');

class ImageProcessor {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.services = {
            'removebg': this.removeBackground.bind(this),
            'upscale': this.upscaleImage.bind(this),
            'enhance': this.enhanceImage.bind(this),
            'style': this.applyStyle.bind(this)
        };
    }

    async initialize() {
        this.logger.info('Initializing image processor...');
    }

    async removeBackground(imageBuffer, options = {}) {
        try {
            if (!this.bot.config.REMOVEBG_KEY) {
                throw new Error('Remove.bg API key not configured');
            }

            const formData = new FormData();
            formData.append('image', imageBuffer, {
                filename: 'image.png',
                contentType: 'image/png'
            });
            
            if (options.size) formData.append('size', options.size);
            if (options.type) formData.append('type', options.type);

            const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
                headers: {
                    'X-Api-Key': this.bot.config.REMOVEBG_KEY,
                    ...formData.getHeaders()
                },
                responseType: 'arraybuffer',
                timeout: 30000
            });

            if (response.status !== 200) {
                throw new Error(`Remove.bg API error: ${response.status}`);
            }

            return {
                success: true,
                buffer: Buffer.from(response.data),
                format: 'png',
                credits: this.parseCredits(response.headers)
            };
        } catch (error) {
            if (error.response?.status === 402) {
                throw new Error('Remove.bg credits exhausted');
            } else if (error.response?.status === 403) {
                throw new Error('Invalid Remove.bg API key');
            }
            throw new Error(`Background removal failed: ${error.message}`);
        }
    }

    parseCredits(headers) {
        return {
            used: parseInt(headers['x-credits-charged']) || 0,
            remaining: parseInt(headers['x-credits-remaining']) || 0,
            total: parseInt(headers['x-credits-limit']) || 0
        };
    }

    async upscaleImage(imageBuffer, options = {}) {
        try {
            const scale = options.scale || 2;
            const metadata = await sharp(imageBuffer).metadata();

            // Check if image is too large for upscaling
            if (metadata.width * scale > 4000 || metadata.height * scale > 4000) {
                throw new Error('Image too large for upscaling');
            }

            const upscaledBuffer = await sharp(imageBuffer)
                .resize(Math.round(metadata.width * scale), Math.round(metadata.height * scale), {
                    kernel: sharp.kernel.lanczos3
                })
                .toBuffer();

            return {
                success: true,
                buffer: upscaledBuffer,
                originalSize: { width: metadata.width, height: metadata.height },
                newSize: { 
                    width: Math.round(metadata.width * scale), 
                    height: Math.round(metadata.height * scale) 
                }
            };
        } catch (error) {
            throw new Error(`Upscaling failed: ${error.message}`);
        }
    }

    async enhanceImage(imageBuffer, options = {}) {
        try {
            let image = sharp(imageBuffer);

            // Apply enhancements based on options
            if (options.brightness) {
                image = image.modulate({ brightness: options.brightness });
            }
            if (options.contrast) {
                image = image.linear(options.contrast, -(options.contrast * 128) + 128);
            }
            if (options.saturation) {
                image = image.modulate({ saturation: options.saturation });
            }
            if (options.sharpness) {
                image = image.sharpen(options.sharpness);
            }
            if (options.denoise) {
                image = image.blur(0.3); // Light blur for denoising
            }

            const enhancedBuffer = await image.toBuffer();

            return {
                success: true,
                buffer: enhancedBuffer,
                enhancements: options
            };
        } catch (error) {
            throw new Error(`Image enhancement failed: ${error.message}`);
        }
    }

    async applyStyle(imageBuffer, style) {
        try {
            let processedBuffer;

            switch (style) {
                case 'grayscale':
                    processedBuffer = await sharp(imageBuffer).grayscale().toBuffer();
                    break;
                case 'sepia':
                    processedBuffer = await sharp(imageBuffer).sepia().toBuffer();
                    break;
                case 'invert':
                    processedBuffer = await sharp(imageBuffer).negate().toBuffer();
                    break;
                case 'blur':
                    processedBuffer = await sharp(imageBuffer).blur(5).toBuffer();
                    break;
                case 'pixelate':
                    const metadata = await sharp(imageBuffer).metadata();
                    processedBuffer = await sharp(imageBuffer)
                        .resize(Math.round(metadata.width / 10), Math.round(metadata.height / 10), {
                            kernel: sharp.kernel.nearest
                        })
                        .resize(metadata.width, metadata.height, {
                            kernel: sharp.kernel.nearest
                        })
                        .toBuffer();
                    break;
                default:
                    throw new Error(`Unknown style: ${style}`);
            }

            return {
                success: true,
                buffer: processedBuffer,
                style: style
            };
        } catch (error) {
            throw new Error(`Style application failed: ${error.message}`);
        }
    }

    async compressImage(imageBuffer, options = {}) {
        try {
            const quality = options.quality || 80;
            const format = options.format || 'jpeg';

            const compressedBuffer = await sharp(imageBuffer)
                [format]({ quality: quality })
                .toBuffer();

            const originalSize = imageBuffer.length;
            const newSize = compressedBuffer.length;
            const reduction = ((originalSize - newSize) / originalSize) * 100;

            return {
                success: true,
                buffer: compressedBuffer,
                format: format,
                originalSize: originalSize,
                newSize: newSize,
                reduction: Math.round(reduction)
            };
        } catch (error) {
            throw new Error(`Image compression failed: ${error.message}`);
        }
    }

    async convertFormat(imageBuffer, format) {
        try {
            const supportedFormats = ['jpeg', 'png', 'webp', 'tiff', 'raw'];
            if (!supportedFormats.includes(format.toLowerCase())) {
                throw new Error(`Unsupported format: ${format}`);
            }

            const convertedBuffer = await sharp(imageBuffer)
                [format]()
                .toBuffer();

            return {
                success: true,
                buffer: convertedBuffer,
                format: format
            };
        } catch (error) {
            throw new Error(`Format conversion failed: ${error.message}`);
        }
    }

    async validateImage(buffer) {
        try {
            const metadata = await sharp(buffer).metadata();
            return {
                valid: true,
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                size: buffer.length,
                hasAlpha: metadata.hasAlpha
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    async getDominantColor(imageBuffer) {
        try {
            const { data, info } = await sharp(imageBuffer)
                .resize(1, 1)
                .raw()
                .toBuffer({ resolveWithObject: true });

            return {
                r: data[0],
                g: data[1],
                b: data[2],
                hex: `#${data[0].toString(16).padStart(2, '0')}${data[1].toString(16).padStart(2, '0')}${data[2].toString(16).padStart(2, '0')}`
            };
        } catch (error) {
            throw new Error(`Color extraction failed: ${error.message}`);
        }
    }
}

// Image Processing Commands
module.exports = {
    name: 'image',
    version: '1.0.0',
    description: 'Advanced image processing and manipulation',
    category: 'media',
    cooldown: 10,

    commands: {
        removebg: {
            description: 'Remove image background',
            usage: '/image removebg'
        },
        upscale: {
            description: 'Upscale image',
            usage: '/image upscale [scale]'
        },
        enhance: {
            description: 'Enhance image quality',
            usage: '/image enhance'
        },
        style: {
            description: 'Apply style to image',
            usage: '/image style <name>'
        },
        compress: {
            description: 'Compress image',
            usage: '/image compress [quality]'
        }
    },

    async execute({ message, args, sock, bot }) {
        const imageProcessor = new ImageProcessor(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            if (!message.reply_message || !message.reply_message.image) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('IMAGE.REPLY_REQUIRED')
                });
            }

            const imageBuffer = await message.reply_message.downloadMediaMessage();
            const validation = await imageProcessor.validateImage(imageBuffer);

            if (!validation.valid) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('IMAGE.INVALID_IMAGE')
                });
            }

            switch (subCommand) {
                case 'removebg':
                    return await this.removeBackground(message, imageProcessor, imageBuffer, sock);
                case 'upscale':
                    return await this.upscaleImage(message, args.slice(1), imageProcessor, imageBuffer, sock);
                case 'enhance':
                    return await this.enhanceImage(message, imageProcessor, imageBuffer, sock);
                case 'style':
                    return await this.applyStyle(message, args.slice(1), imageProcessor, imageBuffer, sock);
                case 'compress':
                    return await this.compressImage(message, args.slice(1), imageProcessor, imageBuffer, sock);
                default:
                    return await this.showHelp(message, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Image command error: ${error.message}`);
        }
    },

    async removeBackground(message, imageProcessor, imageBuffer, sock) {
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('IMAGE.REMOVING_BG')
        });

        try {
            const result = await imageProcessor.removeBackground(imageBuffer, {
                size: 'auto',
                type: 'auto'
            });

            await sock.sendMessage(message.key.remoteJid, {
                image: result.buffer,
                caption: getString('IMAGE.BG_REMOVED', {
                    credits: result.credits.used,
                    remaining: result.credits.remaining
                }),
                quoted: message
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('IMAGE.BG_REMOVE_FAILED', { error: error.message })
            });
        }
    },

    async upscaleImage(message, args, imageProcessor, imageBuffer, sock) {
        const scale = parseFloat(args[0]) || 2;
        
        if (scale < 1.1 || scale > 4) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('IMAGE.INVALID_SCALE')
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('IMAGE.UPSCALING', { scale })
        });

        try {
            const result = await imageProcessor.upscaleImage(imageBuffer, { scale });

            await sock.sendMessage(message.key.remoteJid, {
                image: result.buffer,
                caption: getString('IMAGE.UPSCALED', {
                    original: `${result.originalSize.width}x${result.originalSize.height}`,
                    new: `${result.newSize.width}x${result.newSize.height}`
                }),
                quoted: message
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('IMAGE.UPSCALE_FAILED', { error: error.message })
            });
        }
    },

    async enhanceImage(message, imageProcessor, imageBuffer, sock) {
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('IMAGE.ENHANCING')
        });

        try {
            const result = await imageProcessor.enhanceImage(imageBuffer, {
                brightness: 1.1,
                contrast: 1.1,
                saturation: 1.1,
                sharpness: 0.5,
                denoise: true
            });

            await sock.sendMessage(message.key.remoteJid, {
                image: result.buffer,
                caption: getString('IMAGE.ENHANCED'),
                quoted: message
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('IMAGE.ENHANCE_FAILED', { error: error.message })
            });
        }
    },

    async applyStyle(message, args, imageProcessor, imageBuffer, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('IMAGE.STYLE_REQUIRED')
            });
        }

        const style = args[0].toLowerCase();
        const supportedStyles = ['grayscale', 'sepia', 'invert', 'blur', 'pixelate'];

        if (!supportedStyles.includes(style)) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('IMAGE.INVALID_STYLE', { styles: supportedStyles.join(', ') })
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('IMAGE.APPLYING_STYLE', { style })
        });

        try {
            const result = await imageProcessor.applyStyle(imageBuffer, style);

            await sock.sendMessage(message.key.remoteJid, {
                image: result.buffer,
                caption: getString('IMAGE.STYLE_APPLIED', { style }),
                quoted: message
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('IMAGE.STYLE_FAILED', { error: error.message })
            });
        }
    },

    async compressImage(message, args, imageProcessor, imageBuffer, sock) {
        const quality = parseInt(args[0]) || 80;
        
        if (quality < 10 || quality > 100) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('IMAGE.INVALID_QUALITY')
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('IMAGE.COMPRESSING', { quality })
        });

        try {
            const result = await imageProcessor.compressImage(imageBuffer, {
                quality: quality,
                format: 'jpeg'
            });

            await sock.sendMessage(message.key.remoteJid, {
                image: result.buffer,
                caption: getString('IMAGE.COMPRESSED', {
                    reduction: result.reduction,
                    original: this.formatBytes(result.originalSize),
                    new: this.formatBytes(result.newSize)
                }),
                quoted: message
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('IMAGE.COMPRESS_FAILED', { error: error.message })
            });
        }
    },

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    async showHelp(message, sock) {
        const helpText = `
??? *Image Processing Commands*

*/image removebg* - Remove background (reply to image)
*/image upscale [2]* - Upscale image (1.1-4x)
*/image enhance* - Enhance image quality
*/image style <name>* - Apply style filter
*/image compress [80]* - Compress image (10-100 quality)

?? *Available Styles:*
grayscale, sepia, invert, blur, pixelate

?? *Note:* Some features may require API keys`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};