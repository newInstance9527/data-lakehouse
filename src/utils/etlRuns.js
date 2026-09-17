/** ETL 执行记录 / 节点日志 · 演示数据生成 */

export const RUN_STATUS_META = {
  SUCCESS: { label: '成功', tag: 'tag-green', color: '#52c41a' },
  ERROR: { label: '失败', tag: 'tag-red', color: '#f5222d' },
  RUNNING: { label: '运行中', tag: 'tag-blue', color: '#1890ff' },
  PENDING: { label: '排队', tag: 'tag-gray', color: '#8c8c8c' },
}

const NODE_STATUS_LINE = {
  done: { level: 'INFO', text: '完成写出' },
  running: { level: 'INFO', text: '执行中 · Shuffle 62%' },
  blocked: { level: 'ERROR', text: '质量门禁阻断' },
  pending: { level: 'INFO', text: '等待调度' },
  warn: { level: 'WARN', text: '告警继续' },
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export function formatNow() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function makeRunId(taskId) {
  const d = new Date()
  const day = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const seq = Math.floor(Math.random() * 900 + 100)
  return `ds-${taskId || 'dag'}-${day}-${seq}`
}

/** 为任务生成演示执行记录列表 */
export function seedTaskLogs(task) {
  if (!task) return []
  const id = task.id || 'dag'
  if (id === 'trade_dwd') {
    return [
      {
        run: 'ds-trade_dwd-20260903-101',
        status: 'ERROR',
        start: '2026-09-03 02:00:11',
        end: '2026-09-03 02:15:30',
        duration: '15m19s',
        note: 'DWD 质量门禁 PK_UNIQUE 失败 · 阻断',
        trigger: 'cron',
        env: 'prod',
        rowsIn: '32,851,002',
        rowsOut: '0',
        failNode: '质量门禁',
      },
      {
        run: 'ds-trade_dwd-20260902-088',
        status: 'SUCCESS',
        start: '2026-09-02 02:00:08',
        end: '2026-09-02 02:09:45',
        duration: '9m37s',
        note: '正常完成 · 32,847,120 行',
        trigger: 'cron',
        env: 'prod',
        rowsIn: '32,847,120',
        rowsOut: '32,847,120',
      },
      {
        run: 'ds-trade_dwd-20260901-076',
        status: 'SUCCESS',
        start: '2026-09-01 02:00:07',
        end: '2026-09-01 02:10:02',
        duration: '9m55s',
        note: '正常完成',
        trigger: 'cron',
        env: 'prod',
        rowsIn: '31,902,441',
        rowsOut: '31,902,441',
      },
      {
        run: 'ds-trade_dwd-20260831-trial-09',
        status: 'SUCCESS',
        start: '2026-08-31 14:22:01',
        end: '2026-08-31 14:28:40',
        duration: '6m39s',
        note: 'TEST 试跑 · 抽样 1%',
        trigger: 'manual',
        env: 'test',
        rowsIn: '328,471',
        rowsOut: '328,471',
      },
    ]
  }
  if (id === 'user_dwd') {
    return [
      {
        run: 'ds-user_dwd-20260903-044',
        status: 'SUCCESS',
        start: '2026-09-03 03:00:05',
        end: '2026-09-03 03:18:22',
        duration: '18m17s',
        note: '正常完成 · 1,824,500 行',
        trigger: 'cron',
        env: 'prod',
        rowsIn: '1,824,500',
        rowsOut: '1,824,500',
      },
      {
        run: 'ds-user_dwd-20260902-041',
        status: 'SUCCESS',
        start: '2026-09-02 03:00:04',
        end: '2026-09-02 03:17:02',
        duration: '16m58s',
        note: '正常完成',
        trigger: 'cron',
        env: 'prod',
        rowsIn: '1,810,220',
        rowsOut: '1,810,220',
      },
      {
        run: 'ds-user_dwd-20260901-039',
        status: 'ERROR',
        start: '2026-09-01 03:00:06',
        end: '2026-09-01 03:08:11',
        duration: '8m5s',
        note: '上游 CDC 延迟超阈 · 跳过写出',
        trigger: 'cron',
        env: 'prod',
        rowsIn: '1,802,100',
        rowsOut: '0',
        failNode: '用户 CDC',
      },
    ]
  }
  if (id === 'file_landing') {
    return [
      {
        run: 'ds-file_landing-20260903-012',
        status: 'RUNNING',
        start: '2026-09-03 01:00:02',
        end: '—',
        duration: '进行中',
        note: 'SFTP 扫描 · 已落地 3/5 文件',
        trigger: 'cron',
        env: 'prod',
        rowsIn: '—',
        rowsOut: '—',
      },
      {
        run: 'ds-file_landing-20260902-011',
        status: 'SUCCESS',
        start: '2026-09-02 01:00:01',
        end: '2026-09-02 01:12:40',
        duration: '12m39s',
        note: '5 个文件入 ODS',
        trigger: 'cron',
        env: 'prod',
        rowsIn: '5 files',
        rowsOut: '1,284,390',
      },
      {
        run: 'ds-file_landing-20260901-010',
        status: 'SUCCESS',
        start: '2026-09-01 01:00:03',
        end: '2026-09-01 01:09:18',
        duration: '9m15s',
        note: '4 个文件入 ODS',
        trigger: 'cron',
        env: 'prod',
        rowsIn: '4 files',
        rowsOut: '902,114',
      },
    ]
  }
  return []
}

/** 展开某次 run 的三态日志 + 节点时间线 */
export function buildRunDetail(task, runRow) {
  if (!task || !runRow) return null
  const status = runRow.status || 'SUCCESS'
  const nodes = (task.nodes || []).map((n, i) => {
    const st =
      status === 'ERROR' && (n.type === 'quality' || n.status === 'blocked')
        ? 'blocked'
        : status === 'RUNNING' && i === Math.min(2, (task.nodes || []).length - 1)
          ? 'running'
          : status === 'RUNNING' && i > 2
            ? 'pending'
            : n.status === 'blocked'
              ? 'blocked'
              : status === 'ERROR' && i > (task.nodes || []).findIndex((x) => x.type === 'quality' || x.status === 'blocked')
                ? 'pending'
                : 'done'
    return {
      nodeId: n.id,
      name: n.name,
      type: n.type,
      status: st,
      start: offsetTime(runRow.start, i * 45),
      end: st === 'pending' || st === 'running' ? '—' : offsetTime(runRow.start, i * 45 + 30),
      duration: st === 'pending' ? '—' : st === 'running' ? '…' : `${20 + i * 8}s`,
      lines: buildNodeLogLines(n, st, runRow),
    }
  })

  const stdout = [
    `[INFO] ${runRow.start} 启动 DAG ${task.name} · cron=${task.cron || '-'} · env=${runRow.env || task.env}`,
    `[INFO] ${offsetTime(runRow.start, 2)} 校验通过 · 节点 ${task.nodes?.length || 0} · 连线 ${task.edges?.length || 0}`,
    `[INFO] ${offsetTime(runRow.start, 5)} 申请资源 · engine=${task.engine || 'flink'} · queue=${task.resources?.queue || 'default'}`,
    ...nodes.map(
      (n) =>
        `[${n.status === 'blocked' ? 'ERROR' : 'INFO'}] ${n.start} TaskNode[${n.name}] type=${n.type} status=${n.status}${n.status === 'blocked' ? ' · 阻断下游' : ''}`,
    ),
  ]
  if (status === 'ERROR') {
    stdout.push(`[ERROR] ${runRow.end} 任务失败 · ${runRow.note || '见 stderr'} · 已推送 IM/邮件/工单`)
  } else if (status === 'SUCCESS') {
    stdout.push(`[INFO] ${runRow.end} 全部节点成功 · 输入 ${runRow.rowsIn || '-'} · 输出 ${runRow.rowsOut || '-'} · SLA ${task.sla || '-'} 达标`)
  } else {
    stdout.push(`[INFO] ${formatNow()} 作业运行中 · 已完成 ${nodes.filter((n) => n.status === 'done').length}/${nodes.length} 节点`)
  }

  const stderr =
    status === 'ERROR'
      ? [
          'org.apache.spark.SparkException: Quality gate blocked: PK_UNIQUE failed',
          '  at QualityExecutor.scala:382',
          `  Caused by: ${runRow.note || 'duplicate keys on target table'}`,
          '  Hint: 检查上游 CDC 回放窗口或开启 quarantine 表',
        ]
      : ['-- no errors --']

  const app = {
    applicationId: `application_${String(runRow.run).replace(/\W/g, '').slice(-10)}_${1000 + (nodes.length % 9) * 111}`,
    engine: task.engine || 'flink',
    executors: status === 'ERROR' ? '3 failed / 18 total' : status === 'RUNNING' ? '12 running / 18 total' : '21 successful',
    shuffle: status === 'RUNNING' ? '412 MB read / 1.1 GB write' : '842 MB read / 6.2 GB write',
    checkpoint: status === 'RUNNING' ? 'last #128 · lag 2.4s' : 'last completed · ok',
  }

  const metrics = {
    rowsIn: runRow.rowsIn || '—',
    rowsOut: runRow.rowsOut || '—',
    doneNodes: nodes.filter((n) => n.status === 'done').length,
    totalNodes: nodes.length,
    failNode: runRow.failNode || nodes.find((n) => n.status === 'blocked')?.name || '—',
  }

  return { ...runRow, stdout, stderr, app, nodes, metrics }
}

function offsetTime(start, secAdd) {
  if (!start || start === '—') return '—'
  const m = String(start).match(/(\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return start
  let s = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + secAdd
  const h = Math.floor(s / 3600) % 24
  const mi = Math.floor((s % 3600) / 60)
  const se = s % 60
  const prefix = String(start).replace(/\d{2}:\d{2}:\d{2}$/, '')
  return `${prefix}${pad(h)}:${pad(mi)}:${pad(se)}`
}

export function buildNodeLogLines(node, status, runRow) {
  const name = node?.name || 'node'
  const start = runRow?.start || formatNow()
  const hint = NODE_STATUS_LINE[status] || NODE_STATUS_LINE.pending
  const lines = [
    { t: offsetTime(start, 0), level: 'INFO', msg: `[调度] task[${name}] 提交` },
    { t: offsetTime(start, 4), level: 'INFO', msg: `[引擎] Executor 启动 · 继承任务引擎` },
    { t: offsetTime(start, 12), level: 'INFO', msg: `[业务] 读取上游 / 配置 conf 就绪` },
  ]
  if (status === 'blocked') {
    lines.push({ t: offsetTime(start, 20), level: 'ERROR', msg: `[质量] ${hint.text} · 重复键阻断输出` })
  } else if (status === 'running') {
    lines.push({ t: offsetTime(start, 30), level: 'INFO', msg: `[引擎] ${hint.text}` })
  } else if (status === 'pending') {
    lines.push({ t: offsetTime(start, 5), level: 'INFO', msg: `[调度] ${hint.text}` })
  } else {
    lines.push({ t: offsetTime(start, 35), level: 'INFO', msg: `[完成] ${hint.text}` })
  }
  return lines
}

/** 从任务 logs 中取与节点相关的最近一次运行日志 */
export function latestNodeLogs(task, nodeId) {
  if (!task || !nodeId) return { run: null, lines: [], status: 'pending' }
  const logs = task.logs || []
  if (!logs.length) {
    const n = task.nodes?.find((x) => x.id === nodeId)
    return {
      run: null,
      status: n?.status || 'pending',
      lines: buildNodeLogLines(n, n?.status || 'pending', { start: formatNow() }),
    }
  }
  const latest = logs[0]
  const detail = buildRunDetail(task, latest)
  const row = detail?.nodes?.find((x) => x.nodeId === nodeId)
  return {
    run: latest.run,
    status: row?.status || latest.status,
    lines: row?.lines || [],
    duration: row?.duration,
    start: row?.start,
    end: row?.end,
  }
}

/** 试跑：追加一条 RUNNING/SUCCESS 记录 */
export function createTrialRun(task, { status = 'RUNNING', note = 'TEST 试跑提交' } = {}) {
  const run = makeRunId(task?.id)
  const start = formatNow()
  return {
    run,
    status,
    start,
    end: status === 'RUNNING' ? '—' : formatNow(),
    duration: status === 'RUNNING' ? '进行中' : '12s',
    note,
    trigger: 'manual',
    env: task?.env === 'prod' ? 'test' : task?.env || 'test',
  }
}
