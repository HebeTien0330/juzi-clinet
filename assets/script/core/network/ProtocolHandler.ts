import { WebsocketClient } from "@game/core/network/Websock";
import { Box } from "@game/core/box/Box";
import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { C2SHeartbeat, MsgType, S2CHeartbeat } from "@pb/common/common";
import { BaseReq, NotifyMessageInf, TransferMessageReq, TransferMessageRsp } from "@pb/public/server";
import { Heartbeat } from "@game/core/network/Heartbeat";
import { RemoteSync } from "@game/core/network/RemoteSync";
import { C2SLogout, C2SReconnect, S2CLogout, S2CReconnect } from "@pb/public/session";
import { getAuthSession } from "@game/core/auth/AuthSession";

type WaitingUIHandler = {
    show: () => void | Promise<void>;
    hide: () => void;
};

export interface MessageFns<T> {
    name: string;
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
    fromJSON(object: any): T;
    toJSON(message: T): unknown;
    create<I extends Exact<DeepPartial<T>, I>>(base?: I): T;
    fromPartial<I extends Exact<DeepPartial<T>, I>>(object: I): T;
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends globalThis.Array<infer U> ? globalThis.Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

interface PendingAsyncRequest<TRsp = any> {
    S2CProtocol: MessageFns<TRsp>;
    resolve: (value: TRsp) => void;
    reject: (reason?: any) => void;
    timeoutId: ReturnType<typeof setTimeout>;
    waitingTimeoutId: ReturnType<typeof setTimeout>;
    waitingShown: boolean;
}

export class ProtocolHandler {

    private static readonly HEARTBEAT_SEQ_ID = 1;
    private static readonly DEFAULT_REQUEST_TIMEOUT_MS = 15000;
    private static readonly WAITING_DELAY_MS = 1000;

    private _seqId: number = 0;
    private networker: WebsocketClient;
    private pendingRequests: Map<number, { C2SProtocol: MessageFns<any>, S2CProtocol: MessageFns<any>, callback?: Function }> = new Map();
    private pendingAsyncRequests: Map<number, PendingAsyncRequest> = new Map();
    private notifyHandlers: Map<string, { NotifyProtocol: MessageFns<any>, callback?: Function }> = new Map();
    private clientid: string = null as any;
    private heartbeatIntervalSeconds: number = 3;
    private waitingRefCount = 0;
    private waitingUI: WaitingUIHandler | null = null;
    private reconnectDelays: number[] = [1, 2, 4, 8, 16, 32];       // 指数退避时间
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnecting = false;
    private reconnectSuccessHandlers: Array<(response: S2CReconnect) => void> = [];
    private readonly lifecycleCallbacks: { [phase: string]: Function[] };

    constructor() {
        this.networker = new WebsocketClient();
        this.lifecycleCallbacks = {
            onOpen: [() => {
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                this.reconnecting = false;
                this.startHeartbeat();
            }],
            onClose: [() => {
                if (this.reconnecting) {
                    return;
                }
                this.stopHeartbeat();
                Box.get(Heartbeat)?.notifyLost("websocket closed");
                this.rejectAllPending(new Error("ConnectionClosed"));
                void this.reconnect();
            }],
            onError: [() => {
                if (this.reconnecting) {
                    return;
                }
                this.stopHeartbeat();
                Box.get(Heartbeat)?.notifyLost("websocket error");
                this.rejectAllPending(new Error("ConnectionClosed"));
                void this.reconnect();
            }],
        };
    }

    /** 注册 Waiting 界面的显示/关闭实现（由游戏初始化注入） */
    public registerWaitingUI(handler: WaitingUIHandler | null): void {
        this.waitingUI = handler;
    }

    public async connect(callbacks?: { [phase: string]: Function[] }): Promise<any> {
        const mergedCallbacks: { [phase: string]: Function[] } = {
            onOpen: [...(this.lifecycleCallbacks["onOpen"] || [])],
            onClose: [...(this.lifecycleCallbacks["onClose"] || [])],
            onError: [...(this.lifecycleCallbacks["onError"] || [])],
        };

        if (callbacks) {
            mergedCallbacks["onOpen"] = [...mergedCallbacks["onOpen"], ...(callbacks["onOpen"] || [])];
            mergedCallbacks["onClose"] = [...mergedCallbacks["onClose"], ...(callbacks["onClose"] || [])];
            mergedCallbacks["onError"] = [...mergedCallbacks["onError"], ...(callbacks["onError"] || [])];
        }

        const res = await this.networker.connect2Server(mergedCallbacks);
        console.log("connect to server result: ", res);
        return res;
    }

    public async reconnect(): Promise<void> {
        if (this.reconnecting) {
            return;
        }
        this.reconnecting = true;
        try {
            await this.doReconnect();
        }
        finally {
            this.reconnecting = false;
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        }
    }

    public onReconnectSuccess(handler: (response: S2CReconnect) => void): void {
        this.reconnectSuccessHandlers.push(handler);
    }

    public async logout(): Promise<void> {
        const authSession = getAuthSession();
        const userId = authSession.getUserId();
        if (!userId) {
            console.warn("logout skipped: no userId in session");
            authSession.clear();
            return;
        }

        try {
            await this.requestAsync(C2SLogout, S2CLogout, { userId });
            console.log("logout success");
        }
        catch (err) {
            console.error("logout failed:", err);
        }
        finally {
            authSession.clear();
        }
    }

    private async doReconnect() {
        const authSession = getAuthSession();
        const delays = this.reconnectDelays;
        for (let attempt = 0; attempt < delays.length; attempt++) {
            const delaySec = delays[attempt];
            console.log(`reconnect wait ${delaySec}s, attempt=${attempt + 1}/${delays.length}`);
            await new Promise<void>((resolve) => {
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    resolve();
                }, delaySec * 1000);
            });

            if (!authSession.hasSession()) {
                console.warn("reconnect canceled: no sessionToken available");
                return;
            }

            try {
                await this.connect();
                const reconnectPayload = authSession.getReconnectPayload();
                const reconnectRsp = await this.requestAsync(C2SReconnect, S2CReconnect, reconnectPayload);
                this.clientid = reconnectRsp.clientid || this.clientid;
                authSession.setLogin({
                    userId: reconnectRsp.userId,
                    sessionToken: reconnectRsp.sessionToken,
                    clientId: reconnectRsp.clientid,
                });
                for (const handler of this.reconnectSuccessHandlers) {
                    handler(reconnectRsp);
                }
                console.log("reconnect success", reconnectRsp);
                return;
            }
            catch (err) {
                console.error(`reconnect attempt ${attempt + 1} failed:`, err);
            }
        }
        console.warn("reconnect exhausted, max retry count reached");
    }

    private startHeartbeat() {
        const heartbeat = Box.get(Heartbeat);
        if (!heartbeat) {
            console.error("Heartbeat not registered in Box");
            return;
        }
        heartbeat.start(async (no: number) => {
            await this.sendHeartbeatDirect(no);
        }, this.heartbeatIntervalSeconds, true);
    }

    private stopHeartbeat() {
        Box.get(Heartbeat)?.stop();
    }

    public async sendHeartbeatDirect(no: number): Promise<void> {
        const proto = C2SHeartbeat.create({ no });
        const payload = C2SHeartbeat.encode(proto).finish();
        const transferReq = TransferMessageReq.create({
            baseReq: BaseReq.create({ clientId: this.clientid }),
            msgName: C2SHeartbeat.name,
            seqId: ProtocolHandler.HEARTBEAT_SEQ_ID,
            payload,
        });
        const transferPayload = TransferMessageReq.encode(transferReq).finish();
        const message = this.addHeader(
            transferPayload.buffer.slice(
                transferPayload.byteOffset,
                transferPayload.byteOffset + transferPayload.byteLength
            ),
            MsgType.MsgReq
        );
        await this.networker.sendMessage(message);
        // console.log("heartbeat send, seqId=1, no=", no);
    }

    public async request<T extends object>(C2SProtocol: MessageFns<T>, S2CProtocol: MessageFns<any>, params: any, callback?: Function, target?: any) {
        const seqId = this.nextRequestSeqId();
        // 在发送前先注册请求，返回数据的时候根据注册表找到对应的协议解码器
        if (callback && target) {
            callback = callback.bind(target);
        }
        this.pendingRequests.set(seqId, { C2SProtocol, S2CProtocol, callback });
        const proto = C2SProtocol.create(params);
        const payload = C2SProtocol.encode(proto).finish();
        const baseReq = BaseReq.create({ clientId: this.clientid });
        const transferReq = TransferMessageReq.create({
            baseReq: baseReq,
            msgName: C2SProtocol.name,
            seqId,
            payload,
        });
        const transferPayload = TransferMessageReq.encode(transferReq).finish();
        const message = this.addHeader(
            transferPayload.buffer.slice(
                transferPayload.byteOffset,
                transferPayload.byteOffset + transferPayload.byteLength
            ),
            MsgType.MsgReq
        );
        await this.networker.sendMessage(message);
        console.log("request:", C2SProtocol.name, params);
    }

    public requestAsync<TReq extends object, TRsp extends object>(C2SProtocol: MessageFns<TReq>, S2CProtocol: MessageFns<TRsp>, params: DeepPartial<TReq>, timeoutMs: number = ProtocolHandler.DEFAULT_REQUEST_TIMEOUT_MS): Promise<TRsp> {
        const seqId = this.nextRequestSeqId();
        return new Promise<TRsp>((resolve, reject) => {
            // 设置超时
            const timeoutId = setTimeout(() => {
                const pending = this.clearAsyncPending(seqId);
                if (!pending) {
                    return;
                }
                reject(new Error(`RequestTimeout: ${C2SProtocol.name} seqId=${seqId}`));
            }, timeoutMs);
            // 超过 1s 未回包则弹出 Waiting
            const waitingTimeoutId = setTimeout(() => {
                this.onWaitingDelayReached(seqId);
            }, ProtocolHandler.WAITING_DELAY_MS);
            // 设置进行中的请求
            this.pendingAsyncRequests.set(seqId, { S2CProtocol, resolve, reject, timeoutId, waitingTimeoutId, waitingShown: false });
            const proto = C2SProtocol.create(params as any);
            const payload = C2SProtocol.encode(proto).finish();
            const baseReq = BaseReq.create({ clientId: this.clientid });
            const transferReq = TransferMessageReq.create({ baseReq, msgName: C2SProtocol.name, seqId, payload });
            const transferPayload = TransferMessageReq.encode(transferReq).finish();
            const message = this.addHeader(
                transferPayload.buffer.slice(
                    transferPayload.byteOffset,
                    transferPayload.byteOffset + transferPayload.byteLength
                ),
                MsgType.MsgReq
            );
            // 发送请求
            this.networker.sendMessage(message).then(() => {
                console.log("request:", C2SProtocol.name, params);
            }).catch((err) => {
                // 发送失败，清除进行中的请求
                this.clearAsyncPending(seqId);
                reject(err);
            });
        });
    }

    public onNotify<T extends object>(NotifyProtocol: MessageFns<T>, callback?: Function, target?: any) {
        if (callback && target) {
            callback = callback.bind(target);
        }
        this.notifyHandlers.set(NotifyProtocol.name, { NotifyProtocol, callback });
    }

    public offNotify(NotifyProtocol: MessageFns<any>) {
        this.notifyHandlers.delete(NotifyProtocol.name);
    }

    public handleMessage(message: ArrayBuffer) {
        if (!message || message.byteLength < 2) {
            console.error("message too short");
            return;
        }
        const view = new DataView(message);
        const msgType = view.getUint16(0, false);
        const body = new Uint8Array(message, 2);
        switch (msgType) {
            case MsgType.MsgRes:
                return this.handleResponse(body);
            case MsgType.MsgNotify:
                return this.handleNotify(body);
            default:
                console.error(`unknown message type: ${msgType}`);
                return;
        }
    }

    private handleResponse(body: Uint8Array) {
        // 先解包通用传输层，再根据业务 seqId 找到对应协议解码器
        const transferRsp = TransferMessageRsp.decode(body);
        const seqId = transferRsp.seqId;
        if (seqId === ProtocolHandler.HEARTBEAT_SEQ_ID) {
            try {
                const heartbeatRsp = S2CHeartbeat.decode(transferRsp.payload);
                // console.log("heartbeat response:", heartbeatRsp);
                Box.get(Heartbeat)?.onAck(heartbeatRsp.no);
                return heartbeatRsp;
            }
            catch (err) {
                console.error("heartbeat transfer response decode failed:", err);
                return;
            }
        }
        const asyncPending = this.pendingAsyncRequests.get(seqId);
        if (asyncPending) {
            this.clearAsyncPending(seqId);
            try {
                const decodedData = asyncPending.S2CProtocol.decode(transferRsp.payload);
                const protocolName = asyncPending.S2CProtocol.name;
                console.log(`response ${protocolName} seqId=${seqId}:`, decodedData);
                RemoteSync.applyFromMessage(decodedData);
                asyncPending.resolve(decodedData);
                return decodedData;
            }
            catch (err) {
                console.error(`decode error for seqId ${seqId}:`, err);
                asyncPending.reject(err);
                return;
            }
        }

        const proto = this.pendingRequests.get(seqId);
        if (!proto) {
            try {
                const heartbeatRsp = S2CHeartbeat.decode(body);
                console.log("heartbeat response:", heartbeatRsp);
                Box.get(Heartbeat)?.onAck(heartbeatRsp.no);
                return heartbeatRsp;
            }
            catch (err) {
                console.error(`no pending request for seqId: ${seqId}`);
                return;
            }
        }
        this.pendingRequests.delete(seqId);
        // 解析通用传输层中的业务 payload
        const decodedData = proto.S2CProtocol.decode(transferRsp.payload);
        const protocolName = proto.S2CProtocol.name;
        console.log(`response ${protocolName} seqId=${seqId}:`, decodedData);
        RemoteSync.applyFromMessage(decodedData);
        try {
            proto.callback && proto.callback(decodedData);
        }
        catch (err) {
            console.error(`callback error for protocol ${protocolName}:`, err);
        }
        return decodedData;
    }

    private handleNotify(body: Uint8Array) {
        const notifyInf = NotifyMessageInf.decode(body);
        const handler = this.notifyHandlers.get(notifyInf.msgName);
        if (!handler) {
            console.log(`no notify handler for msgName: ${notifyInf.msgName}`);
            return;
        }
        const decodedData = handler.NotifyProtocol.decode(notifyInf.payload);
        const protocolName = handler.NotifyProtocol.name;
        console.log(`notify ${protocolName}:`, decodedData);
        RemoteSync.applyFromMessage(decodedData);
        try {
            handler.callback && handler.callback(decodedData);
        }
        catch (err) {
            console.error(`callback error for notify protocol ${protocolName}:`, err);
        }
        return decodedData;
    }

    private clearAsyncPending(seqId: number): PendingAsyncRequest | undefined {
        const pending = this.pendingAsyncRequests.get(seqId);
        if (!pending) {
            return undefined;
        }
        clearTimeout(pending.timeoutId);
        clearTimeout(pending.waitingTimeoutId);
        this.releaseWaiting(pending);
        this.pendingAsyncRequests.delete(seqId);
        return pending;
    }

    private rejectAllPending(error: Error) {
        this.pendingRequests.clear();
        const pendings = Array.from(this.pendingAsyncRequests.values());
        this.pendingAsyncRequests.clear();
        for (const pending of pendings) {
            clearTimeout(pending.timeoutId);
            clearTimeout(pending.waitingTimeoutId);
            pending.waitingShown = false;
            pending.reject(error);
        }
        this.waitingRefCount = 0;
        this.waitingUI?.hide();
    }

    private onWaitingDelayReached(seqId: number) {
        const pending = this.pendingAsyncRequests.get(seqId);
        if (!pending || pending.waitingShown) {
            return;
        }
        pending.waitingShown = true;
        this.waitingRefCount++;
        this.waitingUI?.show();
    }

    private releaseWaiting(pending: PendingAsyncRequest) {
        if (!pending.waitingShown) {
            return;
        }
        pending.waitingShown = false;
        this.waitingRefCount = Math.max(0, this.waitingRefCount - 1);
        if (this.waitingRefCount === 0) {
            this.waitingUI?.hide();
        }
    }

    private nextRequestSeqId(): number {
        do {
            this._seqId = (this._seqId + 1) & 0xFFFF;
            if (this._seqId === 0) {
                this._seqId = 2;
            }
        } while (this._seqId === ProtocolHandler.HEARTBEAT_SEQ_ID);
        return this._seqId;
    }

    // 消息头格式：[2字节 MsgType]
    private addHeader(message: ArrayBuffer, msgType: MsgType = MsgType.MsgReq) {
        const header = new ArrayBuffer(2);
        const headerView = new DataView(header);
        headerView.setUint16(0, msgType, false);
        const content = new ArrayBuffer(header.byteLength + message.byteLength);
        const finalView = new Uint8Array(content);
        finalView.set(new Uint8Array(header), 0);
        finalView.set(new Uint8Array(message), header.byteLength);
        return content;
    }

}
