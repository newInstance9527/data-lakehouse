/**
 * 各功能页右上角「说明」
 * sections.type:
 *   text  | list | steps | example | note | kv
 */

function guide(title, sections) {
  return { title: `${title} · 说明`, sections }
}

function pending(title, feature, scenes, exampleSteps) {
  return guide(title, [
    { heading: '模块功能', type: 'text', content: feature },
    { heading: '适用场景', type: 'list', items: scenes },
    {
      heading: '使用示例（规划）',
      type: 'steps',
      items: exampleSteps,
    },
    {
      heading: '当前状态',
      type: 'note',
      content: '本模块尚未从演示 HTML 迁入 Vue 门户，以上为规划说明；迁入后将补齐交互与数据。',
    },
  ])
}

export const PAGE_GUIDES = {
  overview: guide('总览仪表盘', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '平台驾驶舱：沿「接入 → 入湖 → 治理 → 服务」主链路汇总健康度。',
        '核心 KPI 配微折线；质量用趋势折线、服务用柱状、状态用环形、分层/指标用横向条、血缘用对比条、标准用合规环——按内容选型，配色仅主色 + 语义色。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '晨会 / 周会快速查看平台整体是否健康',
        '从 KPI 或图表跳转到对应治理模块排查',
        '向业务方演示主数据路径与关键水位',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '右上角选择时间范围（演示切换趋势观感）',
        '点击主链路步骤或 KPI 进入对应模块',
        '在图表卡片点「详情」下钻',
        '需要刷新观感时点「↻ 刷新」',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '下游', value: '数据源、资产目录、ETL、血缘、标准、服务、指标、质量' },
        { label: '角色', value: '平台管理员、数据治理、运维值班' },
      ],
    },
  ]),

  datasource: guide('数据源管理', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '登记与管理多类型异构数据源：关系库、消息队列、对象/文件存储、HTTP API 等（对齐 OpenMetadata 主类）。',
        '维护连通状态、负责人、用途（入湖 / 仅元数据采集 / 出湖目标），并支持 Schema 同步与进入表清单。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '新业务系统上线：先登记源，再配置 ETL 入湖',
        '仅做目录采集：Tableau / Airflow 等登记为「仅元数据」',
        '出湖目标：Doris、FTP、对象存储等作为 sink 绑定',
        '故障排查：查看连通性、健康度与最近同步情况',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '点击「＋ 注册数据源」，选择类型与用途，填写连接信息并保存',
        '在列表中按分类 / 状态筛选，或搜索名称、IP、负责人',
        '打开详情侧栏查看连接、Schema、治理信息；可做连通性测试',
        '点击进入「表清单」，同步或手工维护源端表元数据',
        '需要批量拉 Schema 时使用「🔄 批量同步」（演示）',
      ],
    },
    {
      heading: '示例：登记 MySQL 交易库',
      type: 'example',
      content:
        '类型：MySQL\n用途：数据入湖\nHost：10.x.x.x:3306\n库：trade\n推荐引擎：Flink CDC（增量）/ DataX（全量）\n下一步：同步表清单 → 在 ETL 中引用该源',
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '业务系统 / 运维提供连接信息' },
        { label: '下游', value: '表清单、ETL 编排、资产目录、出湖目标' },
      ],
    },
  ]),

  'source-tables': guide('表清单', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '针对某一个已登记数据源，展示其下的表（或 Topic / 路径）元数据清单。',
        '字段通常包括：表名、中文名、行数/体量、主键、分区、编码、注释、同步时间等。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '入湖前确认源端有哪些表、主键与分区策略',
        '源库临时不可连时，手工补录关键表以便继续建模',
        '为「注册资产」提供可选源表列表',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '从数据源列表进入某源的「表清单」',
        '点击「🔄 同步清单」从源端拉取（演示为模拟）',
        '用搜索框按表名 / 中文名过滤，分页浏览',
        '对缺失表点击「＋ 手动添加」补录核心字段',
        '回到资产目录「注册新资产」时，可选择本清单中的表',
      ],
    },
    {
      heading: '示例：补录 ODS 订单表',
      type: 'example',
      content:
        '表名：s_order\n中文名：订单主表\n主键：order_id\n分区：无（入湖后按 dt）\n注释：交易库订单近原样\n用途：后续注册为 ods_trade.s_order',
    },
    {
      heading: '注意',
      type: 'note',
      content: '表清单描述的是「源端对象」；湖内分层资产请在「资产目录」中注册与治理。',
    },
  ]),

  catalog: guide('资产目录', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '湖内数据资产的统一目录：按 ODS / DWD / DWS / ADS / DIM 分层与业务域浏览。',
        '支持按关联数据源过滤、注册新资产、查看详情（字段、标签、质量、血缘入口等）。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '分析师 / 开发查找可用表与口径说明',
        '治理同学登记 DWD 明细、ADS 看板表等湖内资产',
        '从某个数据源反查「已入湖关联了哪些资产」',
        '作为血缘、质量、标准落地的资产锚点',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '左侧按数据源 / 分层 / 域筛选，右侧浏览资产卡片或列表',
        '点击「+ 注册新资产」：选择源与表 → 指定分层与域 → 提交',
        '打开资产详情查看字段结构、标签与治理信息',
        '需要导出时使用「资产导出」（演示 CSV）',
      ],
    },
    {
      heading: '示例：注册 DWD 订单明细',
      type: 'example',
      content:
        '源：mysql-trade / s_order\n分层：DWD · 交易域\n资产名：dwd_order_detail\n说明：清洗标准化 · 状态码映射\n下一步：在数据标准中核对 order_status 映射与落地检测',
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '数据源、表清单、ETL 入湖作业' },
        { label: '下游', value: '字段血缘、数据标准、质量、即席查询、数据服务' },
      ],
    },
  ]),

  standard: guide('数据标准', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '统一管理企业级数据口径：标准字段、标准码值、命名规范；并查看源到标准映射与落地检测结果。',
        'KPI 区展示字段/码值规模、映射量、达标率与待修复项；下方按 Tab 分页浏览。',
      ],
    },
    {
      heading: '五个 Tab 分别做什么',
      type: 'kv',
      items: [
        { label: '标准字段', value: '统一字段名、类型、单位、业务含义（如 pay_amt 单位元）' },
        { label: '标准码值', value: '枚举字典（如订单状态 STD-C0021），可绑定字段' },
        { label: '源到标准映射', value: '源字段 → 标准字段的转换规则，供 ETL 引用' },
        { label: '落地检测', value: '落地表是否符合码值/类型/单位/脱敏等抽检结果' },
        { label: '命名规范', value: '表/任务/指标等命名模板（如 dwd_<域>_<实体>_<粒度>）' },
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '建模评审：先定标准字段与码值，再写清洗 SQL',
        '跨系统对齐：多个源库「状态码」不一致时，统一映射到 STD-C0021',
        '入湖验收：DWD 落地后看检测是否有阻断/告警',
        '研发规范：新建表/任务名是否符合命名规范',
      ],
    },
    {
      heading: '如何产生：映射 vs 检测',
      type: 'text',
      content: [
        '映射：在 ETL / 清洗作业中定义（或治理同学手工补录）——「源字段怎么变成标准字段」。',
        '检测：表落地后由定时/触发任务跑出来的结果——「落地表是否仍符合标准」，不是手填配置。',
        '命名规范：管理员维护的配置规则，支持「＋ 新建规范」。',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '「＋ 新建标准」→ 注册字段 order_status 或码值 STD-C0021（绑定字段可选已有标准字段）',
        '在「标准码值」中用编码+含义行编辑枚举，而不是手写拼接串',
        '到「源到标准映射」查看 s_order.stat → order_status(STD-C0021) 等规则',
        '到「落地检测」查看 dwd_order_detail.order_status 码值合规结果',
        '「＋ 新建规范」补充如 job_<层>_<表>_<动作> 的命名模板',
      ],
    },
    {
      heading: '示例：订单状态口径闭环',
      type: 'example',
      content:
        '1. 标准码值 STD-C0021：0=草稿 … 5=已关闭\n2. 映射：s_order.stat → order_status(STD-C0021)（CASE 转换）\n3. ETL 清洗 SQL 引用该字典写入 dwd_order_detail\n4. 落地检测：码值合规；若出现未映射码值 → 告警/阻断\n5. 质量模块可进一步配置同口径规则',
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '引用方', value: 'ETL 编排、数据开发、资产建模、数据质量' },
        { label: '说明', value: '落地检测结果可在质量模块配置同口径规则与阻断（质量模块待迁入）' },
      ],
    },
  ]),

  integration: guide('ETL 编排', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '用 DAG 画布编排入湖、清洗转换与出湖作业，引擎可选 Flink / Spark / DataX。',
        '左侧选任务，中间从算子面板拖入节点并连线，右侧配置任务与节点参数；可绑定已登记数据源，映射节点可引用数据标准码值。',
      ],
    },
    {
      heading: '算子分类',
      type: 'kv',
      items: [
        { label: '数据源', value: 'CDC/库表、API 抽取、文件/FTP' },
        { label: '清洗转换', value: '清洗规则、转换/SQL、字段映射（可挂标准）' },
        { label: '控制', value: '质量门禁、并行/条件分支、UNION' },
        { label: '目标', value: 'Iceberg、CK、Kafka、对象存储、FTP、关系库、搜索、BI' },
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '交易库 Flink CDC 入 ODS，再清洗入 DWD/ADS',
        '合作方文件经 FTP → Landing → Iceberg ODS',
        '出湖到关系库 / 搜索引擎 / BI',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '选择示例任务 dag.trade_dwd，或「＋ 新建任务」',
        '从左侧算子点击/拖拽添加节点；拖节点可移动位置',
        '点击节点输出端口，再点目标输入端口完成连线',
        '在右侧配置绑定数据源、SQL、标准引用、目标表等',
        '「校验」检查源/目标与连线；「保存 / 发布」为演示反馈',
      ],
    },
    {
      heading: '示例：订单入湖主路径',
      type: 'example',
      content:
        'source(CDC s_order) → sink_iceberg(ODS)\n→ clean(DWD) → mapping(STD-C0021)\n→ transform(DWS) → quality → parallel\n→ sink_iceberg(ADS) + sink_bi(Superset)',
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '数据源管理、表清单、数据标准' },
        { label: '下游', value: '资产目录、任务运维、数据质量' },
      ],
    },
  ]),

  lineage: guide('字段血缘', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '端到端字段/表级血缘：源表 → 加工表 → 报表/指标，支持焦点资产的上下游影响分析。',
        '右侧展示字段级变更评估（类型变更、标准映射、下游传播清单），可生成评估或阻断 DDL。',
      ],
    },
    {
      heading: '血缘如何产生',
      type: 'list',
      items: [
        '演示主图：交易域 GMV 线（源 → ODS/DIM → DWD → DWS/ADS → 报表/指标/API）',
        '字段明细：可由 ETL 编排中的 fieldMaps / 清洗规则 / SQL 解析同步',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '改字段前评估下游影响',
        '质量告警时向上追溯源头',
        '审计「数据从哪来、到哪去」',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '选择焦点资产，查看图谱高亮与上下游清单',
        '在「字段级」查看 pay_amt 变更影响与阻断动作',
        '需要时导出 SVG；字段明细可分页浏览并同步 ETL',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: 'ETL 编排、数据源、资产目录' },
        { label: '下游', value: '质量告警追溯、变更影响、指标口径' },
      ],
    },
  ]),

  lifecycle: guide('生命周期与小文件治理', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '管理 Iceberg 表热温冷分层、快照保留、孤儿文件清理与小文件合并（compaction）。',
        '展示合规工单待办预览；完整创建/审批/执行见「合规删除」；存储水位见「存储趋势」。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '降低冷数据与小文件带来的存储/查询成本',
        '满足合规保留与销毁要求',
        '排查孤儿文件与快照膨胀',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '查看 KPI 与存储分层水位',
        '点击「存储趋势」进入近 7 日增长与异常表分析',
        '合规删除：创建工单或进入工单管理',
        '在策略表调整保留天数或触发 compaction',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '资产目录、ETL 编排、数据开发' },
        { label: '下游', value: '合规删除、存储趋势、任务运维、基础设施监控' },
      ],
    },
  ]),

  compliance: guide('合规删除工单', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '管理被遗忘权、错误擦除、监管责令、合同到期等不可逆删除工单。',
        '流程：创建 → 血缘影响评估 → 安全/法务/Owner 三方审批 → 平台执行（Iceberg equality delete / CK DELETE）→ 审计归档 → 物理销毁。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '用户行使被遗忘权，需按主体清除 PII',
        '错误批次导入后的分区/行级擦除',
        '监管函件责令删除与合同到期数据清除',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '点「＋ 创建工单」，填写主体 ID、类型、范围与审批链',
        '在列表按状态筛选，打开详情查看时间线',
        '审批中：同意 / 驳回；待执行：执行删除；归档期：物理销毁',
        '影响表可跳转血缘；可回生命周期查看分层策略',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '生命周期、字段血缘（DELETE 传播）、数据契约' },
        { label: '下游', value: '任务运维执行窗口、审计留痕、申请中心' },
      ],
    },
  ]),

  'storage-trend': guide('存储趋势', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '展示近 7 日湖仓存储增长、分层存量、MinIO/CK 水位与异常增速表。',
        '给出小文件合并、快照过期、归档等治理建议，并可跳回生命周期执行。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '排查异常增长表与扩容风险',
        '对照分层水位做冷热迁移决策',
        '导出存储日报给 FinOps / 平台运维',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '查看 KPI 与 7 日柱状趋势',
        '对比 ODS/DWD/DWS/ADS 分层增速',
        '对异常表触发合并 / 快照过期 / 打开资产',
        '导出日报或返回生命周期执行日作业',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '生命周期、基础设施监控（Categraf MinIO）' },
        { label: '下游', value: '资产目录、任务运维、查询治理成本' },
      ],
    },
  ]),

  develop: guide('数据开发 / SQL', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '在线编写、调试 SQL / 作业脚本，支持工作空间资源树、UDF 插入、代码检查与试跑。',
        '执行引擎：Spark SQL / Flink SQL 为主，Trino 仅作结果校验；同步类任务走 ETL（DataX）。',
        '开发过程可引用标准字段与码值字典；试跑走 TEST/PRE，上版经「环境与发布」审批进入 PROD。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '编写 DWD 清洗 SQL 与标准码值映射',
        '调试 ADS / DWS 汇总逻辑并试跑（Spark / Flink 为主，Trino 校验）',
        '复用平台 UDF（脱敏、码值映射等）',
        '提交上版到 PRE/PROD 发布流水线',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '在左侧资源树选择或新建脚本',
        '选择执行引擎与环境（TEST / PRE）',
        '编辑 SQL，可点击右侧 UDF 插入函数片段',
        '点「格式化」与「试跑」做静态检查与演示试跑',
        '通过后点「提交上版 →」进入环境与发布',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '资产目录、数据标准、ETL 编排' },
        { label: '下游', value: '环境与发布、即席查询、数据质量' },
      ],
    },
  ]),

  query: guide('即席查询', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '经 Trino（Gravitino 鉴权）对湖仓资产做即席分析：Catalog 选表、SQL 编辑、限流执行。',
        '强制列级脱敏与行级过滤；无分区/全表扫描可被查询治理阻断。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '临时取数验证口径',
        '探索性分析与排障',
        '验证脱敏与行级策略是否生效',
        '导出脱敏 CSV / 保存为数据集',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '左侧 Catalog 点击表名插入示例 SQL',
        'Ctrl+S 或「保存脚本」命名保存当前页签',
        'Ctrl+Enter 或点「执行查询」查看结果（buyer_mobile 已脱敏）',
        '可「保存为数据集」或导出脱敏 CSV；历史行点击回填 SQL',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '资产目录、安全与权限、Gravitino Catalog' },
        { label: '下游', value: '查询治理与成本、数据服务、申请中心' },
      ],
    },
  ]),

  publish: guide('环境与发布', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '管理 dev / stg / prod 三环境隔离：Catalog 前缀、脱敏抽样、禁止跨环境与裸改生产 SQL。',
        '展示发布门禁（编译 / 血缘 / 质量 / stg 试跑 / 变更影响）与发布记录；回滚指向上一 Git tag。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '脚本从开发晋级到测试 / 生产',
        '查看当前发布单卡在哪条门禁',
        '确认禁止调度器热改生产 SQL、dev 禁止连生产桶',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '从数据开发点「提交上版」，或本页「＋ 新建发布」',
        '在「发布门禁」查看 v23 等焦点包的检查结果',
        '在「最近发布记录」对照 Git Tag / 环境 / 结果',
        '需要时点「发布记录」查看近期摘要，或回数据开发继续改脚本',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '数据开发 / SQL' },
        { label: '下游', value: '任务运维、数据质量、字段血缘' },
      ],
    },
  ]),

  quality: guide('数据质量中心', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '配置质量规则、查看巡检结果与阻断策略；可与标准「落地检测」结果联动。',
        '展示金标表、规则类型分布与近 30 日趋势；动作以 toast 演示。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['空值/唯一/波动巡检', '码值合规与标准对齐', 'DAG 质量门禁阻断脏数据'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['基于标准码值创建规则', '绑定到 dwd_order_detail', '失败时告警并阻断下游'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '数据标准、ETL 编排、资产目录' },
        { label: '下游', value: '环境与发布门禁、任务运维、申请中心' },
      ],
    },
  ]),

  security: guide('数据安全与权限中心', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '行列级权限、脱敏策略、密钥托管与访问审计；与 Gravitino / Trino 鉴权口径对齐。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['PII 字段脱敏', '按域/表授权', '审计谁在何时访问了敏感表'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['为 buyer_mobile 配置脱敏策略', '给分析师角色开通 ADS 只读', '查看审计日志'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '资产目录、工作空间' },
        { label: '下游', value: '即席查询、数据服务、申请中心' },
      ],
    },
  ]),

  contract: guide('数据契约', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '生产者与消费者约定 schema、SLA 与变更规则；变更需评审，违约可追踪。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['接口/表结构变更管控', 'SLA 违约追踪', '跨团队协作对齐'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['创建契约并绑定资产', '订阅方确认', '变更走评审工单'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '资产目录、数据标准、质量中心' },
        { label: '下游', value: '数据服务、指标中心、申请中心' },
      ],
    },
  ]),

  dataservice: guide('数据服务中心', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '基于 SQLREST 分步构建查询 API：选指标/表 → 配参（入参 + 出参映射转换：wrapped/origin/nil、list/object/page、列改名与分转元等）→ 鉴权 → 全局限流 → 试跑 → 发布到 APISIX；各应用配额经申请中心签发令牌。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['对业务系统提供稳定取数 API', '替换直连数仓', '按应用限流与监控'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '点「构建 API」完成六步向导：配参需定义入参、响应封装与出参映射转换',
        '发布后可在卡片或「详情」中查看 SQL、入参/出参、网关路由与订阅方',
        '在调用监控与 APISIX 路由表中查看状态；申请凭证走申请中心',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '资产目录、指标中心、安全与权限、即席查询' },
        { label: '下游', value: '链路调用监控、申请中心' },
      ],
    },
  ]),

  metrics: guide('指标中心', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '统一指标名称与口径：原子定义聚合；衍生 = 原子 + 业务限定 + 粒度 + 周期；复合只写公式。',
        '生命周期：草稿 → 评审中 → 已启用 →（变更）新版本评审 → 已启用；已启用可废弃。',
        '查询权限与正式口径变更走「申请中心」；指标 Owner 也可在中心内快捷发起版本评审。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        'GMV / 订单量等核心指标定义与版本演进',
        '已启用指标申请查询权限（看板 / 即席 / API）',
        '口径变更正式工单或 Owner 快捷变更',
        '废弃后禁止新引用',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '新建并保存为草稿，编辑完善后「提交评审」→「启用」',
        '列表 / 详情点「申请权限」跳转申请中心提交查询 ACL',
        '需正式变更时点「申请变更」；Owner 可用「Owner变更」快捷进评审',
        '点 ID / 详情查看口径、公式与状态流转记录',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '数据标准、资产目录、字段血缘' },
        { label: '下游', value: '申请中心、数据服务、总览看板' },
      ],
    },
  ]),

  export: guide('出湖与回流', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '将湖内数据同步到对象存储、FTP、关系库、搜索引擎等外部系统（Reverse ETL）。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['日报投递合作伙伴', '回流业务库', '同步到检索集群'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['选择资产与目标类型', '配置路径/表/索引', '调度执行并查看投递结果'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '资产目录、安全与权限、申请中心' },
        { label: '下游', value: '任务运维、链路监控' },
      ],
    },
  ]),

  apply: guide('申请中心', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '权限、表、发布、API、指标申请与审批统一入口。',
        '权限：表只读 / 列级 / 敏感明文（安全加签）→ Gravitino ACL。',
        '表：只读 / 登记上架 / 结构变更。发布：选发布包与环境，prod 须回滚预案并过门禁。',
        '指标：查询权限 / 口径变更 / 新建立项。API：签发 Bearer 令牌，详情可点击查看。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: [
        '申请表/列权限（含敏感明文）',
        '表登记上架或结构变更',
        'stg / prod 发布审批',
        '申请 API 调用凭证',
        '申请指标查询权限 / 口径变更 / 新建立项',
      ],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '权限：选资产与模式 → Owner（及安全）审批 → Gravitino 授权',
        '表：只读授权 / 登记上架 / 结构变更后元数据生效',
        '发布：选包与环境 → 门禁通过 → 上线；prod 必填回滚预案',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '资产目录、安全与权限、环境与发布、指标中心、数据服务' },
        { label: '下游', value: 'Gravitino 授权、资产目录、APISIX、生产发布' },
      ],
    },
  ]),

  ops: guide('任务运维', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '统一查看 Flink 流作业、DolphinScheduler 批 DAG、湖/CK 对账与补数工单。',
        '异常作业可跳转根因台或质量中心；对账失败默认以 Iceberg 为准重导 CK。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['值班处理失败任务', '按分区补数', '湖仓对账差异处置'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['查看 Flink / DS 异常卡片', '点开对账失败进入根因台', '发起补数或重导差异分区'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: 'ETL 编排、环境与发布、数据质量' },
        { label: '下游', value: '根因分析台、可靠性中心、链路调用监控' },
      ],
    },
  ]),

  linktrace: guide('链路调用监控', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '按 A–L 链路采集跨组件 span，支持瀑布图回放与按 trace_id / run_id 检索。',
        '失败/慢 span 可下钻到 hop，再进入根因台做五维叠加。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['对账失败定位慢 hop', 'CDC lag 回放', '批任务质量门禁阻断追踪'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['选择链路 I 查看对账 span', '点击 ERROR span 看错误码与日志偏移', '进根因台继续排查'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '任务运维、基础设施告警' },
        { label: '下游', value: '根因分析台' },
      ],
    },
  ]),

  infra: guide('基础设施监控', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '四层模型：节点资源 / 容器 / 集群对象 / 平台组件进程；复用 Categraf + VictoriaMetrics + 夜莺。',
        '承载任务运维与链路监控的底座层观测。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['磁盘水位与 NotReady 节点', 'Flink TM 反压与堆水位', '组件端口不通处置'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['查看节点四象限水位', '处理 P0/P1 告警', '跳转链路监控看调用影响'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '集群与存储底座' },
        { label: '下游', value: '链路调用监控、任务运维、可靠性中心' },
      ],
    },
  ]),

  rootcause: guide('根因分析台', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '血缘 × 任务状态 × 质量 × 组件监控四维叠加，对 P0 告警做证据链下钻。',
        '演示故事线：ads_gmv_board 对账失败 ← CDC lag + DWD 主键重复。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['质量/对账/延迟联合排查', '一键补数与降级看板', '派发源库 DBA 工单'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['选择告警焦点', '沿证据链下钻到 Flink / 质量', '提交补数 DAG 或切换 Iceberg 降级源'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '任务运维、链路调用、数据质量、字段血缘' },
        { label: '下游', value: '补数工单、可靠性摘牌恢复' },
      ],
    },
  ]),

  reliability: guide('可靠性中心', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '组件 HA 与降级预案、备份 RPO、流式 compaction SLA、湖/CK 对账规则与摘牌恢复闭环。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['Gravitino 降级演练', '对账失败摘牌黄金', '备份与恢复策略核对'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['查看组件 HA 矩阵', '下钻对账差异', '强制重导 CK 并恢复黄金标签'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '任务运维、基础设施' },
        { label: '下游', value: '根因分析台、数据服务看板' },
      ],
    },
  ]),

  querygov: guide('查询治理与成本', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        'Trino 队列管理、扫描限额、查询审计 Top、FinOps 按域分摊与无主资产归档规则。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['阻断无分区全表扫描', 'adhoc 限并发限扫描', '按域看月成本'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['查看 dashboard/adhoc/etl 队列', '审计超限查询', '导出成本报表'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '即席查询、工作空间' },
        { label: '下游', value: '生命周期归档、申请中心' },
      ],
    },
  ]),

  workspace: guide('工作空间', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '按数据域隔离 Catalog、资源配额与成员角色；支持切换当前空间与 Gravitino Catalog。',
        '展示空间详情、成员权限范围与存储/CU/Trino/API 配额水位。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['多团队共平台隔离', '配额与成本归属', '邀请成员与角色授权'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['在左侧选择空间查看详情', '双击或点「切换为当前」切换空间', '新建空间并邀请成员'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '安全与权限、申请中心' },
        { label: '下游', value: '数据开发、即席查询、AI 助手、查询治理' },
      ],
    },
  ]),

  aiassistant: guide('AI 助手', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '对话式辅助查表、写 SQL、解释血缘与排障（演示能力）；可引用知识库与切换模型。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['快速找表', '生成初稿 SQL', '解释告警可能原因'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: ['描述需求', '确认推荐资产', '一键跳转开发/查询页'],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '知识库、AI 模型管理、资产目录' },
        { label: '下游', value: '数据开发、即席查询' },
      ],
    },
  ]),

  aimodel: guide('AI 模型管理', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '模型注册与基础信息维护（演示能力）：端点、Vault Key、上下文窗口、输入/输出价格与用途；供 AI 助手切换底层模型并做成本分摊。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['接入新模型并设置计价', '调整上下文窗口与用途', '轮换 API Key', '按空间查看用量成本'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '接入模型：填端点与 Key，选上下文与计价单位，设输入/输出单价',
        '在卡片上「编辑」维护价格或用途',
        '在 AI 助手中切换模型对话',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '工作空间、基础设施' },
        { label: '下游', value: 'AI 助手、知识库向量化' },
      ],
    },
  ]),

  knowledge: guide('知识库', [
    {
      heading: '模块功能',
      type: 'text',
      content: [
        '平台文档、建模规范与领域知识的检索入口（演示能力）；支持短文本新建与文档上传入库，可配置分片/重叠/嵌入模型后入向量库，供 AI 助手引用。',
      ],
    },
    {
      heading: '适用场景',
      type: 'list',
      items: ['查命名规范原文', '查入湖最佳实践', 'onboarding 新人', '上传手册/FAQ 文档做 RAG'],
    },
    {
      heading: '使用示例',
      type: 'steps',
      items: [
        '新建条目：选手动录入或文档上传',
        '配置分片策略 / 大小 / 重叠与嵌入模型',
        '创建并向量化后，可在列表检索；链到相关标准/资产',
        '去 AI 助手问答时自动引用知识库',
      ],
    },
    {
      heading: '相关模块',
      type: 'kv',
      items: [
        { label: '上游', value: '数据标准、平台文档、AI 模型管理' },
        { label: '下游', value: 'AI 助手、数据开发' },
      ],
    },
  ]),
}

export function pageGuideOf(id) {
  return (
    PAGE_GUIDES[id] || {
      title: '功能说明',
      sections: [
        {
          heading: '说明',
          type: 'note',
          content: '本模块说明待补充。',
        },
      ],
    }
  )
}

/** 规范化供 PageHeader 渲染 */
export function normalizeGuide(guide) {
  if (!guide) return { title: '功能说明', sections: [] }
  if (typeof guide === 'string') {
    return {
      title: '功能说明',
      sections: [{ heading: '', type: 'text', content: guide }],
    }
  }
  if (Array.isArray(guide)) {
    return {
      title: '功能说明',
      sections: [{ heading: '', type: 'text', content: guide }],
    }
  }
  // 旧格式 { title, body: string[] }
  if (guide.body && !guide.sections) {
    return {
      title: guide.title || '功能说明',
      sections: [{ heading: '', type: 'text', content: guide.body }],
    }
  }
  return {
    title: guide.title || '功能说明',
    sections: Array.isArray(guide.sections) ? guide.sections : [],
  }
}
