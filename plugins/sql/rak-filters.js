// GHOST-OFFICIAL-V1 
// RAK Realm - Copyright RAK

const { DataTypes } = require('sequelize');
const GhostDatabase = require('../rak-database');

const RakFilters = GhostDatabase.define('RakFilters', {
    chatId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    pattern: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    response: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    isRegex: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    createdBy: {
        type: DataTypes.STRING,
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'ghost_filters',
    indexes: [
        {
            unique: true,
            fields: ['chatId', 'pattern']
        }
    ]
});

class FilterManager {
    static async createFilter(chatId, pattern, response, isRegex = false, creator) {
        try {
            return await RakFilters.create({
                chatId: chatId,
                pattern: pattern,
                response: response,
                isRegex: isRegex,
                createdBy: creator
            });
        } catch (error) {
            throw new Error(`Failed to create filter: ${error.message}`);
        }
    }

    static async getFilters(chatId, pattern = null) {
        try {
            const whereClause = { chatId: chatId };
            if (pattern) {
                whereClause.pattern = pattern;
            }
            
            return await RakFilters.findAll({
                where: whereClause,
                order: [['createdAt', 'DESC']]
            });
        } catch (error) {
            throw new Error(`Failed to get filters: ${error.message}`);
        }
    }

    static async updateFilter(chatId, pattern, updates) {
        try {
            const filter = await RakFilters.findOne({
                where: { chatId: chatId, pattern: pattern }
            });
            
            if (!filter) {
                return null;
            }
            
            return await filter.update(updates);
        } catch (error) {
            throw new Error(`Failed to update filter: ${error.message}`);
        }
    }

    static async deleteFilter(chatId, pattern) {
        try {
            const result = await RakFilters.destroy({
                where: { chatId: chatId, pattern: pattern }
            });
            
            return result > 0;
        } catch (error) {
            throw new Error(`Failed to delete filter: ${error.message}`);
        }
    }

    static async clearChatFilters(chatId) {
        try {
            const result = await RakFilters.destroy({
                where: { chatId: chatId }
            });
            
            return result;
        } catch (error) {
            throw new Error(`Failed to clear filters: ${error.message}`);
        }
    }
}

module.exports = {
    RakFilters,
    FilterManager
};