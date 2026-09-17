<script setup>
import { useRouter } from 'vue-router'
import PageHeader from '@/components/common/PageHeader.vue'
import { useToast } from '@/composables/useToast'
import { pageGuideOf } from '@/data/pageGuides'
import {
  SEC_AUDIT_LOG,
  SEC_CLASSIFICATION,
  SEC_IRON_RULES,
  SEC_KPIS,
  SEC_MASK_POLICIES,
  SEC_PATH_ALLOW,
  SEC_PATH_FORBID,
  SEC_SERVICE_ACCOUNTS,
  SEC_VAULT_ROTATION,
} from '@/data/security'

const router = useRouter()
const { showToast } = useToast()
const guide = pageGuideOf('security')

function exportAuditReport() {
  showToast('📋 权限审计报告导出中 · CSV（用户/角色/表/列/权限/有效期/审批人）', 'success')
}

function manageServiceAccounts() {
  showToast('🔑 已跳转到服务账号管理（演示）', 'info')
}

function newPermissionApply() {
  router.push('/apply')
}

function registerSa() {
  showToast('＋ 注册作业 SA（演示）· Vault 动态凭证', 'info')
}

function rotateVault() {
  showToast('⚡ 凭证轮换已触发 · Vault 动态生成 DB 密码 + Kafka SASL', 'success')
}

function expandFullLog() {
  showToast(
    '📜 完整日志\n[02:00:01] 启动 expire_snapshots\n[02:08:12] 回收 38GB\n[02:13:15] 全部完成',
    'info',
  )
}
</script>

<template>
  <div class="sec-page">
    <PageHeader
      title="数据安全与权限中心"
      subtitle="Gravitino 统一裁决 · Trino 动态脱敏 · OIDC 人机分身份"
      :guide="guide"
    >
      <button type="button" class="btn btn-sm" @click="exportAuditReport">📋 权限审计报告</button>
      <button type="button" class="btn btn-sm" @click="manageServiceAccounts">🔑 作业 SA 管理</button>
      <button type="button" class="btn btn-sm btn-primary" @click="newPermissionApply">+ 新建权限申请</button>
    </PageHeader>

    <div class="kpi-grid sec-kpi">
      <div v-for="(k, i) in SEC_KPIS" :key="i" class="kpi-card" :class="k.color">
        <div class="kpi-icon" :class="k.color">{{ k.icon }}</div>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">
          {{ k.value }}<span class="kpi-unit">{{ k.unit }}</span>
        </div>
        <div class="kpi-trend" :class="k.trendUp ? 'up' : 'down'">{{ k.trend }}</div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏷️ 分级分类资产分布</div>
        </div>
        <div class="card-body">
          <div class="sec-class-list">
            <div v-for="c in SEC_CLASSIFICATION" :key="c.label" class="sec-class-row">
              <div class="sec-class-tag"><span class="tag" :class="c.tagCls">{{ c.label }}</span></div>
              <div class="progress sec-class-bar">
                <div class="progress-bar" :style="{ width: `${c.pct}%`, background: c.bar }" />
              </div>
              <div class="sec-class-stat"><b>{{ c.count }}</b> 张 · {{ c.pct }}%</div>
            </div>
          </div>
          <div class="sec-iron">
            <div class="sec-iron-title">🚨 权限收敛铁律（已落地安全组）</div>
            <ul>
              <li v-for="(line, li) in SEC_IRON_RULES" :key="li">{{ line }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🎭 动态脱敏策略（Trino 查询侧）</div>
          <span class="tag tag-green">10 策略 · 已生效</span>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>策略</th>
                <th>匹配列</th>
                <th>算法</th>
                <th>豁免角色</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in SEC_MASK_POLICIES" :key="p.name">
                <td>{{ p.name }}</td>
                <td><code>{{ p.cols }}</code></td>
                <td>{{ p.algo }}</td>
                <td>{{ p.exempt }}</td>
                <td><span class="tag tag-green">{{ p.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card sec-audit">
      <div class="card-header">
        <div class="card-title">📜 审计日志 · 近 24 小时高风险记录 <span class="tip">（Gravitino + Trino + 门户）</span></div>
        <button type="button" class="btn btn-sm btn-link" @click="expandFullLog">展开完整日志 →</button>
      </div>
      <div class="card-body" style="padding: 0">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 60px">风险</th>
              <th>时间</th>
              <th>用户 / 身份</th>
              <th>操作</th>
              <th>对象</th>
              <th>扫描量/结果</th>
              <th>来源</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in SEC_AUDIT_LOG" :key="i">
              <td><span class="tag" :class="row.riskCls">{{ row.risk }}</span></td>
              <td>{{ row.time }}</td>
              <td><b v-if="row.userBold">{{ row.user }}</b><template v-else>{{ row.user }}</template></td>
              <td>{{ row.action }}</td>
              <td :style="row.targetDanger ? { color: 'var(--danger)' } : undefined">{{ row.target }}</td>
              <td>
                <b v-if="row.resultDanger" style="color: var(--danger)">{{ row.result }}</b>
                <template v-else>{{ row.result }}</template>
              </td>
              <td><span class="tag" :class="row.sourceCls">{{ row.source }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔑 作业服务账号（SA）· §35.1 <span class="tip">· Vault 凭证 · 禁止共享</span></div>
          <button type="button" class="btn btn-sm" @click="registerSa">＋ 注册 SA</button>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>SA 名称</th>
                <th>绑定作业</th>
                <th>权限范围</th>
                <th>凭证</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="sa in SEC_SERVICE_ACCOUNTS" :key="sa.name">
                <td><code>{{ sa.name }}</code></td>
                <td>{{ sa.job }}</td>
                <td>{{ sa.scope }}</td>
                <td>{{ sa.cred }}</td>
                <td><span class="tag" :class="sa.statusCls">{{ sa.status }}</span></td>
              </tr>
            </tbody>
          </table>
          <div class="sec-footnote">铁律：一个 SA 对应一个作业域 · 禁止人持有 SA 凭证 · 作业下线自动回收</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">🔐 Vault 凭证轮换 · §35.2 <span class="tip">· 剩余天数监控</span></div>
          <span class="tag tag-orange">2 将到期</span>
        </div>
        <div class="card-body" style="padding: 0">
          <table class="table">
            <thead>
              <tr>
                <th>凭证类型</th>
                <th>轮换周期</th>
                <th>上次轮换</th>
                <th>剩余</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in SEC_VAULT_ROTATION" :key="v.type">
                <td>{{ v.type }}</td>
                <td>{{ v.cycle }}</td>
                <td>{{ v.last }}</td>
                <td>
                  <b v-if="v.remainWarn" style="color: var(--warning)">{{ v.remain }}</b>
                  <template v-else>{{ v.remain }}</template>
                </td>
                <td><span class="tag" :class="v.statusCls">{{ v.status }}</span></td>
              </tr>
            </tbody>
          </table>
          <div class="sec-footnote">轮换失败告警 P1 · Vault 动态生成旧密码自动失效</div>
          <div class="sec-vault-action">
            <button type="button" class="btn btn-sm btn-primary" @click="rotateVault">⚡ 立即轮换</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">🛣️ 查询路径白名单 · §35.3 <span class="tip">· 正常路径绿色 · 禁止路径红色</span></div>
      </div>
      <div class="card-body sec-path-body">
        <div class="grid grid-2">
          <div>
            <div class="sec-path-title ok">✓ 允许路径</div>
            <div class="flow-chain sec-flow">
              <template v-for="(n, ni) in SEC_PATH_ALLOW" :key="ni">
                <div v-if="ni > 0" class="flow-arrow">↓</div>
                <div class="flow-node sec-node-ok">
                  <div class="fn-icon">{{ n.icon }}</div>
                  <div class="fn-title">{{ n.title }}</div>
                  <div v-if="n.sub" class="fn-sub">{{ n.sub }}</div>
                </div>
              </template>
            </div>
            <div class="sec-path-note ok">
              <b>作业 SA（Vault 凭证）</b><br />
              DS/Flink → Iceberg 写 / CK 写 / MinIO 读写
            </div>
          </div>
          <div>
            <div class="sec-path-title bad">✗ 禁止路径</div>
            <div class="flow-chain sec-flow">
              <template v-for="(n, ni) in SEC_PATH_FORBID" :key="ni">
                <div v-if="ni > 0" class="flow-arrow bad">🚫</div>
                <div class="flow-node sec-node-bad">
                  <div class="fn-icon">{{ n.icon }}</div>
                  <div class="fn-title">{{ n.title }}</div>
                  <div class="fn-sub bad">{{ n.sub }}</div>
                </div>
              </template>
            </div>
            <div class="sec-path-note bad">
              <b>防火墙 + 安全组强制阻断</b><br />
              已记录 1 次尝试（09-03 10:12 · 10.x.x.243）
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sec-kpi {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 16px;
}
@media (max-width: 1000px) {
  .sec-kpi { grid-template-columns: repeat(2, 1fr); }
}

.tip {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
}

.sec-page .card { margin-top: 16px; }
.sec-page .grid-2 .card { margin-top: 16px; }

.sec-class-list { display: flex; flex-direction: column; gap: 14px; }
.sec-class-row { display: flex; gap: 12px; align-items: center; }
.sec-class-tag { width: 80px; flex-shrink: 0; }
.sec-class-bar { flex: 1; }
.sec-class-stat { width: 120px; text-align: right; font-size: 12px; flex-shrink: 0; }

.sec-iron {
  margin-top: 20px;
  padding: 14px;
  background: var(--danger-light);
  border-radius: 8px;
  border: 1px solid #ffa39e;
}
.sec-iron-title { font-weight: 600; color: var(--danger); margin-bottom: 8px; }
.sec-iron ul {
  padding-left: 18px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.8;
  margin: 0;
}

.sec-audit { margin-top: 16px; }

.sec-footnote {
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-3);
  border-top: 1px solid var(--border);
}
.sec-vault-action { padding: 8px 12px; }

.sec-path-body { padding: 14px; }
.sec-path-title { font-weight: 600; margin-bottom: 10px; }
.sec-path-title.ok { color: var(--success); }
.sec-path-title.bad { color: var(--danger); }

.sec-flow {
  padding: 4px;
  flex-direction: column;
  align-items: stretch;
}
.flow-chain {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.flow-arrow {
  text-align: center;
  color: var(--text-3);
  font-size: 12px;
  padding: 2px 0;
}
.flow-arrow.bad { color: var(--danger); }

.flow-node {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  text-align: center;
}
.sec-node-ok {
  border-color: var(--success);
  background: var(--success-light);
}
.sec-node-bad {
  border-color: var(--danger);
  background: var(--danger-light);
  opacity: 0.85;
}
.fn-icon { font-size: 20px; }
.fn-title { font-weight: 600; font-size: 13px; margin-top: 4px; }
.fn-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.fn-sub.bad { color: var(--danger); }

.sec-path-note {
  margin-top: 12px;
  padding: 10px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.6;
}
.sec-path-note.ok {
  background: var(--success-light);
  color: var(--success);
  border: 1px solid var(--success);
}
.sec-path-note.bad {
  background: var(--danger-light);
  color: var(--danger);
  border: 1px solid var(--danger);
}
</style>
