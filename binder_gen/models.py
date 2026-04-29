from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Literal, Optional

DocType = Literal["operating_agreement", "policy_binder"]


@dataclass
class BinderMeta:
    family_office_name: str
    binder_title: str = "Operating Agreement & Policy Binder"
    effective_date: date = date.today()
    jurisdiction: Optional[str] = None
    version: str = "v1.0"
    prepared_for: Optional[str] = None
    prepared_by: Optional[str] = None
    confidentiality: str = "CONFIDENTIAL"
    doc_type: DocType = "policy_binder"


@dataclass
class ApprovalBlock:
    approved_by: Optional[str] = None
    approval_date: Optional[date] = None
    next_review_date: Optional[date] = None


@dataclass
class TableData:
    headers: List[str] = field(default_factory=list)
    rows: List[List[str]] = field(default_factory=list)
    # If provided, treated as inches (e.g., [1.2, 2.5, 2.3]).
    col_widths: Optional[List[float]] = None
    caption: Optional[str] = None


ContentBlockType = Literal["paragraph", "bullets", "numbered", "table", "page_break", "raw"]


@dataclass
class ContentBlock:
    type: ContentBlockType
    text: Optional[str] = None
    items: Optional[List[str]] = None
    table: Optional[TableData] = None
    raw: Optional[Any] = None


@dataclass
class Section:
    id: str
    title: str
    subtitle: Optional[str] = None
    blocks: List[ContentBlock] = field(default_factory=list)
    children: List["Section"] = field(default_factory=list)
    approvals: Optional[ApprovalBlock] = None


@dataclass
class BinderDocument:
    meta: BinderMeta
    sections: List[Section]
    definitions: Dict[str, str] = field(default_factory=dict)




