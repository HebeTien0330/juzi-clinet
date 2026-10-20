import { LOG, Logger } from "@game/core/logger/logger";
import { Box } from "@game/core/box/Box";

export enum TIMER_MODE {
    S   = 1,        // 秒
    MS  = 2,        // 分秒
    HMS = 3,        // 时分秒
}

export enum TIMER_STATE {
    GOING = 1,
    PAUSE = 2,
}

export enum TIMER_FREQUENCY {
    MS = 1,         // 毫秒
    S  = 1000,      // 秒
}

interface ITimerData {
    taskList: Map<string, { timeoutId: ReturnType<typeof setTimeout> | null, callback: Function }>;
    countdown: Map<string, { intervalId: ReturnType<typeof setInterval>, mode: number, state: TIMER_STATE, callback: Function, remain: number }>;
    tickList: Map<string, { intervalId: ReturnType<typeof setInterval>, mode: number, state: TIMER_STATE, callback: Function, elapsedTime: number }>;
}

const translateTime = (timestamp: number, mode: number): string => {
    let [hours, mins, secs] = [0, 0, 0];
    switch (mode) {
        case TIMER_MODE.S:
            return `${timestamp}`;
        case TIMER_MODE.MS:
            mins = Math.floor(timestamp / 60);
            secs = timestamp % 60;
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        case TIMER_MODE.HMS:
            hours = Math.floor(timestamp / 3600);
            mins = Math.floor((timestamp - hours * 3600) / 60);
            secs = timestamp % 60;
            return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        default:
            Logger.logfile(LOG.ERROR, "unknown time mode!");
            return "";    
    }
}

const transTimeStamp = (ts: number, mode: number) => {
    if (ts == null) {
        return "99:99:99:999";
    }
    let totalSeconds = null;
    let milliseconds = null;
    switch (mode) {
        case TIMER_FREQUENCY.MS:
            totalSeconds = Math.floor(ts / 1000);
            milliseconds = ts % 1000;
            break;
        case TIMER_FREQUENCY.S:
            totalSeconds = ts;
            break;
        default:
            Logger.logfile(LOG.ERROR, "unknown time mode!");
    }
    if (totalSeconds == null) {
        return "99:99:99:999";
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const res = [
        hours.toString().padStart(2, '0'),
        minutes.toString().padStart(2, '0'),
        seconds.toString().padStart(2, '0'),
    ];
    if (milliseconds != null) {
        res.push(milliseconds.toString().padStart(3, '0'));
    }

    return res.join(':');
}

export class Timer {

    data: ITimerData;     // { taskList: { name: [timestamp: function] }}

    static getTimer() {
        return Box.get(Timer);
    }

    constructor() {
        this.data = {
            taskList: new Map(),
            countdown: new Map(),
            tickList: new Map(),
        };
    }

    setTimeout(name: string, timeout: number, callback: Function, repeat?: number, interval?: number): void {     // repeat
        if (this.data.taskList.get(name)) {
            Logger.logfile(LOG.WARN, "timer task name repeat!");
            return;
        }
        const delayMs = Math.max(0, timeout) * 1000;
        if (!repeat || repeat <= 0) {
            // Logger.logfile(LOG.INFO, `start a timer task named ${name} for ${timeout}s`);
            const wpCallback = () => {
                this.data.taskList.delete(name);
                callback();
            };
            const timeoutId = setTimeout(wpCallback, delayMs);
            this.data.taskList.set(name, { timeoutId, callback: wpCallback });
            return;
        }
        // Logger.logfile(LOG.INFO, `start a timer task named ${name} for ${timeout}s repeat ${repeat} times and interval ${interval}`);
        const intervalMs = Math.max(0, interval ?? 0) * 1000;
        let remain = repeat + 1;
        const wpCallback = () => {
            const task = this.data.taskList.get(name);
            if (!task) {
                return;
            }
            callback();
            remain--;
            if (remain <= 0) {
                this.data.taskList.delete(name);
                return;
            }
            task.timeoutId = setTimeout(wpCallback, intervalMs);
        };
        const timeoutId = setTimeout(wpCallback, delayMs);
        this.data.taskList.set(name, { timeoutId, callback: wpCallback });
    }

    removeTimeout(name: string) {
        const task = this.data.taskList.get(name);
        if (!task) {
            Logger.logfile(LOG.WARN, `timer task ${name} does not exist`);
            return;
        }
        // Logger.logfile(LOG.INFO, `remove timer task ${name}`);
        if (task.timeoutId != null) {
            clearTimeout(task.timeoutId);
        }
        this.data.taskList.delete(name);
    }

    startCountDown(name: string, seconds: number, callback: Function, mode?: number) {
        if (this.data.countdown.get(name)) {
            Logger.logfile(LOG.WARN, "countdown task name repeat!");
            return;
        }
        if (mode == null) {
            mode = TIMER_MODE.MS;
        }
        // Logger.logfile(LOG.INFO, `start a countdown task named ${name} for ${seconds}s on ${mode} mode`);
        const intervalId = setInterval(() => {
            if (seconds <= 0) {
                this.stopCountDown(name);
                return;
            }
            seconds--;
            const config = this.data.countdown.get(name);
            if (!config) {
                return;
            }
            config.remain = seconds;
            const timeString = translateTime(seconds, mode);
            callback(timeString);
        }, 1000);
        const config = { intervalId, mode, state: TIMER_STATE.GOING, callback, remain: seconds };
        this.data.countdown.set(name, config);
    }

    pauseCountDown(name: string) {
        const config = this.data.countdown.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `countdown task ${name} does not exist!`);
            return;
        }
        if (config.state == TIMER_STATE.PAUSE) {
            Logger.logfile(LOG.WARN, `countdown task ${name} is already paused!`);
            return;
        }
        // Logger.logfile(LOG.INFO, `pause countdown task ${name}`);
        clearInterval(config.intervalId);
        config.state = TIMER_STATE.PAUSE;
    }

    resumeCountDown(name: string) {
        const config = this.data.countdown.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `countdown task ${name} does not exist!`);
            return;
        }
        if (config.state == TIMER_STATE.GOING) {
            Logger.logfile(LOG.WARN, `countdown task ${name} is already going!`);
            return;
        }
        // Logger.logfile(LOG.INFO, `resume countdown task ${name}`);
        const { remain, callback, mode } = config;
        this.stopCountDown(name);
        this.startCountDown(name, remain, callback, mode);
    }

    stopCountDown(name: string) {
        const config = this.data.countdown.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `countdown task ${name} does not exist!`);
            return;
        }
        clearInterval(config.intervalId);
        this.data.countdown.delete(name);
    }

    startTick(name: string, elapsedTime: number, callback: Function, mode?: number) {
        if (this.data.tickList.get(name)) {
            Logger.logfile(LOG.WARN, "tick task name repeat!");
            return;
        }
        if (mode == null) {
            mode = TIMER_FREQUENCY.MS;
        }
        // Logger.logfile(LOG.INFO, `start a tick task named ${name} for ${elapsedTime} ms/s`);
        let elapsedMs = mode === TIMER_FREQUENCY.S ? elapsedTime * 1000 : elapsedTime;
        let lastUpdateTime = Date.now();
        const updateFrequency = mode;
        const intervalId = setInterval(() => {
            const currentTime = Date.now();
            const deltaTime = currentTime - lastUpdateTime;
            lastUpdateTime = currentTime;
            elapsedMs += deltaTime;
            const config = this.data.tickList.get(name);
            if (!config) {
                return;
            }
            const elapsed = mode === TIMER_FREQUENCY.S ? Math.floor(elapsedMs / 1000) : elapsedMs;
            config.elapsedTime = elapsed;
            callback(transTimeStamp(elapsed, mode));
        }, updateFrequency);
        const config = { intervalId, mode, state: TIMER_STATE.GOING, callback, elapsedTime };
        this.data.tickList.set(name, config);
    }

    pauseTick(name: string) {
        const config = this.data.tickList.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `tick task ${name} does not exist!`);
            return;
        }
        if (config.state == TIMER_STATE.PAUSE) {
            Logger.logfile(LOG.WARN, `tick task ${name} is already paused!`);
            return;
        }
        // Logger.logfile(LOG.INFO, `pause tick task ${name}`);
        clearInterval(config.intervalId);
        config.state = TIMER_STATE.PAUSE;
    }

    resumeTick(name: string) {
        const config = this.data.tickList.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `tick task ${name} does not exist!`);
            return;
        }
        if (config.state == TIMER_STATE.GOING) {
            Logger.logfile(LOG.WARN, `tick task ${name} is already going!`);
            return;
        }
        // Logger.logfile(LOG.INFO, `resume tick task ${name}`);
        const { elapsedTime, callback, mode } = config;
        this.stopTick(name);
        this.startTick(name, elapsedTime, callback, mode);
    }

    stopTick(name: string) {
        const config = this.data.tickList.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `tick task ${name} does not exist!`);
            return;
        }
        clearInterval(config.intervalId);
        this.data.tickList.delete(name);
    }

    clearAll() {
        this.data.taskList.forEach((task) => {
            if (task.timeoutId != null) {
                clearTimeout(task.timeoutId);
            }
        });
        this.data.countdown.forEach((config) => clearInterval(config.intervalId));
        this.data.tickList.forEach((config) => clearInterval(config.intervalId));
        this.data.taskList.clear();
        this.data.countdown.clear();
        this.data.tickList.clear();
    }
}
