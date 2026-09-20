/**
 * ETL 节点字段推导：从源表 / 资产 / 上游节点解析可用字段
 */
import { getAssetFields, formatDataType } from '@/utils/fieldSchema'

function toOption(f) {
  return {
    name: f.enName || f.name,
    cn: f.cnName || f.desc || '',
    type: f.dataType ? formatDataType(f) : f.type || 'STRING',
    pk: !!f.pk,
  }
}

/** 按表名生成演示字段列表 */
export function fieldsForTableName(tableName, sourceType = 'MySQL') {
  if (!tableName) return []
  const hint = String(tableName)
  return getAssetFields(
    { id: hint, key: hint, name: hint.split('.').pop(), tableName: hint },
    sourceType,
  ).map(toOption)
}

export function fieldsFromAsset(asset, sourceType) {
  if (!asset) return []
  return getAssetFields(asset, sourceType || asset.engine || 'MySQL').map(toOption)
}

function uniqFields(list) {
  const map = new Map()
  list.forEach((f) => {
    if (!f?.name) return
    if (!map.has(f.name)) map.set(f.name, f)
  })
  return [...map.values()]
}

function mappedOutput(fieldMaps) {
  if (!Array.isArray(fieldMaps) || !fieldMaps.length) return null
  return uniqFields(
    fieldMaps
      .filter((m) => m.dst || m.std)
      .map((m) => ({
        name: m.dst || m.std,
        cn: m.dstCn || m.std || '',
        type: m.dstType || 'STRING',
        pk: false,
      })),
  )
}

/** 从清洗规则抽出字段名，保证映射节点即使 schema 未齐也能看到列 */
function fieldsFromCleanRules(conf = {}) {
  const rules = conf.fieldRules
  if (!Array.isArray(rules) || !rules.length) return []
  return uniqFields(
    rules
      .filter((r) => r?.field)
      .map((r) => ({
        name: String(r.field).trim(),
        cn: '',
        type: r.castType || 'STRING',
        pk: false,
      })),
  )
}

/**
 * 解析某节点的「输出字段」
 * @param {object} node
 * @param {object} task
 * @param {{ getSource, findAsset, getDsFields, cache?: Map }} ctx
 */
export function resolveNodeOutputFields(node, task, ctx = {}) {
  if (!node) return []
  const cache = ctx.cache || (ctx.cache = new Map())
  if (cache.has(node.id)) return cache.get(node.id)
  // 占位防环
  cache.set(node.id, [])

  let out = []
  const conf = node.conf || {}
  const mapped = mappedOutput(conf.fieldMaps)

  if (node.type === 'source' || node.type === 'source_api' || node.type === 'source_file') {
    const tables = sourceTablesOf(conf)
    const ds = conf.dsId && ctx.getSource ? ctx.getSource(conf.dsId) : null
    if (conf.dsId && typeof ctx.getDsFields === 'function') {
      const real = ctx.getDsFields(conf.dsId, tables)
      if (real?.length) {
        out = real
      }
    }
    if (!out.length) {
      if (tables.length) {
        out = uniqFields(
          tables.flatMap((t) => fieldsForTableName(t, ds?.type || conf.dbType || 'MySQL')),
        )
      } else if (conf.path) {
        out = fieldsForTableName(conf.path, ds?.type || conf.dbType || 'MySQL')
      } else if (conf.dsId && typeof ctx.getDsFields === 'function') {
        // 未选表：退回该源已探测到的全部列
        out = ctx.getDsFields(conf.dsId, []) || []
      }
    }
  } else if (String(node.type).startsWith('sink_')) {
    if (mapped?.length) {
      out = mapped
    } else {
      const table = conf.table || conf.dst || conf.index || ''
      if (conf.dsId && table && typeof ctx.getDsFields === 'function') {
        const real = ctx.getDsFields(conf.dsId, [table])
        if (real?.length) out = real
      }
      if (!out.length) {
        const asset = table && ctx.findAsset ? ctx.findAsset(table) : null
        out = asset ? fieldsFromAsset(asset) : fieldsForTableName(table)
      }
    }
  } else if (node.type === 'mapping') {
    if (mapped?.length) out = mapped
    else out = resolveUpstreamFields(node.id, task, ctx)
  } else if (node.type === 'clean') {
    const up = resolveUpstreamFields(node.id, task, ctx)
    const fromRules = fieldsFromCleanRules(conf)
    if (!fromRules.length) {
      out = up
    } else if (!up.length) {
      // 上游 schema 尚未加载：暂用规则字段作提示（严格同名，不做大小写转换）
      out = fromRules
    } else {
      // 仅保留与上游真实列严格同名的清洗字段；全错配则回退上游表列，避免幽灵字段
      const upNames = new Set(up.map((f) => f.name))
      const kept = fromRules.filter((f) => upNames.has(f.name))
      out = kept.length ? kept : up
    }
  } else if (
    node.type === 'quality' ||
    node.type === 'parallel' ||
    node.type === 'condition' ||
    node.type === 'union' ||
    node.type === 'transform'
  ) {
    out = resolveUpstreamFields(node.id, task, ctx)
  } else {
    out = resolveUpstreamFields(node.id, task, ctx)
  }

  cache.set(node.id, out)
  return out
}

function sourceTablesOf(conf = {}) {
  const one =
    conf.table ||
    conf.src ||
    (Array.isArray(conf.tables) ? conf.tables.filter(Boolean)[0] : '') ||
    ''
  return one ? [one] : []
}

/** 当前节点所有直接上游的输出字段并集 */
export function resolveUpstreamFields(nodeId, task, ctx = {}) {
  if (!task?.edges?.length || !task?.nodes?.length) return []
  const parents = task.edges
    .filter((e) => String(e.to) === String(nodeId))
    .map((e) => e.from)
  const list = []
  parents.forEach((pid) => {
    const n = task.nodes.find((x) => String(x.id) === String(pid))
    if (n) list.push(...resolveNodeOutputFields(n, task, ctx))
  })
  return uniqFields(list)
}

/** 源表字段（库表节点） */
export function resolveSourceTableFields(node, ctx = {}) {
  if (!node) return []
  const conf = node.conf || {}
  const tables = sourceTablesOf(conf)
  if (conf.dsId && typeof ctx.getDsFields === 'function') {
    const real = ctx.getDsFields(conf.dsId, tables)
    if (real?.length) return real
  }
  const ds = conf.dsId && ctx.getSource ? ctx.getSource(conf.dsId) : null
  if (!tables.length) {
    return conf.dsId && typeof ctx.getDsFields === 'function' ? ctx.getDsFields(conf.dsId, []) : []
  }
  return uniqFields(
    tables.flatMap((t) => fieldsForTableName(t, ds?.type || conf.dbType || 'MySQL')),
  )
}

/** 目标表字段（库表节点 dst 或 sink table） */
export function resolveTargetTableFields(node, ctx = {}) {
  if (!node) return []
  const conf = node.conf || {}
  const table = conf.dst || conf.table || ''
  if (!table) return []
  if (conf.dsId && typeof ctx.getDsFields === 'function') {
    const real = ctx.getDsFields(conf.dsId, [table])
    if (real?.length) return real
  }
  const asset = ctx.findAsset ? ctx.findAsset(table) : null
  if (asset) return fieldsFromAsset(asset)
  const ds = conf.dsId && ctx.getSource ? ctx.getSource(conf.dsId) : null
  return fieldsForTableName(table, ds?.type || 'MySQL')
}

/** 同名自动映射（严格同名，含大小写；不做大小写折叠） */
export function autoMapFields(srcFields, dstFields) {
  const dstByName = new Map(dstFields.map((f) => [f.name, f]))
  return srcFields
    .filter((s) => dstByName.has(s.name))
    .map((s) => {
      const d = dstByName.get(s.name)
      return {
        src: s.name,
        dst: d.name,
        transform: '直接映射',
      }
    })
}

export function fieldSelectOptions(fields) {
  return (fields || []).map((f) => ({
    value: f.name,
    label: f.name,
    sub: [f.type, f.cn].filter(Boolean).join(' · '),
  }))
}
