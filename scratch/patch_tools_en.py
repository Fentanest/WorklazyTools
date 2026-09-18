import json

def update_tools_json():
    with open("scratch/full_seo_en.json", "r", encoding="utf-8") as f:
        seo_data = json.load(f)

    with open("src/locales/en/tools.json", "r", encoding="utf-8") as f:
        tools = json.load(f)

    path_to_id = {
        "excel-merger": "excel-merger", "excel-compare": "excel-compare", "excel-cleaner": "excel-cleaner",
        "document-generator": "document-generator", "document-compare": "document-compare", "pdf-compare": "pdf-compare",
        "pdf-editor": "pdf-editor", "hwp-editor": "hwp-editor", "office-editor": "office-editor",
        "video-studio": "video-studio", "audio-studio": "audio-studio", "image-studio": "image-studio",
        "text-merger": "text-merger", "text-tools": "text-tools", "text-formatter": "text-formatter",
        "work-calculator": "work-calculator", "timezone-calculator": "timezone-calculator", "payroll-calculator": "payroll-calculator",
        "document-redactor": "document-redactor", "image-privacy": "image-privacy", "security-tools": "security-tools",
        "qr-studio": "qr-studio", "data-converter": "data-converter"
    }

    for path, data in seo_data.items():
        if path in path_to_id:
            tool_id = path_to_id[path]
            if tool_id in tools.get("items", {}):
                tools["items"][tool_id]["title"] = data["h1"]
                tools["items"][tool_id]["shortTitle"] = data["menu"]
                tools["items"][tool_id]["description"] = data["description"]

    with open("src/locales/en/tools.json", "w", encoding="utf-8") as f:
        json.dump(tools, f, ensure_ascii=False, indent=2)
    print("Updated en/tools.json")

if __name__ == "__main__":
    update_tools_json()
