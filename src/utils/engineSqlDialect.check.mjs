import { engineCompletions, resolveEngineDialect } from './engineSqlDialect.js'
import { highlightEngineSql } from './sqlHighlight.js'
import { formatEngineSql, formatSql } from './sqlFormat.js'

function plain(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function assert(cond, msg) {
  if (!cond) {
    console.error(msg)
    process.exit(1)
  }
}

const spark = resolveEngineDialect('spark')
const flink = resolveEngineDialect('flink')
const trino = resolveEngineDialect('trino')
assert(spark.id === 'spark' && spark.quote === 'backtick', 'spark profile')
assert(flink.id === 'flink' && flink.quote === 'backtick', 'flink profile')
assert(trino.id === 'trino' && trino.quote === 'double', 'trino profile')
assert(resolveEngineDialect('nope').id === 'spark', 'fallback spark')

const sparkHtml = highlightEngineSql('SELECT explode(`arr`) -- c', spark)
assert(plain(sparkHtml) === 'SELECT explode(`arr`) -- c', 'spark text ' + plain(sparkHtml))
assert(sparkHtml.includes('tok-kw') && sparkHtml.includes('tok-fn') && sparkHtml.includes('tok-ident'), 'spark tokens')
assert(sparkHtml.includes('LATERAL VIEW') === false, 'spark sample has no lateral')

const lateral = highlightEngineSql('SELECT LATERAL VIEW explode(arr)', spark)
assert(lateral.includes('tok-kw">LATERAL VIEW'), 'lateral one token ' + lateral)
assert(!lateral.includes('tok-kw">VIEW'), 'view not split ' + lateral)

const flinkHtml = highlightEngineSql('WATERMARK FOR `ts` AS `ts` - INTERVAL \'5\' SECOND, TUMBLE(', flink)
assert(flinkHtml.includes('tok-kw">WATERMARK FOR'), 'flink phrase ' + flinkHtml)
assert(flinkHtml.includes('tok-ident') && flinkHtml.includes('tok-fn'), 'flink tokens ' + flinkHtml)
assert(plain(flinkHtml).includes('WATERMARK FOR'), 'flink text')

const trinoHtml = highlightEngineSql('SELECT JSON_EXTRACT("payload", \'$.a\') FROM UNNEST(', trino)
assert(trinoHtml.includes('tok-ident') && trinoHtml.includes('tok-fn') && trinoHtml.includes('tok-kw'), 'trino tokens ' + trinoHtml)
assert(highlightEngineSql('FETCH FIRST 10', trino).includes('tok-kw">FETCH FIRST'), 'trino fetch phrase')
assert(plain(trinoHtml).includes('"payload"'), 'trino quotes kept')
assert(!trinoHtml.includes('tok-str">"payload"'), 'trino double quote is ident not string')

const sparkFmt = formatEngineSql('select a from t lateral view explode(arr) x as c', spark)
assert(/\nLATERAL VIEW\b/.test(sparkFmt), 'spark format ' + sparkFmt)
assert(!/\nLATERAL\n/.test(sparkFmt), 'spark does not split LATERAL VIEW')

const flinkFmt = formatEngineSql('create table t (ts timestamp, watermark for ts as ts)', flink)
assert(/\nWATERMARK FOR\b/.test(flinkFmt), 'flink format ' + flinkFmt)

const trinoFmt = formatEngineSql('select * from "orders" fetch first 10 rows only', trino)
assert(/\nFETCH FIRST\b/.test(trinoFmt), 'trino format ' + trinoFmt)
assert(trinoFmt.includes('"orders"'), 'trino format keeps quotes')

const base = formatSql('select a from t')
assert(base.includes('SELECT') && base.includes('FROM') && !base.includes('WATERMARK'), 'base format unchanged')

const sparkHits = engineCompletions(spark, [{ name: 'udf_mask_phone', snippet: 'udf_mask_phone(buyer_mobile)' }])
assert(sparkHits.some((h) => h.caption === 'EXPLODE' && h.insert === 'EXPLODE('), 'spark fn complete')
assert(sparkHits.some((h) => h.kind === 'udf' && h.insert.includes('udf_mask_phone')), 'udf complete')
assert(!engineCompletions(flink, []).some((h) => h.caption === 'EXPLODE'), 'flink has no explode')
assert(engineCompletions(flink, []).some((h) => h.caption === 'TUMBLE'), 'flink tumble')
assert(engineCompletions(trino, []).some((h) => h.caption === 'JSON_EXTRACT' && h.insert === 'JSON_EXTRACT('), 'trino fn')
assert(!engineCompletions(trino, []).some((h) => h.caption === 'WATERMARK'), 'trino has no watermark')

console.log('ok')
