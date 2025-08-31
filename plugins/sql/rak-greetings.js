// GHOST-OFFICIAL-V1
// RAK Realm - Copyright RAK

const { DataTypes } = require('sequelize');
const GhostDatabase = require('../rak-database');

const RakGreetings = GhostDatabase.define('RakGreetings', {
    chatId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    greetingType: {
        type: DataTypes.ENUM('welcome', 'goodbye', 'banbye', 'custom'),
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },
    mediaUrl: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'ghost_greetings',
    indexes: [
        {
            unique: true,
            fields: ['chatId', 'greetingType']
        }
    ]
});

class GreetingManager {
    static async setGreeting(chatId, type, message, mediaUrl = null) {
        try {
            const [greeting, created] = await RakGreetings.upsert({
                chatId: chatId,
                greetingType: type,
                message: message,
                mediaUrl: mediaUrl,
                updatedAt: new Date()
            }, {
                returning: true
            });
            
            return { greeting, created };
        } catch (error) {
            throw new Error(`Failed to set greeting: ${error.message}`);
        }
    }

    static async getGreeting(chatId, type) {
        try {
            return await RakGreetings.findOne({
                where: { 
                    chatId: chatId, 
                    greetingType: type,
                    isActive: true 
                }
            });
        } catch (error) {
            throw new Error(`Failed to get greeting: ${error.message}`);
        }
    }

    static async toggleGreeting(chatId, type, isActive) {
        try {
            const greeting = await RakGreetings.findOne({
                where: { chatId: chatId, greetingType: type }
            });
            
            if (!greeting) {
                return null;
            }
            
            return await greeting.update({ 
                isActive: isActive,
                updatedAt: new Date()
            });
        } catch (error) {
            throw new Error(`Failed to toggle greeting: ${error.message}`);
        }
    }

    static async deleteGreeting(chatId, type) {
        try {
            const result = await RakGreetings.destroy({
                where: { chatId: chatId, greetingType: type }
            });
            
            return result > 0;
        } catch (error) {
            throw new Error(`Failed to delete greeting: ${error.message}`);
        }
    }

    static async getActiveGreetings(chatId) {
        try {
            return await RakGreetings.findAll({
                where: { 
                    chatId: chatId, 
                    isActive: true 
                },
                order: [['greetingType', 'ASC']]
            });
        } catch (error) {
            throw new Error(`Failed to get active greetings: ${error.message}`);
        }
    }
}

module.exports = {
    RakGreetings,
    GreetingManager
};