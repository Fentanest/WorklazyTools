import json
import re

def update_seo_ts():
    with open("scratch/full_seo_en.json", "r", encoding="utf-8") as f:
        seo_data = json.load(f)

    with open("src/app/seo.ts", "r", encoding="utf-8") as f:
        seo_ts = f.read()

    # Update englishPageSeo
    start_idx = seo_ts.find('const englishPageSeo:')
    end_idx = seo_ts.find('};', start_idx) + 1
    
    seo_block = seo_ts[start_idx:end_idx]
    
    for path, data in seo_data.items():
        if "/" not in path:
            continue # We only update subpaths in englishPageSeo
        
        key = f'"/tools/{path}"'
        
        key_idx = seo_block.find(key + ": {")
        if key_idx == -1:
            key_idx = seo_block.find(key + ":\n")
            if key_idx == -1:
                key_idx = seo_block.find(key + ":{")
                if key_idx == -1:
                    continue
        
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
        
        sub_block = re.sub(r'(title:\s*")[^"]*(")', rf'\g<1>{data["title"]}\g<2>', sub_block, count=1)
        sub_block = re.sub(r'(description:\s*")[^"]*(")', rf'\g<1>{data["description"]}\g<2>', sub_block, count=1)
        sub_block = re.sub(r'(name:\s*")[^"]*(")', rf'\g<1>{data["menu"]}\g<2>', sub_block, count=1)
        
        seo_block = seo_block[:key_idx] + sub_block + seo_block[block_end:]
        
    seo_ts = seo_ts[:start_idx] + seo_block + seo_ts[end_idx:]
    
    # Update englishToolTitles
    start_idx2 = seo_ts.find('const englishToolTitles:')
    end_idx2 = seo_ts.find('};', start_idx2) + 1
    
    seo_block2 = seo_ts[start_idx2:end_idx2]
    
    for path, data in seo_data.items():
        if "/" in path:
            continue # We only update main paths in englishToolTitles
            
        key = f'"{path}"'
        
        # Format is "excel-merger": "Excel Merger | Combine Excel & CSV Files",
        pattern = rf'({key}:\s*")[^"]*(")'
        seo_block2 = re.sub(pattern, rf'\g<1>{data["title"]}\g<2>', seo_block2)
        
    seo_ts = seo_ts[:start_idx2] + seo_block2 + seo_ts[end_idx2:]

    with open("src/app/seo.ts", "w", encoding="utf-8") as f:
        f.write(seo_ts)
    print("Updated seo.ts for English")

if __name__ == "__main__":
    update_seo_ts()
