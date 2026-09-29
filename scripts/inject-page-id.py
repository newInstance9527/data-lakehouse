# -*- coding: utf-8 -*-
"""Inject page-id into <PageHeader ...> based on title=\"...\"."""
import re
from pathlib import Path

root = Path(r"E:/lakehouse-design/lakehouse/src/views")
title_to_id = {
    "总览仪表盘": "overview",
    "数据源管理": "datasource",
    "ETL 编排": "integration",
    "资产目录": "catalog",
    "字段血缘": "lineage",
    "数据标准": "standard",
    "生命周期": "lifecycle",
    "生命周期与小文件治理": "lifecycle",
    "存储趋势": "storage-trend",
    "合规删除": "compliance",
    "合规删除工单": "compliance",
    "数据开发 / SQL": "develop",
    "即席查询": "query",
    "环境与发布": "publish",
    "数据质量": "quality",
    "数据质量中心": "quality",
    "安全与权限": "security",
    "数据安全与权限中心": "security",
    "数据契约": "contract",
    "数据服务": "dataservice",
    "数据服务中心": "dataservice",
    "指标中心": "metrics",
    "出湖与回流": "export",
    "申请中心": "apply",
    "任务运维": "ops",
    "链路调用监控": "linktrace",
    "基础设施监控": "infra",
    "根因分析台": "rootcause",
    "可靠性中心": "reliability",
    "查询治理与成本": "querygov",
    "工作空间": "workspace",
    "AI 助手": "aiassistant",
    "AI 模型管理": "aimodel",
    "知识库": "knowledge",
    "部门管理": "sys-org",
    "职位管理": "sys-position",
    "用户管理": "sys-users",
    "角色管理": "sys-roles",
    "菜单管理": "sys-menus",
    "表清单": "source-tables",
}

pat = re.compile(r"<PageHeader\b[\s\S]*?>", re.M)

changed = []
for path in sorted(root.glob("*.vue")):
    text = path.read_text(encoding="utf-8")
    if "page-id=" in text or ":page-id=" in text or "pageId=" in text:
        continue

    def repl(m: re.Match) -> str:
        block = m.group(0)
        tm = re.search(r'title="([^"]+)"', block)
        if not tm:
            return block
        pid = title_to_id.get(tm.group(1))
        if not pid:
            return block
        return re.sub(r"<PageHeader\b", f'<PageHeader\n      page-id="{pid}"', block, count=1)

    new_text, n = pat.subn(repl, text, count=1)
    if n and new_text != text:
        path.write_text(new_text, encoding="utf-8")
        changed.append(path.name)

print(f"changed {len(changed)}")
for name in changed:
    print(name)
