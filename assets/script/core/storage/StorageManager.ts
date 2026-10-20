import { sys } from "cc";

export class StorageManager {

    private cache = new Map<string, unknown>();
    private managedKeys = new Set<string>();

    public get<T = unknown>(key: string): T | undefined {
        if (this.cache.has(key)) {
            return this.cache.get(key) as T;
        }

        const value = sys.localStorage.getItem(key);
        this.managedKeys.add(key);
        if (value === null) {
            return undefined;
        }

        const parsed = JSON.parse(value) as T;
        this.cache.set(key, parsed);
        return parsed;
    }

    public set<T>(key: string, value: T): void {
        sys.localStorage.setItem(key, JSON.stringify(value)!);
        this.cache.set(key, value);
        this.managedKeys.add(key);
    }

    public has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    public remove(key: string): void {
        sys.localStorage.removeItem(key);
        this.cache.delete(key);
        this.managedKeys.delete(key);
    }

    public clear(): void {
        for (const key of this.managedKeys) {
            sys.localStorage.removeItem(key);
        }
        this.cache.clear();
        this.managedKeys.clear();
    }

}