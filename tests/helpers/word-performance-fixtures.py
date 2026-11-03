"""Deterministic local R30 inputs. Never substitutes for the missing 50-pair corpus."""
from pathlib import Path
import argparse
import hashlib
import json
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument("output", type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
mc = "http://schemas.openxmlformats.org/markup-compatibility/2006"
w14 = "http://schemas.microsoft.com/office/word/2010/wordml"
manifest = []
for name, paragraphs, runs in [("small", 20, 4), ("medium", 300, 6), ("large", 1800, 8), ("qname", 900, 8)]:
    paths = []
    for side in ["before", "after"]:
        body = []
        for i in range(paragraphs):
            content = []
            for j in range(runs):
                text = f"Clause {i} word {j} 한글 내용"
                if side == "after" and i % 137 == 0 and j == 0:
                    text += " revised"
                content.append('<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="맑은 고딕"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">' + text + ' </w:t></w:r>')
            own = f' xmlns:w14="{w14}" mc:Ignorable="w14"' if name == "qname" else ""
            body.append('<w:p' + own + '><w:pPr><w:spacing w:after="120"/></w:pPr>' + ''.join(content) + '</w:p>')
        root = f'<w:document xmlns:w="{word}" xmlns:mc="{mc}"'
        if name != "qname":
            root += f' xmlns:w14="{w14}" mc:Ignorable="w14"'
        xml = root + '><w:body>' + ''.join(body) + '<w:sectPr/></w:body></w:document>'
        parts = {
            "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
            "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
            "word/document.xml": xml,
        }
        target = args.output / f"{name}-{side}.docx"
        with zipfile.ZipFile(target, "w") as archive:
            for part, data in parts.items():
                info = zipfile.ZipInfo(part, date_time=(2026, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, data)
        paths.append(str(target.resolve()))
    manifest.append({"id": name, "kind": "synthetic", "paragraphs": paragraphs, "runsPerParagraph": runs, "before": paths[0], "after": paths[1]})
root = Path(__file__).resolve().parents[2]
for name in ["base", "exact", "split", "formatting", "boundary", "revisions"]:
    manifest.append({"id": name, "kind": "repository-fixture", **{side: str(root / 'tests/fixtures/document-compare/oracle' / f'{name}-{side}.docx') for side in ['before', 'after']}})
for row in manifest:
    row["sha256"] = {side: hashlib.sha256(Path(row[side]).read_bytes()).hexdigest() for side in ["before", "after"]}
(args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print(args.output / "manifest.json")
