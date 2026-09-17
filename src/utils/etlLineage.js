/**
 * 从 ETL DAG 任务解析表级 / 字段级血缘
 */
import { fieldsForTableName } from '@/utils/etlFields'
import { NODE_TYPES } from '@/data/etl'

const LAYER_ORDER = ['src', 'ods', 'dwd', 'dim', 'dws', 'ads', 'other']

function layerOfKey(key) {
  const k = String(key || '').toLowerCase()
  if (k.startsWith('ods') || k.includes('.ods_') || k.includes('ods_')) return 'ods'
  if (k.startsWith('dwd') || k.includes('.dwd_') || k.includes('dwd_')) return 'dwd'
  if (k.startsWith('dws') || k.includes('.dws_') || k.includes('dws_')) return 'dws'
  if (k.startsWith('ads') || k.includes('.ads_') || k.includes('ads_')) return 'ads'
  if (k.startsWith('dim') || k.includes('.dim_') || k.includes('dim_')) return 'dim'
  if (k.includes('mysql') || k.includes('postgres') || k.includes('s_') || k.startsWith('trade.') || k.startsWith('payment.'))
    return 'src'
  return 'other'
}

function layerLabel(layer) {
  return (
    {
      src: '源',
      ods: 'ODS',
      dwd: 'DWD',
      dim: 'DIM',
      dws: 'DWS',
      ads: 'ADS',
      other: '其他',
    }[layer] || layer
  )
}

function qualifyTable(raw, ds) {
  const t = String(raw || '').trim()
  if (!t) return ''
  if (t.includes('.')) return t
  if (ds?.database) return `${ds.database}.${t}`
  return t
}

/** 解析节点对应的数据集（表） */
export function resolveNodeDataset(node, ctx = {}) {
  if (!node) return null
  const conf = node.conf || {}
  const ds = conf.dsId && ctx.getSource ? ctx.getSource(conf.dsId) : null
  let key = ''
  let kind = 'table'

  if (node.type === 'source' || node.type === 'source_api' || node.type === 'source_file') {
    key =
      qualifyTable(conf.src || (Array.isArray(conf.tables) ? conf.tables[0] : '') || '', ds) ||
      conf.baseUrl ||
      conf.basePath ||
      conf.path ||
      node.meta ||
      node.name
    kind = node.type === 'source_file' ? 'file' : node.type === 'source_api' ? 'api' : 'src'
  } else if (String(node.type).startsWith('sink_')) {
    key = conf.table || conf.dest || conf.dst || conf.index || conf.topic || conf.bucket || node.meta || node.name
    kind = node.type === 'sink_bi' ? 'report' : node.type === 'sink_kafka' ? 'stream' : 'table'
  } else if (node.type === 'mapping') {
    key = conf.destTable || conf.dest || conf.dst || node.meta || `${node.name}_mapped`
  } else if (node.type === 'transform') {
    if (node.meta && String(node.meta).includes('.')) key = node.meta
    else key = conf.tempView || `transform.${node.id}`
  } else if (node.type === 'clean' || node.type === 'quality') {
    key = node.meta && String(node.meta).includes('.') ? node.meta : `stage.${node.id}`
  } else {
    key = node.meta || `node.${node.id}`
  }

  key = String(key).trim()
  if (!key) return null

  const asset = ctx.findAsset ? ctx.findAsset(key) : null
  const layer = asset?.layer || layerOfKey(key)
  const fields =
    (asset && ctx.fieldsFromAsset ? ctx.fieldsFromAsset(asset) : null) ||
    fieldsForTableName(key, ds?.type || conf.dbType || asset?.engine || 'MySQL')

  return {
    id: key,
    key,
    name: asset?.name || key.split('.').pop(),
    fullName: asset?.key || key,
    layer,
    layerLabel: asset?.layerLabel || layerLabel(layer),
    kind,
    assetId: asset?.id || null,
    fields,
    nodeId: node.id,
    nodeType: node.type,
  }
}

function edgeKey(a, b, field) {
  return field ? `${a}>>${b}#${field}` : `${a}>>${b}`
}

function parseSelectAliases(sql) {
  if (!sql || typeof sql !== 'string') return []
  const m = sql.match(/select\s+([\s\S]+?)\s+from\s+/i)
  if (!m) return []
  return m[1]
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const as = p.match(/^(.+?)\s+as\s+(\w+)$/i) || p.match(/^(\w+)\s+(\w+)$/)
      if (as) return { src: as[1].replace(/.*\./, '').trim(), dst: as[2].trim() }
      const col = p.replace(/.*\./, '').replace(/[`"]/g, '').trim()
      if (col === '*' || !col) return null
      return { src: col, dst: col }
    })
    .filter(Boolean)
}

/**
 * @param {Array} tasks ETL 任务列表
 * @param {{ getSource?: Function, findAsset?: Function }} ctx
 */
export function parseEtlLineage(tasks = [], ctx = {}) {
  const tableMap = new Map()
  const tableEdges = new Map()
  const fieldEdges = new Map()
  const records = []

  function upsertTable(ds) {
    if (!ds?.key) return null
    const prev = tableMap.get(ds.key)
    if (!prev) {
      tableMap.set(ds.key, {
        id: ds.key,
        key: ds.key,
        name: ds.name,
        fullName: ds.fullName || ds.key,
        layer: ds.layer,
        layerLabel: ds.layerLabel,
        kind: ds.kind || 'table',
        assetId: ds.assetId,
        fields: ds.fields || [],
        taskIds: new Set(),
        nodeIds: new Set(),
      })
    } else {
      if ((!prev.fields || !prev.fields.length) && ds.fields?.length) prev.fields = ds.fields
      if (!prev.assetId && ds.assetId) prev.assetId = ds.assetId
    }
    const row = tableMap.get(ds.key)
    return row
  }

  function addTableEdge(fromKey, toKey, meta) {
    if (!fromKey || !toKey || fromKey === toKey) return
    const k = edgeKey(fromKey, toKey)
    if (!tableEdges.has(k)) {
      tableEdges.set(k, {
        id: k,
        from: fromKey,
        to: toKey,
        tasks: [],
        transforms: new Set(),
      })
    }
    const e = tableEdges.get(k)
    if (meta.taskId && !e.tasks.find((t) => t.taskId === meta.taskId && t.nodeId === meta.nodeId)) {
      e.tasks.push({
        taskId: meta.taskId,
        taskName: meta.taskName,
        nodeId: meta.nodeId,
        nodeName: meta.nodeName,
        nodeType: meta.nodeType,
      })
    }
    if (meta.transform) e.transforms.add(meta.transform)
  }

  function addFieldEdge(fromTable, fromField, toTable, toField, meta) {
    if (!fromTable || !toTable || !fromField || !toField) return
    const k = `${fromTable}.${fromField}>>${toTable}.${toField}`
    if (!fieldEdges.has(k)) {
      fieldEdges.set(k, {
        id: k,
        fromTable,
        fromField,
        toTable,
        toField,
        transform: meta.transform || '直接映射',
        confidence: meta.confidence || 'inferred',
        tasks: [],
      })
    }
    const e = fieldEdges.get(k)
    if (meta.transform && e.transform === '直接映射') e.transform = meta.transform
    if (meta.confidence === 'explicit') e.confidence = 'explicit'
    if (meta.taskId && !e.tasks.find((t) => t.taskId === meta.taskId && t.nodeId === meta.nodeId)) {
      e.tasks.push({
        taskId: meta.taskId,
        taskName: meta.taskName,
        nodeId: meta.nodeId,
        nodeName: meta.nodeName,
        nodeType: meta.nodeType,
      })
    }
    records.push({
      id: `${k}@${meta.taskId || ''}@${meta.nodeId || ''}`,
      ...e,
      taskId: meta.taskId,
      taskName: meta.taskName,
      nodeId: meta.nodeId,
      nodeName: meta.nodeName,
      nodeType: meta.nodeType,
      transform: meta.transform || e.transform,
      confidence: meta.confidence || e.confidence,
    })
  }

  ;(tasks || []).forEach((task) => {
    const nodeDs = new Map()
    ;(task.nodes || []).forEach((n) => {
      const ds = resolveNodeDataset(n, ctx)
      if (!ds) return
      nodeDs.set(n.id, ds)
      const row = upsertTable(ds)
      if (row) {
        row.taskIds.add(task.id)
        row.nodeIds.add(n.id)
      }
    })

    ;(task.edges || []).forEach((e) => {
      const a = nodeDs.get(e.from)
      const b = nodeDs.get(e.to)
      if (!a || !b) return
      const fromNode = (task.nodes || []).find((n) => n.id === e.from)
      const toNode = (task.nodes || []).find((n) => n.id === e.to)
      const meta = {
        taskId: task.id,
        taskName: task.name,
        nodeId: toNode?.id || e.to,
        nodeName: toNode?.name || '',
        nodeType: toNode?.type || '',
        transform: NODE_TYPES[toNode?.type]?.label || toNode?.type || 'ETL',
      }
      addTableEdge(a.key, b.key, meta)

      const conf = toNode?.conf || {}
      const maps = conf.fieldMaps || conf.mapList || []
      if (Array.isArray(maps) && maps.length) {
        maps.forEach((m) => {
          const src = m.src || m.source
          const dst = m.dst || m.std || m.target
          if (!src || !dst) return
          addFieldEdge(a.key, src, b.key, dst, {
            ...meta,
            transform: m.transform || m.expr || '直接映射',
            confidence: 'explicit',
          })
        })
      } else if (toNode?.type === 'transform' && conf.sql) {
        const aliases = parseSelectAliases(conf.sql)
        if (aliases.length) {
          aliases.forEach((m) => {
            addFieldEdge(a.key, m.src, b.key, m.dst, {
              ...meta,
              transform: 'SQL',
              confidence: 'explicit',
            })
          })
        } else {
          // 透传推断
          ;(a.fields || []).slice(0, 12).forEach((f) => {
            addFieldEdge(a.key, f.name, b.key, f.name, {
              ...meta,
              transform: 'SQL 透传(推断)',
              confidence: 'inferred',
            })
          })
        }
      } else if (toNode?.type === 'clean' && Array.isArray(conf.fieldRules) && conf.fieldRules.length) {
        conf.fieldRules.forEach((r) => {
          if (!r.field) return
          addFieldEdge(a.key, r.field, b.key, r.field, {
            ...meta,
            transform: (r.ops || []).join('+') || '清洗',
            confidence: 'explicit',
          })
        })
        ;(a.fields || [])
          .filter((f) => !(conf.fieldRules || []).some((r) => r.field === f.name))
          .slice(0, 8)
          .forEach((f) => {
            addFieldEdge(a.key, f.name, b.key, f.name, {
              ...meta,
              transform: '透传',
              confidence: 'inferred',
            })
          })
      } else {
        // 同名推断
        const srcNames = new Set((a.fields || []).map((f) => f.name))
        const dstFields = b.fields?.length ? b.fields : a.fields || []
        dstFields.forEach((f) => {
          if (srcNames.has(f.name) || !b.fields?.length) {
            addFieldEdge(a.key, f.name, b.key, f.name, {
              ...meta,
              transform: '同名推断',
              confidence: 'inferred',
            })
          }
        })
      }
    })
  })

  const tables = [...tableMap.values()].map((t) => ({
    ...t,
    taskIds: [...t.taskIds],
    nodeIds: [...t.nodeIds],
    fieldCount: t.fields?.length || 0,
  }))

  // 布局坐标：按 layer 分列
  const byLayer = {}
  tables.forEach((t) => {
    const L = t.layer || 'other'
    if (!byLayer[L]) byLayer[L] = []
    byLayer[L].push(t)
  })
  LAYER_ORDER.forEach((L, col) => {
    ;(byLayer[L] || []).forEach((t, row) => {
      t.x = 40 + col * 260
      t.y = 40 + row * 130
    })
  })
  // 未在 LAYER_ORDER 的
  Object.keys(byLayer).forEach((L) => {
    if (LAYER_ORDER.includes(L)) return
    ;(byLayer[L] || []).forEach((t, row) => {
      t.x = 40 + LAYER_ORDER.length * 260
      t.y = 40 + row * 130
    })
  })

  return {
    tables,
    tableEdges: [...tableEdges.values()].map((e) => ({
      ...e,
      transforms: [...e.transforms],
    })),
    fieldEdges: [...fieldEdges.values()],
    records,
    stats: {
      tables: tables.length,
      tableEdges: tableEdges.size,
      fieldEdges: fieldEdges.size,
      tasks: (tasks || []).length,
      explicit: [...fieldEdges.values()].filter((e) => e.confidence === 'explicit').length,
      inferred: [...fieldEdges.values()].filter((e) => e.confidence === 'inferred').length,
    },
  }
}

export function neighbors(tableKey, tableEdges, dir = 'both') {
  const up = []
  const down = []
  ;(tableEdges || []).forEach((e) => {
    if (e.to === tableKey) up.push(e.from)
    if (e.from === tableKey) down.push(e.to)
  })
  if (dir === 'up') return [...new Set(up)]
  if (dir === 'down') return [...new Set(down)]
  return { up: [...new Set(up)], down: [...new Set(down)] }
}

/**
 * 以焦点表为中心，分别按上游 / 下游层数做 BFS，返回限制层级内的全部节点与边
 * depth: 负=上游层数，0=焦点，正=下游层数
 */
export function expandByDepth(focusKey, tableEdges = [], upDepth = 2, downDepth = 2) {
  const focus = String(focusKey || '').trim()
  if (!focus) {
    return { depth: new Map(), keys: new Set(), edges: [], upKeys: [], downKeys: [] }
  }

  const parents = new Map()
  const children = new Map()
  tableEdges.forEach((e) => {
    if (!e?.from || !e?.to) return
    if (!children.has(e.from)) children.set(e.from, [])
    children.get(e.from).push(e.to)
    if (!parents.has(e.to)) parents.set(e.to, [])
    parents.get(e.to).push(e.from)
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
  const edges = tableEdges.filter((e) => keys.has(e.from) && keys.has(e.to))
  const upKeys = [...keys].filter((k) => (depth.get(k) || 0) < 0)
  const downKeys = [...keys].filter((k) => (depth.get(k) || 0) > 0)

  return { depth, keys, edges, upKeys, downKeys }
}

/** 按相对焦点的层级重新排版：上游在左、焦点居中、下游在右 */
export function layoutByDepth(tables = [], depthMap, overrides = {}) {
  const groups = new Map()
  tables.forEach((t) => {
    const d = depthMap instanceof Map ? depthMap.get(t.key) : depthMap?.[t.key]
    if (d == null) return
    if (!groups.has(d)) groups.set(d, [])
    groups.get(d).push(t)
  })
  const depths = [...groups.keys()].sort((a, b) => a - b)
  const COL_W = 260
  const ROW_H = 130
  const out = []
  depths.forEach((d, col) => {
    const list = groups.get(d) || []
    list.forEach((t, row) => {
      const ov = overrides[t.key]
      out.push({
        ...t,
        x: ov?.x ?? 40 + col * COL_W,
        y: ov?.y ?? 40 + row * ROW_H,
        hop: d,
      })
    })
  })
  return out
}

export function fieldChain(fieldEdges, tableKey, fieldName) {
  const upstream = []
  const downstream = []
  ;(fieldEdges || []).forEach((e) => {
    if (e.toTable === tableKey && e.toField === fieldName) {
      upstream.push(e)
    }
    if (e.fromTable === tableKey && e.fromField === fieldName) {
      downstream.push(e)
    }
  })
  return { upstream, downstream }
}

export function fieldNodeKey(table, field) {
  return `${table}::${field}`
}

export function parseFieldNodeKey(key) {
  const s = String(key || '')
  const i = s.indexOf('::')
  if (i < 0) return { table: s, field: '' }
  return { table: s.slice(0, i), field: s.slice(i + 2) }
}

/**
 * 以焦点字段为中心，按上下游层数 BFS 展开字段血缘
 */
export function expandFieldByDepth(focusTable, focusField, fieldEdges = [], upDepth = 2, downDepth = 2) {
  const table = String(focusTable || '').trim()
  const field = String(focusField || '').trim()
  if (!table || !field) {
    return { depth: new Map(), keys: new Set(), edges: [], nodes: [], upKeys: [], downKeys: [] }
  }

  const focus = fieldNodeKey(table, field)
  const parents = new Map()
  const children = new Map()
  const edgeByPair = new Map()

  fieldEdges.forEach((e) => {
    if (!e?.fromTable || !e?.fromField || !e?.toTable || !e?.toField) return
    const from = fieldNodeKey(e.fromTable, e.fromField)
    const to = fieldNodeKey(e.toTable, e.toField)
    if (!children.has(from)) children.set(from, [])
    children.get(from).push(to)
    if (!parents.has(to)) parents.set(to, [])
    parents.get(to).push(from)
    edgeByPair.set(`${from}=>${to}`, e)
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
  const edges = []
  edgeByPair.forEach((e, pair) => {
    const [from, to] = pair.split('=>')
    if (keys.has(from) && keys.has(to)) {
      edges.push({
        ...e,
        id: e.id || pair,
        from,
        to,
      })
    }
  })

  const nodes = [...keys].map((k) => {
    const { table: t, field: f } = parseFieldNodeKey(k)
    return {
      key: k,
      id: k,
      tableKey: t,
      fieldName: f,
      fullName: f,
      layerLabel: t,
      layer: 'other',
      kind: 'field',
      hop: depth.get(k) || 0,
      transform: '',
      confidence: '',
    }
  })

  const upKeys = [...keys].filter((k) => (depth.get(k) || 0) < 0)
  const downKeys = [...keys].filter((k) => (depth.get(k) || 0) > 0)

  return { depth, keys, edges, nodes, upKeys, downKeys }
}

/**
 * 从字段边展开下游传播清单（按跳数排序）
 * @returns {{ items: Array, impactCount: number, edges: Array }}
 */
export function buildDownstreamPropagations(focusTable, focusField, fieldEdges = [], downDepth = 99) {
  const expansion = expandFieldByDepth(focusTable, focusField, fieldEdges, 0, downDepth)
  const focus = fieldNodeKey(focusTable, focusField)
  const edgeByTo = new Map()
  expansion.edges.forEach((e) => {
    if (!edgeByTo.has(e.to)) edgeByTo.set(e.to, [])
    edgeByTo.get(e.to).push(e)
  })

  const items = expansion.downKeys
    .map((k) => {
      const { table, field } = parseFieldNodeKey(k)
      const hop = expansion.depth.get(k) || 0
      const inbound = edgeByTo.get(k) || []
      const fromFocus = inbound.find((e) => e.from === focus)
      const e = fromFocus || inbound[0]
      const explicit = e?.confidence === 'explicit'
      return {
        key: k,
        tableKey: table,
        fieldName: field,
        name: `${table}.${field}`,
        hop,
        transform: e?.transform || (explicit ? '直接映射' : '同名推断'),
        confidence: e?.confidence || 'inferred',
        tag: hop === 1 ? (explicit ? '直接引用' : '推断引用') : `下 ${hop} 层`,
        tagClass: hop === 1 ? (explicit ? 'tag-red' : 'tag-orange') : 'tag-gray',
        tasks: e?.tasks || [],
      }
    })
    .sort((a, b) => a.hop - b.hop || a.name.localeCompare(b.name))

  return {
    items,
    impactCount: items.length,
    edges: expansion.edges,
    depth: expansion.depth,
  }
}

export { LAYER_ORDER, layerLabel }
