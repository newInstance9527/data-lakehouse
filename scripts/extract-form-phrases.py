# -*- coding: utf-8 -*-
"""Extract Chinese UI strings from createForms.js into phrases stub (manual EN fill later)."""
import re
from pathlib import Path

src = Path(r"E:/lakehouse-design/lakehouse/src/data/createForms.js").read_text(encoding="utf-8")
phrases_path = Path(r"E:/lakehouse-design/lakehouse/src/i18n/phrases.js")
text = phrases_path.read_text(encoding="utf-8")

# pull label/title/intro/placeholder/submitLabel/hint string literals
keys = set()
for pat in [
    r"label:\s*'([^']+)'",
    r'label:\s*"([^"]+)"',
    r"title:\s*'([^']+)'",
    r'title:\s*"([^"]+)"',
    r"intro:\s*'([^']+)'",
    r"placeholder:\s*'([^']+)'",
    r"submitLabel:\s*'([^']+)'",
    r"hint:\s*'([^']+)'",
]:
    keys.update(re.findall(pat, src))

# keep Chinese-ish
def has_cjk(s):
    return any("\u4e00" <= c <= "\u9fff" for c in s)

cjk_keys = sorted(k for k in keys if has_cjk(k) and k not in text)
print(f"new candidates: {len(cjk_keys)}")
# append as identity EN placeholders comment block for later - actually add with rough pass-through as same for now is useless
# Better: write extras file
out = Path(r"E:/lakehouse-design/lakehouse/src/i18n/phrases.forms.extra.txt")
out.write_text("\n".join(cjk_keys), encoding="utf-8")
print("wrote", out)
