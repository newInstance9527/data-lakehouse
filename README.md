# DataLakeHub · 湖仓一体数据治理门户（前端）

Vue 3 门户：对接 **Snowy / lakehouse-gov**（上下文 `/lakehouse`，业务 API `/lh/*`）。覆盖元数据 → 集成 → 资产 → 开发发布 → 质量安全 → 指标服务 → 申请审批 → 运维监控 → AI / 工作空间。

| 项 | 说明 |
|----|------|
| 后端仓 | `lakehouse-gov`（Spring Boot 3 + Sa-Token） |
| 设计文档 | 同工作区 `doc/`（模块说明与跨模块待办） |

---

## 1. 快速启动

### 环境

| 项 | 要求 |
|----|------|
| Node.js | ≥ **20.19**（推荐 22.x LTS） |
| 包管理 | npm（使用仓库内 `package-lock.json`） |
| 后端 | 本机已启 `lakehouse-gov`（默认 `http://127.0.0.1:8080/lakehouse`） |

### 命令

```bash
npm install

# 开发：http://localhost:5173 ，/lakehouse 代理到后端
npm run dev

# 生产构建 → 目录 lakehouse/
npm run build

# 预览构建产物（默认 4173）
npm run preview
```

### 环境变量

复制 `.env.example` → `.env` / `.env.development`：

| 变量 | 默认 | 说明 |
|------|------|------|
| `VITE_API_BASE` | `/lakehouse` | 前端请求前缀（与后端 context-path 一致） |
| `VITE_APP_ENV` | `DEV` | 顶栏环境标签：`DEV` / `STG` / `PROD` |
| `VITE_API_PROXY` | （可选） | 仅 Vite 代理目标；未设则为 `http://127.0.0.1:8080` |

登录走 Snowy B 端：`POST /lakehouse/auth/b/doLogin`（密码 SM2 加密）；Token 存 `localStorage`（`LH_TOKEN`），请求头字段名 `token`。

### 部署

构建产物为静态站点（Hash 路由，无需服务端 rewrite）。Nginx / OSS 托管即可；网关将 `/lakehouse` 反代到 Snowy。

---

## 2. 架构

```
浏览器 (Hash Router)
    │  VITE_API_BASE=/lakehouse
    ▼
Vite Dev Proxy ──► Snowy (8080/lakehouse)
    │                    │
    │                    ├─ /auth/b/*     登录会话
    │                    ├─ /sys/*        用户/组织/菜单
    │                    └─ /lh/*         湖仓治理业务
    ▼
views ← composables ← api/* ← http.js (CommonResult)
```

**约定：**

- 主路径读真 API；**禁止** Fail→Mock 灌演示业务行（见 `doc/命名与工程约束.md`）。
- `src/data/` 只放表单 schema、页内 guide、静态选项，不充当业务 SoT。
- 列表默认分页 **10** 条（`src/config/pagination.js`）。

**技术栈：** Vue 3.5 · Vite 8 · Vue Router 4（Hash）· Monaco（SQL 工作台）· sm-crypto · 自研 Design Tokens（无 Ant/Element 依赖）。

---

## 3. 代码结构

```
lakehouse/
├── index.html
├── package.json
├── vite.config.js          # 端口 5173；代理 /lakehouse
├── .env.example
├── public/
└── src/
    ├── main.js / App.vue
    ├── api/                # HTTP 与分模块 API（auth、catalog、quality…）
    ├── config/
    │   ├── nav.js          # 侧栏分组（与路由对齐）
    │   └── pagination.js
    ├── router/index.js     # 路由表 + 登录守卫
    ├── layouts/AppLayout.vue
    ├── views/              # 一路由一页面
    ├── components/         # 通用与领域组件
    ├── composables/        # session、theme、各页状态钩子
    ├── data/               # forms / guides / meta
    ├── i18n/               # 中英文案
    ├── styles/             # tokens、layout、页面样式
    ├── utils/              # SM2、日期等
    └── assets/
```

| 目录 | 职责 |
|------|------|
| `api/` | 封装后端接口；`http.js` 统一错误码与 401 跳转登录 |
| `composables/` | 可复用页面逻辑（如 `useQuality`、`useInbox`） |
| `views/` | 页面壳；重逻辑下沉到 composable / api |
| `config/nav.js` | 侧栏信息架构；改导航优先改此处再对路由 |

---

## 4. 功能模块（与侧栏对齐）

| 分组 | 路由要点 | 能力摘要 |
|------|----------|----------|
| **工作台** | `/` | 总览仪表盘 |
| **元数据** | `/domain` `/standard` `/contract` | 数据域、标准、契约 |
| **数据集成** | `/datasource` `/integration` `/export` | 数据源、ETL 编排、出湖回流 |
| **数据资产** | `/catalog` `/lineage` `/lifecycle` `/lifecycle/storage` `/compliance` | 目录、血缘、生命周期、存储趋势、合规删除 |
| **数据开发** | `/develop` `/query` `/publish` | SQL 工作台、即席查询、环境与发布 |
| **数据质量** | `/quality` | 规则、evaluate 执行、门禁、运行历史 |
| **治理与安全** | `/security` | 授权与策略 |
| **申请审批** | `/apply` | 申请中心工单 |
| **指标中心** | `/metrics` `/metrics/catalog` | 指标概览与目录 |
| **数据服务** | `/dataservice/*` | 概览、API 目录、构建台、运行与网关 |
| **运维监控** | `/ops` `/linktrace` `/rootcause` `/reliability` `/querygov` `/infra` | 任务、链路、根因、可靠性、查询成本、基建 |
| **平台能力** | `/workspace` `/aiassistant` `/aimodel` `/knowledge` | 工作空间、AI 助手/模型、知识库 |
| **系统管理** | `/sys/org|position|users|roles|menus` | 复用 Snowy 组织与权限 |
| **个人** | `/usercenter`、顶栏站内信 | 个人中心与消息 |

---

## 5. 联调检查清单

1. 后端 `spring.profiles.active=local` 已启动，浏览器可打开 `http://localhost:8080/lakehouse/doc.html`。
2. `npm run dev` 后登录默认账号（以后端种子为准，常见 `superAdmin`）。
3. 网络面板请求前缀为 `/lakehouse/...`，无 CORS（走 Vite 代理）。
4. 若改后端端口：设环境变量 `VITE_API_PROXY=http://127.0.0.1:<port>` 后重启 Vite。

---

## License

业务门户代码随项目维护；第三方依赖遵循各自许可证。
