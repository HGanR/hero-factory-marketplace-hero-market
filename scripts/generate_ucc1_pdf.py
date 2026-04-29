#!/usr/bin/env python3
import json
import sys
import io
import base64
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader

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
        print("Usage: generate_ucc1_pdf.py <input_json_path> <output_pdf_path>", file=sys.stderr)
        sys.exit(2)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    c = canvas.Canvas(output_path, pagesize=LETTER)
    width, height = LETTER

    x = 1 * inch
    y = height - 1 * inch

    title = payload.get("title") or "UCC-1 Financing Statement (Draft)"
    c.setFont("Helvetica-Bold", 14)
    c.drawString(x, y, title)
    y -= 0.25 * inch

    c.setFont("Helvetica", 10)
    c.drawString(x, y, f"Filing State: {payload.get('filingState','')}")
    y -= 0.18 * inch
    c.drawString(x, y, f"Trust ID: {payload.get('trustId','')}")
    y -= 0.18 * inch
    c.drawString(x, y, f"Client ID: {payload.get('clientId','')}")
    y -= 0.25 * inch

    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, "Debtor")
    y -= 0.18 * inch
    c.setFont("Helvetica", 10)
    y = draw_multiline(c, payload.get("debtor",""), x, y)
    y -= 0.12 * inch

    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, "Secured Party")
    y -= 0.18 * inch
    c.setFont("Helvetica", 10)
    y = draw_multiline(c, payload.get("securedParty",""), x, y)
    y -= 0.12 * inch

    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, "Collateral Description")
    y -= 0.18 * inch
    c.setFont("Helvetica", 10)
    y = draw_multiline(c, payload.get("collateralDescription",""), x, y)
    y -= 0.12 * inch

    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, "State Guidance")
    y -= 0.18 * inch
    c.setFont("Helvetica", 10)
    y = draw_multiline(c, payload.get("stateGuidance",""), x, y)
    y -= 0.2 * inch

    sig_data_url = payload.get("signatureImageDataUrl") or ""
    if sig_data_url.startswith("data:image"):
        try:
            _, b64 = sig_data_url.split(",", 1)
            img_bytes = base64.b64decode(b64)
            img = ImageReader(io.BytesIO(img_bytes))
            c.drawString(x, y, "Signature Capture:")
            y -= 0.1 * inch
            c.drawImage(img, x, y - 0.8 * inch, width=3.5 * inch, height=0.8 * inch, mask='auto')
            y -= 0.9 * inch
        except Exception:
            pass

    c.setFont("Helvetica", 8)
    c.drawString(x, 0.75 * inch, "Draft summary only. File the official UCC-1 form required by your state.")
    c.save()

if __name__ == "__main__":
    main()
