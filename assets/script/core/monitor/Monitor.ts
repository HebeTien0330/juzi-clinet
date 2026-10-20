import { isObject } from "@game/core/common/utils";

const RAW_KEY = Symbol("monitor.raw");
const PATH_KEY = Symbol("monitor.path");

export type MonitorHook = (key: any, val: any, oldVal: any) => void;

export class MonitorFactory {

    private hooks: { [path: string]: Array<{ fn: MonitorHook; once: boolean }> };
    private proxyCache: WeakMap<object, any>;

    private static readonly ROOT_PATH = "";

    constructor() {
        this.hooks = {};
        this.proxyCache = new WeakMap();
    }

    createMonitor(obj: any, path: string = MonitorFactory.ROOT_PATH) {
        if (!isObject(obj)) {
            return obj;
        }
        const rawObj = this.getRaw(obj);
        const cachedProxy = this.proxyCache.get(rawObj);
        if (cachedProxy) {
            return cachedProxy;
        }
        const res = this.applyHandler(rawObj, path);
        this.proxyCache.set(rawObj, res);
        for (const key of Object.keys(rawObj)) {
            const value = rawObj[key];
            if (!isObject(value)) {
                continue;
            }
            const childPath = this.joinPath(path, key);
            rawObj[key] = this.createMonitor(value, childPath);
        }
        return res;
    }

    applyHandler(obj: any, path: string) {
        const factory = this;
        const handler = {
            set(target: any, key: any, value: any, receiver: any) {
                const oldVal = Reflect.get(target, key, receiver);
                let nextVal = value;
                if (isObject(value) && typeof key === "string") {
                    nextVal = factory.createMonitor(value, factory.joinPath(path, key));
                }
                const result = Reflect.set(target, key, nextVal, receiver);
                if (result && oldVal !== nextVal) {
                    factory.activeHook(path, key, nextVal, oldVal);
                }
                return result;
            },
            get(target: any, key: any, receiver: any){
                if (key === RAW_KEY || key === "RAW") {
                    return target;
                }
                if (key === PATH_KEY || key === "PATH") {
                    return path;
                }
                return Reflect.get(target, key, receiver);
            },
        };
        return new Proxy(obj, handler);
    }

    getRaw(monitor: any): any {
        const raw = monitor?.[RAW_KEY] || monitor?.["RAW"];
        if (!raw) {
            return monitor;
        }
        return this.getRaw(raw);
    }

    /** 解析监听路径：支持 path 字符串，或 monitor proxy 对象 */
    resolvePath(target: string | object): string {
        if (typeof target === "string") {
            return target;
        }
        return this.getPath(target);
    }

    getPath(proxyObj: any): string {
        const path = proxyObj?.[PATH_KEY] || proxyObj?.["PATH"];
        if (typeof path === "string") {
            return path;
        }
        return MonitorFactory.ROOT_PATH;
    }

    joinPath(base: string, key: string): string {
        return base ? `${base}.${key}` : key;
    }

    addHook(target: string | object, hook: MonitorHook) {
        const path = this.resolvePath(target);
        const hooks = this.hooks[path] || [];
        hooks.push({ fn: hook, once: false });
        this.hooks[path] = hooks;
    }

    removeHook(target: string | object, hook?: MonitorHook): number {
        const path = this.resolvePath(target);
        const hooks = this.hooks[path];
        if (!hooks || hooks.length === 0) {
            return 0;
        }
        if (!hook) {
            const count = hooks.length;
            delete this.hooks[path];
            return count;
        }
        const remained = hooks.filter((item) => item.fn !== hook);
        const removedCount = hooks.length - remained.length;
        if (remained.length > 0) {
            this.hooks[path] = remained;
        } else {
            delete this.hooks[path];
        }
        return removedCount;
    }

    onceHook(target: string | object, hook: MonitorHook) {
        const path = this.resolvePath(target);
        const hooks = this.hooks[path] || [];
        hooks.push({ fn: hook, once: true });
        this.hooks[path] = hooks;
    }

    activeHook(basePath: string, key: any, val: any, oldVal: any) {
        this.invokeHooks(basePath, key, val, oldVal);
        if (typeof key === "string") {
            this.invokeHooks(this.joinPath(basePath, key), key, val, oldVal);
        }
    }

    private invokeHooks(path: string, key: any, val: any, oldVal: any) {
        const hooks = this.hooks[path] ? [...this.hooks[path]] : [];
        if (hooks.length === 0) {
            return;
        }
        const remained: Array<{ fn: MonitorHook; once: boolean }> = [];
        for (const hook of hooks) {
            try {
                hook.fn(key, val, oldVal);
            } catch (error) {
                console.error(error);
            }
            if (!hook.once) {
                remained.push(hook);
            }
        }
        if (remained.length > 0) {
            this.hooks[path] = remained;
            return;
        }
        delete this.hooks[path];
    }
}
