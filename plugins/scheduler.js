// GHOST-OFFICIAL-V1 Task Scheduler
// RAK Realm - Copyright RAK

const { getString } = require('../utils/language-system');

class TaskScheduler {
    constructor(bot) {
        this.bot = bot;
        this.logger = bot.logger;
        this.scheduledTasks = new Map();
        this.intervals = new Map();
    }

    async initialize() {
        this.logger.info('Initializing task scheduler...');
        // Load persistent scheduled tasks
    }

    async scheduleMute(jid, scheduleTime, duration) {
        const taskId = `mute-${jid}-${Date.now()}`;
        
        const task = {
            id: taskId,
            type: 'mute',
            jid: jid,
            scheduleTime: scheduleTime,
            duration: duration,
            created: Date.now(),
            status: 'scheduled'
        };

        this.scheduledTasks.set(taskId, task);
        this.setupTask(task);

        this.logger.info(`Mute scheduled for ${jid} at ${scheduleTime}`);
        return taskId;
    }

    async scheduleUnmute(jid, scheduleTime) {
        const taskId = `unmute-${jid}-${Date.now()}`;
        
        const task = {
            id: taskId,
            type: 'unmute',
            jid: jid,
            scheduleTime: scheduleTime,
            created: Date.now(),
            status: 'scheduled'
        };

        this.scheduledTasks.set(taskId, task);
        this.setupTask(task);

        this.logger.info(`Unmute scheduled for ${jid} at ${scheduleTime}`);
        return taskId;
    }

    async scheduleMessage(jid, scheduleTime, message) {
        const taskId = `message-${jid}-${Date.now()}`;
        
        const task = {
            id: taskId,
            type: 'message',
            jid: jid,
            scheduleTime: scheduleTime,
            message: message,
            created: Date.now(),
            status: 'scheduled'
        };

        this.scheduledTasks.set(taskId, task);
        this.setupTask(task);

        this.logger.info(`Message scheduled for ${jid} at ${scheduleTime}`);
        return taskId;
    }

    setupTask(task) {
        const now = Date.now();
        const scheduleTime = new Date(task.scheduleTime).getTime();
        const delay = scheduleTime - now;

        if (delay <= 0) {
            this.executeTask(task);
            return;
        }

        const timeout = setTimeout(() => {
            this.executeTask(task);
        }, delay);

        this.intervals.set(task.id, timeout);
    }

    async executeTask(task) {
        try {
            task.status = 'executing';
            
            switch (task.type) {
                case 'mute':
                    await this.executeMuteTask(task);
                    break;
                case 'unmute':
                    await this.executeUnmuteTask(task);
                    break;
                case 'message':
                    await this.executeMessageTask(task);
                    break;
            }

            task.status = 'completed';
            this.logger.info(`Task completed: ${task.id}`);

        } catch (error) {
            task.status = 'failed';
            task.error = error.message;
            this.logger.error(`Task failed: ${task.id} - ${error.message}`);
        }
    }

    async executeMuteTask(task) {
        // Implement group mute logic
        this.logger.info(`Executing mute task for ${task.jid}`);
        // Actual mute implementation would go here
    }

    async executeUnmuteTask(task) {
        // Implement group unmute logic
        this.logger.info(`Executing unmute task for ${task.jid}`);
        // Actual unmute implementation would go here
    }

    async executeMessageTask(task) {
        // Implement message sending logic
        this.logger.info(`Executing message task for ${task.jid}`);
        // Actual message sending would go here
    }

    async cancelTask(taskId) {
        const task = this.scheduledTasks.get(taskId);
        if (!task) return false;

        if (this.intervals.has(taskId)) {
            clearTimeout(this.intervals.get(taskId));
            this.intervals.delete(taskId);
        }

        task.status = 'cancelled';
        this.logger.info(`Task cancelled: ${taskId}`);
        return true;
    }

    async getTasks(jid = null) {
        if (jid) {
            return Array.from(this.scheduledTasks.values())
                .filter(task => task.jid === jid);
        }
        return Array.from(this.scheduledTasks.values());
    }

    async clearCompletedTasks() {
        let count = 0;
        
        for (const [taskId, task] of this.scheduledTasks.entries()) {
            if (task.status === 'completed' || task.status === 'failed') {
                this.scheduledTasks.delete(taskId);
                if (this.intervals.has(taskId)) {
                    clearTimeout(this.intervals.get(taskId));
                    this.intervals.delete(taskId);
                }
                count++;
            }
        }

        if (count > 0) {
            this.logger.info(`Cleared ${count} completed tasks`);
        }

        return count;
    }

    parseTimeInput(timeInput) {
        // Parse various time formats: "14:30", "2:30pm", "tomorrow 14:30", etc.
        const now = new Date();
        
        // Simple implementation - can be expanded
        if (timeInput.includes(':')) {
            const [hours, minutes] = timeInput.split(':').map(Number);
            const date = new Date(now);
            date.setHours(hours, minutes, 0, 0);
            
            // If time is in the past, schedule for tomorrow
            if (date <= now) {
                date.setDate(date.getDate() + 1);
            }
            
            return date;
        }
        
        throw new Error('Invalid time format');
    }
}

// Scheduler Commands
module.exports = {
    name: 'schedule',
    version: '1.0.0',
    description: 'Advanced task scheduling system',
    category: 'tools',
    cooldown: 5,

    commands: {
        mute: {
            description: 'Schedule group mute',
            usage: '/schedule mute HH:MM [duration]'
        },
        unmute: {
            description: 'Schedule group unmute',
            usage: '/schedule unmute HH:MM'
        },
        message: {
            description: 'Schedule message',
            usage: '/schedule message HH:MM "message"'
        },
        list: {
            description: 'List scheduled tasks',
            usage: '/schedule list'
        },
        cancel: {
            description: 'Cancel scheduled task',
            usage: '/schedule cancel <task-id>'
        }
    },

    async execute({ message, args, sock, bot }) {
        const scheduler = new TaskScheduler(bot);
        const subCommand = args[0]?.toLowerCase();

        try {
            switch (subCommand) {
                case 'mute':
                    return await this.scheduleMute(message, args.slice(1), scheduler, sock);
                case 'unmute':
                    return await this.scheduleUnmute(message, args.slice(1), scheduler, sock);
                case 'message':
                    return await this.scheduleMessage(message, args.slice(1), scheduler, sock);
                case 'list':
                    return await this.listTasks(message, scheduler, sock);
                case 'cancel':
                    return await this.cancelTask(message, args.slice(1), scheduler, sock);
                default:
                    return await this.showHelp(message, sock);
            }
        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('ERRORS.GENERIC')
            });
            bot.logger.error(`Schedule command error: ${error.message}`);
        }
    },

    async scheduleMute(message, args, scheduler, sock) {
        if (args.length < 1) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('SCHEDULE.MUTE_USAGE')
            });
        }

        if (!message.key.remoteJid.endsWith('@g.us')) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('SCHEDULE.ONLY_GROUPS')
            });
        }

        const timeInput = args[0];
        const duration = args[1] ? parseInt(args[1]) : 60; // Default 60 minutes

        try {
            const scheduleTime = scheduler.parseTimeInput(timeInput);
            const taskId = await scheduler.scheduleMute(message.key.remoteJid, scheduleTime, duration);

            await sock.sendMessage(message.key.remoteJid, {
                text: getString('SCHEDULE.MUTE_SCHEDULED', {
                    time: scheduleTime.toLocaleString(),
                    duration: duration
                })
            });

        } catch (error) {
            await sock.sendMessage(message.key.remoteJid, {
                text: getString('SCHEDULE.INVALID_TIME')
            });
        }
    },

    async scheduleUnmute(message, args, scheduler, sock) {
        // Similar implementation to scheduleMute
    },

    async scheduleMessage(message, args, scheduler, sock) {
        // Similar implementation to scheduleMute
    },

    async listTasks(message, scheduler, sock) {
        const tasks = await scheduler.getTasks(message.key.remoteJid);

        if (tasks.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('SCHEDULE.NO_TASKS')
            });
        }

        let listMessage = getString('SCHEDULE.TASK_LIST');
        tasks.forEach((task, index) => {
            listMessage += `\n${index + 1}. ${task.type} at ${new Date(task.scheduleTime).toLocaleString()} (${task.status})`;
        });

        await sock.sendMessage(message.key.remoteJid, { text: listMessage });
    },

    async cancelTask(message, args, scheduler, sock) {
        if (args.length === 0) {
            return await sock.sendMessage(message.key.remoteJid, {
                text: getString('SCHEDULE.CANCEL_USAGE')
            });
        }

        const taskId = args[0];
        const cancelled = await scheduler.cancelTask(taskId);

        await sock.sendMessage(message.key.remoteJid, {
            text: cancelled 
                ? getString('SCHEDULE.TASK_CANCELLED', { taskId })
                : getString('SCHEDULE.TASK_NOT_FOUND', { taskId })
        });
    },

    async showHelp(message, sock) {
        const helpText = `
? *Task Scheduler Commands*

*/schedule mute HH:MM [duration]* - Schedule group mute
*/schedule unmute HH:MM* - Schedule group unmute
*/schedule message HH:MM "message"* - Schedule message
*/schedule list* - List scheduled tasks
*/schedule cancel <task-id>* - Cancel scheduled task

?? *Time formats:* 14:30, 2:30pm, tomorrow 14:30
?? *Note:* Group commands work only in groups`;

        await sock.sendMessage(message.key.remoteJid, { text: helpText });
    }
};