import { Component } from "cc";
import { Event, Params } from "@game/core/event/Event";
import { Box } from "@game/core/box/Box";

export type EventCallback = (args: Params) => void;
export type EventFilter = (args: Params) => boolean;

export interface EventListenItem {
    eventName: string;
    callback: EventCallback;
    filter?: EventFilter;
    once?: boolean;
}

export interface EventMethods {
    listen(eventName: string, callback: EventCallback, filter?: EventFilter, once?: boolean): number;
    listenMulti(eventList: EventListenItem[]): number[];
    cancel(eventName: string, evtId?: number, once?: boolean): void;
    onEvent(eventName: string, args: Params, evtId?: number): void;
}

export type InstalledEventMethods = {
    listen: (eventName: string, callback: EventCallback, filter?: EventFilter, once?: boolean) => number;
    listenMulti: (eventList: EventListenItem[]) => number[];
    cancel: (eventName: string, evtId?: number, once?: boolean) => void;
    onEvent: (eventName: string, args: Params, evtId?: number) => void;
};

export class EventManager {

    private _eventMap: Map<string, Event[]>;
    private _onceEventMap: Map<string, Event[]>;
    private counter: number = 1;

    constructor() {
        this._eventMap = new Map<string, Event[]>();
        this._onceEventMap = new Map<string, Event[]>();
    }

    private listen(eventName: string, callback: Function, filter?: Function): number {
        let callbacks = this._eventMap.get(eventName);
        if (!callbacks) {
            callbacks = [];
            this._eventMap.set(eventName, callbacks);
        }
        const evtId = this.counter;
        const event = new Event(evtId, eventName, callback, filter);
        callbacks.push(event);
        this.counter ++;
        return evtId;
    }

    private listenOnce(eventName: string, callback: Function, filter?: Function): number {
        let callbacks = this._onceEventMap.get(eventName);
        if (!callbacks) {
            callbacks = [];
            this._onceEventMap.set(eventName, callbacks);
        }
        const evtId = this.counter;
        const event = new Event(evtId, eventName, callback, filter);
        callbacks.push(event);
        this.counter ++;
        return evtId;
    }

    public on(eventName: string, callback: Function, filter?: Function, once?: boolean): number {
        if (once) {
            return this.listenOnce(eventName, callback, filter);
        }
        return this.listen(eventName, callback, filter);
    }

    private cancel(eventName: string, evtId: number): void {
        const events = this._eventMap.get(eventName);
        if (!events) {
            return;
        }
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            if (event.evtId !== evtId) {
                continue;
            }
            events.splice(i, 1);
            break;
        }
    }

    private cancelOnce(eventName: string, evtId: number): void {
        const events = this._onceEventMap.get(eventName);
        if (!events) {
            return;
        }
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            if (event.evtId !== evtId) {
                continue;
            }
            events.splice(i, 1);
            break;
        }
    }

    private cancelAll(eventName: string): void {
        this._eventMap.delete(eventName);
        this._onceEventMap.delete(eventName);
    }

    public off(eventName: string, evtId?: number, once?: boolean) {
        if (!evtId) {
            this.cancelAll(eventName);
            return;
        }
        if (once) {
            this.cancelOnce(eventName, evtId);
            return;
        }
        this.cancel(eventName, evtId);
    }

    private execute(eventName: string, args: Params, evtId?: number): void {
        const events = this._eventMap.get(eventName);
        if (!events) {
            return;
        }
        if (evtId) {
            for (const event of events) {
                if (event.evtId === evtId) {
                    event.execute(args);
                    return;
                }
            }
        } else {
            for (const event of events) {
                event.execute(args);
            }
        }
    }

    private executeOnce(eventName: string, args: Params, evtId?: number): void {
        const events = this._onceEventMap.get(eventName);
        if (!events) {
            return;
        }
        if (evtId) {
            for (const event of events) {
                if (event.evtId === evtId) {
                    event.execute(args);
                    events.splice(events.indexOf(event), 1);
                    return;
                }
            }
        } else {
            for (const event of events) {
                event.execute(args);
            }
            this._onceEventMap.delete(eventName);
        }
    }

    public call(eventName: string, args: Params, evtId?: number): void {
        this.execute(eventName, args, evtId);
        this.executeOnce(eventName, args, evtId);
    }

}

const handler: EventMethods = {

    listen(eventName: string, callback: EventCallback, filter?: EventFilter, once?: boolean): number {
        return Box.get(EventManager).on(eventName, callback, filter, once);
    },

    listenMulti(eventList: EventListenItem[]): number[] {
        const ret: number[] = [];
        for (const event of eventList) {
            const evtId = Box.get(EventManager).on(event.eventName, event.callback, event.filter, event.once);
            ret.push(evtId);
        }
        return ret;
    },

    cancel(eventName: string, evtId?: number, once?: boolean) {
        Box.get(EventManager).off(eventName, evtId, once);
    },

    onEvent(eventName: string, args: Params, evtId?: number): void {
        Box.get(EventManager).call(eventName, args, evtId);
    }

};

export function installEventMethods<T extends object>(target: T): T & EventMethods {
    return Object.assign(target, handler) as T & InstalledEventMethods;
}

let _componentPrototypeInstalled = false;

export function installEventMethodsToComponentPrototype(): void {
    if (_componentPrototypeInstalled) {
        return;
    }
    const proto = Component.prototype as unknown as Record<string, unknown>;
    const source = handler as unknown as Record<string, unknown>;
    for (const key of Object.keys(source)) {
        if (typeof proto[key] === "function") {
            continue;
        }
        Object.defineProperty(proto, key, {
            value: source[key],
            configurable: true,
            writable: true,
        });
    }
    _componentPrototypeInstalled = true;
}

export abstract class EventMethodsHost implements EventMethods {

    public listen(eventName: string, callback: EventCallback, filter?: EventFilter, once?: boolean): number {
        return handler.listen(eventName, callback, filter, once);
    }

    public listenMulti(eventList: EventListenItem[]): number[] {
        return handler.listenMulti(eventList);
    }

    public cancel(eventName: string, evtId?: number, once?: boolean): void {
        handler.cancel(eventName, evtId, once);
    }

    public onEvent(eventName: string, args: Params, evtId?: number): void {
        handler.onEvent(eventName, args, evtId);
    }
}

export default handler;
