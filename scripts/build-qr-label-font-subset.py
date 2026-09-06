#!/usr/bin/env python3
"""Rebuild the pinned QR-label font subset inputs.

Install the hash-pinned build tool into a temporary virtual environment first:
  python3 -m venv /tmp/worklazy-font-venv
  /tmp/worklazy-font-venv/bin/pip install --require-hashes -r scripts/requirements-fonts.txt
  /tmp/worklazy-font-venv/bin/python scripts/build-qr-label-font-subset.py

The script updates tracked compressed/metadata inputs only after every pinned
size, digest, cmap, glyph ID, metric and outline check succeeds.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import fontTools
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = "noto-cjk-sans-2.004-ksx1001-v1"
SOURCE_PATH = (
    PROJECT_ROOT
    / "public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf"
)
INPUT_ROOT = PROJECT_ROOT / "scripts/assets/qr-label-font" / SNAPSHOT
UNICODES_PATH = INPUT_ROOT / "unicodes-alias.txt"
REQUIREMENTS_PATH = PROJECT_ROOT / "scripts/requirements-fonts.txt"
FONT_NAME = "NotoSansKR-Regular.ksx1001.otf"
FONTTOOLS_VERSION = "4.59.2"
FONTTOOLS_WHEEL = (
    "fonttools-4.59.2-cp312-cp312-manylinux1_x86_64.manylinux2014_x86_64."
    "manylinux_2_17_x86_64.manylinux_2_5_x86_64.whl"
)
FONTTOOLS_WHEEL_SHA256 = (
    "738f31f23e0339785fd67652a94bc69ea49e413dfdb14dcb8c8ff383d249464e"
)
SOURCE_SHA256 = "69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68"
UNICODES_SHA256 = "ac8fefb54a969022fc1b139a3a7a1937f711e71280fb992683eb0d4d43978b0c"
EXPECTED = {
    "unicodes-alias.txt": (23_757, UNICODES_SHA256),
    FONT_NAME: (931_704, "b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be"),
    f"{FONT_NAME}.gz": (561_161, "e1db3cdcbb8d76fc0546ec582bed773b3b7ef3da60867b6828493a6b342c7e66"),
    "coverage.json": (19_686, "58f248442d4e8e5726559644a746740bd0066cebabf154956e0bb7e1458eafea"),
    "coverage.schema.json": (444, "919d01b6713b3438f6cd36091d3244a04a28822b031a5cdd7ac135ff3d17e6b0"),
    "provenance.json": (1_201, "30e10e1815835b8076a100ecdc9804c2613b115b555cbcc0b122150b92f77667"),
}
SUBSET_OPTIONS = [
    "--layout-features=*",
    "--name-IDs=*",
    "--name-languages=*",
    "--name-legacy",
    "--notdef-glyph",
    "--notdef-outline",
    "--no-recalc-timestamp",
    "--retain-gids",
]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def metadata(path: Path) -> dict[str, int | str]:
    data = path.read_bytes()
    return {"size": len(data), "sha256": sha256(data)}


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def verify_bytes(name: str, data: bytes) -> None:
    expected_size, expected_sha = EXPECTED[name]
    actual = (len(data), sha256(data))
    if actual != (expected_size, expected_sha):
        raise RuntimeError(
            f"Pinned QR font output mismatch for {name}: "
            f"size={actual[0]} sha256={actual[1]}"
        )


def read_codepoints() -> list[int]:
    raw = UNICODES_PATH.read_bytes()
    verify_bytes(UNICODES_PATH.name, raw)
    if raw.endswith(b"\n"):
        raise RuntimeError("unicodes-alias.txt must not end with a newline")
    values = [int(item.removeprefix("U+"), 16) for item in raw.decode("ascii").split(",")]
    if len(values) != 3_394 or values != sorted(set(values)) or 0x2026 not in values:
        raise RuntimeError("Invalid pinned QR font Unicode list")
    return values


def verify_glyphs(source: TTFont, subset: TTFont, codepoints: list[int]) -> None:
    source_cmap = source.getBestCmap()
    subset_cmap = subset.getBestCmap()
    if sorted(subset_cmap) != codepoints:
        raise RuntimeError("Subset cmap does not exactly match the pinned Unicode list")
    source_glyphs = source.getGlyphSet()
    subset_glyphs = subset.getGlyphSet()
    differences: list[int] = []
    for codepoint in codepoints:
        source_name = source_cmap[codepoint]
        subset_name = subset_cmap[codepoint]
        source_pen = RecordingPen()
        subset_pen = RecordingPen()
        source_glyphs[source_name].draw(source_pen)
        subset_glyphs[subset_name].draw(subset_pen)
        if (
            source.getGlyphID(source_name) != subset.getGlyphID(subset_name)
            or source["hmtx"][source_name] != subset["hmtx"][subset_name]
            or source_pen.value != subset_pen.value
        ):
            differences.append(codepoint)
    if differences:
        raise RuntimeError(f"Subset glyph invariance failed for {len(differences)} codepoints")


def main() -> None:
    requirements = REQUIREMENTS_PATH.read_text(encoding="utf8")
    expected_requirement = (
        f"fonttools=={FONTTOOLS_VERSION} --hash=sha256:{FONTTOOLS_WHEEL_SHA256}\n"
    )
    if requirements != expected_requirement:
        raise RuntimeError("scripts/requirements-fonts.txt no longer matches the pinned tool")
    if fontTools.__version__ != FONTTOOLS_VERSION:
        raise RuntimeError(
            f"fonttools {FONTTOOLS_VERSION} is required; found {fontTools.__version__}"
        )
    if shutil.which("gzip") is None:
        raise RuntimeError("GNU gzip 1.12 is required")
    gzip_version = subprocess.check_output(["gzip", "--version"], text=True).splitlines()[0]
    if gzip_version != "gzip 1.12":
        raise RuntimeError(f"GNU gzip 1.12 is required; found {gzip_version}")

    source_bytes = SOURCE_PATH.read_bytes()
    if len(source_bytes) != 4_644_748 or sha256(source_bytes) != SOURCE_SHA256:
        raise RuntimeError("Pinned full QR label font is missing or changed")
    codepoints = read_codepoints()

    INPUT_ROOT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".qr-font-build-", dir=INPUT_ROOT.parent) as temporary:
        stage = Path(temporary)
        subset_path = stage / FONT_NAME
        command = [
            sys.executable,
            "-m",
            "fontTools.subset",
            str(SOURCE_PATH),
            f"--unicodes-file={UNICODES_PATH}",
            f"--output-file={subset_path}",
            *SUBSET_OPTIONS,
        ]
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            raise RuntimeError(f"fontTools subset failed:\n{result.stderr}")
        verify_bytes(FONT_NAME, subset_path.read_bytes())

        source_font = TTFont(SOURCE_PATH)
        subset_font = TTFont(subset_path)
        try:
            verify_glyphs(source_font, subset_font, codepoints)
        finally:
            source_font.close()
            subset_font.close()

        gzip_path = stage / f"{FONT_NAME}.gz"
        with gzip_path.open("wb") as output:
            gzip_result = subprocess.run(
                ["gzip", "-n", "-9", "-c", str(subset_path)],
                stdout=output,
                stderr=subprocess.PIPE,
                check=False,
            )
        if gzip_result.returncode != 0:
            raise RuntimeError(f"gzip failed: {gzip_result.stderr.decode(errors='replace')}")
        verify_bytes(gzip_path.name, gzip_path.read_bytes())

        coverage_path = stage / "coverage.json"
        coverage_path.write_bytes(json_bytes({
            "schema": 1,
            "snapshot": SNAPSHOT,
            "codepoints": codepoints,
        }))
        verify_bytes(coverage_path.name, coverage_path.read_bytes())

        schema_path = stage / "coverage.schema.json"
        schema_path.write_bytes(json_bytes({
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "additionalProperties": False,
            "required": ["schema", "snapshot", "codepoints"],
            "properties": {
                "schema": {"const": 1},
                "snapshot": {"const": SNAPSHOT},
                "codepoints": {
                    "type": "array",
                    "minItems": 3_394,
                    "maxItems": 3_394,
                    "uniqueItems": True,
                    "items": {
                        "type": "integer",
                        "minimum": 0,
                        "maximum": 1_114_111,
                        "not": {"minimum": 55_296, "maximum": 57_343},
                    },
                    "contains": {"const": 8_230},
                },
            },
        }))
        verify_bytes(schema_path.name, schema_path.read_bytes())

        provenance_path = stage / "provenance.json"
        provenance_path.write_bytes(json_bytes({
            "schema": 1,
            "snapshot": SNAPSHOT,
            "source": {
                "snapshot": "noto-cjk-sans-2.004",
                "name": "NotoSansKR-Regular.otf",
                "size": len(source_bytes),
                "sha256": sha256(source_bytes),
            },
            "fonttools": {
                "version": FONTTOOLS_VERSION,
                "wheel": FONTTOOLS_WHEEL,
                "sha256": FONTTOOLS_WHEEL_SHA256,
            },
            "unicodes": {"name": UNICODES_PATH.name, **metadata(UNICODES_PATH)},
            "options": SUBSET_OPTIONS,
            "compression": {
                "command": ["gzip", "-n", "-9", "-c"],
                "implementation": gzip_version,
            },
            "outputs": {
                name: metadata(stage / name)
                for name in (FONT_NAME, f"{FONT_NAME}.gz", "coverage.json")
            },
        }))
        verify_bytes(provenance_path.name, provenance_path.read_bytes())

        INPUT_ROOT.mkdir(parents=True, exist_ok=True)
        for name in (
            f"{FONT_NAME}.gz",
            "coverage.json",
            "coverage.schema.json",
            "provenance.json",
        ):
            os.replace(stage / name, INPUT_ROOT / name)

    print(
        "QR label font subset reproduced: "
        "cmap=3394 size=931704 gzip=561161 glyph-differences=0"
    )


if __name__ == "__main__":
    main()
