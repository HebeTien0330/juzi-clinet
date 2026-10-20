import { Node } from "cc";
import { Box } from "@game/core/box/Box";
import { UIManager } from "@game/core/common/UIManager";

/** 网络层与 UI 解耦：由游戏侧在初始化时注册具体展示实现 */
export type NetworkUIHandler = {
    show: () => void | Promise<void>;
    hide: () => void;
};

function createOverlayHandler(widgetName: string): NetworkUIHandler {
    let node: Node | null = null;
    let showing = false;
    let desired = false;

    const show = async () => {
        desired = true;
        if (showing || node?.isValid) {
            return;
        }
        const UIMgr = Box.get(UIManager);
        const parent = UIMgr?.getToastLayer() ?? UIMgr?.getPanelLayer();
        if (!UIMgr || !parent) {
            console.warn(`ui layer unavailable, skip ${widgetName}`);
            return;
        }
        showing = true;
        try {
            const created = await UIMgr.createWidget(widgetName, parent);
            if (!created?.isValid) {
                return;
            }
            // 异步加载完成时若已要求关闭，则丢弃本次创建
            if (!desired) {
                UIMgr.closeWidget(created);
                return;
            }
            node = created;
        }
        catch (err) {
            console.error(`show ${widgetName} failed:`, err);
        }
        finally {
            showing = false;
        }
    };

    const hide = () => {
        desired = false;
        if (!node?.isValid) {
            node = null;
            return;
        }
        Box.get(UIManager)?.closeWidget(node);
        node = null;
    };

    return { show, hide };
}

export function createWaitingUI(): NetworkUIHandler {
    return createOverlayHandler("WidgetWaiting");
}

export function createNetworkErrorUI(): NetworkUIHandler {
    return createOverlayHandler("WidgetNetworkError");
}
