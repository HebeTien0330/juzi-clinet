import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;
import { Box } from "@game/core/box/Box";
import { ResourceManager } from "@game/core/common/ResourceManager";
import { TableManager } from "@game/core/common/TableManager";
import { installEventMethodsToComponentPrototype, EventManager } from "@game/core/event/Manager";
import { ProtocolHandler } from "@game/core/network/ProtocolHandler";
import { Scene } from 'cc';
import { UIManager } from '@game/core/common/UIManager';
import { Heartbeat } from '@game/core/network/Heartbeat';
import { Timer } from '@game/core/timer/Timer';
import { MonitorFactory } from '@game/core/monitor/Monitor';
import { createNetworkErrorUI, createWaitingUI } from '@game/module/component/NetworkUI';

@ccclass('GameInit')
export class GameInit extends Component {

    @property(Scene)
    private startScene: Scene = null as any;

    @property(Scene)
    private mainScene: Scene = null as any;

    start() {
        
    }

    update(deltaTime: number) {
        
    }

    async onLoad() {
        await this.init();
    }

    async init() {
        // 将事件方法安装到cocos组件上
        installEventMethodsToComponentPrototype();
        // 初始化定时器
        if (!Box.get(Timer)) {
            Box.add(new Timer());
        }
        // 初始化心跳（需在协议连接前注册，onOpen 会立刻 start）
        if (!Box.get(Heartbeat)) {
            Box.add(new Heartbeat());
        }
        // 初始化协议管理器（先注册，UI 注入后再 connect）
        let shouldConnect = false;
        if (!Box.get(ProtocolHandler)) {
            Box.add(new ProtocolHandler());
            shouldConnect = true;
        }
        // 初始化事件管理器
        if (!Box.get(EventManager)) {
            Box.add(new EventManager());
        }
        // 初始化数据监听
        if (!Box.get(MonitorFactory)) {
            Box.add(new MonitorFactory());
        }
        // 初始化资源管理器
        if (!Box.get(ResourceManager)) {
            Box.add(new ResourceManager());
            Box.get(ResourceManager).init();
        }
        // 初始化表格管理器
        if (!Box.get(TableManager)) {
            Box.add(new TableManager());
        }
        // 初始化UI管理器
        if (!Box.get(UIManager)) {
            Box.add(new UIManager());
        }
        if (!!this.startScene) {
            Box.get(UIManager).init(this.startScene);
        }
        if (!!this.mainScene) {
            Box.get(UIManager).init(this.mainScene);
        }
        // 网络层 UI 由游戏侧注入，避免 ProtocolHandler / Heartbeat 直接依赖具体界面
        Box.get(ProtocolHandler)?.registerWaitingUI(createWaitingUI());
        Box.get(Heartbeat)?.registerNetworkErrorUI(createNetworkErrorUI());
        // UI 注入完成后再建连
        if (shouldConnect) {
            Box.get(ProtocolHandler).connect();
        }
    }
}
