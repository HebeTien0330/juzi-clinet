import { Prefab, Node, instantiate } from "cc";
import { Box } from "@game/core/box/Box";
import { ResourceManager } from "@game/core/common/ResourceManager";
import { Scene } from "cc";

export enum UIType {
    PANEL = 'Panel',
    TOAST = 'Toast',
    WIDGET = 'Widget'
}

export class UIManager {

    private curScene: Scene | null = null;
    private panelLayer: Node | null = null;
    private toastLayer: Node | null = null;

    init(scene: Scene) {
        this.curScene = scene;
        this.panelLayer = scene.getChildByPath("Canvas/PanelLayer");
        this.toastLayer = scene.getChildByPath("Canvas/ToastLayer");
    }

    public getToastLayer(): Node | null {
        return this.toastLayer;
    }

    public getPanelLayer(): Node | null {
        return this.panelLayer;
    }

    public async create(name: string, callback?: Function, parent?: Node): Promise<Node | undefined> {
        if (name.startsWith(UIType.PANEL)) {
            return await this.createPanel(name, callback);
        }
        if (name.startsWith(UIType.TOAST)) {
            return await this.createToast(name, callback);
        }
        if (name.startsWith(UIType.WIDGET)) {
            return await this.createWidget(name, parent, callback);
        }
        return;
    }

    public close(node: Node, callback?: Function) {
        const name = node.name;
        if (name.startsWith(UIType.PANEL)) {
            return this.closePanel(node, callback);
        }
        if (name.startsWith(UIType.TOAST)) {
            return this.closeToast(node, callback);
        }
        if (name.startsWith(UIType.WIDGET)) {
            return this.closeWidget(node, callback);
        }
        return null;
    }

    // 创建并挂载 Panel 节点
    public async createPanel(name: string, callback?: Function): Promise<Node> {
        const prefab = await Box.get(ResourceManager).loadPrefab(name);
        const node = instantiate(prefab);
        this.panelLayer?.addChild(node);
        node.active = true;
        callback?.();
        return node;
    }

    // 销毁 Panel 节点
    public closePanel(node: Node, callback?: Function) {
        if (!node) {
            return;
        }
        node.destroy();
        callback?.();
    }

    // 创建并挂载 Toast 节点
    private async createToast(name: string, callback?: Function): Promise<Node> {
        const prefab = await Box.get(ResourceManager).loadPrefab(name);
        const node = instantiate(prefab);
        this.toastLayer?.addChild(node);
        node.active = true;
        callback?.();
        return node;
    }

    // 销毁 Toast 节点
    private closeToast(node: Node, callback?: Function) {
        if (!node) {
            return;
        }
        node.destroy();
        callback?.();
    }

    // 创建并挂载 Widget 节点
    public async createWidget(name: string, parent?: Node, callback?: Function): Promise<Node | undefined> {
        if (!parent) {
            return;
        }
        const prefab = await Box.get(ResourceManager).loadPrefab(name);
        const node = instantiate(prefab);
        parent.addChild(node);
        node.active = true;
        callback?.();
        return node;
    }

    // 销毁 Widget 节点
    public closeWidget(node: Node, callback?: Function) {
        if (!node) {
            return;
        }
        node.destroy();
        callback?.();
    }

}
