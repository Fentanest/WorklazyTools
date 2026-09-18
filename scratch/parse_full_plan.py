import json
import re

with open("scratch/full_plan.md", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Parse Tool-specific blocks & faqs
tool_section = content.split("4. 도구별 추가 원고")[1].split("5. 실제 세부 경로별 고유 문구")[0]
tools_split = re.split(r'\n(?=\d{2}\. )', tool_section)

parsed_tools = {}

for tool in tools_split:
    lines = tool.strip().split('\n')
    if not re.match(r'^\d{2}\. ', lines[0]):
        continue
    
    tool_name = lines[0]
    guide_key = None
    
    for line in lines:
        if line.startswith("가이드 연결:"):
            guide_key = line.split(":", 1)[1].strip().split()[0]
            if guide_key == "pdfEditor.standard":
                guide_key = "pdfEditor"
            elif guide_key == "video.page":
                guide_key = "video"
            break
            
    if not guide_key:
        continue

    current_section = None
    sections = {"게시용 추가 원고": [], "예제·선택 도움": [], "FAQ 추가·교체안": []}
    
    for line in lines:
        line_s = line.strip()
        if line_s in sections.keys() or line_s.startswith("반영 전 확인:"):
            current_section = line_s if line_s in sections else "반영 전 확인"
            continue
        
        if current_section and current_section in sections:
            sections[current_section].append(line_s)
            
    for k in sections:
        sections[k] = "\n".join(sections[k]).strip()
        
    parsed_tools[guide_key] = {
        "name": tool_name,
        "blocks": sections["게시용 추가 원고"],
        "examples": sections["예제·선택 도움"],
        "faqs": sections["FAQ 추가·교체안"]
    }

# Write parsed tools
with open("scratch/parsed_tools.json", "w", encoding="utf-8") as f:
    json.dump(parsed_tools, f, ensure_ascii=False, indent=2)

# 2. Parse Path-specific blocks
path_section = content.split("5. 실제 세부 경로별 고유 문구")[1].split("6. 공통 페이지별 추가 문구")[0]
path_blocks = path_section.split("경로: ")[1:]
parsed_paths = {}

for b in path_blocks:
    lines = b.strip().split("\n")
    path = lines[0].strip()
    title = lines[1].strip()
    paragraphs = []
    for line in lines[2:]:
        if line.startswith("편집 확인:"):
            continue
        if line.strip():
            paragraphs.append(line.strip())
            
    # Some paths might map to the same tool slug, but we can just store them as pathBlocks for the tool
    # Wait, how do we know which guide it belongs to?
    # In guides.json, pathBlocks should just be inside the guide.
    # Let's map path to guide key using seo.ts
    parsed_paths[path] = {
        "title": title,
        "paragraphs": paragraphs
    }

with open("scratch/parsed_paths.json", "w", encoding="utf-8") as f:
    json.dump(parsed_paths, f, ensure_ascii=False, indent=2)

# 3. Parse Pages Updates
pages_section = content.split("6. 공통 페이지별 추가 문구")[1].split("7. 실제 반영 검증")[0]
page_blocks = pages_section.split("경로: ")[1:]
parsed_pages = {}

for p in page_blocks:
    lines = p.strip().split("\n")
    path = lines[0].strip()
    if path == "/about":
        text = "\n".join(lines[2:]).strip()
        parsed_pages["about"] = text

with open("scratch/parsed_pages.json", "w", encoding="utf-8") as f:
    json.dump(parsed_pages, f, ensure_ascii=False, indent=2)

print("Parsed successfully!")
