# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path

transcript = Path(
    r"C:/Users/EDY/.cursor/projects/e-lakehouse-design/agent-transcripts/"
    r"e92565c7-3dc5-457e-b01c-f90b55431f17/subagents/3673c827-f99c-4860-8d60-48bdec4d5abd.jsonl"
)
out = Path(r"E:/lakehouse-design/lakehouse/src/i18n/_forms_frag.js")
frag = None
for line in transcript.read_text(encoding="utf-8").splitlines():
    if "0 = unlimited" not in line:
        continue
    obj = json.loads(line)
    content = obj.get("message", {}).get("content", [])
    texts = []
    if isinstance(content, list):
        for c in content:
            if isinstance(c, dict) and c.get("type") == "text":
                texts.append(c.get("text") or "")
            if isinstance(c, dict) and c.get("type") == "tool_use":
                inp = c.get("input") or {}
                contents = inp.get("contents") or ""
                if '"0 = 不限"' in contents and "T = {" in contents:
                    m = re.search(r"T = \{([\s\S]*?)\n\}", contents)
                    if m:
                        # Convert Python dict body "k": "v", -> 'k': 'v',
                        body = m.group(1)
                        # Keep as JS by replacing " with ' for keys carefully via ast
                        import ast

                        mapping = ast.literal_eval("{" + body + "}")
                        lines = []
                        for k, v in mapping.items():
                            ks = json.dumps(k, ensure_ascii=False)
                            vs = json.dumps(v, ensure_ascii=False)
                            lines.append(f"  {ks}: {vs},")
                        frag = "\n".join(lines)
                        break
    if frag:
        break
    blob = "\n".join(texts)
    m = re.search(r"```js\n([\s\S]*?)```", blob)
    if m:
        frag = m.group(1).strip()
        break
    marker = "'0 = 不限'"
    if marker in blob:
        frag = blob[blob.index(marker) :].strip()
        if frag.endswith("```"):
            frag = frag[: -3].strip()
        break

if not frag:
    raise SystemExit("fragment not found")

out.write_text(frag + "\n", encoding="utf-8")
print(f"wrote {out} ({len(frag)} chars)")
