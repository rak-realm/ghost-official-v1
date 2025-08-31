// GHOST-OFFICIAL-V1 
// RAK Realm - Copyright RAK

const { DataTypes } = require('sequelize');
const GhostDatabase = require('../rak-database');

const RakPlugins = GhostDatabase.define('RakPlugins', {
    pluginId: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    sourceUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
    },
    version: {
        type: DataTypes.STRING,
        defaultValue: '1.0.0',
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },
    author: {
        type: DataTypes.STRING,
        defaultValue: 'Unknown',
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    installedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'ghost_plugins',
    indexes: [
        {
            unique: true,
            fields: ['name']
        },
        {
            unique: true,
            fields: ['sourceUrl']
        }
    ]
});

class PluginManager {
    static async installPlugin(name, sourceUrl, author = 'Unknown', description = '') {
        try {
            const pluginId = `plugin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            return await RakPlugins.create({
                pluginId: pluginId,
                name: name,
                sourceUrl: sourceUrl,
                author: author,
                description: description
            });
        } catch (error) {
            throw new Error(`Failed to install plugin: ${error.message}`);
        }
    }

    static async getPlugin(identifier) {
        try {
            return await RakPlugins.findOne({
                where: {
                    [Op.or]: [
                        { name: identifier },
                        { pluginId: identifier },
                        { sourceUrl: identifier }
                    ]
                }
            });
        } catch (error) {
            throw new Error(`Failed to get plugin: ${error.message}`);
        }
    }

    static async getAllPlugins(activeOnly = false) {
        try {
            const whereClause = activeOnly ? { isActive: true } : {};
            
            return await RakPlugins.findAll({
                where: whereClause,
                order: [['name', 'ASC']]
            });
        } catch (error) {
            throw new Error(`Failed to get plugins: ${error.message}`);
        }
    }

    static async togglePlugin(identifier, isActive) {
        try {
            const plugin = await this.getPlugin(identifier);
            
            if (!plugin) {
                return null;
            }
            
            return await plugin.update({ 
                isActive: isActive,
                updatedAt: new Date()
            });
        } catch (error) {
            throw new Error(`Failed to toggle plugin: ${error.message}`);
        }
    }

    static async uninstallPlugin(identifier) {
        try {
            const result = await RakPlugins.destroy({
                where: {
                    [Op.or]: [
                        { name: identifier },
                        { pluginId: identifier },
                        { sourceUrl: identifier }
                    ]
                }
            });
            
            return result > 0;
        } catch (error) {
            throw new Error(`Failed to uninstall plugin: ${error.message}`);
        }
    }

    static async updatePlugin(identifier, updates) {
        try {
            const plugin = await this.getPlugin(identifier);
            
            if (!plugin) {
                return null;
            }
            
            return await plugin.update({
                ...updates,
                updatedAt: new Date()
            });
        } catch (error) {
            throw new Error(`Failed to update plugin: ${error.message}`);
        }
    }
}

module.exports = {
    RakPlugins,
    PluginManager
};