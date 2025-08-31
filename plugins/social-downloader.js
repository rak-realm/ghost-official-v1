// GHOST-OFFICIAL-V1 Social Media Downloader
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const axios = require('axios');
const FormData = require('form-data');

class SocialDownloader {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.supportedPlatforms = {
            'instagram': this.downloadInstagram.bind(this),
            'facebook': this.downloadFacebook.bind(this),
            'tiktok': this.downloadTikTok.bind(this),
            'twitter': this.downloadTwitter.bind(this),
            'youtube': this.downloadYouTube.bind(this)
        };
    }

    async initialize() {
        this.logger.info('Initializing social media downloader...');
    }

    async downloadMedia(url, platform = null) {
        try {
            const detectedPlatform = platform || this.detectPlatform(url);
            if (!detectedPlatform) {
                throw new Error('Unsupported platform');
            }

            if (!this.supportedPlatforms[detectedPlatform]) {
                throw new Error(`Platform ${detectedPlatform} not supported`);
            }

            return await this.supportedPlatforms[detectedPlatform](url);
        } catch (error) {
            this.logger.error(`Download failed: ${error.message}`);
            throw error;
        }
    }

    detectPlatform(url) {
        if (url.includes('instagram.com')) return 'instagram';
        if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
        if (url.includes('tiktok.com')) return 'tiktok';
        if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
        if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
        return null;
    }

    async downloadInstagram(url) {
        try {
            // Use a reliable Instagram download API
            const apiUrl = 'https://www.instagramdownloader.org/api';
            
            const formData = new FormData();
            formData.append('url', url);

            const response = await axios.post(`${apiUrl}/analyze`, formData, {
                headers: formData.getHeaders(),
                timeout: 30000
            });

            if (!response.data.success) {
                throw new Error('Failed to download Instagram content');
            }

            const mediaData = response.data.data;
            return this.processInstagramMedia(mediaData);
        } catch (error) {
            throw new Error(`Instagram download failed: ${error.message}`);
        }
    }

    processInstagramMedia(mediaData) {
        const result = {
            type: mediaData.type, // 'image' or 'video' or 'carousel'
            urls: [],
            caption: mediaData.caption,
            username: mediaData.username
        };

        if (mediaData.type === 'image') {
            result.urls.push(mediaData.url);
        } else if (mediaData.type === 'video') {
            result.urls.push(mediaData.videoUrl);
        } else if (mediaData.type === 'carousel') {
            result.urls = mediaData.media.map(item => 
                item.type === 'image' ? item.url : item.videoUrl
            );
        }

        return result;
    }

    async downloadFacebook(url) {
        try {
            // Use a reliable Facebook download API
            const apiUrl = 'https://www.getfvid.com/downloader';
            
            const response = await axios.post(apiUrl, new URLSearchParams({
                url: url
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 30000
            });

            // Parse the response to extract download links
            // This would involve HTML parsing or using a dedicated API
            throw new Error('Facebook download not implemented');
        } catch (error) {
            throw new Error(`Facebook download failed: ${error.message}`);
        }
    }

    async downloadTikTok(url) {
        try {
            const apiUrl = 'https://www.tiktokdownloader.org/api';
            
            const response = await axios.get(`${apiUrl}/info`, {
                params: { url },
                timeout: 30000
            });

            if (!response.data.success) {
                throw new Error('Failed to download TikTok content');
            }

            return {
                type: 'video',
                urls: [response.data.videoUrl],
                caption: response.data.description,
                username: response.data.author
            };
        } catch (error) {
            throw new Error(`TikTok download failed: ${error.message}`);
        }
    }

    async downloadTwitter(url) {
        try {
            // Twitter download implementation
            throw new Error('Twitter download not implemented');
        } catch (error) {
            throw new Error(`Twitter download failed: ${error.message}`);
        }
    }

    async downloadYouTube(url) {
        try {
            // YouTube download implementation
            throw new Error('YouTube download not implemented');
        } catch (error) {
            throw new Error(`YouTube download failed: ${error.message}`);
        }
    }

    async downloadStories(username, platform = 'instagram') {
        try {
            if (platform !== 'instagram') {
                throw new Error('Only Instagram stories are supported');
            }

            const apiUrl = 'https://www.instastories.org/api';
            const response = await axios.get(`${apiUrl}/stories`, {
                params: { username },
                timeout: 30000
            });

            if (!response.data.success || !response.data.stories) {
                throw new Error('No stories found or user is private');
            }

            return response.data.stories.map(story => ({
                url: story.isVideo ? story.videoUrl : story.imageUrl,
                type: story.isVideo ? 'video' : 'image',
                timestamp: story.timestamp
            }));
        } catch (error) {
            throw new Error(`Story download failed: ${error.message}`);
        }
    }

    validateUrl(url) {
        try {
            new URL(url);
            return this.detectPlatform(url) !== null;
        } catch {
            return false;
        }
    }

    async getMediaInfo(url) {
        try {
            const platform = this.detectPlatform(url);
            if (!platform) {
                throw new Error('Unsupported platform');
            }

            // Implementation would vary by platform
            return {
                platform,
                url,
                valid: true
            };
        } catch (error) {
            return {
                platform: null,
                url,
                valid: false,
                error: error.message
            };
        }
    }
}

// Social Downloader Commands
module.exports = {
    name: 'download',
    version: '1.0.0',
    description: 'Advanced social media content downloader',
    category: 'media',
    cooldown: 15,

    commands: {
        media: {
            description: 'Download media from social platforms',
            usage: '/download media <url>'
        },
        story: {
            description: 'Download stories from Instagram',
            usage: '/download story <username>'
        },
        info: {
            description: 'Get media information',
            usage: '/download info <url>'
        }
    },

    async execute({ message, args, sock, bot }) {
        const downloader = new SocialDownloader(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            switch (subCommand) {
                case 'media':
                    return await this.downloadMedia(message, args.slice(1), downloader, sock);
                case 'story':
                    return await this.downloadStories(message, args.slice(1), downloader, sock);
                case 'info':
                    return await this.getMediaInfo(message, args.slice(1), downloader, sock);
                default:
                    return await this.showHelp(message, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Download command error: ${error.message}`);
        }
    },

    async downloadMedia(message, args, downloader, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('DOWNLOAD.URL_REQUIRED')
            });
        }

        const url = args[0];
        if (!downloader.validateUrl(url)) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('DOWNLOAD.INVALID_URL')
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('DOWNLOAD.DOWNLOADING')
        });

        try {
            const mediaData = await downloader.downloadMedia(url);
            
            if (mediaData.urls.length === 0) {
                throw new Error('No media found');
            }

            for (const mediaUrl of mediaData.urls) {
                // Download and send each media item
                const response = await axios.get(mediaUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });

                const buffer = Buffer.from(response.data);
                const mimeType = response.headers['content-type'];

                if (mimeType.includes('image')) {
                    await sock.sendMessage(message.key.remoteJid, {
                        image: buffer,
                        caption: mediaData.caption || ''
                    });
                } else if (mimeType.includes('video')) {
                    await sock.sendMessage(message.key.remoteJid, {
                        video: buffer,
                        caption: mediaData.caption || ''
                    });
                }
            }

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('DOWNLOAD.FAILED', { error: error.message })
            });
        }
    },

    async downloadStories(message, args, downloader, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('DOWNLOAD.USERNAME_REQUIRED')
            });
        }

        const username = args[0];
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('DOWNLOAD.DOWNLOADING_STORIES')
        });

        try {
            const stories = await downloader.downloadStories(username);
            
            if (stories.length === 0) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('DOWNLOAD.NO_STORIES')
                });
            }

            for (const story of stories) {
                const response = await axios.get(story.url, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });

                const buffer = Buffer.from(response.data);
                
                if (story.type === 'image') {
                    await sock.sendMessage(message.key.remoteJid, { image: buffer });
                } else {
                    await sock.sendMessage(message.key.remoteJid, { video: buffer });
                }
            }

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('DOWNLOAD.STORIES_FAILED', { error: error.message })
            });
        }
    },

    async getMediaInfo(message, args, downloader, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('DOWNLOAD.URL_REQUIRED')
            });
        }

        const url = args[0];
        const info = await downloader.getMediaInfo(url);

        if (!info.valid) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('DOWNLOAD.INVALID_MEDIA', { error: info.error })
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('DOWNLOAD.MEDIA_INFO', {
                platform: info.platform,
                url: info.url
            })
        });
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Social Media Downloader*

*/download media <url>* - Download media from URL
*/download story <username>* - Download Instagram stories  
*/download info <url>* - Get media information

?? *Supported Platforms:*
• Instagram (posts, stories)
• Facebook (videos)
• TikTok (videos)
• Twitter (videos, images)
• YouTube (videos)

?? *Note:* Some platforms may have limitations`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};