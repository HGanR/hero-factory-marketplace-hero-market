from __future__ import annotations

import json
from datetime import date
from typing import Any, Dict

from .models import (
    ApprovalBlock,
    BinderDocument,
    BinderMeta,
    ContentBlock,
    DocType,
    Section,
    TableData,
)


def _parse_date(s: str) -> date:
    return date.fromisoformat(s)


def load_binder_document_from_json(path: str) -> BinderDocument:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta_d = data.get("meta") or {}
    doc_type: DocType = meta_d.get("doc_type", "policy_binder")

    meta = BinderMeta(
        family_office_name=meta_d["family_office_name"],
        binder_title=meta_d.get("binder_title", "Operating Agreement & Policy Binder"),
        effective_date=_parse_date(meta_d.get("effective_date", date.today().isoformat())),
        jurisdiction=meta_d.get("jurisdiction"),
        version=meta_d.get("version", "v1.0"),
        prepared_for=meta_d.get("prepared_for"),
        prepared_by=meta_d.get("prepared_by"),
        confidentiality=meta_d.get("confidentiality", "CONFIDENTIAL"),
        doc_type=doc_type,
    )

    definitions = data.get("definitions") or {}
    sections = [_parse_section(sd) for sd in (data.get("sections") or [])]
    if not sections:
        raise ValueError("Input JSON must contain at least one section in sections[].")

    return BinderDocument(meta=meta, sections=sections, definitions=definitions)


def _parse_section(d: Dict[str, Any]) -> Section:
    blocks = [_parse_block(b) for b in (d.get("blocks") or [])]
    children = [_parse_section(cd) for cd in (d.get("children") or [])]

    approvals = None
    if isinstance(d.get("approvals"), dict):
        ad = d["approvals"]
        approvals = ApprovalBlock(
            approved_by=ad.get("approved_by"),
            approval_date=_parse_date(ad["approval_date"]) if ad.get("approval_date") else None,
            next_review_date=_parse_date(ad["next_review_date"]) if ad.get("next_review_date") else None,
        )

    return Section(
        id=d["id"],
        title=d["title"],
        subtitle=d.get("subtitle"),
        blocks=blocks,
        children=children,
        approvals=approvals,
    )


def _parse_block(d: Dict[str, Any]) -> ContentBlock:
    t = d["type"]
    if t == "table":
        td = d.get("table") or {}
        table = TableData(
            headers=list(td.get("headers") or []),
            rows=[list(r) for r in (td.get("rows") or [])],
            col_widths=td.get("col_widths"),
            caption=td.get("caption"),
        )
        return ContentBlock(type="table", table=table)

    if t == "page_break":
        return ContentBlock(type="page_break")

    return ContentBlock(
        type=t,
        text=d.get("text"),
        items=d.get("items"),
        raw=d.get("raw"),
    )


def validate_binder_json(path: str) -> None:
    _ = load_binder_document_from_json(path)


def dump_template_json(path: str) -> None:
    template = {
        "meta": {
            "family_office_name": "Riverview Family Office",
            "binder_title": "Operating Agreement & Policy Binder",
            "doc_type": "policy_binder",
            "effective_date": date.today().isoformat(),
            "jurisdiction": "NY",
            "version": "v1.0",
            "prepared_for": "Family Council",
            "prepared_by": "General Counsel",
            "confidentiality": "CONFIDENTIAL",
        },
        "definitions": {},
        "sections": [
            {
                "id": "governance",
                "title": "Governance & Decision Rights",
                "subtitle": "Delegation framework and control environment.",
                "approvals": {
                    "approved_by": "Family Council Chair",
                    "approval_date": date.today().isoformat(),
                    "next_review_date": date(date.today().year + 1, date.today().month, date.today().day).isoformat(),
                },
                "blocks": [
                    {
                        "type": "paragraph",
                        "text": "This binder establishes the operating cadence, delegation framework, and control environment for the Family Office.",
                    }
                ],
                "children": [],
            }
        ],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(template, f, indent=2)




