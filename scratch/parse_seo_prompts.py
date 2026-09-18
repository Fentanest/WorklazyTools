import re
import json

with open("scratch/integrated_prompt.txt", "r", encoding="utf-8") as f:
    content = f.read()

m = re.search(r"## 4\. 페이지별 편집 지시\n\n(.*?)(?=\n## |\Z)", content, re.DOTALL)
if not m:
    exit(1)

section4 = m.group(1)
blocks = re.split(r"\n### \d+\.\s+", "\n" + section4)
blocks = [b.strip() for b in blocks if b.strip()]

seo_data = {}
for block in blocks:
    path_m = re.search(r"- 기존 경로:\s*`([^`]+)`", block)
    if not path_m:
        continue
    path = path_m.group(1).replace("/ko/tools/", "").strip("/")
    
    data = {}
    lines = block.split("\n")
    for line in lines:
        if line.startswith("- 대표 후보:"):
            data["menu"] = line.split(":", 1)[1].strip().replace("**", "")
        elif line.startswith("- 제목 제안:"):
            data["title"] = line.split(":", 1)[1].strip()
        elif line.startswith("- 본문에서 답할 질문:"):
            data["h2"] = line.split(":", 1)[1].strip()
    seo_data[path] = data

with open("scratch/parsed_seo.json", "w", encoding="utf-8") as f:
    json.dump(seo_data, f, ensure_ascii=False, indent=2)
