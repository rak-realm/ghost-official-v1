// GHOST-OFFICIAL-V1 QR System
// RAK Realm - Copyright RAK

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const config = require('./config');

class QRSystem {
    constructor() {
        this.sessionDir = path.join(__dirname, 'session');
        this.qrGenerated = false;
        this.connection = null;
        this.authState = null;
        this.connectionUpdateHandler = this.handleConnectionUpdate.bind(this); // Bind the handler for proper removal
    }

    async initialize() {
        try {
            // Ensure session directory exists
            await fs.ensureDir(this.sessionDir);
            
            console.log(chalk.blue.bold('🔐 Initializing Secure QR System...'));
            console.log(chalk.gray('→ Session directory: ' + this.sessionDir));

            // Load or create auth state
            this.authState = await useMultiFileAuthState(this.sessionDir);
            
            return true;
        } catch (error) {
            console.log(chalk.red.bold('❌ QR System initialization failed:'), error.message);
            return false;
        }
    }

    handleConnectionUpdate(update) {
        const { connection, qr } = update;

        if (qr && !this.qrGenerated) {
            this.qrGenerated = true;
            
            // Generate QR in terminal
            qrcode.generate(qr, { small: true });
            
            console.log(chalk.cyan.bold('\n🔒 Security Notice:'));
            console.log(chalk.gray('• This QR code expires in 60 seconds'));
            console.log(chalk.gray('• Never share your QR code with anyone'));
            console.log(chalk.gray('• Scan only with your personal device\n'));
        }

        if (connection === 'open') {
            console.log(chalk.green.bold('✅ Successfully connected to WhatsApp!'));
            console.log(chalk.gray('→ Session secured and encrypted'));
            this.qrGenerated = false;
        }

        if (connection === 'close') {
            console.log(chalk.yellow.bold('⚠️ Connection closed. Reinitializing...'));
            this.reinitialize(); // Call reinitialize without await to avoid blocking
        }
    }

    async generateQR() {
        try {
            if (this.qrGenerated) {
                console.log(chalk.yellow.bold('⚠️ QR already generated. Waiting for scan...'));
                return;
            }

            console.log(chalk.green.bold('\n✨ Generating Secure QR Code...'));
            console.log(chalk.gray('📱 Open WhatsApp → Linked Devices → Scan QR Code\n'));

            this.connection = makeWASocket({
                auth: this.authState.state,
                printQRInTerminal: true,
                logger: { level: 'silent' }, // Reduced logging for security
                browser: ['GHOST-OFFICIAL-V1', 'Chrome', '1.0.0']
            });

            // Add the event listener and store a reference for removal
            this.connection.ev.on('connection.update', this.connectionUpdateHandler);

            // Save credentials when updated
            this.connection.ev.on('creds.update', this.authState.saveCreds);

            return true;

        } catch (error) {
            console.log(chalk.red.bold('❌ QR Generation failed:'), error.message);
            return false;
        }
    }

    async reinitialize() {
        try {
            // Clean up old connection: remove listeners and end connection
            if (this.connection) {
                this.connection.ev.off('connection.update', this.connectionUpdateHandler);
                this.connection.ev.off('creds.update', this.authState.saveCreds);
                await this.connection.end();
                this.connection = null;
            }

            // Reinitialize auth state
            this.authState = await useMultiFileAuthState(this.sessionDir);
            this.qrGenerated = false;

            // Generate new QR
            await this.generateQR();

        } catch (error) {
            console.log(chalk.red.bold('❌ Reinitialization failed:'), error.message);
        }
    }

    async backupSession() {
        try {
            const backupDir = path.join(__dirname, 'backups');
            await fs.ensureDir(backupDir);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, `session-backup-${timestamp}.zip`);
            
            // Create backup - Using archiver would require installing the 'archiver' package
            // For now, we'll just copy the session directory
            await fs.copy(this.sessionDir, backupPath);
            console.log(chalk.blue.bold('📦 Created session backup at: ' + backupPath));
            
            return backupPath;
        } catch (error) {
            console.log(chalk.red.bold('❌ Session backup failed:'), error.message);
            return null;
        }
    }

    async restoreSession(backupPath) {
        try {
            if (!await fs.pathExists(backupPath)) {
                throw new Error('Backup file not found');
            }

            console.log(chalk.blue.bold('🔄 Restoring session from backup...'));
            
            // Clear current session
            await fs.emptyDir(this.sessionDir);
            
            // Restore from backup - copy the backup to session directory
            await fs.copy(backupPath, this.sessionDir);
            console.log(chalk.green.bold('✅ Session restored successfully'));
            
            return true;
        } catch (error) {
            console.log(chalk.red.bold('❌ Session restore failed:'), error.message);
            return false;
        }
    }

    getSessionInfo() {
        try {
            const files = fs.readdirSync(this.sessionDir);
            return {
                sessionExists: files.length > 0,
                fileCount: files.length,
                files: files
            };
        } catch (error) {
            return { sessionExists: false, error: error.message };
        }
    }

    async clearSession() {
        try {
            await fs.emptyDir(this.sessionDir);
            console.log(chalk.green.bold('✅ Session cleared successfully'));
            return true;
        } catch (error) {
            console.log(chalk.red.bold('❌ Session clearance failed:'), error.message);
            return false;
        }
    }
}

// Export singleton instance
const qrSystem = new QRSystem();

module.exports = {
    QRSystem,
    instance: qrSystem
};
