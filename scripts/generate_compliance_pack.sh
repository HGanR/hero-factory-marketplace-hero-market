#!/bin/bash
# Generate Compliance Documentation Pack
# Converts markdown files to PDF for distribution

set -e

echo "=== Generating Parent Company Compliance Pack ==="

# Check if pandoc is installed
if ! command -v pandoc &> /dev/null; then
    echo "❌ pandoc is required to generate PDFs. Install with: brew install pandoc"
    exit 1
fi

# Check if wkhtmltopdf is available (alternative)
if ! command -v wkhtmltopdf &> /dev/null; then
    echo "⚠️  wkhtmltopdf not found. PDFs will use basic formatting."
fi

# Create output directory
OUTPUT_DIR="dist/compliance-pack"
mkdir -p "$OUTPUT_DIR"

echo "📄 Generating individual documents..."

# Generate individual PDFs
pandoc legal/counsel_technical_memo.md \
    -o "$OUTPUT_DIR/counsel_technical_memo.pdf" \
    --pdf-engine=pdflatex \
    -V geometry:margin=1in \
    -V fontsize=11pt \
    --metadata title="Counsel-Facing Technical Memo"

pandoc legal/bank_explanation_sheet.md \
    -o "$OUTPUT_DIR/bank_explanation_sheet.pdf" \
    --pdf-engine=pdflatex \
    -V geometry:margin=1in \
    -V fontsize=11pt \
    --metadata title="Bank-Facing Explanation Sheet"

pandoc legal/consultant_playbook.md \
    -o "$OUTPUT_DIR/consultant_playbook.pdf" \
    --pdf-engine=pdflatex \
    -V geometry:margin=1in \
    -V fontsize=11pt \
    --metadata title="Consultant Playbook"

pandoc legal/production_compliance_pack.md \
    -o "$OUTPUT_DIR/compliance_pack_overview.pdf" \
    --pdf-engine=pdflatex \
    -V geometry:margin=1in \
    -V fontsize=11pt \
    --metadata title="Production Compliance Pack"

echo "📦 Creating combined pack..."

# Create a combined PDF with table of contents
pandoc legal/production_compliance_pack.md \
    legal/counsel_technical_memo.md \
    legal/bank_explanation_sheet.md \
    legal/consultant_playbook.md \
    -o "$OUTPUT_DIR/parent_company_compliance_pack.pdf" \
    --pdf-engine=pdflatex \
    -V geometry:margin=1in \
    -V fontsize=11pt \
    --toc \
    --toc-depth=2 \
    --metadata title="Parent Company + C-Corp Setup Wizard - Compliance Documentation Pack"

echo "📋 Generating checklist..."

# Generate checklist as separate deliverable
pandoc production/parent_company_release_checklist.md \
    -o "$OUTPUT_DIR/release_checklist.pdf" \
    --pdf-engine=pdflatex \
    -V geometry:margin=1in \
    -V fontsize=11pt \
    --metadata title="Production Release Checklist"

echo "✅ Compliance pack generated successfully!"
echo ""
echo "📁 Output directory: $OUTPUT_DIR"
echo ""
echo "Generated files:"
echo "  • compliance_pack_overview.pdf"
echo "  • counsel_technical_memo.pdf"
echo "  • bank_explanation_sheet.pdf"
echo "  • consultant_playbook.pdf"
echo "  • parent_company_compliance_pack.pdf (combined)"
echo "  • release_checklist.pdf"
echo ""
echo "🎯 Ready for internal distribution and external sharing!"
echo ""
echo "Next steps:"
echo "1. Review generated PDFs for formatting"
echo "2. Share with legal counsel for approval"
echo "3. Distribute to consultants and banking partners"
echo "4. Use checklist for production deployment"








