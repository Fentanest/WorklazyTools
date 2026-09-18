import json
import re

def update_seo_ts():
    with open("scratch/full_seo_ko.json", "r", encoding="utf-8") as f:
        seo_data = json.load(f)

    with open("src/app/seo.ts", "r", encoding="utf-8") as f:
        seo_ts = f.read()

    # Find the start and end of seoByPath
    start_idx = seo_ts.find('export const seoByPath:')
    end_idx = seo_ts.find('};', start_idx) + 1
    
    seo_block = seo_ts[start_idx:end_idx]
    
    for path, data in seo_data.items():
        key = f'"/tools/{path}"' if not path.startswith("/") else f'"{path}"'
        
        # We need to find the specific block for this key inside seo_block
        # It looks like: "/tools/excel-merger": { \n title: "...", \n description: "..."
        # We can use re.sub on the whole block, but we must be careful not to replace other keys.
        # Let's find the start of the key's block
        key_idx = seo_block.find(key + ": {")
        if key_idx == -1:
            key_idx = seo_block.find(key + ":\n")
            if key_idx == -1:
                key_idx = seo_block.find(key + ":{")
                if key_idx == -1:
                    continue
        
        # Find the end of this key's block (matching brace)
        brace_count = 0
        block_end = -1
        for i in range(key_idx, len(seo_block)):
            if seo_block[i] == '{':
                brace_count += 1
            elif seo_block[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    block_end = i + 1
                    break
        
        if block_end == -1:
            continue
            
        sub_block = seo_block[key_idx:block_end]
        
        # Replace title
        sub_block = re.sub(r'(title:\s*")[^"]*(")', rf'\g<1>{data["title"]}\g<2>', sub_block, count=1)
        # Replace description
        sub_block = re.sub(r'(description:\s*")[^"]*(")', rf'\g<1>{data["description"]}\g<2>', sub_block, count=1)
        # Replace application name if exists
        sub_block = re.sub(r'(name:\s*")[^"]*(")', rf'\g<1>{data["menu"]}\g<2>', sub_block, count=1)
        
        seo_block = seo_block[:key_idx] + sub_block + seo_block[block_end:]
        
    new_seo_ts = seo_ts[:start_idx] + seo_block + seo_ts[end_idx:]
    with open("src/app/seo.ts", "w", encoding="utf-8") as f:
        f.write(new_seo_ts)
    print("Updated seo.ts")

if __name__ == "__main__":
    update_seo_ts()
