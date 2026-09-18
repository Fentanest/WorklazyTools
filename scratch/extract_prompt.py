import json

with open("/home/better0101/.gemini/antigravity/brain/fb05f606-fbec-4677-9ea4-0b98e3551f6b/.system_generated/logs/transcript_full.jsonl", "r", encoding="utf-8") as f:
    for line in f:
        data = json.loads(line)
        if data.get("type") == "USER_INPUT" and "WorklazyTools 콘텐츠 보강안" in data.get("content", ""):
            # We found the user request!
            with open("scratch/full_plan.md", "w", encoding="utf-8") as out:
                out.write(data["content"])
            print("Extracted to scratch/full_plan.md")
