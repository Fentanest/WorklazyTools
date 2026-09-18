import json

with open("/home/better0101/.gemini/antigravity/brain/fb05f606-fbec-4677-9ea4-0b98e3551f6b/.system_generated/logs/transcript_full.jsonl", "r", encoding="utf-8") as f:
    for line in f:
        data = json.loads(line)
        if data.get("type") == "SYSTEM_MESSAGE" and "### 1. `scratch/en_pages.json`" in data.get("content", ""):
            content = data["content"]
            blocks = content.split("```json")
            en_pages = blocks[1].split("```")[0].strip()
            en_paths = blocks[2].split("```")[0].strip()
            en_tools = blocks[3].split("```")[0].strip()
            
            with open("scratch/en_pages.json", "w") as out: out.write(en_pages)
            with open("scratch/en_paths.json", "w") as out: out.write(en_paths)
            with open("scratch/en_tools.json", "w") as out: out.write(en_tools)
            print("Extracted!")
            break
