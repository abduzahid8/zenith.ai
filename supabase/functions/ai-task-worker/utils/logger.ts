export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG'
}

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    jobId?: string;
    userId?: string;
    data?: any;
}

export class Logger {
    private jobId?: string;
    private userId?: string;

    constructor(jobId?: string, userId?: string) {
        this.jobId = jobId;
        this.userId = userId;
    }

    private log(level: LogLevel, message: string, data?: any) {
        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            jobId: this.jobId,
            userId: this.userId,
            data
        };
        console.log(JSON.stringify(entry));
    }

    info(message: string, data?: any) {
        this.log(LogLevel.INFO, message, data);
    }

    warn(message: string, data?: any) {
        this.log(LogLevel.WARN, message, data);
    }

    error(message: string, data?: any) {
        this.log(LogLevel.ERROR, message, data);
    }

    debug(message: string, data?: any) {
        this.log(LogLevel.DEBUG, message, data);
    }

    static create(jobId?: string, userId?: string) {
        return new Logger(jobId, userId);
    }
}
