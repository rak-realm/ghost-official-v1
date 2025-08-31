// GHOST-OFFICIAL-V1 Content Fetcher
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const axios = require('axios');
const translate = require('translatte');
const yts = require('yt-search');
const ytdl = require('ytdl-core');
const wiki = require('wikijs').default;

class ContentFetcher {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.cache = new Map();
        this.services = {
            'youtube': this.searchYouTube.bind(this),
            'wikipedia': this.searchWikipedia.bind(this),
            'news': this.fetchNews.bind(this),
            'translate': this.translateText.bind(this),
            'images': this.searchImages.bind(this)
        };
    }

    async initialize() {
        this.logger.info('Initializing content fetcher...');
    }

    async searchYouTube(query, options = {}) {
        try {
            const searchResults = await yts(query);
            
            return {
                success: true,
                results: searchResults.all.slice(0, options.limit || 10),
                total: searchResults.all.length,
                query: query
            };
        } catch (error) {
            throw new Error(`YouTube search failed: ${error.message}`);
        }
    }

    async getYouTubeVideo(videoId) {
        try {
            if (!ytdl.validateID(videoId)) {
                throw new Error('Invalid YouTube video ID');
            }

            const videoInfo = await ytdl.getInfo(videoId);
            const formats = ytdl.filterFormats(videoInfo.formats, 'audioandvideo');

            return {
                success: true,
                video: videoInfo.videoDetails,
                formats: formats,
                duration: this.formatDuration(videoInfo.videoDetails.lengthSeconds)
            };
        } catch (error) {
            throw new Error(`YouTube video fetch failed: ${error.message}`);
        }
    }

    async searchWikipedia(query, options = {}) {
        try {
            const wikiClient = wiki({
                apiUrl: `https://${options.language || 'en'}.wikipedia.org/w/api.php`
            });

            const searchResults = await wikiClient.search(query, options.limit || 5);
            const pages = [];

            for (const title of searchResults.results) {
                const page = await wikiClient.page(title);
                const summary = await page.summary();
                pages.push({
                    title: page.raw.title,
                    url: page.raw.fullurl,
                    summary: summary.substring(0, 500) + '...',
                    length: page.raw.length
                });
            }

            return {
                success: true,
                results: pages,
                total: searchResults.totalhits,
                query: query
            };
        } catch (error) {
            throw new Error(`Wikipedia search failed: ${error.message}`);
        }
    }

    async fetchNews(category = 'general', options = {}) {
        try {
            // Using NewsAPI or similar service would require API key
            // This is a simplified implementation
            const newsSources = {
                'general': 'https://newsapi.org/v2/top-headlines',
                'technology': 'https://newsapi.org/v2/top-headlines?category=technology',
                'sports': 'https://newsapi.org/v2/top-headlines?category=sports',
                'entertainment': 'https://newsapi.org/v2/top-headlines?category=entertainment'
            };

            if (!newsSources[category]) {
                throw new Error(`Unsupported news category: ${category}`);
            }

            // This would actually call the NewsAPI with proper authentication
            throw new Error('News API requires authentication key');
        } catch (error) {
            throw new Error(`News fetch failed: ${error.message}`);
        }
    }

    async translateText(text, options = {}) {
        try {
            const from = options.from || 'auto';
            const to = options.to || 'en';

            const result = await translate(text, { from, to });

            return {
                success: true,
                original: text,
                translated: result.text,
                from: result.from.language.iso,
                to: to,
                confidence: result.from.language.confidence
            };
        } catch (error) {
            throw new Error(`Translation failed: ${error.message}`);
        }
    }

    async searchImages(query, options = {}) {
        try {
            // This would integrate with Google Images or similar service
            // Note: Google Images API requires authentication
            throw new Error('Image search requires API integration');
        } catch (error) {
            throw new Error(`Image search failed: ${error.message}`);
        }
    }

    async getWeather(location, options = {}) {
        try {
            // Weather API integration would go here
            // Requires weather service API key
            throw new Error('Weather service requires API key');
        } catch (error) {
            throw new Error(`Weather fetch failed: ${error.message}`);
        }
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    async getCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
            return cached.data;
        }
        return null;
    }

    async setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    async clearCache() {
        this.cache.clear();
        this.logger.info('Content cache cleared');
    }

    async validateQuery(query, minLength = 2, maxLength = 100) {
        if (!query || query.length < minLength) {
            throw new Error(`Query too short (min ${minLength} characters)`);
        }
        if (query.length > maxLength) {
            throw new Error(`Query too long (max ${maxLength} characters)`);
        }
        return true;
    }
}

// Content Fetcher Commands
module.exports = {
    name: 'fetch',
    version: '1.0.0',
    description: 'Advanced content fetching from various sources',
    category: 'tools',
    cooldown: 8,

    commands: {
        youtube: {
            description: 'Search YouTube',
            usage: '/fetch youtube <query>'
        },
        wiki: {
            description: 'Search Wikipedia',
            usage: '/fetch wiki <query>'
        },
        translate: {
            description: 'Translate text',
            usage: '/fetch translate <text> [to] [from]'
        },
        news: {
            description: 'Fetch news',
            usage: '/fetch news [category]'
        }
    },

    async execute({ message, args, sock, bot }) {
        const contentFetcher = new ContentFetcher(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            switch (subCommand) {
                case 'youtube':
                    return await this.searchYouTube(message, args.slice(1), contentFetcher, sock);
                case 'wiki':
                    return await this.searchWikipedia(message, args.slice(1), contentFetcher, sock);
                case 'translate':
                    return await this.translateText(message, args.slice(1), contentFetcher, sock);
                case 'news':
                    return await this.fetchNews(message, args.slice(1), contentFetcher, sock);
                default:
                    return await this.showHelp(message, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Fetch command error: ${error.message}`);
        }
    },

    async searchYouTube(message, args, contentFetcher, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('FETCH.QUERY_REQUIRED')
            });
        }

        const query = args.join(' ');
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('FETCH.SEARCHING_YOUTUBE')
        });

        try {
            await contentFetcher.validateQuery(query);
            const result = await contentFetcher.searchYouTube(query, { limit: 5 });

            if (result.results.length === 0) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('FETCH.NO_RESULTS')
                });
            }

            let response = getString('FETCH.YOUTUBE_RESULTS', {
                query: query,
                total: result.total
            });

            result.results.forEach((video, index) => {
                response += `\n\n${index + 1}. *${video.title}*`;
                response += `\n?? ${video.url}`;
                response += `\n?? ${contentFetcher.formatDuration(video.seconds)}`;
                response += `\n?? ${video.author.name}`;
            });

            await sock.sendMessage(message.key.remoteJid, { text: response });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('FETCH.YOUTUBE_FAILED', { error: error.message })
            });
        }
    },

    async searchWikipedia(message, args, contentFetcher, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('FETCH.QUERY_REQUIRED')
            });
        }

        const query = args.join(' ');
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('FETCH.SEARCHING_WIKI')
        });

        try {
            await contentFetcher.validateQuery(query);
            const result = await contentFetcher.searchWikipedia(query, { limit: 3 });

            if (result.results.length === 0) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('FETCH.NO_RESULTS')
                });
            }

            let response = getString('FETCH.WIKI_RESULTS', {
                query: query,
                total: result.total
            });

            result.results.forEach((page, index) => {
                response += `\n\n${index + 1}. *${page.title}*`;
                response += `\n${page.summary}`;
                response += `\n?? ${page.url}`;
            });

            await sock.sendMessage(message.key.remoteJid, { text: response });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('FETCH.WIKI_FAILED', { error: error.message })
            });
        }
    },

    async translateText(message, args, contentFetcher, sock) {
        let text = '';
        let toLang = 'en';
        let fromLang = 'auto';

        if (message.reply_message) {
            text = message.reply_message.text;
            // Parse language codes from args
            if (args.length >= 1) toLang = args[0];
            if (args.length >= 2) fromLang = args[1];
        } else {
            if (args.length < 1) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('FETCH.TRANSLATE_USAGE')
                });
            }
            text = args.join(' ');
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('FETCH.TRANSLATING')
        });

        try {
            await contentFetcher.validateQuery(text);
            const result = await contentFetcher.translateText(text, {
                from: fromLang,
                to: toLang
            });

            await sock.sendMessage(message.key.remoteJid, {
                text: getString('FETCH.TRANSLATION_RESULT', {
                    from: result.from.toUpperCase(),
                    to: result.to.toUpperCase(),
                    text: result.translated
                })
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('FETCH.TRANSLATE_FAILED', { error: error.message })
            });
        }
    },

    async fetchNews(message, args, contentFetcher, sock) {
        const category = args[0]?.toLowerCase() || 'general';
        const validCategories = ['general', 'technology', 'sports', 'entertainment'];

        if (!validCategories.includes(category)) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('FETCH.INVALID_CATEGORY', { categories: validCategories.join(', ') })
            });
        }

        await sock.sendMessage(message.key.remoteJid, {
            text: getString('FETCH.FETCHING_NEWS', { category })
        });

        try {
            // This would actually fetch news from an API
            throw new Error('News API requires authentication key');
            
            // const result = await contentFetcher.fetchNews(category);
            // News display logic would go here

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('FETCH.NEWS_FAILED', { error: error.message })
            });
        }
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Content Fetching Commands*

*/fetch youtube <query>* - Search YouTube videos
*/fetch wiki <query>* - Search Wikipedia
*/fetch translate <text> [to] [from]* - Translate text
*/fetch news [category]* - Fetch news headlines

?? *Supported Categories:*
general, technology, sports, entertainment

?? *Tip:* Reply to a message with /fetch translate to translate it`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};