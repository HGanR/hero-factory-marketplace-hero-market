#!/usr/bin/env python3
import json
import sys
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch

def draw_multiline(c, text, x, y, max_width_chars=95, leading=14):
    words = (text or "").split()
    lines = []
    line = []
    for w in words:
        if len(" ".join(line + [w])) <= max_width_chars:
            line.append(w)
        else:
            lines.append(" ".join(line))
            line = [w]
    if line:
        lines.append(" ".join(line))
    for ln in lines:
        c.drawString(x, y, ln)
        y -= leading
    return y

def main():
    if len(sys.argv) != 3:
        print("Usage: generate_deed_cover_sheet_pdf.py <input_json_path> <output_pdf_path>", file=sys.stderr)
        sys.exit(2)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    c = canvas.Canvas(output_path, pagesize=LETTER)
    width, height = LETTER

    x = 1 * inch
    y = height - 1 * inch

    title = payload.get("title") or "Recording Cover Sheet (Draft)"
    c.setFont("Helvetica-Bold", 14)
    c.drawString(x, y, title)
    y -= 0.25 * inch

    c.setFont("Helvetica", 10)
    c.drawString(x, y, f"Deed Type: {payload.get('deedType','')}")
    y -= 0.18 * inch
    c.drawString(x, y, f"Prepared For: {payload.get('preparedFor','')}")
    y -= 0.18 * inch
    c.drawString(x, y, f"Return To: {payload.get('returnTo','')}")
    y -= 0.25 * inch

    prop = payload.get("property", {})
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, "Property")
    y -= 0.18 * inch
    c.setFont("Helvetica", 10)
    addr = ", ".join([p for p in [prop.get("street1"), prop.get("city"), prop.get("state"), prop.get("postalCode")] if p])
    c.drawString(x, y, f"Address: {addr or '—'}")
    y -= 0.16 * inch
    c.drawString(x, y, f"County: {prop.get('county') or '—'}")
    y -= 0.16 * inch
    c.drawString(x, y, f"Parcel/APN: {prop.get('parcelNumber') or '—'}")
    y -= 0.25 * inch

    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, "Grantor(s)")
    y -= 0.18 * inch
    c.setFont("Helvetica", 10)
    for g in payload.get("grantors", []):
        c.drawString(x, y, f"- {g}")
        y -= 0.16 * inch
    y -= 0.1 * inch

    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, "Grantee(s)")
    y -= 0.18 * inch
    c.setFont("Helvetica", 10)
    for g in payload.get("grantees", []):
        c.drawString(x, y, f"- {g}")
        y -= 0.16 * inch
    y -= 0.1 * inch

    legal = prop.get("legalDescription") or ""
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, "Legal Description")
    y -= 0.18 * inch
    c.setFont("Helvetica", 10)
    y = draw_multiline(c, legal if legal else "—", x, y)

    c.setFont("Helvetica", 9)
    c.drawString(x, 0.75 * inch, "Draft cover sheet. Verify county-specific form requirements before recording.")
    c.drawString(x, 0.65 * inch, "This sheet is not legal advice or a recordable instrument on its own.")
    c.save()

if __name__ == "__main__":
    main()
