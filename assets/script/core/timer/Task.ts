import { _decorator, Component, Node, director } from "cc";
import { LOG, Logger } from "@game/core/logger/logger";
import { TIMER_FREQUENCY, TIMER_MODE, TIMER_STATE } from "@game/core/timer/Timer";

const { ccclass } = _decorator;

type CocosTimerCallback = (dt: number) => void;

interface ITaskConfig {
    callback: CocosTimerCallback;
}

interface ICountDownConfig {
    callback: Function;
    mode: TIMER_MODE;
    state: TIMER_STATE;
    remain: number;
    onTick: CocosTimerCallback;
}

interface ITickConfig {
    callback: Function;
    mode: TIMER_FREQUENCY;
    state: TIMER_STATE;
    elapsedTime: number;
    elapsedMs: number;
    onTick: CocosTimerCallback;
}

interface ITaskData {
    taskList: Map<string, ITaskConfig>;
    countdown: Map<string, ICountDownConfig>;
    tickList: Map<string, ITickConfig>;
}

const translateTime = (timestamp: number, mode: TIMER_MODE): string => {
    let [hours, mins, secs] = [0, 0, 0];
    switch (mode) {
        case TIMER_MODE.S:
            return `${timestamp}`;
        case TIMER_MODE.MS:
            mins = Math.floor(timestamp / 60);
            secs = timestamp % 60;
            return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        case TIMER_MODE.HMS:
            hours = Math.floor(timestamp / 3600);
            mins = Math.floor((timestamp - hours * 3600) / 60);
            secs = timestamp % 60;
            return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        default:
            Logger.logfile(LOG.ERROR, "unknown time mode!");
            return "";
    }
};

const transTimeStamp = (ts: number, mode: TIMER_FREQUENCY): string => {
    if (ts == null) {
        return "99:99:99:999";
    }

    let totalSeconds: number | null = null;
    let milliseconds: number | null = null;

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
        hours.toString().padStart(2, "0"),
        minutes.toString().padStart(2, "0"),
        seconds.toString().padStart(2, "0"),
    ];

    if (milliseconds != null) {
        res.push(milliseconds.toString().padStart(3, "0"));
    }

    return res.join(":");
};

@ccclass("task")
export class Task extends Component {

    private static _instance: Task | null = null;

    data: ITaskData = {
        taskList: new Map(),
        countdown: new Map(),
        tickList: new Map(),
    };

    static getTask(): Task {
        if (Task._instance && Task._instance.isValid) {
            return Task._instance;
        }

        const node = new Node("TaskScheduler");
        const scene = director.getScene();
        if (scene) {
            scene.addChild(node);
        }
        director.addPersistRootNode(node);
        Task._instance = node.addComponent(Task);
        return Task._instance;
    }

    setTimeout(name: string, timeout: number, callback: Function, repeat?: number, interval?: number): void {
        if (this.data.taskList.get(name)) {
            Logger.logfile(LOG.WARN, "task timer name repeat!");
            return;
        }

        const delay = Math.max(0, timeout);

        if (!repeat || repeat <= 0) {
            const onTick = () => {
                this.data.taskList.delete(name);
                callback();
            };
            this.scheduleOnce(onTick, delay);
            this.data.taskList.set(name, { callback: onTick });
            return;
        }

        let remain = repeat + 1;
        const safeInterval = Math.max(0, interval ?? 0);
        const onTick = () => {
            callback();
            remain--;
            if (remain <= 0) {
                this.unschedule(onTick);
                this.data.taskList.delete(name);
            }
        };

        this.schedule(onTick, safeInterval, repeat, delay);
        this.data.taskList.set(name, { callback: onTick });
    }

    removeTimeout(name: string): void {
        const config = this.data.taskList.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `task timer ${name} does not exist`);
            return;
        }
        this.unschedule(config.callback);
        this.data.taskList.delete(name);
    }

    startCountDown(name: string, seconds: number, callback: Function, mode: TIMER_MODE = TIMER_MODE.MS): void {
        if (this.data.countdown.get(name)) {
            Logger.logfile(LOG.WARN, "countdown task name repeat!");
            return;
        }

        const onTick = () => {
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
            callback(translateTime(seconds, mode));
        };

        this.schedule(onTick, 1);
        this.data.countdown.set(name, {
            callback,
            mode,
            state: TIMER_STATE.GOING,
            remain: seconds,
            onTick,
        });
    }

    pauseCountDown(name: string): void {
        const config = this.data.countdown.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `countdown task ${name} does not exist!`);
            return;
        }
        if (config.state === TIMER_STATE.PAUSE) {
            Logger.logfile(LOG.WARN, `countdown task ${name} is already paused!`);
            return;
        }

        this.unschedule(config.onTick);
        config.state = TIMER_STATE.PAUSE;
    }

    resumeCountDown(name: string): void {
        const config = this.data.countdown.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `countdown task ${name} does not exist!`);
            return;
        }
        if (config.state === TIMER_STATE.GOING) {
            Logger.logfile(LOG.WARN, `countdown task ${name} is already going!`);
            return;
        }

        const { remain, callback, mode } = config;
        this.stopCountDown(name);
        this.startCountDown(name, remain, callback, mode);
    }

    stopCountDown(name: string): void {
        const config = this.data.countdown.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `countdown task ${name} does not exist!`);
            return;
        }

        this.unschedule(config.onTick);
        this.data.countdown.delete(name);
    }

    startTick(name: string, elapsedTime: number, callback: Function, mode: TIMER_FREQUENCY = TIMER_FREQUENCY.MS): void {
        if (this.data.tickList.get(name)) {
            Logger.logfile(LOG.WARN, "tick task name repeat!");
            return;
        }

        let elapsedMs = mode === TIMER_FREQUENCY.S ? elapsedTime * 1000 : elapsedTime;
        const intervalSec = mode === TIMER_FREQUENCY.S ? 1 : 0;
        const onTick = (dt: number) => {
            elapsedMs += dt * 1000;
            const config = this.data.tickList.get(name);
            if (!config) {
                return;
            }

            const elapsed = mode === TIMER_FREQUENCY.S ? Math.floor(elapsedMs / 1000) : Math.floor(elapsedMs);
            config.elapsedMs = elapsedMs;
            config.elapsedTime = elapsed;
            callback(transTimeStamp(elapsed, mode));
        };

        this.schedule(onTick, intervalSec);
        this.data.tickList.set(name, {
            callback,
            mode,
            state: TIMER_STATE.GOING,
            elapsedTime,
            elapsedMs,
            onTick,
        });
    }

    pauseTick(name: string): void {
        const config = this.data.tickList.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `tick task ${name} does not exist!`);
            return;
        }
        if (config.state === TIMER_STATE.PAUSE) {
            Logger.logfile(LOG.WARN, `tick task ${name} is already paused!`);
            return;
        }

        this.unschedule(config.onTick);
        config.state = TIMER_STATE.PAUSE;
    }

    resumeTick(name: string): void {
        const config = this.data.tickList.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `tick task ${name} does not exist!`);
            return;
        }
        if (config.state === TIMER_STATE.GOING) {
            Logger.logfile(LOG.WARN, `tick task ${name} is already going!`);
            return;
        }

        const { elapsedTime, callback, mode } = config;
        this.stopTick(name);
        this.startTick(name, elapsedTime, callback, mode);
    }

    stopTick(name: string): void {
        const config = this.data.tickList.get(name);
        if (!config) {
            Logger.logfile(LOG.WARN, `tick task ${name} does not exist!`);
            return;
        }

        this.unschedule(config.onTick);
        this.data.tickList.delete(name);
    }

    clearAll(): void {
        this.data.taskList.forEach((task) => this.unschedule(task.callback));
        this.data.countdown.forEach((task) => this.unschedule(task.onTick));
        this.data.tickList.forEach((task) => this.unschedule(task.onTick));
        this.data.taskList.clear();
        this.data.countdown.clear();
        this.data.tickList.clear();
    }

    onDestroy(): void {
        this.clearAll();
        if (Task._instance === this) {
            Task._instance = null;
        }
    }
}
