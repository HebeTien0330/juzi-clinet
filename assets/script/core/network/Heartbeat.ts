import { LOG, Logger } from "@game/core/logger/logger";
import { Timer } from "@game/core/timer/Timer";

type HeartbeatSender = (no: number) => Promise<void> | void;

type NetworkErrorUIHandler = {
	show: () => void | Promise<void>;
	hide: () => void;
};

export class Heartbeat {

	private readonly taskName = "network_heartbeat_task";
	private readonly maxMissCount = 3;
	private started = false;
	private intervalSeconds = 3;
	private no = 0;
	private sender: HeartbeatSender | null = null;
	private waitingAck = false;
	private missCount = 0;
	private networkErrorUI: NetworkErrorUIHandler | null = null;

	/** 注册网络异常界面的显示/关闭实现（由游戏初始化注入） */
	registerNetworkErrorUI(handler: NetworkErrorUIHandler | null): void {
		this.networkErrorUI = handler;
	}

	start(sender: HeartbeatSender, intervalSeconds: number = 3, immediate: boolean = true): void {
		this.stop();
		this.started = true;
		this.sender = sender;
		this.intervalSeconds = Math.max(1, intervalSeconds);
		this.waitingAck = false;
		this.missCount = 0;
		Logger.logfile(LOG.INFO, `heartbeat started, interval=${this.intervalSeconds}s`);

		if (immediate) {
			void this.sendOnce();
		}
		this.scheduleNext();
	}

	/** 仅停止心跳调度；网络异常界面等收到回包再关 */
	stop(): void {
		if (!this.started) {
			return;
		}
		this.started = false;
		this.sender = null;
		this.waitingAck = false;
		this.missCount = 0;
		Timer.getTimer()?.removeTimeout(this.taskName);
		Logger.logfile(LOG.INFO, "heartbeat stopped");
	}

	/** 收到心跳回包时调用，重置连续丢失计数并关闭网络异常界面 */
	onAck(_no?: number): void {
		this.waitingAck = false;
		this.missCount = 0;
		this.networkErrorUI?.hide();
	}

	/** 连接断开或连续丢包时弹出网络异常界面 */
	notifyLost(reason: string = "connection lost"): void {
		Logger.logfile(LOG.WARN, `heartbeat lost: ${reason}`);
		void this.networkErrorUI?.show();
	}

	private scheduleNext = (): void => {
		if (!this.started) {
			return;
		}
		const timer = Timer.getTimer();
		if (!timer) {
			Logger.logfile(LOG.ERROR, "timer unavailable, heartbeat schedule skipped");
			return;
		}
		timer.setTimeout(this.taskName, this.intervalSeconds, this.onTimer);
	};

	private onTimer = (): void => {
		void this.sendOnce().then(() => {
			this.scheduleNext();
		});
	};

	private sendOnce = async (): Promise<void> => {
		if (!this.started || !this.sender) {
			return;
		}
		if (this.waitingAck) {
			this.missCount++;
			Logger.logfile(LOG.WARN, `heartbeat miss count=${this.missCount}`);
			if (this.missCount >= this.maxMissCount) {
				this.notifyLost(`miss count=${this.missCount}`);
			}
		}
		const no = ++this.no;
		this.waitingAck = true;
		try {
			await this.sender(no);
		}
		catch (err) {
			Logger.logfile(LOG.ERROR, `heartbeat send failed: ${String(err)}`);
		}
	};
}
