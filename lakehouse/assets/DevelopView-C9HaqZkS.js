import{B as e,F as t,I as n,M as r,P as i,S as a,T as ee,U as o,V as s,d as c,g as l,j as u,s as d,t as te,v as f,w as ne,x as p,y as m,z as h}from"./index-D4oAZTAD.js";import{n as re,r as ie,t as ae}from"./PageHeader-BPk_tpTy.js";import{t as oe}from"./sqlFormat-CMSQ7I32.js";var se=[{label:`工作空间脚本数`,value:`286`,unit:`个`,delta:`↑ 12 本月新增`,tone:``},{label:`本周提交试跑`,value:`1,482`,unit:`次`,delta:`成功率 94.2%`,tone:`ok`},{label:`通过上版审批`,value:`37`,unit:`单`,delta:`待审 8 单`,tone:``},{label:`自定义 UDF`,value:`42`,unit:`个`,delta:`Python 26 · Java 16`,tone:`ok`}],g=[{value:`spark`,label:`Spark SQL`,role:`main`},{value:`flink`,label:`Flink SQL`,role:`main`},{value:`trino`,label:`Trino（校验）`,role:`check`}],_=[{name:`udf_mask_phone`,desc:`手机号动态脱敏·保留前3后4`,engines:[`trino`,`flink`,`spark`],engine:`Spark+Flink+Trino`,ver:`v3`,uses:`安全模块·dwd_user_info`,snippet:`udf_mask_phone(buyer_mobile)`},{name:`udf_mask_id_card`,desc:`身份证号脱敏·保留前6后4`,engines:[`trino`,`spark`],engine:`Spark+Trino`,ver:`v2`,uses:`dwd_user_info`,snippet:`udf_mask_id_card(id_card)`},{name:`map_status_code`,desc:`交易状态码值标准化映射`,engines:[`spark`,`flink`,`trino`],engine:`Spark+Flink+Trino`,ver:`v5`,uses:`dwd_order_detail`,snippet:`map_status_code(order_status)`},{name:`udf_parse_json`,desc:`JSON 字段解析提取`,engines:[`flink`,`spark`,`trino`],engine:`Spark+Flink+Trino`,ver:`v1`,uses:`埋点 dws_pv`,snippet:`udf_parse_json(payload, '$.event')`},{name:`udf_geo_hash`,desc:`经纬度 Geohash 编码`,engines:[`spark`,`trino`],engine:`Spark+Trino`,ver:`v2`,uses:`用户画像`,snippet:`udf_geo_hash(lat, lng, 6)`},{name:`udf_date_key`,desc:`日期转数字键 yyyyMMdd`,engines:[`spark`,`flink`,`trino`],engine:`Spark+Flink+Trino`,ver:`v1`,uses:`通用`,snippet:`udf_date_key(dt)`}];function ce(e){let t=String(e||``).toLowerCase();return _.filter(e=>!e.engines?.length||e.engines.includes(t))}var le=[{id:`folder_trade`,type:`folder`,name:`交易域 / dwd_trade`,open:!0},{id:`gmv_by_channel_7d`,type:`file`,folder:`folder_trade`,name:`gmv_by_channel_7d.sql`,lang:`SQL`,status:`DRAFT`,badge:``,version:`v23`,author:`张明`,editedAt:`3 分钟前`,links:`dwd_order_detail · 指标 M-0001 · 质量规则 PK_UNIQUE`,env:`TEST`,engine:`spark`,lint:[{label:`分区裁剪 已启用`,tone:`ok`},{label:`SELECT * 未使用`,tone:`ok`},{label:`缺少 LIMIT 提示`,tone:`warn`},{label:`脱敏列 buyer_mobile 已策略绑定`,tone:`ok`},{label:`预计扫描 3.2 GB`,tone:``}],sql:`-- GMV 近 7 天按渠道（脱敏版）
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
`},{id:`folder_udf`,type:`folder`,name:`UDF / functions`,open:!1}],ue=[{value:`TEST`,label:`TEST`},{value:`PRE`,label:`PRE`},{value:`PROD`,label:`PROD (需审批)`,disabled:!0}];function de(e){return e===`PROD`?`tag-green`:e===`TESTED`?`tag-blue`:e===`DRAFT`?`tag-orange`:`tag-gray`}function fe(e){return e===`ok`?`tag-green`:e===`warn`?`tag-orange`:`tag-gray`}var pe={class:`develop-page`},me={class:`kpi-grid dev-kpi`},he={class:`kpi-label`},ge={class:`kpi-value`},v={class:`kpi-unit`},y={class:`dev-layout`},b={class:`card dev-tree-card`},x={class:`dev-tree`},S=[`onClick`],C={class:`dev-indent`},w={key:0,class:`dt-badge`},T={class:`card dev-editor-card`},E={class:`dev-editor-bar`},D={class:`dev-file-meta`},O={class:`dev-file-name`},k={key:0,class:`tag tag-gray`},A={key:2,class:`tag tag-orange`},j={class:`dev-editor-actions`},M={class:`dev-ctl`},N=[`value`],P={class:`dev-ctl`},F=[`value`,`disabled`],I=[`value`],L={class:`dev-code-head`},_e={class:`dev-lint`},ve={class:`dev-lint-tags`},ye={key:0,class:`muted`},be={class:`dev-side`},xe={class:`card`,style:{"margin-bottom":`14px`}},Se={class:`card-header`},Ce={class:`tag tag-gray`},R={class:`udf-grid`},we=[`onClick`,`onDblclick`],Te={class:`udf-name`},Ee={class:`udf-desc`},De={class:`udf-meta`},Oe={class:`tag tag-blue`},ke={class:`tag tag-gray`},Ae={class:`udf-uses`},je={key:0,class:`muted`,style:{padding:`12px`,"font-size":`12px`}},z=re({__name:`DevelopView`,setup(re){let _=d(),{showToast:z}=te(),B=ie(`develop`),V=h(le.map(e=>({...e,open:e.type===`folder`?!!e.open:void 0,engine:e.type===`file`?e.engine||`spark`:void 0}))),H=f(()=>V.value.filter(e=>e.type===`file`)),U=h(H.value.find(e=>e.name===`gmv_by_channel_7d.sql`)?.id||H.value[0]?.id||``),W=h(``),G=h(`TEST`),K=h(`spark`),q=h(!1),J=f(()=>H.value.find(e=>e.id===U.value)||null),Y=f(()=>g.find(e=>e.value===K.value)?.label||K.value),X=f(()=>ce(K.value));i(J,e=>{e&&(W.value=e.sql||``,G.value=e.env||`TEST`,K.value=e.engine||`spark`,q.value=!1)},{immediate:!0});let Me=f(()=>{let e=V.value,t=new Set(e.filter(e=>e.type===`folder`&&!e.open).map(e=>e.id));return e.filter(e=>e.type===`folder`||!t.has(e.folder))});function Ne(e){e.type===`folder`&&(e.open=!e.open)}function Pe(e){e.type===`file`&&(!q.value||window.confirm(`当前脚本有未保存修改，切换将丢弃，继续？`))&&(U.value=e.id)}function Fe(e){W.value=e.target.value,q.value=!0}function Ie(){W.value=oe(W.value),q.value=!0,z(`✅ 已格式化 SQL`,`success`)}function Z(){let e=J.value;e&&(e.sql=W.value,e.env=G.value,e.engine=K.value,e.editedAt=`刚刚`,q.value=!1,z(`💾 已自动保存 ${e.name}`,`success`))}function Q(){let e=J.value;e&&(e.env=G.value,e.engine=K.value);let t=`run-${new Date().toISOString().slice(0,10).replace(/-/g,``)}-${String(Date.now()).slice(-4)}`;z(`▶ 已在 ${G.value} · ${Y.value} 提交试跑 ${e?.name||``} · ${t}`,`info`)}function $(){let e=J.value;e&&(e.env=G.value,e.engine=K.value),z(`🚀 已推到发布单：上版-${G.value}-${K.value}-${e?.name||`script`} ${e?.version||``}`,`success`),_.push({path:`/publish`,query:{script:e?.name||``,engine:K.value,env:G.value}})}function Le(){let e=`script_${Date.now()}`,t=`untitled_${new Date().toISOString().slice(11,19).replace(/:/g,``)}.sql`,n=V.value.find(e=>e.type===`folder`&&e.open)||V.value.find(e=>e.type===`folder`);n&&(n.open=!0);let r={id:e,type:`file`,folder:n?.id||`folder_trade`,name:t,lang:`SQL`,status:`DRAFT`,badge:``,version:`v1`,author:`张明`,editedAt:`刚刚`,links:`—`,env:`TEST`,engine:K.value||`spark`,lint:[{label:`新建脚本 · 待检查`,tone:`warn`}],sql:`-- ${t}\nSELECT 1;\n`},i=V.value.findIndex(e=>e.id===n?.id);V.value.splice(i>=0?i+1:V.value.length,0,r),U.value=e,z(`已新建脚本 ${t}`,`success`)}function Re(e){let t=e.snippet||e.name,n=document.getElementById(`devSqlArea`);if(n&&typeof n.selectionStart==`number`){let e=n.selectionStart,r=n.selectionEnd,i=W.value||``;W.value=`${i.slice(0,e)}${t}${i.slice(r)}`,q.value=!0,requestAnimationFrame(()=>{n.focus();let r=e+t.length;n.selectionStart=n.selectionEnd=r})}else W.value=`${W.value||``}${t}`,q.value=!0;z(`已插入 UDF：${e.name}`,`success`)}function ze(e){z(`🔧 ${e.name} · ${e.engine} · ${e.ver} · ${e.uses}`,`info`)}function Be(e){if(e.key===`Tab`){e.preventDefault();let t=e.target,n=t.selectionStart,r=t.selectionEnd,i=W.value||``;W.value=`${i.slice(0,n)}  ${i.slice(r)}`,q.value=!0,requestAnimationFrame(()=>{t.selectionStart=t.selectionEnd=n+2})}(e.ctrlKey||e.metaKey)&&e.key===`s`&&(e.preventDefault(),Z()),(e.ctrlKey||e.metaKey)&&e.key===`Enter`&&(e.preventDefault(),Q())}return(i,d)=>(u(),a(`div`,pe,[ee(ae,{title:`数据开发 / SQL 工作台`,subtitle:`Spark / Flink 为主 · Trino 校验 · 任务打包 · 版本对比 · 审批上版`,"guide-title":e(B).title,guide:e(B)},{default:t(()=>[m(`button`,{class:`btn btn-sm`,onClick:Z},`💾 自动保存`),m(`button`,{class:`btn btn-sm`,onClick:Q},`▶ 试跑(`+o(Y.value)+` · `+o(G.value)+`)`,1),m(`button`,{class:`btn btn-sm btn-primary`,onClick:$},`🚀 提交上版 →`)]),_:1},8,[`guide-title`,`guide`]),m(`div`,me,[(u(!0),a(l,null,r(e(se),(e,t)=>(u(),a(`div`,{key:t,class:`kpi-card`},[m(`div`,he,o(e.label),1),m(`div`,ge,[ne(o(e.value),1),m(`span`,v,o(e.unit),1)]),m(`div`,{class:s([`kpi-delta`,{success:e.tone===`ok`}])},o(e.delta),3)]))),128))]),m(`div`,y,[m(`aside`,b,[d[4]||=m(`div`,{class:`card-header`},[m(`div`,{class:`card-title`},`🗂️ 开发资源树`),m(`span`,{class:`dev-ws`},`ws_trade`)],-1),m(`div`,x,[(u(!0),a(l,null,r(Me.value,e=>(u(),a(`button`,{key:e.id,type:`button`,class:s([`dev-tree-node`,{folder:e.type===`folder`,active:e.type===`file`&&e.id===U.value,file:e.type===`file`}]),onClick:t=>e.type===`folder`?Ne(e):Pe(e)},[e.type===`folder`?(u(),a(l,{key:0},[m(`span`,null,o(e.open?`▼`:`▶`),1),m(`span`,null,`📁 `+o(e.name),1)],64)):(u(),a(l,{key:1},[m(`span`,C,`📄 `+o(e.name),1),e.badge?(u(),a(`span`,w,o(e.badge),1)):p(``,!0)],64))],10,S))),128))]),m(`div`,{class:`dev-tree-foot`},[m(`button`,{class:`btn btn-sm`,style:{width:`100%`},onClick:Le},`＋ 新建 SQL 脚本`)])]),m(`section`,T,[m(`div`,E,[m(`div`,D,[m(`div`,O,`📄 `+o(J.value?.name||`未选择脚本`),1),J.value?(u(),a(`span`,k,o(J.value.lang),1)):p(``,!0),J.value?(u(),a(`span`,{key:1,class:s([`tag`,e(de)(J.value.status)])},o(J.value.status),3)):p(``,!0),q.value?(u(),a(`span`,A,`未保存`)):p(``,!0)]),m(`div`,j,[m(`label`,M,[d[5]||=m(`span`,null,`引擎`,-1),n(m(`select`,{"onUpdate:modelValue":d[0]||=e=>K.value=e,class:`select input-sm`,style:{width:`148px`},onChange:d[1]||=e=>q.value=!0},[(u(!0),a(l,null,r(e(g),e=>(u(),a(`option`,{key:e.value,value:e.value},o(e.label),9,N))),128))],544),[[c,K.value]])]),m(`label`,P,[d[6]||=m(`span`,null,`环境`,-1),n(m(`select`,{"onUpdate:modelValue":d[2]||=e=>G.value=e,class:`select input-sm`,style:{width:`120px`},onChange:d[3]||=e=>q.value=!0},[(u(!0),a(l,null,r(e(ue),e=>(u(),a(`option`,{key:e.value,value:e.value,disabled:e.disabled},o(e.label),9,F))),128))],544),[[c,G.value]])]),m(`button`,{class:`btn btn-sm`,onClick:Ie},`⚙️ 格式化`),m(`button`,{class:`btn btn-sm`,onClick:$},`🚀 提交上版`)])]),m(`textarea`,{id:`devSqlArea`,class:`dev-sql`,spellcheck:`false`,value:W.value,onInput:Fe,onKeydown:Be},null,40,I),m(`div`,L,[m(`span`,null,`🔗 关联资产：`+o(J.value?.links||`—`)+` · 引擎 `+o(Y.value),1),m(`span`,null,o(J.value?.version||``)+` · `+o(J.value?.author||``)+` · `+o(J.value?.editedAt||``),1)]),m(`div`,_e,[d[7]||=m(`div`,{class:`dev-lint-title`},`✅ 代码检查结果（DolphinScheduler Linter）`,-1),m(`div`,ve,[(u(!0),a(l,null,r(J.value?.lint||[],(t,n)=>(u(),a(`span`,{key:n,class:s([`tag`,e(fe)(t.tone)])},o(t.label),3))),128)),J.value?.lint?.length?p(``,!0):(u(),a(`span`,ye,`暂无检查项`))])])]),m(`aside`,be,[m(`div`,xe,[m(`div`,Se,[d[8]||=m(`div`,{class:`card-title`},`🧩 可用 UDF 一览`,-1),m(`span`,Ce,o(Y.value),1)]),m(`div`,R,[(u(!0),a(l,null,r(X.value,e=>(u(),a(`button`,{key:e.name,type:`button`,class:`udf-card`,onClick:t=>Re(e),onDblclick:t=>ze(e)},[m(`div`,Te,o(e.name),1),m(`div`,Ee,o(e.desc),1),m(`div`,De,[m(`span`,Oe,o(e.engine),1),m(`span`,ke,o(e.ver),1)]),m(`div`,Ae,`↗ `+o(e.uses),1)],40,we))),128)),X.value.length?p(``,!0):(u(),a(`div`,je,` 当前引擎暂无登记 UDF `))])])])])]))}},[[`__scopeId`,`data-v-35fc1b68`]]);export{z as default};