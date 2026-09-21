import{A as e,B as t,C as n,D as r,E as i,I as a,K as o,L as s,P as c,V as l,W as u,Y as d,d as ee,f as te,g as f,i as ne,k as re,n as ie,q as p,w as m,x as h,z as g}from"./index-DvKp-XzU.js";import{n as ae,t as oe}from"./PageHeader-BAXfl576.js";import{t as se}from"./sqlFormat-CMSQ7I32.js";var ce=[{label:`工作空间脚本数`,value:`286`,unit:`个`,delta:`↑ 12 本月新增`,tone:``},{label:`本周提交试跑`,value:`1,482`,unit:`次`,delta:`成功率 94.2%`,tone:`ok`},{label:`通过上版审批`,value:`37`,unit:`单`,delta:`待审 8 单`,tone:``},{label:`自定义 UDF`,value:`42`,unit:`个`,delta:`Python 26 · Java 16`,tone:`ok`}],_=[{value:`spark`,label:`Spark SQL`,role:`main`},{value:`flink`,label:`Flink SQL`,role:`main`},{value:`trino`,label:`Trino（校验）`,role:`check`}],v=[{name:`udf_mask_phone`,desc:`手机号动态脱敏·保留前3后4`,engines:[`trino`,`flink`,`spark`],engine:`Spark+Flink+Trino`,ver:`v3`,uses:`安全模块·dwd_user_info`,snippet:`udf_mask_phone(buyer_mobile)`},{name:`udf_mask_id_card`,desc:`身份证号脱敏·保留前6后4`,engines:[`trino`,`spark`],engine:`Spark+Trino`,ver:`v2`,uses:`dwd_user_info`,snippet:`udf_mask_id_card(id_card)`},{name:`map_status_code`,desc:`交易状态码值标准化映射`,engines:[`spark`,`flink`,`trino`],engine:`Spark+Flink+Trino`,ver:`v5`,uses:`dwd_order_detail`,snippet:`map_status_code(order_status)`},{name:`udf_parse_json`,desc:`JSON 字段解析提取`,engines:[`flink`,`spark`,`trino`],engine:`Spark+Flink+Trino`,ver:`v1`,uses:`埋点 dws_pv`,snippet:`udf_parse_json(payload, '$.event')`},{name:`udf_geo_hash`,desc:`经纬度 Geohash 编码`,engines:[`spark`,`trino`],engine:`Spark+Trino`,ver:`v2`,uses:`用户画像`,snippet:`udf_geo_hash(lat, lng, 6)`},{name:`udf_date_key`,desc:`日期转数字键 yyyyMMdd`,engines:[`spark`,`flink`,`trino`],engine:`Spark+Flink+Trino`,ver:`v1`,uses:`通用`,snippet:`udf_date_key(dt)`}];function le(e){let t=String(e||``).toLowerCase();return v.filter(e=>!e.engines?.length||e.engines.includes(t))}var ue=[{id:`folder_trade`,type:`folder`,name:`交易域 / dwd_trade`,open:!0},{id:`gmv_by_channel_7d`,type:`file`,folder:`folder_trade`,name:`gmv_by_channel_7d.sql`,lang:`SQL`,status:`DRAFT`,badge:``,version:`v23`,author:`张明`,editedAt:`3 分钟前`,links:`dwd_order_detail · 指标 M-0001 · 质量规则 PK_UNIQUE`,env:`TEST`,engine:`spark`,lint:[{label:`分区裁剪 已启用`,tone:`ok`},{label:`SELECT * 未使用`,tone:`ok`},{label:`缺少 LIMIT 提示`,tone:`warn`},{label:`脱敏列 buyer_mobile 已策略绑定`,tone:`ok`},{label:`预计扫描 3.2 GB`,tone:``}],sql:`-- GMV 近 7 天按渠道（脱敏版）
SELECT
  dt,
  order_channel,
  COUNT(DISTINCT order_id) AS order_cnt,
  SUM(pay_amt) AS gmv,
  COUNT(DISTINCT buyer_id) AS buyer_cnt
FROM iceberg.dwd_trade.dwd_order_detail
WHERE dt BETWEEN date '2026-08-27' AND date '2026-09-02'
  AND is_paid = 1
GROUP BY dt, order_channel
ORDER BY dt DESC, gmv DESC;
`},{id:`dwd_order_detail_clean`,type:`file`,folder:`folder_trade`,name:`dwd_order_detail_clean.sql`,lang:`SQL`,status:`DRAFT`,badge:`阻断`,version:`v18`,author:`王芳`,editedAt:`昨天`,links:`ods_trade.s_order · 标准 STD-C0021 · 质量门禁`,env:`TEST`,engine:`flink`,lint:[{label:`码值映射 STD-C0021`,tone:`ok`},{label:`质量门禁：refund_reason 未映射码`,tone:`warn`},{label:`分区字段 dt 已过滤`,tone:`ok`}],sql:`-- DWD 订单明细清洗（含标准码值映射）
INSERT INTO iceberg.dwd_trade.dwd_order_detail
SELECT
  order_id,
  order_no,
  buyer_id,
  udf_mask_phone(buyer_mobile) AS buyer_mobile,
  map_status_code(stat) AS order_status,
  amount / 100.0 AS pay_amt,
  channel AS order_channel,
  dt
FROM iceberg.ods_trade.s_order
WHERE dt = current_date - INTERVAL '1' DAY
  AND is_deleted = 0;
`},{id:`dws_order_1d_build`,type:`file`,folder:`folder_trade`,name:`dws_order_1d_build.sql`,lang:`SQL`,status:`TESTED`,badge:``,version:`v9`,author:`刘强`,editedAt:`2 天前`,links:`dwd_order_detail · dws_order_1d`,env:`PRE`,lint:[{label:`聚合键完整`,tone:`ok`},{label:`预计扫描 1.1 GB`,tone:``}],sql:`-- DWS 订单日汇总
INSERT INTO iceberg.dws_trade.dws_order_1d
SELECT
  dt,
  order_channel,
  COUNT(DISTINCT order_id) AS order_cnt,
  SUM(pay_amt) AS gmv,
  COUNT(DISTINCT buyer_id) AS buyer_cnt
FROM iceberg.dwd_trade.dwd_order_detail
WHERE dt = current_date - INTERVAL '1' DAY
  AND is_paid = 1
GROUP BY dt, order_channel;
`},{id:`ads_gmv_board_dualwrite`,type:`file`,folder:`folder_trade`,name:`ads_gmv_board_dualwrite.sql`,lang:`SQL`,status:`PROD`,badge:``,version:`v12`,author:`张明`,editedAt:`上周`,links:`dws_order_1d · ads_gmv_board · 指标 M-0001`,env:`PROD`,lint:[{label:`双写对账钩子已挂`,tone:`ok`},{label:`口径锁定 M-0001`,tone:`ok`}],sql:`-- ADS GMV 看板双写（Iceberg + ClickHouse via SA）
INSERT INTO iceberg.ads.ads_gmv_board
SELECT
  dt,
  order_channel,
  SUM(gmv) AS gmv,
  SUM(order_cnt) AS order_cnt
FROM iceberg.dws_trade.dws_order_1d
WHERE dt >= current_date - INTERVAL '30' DAY
GROUP BY dt, order_channel;
`},{id:`ads_gmv_board_reconcile`,type:`file`,folder:`folder_trade`,name:`ads_gmv_board_reconcile.sql`,lang:`SQL`,status:`PROD`,badge:``,version:`v4`,author:`陈晓`,editedAt:`上周`,links:`ads_gmv_board · 对账任务`,env:`PROD`,lint:[{label:`对账阈值阈值 < 0.1%`,tone:`ok`}],sql:`-- 湖 / CK 对账抽样
SELECT
  'iceberg' AS side,
  SUM(gmv) AS gmv
FROM iceberg.ads.ads_gmv_board
WHERE dt = current_date - INTERVAL '1' DAY
UNION ALL
SELECT
  'clickhouse' AS side,
  SUM(gmv) AS gmv
FROM clickhouse.ads.ads_gmv_board
WHERE dt = current_date - INTERVAL '1' DAY;
`},{id:`folder_user`,type:`folder`,name:`用户域 / dwd_user`,open:!1},{id:`user_dup_fix`,type:`file`,folder:`folder_user`,name:`user_dup_fix.sql`,lang:`SQL`,status:`DRAFT`,badge:``,version:`v22`,author:`王芳`,editedAt:`今天`,links:`dwd_user_info · 质量规则 USER_UNIQUE`,env:`TEST`,lint:[{label:`唯一性检查草稿`,tone:`warn`},{label:`LIMIT 100 已加`,tone:`ok`}],sql:`-- 用户重复键排查
SELECT
  user_id,
  COUNT(*) AS cnt
FROM iceberg.dwd_user.dwd_user_info
WHERE dt = current_date
GROUP BY user_id
HAVING COUNT(*) > 1
LIMIT 100;
`},{id:`folder_dim`,type:`folder`,name:`商品域 / dim`,open:!1},{id:`dim_item_snapshot`,type:`file`,folder:`folder_dim`,name:`dim_item_snapshot.sql`,lang:`SQL`,status:`PROD`,badge:``,version:`v21`,author:`张涛`,editedAt:`09-01`,links:`dim_sku · 商品主数据`,env:`PROD`,lint:[{label:`快照分区 dt 就绪`,tone:`ok`}],sql:`-- 商品维度日快照
INSERT INTO iceberg.dim.dim_sku
SELECT
  sku_id,
  sku_name,
  category_id,
  status,
  current_date AS dt
FROM iceberg.ods_goods.s_sku
WHERE dt = current_date;
`},{id:`folder_udf`,type:`folder`,name:`UDF / functions`,open:!1}],de=[{value:`TEST`,label:`TEST`},{value:`PRE`,label:`PRE`},{value:`PROD`,label:`PROD (需审批)`,disabled:!0}];function fe(e){return e===`PROD`?`tag-green`:e===`TESTED`?`tag-blue`:e===`DRAFT`?`tag-orange`:`tag-gray`}function pe(e){return e===`ok`?`tag-green`:e===`warn`?`tag-orange`:`tag-gray`}var me={class:`develop-page`},he={class:`kpi-grid dev-kpi`},ge={class:`kpi-label`},_e={class:`kpi-value`},ve={class:`kpi-unit`},ye={class:`dev-layout`},y={class:`card dev-tree-card`},b={class:`dev-tree`},x=[`onClick`],S={class:`dev-indent`},C={key:0,class:`dt-badge`},w={class:`card dev-editor-card`},T={class:`dev-editor-bar`},E={class:`dev-file-meta`},D={class:`dev-file-name`},O={key:0,class:`tag tag-gray`},k={key:2,class:`tag tag-orange`},A={class:`dev-editor-actions`},j={class:`dev-ctl`},M=[`value`],N={class:`dev-ctl`},P=[`value`,`disabled`],be=[`value`],xe={class:`dev-code-head`},Se={class:`dev-lint`},Ce={class:`dev-lint-tags`},we={key:0,class:`muted`},Te={class:`dev-side`},Ee={class:`card`,style:{"margin-bottom":`14px`}},De={class:`card-header`},Oe={class:`tag tag-gray`},ke={class:`udf-grid`},Ae=[`onClick`,`onDblclick`],F={class:`udf-name`},je={class:`udf-desc`},Me={class:`udf-meta`},Ne={class:`tag tag-blue`},Pe={class:`tag tag-gray`},Fe={class:`udf-uses`},Ie={key:0,class:`muted`,style:{padding:`12px`,"font-size":`12px`}},I=ie({__name:`DevelopView`,setup(ie){let v=ee(),I=te(),{showToast:L}=ne(),R=ae(`develop`),z=u(ue.map(e=>({...e,open:e.type===`folder`?!!e.open:void 0,engine:e.type===`file`?e.engine||`spark`:void 0}))),B=n(()=>z.value.filter(e=>e.type===`file`)),V=u(B.value.find(e=>e.name===`gmv_by_channel_7d.sql`)?.id||B.value[0]?.id||``),H=u(``),U=u(`TEST`),W=u(`spark`),G=u(!1),K=n(()=>B.value.find(e=>e.id===V.value)||null),q=n(()=>_.find(e=>e.value===W.value)?.label||W.value),J=n(()=>le(W.value));g(K,e=>{e&&(H.value=e.sql||``,U.value=e.env||`TEST`,W.value=e.engine||`spark`,G.value=!1)},{immediate:!0});let Le=n(()=>{let e=z.value,t=new Set(e.filter(e=>e.type===`folder`&&!e.open).map(e=>e.id));return e.filter(e=>e.type===`folder`||!t.has(e.folder))});function Re(e){e.type===`folder`&&(e.open=!e.open)}function ze(e){e.type===`file`&&(!G.value||window.confirm(`当前脚本有未保存修改，切换将丢弃，继续？`))&&(V.value=e.id)}function Be(e){H.value=e.target.value,G.value=!0}function Ve(){H.value=se(H.value),G.value=!0,L(`✅ 已格式化 SQL`,`success`)}function Y(){let e=K.value;e&&(e.sql=H.value,e.env=U.value,e.engine=W.value,e.editedAt=`刚刚`,G.value=!1,L(`💾 已自动保存 ${e.name}`,`success`))}function X(){let e=K.value;e&&(e.env=U.value,e.engine=W.value);let t=`run-${new Date().toISOString().slice(0,10).replace(/-/g,``)}-${String(Date.now()).slice(-4)}`;L(`▶ 已在 ${U.value} · ${q.value} 提交试跑 ${e?.name||``} · ${t}`,`info`)}function Z(){let e=K.value;e&&(e.env=U.value,e.engine=W.value),L(`🚀 已推到发布单：上版-${U.value}-${W.value}-${e?.name||`script`} ${e?.version||``}`,`success`),I.push({path:`/publish`,query:{script:e?.name||``,engine:W.value,env:U.value}})}function Q(){let e=`script_${Date.now()}`,t=`untitled_${new Date().toISOString().slice(11,19).replace(/:/g,``)}.sql`,n=z.value.find(e=>e.type===`folder`&&e.open)||z.value.find(e=>e.type===`folder`);n&&(n.open=!0);let r={id:e,type:`file`,folder:n?.id||`folder_trade`,name:t,lang:`SQL`,status:`DRAFT`,badge:``,version:`v1`,author:`张明`,editedAt:`刚刚`,links:`—`,env:`TEST`,engine:W.value||`spark`,lint:[{label:`新建脚本 · 待检查`,tone:`warn`}],sql:`-- ${t}\nSELECT 1;\n`},i=z.value.findIndex(e=>e.id===n?.id);return z.value.splice(i>=0?i+1:z.value.length,0,r),V.value=e,L(`已新建脚本 ${t}`,`success`),r}function He(e,t){let n=String(e||``).trim();if(!n)return;let r=Q();r.name=t?String(t).endsWith(`.sql`)?String(t):`${t}.sql`:`from_query_${new Date().toISOString().slice(0,10).replace(/-/g,``)}.sql`,r.sql=n,r.lint=[{label:`从即席导入 · 待检查`,tone:`warn`}],H.value=n,G.value=!0,L(`已从即席导入草稿 ${r.name}`,`success`)}function $(){let e=v.query||{},t=typeof e.importSql==`string`?e.importSql:typeof e.sql==`string`?e.sql:``;t&&He(t,typeof e.name==`string`?e.name:``)}g(()=>`${v.query.importSql||``}|${v.query.sql||``}`,()=>$()),c(()=>$());function Ue(e){let t=e.snippet||e.name,n=document.getElementById(`devSqlArea`);if(n&&typeof n.selectionStart==`number`){let e=n.selectionStart,r=n.selectionEnd,i=H.value||``;H.value=`${i.slice(0,e)}${t}${i.slice(r)}`,G.value=!0,requestAnimationFrame(()=>{n.focus();let r=e+t.length;n.selectionStart=n.selectionEnd=r})}else H.value=`${H.value||``}${t}`,G.value=!0;L(`已插入 UDF：${e.name}`,`success`)}function We(e){L(`🔧 ${e.name} · ${e.engine} · ${e.ver} · ${e.uses}`,`info`)}function Ge(e){if(e.key===`Tab`){e.preventDefault();let t=e.target,n=t.selectionStart,r=t.selectionEnd,i=H.value||``;H.value=`${i.slice(0,n)}  ${i.slice(r)}`,G.value=!0,requestAnimationFrame(()=>{t.selectionStart=t.selectionEnd=n+2})}(e.ctrlKey||e.metaKey)&&e.key===`s`&&(e.preventDefault(),Y()),(e.ctrlKey||e.metaKey)&&e.key===`Enter`&&(e.preventDefault(),X())}return(n,c)=>(a(),r(`div`,me,[e(oe,{title:`数据开发 / SQL 工作台`,subtitle:`Spark / Flink 为主 · Trino 校验 · 任务打包 · 版本对比 · 审批上版`,"guide-title":o(R).title,guide:o(R)},{default:t(()=>[m(`button`,{class:`btn btn-sm`,onClick:Y},`💾 自动保存`),m(`button`,{class:`btn btn-sm`,onClick:X},`▶ 试跑(`+d(q.value)+` · `+d(U.value)+`)`,1),m(`button`,{class:`btn btn-sm btn-primary`,onClick:Z},`🚀 提交上版 →`)]),_:1},8,[`guide-title`,`guide`]),m(`div`,he,[(a(!0),r(h,null,s(o(ce),(e,t)=>(a(),r(`div`,{key:t,class:`kpi-card`},[m(`div`,ge,d(e.label),1),m(`div`,_e,[re(d(e.value),1),m(`span`,ve,d(e.unit),1)]),m(`div`,{class:p([`kpi-delta`,{success:e.tone===`ok`}])},d(e.delta),3)]))),128))]),m(`div`,ye,[m(`aside`,y,[c[4]||=m(`div`,{class:`card-header`},[m(`div`,{class:`card-title`},`🗂️ 开发资源树`),m(`span`,{class:`dev-ws`},`ws_trade`)],-1),m(`div`,b,[(a(!0),r(h,null,s(Le.value,e=>(a(),r(`button`,{key:e.id,type:`button`,class:p([`dev-tree-node`,{folder:e.type===`folder`,active:e.type===`file`&&e.id===V.value,file:e.type===`file`}]),onClick:t=>e.type===`folder`?Re(e):ze(e)},[e.type===`folder`?(a(),r(h,{key:0},[m(`span`,null,d(e.open?`▼`:`▶`),1),m(`span`,null,`📁 `+d(e.name),1)],64)):(a(),r(h,{key:1},[m(`span`,S,`📄 `+d(e.name),1),e.badge?(a(),r(`span`,C,d(e.badge),1)):i(``,!0)],64))],10,x))),128))]),m(`div`,{class:`dev-tree-foot`},[m(`button`,{class:`btn btn-sm`,style:{width:`100%`},onClick:Q},`＋ 新建 SQL 脚本`)])]),m(`section`,w,[m(`div`,T,[m(`div`,E,[m(`div`,D,`📄 `+d(K.value?.name||`未选择脚本`),1),K.value?(a(),r(`span`,O,d(K.value.lang),1)):i(``,!0),K.value?(a(),r(`span`,{key:1,class:p([`tag`,o(fe)(K.value.status)])},d(K.value.status),3)):i(``,!0),G.value?(a(),r(`span`,k,`未保存`)):i(``,!0)]),m(`div`,A,[m(`label`,j,[c[5]||=m(`span`,null,`引擎`,-1),l(m(`select`,{"onUpdate:modelValue":c[0]||=e=>W.value=e,class:`select input-sm`,style:{width:`148px`},onChange:c[1]||=e=>G.value=!0},[(a(!0),r(h,null,s(o(_),e=>(a(),r(`option`,{key:e.value,value:e.value},d(e.label),9,M))),128))],544),[[f,W.value]])]),m(`label`,N,[c[6]||=m(`span`,null,`环境`,-1),l(m(`select`,{"onUpdate:modelValue":c[2]||=e=>U.value=e,class:`select input-sm`,style:{width:`120px`},onChange:c[3]||=e=>G.value=!0},[(a(!0),r(h,null,s(o(de),e=>(a(),r(`option`,{key:e.value,value:e.value,disabled:e.disabled},d(e.label),9,P))),128))],544),[[f,U.value]])]),m(`button`,{class:`btn btn-sm`,onClick:Ve},`⚙️ 格式化`),m(`button`,{class:`btn btn-sm`,onClick:Z},`🚀 提交上版`)])]),m(`textarea`,{id:`devSqlArea`,class:`dev-sql`,spellcheck:`false`,value:H.value,onInput:Be,onKeydown:Ge},null,40,be),m(`div`,xe,[m(`span`,null,`🔗 关联资产：`+d(K.value?.links||`—`)+` · 引擎 `+d(q.value),1),m(`span`,null,d(K.value?.version||``)+` · `+d(K.value?.author||``)+` · `+d(K.value?.editedAt||``),1)]),m(`div`,Se,[c[7]||=m(`div`,{class:`dev-lint-title`},`✅ 代码检查结果（DolphinScheduler Linter）`,-1),m(`div`,Ce,[(a(!0),r(h,null,s(K.value?.lint||[],(e,t)=>(a(),r(`span`,{key:t,class:p([`tag`,o(pe)(e.tone)])},d(e.label),3))),128)),K.value?.lint?.length?i(``,!0):(a(),r(`span`,we,`暂无检查项`))])])]),m(`aside`,Te,[m(`div`,Ee,[m(`div`,De,[c[8]||=m(`div`,{class:`card-title`},`🧩 可用 UDF 一览`,-1),m(`span`,Oe,d(q.value),1)]),m(`div`,ke,[(a(!0),r(h,null,s(J.value,e=>(a(),r(`button`,{key:e.name,type:`button`,class:`udf-card`,onClick:t=>Ue(e),onDblclick:t=>We(e)},[m(`div`,F,d(e.name),1),m(`div`,je,d(e.desc),1),m(`div`,Me,[m(`span`,Ne,d(e.engine),1),m(`span`,Pe,d(e.ver),1)]),m(`div`,Fe,`↗ `+d(e.uses),1)],40,Ae))),128)),J.value.length?i(``,!0):(a(),r(`div`,Ie,` 当前引擎暂无登记 UDF `))])])])])]))}},[[`__scopeId`,`data-v-1387d6ac`]]);export{I as default};