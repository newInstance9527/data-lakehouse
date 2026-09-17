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

/**
 * 解析某节点的「输出字段」
 * @param {object} node
 * @param {object} task
 * @param {{ getSource, findAsset, cache?: Map }} ctx
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
    // 源节点只输出抽取字段，不做「源→湖」映射
    const ds = conf.dsId && ctx.getSource ? ctx.getSource(conf.dsId) : null
    const table =
      conf.src ||
      (Array.isArray(conf.tables) ? conf.tables[0] : '') ||
      conf.path ||
      ''
    out = fieldsForTableName(table, ds?.type || conf.dbType || 'MySQL')
  } else if (String(node.type).startsWith('sink_')) {
    // Sink 写出后字段以目标表 / 映射结果为准
    if (mapped?.length) {
      out = mapped
    } else {
      const table = conf.table || conf.dst || conf.index || ''
      const asset = table && ctx.findAsset ? ctx.findAsset(table) : null
      out = asset ? fieldsFromAsset(asset) : fieldsForTableName(table)
    }
  } else if (node.type === 'mapping') {
    if (mapped?.length) out = mapped
    else out = resolveUpstreamFields(node.id, task, ctx)
  } else if (
    node.type === 'clean' ||
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

/** 当前节点所有直接上游的输出字段并集 */
export function resolveUpstreamFields(nodeId, task, ctx = {}) {
  if (!task?.edges?.length || !task?.nodes?.length) return []
  const parents = task.edges.filter((e) => e.to === nodeId).map((e) => e.from)
  const list = []
  parents.forEach((pid) => {
    const n = task.nodes.find((x) => x.id === pid)
    if (n) list.push(...resolveNodeOutputFields(n, task, ctx))
  })
  return uniqFields(list)
}

/** 源表字段（库表节点） */
export function resolveSourceTableFields(node, ctx = {}) {
  if (!node) return []
  const conf = node.conf || {}
  const ds = conf.dsId && ctx.getSource ? ctx.getSource(conf.dsId) : null
  const table = conf.src || (Array.isArray(conf.tables) ? conf.tables[0] : '') || ''
  return fieldsForTableName(table, ds?.type || conf.dbType || 'MySQL')
}

/** 目标表字段（库表节点 dst 或 sink table） */
export function resolveTargetTableFields(node, ctx = {}) {
  if (!node) return []
  const conf = node.conf || {}
  const table = conf.dst || conf.table || ''
  if (!table) return []
  const asset = ctx.findAsset ? ctx.findAsset(table) : null
  if (asset) return fieldsFromAsset(asset)
  const ds = conf.dsId && ctx.getSource ? ctx.getSource(conf.dsId) : null
  return fieldsForTableName(table, ds?.type || 'MySQL')
}

/** 同名自动映射 */
export function autoMapFields(srcFields, dstFields) {
  const dstNames = new Set(dstFields.map((f) => f.name))
  return srcFields
    .filter((s) => dstNames.has(s.name))
    .map((s) => {
      const d = dstFields.find((x) => x.name === s.name)
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
    sub: [f.cn, f.type].filter(Boolean).join(' · '),
  }))
}
