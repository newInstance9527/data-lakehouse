var e=`SELECT.FROM.WHERE.JOIN.LEFT JOIN.RIGHT JOIN.INNER JOIN.FULL JOIN.OUTER JOIN.ON.GROUP BY.ORDER BY.HAVING.LIMIT.UNION ALL.UNION.INSERT.INTO.VALUES.UPDATE.SET.DELETE.WITH.AS.AND.OR.CASE.WHEN.THEN.ELSE.END`.split(`.`);function t(t){if(!t||!String(t).trim())return``;let n=String(t).replace(/\r\n/g,`
`).replace(/[ \t]+/g,` `).replace(/\n+/g,`
`).trim(),r=[];n=n.replace(/('([^']|'')*'|"([^"]|"")*")/g,e=>(r.push(e),`__STR${r.length-1}__`)),e.sort((e,t)=>t.length-e.length).forEach(e=>{let t=RegExp(`\\b${e.replace(/ /g,`\\s+`)}\\b`,`gi`);n=n.replace(t,`\n${e.toUpperCase()}`)}),n=n.replace(/,/g,`,
  `).replace(/\n+/g,`
`).split(`
`).map(e=>e.trim()).filter(Boolean).join(`
`);let i=n.split(`
`),a=[],o=0;for(let e of i){let t=e.toUpperCase();/^(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|FULL JOIN|OUTER JOIN|GROUP BY|ORDER BY|HAVING|LIMIT|UNION|UNION ALL|INSERT|UPDATE|DELETE|WITH|SET|VALUES)\b/.test(t)&&(o=0),/^(AND|OR|ON|WHEN|THEN|ELSE)\b/.test(t)&&(o=1),a.push(`${`  `.repeat(o)}${e}`),(t.startsWith(`SELECT`)||t.startsWith(`SET`)||t.startsWith(`VALUES`))&&(o=1)}return n=a.join(`
`),n=n.replace(/__STR(\d+)__/g,(e,t)=>r[Number(t)]),n.trim()+`
`}export{t};