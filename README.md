# juzi-client

基于 Cocos Creator **3.8.5** 的竖屏游戏客户端框架。业务界面由具体游戏自己加，公共能力集中在 `assets/script/core`。

设计分辨率：`750 x 1344`。

## 环境要求

| 依赖 | 用途 |
| --- | --- |
| [Cocos Creator 3.8.5](https://www.cocos.com/creator-download) | 打开工程、预览、构建 |
| Node.js + npm | 安装 `ts-proto` 等协议生成依赖 |
| Python 3 + `openpyxl` | 导配表、生成资源路径表 |
| `protoc` | 把 `.proto` 编成 `assets/pb` 下的 TypeScript |

## 快速开始

```bash
npm install
bash proto/genPb/genAll.sh
```

用 Cocos Creator 3.8.5 打开本仓库根目录。把 `GameInit` 挂到启动场景上，场景里约定有 `Canvas/PanelLayer` 和 `Canvas/ToastLayer`。

网关地址和版本号在 `assets/script/config/config.ts`。`GameInit` 初始化完成并注入等待界面、断线界面后会连接网关。

## 目录结构

```
juzi-clinet/
├── assets/
│   ├── pb/                    # 协议生成物（不要手改）
│   ├── resources/
│   │   ├── json/              # resourcesMap.json
│   │   └── tables/            # 导表产出
│   └── script/
│       ├── config/            # 网关地址、版本号
│       ├── core/              # 框架：网络、UI、事件、定时器等
│       ├── module/GameInit.ts # 启动入口
│       └── @type/
├── proto/
│   ├── framework/             # 框架协议，common / public / internal
│   ├── game/                  # 可选，同样按三层放置
│   ├── genPb/genAll.sh
│   └── tools/
├── table/                     # 配表工具，Excel 放 table/data/excel
├── tools/genImagePathMap.py
├── import-map.json
└── tsconfig.json
```

路径别名：

| 别名 | 实际路径 |
| --- | --- |
| `@game/*` | `assets/script/*` |
| `@pb/*` | `assets/pb/*` |

```ts
import { Box } from "@game/core/box/Box";
import { Item } from "@pb/common/item";
```

## 框架协议

协议按 `common`、`public`、`internal` 三层存放，生成结果也保持这三层目录，不铺平。客户端编译 `common` 和 `public`。`internal` 留给服务端，不生成到 `assets/pb`。引用路径与目录一致，例如 `@pb/common/common`、`@pb/public/server`。

| 层 | 文件 | 内容 |
| --- | --- | --- |
| `common` | `common.proto` | `MsgType`、`Code`、心跳 |
| `common` | `serverConf.proto` | HTTP / WebSocket / Redis / MySQL 服务配置 |
| `common` | `item.proto` | 背包类型、道具、品质 |
| `public` | `server.proto` | 传输层信封、`Remote`、切服 |
| `public` | `session.proto` | 重连、登出 |
| `internal` |  | 服务端内部协议，客户端不生成 |

玩法协议放到 `proto/game/common` 或 `proto/game/public`，`genAll.sh` 会一并编译。引用框架协议时用 `import "common/common.proto"`、`import "public/server.proto"` 这种路径。`session.proto` 里重连回包的 4–6 号字段预留给游戏登录态，不要改已有字段编号。

报文格式：

```
[2 字节 MsgType 大端] + Protobuf 传输层
```

| MsgType | 含义 |
| --- | --- |
| `MsgReq` | `TransferMessageReq` |
| `MsgRes` | `TransferMessageRsp`，按 `seqId` 配对 |
| `MsgNotify` | `NotifyMessageInf`，按 `msgName` 分发 |

## 启动

`GameInit` 挂在场景上，`onLoad` 时会：

1. 给 `cc.Component` 原型安装 `listen` / `onEvent` / `cancel`
2. 把 `Timer`、`Heartbeat`、`ProtocolHandler`、`EventManager`、`MonitorFactory`、`ResourceManager`、`TableManager`、`UIManager` 放进 `Box`
3. 用 `startScene`、`mainScene` 初始化 `UIManager`
4. 注入等待界面、网络异常界面
5. 调用 `ProtocolHandler.connect()`

等待圈和断线界面通过 `createWaitingUI` / `createNetworkErrorUI` 注入，分别加载 `WidgetWaiting` 和 `WidgetNetworkError`。网络层不直接引用这两个 Prefab 脚本。

连接过程：

1. `GET config.gateAddr`，校验 `version`
2. 用网关返回的 `serverInfo.serverAddr` / `serverPort` 建立 WebSocket，路径为 `/connect/`
3. 连上后心跳；断开则指数退避重连，并用本地会话发重连协议

`serverAddr` 若已带 `ws://` 或 `wss://`，则直接使用该地址。

## 核心用法

服务定位：

```ts
const net = Box.get(ProtocolHandler);
const rsp = await net.requestAsync(C2SXxx, S2CXxx, { /* 字段 */ });
net.onNotify(S2CYyyNotify, (msg) => { /* ... */ });
```

增量同步按根路径注册，框架不绑定具体玩家对象：

```ts
RemoteSync.register("player", (segments, value) => {
    // segments 是去掉根名称后的路径
});
```

界面按 Prefab 文件名前缀挂层：`Panel*` 到 `PanelLayer`，`Toast*` 到 `ToastLayer`，`Widget*` 挂到调用方传入的父节点。资源只传文件名，映射表由 `python tools/genImagePathMap.py` 生成。配表在 `table/` 目录执行 `python parser.py`，表名登记在 `table/clazz/commonWriter.py`。

## 工具命令

```bash
npm install
bash proto/genPb/genAll.sh          # macOS / Linux / Git Bash
proto\tools\gen.bat                 # Windows

cd table && python parser.py        # 需 openpyxl
python tools/genImagePathMap.py
```

## 配置

```ts
export var config = {
    gm: false,
    debug: true,
    gateAddr: "http://localhost/version/",
    version: "0.0.1",
};
```

`gateAddr` 返回的 JSON 需包含 `serverInfo.version`、`serverInfo.serverAddr`、`serverInfo.serverPort`。`version` 必须与客户端一致，否则拒绝连接。
