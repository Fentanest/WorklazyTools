import json
import re

with open("scratch/content_plan.md", "r", encoding="utf-8") as f:
    content = f.read()

tools_split = re.split(r'\n(?=\d{2}\. )', content)
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

    # Parse sections
    # Sections: 게시용 추가 원고, 예제·선택 도움, FAQ 추가·교체안, 반영 전 확인
    current_section = None
    sections = {"게시용 추가 원고": [], "예제·선택 도움": [], "FAQ 추가·교체안": []}
    
    for line in lines:
        line_s = line.strip()
        if line_s in sections.keys() or line_s.startswith("반영 전 확인:"):
            current_section = line_s if line_s in sections else "반영 전 확인"
            continue
        
        if current_section and current_section in sections:
            sections[current_section].append(line_s)
            
    # Clean up sections
    for k in sections:
        sections[k] = "\n".join(sections[k]).strip()
        
    parsed_tools[guide_key] = {
        "name": tool_name,
        "blocks": sections["게시용 추가 원고"],
        "examples": sections["예제·선택 도움"],
        "faqs": sections["FAQ 추가·교체안"]
    }

# Let's print the first tool to check
first_key = list(parsed_tools.keys())[0]
print(json.dumps({first_key: parsed_tools[first_key]}, ensure_ascii=False, indent=2))
