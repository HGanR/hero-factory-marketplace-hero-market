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
        print("Usage: generate_promissory_note_pdf.py <input_json_path> <output_pdf_path>", file=sys.stderr)
        sys.exit(2)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    c = canvas.Canvas(output_path, pagesize=LETTER)
    width, height = LETTER

    x = 1 * inch
    y = height - 1 * inch

    title = payload.get("title") or "Promissory Note"
    c.setFont("Helvetica-Bold", 14)
    c.drawString(x, y, title)
    y -= 0.25 * inch

    c.setFont("Helvetica", 10)
    c.drawString(x, y, f"Version: {payload.get('version','')}")
    y -= 0.18 * inch
    c.drawString(x, y, f"Note Number: {payload.get('noteNumber','')}")
    y -= 0.18 * inch
    c.drawString(x, y, f"Trust ID: {payload.get('trustId','')}")
    y -= 0.18 * inch
    c.drawString(x, y, f"Client ID: {payload.get('clientId','')}")
    y -= 0.25 * inch

    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, "Parties")
    y -= 0.18 * inch
    c.setFont("Helvetica", 10)
    c.drawString(x, y, f"Issuer: {payload.get('issuerName','')}")
    y -= 0.16 * inch
    c.drawString(x, y, f"Borrower: {payload.get('borrowerName','')}")
    y -= 0.25 * inch

    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, "Terms")
    y -= 0.18 * inch
    c.setFont("Helvetica", 10)
    c.drawString(x, y, f"Principal Amount: {payload.get('principalAmount','')}")
    y -= 0.16 * inch
    c.drawString(x, y, f"Interest Rate: {payload.get('interestRate','')}")
    y -= 0.16 * inch
    c.drawString(x, y, f"Maturity Date: {payload.get('maturityDate','')}")
    y -= 0.16 * inch
    c.drawString(x, y, f"Governing Law: {payload.get('governingLawState','')}")
    y -= 0.18 * inch
    y = draw_multiline(c, f"Payment Terms: {payload.get('paymentTerms','')}", x, y)
    y -= 0.1 * inch

    c.setFont("Helvetica-Bold", 11)
    c.drawString(x, y, "Digital Signature")
    y -= 0.18 * inch
    c.setFont("Helvetica", 10)
    c.drawString(x, y, f"Signer Name: {payload.get('signatureName','')}")
    y -= 0.16 * inch
    c.drawString(x, y, f"Signer Title: {payload.get('signatureTitle','')}")
    y -= 0.16 * inch
    c.drawString(x, y, f"Signature: {payload.get('signatureText','')}")
    y -= 0.16 * inch
    c.drawString(x, y, f"Signature Date: {payload.get('signatureDate','')}")
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
    c.drawString(x, 0.75 * inch, "This document is generated for record-keeping and does not constitute legal advice.")
    c.save()

if __name__ == "__main__":
    main()
