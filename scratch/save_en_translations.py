import json

en_pages = {
  "about": "Get small, repetitive tasks done easily\n\nWorklazy Tools is a collection of tools designed to handle repetitive tasks directly in your browser, such as merging files, comparing content, and organizing materials for sharing. We focus on reducing the hassle of switching between multiple programs for simple tasks.\n\nIt does not replace all the features of professional editing software. Each tool indicates the supported file types and the extent of preservation, providing previews so you can verify the results yourself. Editors for formats like HWP and Office utilize open-source editing components, and the components used along with their notices can be found on the license page."
}
with open("scratch/en_pages.json", "w", encoding="utf-8") as f:
    json.dump(en_pages, f, ensure_ascii=False, indent=2)
