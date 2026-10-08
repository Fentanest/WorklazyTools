"""Optional QA fixture regeneration with the exact PyMuPDF 1.26.3 engine.

The checked-in encrypted PDF is ready for tests without Python installation.
Run this script in a Python environment with PyMuPDF==1.26.3 to regenerate it.
AES-256 uses random salt, so compare behavior/page count rather than byte hash.
"""
from pathlib import Path

import pymupdf

if pymupdf.VersionBind != "1.26.3":
    raise RuntimeError(f"Expected PyMuPDF 1.26.3, got {pymupdf.VersionBind}")

root = Path(__file__).resolve().parent.parent
source = root / "tests/fixtures/document-converters/rich.pdf"
target = root / "tests/fixtures/document-conversion-engines/restricted-rich.pdf"
with pymupdf.open(source) as document:
    document.save(
        target,
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        owner_pw="test-owner",
        user_pw="",
        permissions=pymupdf.PDF_PERM_PRINT,
    )
