import type { EventMethods } from "@game/core/event/Manager";

declare module "cc" {
    interface Component extends EventMethods {}
}

export {};
