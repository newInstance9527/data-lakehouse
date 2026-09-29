# DataLakeHub · 湖仓一体数据治理门户

Vue 3 门户前端：对接 **Snowy / LH 后端**（`/lakehouse` + `/lh/*`），覆盖数据接入 → 资产治理 → 开发发布 → 质量安全 → 数据服务 → 申请审批 → 运维监控 → AI 平台能力。

远程仓库：https://github.com/newInstance9527/data-lakehouse.git  
后端仓：同 monorepo `lakehouse-gov/`（Spring Boot + Sa-Token）。

---

## 环境说明

| 项 | 要求 |
|----|------|
| Node.js | **≥ 20.19**（推荐 22.x LTS） |
| 包管理 | npm（仓库含 `package-lock.json`） |
| 浏览器 | 现代 Chromium / Firefox / Edge |
| 后端 | 本地或联调 Snowy（默认代理 `/lakehouse` → `8080`） |

### 技术栈

- **Vue 3.5** + **Vite 8** + **Vue Router 4**（Hash 模式）
- 无 UI 框架依赖；样式为自研 Design Tokens（`src/styles/`）
- API：`src/api/*`（CommonResult + Sa-Token）；列表分页默认 **10** 条 / 页

### 本地运行

```bash
# 安装依赖
npm install

# 开发（本机 http://localhost:5173）
# 需后端已启：spring.profiles.active=local
npm run dev

# 生产构建 → dist/
npm run build

# 预览构建产物
npm run preview
```

### 部署提示

构建产物为静态站点，可放到 Nginx / OSS；Hash 路由无需服务端 rewrite。网关将 `/lakehouse` 反代到 Snowy。

### 数据与空态约定

1. 主路径读真 API；**禁止** Fail→Mock 灌演示行（见仓库 `doc/命名与工程约束.md` §6.1）。
2. `src/data/` 仅保留 **forms / guides / meta / 静态选项**；不以假目录冒充业务 SoT。
3. 网关口径：SQLREST Gateway；计算：Flink / Spark / DataX；查询闸门：Trino；元数据：Gravitino + OpenMetadata。

---

## 目录说明

```
lakehouse/
├── index.html
├── package.json
├── vite.config.js
├── public/
└── src/
    ├── main.js
    ├── App.vue
    ├── api/                   # HTTP 客户端与各模块 API
    ├── config/
    │   ├── nav.js             # 侧栏分组 / 面包屑
    │   └── pagination.js
    ├── router/index.js
    ├── layouts/AppLayout.vue
    ├── views/                 # 一路由一视图
    ├── components/
    ├── composables/
    ├── data/                  # forms / guides / meta（非演示业务行）
    ├── i18n/
    └── styles/
```

环境变量：`VITE_API_BASE`（默认 `/lakehouse`）、`VITE_APP_ENV`（壳层环境标签，默认 `DEV`）。
