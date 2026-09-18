import re
with open("scratch/content_plan.md", "r", encoding="utf-8") as f:
    content = f.read()

path_section = content.split("5. 실제 세부 경로별 고유 문구")[1].split("6. 공통 페이지별 추가 문구")[0]

blocks = path_section.split("경로: ")[1:]
for b in blocks:
    lines = b.strip().split("\n")
    path = lines[0].strip()
    title = lines[1].strip()
    paragraphs = []
    for line in lines[2:]:
        if line.startswith("편집 확인:"):
            continue
        if line.strip():
            paragraphs.append(line.strip())
    print(f"Path: {path}")
    print(f"Title: {title}")
    print(f"Paragraphs: {paragraphs}")
    print("---")
