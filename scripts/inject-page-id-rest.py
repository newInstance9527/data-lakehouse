# -*- coding: utf-8 -*-
from pathlib import Path

fixes = {
    "LineageView.vue": "lineage",
    "InfraView.vue": "infra",
    "WorkspaceView.vue": "workspace",
    "AiAssistantView.vue": "aiassistant",
    "QueryView.vue": "query",
    "OpsView.vue": "ops",
    "DatasourceView.vue": "datasource",
    "StandardView.vue": "standard",
    "CatalogView.vue": "catalog",
    "IntegrationView.vue": "integration",
    "PublishView.vue": "publish",
    "DevelopView.vue": "develop",
    "LinktraceView.vue": "linktrace",
    "ComplianceView.vue": "compliance",
    "RootcauseView.vue": "rootcause",
    "SourceTablesView.vue": "source-tables",
}
root = Path(r"E:/lakehouse-design/lakehouse/src/views")
for name, pid in fixes.items():
    p = root / name
    text = p.read_text(encoding="utf-8")
    needle = f'page-id="{pid}"'
    if needle in text:
        print("skip", name)
        continue
    if "<PageHeader" not in text:
        print("no header", name)
        continue
    text2 = text.replace("<PageHeader", f'<PageHeader\n      page-id="{pid}"', 1)
    p.write_text(text2, encoding="utf-8")
    print("ok", name)
