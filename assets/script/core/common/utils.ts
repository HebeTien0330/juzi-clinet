import { UIRenderer } from "cc";
import { Material } from "cc";
import { builtinResMgr } from "cc";

export const generateUUID = (): string => {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    	return crypto.randomUUID();
  	}
  	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		const buf = new Uint8Array(16);
		crypto.getRandomValues(buf);
		buf[6] = (buf[6] & 0x0f) | 0x40; // version 4
		buf[8] = (buf[8] & 0x3f) | 0x80; // variant 10
		const hex = [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  	}
  	return generateUUIDFallback();
}

const generateUUIDFallback = (): string => {
  	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    	const r = Math.random() * 16 | 0;
    	const v = c === 'x' ? r : (r & 0x3 | 0x8);
    	return v.toString(16);
  	});
}

export const isObject = (value: any) => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const mergedObj = (obj1: any, obj2: any) => {
    return { ...obj1, ...obj2 };
}

/**
 * 合并两个对象：
 * - 独有字段都保留
 * - 共有字段（交集）优先用 override 的有效值，空字符串/null/undefined 则回退到 base
 */
export const intersectMerge = <T extends Record<string, any>>(base: any, override: T): T => {
    const a = isObject(base) ? base : {};
    const b = isObject(override) ? override : {};
    const result: Record<string, any> = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
        const hasA = Object.prototype.hasOwnProperty.call(a, key);
        const hasB = Object.prototype.hasOwnProperty.call(b, key);
        if (hasA && hasB) {
            const ov = b[key];
            result[key] = ov !== undefined && ov !== null && ov !== "" ? ov : a[key];
            continue;
        }
        result[key] = hasB ? b[key] : a[key];
    }
    return result as T;
}

/**
 * 节点置灰
 * @param node 
 * @param isGray 
 * @returns 
 */
export const setGray = (node: Node | any, isGray: boolean): void => {
    if(node == null || node.isValid == false){
        return;
    }
    let material: Material = builtinResMgr.get(isGray ? "ui-sprite-gray-material": "");
    let renders = node.getComponentsInChildren(UIRenderer);
    for(let i = 0; i < renders.length; i++){
        renders[i].customMaterial = material;
    }
}

/**
 * 生成 [min, max] 范围内的随机整数（含两端）
 */
export const randomNum = (min: number, max: number): number => {
    if (max < min) {
        const tmp = min;
        min = max;
        max = tmp;
    }
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 从 [min, max] 中生成 count 个不重复的随机整数
 */
export const generateUniqueRandoms = (min: number, max: number, count: number): number[] => {
    if (max < min || count <= 0) {
        return [];
    }
    const range = max - min + 1;
    const n = Math.min(count, range);
    const pool = Array.from({ length: range }, (_, i) => i + min);
    for (let i = 0; i < n; i++) {
        const j = i + Math.floor(Math.random() * (range - i));
        const tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
    }
    return pool.slice(0, n);
}

/**
 * 格式化时间
 * @param seconds 
 * @returns 
 */
export const formatTime = (seconds: number): string => {
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
};
