from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path
from typing import Optional

from .generator import generate_policy_binder_pdf
from .io_json import dump_template_json, load_binder_document_from_json, validate_binder_json
from .models import DocType


def _slugify(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or "binder"


def _default_out_path(doc_title: str, office_name: str) -> Path:
    out_dir = Path("binder_gen") / "out"
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = _slugify(f"{office_name}-{doc_title}")
    return out_dir / f"{slug}-{date.today().isoformat()}.pdf"


def _open_file(path: Path) -> None:
    try:
        if sys.platform.startswith("darwin"):
            subprocess.run(["open", str(path)], check=False)
        elif os.name == "nt":
            os.startfile(str(path))  # type: ignore[attr-defined]
        else:
            subprocess.run(["xdg-open", str(path)], check=False)
    except Exception:
        pass


def cmd_generate(args: argparse.Namespace) -> int:
    doc = load_binder_document_from_json(args.input)

    out_path = Path(args.out) if args.out else _default_out_path(doc.meta.binder_title, doc.meta.family_office_name)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    doc_type: Optional[DocType] = args.doc_type or doc.meta.doc_type
    watermark = args.watermark
    if watermark is None and args.watermark_default:
        watermark = doc.meta.confidentiality or "CONFIDENTIAL"

    generate_policy_binder_pdf(
        doc=doc,
        output_path=str(out_path),
        watermark_text=watermark,
        doc_type=doc_type,
    )
    print(str(out_path))

    if args.open:
        _open_file(out_path)

    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    validate_binder_json(args.input)
    print("OK")
    return 0


def cmd_init(args: argparse.Namespace) -> int:
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    dump_template_json(str(out))
    print(str(out))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="fo-binder",
        description="Family Office Operating Agreement / Policy Binder PDF generator (professional format).",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("generate", help="Generate a PDF from a binder JSON input.")
    g.add_argument("-i", "--input", required=True, help="Path to binder JSON input.")
    g.add_argument("-o", "--out", required=False, help="Output PDF path (default: ./binder_gen/out/<slug>-<date>.pdf).")
    g.add_argument("--open", action="store_true", help="Open the generated PDF after creation.")

    g.add_argument("--doc-type", choices=["operating_agreement", "policy_binder"], help="Document template type.")
    g.add_argument("--watermark", required=False, help='Watermark text for every page (e.g., "CONFIDENTIAL").')
    g.add_argument(
        "--watermark-default",
        action="store_true",
        help="Use meta.confidentiality as the watermark (if --watermark not provided).",
    )
    g.set_defaults(func=cmd_generate)

    v = sub.add_parser("validate", help="Validate binder JSON input (no PDF output).")
    v.add_argument("-i", "--input", required=True, help="Path to binder JSON input.")
    v.set_defaults(func=cmd_validate)

    init = sub.add_parser("init", help="Write a starter binder JSON template.")
    init.add_argument("-o", "--output", required=True, help="Path for the template JSON file to write.")
    init.set_defaults(func=cmd_init)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())




