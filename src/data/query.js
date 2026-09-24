/** 即席查询 · 结果列元数据（目录/历史走真实 API） */

export const RESULT_COLUMNS = [
  { key: 'dt', label: 'dt' },
  { key: 'order_channel', label: 'order_channel' },
  { key: 'order_cnt', label: 'order_cnt', align: 'right' },
  { key: 'gmv', label: 'gmv', align: 'right', success: true },
  { key: 'buyer_mobile', label: 'buyer_mobile', masked: true },
]
