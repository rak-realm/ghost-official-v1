// GHOST-OFFICIAL-V1 Media Information
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');
const axios = require('axios');

class MediaInfo {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.apis = {
            'movie': this.getMovieInfo.bind(this),
            'tv': this.getTVInfo.bind(this),
            'music': this.getMusicInfo.bind(this),
            'book': this.getBookInfo.bind(this)
        };
    }

    async initialize() {
        this.logger.info('Initializing media information system...');
    }

    async getMediaInfo(query, type = 'movie') {
        try {
            if (!this.apis[type]) {
                throw new Error(`Unsupported media type: ${type}`);
            }

            return await this.apis[type](query);
        } catch (error) {
            this.logger.error(`Media info failed: ${error.message}`);
            throw error;
        }
    }

    async getMovieInfo(query) {
        try {
            const apiKey = this.bot.config.OMDB_API_KEY;
            if (!apiKey) {
                throw new Error('OMDB API key not configured');
            }

            const response = await axios.get(`http://www.omdbapi.com/`, {
                params: {
                    apikey: apiKey,
                    t: query,
                    plot: 'full',
                    r: 'json'
                },
                timeout: 10000
            });

            if (response.data.Response === 'False') {
                throw new Error(response.data.Error || 'Movie not found');
            }

            return this.formatMovieInfo(response.data);
        } catch (error) {
            throw new Error(`Movie info failed: ${error.message}`);
        }
    }

    formatMovieInfo(data) {
        return {
            success: true,
            type: 'movie',
            title: data.Title,
            year: data.Year,
            rated: data.Rated,
            released: data.Released,
            runtime: data.Runtime,
            genre: data.Genre,
            director: data.Director,
            writer: data.Writer,
            actors: data.Actors,
            plot: data.Plot,
            language: data.Language,
            country: data.Country,
            awards: data.Awards,
            ratings: data.Ratings,
            metascore: data.Metascore,
            imdbRating: data.imdbRating,
            imdbVotes: data.imdbVotes,
            imdbID: data.imdbID,
            type: data.Type,
            dvd: data.DVD,
            boxOffice: data.BoxOffice,
            production: data.Production,
            website: data.Website,
            poster: data.Poster
        };
    }

    async getTVInfo(query) {
        try {
            const apiKey = this.bot.config.OMDB_API_KEY;
            if (!apiKey) {
                throw new Error('OMDB API key not configured');
            }

            const response = await axios.get(`http://www.omdbapi.com/`, {
                params: {
                    apikey: apiKey,
                    t: query,
                    type: 'series',
                    plot: 'full',
                    r: 'json'
                },
                timeout: 10000
            });

            if (response.data.Response === 'False') {
                throw new Error(response.data.Error || 'TV show not found');
            }

            return this.formatTVInfo(response.data);
        } catch (error) {
            throw new Error(`TV info failed: ${error.message}`);
        }
    }

    formatTVInfo(data) {
        return {
            success: true,
            type: 'tv',
            title: data.Title,
            year: data.Year,
            rated: data.Rated,
            released: data.Released,
            runtime: data.Runtime,
            genre: data.Genre,
            director: data.Director,
            writer: data.Writer,
            actors: data.Actors,
            plot: data.Plot,
            language: data.Language,
            country: data.Country,
            awards: data.Awards,
            ratings: data.Ratings,
            metascore: data.Metascore,
            imdbRating: data.imdbRating,
            imdbVotes: data.imdbVotes,
            imdbID: data.imdbID,
            totalSeasons: data.totalSeasons,
            seasons: data.Season
        };
    }

    async getMusicInfo(query) {
        try {
            // This would integrate with Spotify/Last.fm API
            throw new Error('Music info not implemented');
        } catch (error) {
            throw new Error(`Music info failed: ${error.message}`);
        }
    }

    async getBookInfo(query) {
        try {
            // This would integrate with Google Books API
            throw new Error('Book info not implemented');
        } catch (error) {
            throw new Error(`Book info failed: ${error.message}`);
        }
    }

    async searchMedia(query, type = 'movie', year = '') {
        try {
            const apiKey = this.bot.config.OMDB_API_KEY;
            if (!apiKey) {
                throw new Error('OMDB API key not configured');
            }

            const response = await axios.get(`http://www.omdbapi.com/`, {
                params: {
                    apikey: apiKey,
                    s: query,
                    type: type,
                    y: year,
                    r: 'json'
                },
                timeout: 10000
            });

            if (response.data.Response === 'False') {
                throw new Error(response.data.Error || 'No results found');
            }

            return {
                success: true,
                results: response.data.Search,
                total: response.data.totalResults
            };
        } catch (error) {
            throw new Error(`Media search failed: ${error.message}`);
        }
    }

    async formatMediaInfo(mediaInfo) {
        let message = '';

        if (mediaInfo.type === 'movie') {
            message = this.formatMovieMessage(mediaInfo);
        } else if (mediaInfo.type === 'tv') {
            message = this.formatTVMessage(mediaInfo);
        }

        return message;
    }

    formatMovieMessage(movie) {
        let message = `?? *${movie.title}* (${movie.year})\n\n`;
        
        message += `?? *Released:* ${movie.released}\n`;
        message += `?? *Runtime:* ${movie.runtime}\n`;
        message += `?? *Genre:* ${movie.genre}\n`;
        message += `?? *Rated:* ${movie.rated}\n\n`;
        
        message += `?? *Director:* ${movie.director}\n`;
        message += `?? *Writer:* ${movie.writer}\n`;
        message += `?? *Cast:* ${movie.actors}\n\n`;
        
        message += `?? *Plot:* ${movie.plot}\n\n`;
        
        message += `?? *Country:* ${movie.country}\n`;
        message += `??? *Language:* ${movie.language}\n\n`;
        
        message += `?? *Awards:* ${movie.awards}\n`;
        message += `? *IMDb Rating:* ${movie.imdbRating}/10 (${movie.imdbVotes} votes)\n`;
        
        if (movie.metascore && movie.metascore !== 'N/A') {
            message += `?? *Metascore:* ${movie.metascore}/100\n`;
        }
        
        if (movie.boxOffice && movie.boxOffice !== 'N/A') {
            message += `?? *Box Office:* ${movie.boxOffice}\n`;
        }

        return message;
    }

    formatTVMessage(tvShow) {
        let message = `?? *${tvShow.title}* (${tvShow.year})\n\n`;
        
        message += `?? *Released:* ${tvShow.released}\n`;
        message += `?? *Runtime:* ${tvShow.runtime}\n`;
        message += `?? *Genre:* ${tvShow.genre}\n`;
        message += `?? *Rated:* ${tvShow.rated}\n\n`;
        
        message += `?? *Director:* ${tvShow.director}\n`;
        message += `?? *Writer:* ${tvShow.writer}\n`;
        message += `?? *Cast:* ${tvShow.actors}\n\n`;
        
        message += `?? *Plot:* ${tvShow.plot}\n\n`;
        
        message += `?? *Country:* ${tvShow.country}\n`;
        message += `??? *Language:* ${tvShow.language}\n\n`;
        
        message += `?? *Awards:* ${tvShow.awards}\n`;
        message += `? *IMDb Rating:* ${tvShow.imdbRating}/10 (${tvShow.imdbVotes} votes)\n`;
        
        if (tvShow.totalSeasons) {
            message += `?? *Seasons:* ${tvShow.totalSeasons}\n`;
        }

        return message;
    }

    async validateQuery(query, minLength = 2) {
        if (!query || query.length < minLength) {
            throw new Error(`Query too short (min ${minLength} characters)`);
        }
        return true;
    }
}

// Media Information Commands
module.exports = {
    name: 'media',
    version: '1.0.0',
    description: 'Advanced media information and database lookup',
    category: 'information',
    cooldown: 8,

    commands: {
        movie: {
            description: 'Get movie information',
            usage: '/media movie <title>'
        },
        tv: {
            description: 'Get TV show information',
            usage: '/media tv <title>'
        },
        search: {
            description: 'Search for media',
            usage: '/media search <query>'
        }
    },

    async execute({ message, args, sock, bot }) {
        const mediaInfo = new MediaInfo(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            switch (subCommand) {
                case 'movie':
                    return await this.getMovieInfo(message, args.slice(1), mediaInfo, sock);
                case 'tv':
                    return await this.getTVInfo(message, args.slice(1), mediaInfo, sock);
                case 'search':
                    return await this.searchMedia(message, args.slice(1), mediaInfo, sock);
                default:
                    return await this.getMovieInfo(message, args, mediaInfo, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Media command error: ${error.message}`);
        }
    },

    async getMovieInfo(message, args, mediaInfo, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.MOVIE_REQUIRED')
            });
        }

        const query = args.join(' ');
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('MEDIA.SEARCHING_MOVIE')
        });

        try {
            await mediaInfo.validateQuery(query);
            const movie = await mediaInfo.getMovieInfo(query);
            const messageText = mediaInfo.formatMovieMessage(movie);

            await sock.sendMessage(message.key.remoteJid, { text: messageText });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.MOVIE_FAILED', { error: error.message })
            });
        }
    },

    async getTVInfo(message, args, mediaInfo, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.TV_REQUIRED')
            });
        }

        const query = args.join(' ');
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('MEDIA.SEARCHING_TV')
        });

        try {
            await mediaInfo.validateQuery(query);
            const tvShow = await mediaInfo.getTVInfo(query);
            const messageText = mediaInfo.formatTVMessage(tvShow);

            await sock.sendMessage(message.key.remoteJid, { text: messageText });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.TV_FAILED', { error: error.message })
            });
        }
    },

    async searchMedia(message, args, mediaInfo, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.SEARCH_REQUIRED')
            });
        }

        const query = args.join(' ');
        await sock.sendMessage(message.key.remoteJid, {
            text: getString('MEDIA.SEARCHING')
        });

        try {
            await mediaInfo.validateQuery(query);
            const results = await mediaInfo.searchMedia(query);

            if (results.results.length === 0) {
                return await sock.sendMessage(message.key.remoteJid, {
                    text: getString('MEDIA.NO_RESULTS')
                });
            }

            let messageText = getString('MEDIA.SEARCH_RESULTS', {
                query: query,
                total: results.total
            });

            results.results.slice(0, 5).forEach((item, index) => {
                messageText += `\n\n${index + 1}. *${item.Title}* (${item.Year})`;
                messageText += `\n?? Type: ${item.Type}`;
                messageText += `\n?? IMDb: ${item.imdbID}`;
            });

            if (results.results.length > 5) {
                messageText += `\n\n... and ${results.results.length - 5} more results`;
            }

            await sock.sendMessage(message.key.remoteJid, { text: messageText });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('MEDIA.SEARCH_FAILED', { error: error.message })
            });
        }
    },

    async showHelp(message, sock) {
        const helpText = `
?? *Media Information Commands*

*/media movie <title>* - Get movie information
*/media tv <title>* - Get TV show information
*/media search <query>* - Search for media

?? *Examples:*
*/media movie Inception*
*/media tv Breaking Bad*
*/media search Avengers*

?? *Information Includes:*
• Title, Year, Rating
• Cast, Director, Plot
• Ratings, Awards, Box Office
• And much more!`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};