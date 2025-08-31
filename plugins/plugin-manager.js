// GHOST-OFFICIAL-V1 Plugin Manager
// RAK Realm - Copyright RAK

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const chalk = require('chalk');
const { getString } = require('../utils/language-system');

class PluginManager {
    constructor(bot) {
        this.bot = bot;
        this.plugins = new Map();
        this.pluginDir = path.join(__dirname, '../plugins');
        this.allowedOrigins = new Set(['github.com', 'gitlab.com', 'bitbucket.org']);
        
        this.logger = bot.logger;
    }

    async initialize() {
        try {
            this.logger.info('Initializing plugin system...');
            
            // Ensure plugin directory exists
            await fs.ensureDir(this.pluginDir);
            
            // Load existing plugins
            await this.loadPlugins();
            
            this.logger.success(`Plugin system ready. Loaded ${this.plugins.size} plugins`);
            
        } catch (error) {
            this.logger.error(`Plugin manager initialization failed: ${error.message}`);
        }
    }

    async loadPlugins() {
        try {
            const pluginFiles = (await fs.readdir(this.pluginDir)).filter(file => 
                file.endsWith('.js') && !file.startsWith('_')
            );

            for (const file of pluginFiles) {
                await this.loadPlugin(file);
            }
            
        } catch (error) {
            this.logger.error(`Error loading plugins: ${error.message}`);
        }
    }

    async loadPlugin(filename) {
        try {
            const pluginPath = path.join(this.pluginDir, filename);
            const pluginCode = await fs.readFile(pluginPath, 'utf8');
            
            // Security scan
            const securityScan = await this.scanPlugin(pluginCode, filename);
            if (!securityScan.safe) {
                this.logger.warn(`Skipping unsafe plugin: ${filename} - ${securityScan.reason}`);
                return;
            }

            // Load plugin
            const plugin = require(pluginPath);
            
            if (typeof plugin !== 'function') {
                throw new Error('Plugin must export a function');
            }

            // Initialize plugin
            const pluginInstance = plugin(this.bot);
            
            if (!pluginInstance.name || !pluginInstance.version) {
                throw new Error('Plugin must have name and version');
            }

            // Register plugin
            this.plugins.set(pluginInstance.name, {
                ...pluginInstance,
                filename,
                path: pluginPath,
                checksum: this.generateChecksum(pluginCode),
                loadedAt: new Date(),
                enabled: true
            });

            // Initialize plugin if it has init method
            if (typeof pluginInstance.initialize === 'function') {
                await pluginInstance.initialize();
            }

            this.logger.success(`Loaded plugin: ${pluginInstance.name} v${pluginInstance.version}`);
            
        } catch (error) {
            this.logger.error(`Error loading plugin ${filename}: ${error.message}`);
        }
    }

    async installPlugin(url, options = {}) {
        try {
            this.logger.info(`Installing plugin from: ${url}`);
            
            // Validate URL
            if (!this.validatePluginUrl(url)) {
                throw new Error('Plugin URL is not from allowed origin');
            }

            // Download plugin
            const pluginCode = await this.downloadPlugin(url);
            
            // Security scan
            const securityScan = await this.scanPlugin(pluginCode, url);
            if (!securityScan.safe) {
                throw new Error(`Plugin security check failed: ${securityScan.reason}`);
            }

            // Extract plugin metadata
            const metadata = this.extractPluginMetadata(pluginCode);
            const filename = `${metadata.name}.js`;
            const pluginPath = path.join(this.pluginDir, filename);

            // Save plugin
            await fs.writeFile(pluginPath, pluginCode, 'utf8');
            
            // Load plugin
            await this.loadPlugin(filename);

            // Save to installed plugins list
            await this.savePluginInfo({
                name: metadata.name,
                version: metadata.version,
                url,
                checksum: this.generateChecksum(pluginCode),
                installedAt: new Date()
            });

            return {
                success: true,
                plugin: metadata.name,
                version: metadata.version
            };
            
        } catch (error) {
            this.logger.error(`Plugin installation failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async uninstallPlugin(pluginName) {
        try {
            const plugin = this.plugins.get(pluginName);
            if (!plugin) {
                throw new Error('Plugin not found');
            }

            // Call plugin cleanup if available
            if (typeof plugin.cleanup === 'function') {
                await plugin.cleanup();
            }

            // Remove from memory
            this.plugins.delete(pluginName);
            
            // Remove file
            await fs.unlink(plugin.path);
            
            // Remove from installed list
            await this.removePluginInfo(pluginName);

            this.logger.success(`Uninstalled plugin: ${pluginName}`);
            return true;
            
        } catch (error) {
            this.logger.error(`Plugin uninstallation failed: ${error.message}`);
            return false;
        }
    }

    async scanPlugin(code, source) {
        const warnings = [];
        
        // Check for dangerous patterns
        const dangerousPatterns = [
            /eval\(/,
            /Function\(/,
            /require\(['"]\.\.\//,
            /process\.exit/,
            /fs\.rm/,
            /fs\.unlink/,
            /child_process/,
            /execSync/,
            /spawnSync/
        ];

        dangerousPatterns.forEach((pattern, index) => {
            if (pattern.test(code)) {
                warnings.push(`Dangerous pattern detected at line ${this.getLineNumber(code, pattern)}`);
            }
        });

        // Check for required structure
        if (!code.includes('module.exports') && !code.includes('export default')) {
            warnings.push('Plugin does not export properly');
        }

        return {
            safe: warnings.length === 0,
            warnings,
            reason: warnings.join(', ')
        };
    }

    validatePluginUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return this.allowedOrigins.has(parsedUrl.hostname);
        } catch {
            return false;
        }
    }

    async downloadPlugin(url) {
        // Implementation for downloading plugin code
        // Would use axios or got with proper error handling
        throw new Error('Download functionality not implemented');
    }

    extractPluginMetadata(code) {
        // Extract name and version from comments or code
        const nameMatch = code.match(/@name\s+([^\n]+)/);
        const versionMatch = code.match(/@version\s+([^\n]+)/);
        
        return {
            name: nameMatch ? nameMatch[1].trim() : 'unknown',
            version: versionMatch ? versionMatch[1].trim() : '1.0.0'
        };
    }

    generateChecksum(code) {
        return crypto.createHash('sha256').update(code).digest('hex');
    }

    getLineNumber(code, pattern) {
        const lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
                return i + 1;
            }
        }
        return -1;
    }

    async savePluginInfo(info) {
        const pluginsFile = path.join(__dirname, '../data/plugins.json');
        const plugins = await this.loadPluginInfo();
        
        plugins[info.name] = info;
        await fs.writeJson(pluginsFile, plugins, { spaces: 2 });
    }

    async removePluginInfo(pluginName) {
        const pluginsFile = path.join(__dirname, '../data/plugins.json');
        const plugins = await this.loadPluginInfo();
        
        delete plugins[pluginName];
        await fs.writeJson(pluginsFile, plugins, { spaces: 2 });
    }

    async loadPluginInfo() {
        try {
            const pluginsFile = path.join(__dirname, '../data/plugins.json');
            if (await fs.pathExists(pluginsFile)) {
                return await fs.readJson(pluginsFile);
            }
        } catch (error) {
            this.logger.warn('Could not load plugin info');
        }
        return {};
    }

    getPluginList() {
        return Array.from(this.plugins.values()).map(plugin => ({
            name: plugin.name,
            version: plugin.version,
            enabled: plugin.enabled,
            filename: plugin.filename
        }));
    }

    async enablePlugin(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (plugin) {
            plugin.enabled = true;
            return true;
        }
        return false;
    }

    async disablePlugin(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (plugin) {
            plugin.enabled = false;
            return true;
        }
        return false;
    }
}

module.exports = PluginManager;