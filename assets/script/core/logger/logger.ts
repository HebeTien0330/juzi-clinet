import { log } from "cc";

// log等级
export enum LOG {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
}

const LOG_LEVEL: { [index: number]: Array<String> } = {
    1: [LOG.ERROR],
    2: [LOG.ERROR, LOG.WARN],
    3: [LOG.ERROR, LOG.WARN, LOG.INFO],
    4: [LOG.ERROR, LOG.WARN, LOG.INFO, LOG.DEBUG],
}

export class Logger {

    private static _curLogLevel: Array<String>;

    constructor() {
        Logger._curLogLevel = LOG_LEVEL[4];
    }

    static setLogLevel(level: number) {
        Logger._curLogLevel = LOG_LEVEL[level];
    }

    static customLogLevel(logLevels: string[]) {
        for (const logLv of logLevels) {
            if (Logger._curLogLevel.includes(logLv)) {
                continue;
            }
            Logger._curLogLevel.push(logLv);
        }
    }

    // 格式化日志
    static formatLog(level: LOG, text: string): string {
        const now = new Date();
        const formattedText = `[${now.toLocaleString()}][${level}] ${text}`;
        return formattedText;
    }

    static async logfile(level: LOG, text: string) {
        const formattedText = this.formatLog(level, text);
        log(formattedText);
        await this.sendToRemoteLogServer(formattedText);
    }

    static handleLog() {
        // TODO: 如果需要将log序列化发送到服务器，由该方法实现
    }

    static async sendToRemoteLogServer(logEntry: string): Promise<void> {
        // TODO: 将日志发送到远程服务器
    }
}
