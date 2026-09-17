import { computed, ref } from 'vue'
import { ASSET_DATA } from '@/data/assets'
import { levelClass, layerMeta, domainMeta } from '@/data/assetMeta'

const assets = ref(ASSET_DATA.map((a) => ({ ...a })))

export function useAssets() {
  const list = computed(() => assets.value)

  function findAsset(idOrKey) {
    const q = String(idOrKey ?? '').trim()
    if (!q) return null
    return (
      assets.value.find((a) => a.id === q || a.key === q || a.name === q) ||
      assets.value.find((a) => a.key.endsWith('.' + q) || a.key.includes(q)) ||
      null
    )
  }

  function addAsset(payload) {
    const layer = layerMeta(payload.layer)
    const domain = domainMeta(payload.domain)
    const level = payload.level || '内部'
    const row = {
      id: payload.id,
      key: payload.key,
      name: payload.name || payload.key,
      layer: layer.value,
      layerLabel: layer.label,
      domain: domain.value,
      domainLabel: domain.label,
      desc: payload.desc || '',
      size: payload.size || '待统计',
      cols: payload.cols ?? 12,
      partitions: payload.partitions || '待配置',
      updated: '刚刚',
      owner: payload.owner || '李明',
      ownerAvatar: (payload.owner || '李明').slice(0, 2).toUpperCase().replace(/\s/g, '') || 'LM',
      bizOwner: payload.bizOwner || payload.owner || '业务方',
      level,
      levelClass: levelClass(level),
      quality: payload.quality ?? 90,
      qualityClass: 'qs-mid',
      isGold: false,
      engine: payload.engine || 'Iceberg',
      storage: payload.storage || 'MinIO 标准',
      tags: payload.tags || [
        ['新注册', 'tag-blue'],
        [layer.label, 'tag-cyan'],
      ],
      metrics: { read7d: '0次' },
      sourceId: payload.sourceId || null,
      sourceName: payload.sourceName || null,
      sourceType: payload.sourceType || null,
      tableName: payload.tableName || null,
      fields: payload.fields || null,
    }
    const idx = assets.value.findIndex((a) => a.id === row.id)
    if (idx >= 0) {
      assets.value[idx] = { ...assets.value[idx], ...row }
      return assets.value[idx]
    }
    assets.value.unshift(row)
    return row
  }

  return {
    assets,
    list,
    findAsset,
    addAsset,
  }
}
