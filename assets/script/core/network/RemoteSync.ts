import { LOG, Logger } from "@game/core/logger/logger";

export type RemoteApplyHandler = (segments: string[], value: unknown) => void;

type RemotePayload = {
    data?: Record<string, string> | null;
};

/**
 * 解析协议中的 remote 增量。路径为点语法，第一段是根名称。
 * 游戏通过 register 按根名称接入自己的数据模型。
 */
export class RemoteSync {

    private static handlers = new Map<string, RemoteApplyHandler>();

    public static register(root: string, handler: RemoteApplyHandler): void {
        this.handlers.set(root, handler);
    }

    public static unregister(root: string): void {
        this.handlers.delete(root);
    }

    public static applyFromMessage(message: { remote?: RemotePayload | null } | null | undefined): void {
        if (!message?.remote) {
            return;
        }
        this.apply(message.remote);
    }

    public static apply(remote?: RemotePayload | null): void {
        this.applyData(remote?.data);
    }

    public static applyData(data?: Record<string, string> | null): void {
        if (!data) {
            return;
        }
        for (const path of Object.keys(data)) {
            try {
                const segments = path.split(".").filter((segment) => segment.length > 0);
                if (segments.length < 2) {
                    continue;
                }
                const root = segments[0];
                const handler = this.handlers.get(root);
                if (!handler) {
                    Logger.logfile(LOG.WARN, `RemoteSync no handler for root path: ${path}`);
                    continue;
                }
                handler(segments.slice(1), JSON.parse(data[path]));
            }
            catch (err) {
                Logger.logfile(LOG.ERROR, `RemoteSync apply failed path=${path}: ${err}`);
            }
        }
    }
}
