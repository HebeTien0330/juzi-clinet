import { config } from "@game/config/config";
import { Box } from "@game/core/box/Box";
import { LOG, Logger } from "@game/core/logger/logger";
import { ProtocolHandler } from "@game/core/network/ProtocolHandler";

export class WebsocketClient {

    private ws: WebSocket = null as any;
    private config = config;
    private regions: any = null as any;

    constructor() {
        
    }

    async connect2Server(callbacks: { [phase: string]: Function[] }): Promise<any> {
        const rsp = await fetch(this.config.gateAddr);
        const res = await rsp.json();
        const serverInfo = res?.serverInfo;
        if (!serverInfo) {
            const message = "网关响应缺少 serverInfo";
            Logger.logfile(LOG.ERROR, message);
            throw new Error(message);
        }
        const { version, serverAddr, serverPort, regions } = serverInfo;
        if (version !== this.config.version) {
            const message = `版本号不一致，网关版本 ${version}，客户端版本 ${this.config.version}`;
            Logger.logfile(LOG.ERROR, message);
            throw new Error(message);
        }
        const url = this.buildConnectUrl(serverAddr, serverPort);
        this.regions = regions;
        Logger.logfile(LOG.INFO, `连接服务器 ${url}`);
        return new Promise<any>((resolve, reject) => {
            try {
                this.ws = new WebSocket(url);
            }
            catch (err) {
                Logger.logfile(LOG.ERROR, `连接服务器失败 ${url}`);
                reject(err);
                return;
            }
            if (!this.ws) {
                Logger.logfile(LOG.ERROR, `连接服务器失败`);
                reject(new Error("connect server failed"));
                return;
            }
            // 接收二进制数据
            this.ws.binaryType = 'arraybuffer';
            // 设置WebSocket的事件监听
            this.ws.onopen = (event) => {
                this.onOpen(event);
                const funcList = callbacks["onOpen"] || [];
                funcList.forEach(func => func());
                resolve(res);
            };
            this.ws.onmessage = (event) => {
                this.onMessage(event);
                const funcList = callbacks["onMessage"] || [];
                funcList.forEach(func => func());
            };
            this.ws.onerror = (event) => {
                this.onError(event);
                const funcList = callbacks["onError"] || [];
                funcList.forEach(func => func());
            }
            this.ws.onclose = (event) => {
                this.onClose(event);
                const funcList = callbacks["onClose"] || [];
                funcList.forEach(func => func());
            };
        });
    }

    private buildConnectUrl(serverAddr: unknown, serverPort: unknown): string {
        const addr = String(serverAddr ?? "").trim();
        if (!addr) {
            throw new Error("网关未返回服务器地址");
        }
        if (/^wss?:\/\//i.test(addr)) {
            return addr;
        }
        const hasPort = serverPort !== undefined && serverPort !== null && String(serverPort) !== "";
        const port = hasPort ? `:${serverPort}` : "";
        return `ws://${addr}${port}/connect/`;
    }

    onOpen(event: any) {
        console.log('WebSocket connection opened:', event);
    }

    onMessage(event: any) {
        const rsp = Box.get(ProtocolHandler).handleMessage(event.data);
        // console.log('WebSocket message received:', rsp);
    }

    onError(error: any) {
        console.error('WebSocket error:', error);
    }

    onClose(event: any) {
        console.log('WebSocket connection closed:', event);
    }

    // 发送消息到服务器
    async sendMessage(message: any) {
        if (!this.ws) {
            Logger.logfile(LOG.ERROR, "websock is not init");
            return;
        }
        if (this.ws.readyState !== WebSocket.OPEN) {
            Logger.logfile(LOG.ERROR, "websock state is not open");
            return;
        }
        this.ws.send(message);
    }

}
