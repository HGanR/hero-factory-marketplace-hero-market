from __future__ import annotations

from datetime import date
from typing import List, Optional

from .models import BinderDocument, ContentBlock, DocType, Section, TableData


def generate_policy_binder_pdf(
    doc: BinderDocument,
    output_path: str,
    watermark_text: Optional[str] = None,
    doc_type: Optional[DocType] = None,
) -> None:
    """
    Production-oriented generator:
    - Times, 12pt, 1-inch margins, ~1.5 spacing
    - Watermark on every page (optional)
    - Real tables (ReportLab Table) with basic grid + header styling
    - Per-section approval blocks (approved by / approval date / next review date)
    - doc_type template behavior (signature pages)
    """
    # Import reportlab lazily so the package can be imported without reportlab installed.
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.units import inch
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.platypus import (
        KeepTogether,
        ListFlowable,
        ListItem,
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    dt: DocType = doc_type or doc.meta.doc_type

    styles = _build_styles(ParagraphStyle, getSampleStyleSheet)

    pdf = SimpleDocTemplate(
        output_path,
        pagesize=LETTER,
        leftMargin=1 * inch,
        rightMargin=1 * inch,
        topMargin=1 * inch,
        bottomMargin=1 * inch,
        title=doc.meta.binder_title,
        author=doc.meta.prepared_by or doc.meta.family_office_name,
    )

    story: List[object] = []

    # Cover
    story.extend(_build_cover(doc, styles, dt, Paragraph, Spacer, inch))
    story.append(PageBreak())

    # Definitions (optional)
    if doc.definitions:
        story.append(Paragraph("Definitions", styles["H1"]))
        story.append(Spacer(1, 0.15 * inch))
        for term, definition in doc.definitions.items():
            story.append(Paragraph(f"<b>{_esc(term)}.</b> {_esc(definition)}", styles["Body"]))
            story.append(Spacer(1, 0.08 * inch))
        story.append(PageBreak())

    # Sections
    for i, s in enumerate(doc.sections, start=1):
        story.extend(
            _render_section(
                section=s,
                styles=styles,
                level=1,
                section_number=[i],
                Paragraph=Paragraph,
                Spacer=Spacer,
                ListFlowable=ListFlowable,
                ListItem=ListItem,
                Table=Table,
                TableStyle=TableStyle,
                KeepTogether=KeepTogether,
                PageBreak=PageBreak,
                inch=inch,
                colors=colors,
            )
        )

    # Signature pages
    story.append(PageBreak())
    if dt == "operating_agreement":
        story.extend(_build_signature_pages_operating_agreement(doc, styles, Paragraph, Spacer, inch))
    else:
        story.extend(_build_signature_pages_policy_binder(doc, styles, Paragraph, Spacer, inch))

    def on_page(canvas: Canvas, _doc) -> None:
        _draw_footer(canvas, doc)
        if watermark_text:
            _draw_watermark(canvas, watermark_text)

    pdf.build(story, onFirstPage=on_page, onLaterPages=on_page)


def _build_styles(ParagraphStyle, getSampleStyleSheet):
    base = getSampleStyleSheet()

    body = ParagraphStyle(
        "Body",
        parent=base["Normal"],
        fontName="Times-Roman",
        fontSize=12,
        leading=18,  # ~1.5 spacing for 12pt
        spaceAfter=6,
    )
    h1 = ParagraphStyle(
        "H1",
        parent=base["Heading1"],
        fontName="Times-Bold",
        fontSize=16,
        leading=20,
        spaceAfter=10,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=base["Heading2"],
        fontName="Times-Bold",
        fontSize=13,
        leading=16,
        spaceBefore=8,
        spaceAfter=6,
    )
    small = ParagraphStyle(
        "Small",
        parent=body,
        fontSize=10,
        leading=13,
    )

    return {"Body": body, "H1": h1, "H2": h2, "Small": small}


def _build_cover(doc: BinderDocument, styles, dt: DocType, Paragraph, Spacer, inch):
    story: List[object] = []
    title = doc.meta.binder_title
    if dt == "operating_agreement" and "Operating Agreement" not in title:
        title = "Family Office Operating Agreement"

    story.append(Paragraph(_esc(doc.meta.family_office_name), styles["H1"]))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(_esc(title), styles["H1"]))
    story.append(Spacer(1, 0.25 * inch))

    story.append(Paragraph(f"Effective Date: {_esc(doc.meta.effective_date.isoformat())}", styles["Body"]))
    if doc.meta.jurisdiction:
        story.append(Paragraph(f"Jurisdiction: {_esc(doc.meta.jurisdiction)}", styles["Body"]))
    story.append(Paragraph(f"Version: {_esc(doc.meta.version)}", styles["Body"]))

    story.append(Spacer(1, 0.35 * inch))
    if doc.meta.prepared_for:
        story.append(Paragraph(f"Prepared for: {_esc(doc.meta.prepared_for)}", styles["Body"]))
    if doc.meta.prepared_by:
        story.append(Paragraph(f"Prepared by: {_esc(doc.meta.prepared_by)}", styles["Body"]))

    story.append(Spacer(1, 0.35 * inch))
    story.append(Paragraph(_esc(doc.meta.confidentiality), styles["Small"]))
    return story


def _render_section(
    section: Section,
    styles,
    level: int,
    section_number: List[int],
    Paragraph,
    Spacer,
    ListFlowable,
    ListItem,
    Table,
    TableStyle,
    KeepTogether,
    PageBreak,
    inch,
    colors,
) -> List[object]:
    story: List[object] = []
    number_str = ".".join(str(n) for n in section_number)

    story.append(Paragraph(f"{number_str} {_esc(section.title)}", styles["H1" if level == 1 else "H2"]))

    if section.subtitle:
        story.append(Paragraph(_esc(section.subtitle), styles["Body"]))
        story.append(Spacer(1, 0.05 * inch))

    # Approvals block (per section)
    if section.approvals and (
        section.approvals.approved_by or section.approvals.approval_date or section.approvals.next_review_date
    ):
        story.append(_render_approvals(section, styles, Table, TableStyle, KeepTogether, inch, colors))
        story.append(Spacer(1, 0.10 * inch))

    for b in section.blocks:
        story.extend(_render_block(b, styles, Paragraph, Spacer, ListFlowable, ListItem, Table, TableStyle, inch, colors, PageBreak))

    for j, child in enumerate(section.children, start=1):
        story.extend(
            _render_section(
                section=child,
                styles=styles,
                level=level + 1,
                section_number=section_number + [j],
                Paragraph=Paragraph,
                Spacer=Spacer,
                ListFlowable=ListFlowable,
                ListItem=ListItem,
                Table=Table,
                TableStyle=TableStyle,
                KeepTogether=KeepTogether,
                PageBreak=PageBreak,
                inch=inch,
                colors=colors,
            )
        )

    story.append(Spacer(1, 0.12 * inch))
    return story


def _render_approvals(section: Section, styles, Table, TableStyle, KeepTogether, inch, colors):
    a = section.approvals
    rows = [
        ["Policy approvals", ""],
        ["Approved by", _esc(a.approved_by) if a and a.approved_by else "—"],
        ["Approval date", a.approval_date.isoformat() if a and a.approval_date else "—"],
        ["Next review date", a.next_review_date.isoformat() if a and a.next_review_date else "—"],
    ]
    t = Table(rows, colWidths=[1.7 * inch, 4.8 * inch])
    t.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Times-Roman"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), "Times-Bold"),
                ("SPAN", (0, 0), (1, 0)),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.black),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return KeepTogether([t])


def _render_block(block: ContentBlock, styles, Paragraph, Spacer, ListFlowable, ListItem, Table, TableStyle, inch, colors, PageBreak):
    story: List[object] = []
    t = block.type

    if t == "page_break":
        story.append(PageBreak())
        return story

    if t == "paragraph":
        story.append(Paragraph(_esc(block.text or ""), styles["Body"]))
        return story

    if t == "bullets":
        items = block.items or []
        lf = ListFlowable(
            [ListItem(Paragraph(_esc(i), styles["Body"])) for i in items],
            bulletType="bullet",
            leftIndent=18,
        )
        story.append(lf)
        story.append(Spacer(1, 0.06 * inch))
        return story

    if t == "numbered":
        items = block.items or []
        lf = ListFlowable(
            [ListItem(Paragraph(_esc(i), styles["Body"])) for i in items],
            bulletType="1",
            leftIndent=18,
        )
        story.append(lf)
        story.append(Spacer(1, 0.06 * inch))
        return story

    if t == "table":
        if not block.table:
            return story
        story.extend(_render_table(block.table, styles, Paragraph, Spacer, Table, TableStyle, inch, colors))
        return story

    if t == "raw":
        story.append(Paragraph(_esc(str(block.raw)), styles["Body"]))
        return story

    story.append(Paragraph(_esc(block.text or ""), styles["Body"]))
    return story


def _render_table(table: TableData, styles, Paragraph, Spacer, Table, TableStyle, inch, colors):
    story: List[object] = []

    if table.caption:
        story.append(Paragraph(_esc(table.caption), styles["Body"]))
        story.append(Spacer(1, 0.05 * inch))

    headers = table.headers or []
    rows = table.rows or []

    data: List[list] = []
    if headers:
        data.append([Paragraph(f"<b>{_esc(h)}</b>", styles["Body"]) for h in headers])

    for r in rows:
        data.append([Paragraph(_esc(str(c)), styles["Body"]) for c in r])

    col_widths = None
    if table.col_widths:
        col_widths = [w * inch for w in table.col_widths]

    t = Table(data, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Times-Roman"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("LEADING", (0, 0), (-1, -1), 13),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.75, colors.black),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.black),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    if headers:
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke)]))

    story.append(t)
    story.append(Spacer(1, 0.12 * inch))
    return story


def _build_signature_pages_operating_agreement(doc: BinderDocument, styles, Paragraph, Spacer, inch):
    story: List[object] = []
    story.append(Paragraph("Execution", styles["H1"]))
    story.append(
        Paragraph(
            "IN WITNESS WHEREOF, the undersigned have executed this Operating Agreement as of the Effective Date.",
            styles["Body"],
        )
    )
    story.append(Spacer(1, 0.25 * inch))

    for label in ["Family Representative", "Chief Investment Officer", "Chief Operating Officer"]:
        story.append(Paragraph(f"<b>{_esc(label)}</b>", styles["Body"]))
        story.append(Paragraph("Name: ________________________________", styles["Body"]))
        story.append(Paragraph("Title: ________________________________", styles["Body"]))
        story.append(Paragraph("Date: ________________________________", styles["Body"]))
        story.append(Spacer(1, 0.2 * inch))

    return story


def _build_signature_pages_policy_binder(doc: BinderDocument, styles, Paragraph, Spacer, inch):
    story: List[object] = []
    story.append(Paragraph("Acknowledgment & Approval", styles["H1"]))
    story.append(
        Paragraph(
            "The undersigned acknowledge receipt of this Policy Binder and approve the policies herein, subject to periodic review and amendment.",
            styles["Body"],
        )
    )
    story.append(Spacer(1, 0.25 * inch))

    for label in ["Family Council Chair", "General Counsel", "Managing Director"]:
        story.append(Paragraph(f"<b>{_esc(label)}</b>", styles["Body"]))
        story.append(Paragraph("Name: ________________________________", styles["Body"]))
        story.append(Paragraph("Date: ________________________________", styles["Body"]))
        story.append(Spacer(1, 0.2 * inch))

    return story


def _draw_footer(canvas, doc: BinderDocument) -> None:
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.units import inch

    canvas.saveState()
    canvas.setFont("Times-Roman", 9)
    page_num = canvas.getPageNumber()
    footer_left = f"{doc.meta.family_office_name} — {doc.meta.version}"
    footer_right = f"Page {page_num}"
    width, _height = LETTER
    canvas.drawString(1 * inch, 0.65 * inch, footer_left)
    canvas.drawRightString(width - 1 * inch, 0.65 * inch, footer_right)
    canvas.restoreState()


def _draw_watermark(canvas, text: str) -> None:
    from reportlab.lib.pagesizes import LETTER

    canvas.saveState()
    width, height = LETTER
    canvas.setFont("Times-Bold", 52)
    canvas.setFillGray(0.85)
    canvas.translate(width / 2, height / 2)
    canvas.rotate(35)
    canvas.drawCentredString(0, 0, text)
    canvas.restoreState()


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")




