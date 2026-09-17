/** 数据标准 mock · 对齐演示 HTML STD_* */

export const STD_KPIS = [
  { key: 'fields', icon: '📐', color: 'var(--primary)', label: '标准字段', value: '86', unit: '个', sub: 'v2 版本' },
  { key: 'codes', icon: '🏷️', color: '#722ed1', label: '标准码值', value: '24', unit: '组', sub: '覆盖 6 个域' },
  { key: 'mappings', icon: '🔗', color: 'var(--success)', label: '映射规则', value: '142', unit: '条', sub: 'DWD 100% 映射' },
  { key: 'rate', icon: '✅', color: 'var(--warning)', label: '落地达标率', value: '98', unit: '%', sub: '2 项不达标' },
  { key: 'fix', icon: '⚠️', color: 'var(--danger)', label: '待修复', value: '2', unit: '项', sub: '阻断中' },
]

export const STD_FIELDS = [
  { name: 'user_id', type: 'BIGINT', unit: '—', desc: '用户唯一标识（全平台统一）', domain: '用户', mapped: 142, status: 'ok' },
  { name: 'order_id', type: 'BIGINT', unit: '—', desc: '订单唯一标识（全平台统一）', domain: '交易', mapped: 86, status: 'ok' },
  { name: 'order_no', type: 'VARCHAR(32)', unit: '—', desc: '订单业务编号（面向用户）', domain: '交易', mapped: 42, status: 'ok' },
  { name: 'pay_amt', type: 'DECIMAL(18,2)', unit: '元', desc: '支付金额（含运费，不含优惠）', domain: '交易', mapped: 68, status: 'ok' },
  { name: 'pay_amt_fen', type: 'BIGINT', unit: '分', desc: '支付金额（分，兼容源系统）', domain: '交易', mapped: 12, status: 'warn' },
  { name: 'order_status', type: 'INT', unit: '码值', desc: '订单状态（STD-C0021）', domain: '交易', mapped: 54, status: 'ok' },
  { name: 'order_channel', type: 'VARCHAR(16)', unit: '码值', desc: '下单渠道（STD-CH001）', domain: '交易', mapped: 38, status: 'ok' },
  { name: 'buyer_mobile', type: 'VARCHAR(11)', unit: '—', desc: '买家手机号（PII·脱敏）', domain: '用户', mapped: 24, status: 'ok' },
  { name: 'gmt_create', type: 'TIMESTAMP', unit: '—', desc: '创建时间（UTC+8）', domain: '通用', mapped: 186, status: 'ok' },
  { name: 'gmt_modified', type: 'TIMESTAMP', unit: '—', desc: '修改时间（UTC+8）', domain: '通用', mapped: 186, status: 'ok' },
  { name: 'dt', type: 'DATE', unit: '—', desc: '业务日期（分区字段）', domain: '通用', mapped: 186, status: 'ok' },
  { name: 'sku_id', type: 'BIGINT', unit: '—', desc: '商品 SKU 唯一标识', domain: '商品', mapped: 32, status: 'ok' },
  { name: 'spu_id', type: 'BIGINT', unit: '—', desc: '商品 SPU 唯一标识', domain: '商品', mapped: 28, status: 'ok' },
  { name: 'sku_name', type: 'VARCHAR(128)', unit: '—', desc: 'SKU 名称', domain: '商品', mapped: 22, status: 'ok' },
  { name: 'category_id', type: 'BIGINT', unit: '—', desc: '商品类目 ID', domain: '商品', mapped: 18, status: 'ok' },
  { name: 'gender', type: 'CHAR(1)', unit: '码值', desc: '性别（STD-G0001）', domain: '用户', mapped: 16, status: 'ok' },
  { name: 'user_status', type: 'INT', unit: '码值', desc: '用户状态（STD-S0001）', domain: '用户', mapped: 14, status: 'ok' },
  { name: 'pay_method', type: 'INT', unit: '码值', desc: '支付方式（STD-P0001）', domain: '交易', mapped: 36, status: 'ok' },
  { name: 'refund_reason', type: 'INT', unit: '码值', desc: '退款原因（STD-R0001）', domain: '交易', mapped: 12, status: 'warn' },
  { name: 'refund_amt', type: 'DECIMAL(18,2)', unit: '元', desc: '退款金额', domain: '交易', mapped: 10, status: 'ok' },
  { name: 'store_id', type: 'BIGINT', unit: '—', desc: '门店唯一标识', domain: '门店', mapped: 20, status: 'ok' },
  { name: 'region_code', type: 'VARCHAR(12)', unit: '码值', desc: '行政区划代码', domain: '通用', mapped: 44, status: 'ok' },
  { name: 'currency', type: 'CHAR(3)', unit: '码值', desc: '币种（ISO 4217）', domain: '交易', mapped: 8, status: 'ok' },
  { name: 'qty', type: 'INT', unit: '件', desc: '购买数量', domain: '交易', mapped: 40, status: 'ok' },
]

export const STD_CODES = [
  {
    id: 'STD-C0021',
    name: '订单状态',
    field: 'order_status',
    values: '0=草稿, 1=已支付, 2=已发货, 3=已送达, 4=已退款, 5=已关闭',
    count: 6,
    mapped: 'dwd_order_detail · ods_trade.s_order',
    status: 'ok',
  },
  {
    id: 'STD-CH001',
    name: '下单渠道',
    field: 'order_channel',
    values: 'APP=移动端, WEB=PC端, MiniApp=小程序, H5=H5页面',
    count: 4,
    mapped: 'dwd_order_detail · ods_trade.s_order',
    status: 'ok',
  },
  {
    id: 'STD-G0001',
    name: '性别',
    field: 'gender',
    values: 'M=男, F=女, U=未知',
    count: 3,
    mapped: 'dwd_user_info · dim_user',
    status: 'ok',
  },
  {
    id: 'STD-P0001',
    name: '支付方式',
    field: 'pay_method',
    values: '1=微信, 2=支付宝, 3=银行卡, 4=余额, 5=货到付款',
    count: 5,
    mapped: 'dwd_order_detail',
    status: 'ok',
  },
  {
    id: 'STD-R0001',
    name: '退款原因',
    field: 'refund_reason',
    values: '1=质量问题, 2=不想要, 3=发错货, 4=物流慢, 9=其他',
    count: 5,
    mapped: 'dwd_refund_detail',
    status: 'warn',
  },
  {
    id: 'STD-S0001',
    name: '用户状态',
    field: 'user_status',
    values: '0=未激活, 1=正常, 2=冻结, 3=注销',
    count: 4,
    mapped: 'dwd_user_info',
    status: 'ok',
  },
  {
    id: 'STD-L0001',
    name: '物流状态',
    field: 'logistics_status',
    values: '0=待揽收, 1=运输中, 2=派送中, 3=已签收, 4=异常',
    count: 5,
    mapped: 'dwd_logistics_detail',
    status: 'ok',
  },
  {
    id: 'STD-M0001',
    name: '会员等级',
    field: 'member_level',
    values: '1=普通, 2=银卡, 3=金卡, 4=黑金',
    count: 4,
    mapped: 'dwd_user_info · dim_member',
    status: 'ok',
  },
  {
    id: 'STD-T0001',
    name: '优惠类型',
    field: 'promo_type',
    values: '1=满减, 2=折扣, 3=券, 4=积分抵扣',
    count: 4,
    mapped: 'dwd_order_detail',
    status: 'ok',
  },
  {
    id: 'STD-W0001',
    name: '仓库类型',
    field: 'warehouse_type',
    values: '1=中心仓, 2=前置仓, 3=门店仓',
    count: 3,
    mapped: 'dim_warehouse',
    status: 'ok',
  },
  {
    id: 'STD-Y0001',
    name: '发票类型',
    field: 'invoice_type',
    values: '1=电子普票, 2=纸质普票, 3=专票',
    count: 3,
    mapped: 'dwd_invoice',
    status: 'ok',
  },
  {
    id: 'STD-Z0001',
    name: '售后状态',
    field: 'aftersale_status',
    values: '0=申请中, 1=处理中, 2=已完成, 3=已关闭',
    count: 4,
    mapped: 'dwd_aftersale',
    status: 'warn',
  },
]

export const STD_MAPPINGS = [
  { src: 's_order.stat', std: 'order_status(STD-C0021)', table: 'dwd_order_detail', rule: 'CASE stat WHEN 0 THEN 0 WHEN 1 THEN 1 ... END', status: 'ok' },
  { src: 's_order.channel', std: 'order_channel(STD-CH001)', table: 'dwd_order_detail', rule: '直接映射（码值一致）', status: 'ok' },
  { src: 's_order.amount', std: 'pay_amt(元)', table: 'dwd_order_detail', rule: 'amount / 100（源系统单位分→元）', status: 'ok' },
  { src: 's_user.mobile', std: 'buyer_mobile', table: 'dwd_user_info', rule: '直接映射 + 入湖时脱敏', status: 'ok' },
  { src: 's_user.sex', std: 'gender(STD-G0001)', table: 'dwd_user_info', rule: 'CASE sex WHEN 1 THEN M WHEN 2 THEN F ELSE U END', status: 'ok' },
  { src: 's_order.pay_type', std: 'pay_method(STD-P0001)', table: 'dwd_order_detail', rule: '码值映射表', status: 'ok' },
  { src: 's_refund.reason', std: 'refund_reason(STD-R0001)', table: 'dwd_refund_detail', rule: 'CASE reason ... 码值映射', status: 'warn' },
  { src: 's_order.order_id', std: 'order_id', table: 'dwd_order_detail', rule: '直接映射', status: 'ok' },
  { src: 's_order.user_id', std: 'user_id', table: 'dwd_order_detail', rule: '直接映射', status: 'ok' },
  { src: 's_order.sku_id', std: 'sku_id', table: 'dwd_order_detail', rule: '直接映射', status: 'ok' },
  { src: 's_order.create_time', std: 'gmt_create', table: 'dwd_order_detail', rule: '时区统一 UTC+8', status: 'ok' },
  { src: 's_order.update_time', std: 'gmt_modified', table: 'dwd_order_detail', rule: '时区统一 UTC+8', status: 'ok' },
  { src: 's_pay.pay_amt', std: 'pay_amt(元)', table: 'dwd_order_detail', rule: '分转元 / 100', status: 'ok' },
  { src: 's_user.status', std: 'user_status(STD-S0001)', table: 'dwd_user_info', rule: '码值映射表', status: 'ok' },
  { src: 's_goods.sku', std: 'sku_id', table: 'dim_sku', rule: '直接映射', status: 'ok' },
  { src: 's_order.freight', std: 'pay_amt(元)', table: 'dwd_order_detail', rule: '运费并入实付口径（废弃）', status: 'warn' },
]

export const STD_DETECTS = [
  { table: 'dwd_order_detail', field: 'order_status', std: 'STD-C0021', check: '码值合规', result: '6 种码值全部命中', status: 'ok' },
  { table: 'dwd_order_detail', field: 'pay_amt', std: 'pay_amt(元)', check: '单位+类型', result: 'DECIMAL(18,2) 单位元 ✓', status: 'ok' },
  { table: 'dwd_order_detail', field: 'order_channel', std: 'STD-CH001', check: '码值合规', result: '发现码值 "MiniApp" 未映射 → 已修复', status: 'warn' },
  { table: 'dwd_user_info', field: 'gender', std: 'STD-G0001', check: '码值合规', result: 'M/F/U 全部命中', status: 'ok' },
  { table: 'dwd_refund_detail', field: 'refund_reason', std: 'STD-R0001', check: '码值合规', result: '发现码值 "7" 不在标准枚举 → 阻断', status: 'fail' },
  { table: 'dwd_user_info', field: 'user_status', std: 'STD-S0001', check: '码值合规', result: '0/1/2/3 全部命中', status: 'ok' },
  { table: 'dwd_order_detail', field: 'order_id', std: 'order_id', check: '类型+非空', result: 'BIGINT NOT NULL ✓', status: 'ok' },
  { table: 'dwd_order_detail', field: 'user_id', std: 'user_id', check: '类型+非空', result: 'BIGINT NOT NULL ✓', status: 'ok' },
  { table: 'dwd_order_detail', field: 'buyer_mobile', std: 'buyer_mobile', check: '脱敏合规', result: '入库已脱敏 ✓', status: 'ok' },
  { table: 'dwd_order_detail', field: 'pay_method', std: 'STD-P0001', check: '码值合规', result: '1~5 全部命中', status: 'ok' },
  { table: 'dim_sku', field: 'sku_id', std: 'sku_id', check: '主键唯一', result: '唯一率 100%', status: 'ok' },
  { table: 'dwd_user_info', field: 'buyer_mobile', std: 'buyer_mobile', check: '长度+脱敏', result: 'VARCHAR(11) 脱敏 ✓', status: 'ok' },
  { table: 'ads_gmv_board', field: 'pay_amt', std: 'pay_amt(元)', check: '单位+类型', result: '口径与标准一致 ✓', status: 'ok' },
  { table: 'dwd_order_detail', field: 'gmt_create', std: 'gmt_create', check: '时区', result: 'UTC+8 ✓', status: 'ok' },
  { table: 'dwd_refund_detail', field: 'refund_amt', std: 'pay_amt(元)', check: '单位+类型', result: '发现分单位混入 → 待修', status: 'warn' },
  { table: 'ods_trade.s_order', field: 'stat', std: 'STD-C0021', check: '源码值覆盖', result: '源侧扩展码值 9 未入标准', status: 'fail' },
]

export const STD_NAMING = [
  { pattern: 'ods_<源系统>_<表名>', example: 'ods_trade.s_order', layer: 'ODS', status: 'ok' },
  { pattern: 'dwd_<域>_<实体>_<粒度>', example: 'dwd_trade.dwd_order_detail_d', layer: 'DWD', status: 'ok' },
  { pattern: 'dws_<域>_<汇总>_<周期>', example: 'dws_trade.dws_order_1d', layer: 'DWS', status: 'ok' },
  { pattern: 'ads_<业务场景>', example: 'ads.ads_gmv_board', layer: 'ADS', status: 'ok' },
  { pattern: 'dim_<实体>', example: 'dim.dim_sku', layer: 'DIM', status: 'ok' },
  { pattern: 'job_<层>_<表>_<动作>', example: 'job_dwd_order_detail_clean', layer: '任务', status: 'ok' },
  { pattern: 'topic_<域>_<事件>', example: 'topic_trade_order_paid', layer: '消息', status: 'ok' },
  { pattern: 'tmp_<层>_<用途>_<日期>', example: 'tmp_dwd_order_backfill_20260901', layer: '临时', status: 'ok' },
  { pattern: 'view_<层>_<实体>', example: 'view_dwd_order_detail_v', layer: '视图', status: 'ok' },
  { pattern: 'api_<域>_<资源>', example: 'api_trade_order_list', layer: '接口', status: 'ok' },
  { pattern: 'metric_<域>_<指标>_<周期>', example: 'metric_trade_gmv_1d', layer: '指标', status: 'ok' },
  { pattern: 'dq_<表>_<规则>', example: 'dq_dwd_order_detail_null_check', layer: '质量', status: 'ok' },
]

export function parseCodeValues(values) {
  return String(values || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf('=')
      if (i < 0) return { code: pair, label: pair }
      return { code: pair.slice(0, i).trim(), label: pair.slice(i + 1).trim() }
    })
}

export function stdStatusMeta(status, kind = 'field') {
  if (kind === 'naming') {
    if (status === 'ok') return { tag: 'tag-green', label: '✓ 合规' }
    if (status === 'warn') return { tag: 'tag-orange', label: '⚠ 待修' }
    return { tag: 'tag-red', label: '✗ 违规' }
  }
  if (kind === 'mapping') {
    if (status === 'ok') return { tag: 'tag-green', label: '✓' }
    if (status === 'warn') return { tag: 'tag-orange', label: '⚠' }
    return { tag: 'tag-red', label: '✗' }
  }
  if (kind === 'detect' || kind === 'code') {
    if (status === 'ok') return { tag: 'tag-green', label: '✓ 合规' }
    if (status === 'warn') return { tag: 'tag-orange', label: kind === 'detect' ? '⚠ 告警' : '⚠ 待修复' }
    return { tag: 'tag-red', label: '✗ 阻断' }
  }
  if (status === 'ok') return { tag: 'tag-green', label: '✓ 标准' }
  if (status === 'warn') return { tag: 'tag-orange', label: '⚠ 待修复' }
  return { tag: 'tag-red', label: '✗ 阻断' }
}
