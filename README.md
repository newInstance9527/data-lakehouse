# DataLakeHub · 湖仓一体数据治理平台

Vue 3 纯静态演示门户：覆盖数据接入 → 资产治理 → 开发发布 → 质量安全 → 数据服务 → 申请审批 → 运维监控 → AI 平台能力全链路。交互以 Toast / 抽屉 / 路由跳转模拟，**不接真实后端 API**。

远程仓库：https://github.com/newInstance9527/data-lakehouse.git

---

## 环境说明

| 项 | 要求 |
|----|------|
| Node.js | **≥ 20.19**（推荐 22.x LTS） |
| 包管理 | npm（仓库含 `package-lock.json`） |
| 浏览器 | 现代 Chromium / Firefox / Edge |
| 后端 | 无；演示数据在 `src/data/` |

### 技术栈

- **Vue 3.5** + **Vite 8** + **Vue Router 4**（Hash 模式，便于静态部署）
- 无 UI 框架依赖，样式为自研 Design Tokens（`src/styles/`）
- 列表统一分页：默认 **10** 条 / 页（`src/config/pagination.js`）

### 本地运行

```bash
# 安装依赖
npm install

# 开发（本机 http://localhost:5173 ，局域网用终端打印的 Network 地址）
npm run dev

# 生产构建 → dist/
npm run build

# 预览构建产物
npm run preview
```

### 部署提示

构建产物为静态站点，可直接放到 Nginx / OSS / GitHub Pages 等；因使用 Hash 路由，无需服务端 rewrite。

### 演示约定

1. 网关口径：**APISIX + SQLREST**；计算引擎：**Flink / Spark / DataX**；查询闸门：**Trino**。
2. 元数据 / ACL 叙事对齐 **Gravitino**（演示文案，非真实接入）。
3. 密钥类字段仅前端脱敏展示，文案标注 Vault 保管。

---

## 目录说明

```
data-lakehouse/
├── index.html                 # 入口 HTML
├── package.json               # 依赖与脚本
├── vite.config.js             # Vite 配置（@ → src）
├── public/                    # 静态公共资源
└── src/
    ├── main.js                # 应用启动
    ├── App.vue
    ├── assets/                # 静态资源
    ├── config/
    │   ├── nav.js             # 侧栏分组 / 面包屑
    │   └── pagination.js      # 分页默认值与选项
    ├── router/index.js        # 路由表（与 nav 对齐）
    ├── layouts/
    │   └── AppLayout.vue      # 侧栏 + 顶栏 + 内容区壳层
    ├── views/                 # 页面（一路由一视图，约 30+）
    ├── components/            # 业务 / 通用组件
    │   ├── common/            # 页头、抽屉、Toast、分页、表单弹窗等
    │   ├── catalog/           # 资产抽屉、注册资产
    │   ├── datasource/        # 数据源抽屉、注册
    │   ├── dataservice/       # API 构建向导
    │   ├── etl/               # DAG 画布、节点配置、运行历史
    │   ├── knowledge/         # 知识库新建（文档/分片）
    │   ├── lineage/           # 血缘图
    │   └── standard/          # 标准注册弹窗
    ├── composables/           # 组合式逻辑（分页、Toast、资产/ETL/血缘等）
    ├── data/                  # 静态演示数据与表单定义
    ├── utils/                 # SQL 格式化、Schema、ETL 辅助等
    └── styles/                # tokens / layout / components / pages
```

| 目录 | 职责 |
|------|------|
| `views/` | 路由页面，聚合模块 UI |
| `components/` | 可复用交互块（抽屉、向导、DAG 等） |
| `data/` | KPI、列表 Mock、`createForms`、pageGuides |
| `composables/` | 跨页状态与分页等可组合逻辑 |
| `config/` | 导航与全局分页等配置 |

---

## 功能模块说明

侧栏按业务链路分组，路由与 `src/config/nav.js` 一致。

### 工作台

| 模块 | 路由 | 说明 |
|------|------|------|
| 总览仪表盘 | `/` | 平台 KPI、数据流向、关键链路与告警概览 |

### ① 数据接入

| 模块 | 路由 | 说明 |
|------|------|------|
| 数据源管理 | `/datasource` | 源注册、连通性、表清单；支持卡片/列表/拓扑 |
| ETL 编排 | `/integration` | DAG 编排、节点配置、试跑与运行历史（演示） |

### ② 数据资产

| 模块 | 路由 | 说明 |
|------|------|------|
| 资产目录 | `/catalog` | 湖表/视图资产检索、详情抽屉、关联标准与血缘 |
| 字段血缘 | `/lineage` | 表/字段级上下游、影响分析与传播 |
| 数据标准 | `/standard` | 字段标准、码值、映射、检测与命名规范 |
| 生命周期 | `/lifecycle` | 分层留存、归档与冷热策略 |
| 存储趋势 | `/lifecycle/storage` | 存储量与成本趋势演示 |
| 合规删除 | `/compliance` | 被遗忘权等删除工单与审批链（演示） |

### ③ 数据开发

| 模块 | 路由 | 说明 |
|------|------|------|
| 数据开发 / SQL | `/develop` | 作业/脚本开发工作台 |
| 即席查询 | `/query` | Trino 查询闸门演示、结果区与限流叙事 |
| 环境与发布 | `/publish` | 发布单、门禁、回滚与环境晋升 |

### ④ 数据质量

| 模块 | 路由 | 说明 |
|------|------|------|
| 数据质量 | `/quality` | 规则、门禁阻断与质量分 |
| 安全与权限 | `/security` | 脱敏、列级权限与审批挂钩 |
| 数据契约 | `/contract` | Schema 契约与兼容性检查演示 |

### ⑤ 数据服务

| 模块 | 路由 | 说明 |
|------|------|------|
| 数据服务 | `/dataservice` | API 构建向导（指标/表/SQL）、限流、已发布详情、APISIX 路由叙事 |
| 指标中心 | `/metrics` | 原子/衍生/复合指标生命周期；可跳转申请权限/变更 |
| 出湖与回流 | `/export` | 出湖任务与回流配置演示 |

### ⑥ 申请与审批

| 模块 | 路由 | 说明 |
|------|------|------|
| 申请中心 | `/apply` | 权限 / 表 / 指标 / API / 发布等工单；API 审批通过后签发调用令牌（演示） |

### ⑦ 运维监控

| 模块 | 路由 | 说明 |
|------|------|------|
| 任务运维 | `/ops` | 作业运行态、失败重试叙事 |
| 链路调用监控 | `/linktrace` | 服务调用链路追踪 |
| 基础设施监控 | `/infra` | 集群/组件健康度 |
| 根因分析台 | `/rootcause` | 告警根因串联（质量/血缘/任务） |
| 可靠性中心 | `/reliability` | SLO / 对账 / 摘牌等可靠性能力 |
| 查询治理与成本 | `/querygov` | 查询配额、扫描量与成本治理 |

### ⑧ 平台能力

| 模块 | 路由 | 说明 |
|------|------|------|
| 工作空间 | `/workspace` | 多空间隔离、成员与资源规格 |
| AI 助手 | `/aiassistant` | 对话式 SQL/排障；引用知识库与资产上下文 |
| AI 模型管理 | `/aimodel` | 模型接入、**上下文与输入/输出价格**维护、路由策略与用量 |
| 知识库 | `/knowledge` | 短文本 / **文档上传**、分片与嵌入配置（演示向量化）、供助手引用 |

---

## 许可与定位

本仓库为 **产品演示 / 学习用前端门户**，非生产级数据平台实现。二次开发请自行对接真实元数据、调度、网关与向量服务。
