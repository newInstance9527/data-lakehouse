# -*- coding: utf-8 -*-
"""Merge _forms_frag.js entries into phrases.js PHRASES_EN without overwriting existing."""
import re
from pathlib import Path

phrases_path = Path(r"E:/lakehouse-design/lakehouse/src/i18n/phrases.js")
frag_path = Path(r"E:/lakehouse-design/lakehouse/src/i18n/_forms_frag.js")

src = phrases_path.read_text(encoding="utf-8")
frag = frag_path.read_text(encoding="utf-8").strip()

# existing keys: 'key': or bare identifier — collect quoted keys and simple CJK identifiers
existing = set(re.findall(r"^\s*'((?:\\'|[^'])*)'\s*:", src, re.M))
existing |= set(re.findall(r'^\s*"((?:\\"|[^"])*)"\s*:', src, re.M))
# bare keys like 刷新:
for m in re.finditer(r"^\s*([A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*)\s*:", src, re.M):
    existing.add(m.group(1))

new_lines = []
for line in frag.splitlines():
    line = line.rstrip()
    if not line or line.startswith("//"):
        continue
    m = re.match(r"\s*'((?:\\'|[^'])*)'\s*:\s*('(?:\\'|[^'])*'|\"(?:\\\"|[^\"])*\")\s*,?\s*$", line)
    if not m:
        # try double-quoted key
        m = re.match(r'\s*"((?:\\"|[^"])*)"\s*:\s*("(?:\\"|[^"])*"|\'(?:\\\'|[^\'])*\')\s*,?\s*$', line)
    if not m:
        continue
    key = m.group(1).encode("utf-8").decode("unicode_escape") if "\\u" in m.group(1) else m.group(1)
    # keys in frag are already unicode
    key = m.group(1).replace("\\'", "'")
    if key in existing:
        continue
    val = m.group(2)
    new_lines.append(f"  '{key}': {val},")
    existing.add(key)

print(f"adding {len(new_lines)} new entries")

# insert before closing `}`
# find last `}` of export const PHRASES_EN
idx = src.rstrip().rfind("}")
if idx < 0:
    raise SystemExit("no closing brace")
# ensure trailing comma on previous last entry
before = src[:idx].rstrip()
if not before.endswith(","):
    # add comma after last property line
    lines = before.splitlines()
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip() and not lines[i].strip().startswith("//"):
            if not lines[i].rstrip().endswith(","):
                lines[i] = lines[i].rstrip() + ","
            break
    before = "\n".join(lines)

block = "\n\n  // createForms 表单 chrome（自动合并）\n" + "\n".join(new_lines) + "\n"
new_src = before + block + "}\n"
phrases_path.write_text(new_src, encoding="utf-8")
frag_path.unlink(missing_ok=True)
print("merged into phrases.js; removed _forms_frag.js")
