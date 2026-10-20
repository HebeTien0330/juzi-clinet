import { JsonAsset, resources, SpriteFrame, Prefab } from "cc";

type ResourcePathMap = Record<string, string>;
type SpriteFrameCacheEntry = { asset: SpriteFrame; lastUsed: number };
type PrefabCacheEntry = { asset: Prefab; lastUsed: number };

export class ResourceManager {

	private _pathMap: ResourcePathMap = {};
	private _spriteFrameCache: Map<string, SpriteFrameCacheEntry> = new Map<string, SpriteFrameCacheEntry>();
	private _prefabCache: Map<string, PrefabCacheEntry> = new Map<string, PrefabCacheEntry>();
	private readonly _maxCacheCount: number;
	private _ready: Promise<void> | null = null;

	constructor(maxCacheCount: number = 100) {
		this._maxCacheCount = maxCacheCount;
		this.init();
	}

	public init() {
		if (this._ready) {
			return;
		}
		this._ready = new Promise((resolve, reject) => {
			if (Object.keys(this._pathMap).length > 0) {
				resolve();
				return;
			}
			resources.load("json/resourcesMap", JsonAsset, (err, asset) => {
				if (err || !asset) {
					reject(err || new Error("Failed to load resourcesMap"));
					return;
				}
				this._pathMap = asset.json as ResourcePathMap;
				resolve();
			});
		});
	}

	public ready(): Promise<void> {
		if (!this._ready) {
			this.init();
		}
		return this._ready!;
	}

	public getPathByName(fileName: string): string {
		const path = this._pathMap[fileName];
		if (!path) {
			throw new Error(`Resource key not found: ${fileName}`);
		}
		return path;
	}

	public async loadSprite(fileName: string): Promise<SpriteFrame> {
		await this.ready();
		const cached = this._spriteFrameCache.get(fileName);
		if (cached) {
			cached.lastUsed = Date.now();
			return cached.asset;
		}
		const path = this.getPathByName(fileName);
		const spriteFrame = await this.loadByPath<SpriteFrame>(path, SpriteFrame);
		this._spriteFrameCache.set(fileName, { asset: spriteFrame, lastUsed: Date.now() });
		this.enforceCacheLimit();
		return spriteFrame;
	}

	public async loadPrefab(fileName: string): Promise<Prefab> {
		await this.ready();
		const cached = this._prefabCache.get(fileName);
		if (cached) {
			cached.lastUsed = Date.now();
			return cached.asset;
		}
		const path = this.getPathByName(fileName);
		const prefab = await this.loadByPath<Prefab>(path, Prefab);
		this._prefabCache.set(fileName, { asset: prefab, lastUsed: Date.now() });
		this.enforceCacheLimit();
		return prefab;
	}

	public releaseByName(fileName: string): void {
		const path = this._pathMap[fileName];
		this._spriteFrameCache.delete(fileName);
		this._prefabCache.delete(fileName);
		if (path) {
			this.releaseResourcePaths(path);
		}
	}

	public releaseAll(): void {
		for (const path of Object.values(this._pathMap)) {
			this.releaseResourcePaths(path);
		}
		this._spriteFrameCache.clear();
		this._prefabCache.clear();
	}

	private enforceCacheLimit(): void {
		while (this._spriteFrameCache.size + this._prefabCache.size > this._maxCacheCount) {
			this.evictLeastRecentlyUsedEntry();
		}
	}

	private evictLeastRecentlyUsedEntry(): void {
		let oldestFileName: string | null = null;
		let oldestLastUsed = Number.MAX_SAFE_INTEGER;
		let targetCache: "sprite" | "prefab" | null = null;
		for (const [fileName, entry] of this._spriteFrameCache.entries()) {
			if (entry.lastUsed < oldestLastUsed) {
				oldestLastUsed = entry.lastUsed;
				oldestFileName = fileName;
				targetCache = "sprite";
			}
		}
		for (const [fileName, entry] of this._prefabCache.entries()) {
			if (entry.lastUsed < oldestLastUsed) {
				oldestLastUsed = entry.lastUsed;
				oldestFileName = fileName;
				targetCache = "prefab";
			}
		}
		if (!oldestFileName || !targetCache) {
			return;
		}
		const path = this._pathMap[oldestFileName];
		if (targetCache === "sprite") {
			this._spriteFrameCache.delete(oldestFileName);
			if (!path) {
				return;
			}
			this.releaseResourcePath(path, "/spriteFrame");
			return;
		}
		this._prefabCache.delete(oldestFileName);
		if (!path) {
			return;
		}
		this.releaseResourcePath(path, "/prefab");
	}

	private releaseResourcePath(path: string, suffix: string): void {
		resources.release(path + suffix);
	}

	private releaseResourcePaths(path: string): void {
		resources.release(path + "/spriteFrame");
		resources.release(path + "/prefab");
	}

	private loadByPath<T extends SpriteFrame | Prefab>(path: string, type: typeof SpriteFrame | typeof Prefab): Promise<T> {
		let fullPath: string;
		switch (type) {
			case SpriteFrame:
				fullPath = path + "/spriteFrame";
				break;
			case Prefab:
				fullPath = path;
				break;
			default:
				return Promise.reject(new Error(`Unsupported asset type`));
		}
		return new Promise<T>((resolve, reject) => {
			resources.load(fullPath, type as any, (err, asset) => {
				if (err || !asset) {
					reject(err || new Error(`Failed to load asset: ${fullPath}`));
					return;
				}
				resolve(asset as T);
			});
		});
	}
}
