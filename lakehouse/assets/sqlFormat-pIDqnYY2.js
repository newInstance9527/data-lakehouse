var e=`SELECT.FROM.WHERE.JOIN.LEFT JOIN.RIGHT JOIN.INNER JOIN.FULL JOIN.OUTER JOIN.ON.GROUP BY.ORDER BY.HAVING.LIMIT.UNION ALL.UNION.INSERT.INTO.VALUES.UPDATE.SET.DELETE.WITH.AS.AND.OR.CASE.WHEN.THEN.ELSE.END`.split(`.`),t=/<(foreach|if|where|trim|set|choose|when|otherwise|bind)\b[^>]*>[\s\S]*?<\/\1>/gi;function n(e){let n=[],r=e=>(n.push(e),`__HOLD${n.length-1}__`),i=e,a=0,o;do o=i,t.lastIndex=0,i=i.replace(t,r);while(i!==o&&++a<20);return i=i.replace(/#\{[^}\n]+\}|\{\{[^}\n]+\}\}/g,r),i=i.replace(/('([^']|'')*'|"([^"]|"")*")/g,r),{s:i,bags:n}}function r(t,r){if(!t||!String(t).trim())return``;let i=(Array.isArray(r)?r:[]).map(e=>String(e||``).trim().toUpperCase()).filter(Boolean),a=n(String(t).replace(/\r\n/g,`
`)),o=a.s.replace(/[ \t]+/g,` `).replace(/[ \t]*\n[ \t]*/g,`
`).replace(/\n+/g,`
`).trim();[...i,...e].sort((e,t)=>t.length-e.length).forEach(e=>{let t=RegExp(`\\b${e.replace(/ /g,`\\s+`)}\\b`,`gi`);o=o.replace(t,`\n${e.toUpperCase()}`)}),o=o.replace(/,/g,`,
  `).replace(/\n+/g,`
`).split(`
`).map(e=>e.trim()).filter(Boolean).join(`
`);let s=i.map(e=>e.replace(/ /g,`\\s+`)).join(`|`),c=RegExp(`^(?:SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|FULL JOIN|OUTER JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|UNION|UNION ALL|INSERT|UPDATE|DELETE|WITH|SET|VALUES${s?`|${s}`:``})\\b`),l=o.split(`
`),u=[],d=0;for(let e of l){let t=e.toUpperCase();c.test(t)&&(d=0),/^(AND|OR|ON|WHEN|THEN|ELSE)\b/.test(t)&&(d=1),u.push(`${`  `.repeat(d)}${e}`),(t.startsWith(`SELECT`)||t.startsWith(`SET`)||t.startsWith(`VALUES`))&&(d=1)}return o=u.join(`
`),o=o.replace(/__HOLD(\d+)__/g,(e,t)=>a.bags[Number(t)]),o.trim()+`
`}function i(e,t){return r(e,t?.formatClauses||[])}function a(e){if(!e||!String(e).trim())return``;let t=[],n=e=>(t.push(e),`\uE000HLD${t.length-1}Z\uE001`),r=String(e).replace(/\r\n/g,`
`);r=r.replace(/\/\*[\s\S]*?\*\//g,n),r=r.replace(/('''[\s\S]*?'''|"""[\s\S]*?""")/g,n),r=r.replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g,n),r=r.replace(/\/\/[^\n]*/g,n);let i=0,a=[];for(let e of r.split(`
`)){let t=e.trim();if(!t){a.push(``);continue}let n=/^[}\])]/.test(t);n&&(i=Math.max(0,i-1)),a.push(`${`    `.repeat(i)}${t}`);let r=(t.match(/[{([]/g)||[]).length-(t.match(/[})\]]/g)||[]).length;n&&(r+=1),i=Math.max(0,i+r)}return r=a.join(`
`).replace(/\uE000HLD(\d+)Z\uE001/g,(e,n)=>t[Number(n)]),r.trimEnd()+`
`}export{a as n,r,i as t};