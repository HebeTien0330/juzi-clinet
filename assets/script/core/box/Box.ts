/**
 * 依赖注入容器
 */
import { LOG, Logger } from "@game/core/logger/logger";
import { generateUUID } from "@game/core/common/utils";

interface ConstructorWithUUID extends Function {
    __uuid?: string;
}

export type ClassConstructor<T extends object> = new () => T;

export class Box {

    private static _instanceMap: Map<string, any> = new Map();
    private static _classMap: Map<ClassConstructor<any>, any> = new Map();

    public static add<T extends object>(instance: T): void {
        const constructor = instance.constructor as ConstructorWithUUID;
        if (constructor.hasOwnProperty("__uuid")) {
            Logger.logfile(LOG.WARN, "box add instance has already been added");
            return;
        }
        const uuid = generateUUID();
        constructor["__uuid"] = uuid;
        Box._instanceMap.set(uuid, instance);
        Box._classMap.set(instance.constructor as ClassConstructor<T>, instance);
    }

    public static get<T extends object>(constructor: ClassConstructor<T>): T {
        if (!Box._classMap.has(constructor)) {
            return null;
        }
        return Box._classMap.get(constructor) as T;
    }

    public static addByClass<T extends object>(constructor: ClassConstructor<T>): void {
        if (!constructor) {
            Logger.logfile(LOG.ERROR, "box addByClass ctor can not be null or undefined");
            return;
        }
        if (Box._classMap.has(constructor)) {
            Logger.logfile(LOG.WARN, "box addByClass ctor has already been added");
            return;
        }
        const instance = new constructor();
        Box._classMap.set(constructor, instance);
    }

    public static getByClass<T extends object>(constructor: ClassConstructor<T>): T | null {
        if (!constructor) {
            Logger.logfile(LOG.ERROR, "box getByClass ctor can not be null or undefined");
            return null;
        }
        if (!Box._classMap.has(constructor)) {
            Logger.logfile(LOG.ERROR, "box getByClass ctor has not been added");
            return null;
        }
        return (Box._classMap.get(constructor) as T) || null;
    }
}
