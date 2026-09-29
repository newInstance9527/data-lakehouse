/** 存储趋势 · 图表助手（序列走 /lh/lifecycle/storage） */

export function stGrowthCls(status) {
  if (status === 'warn') return 'warn'
  if (status === 'fail') return 'danger'
  return 'ok'
}

export function stBarHeight(total, max = 3.5) {
  return Math.max(8, Math.round((Number(total) / (max || 1)) * 100))
}

function n(v, d = 0) {
  const x = Number(v)
  return Number.isFinite(x) ? x : d
}

function ptsToPolyline(pts) {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

function areaBetween(upper, lower) {
  if (!upper.length || upper.length !== lower.length) return ''
  const forward = upper.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  const back = [...lower].reverse().map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  return `M ${forward.join(' L ')} L ${back.join(' L ')} Z`
}

/**
 * 物理/活跃双线 + 可回收缺口面积；可选 p50/p95 预测虚线与容量相交点。
 * @param {Array<{day?:string,date?:string,total:number,active:number}>} daily TB 单位
 * @param {{ available?:boolean, p50DaysToFull?:number, p95DaysToFull?:number, capacityBytes?:number, capacityTb?:number, reason?:string, note?:string }|null} forecast
 * @param {{ width?:number, height?:number, pad?:{t:number,r:number,b:number,l:number} }} [opts]
 */
export function buildDualLineChart(daily, forecast = null, opts = {}) {
  const width = opts.width || 560
  const height = opts.height || 180
  const pad = { t: 16, r: 16, b: 28, l: 40, ...(opts.pad || {}) }
  const empty = {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    physicalLine: '',
    activeLine: '',
    gapPath: '',
    physicalPts: [],
    activePts: [],
    forecastP50: '',
    forecastP95: '',
    forecastBand: '',
    capacityY: null,
    capacityLabel: '',
    intersectP50: null,
    intersectP95: null,
    xLabels: [],
    yTicks: [],
    showForecast: false,
    forecastNote: '',
    yMax: 1,
  }

  if (!daily?.length) return empty

  const histN = daily.length
  const p50Days = forecast?.available ? n(forecast.p50DaysToFull, 0) : 0
  const p95Days = forecast?.available ? n(forecast.p95DaysToFull, 0) : 0
  const capacityTb =
    forecast?.capacityTb != null
      ? n(forecast.capacityTb)
      : forecast?.capacityBytes != null
        ? n(forecast.capacityBytes) / 1024 ** 4
        : null

  const showForecast = !!(forecast?.available && (p50Days > 0 || p95Days > 0))
  const extendDays = showForecast ? Math.max(p50Days, p95Days, 1) : 0
  const totalSlots = Math.max(1, histN - 1 + (showForecast ? extendDays : 0))

  const histTotals = daily.map((d) => n(d.total))
  const histActives = daily.map((d) => n(d.active))
  let yMax = Math.max(0.1, ...histTotals, ...histActives)
  if (capacityTb != null && capacityTb > 0) yMax = Math.max(yMax, capacityTb)
  if (showForecast && capacityTb != null && capacityTb > 0) {
    yMax = Math.max(yMax, capacityTb * 1.02)
  }
  yMax *= 1.08

  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b

  const xAt = (i) => pad.l + (i / totalSlots) * plotW
  const yAt = (v) => pad.t + plotH - (n(v) / yMax) * plotH

  const physicalPts = daily.map((d, i) => ({
    x: xAt(i),
    y: yAt(d.total),
    v: n(d.total),
    day: d.day || d.date || String(i),
    date: d.date,
  }))
  const activePts = daily.map((d, i) => ({
    x: xAt(i),
    y: yAt(d.active),
    v: n(d.active),
    day: d.day || d.date || String(i),
    date: d.date,
  }))

  const last = daily[histN - 1]
  const lastTotal = n(last.total)
  const lastIdx = histN - 1

  let forecastP50 = ''
  let forecastP95 = ''
  let forecastBand = ''
  let intersectP50 = null
  let intersectP95 = null

  if (showForecast) {
    const endY = capacityTb != null && capacityTb > 0 ? capacityTb : lastTotal * 1.15
    const p50EndIdx = lastIdx + Math.max(1, p50Days)
    const p95EndIdx = lastIdx + Math.max(1, p95Days || p50Days)
    const p50End = { x: xAt(Math.min(p50EndIdx, totalSlots)), y: yAt(endY) }
    const p95End = { x: xAt(Math.min(p95EndIdx, totalSlots)), y: yAt(endY) }
    const start = { x: xAt(lastIdx), y: yAt(lastTotal) }

    forecastP50 = `${start.x.toFixed(1)},${start.y.toFixed(1)} ${p50End.x.toFixed(1)},${p50End.y.toFixed(1)}`
    forecastP95 = `${start.x.toFixed(1)},${start.y.toFixed(1)} ${p95End.x.toFixed(1)},${p95End.y.toFixed(1)}`
    forecastBand = `M ${start.x.toFixed(1)},${start.y.toFixed(1)} L ${p95End.x.toFixed(1)},${p95End.y.toFixed(1)} L ${p50End.x.toFixed(1)},${p50End.y.toFixed(1)} Z`

    if (capacityTb != null && capacityTb > 0) {
      intersectP50 = { ...p50End, label: `p50 · ${Math.round(p50Days)}d` }
      intersectP95 = { ...p95End, label: `p95 · ${Math.round(p95Days)}d` }
    }
  }

  const xLabels = []
  const labelIdx = [0, Math.floor((histN - 1) / 2), histN - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  )
  for (const i of labelIdx) {
    const d = daily[i]
    xLabels.push({
      x: xAt(i),
      y: height - 8,
      text: String(d.day || (d.date || '').slice(5) || '').slice(-5),
    })
  }

  const yTicks = [0, 0.5, 1].map((f) => {
    const v = yMax * f
    return { y: yAt(v), text: v >= 10 ? v.toFixed(0) : v.toFixed(1) }
  })

  let forecastNote = ''
  if (!forecast || forecast.available === false) {
    forecastNote =
      forecast?.reason === 'INSUFFICIENT' || forecast?.note
        ? forecast.note || '样本不足 15 天，不出预测'
        : ''
  } else if (showForecast) {
    forecastNote = `预测 p50 ${Math.round(p50Days)}d / p95 ${Math.round(p95Days)}d`
    if (capacityTb != null && capacityTb > 0) {
      forecastNote += ` · 容量 ${capacityTb.toFixed(2)} TB`
    }
  }

  return {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    physicalLine: ptsToPolyline(physicalPts),
    activeLine: ptsToPolyline(activePts),
    gapPath: areaBetween(physicalPts, activePts),
    physicalPts,
    activePts,
    forecastP50,
    forecastP95,
    forecastBand,
    capacityY: capacityTb != null && capacityTb > 0 ? yAt(capacityTb) : null,
    capacityLabel: capacityTb != null && capacityTb > 0 ? `${capacityTb.toFixed(2)} TB` : '',
    intersectP50,
    intersectP95,
    xLabels,
    yTicks,
    showForecast,
    forecastNote,
    yMax,
  }
}

/** 明细抽屉用的简易三口径曲线 */
export function buildDetailCurveChart(curve, opts = {}) {
  const daily = (curve || []).map((p) => ({
    day: (p.date || '').slice(5),
    date: p.date,
    total: Number((n(p.totalBytes) / 1024 ** 4).toFixed(4)),
    active: Number((n(p.activeBytes) / 1024 ** 4).toFixed(4)),
    reclaimable: Number((n(p.reclaimableBytes) / 1024 ** 4).toFixed(4)),
  }))
  return buildDualLineChart(daily, null, {
    width: opts.width || 480,
    height: opts.height || 140,
    pad: opts.pad || { t: 12, r: 12, b: 24, l: 36 },
  })
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `storage-report-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function triggerBase64Download(b64, filename, mime = 'text/csv;charset=utf-8') {
  const bin = atob(String(b64).replace(/^data:[^;]+;base64,/, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  triggerBlobDownload(new Blob([bytes], { type: mime }), filename)
}
