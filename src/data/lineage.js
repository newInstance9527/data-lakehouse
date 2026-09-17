/** 演示 SoT：交易域 GMV 端到端血缘（对齐完整演示.html） */

export const LINEAGE_NODES = [
  { id: 'src_mysql', name: 'MySQL 订单库', layer: 'src', x: 40, y: 120, desc: 'order_prod·binlog', icon: '🗄️', type: 'src' },
  { id: 'src_kafka', name: 'Kafka cdc.trade.order', layer: 'src', x: 40, y: 260, desc: 'Debezium·分区8', icon: '📨', type: 'src' },
  { id: 'ods_order', name: 'ods_trade.s_order', layer: 'ods', x: 300, y: 190, desc: 'Iceberg ODS·2.3亿行', icon: '📋', type: 'table', assetId: 'ods_order' },
  { id: 'dim_user', name: 'dim.dim_user (SCD2)', layer: 'dim', x: 300, y: 360, desc: '用户缓慢变化维', icon: '👤', type: 'table' },
  { id: 'dim_sku', name: 'dim.dim_sku ⭐', layer: 'dim', x: 300, y: 460, desc: '商品维·黄金', icon: '📦', type: 'table', assetId: 'dim_sku' },
  {
    id: 'dwd_order',
    name: 'dwd_trade.dwd_order_detail',
    layer: 'dwd',
    x: 600,
    y: 260,
    desc: '订单明细·质量红灯',
    icon: '🔧',
    type: 'table',
    assetId: 'dwd_order_detail',
    focus: true,
  },
  { id: 'dws_order', name: 'dws_trade.dws_order_1d', layer: 'dws', x: 900, y: 200, desc: '订单1日汇总', icon: '📊', type: 'table', assetId: 'dws_order_1d' },
  { id: 'dws_user', name: 'dws.dws_user_profile_1d ⭐', layer: 'dws', x: 900, y: 380, desc: '黄金·画像宽表', icon: '🎯', type: 'table', assetId: 'dws_user_profile' },
  { id: 'ads_iceberg', name: 'ads.ads_gmv [Iceberg]', layer: 'ads', x: 1180, y: 130, desc: '湖ADS·事实源', icon: '🧊', type: 'table', assetId: 'ads_gmv' },
  { id: 'ads_ck', name: 'ads_gmv [ClickHouse]', layer: 'ads', x: 1180, y: 250, desc: '热ADS·CK TTL90天', icon: '🔥', type: 'table', assetId: 'ads_gmv' },
  { id: 'superset', name: 'Superset 交易总览', layer: 'report', x: 1430, y: 100, desc: '核心看板·12图', icon: '📈', type: 'report' },
  { id: 'm_gmv', name: 'M-0001 日GMV', layer: 'metric', x: 1430, y: 220, desc: '口径v3·金额合计', icon: '🎯', type: 'metric' },
  { id: 'api_gmv', name: 'API /api/gmv/daily', layer: 'metric', x: 1430, y: 340, desc: 'HTTP JSON·对外', icon: '🔌', type: 'metric' },
]

export const LINEAGE_EDGES = [
  ['src_mysql', 'src_kafka'],
  ['src_kafka', 'ods_order'],
  ['ods_order', 'dwd_order'],
  ['dim_user', 'dwd_order'],
  ['dim_sku', 'dwd_order'],
  ['dwd_order', 'dws_order'],
  ['dwd_order', 'ads_iceberg'],
  ['dwd_order', 'ads_ck'],
  ['dws_order', 'ads_iceberg'],
  ['dws_order', 'ads_ck'],
  ['dws_user', 'api_gmv'],
  ['ads_ck', 'm_gmv'],
  ['ads_ck', 'superset'],
  ['ads_iceberg', 'superset'],
  ['m_gmv', 'api_gmv'],
]

export const LINEAGE_FOCUS_OPTIONS = LINEAGE_NODES.map((n) => ({
  value: n.id,
  label: n.name,
}))

/** 焦点 → 上下游影响（演示清单；未覆盖的节点按图边推导） */
export const IMPACT_BY_FOCUS = {
  ods_order: {
    up: [{ key: 'MySQL 订单库 / Kafka cdc.trade.order', type: '源', note: 'Binlog CDC · Debezium' }],
    down: [
      { key: 'dwd_trade.dwd_order_detail', type: 'DWD', note: '清洗标准化', assetId: 'dwd_order_detail' },
      { key: 'dws_trade.dws_order_1d', type: 'DWS', note: '轻度聚合', assetId: 'dws_order_1d' },
      { key: 'ads.ads_gmv_board', type: 'ADS', note: '经营看板', assetId: 'ads_gmv' },
    ],
  },
  dwd_order: {
    up: [
      { key: 'ods_trade.s_order', type: 'ODS', note: 'Flink CDC 源表 · 行2.3亿', assetId: 'ods_order' },
      { key: 'dim.dim_user (SCD2)', type: 'DIM', note: '用户维表' },
      { key: 'dim.dim_sku ⭐黄金', type: 'DIM', note: '商品维表 · 标准码值', assetId: 'dim_sku' },
    ],
    down: [
      { key: 'dws_trade.dws_order_1d', type: 'DWS', note: '轻度聚合·被上游阻断中', assetId: 'dws_order_1d' },
      { key: 'ads.ads_gmv_board [Iceberg]', type: 'ADS', note: '湖ADS·事实源', assetId: 'ads_gmv' },
      { key: 'ads_gmv_board [ClickHouse]', type: 'ADS+CK', note: '热ADS·对账失败已摘牌', assetId: 'ads_gmv' },
      { key: 'M-0001 日GMV 指标 v3', type: '指标', note: '绑定物理列 pay_amt', mid: true },
      { key: 'Superset 交易总览', type: '报表', note: '核心12张图表引用', rep: true },
      { key: 'API /api/gmv/daily', type: '接口', note: '每日调用 32k 次', api: true },
    ],
  },
  dws_order: {
    up: [
      { key: 'dwd_trade.dwd_order_detail', type: 'DWD', note: '订单明细', assetId: 'dwd_order_detail' },
      { key: 'ods_trade.s_order', type: 'ODS', note: '原始订单', assetId: 'ods_order' },
    ],
    down: [
      { key: 'ads.ads_gmv_board [Iceberg]', type: 'ADS', note: '湖ADS', assetId: 'ads_gmv' },
      { key: 'ads_gmv_board [ClickHouse]', type: 'ADS+CK', note: '热ADS', assetId: 'ads_gmv' },
      { key: 'Superset 交易总览', type: '报表', note: '看板引用', rep: true },
    ],
  },
  ads_gmv: {
    up: [
      { key: 'dwd_trade.dwd_order_detail', type: 'DWD', note: '明细事实', assetId: 'dwd_order_detail' },
      { key: 'dws_trade.dws_order_1d', type: 'DWS', note: '日汇总', assetId: 'dws_order_1d' },
    ],
    down: [
      { key: 'M-0001 日GMV', type: '指标', note: '口径 v3', mid: true },
      { key: 'Superset 交易总览', type: '报表', note: '12 张图表', rep: true },
      { key: 'API /api/gmv/daily', type: '接口', note: '对外 JSON', api: true },
    ],
  },
}

/** 图谱焦点 → ETL/资产表 */
export const FOCUS_TABLE_MAP = {
  ods_order: {
    tableKey: 'ods_trade.s_order',
    assetId: 'ods_order',
    aliases: ['ods_order', 'ods_trade.s_order', 's_order'],
  },
  dwd_order: {
    tableKey: 'dwd_trade.dwd_order_detail',
    assetId: 'dwd_order_detail',
    aliases: ['dwd_order', 'dwd_order_detail', 'dwd_trade.dwd_order_detail'],
  },
  dws_order: {
    tableKey: 'dws_trade.dws_order_1d',
    assetId: 'dws_order_1d',
    aliases: ['dws_order', 'dws_order_1d', 'dws_trade.dws_order_1d'],
  },
  ads_gmv: {
    tableKey: 'ads.ads_gmv_board',
    assetId: 'ads_gmv',
    aliases: ['ads_gmv', 'ads_gmv_board', 'ads.ads_gmv_board', 'ads.ads_gmv'],
  },
}

/** 个别字段补充口径（可选，无则走通用字段信息） */
export const FIELD_META = {
  'dwd_trade.dwd_order_detail::pay_amt': {
    tag: 'PII-金额敏感',
    std: 'STD-T0024 · 标准支付金额（分转元）',
    unit: '元',
    desc: '订单实际支付金额 = 订单原价 - 优惠金额 - 退款金额 + 运费，支付成功后才会有值，单位统一为"元"保留 2 位小数。',
    suggestToType: 'DECIMAL(20,4)',
  },
}

function layerTypeOf(n) {
  if (n.type === 'report') return '报表'
  if (n.type === 'metric') return n.id?.startsWith('api') ? '接口' : '指标'
  if (n.type === 'src' || n.layer === 'src') return '源'
  return (n.layer || '表').toUpperCase()
}

/** 将节点 id / assetId 归一到 FOCUS_TABLE_MAP 的 key（若可映射） */
export function resolveTableFocusKey(focusId) {
  const id = String(focusId || '')
  if (FOCUS_TABLE_MAP[id]) return id
  const node = LINEAGE_NODES.find((n) => n.id === id || n.assetId === id)
  if (!node) return null
  if (FOCUS_TABLE_MAP[node.id]) return node.id
  const byAsset = Object.entries(FOCUS_TABLE_MAP).find(([, m]) => m.assetId && m.assetId === node.assetId)
  return byAsset ? byAsset[0] : null
}

export function focusTableMeta(focusId) {
  const mapped = resolveTableFocusKey(focusId)
  if (mapped) {
    return { ...FOCUS_TABLE_MAP[mapped], graphNodeId: focusId, fieldCapable: true }
  }
  const n = findLineageNode(focusId)
  return {
    tableKey: n?.name || String(focusId || ''),
    assetId: n?.assetId || null,
    aliases: [n?.id, n?.assetId, n?.name].filter(Boolean),
    graphNodeId: n?.id || focusId,
    fieldCapable: n?.type === 'table' && !!n?.assetId,
  }
}

export function findLineageNode(focusId) {
  const id = String(focusId || '')
  return (
    LINEAGE_NODES.find((n) => n.id === id || n.assetId === id) ||
    LINEAGE_NODES.find((n) => n.focus) ||
    LINEAGE_NODES[0]
  )
}

/** 按图边推导上下游（无静态 IMPACT 时） */
export function impactFromEdges(focusId) {
  const node = findLineageNode(focusId)
  if (!node) return { up: [], down: [] }
  const id = node.id
  const up = []
  const down = []
  LINEAGE_EDGES.forEach(([s, t]) => {
    if (t === id) {
      const n = LINEAGE_NODES.find((x) => x.id === s)
      if (n) {
        up.push({
          key: n.name,
          type: layerTypeOf(n),
          note: n.desc || '',
          assetId: n.assetId,
          nodeId: n.id,
        })
      }
    }
    if (s === id) {
      const n = LINEAGE_NODES.find((x) => x.id === t)
      if (n) {
        down.push({
          key: n.name,
          type: layerTypeOf(n),
          note: n.desc || '',
          assetId: n.assetId,
          nodeId: n.id,
          mid: n.type === 'metric' && !String(n.id).startsWith('api'),
          rep: n.type === 'report',
          api: String(n.id).startsWith('api'),
        })
      }
    }
  })
  return { up, down }
}

export function impactForFocus(focusId, upDepth = 5, downDepth = 5) {
  const expansion = expandDemoByDepth(focusId, upDepth, downDepth)
  const nodeById = new Map(LINEAGE_NODES.map((n) => [n.id, n]))

  const toItem = (id, hop) => {
    const n = nodeById.get(id)
    if (!n) return null
    return {
      key: n.name,
      type: layerTypeOf(n),
      note: `${hop < 0 ? `上 ${-hop}` : `下 ${hop}`} 层 · ${n.desc || ''}`,
      assetId: n.assetId,
      nodeId: n.id,
      hop,
      mid: n.type === 'metric' && !String(n.id).startsWith('api'),
      rep: n.type === 'report',
      api: String(n.id).startsWith('api'),
    }
  }

  return {
    up: expansion.upKeys
      .map((id) => toItem(id, expansion.depth.get(id)))
      .filter(Boolean)
      .sort((a, b) => (b.hop || 0) - (a.hop || 0)),
    down: expansion.downKeys
      .map((id) => toItem(id, expansion.depth.get(id)))
      .filter(Boolean)
      .sort((a, b) => (a.hop || 0) - (b.hop || 0)),
    expansion,
  }
}

/**
 * 以焦点为中心按上下游层数 BFS（演示图 LINEAGE_EDGES）
 */
export function expandDemoByDepth(focusId, upDepth = 5, downDepth = 5) {
  const node = findLineageNode(focusId)
  const focus = node?.id || String(focusId || '')
  if (!focus) {
    return { depth: new Map(), keys: new Set(), edges: [], upKeys: [], downKeys: [] }
  }

  const parents = new Map()
  const children = new Map()
  LINEAGE_EDGES.forEach(([s, t]) => {
    if (!children.has(s)) children.set(s, [])
    children.get(s).push(t)
    if (!parents.has(t)) parents.set(t, [])
    parents.get(t).push(s)
  })

  const depth = new Map([[focus, 0]])
  const upLimit = Math.max(0, Number(upDepth) || 0)
  const downLimit = Math.max(0, Number(downDepth) || 0)

  let frontier = [focus]
  for (let d = 1; d <= upLimit; d++) {
    const next = []
    frontier.forEach((k) => {
      ;(parents.get(k) || []).forEach((p) => {
        if (!depth.has(p)) {
          depth.set(p, -d)
          next.push(p)
        }
      })
    })
    frontier = next
    if (!frontier.length) break
  }

  frontier = [focus]
  for (let d = 1; d <= downLimit; d++) {
    const next = []
    frontier.forEach((k) => {
      ;(children.get(k) || []).forEach((c) => {
        if (!depth.has(c)) {
          depth.set(c, d)
          next.push(c)
        }
      })
    })
    frontier = next
    if (!frontier.length) break
  }

  const keys = new Set(depth.keys())
  const edges = LINEAGE_EDGES.filter(([s, t]) => keys.has(s) && keys.has(t))
  const upKeys = [...keys].filter((k) => (depth.get(k) || 0) < 0)
  const downKeys = [...keys].filter((k) => (depth.get(k) || 0) > 0)
  return { depth, keys, edges, upKeys, downKeys }
}

export function relatedNodeIds(focusId, upDepth = 5, downDepth = 5) {
  return expandDemoByDepth(focusId, upDepth, downDepth).keys
}
