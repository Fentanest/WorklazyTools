import re

with open("scripts/generate-static-pages.mjs", "r", encoding="utf-8") as f:
    content = f.read()

new_func = """
  let blocks = [];
  const slug = toolSlugByPath[pathname] || Object.keys(toolSlugByPath).find(p => pathname.startsWith(p + "/")) && toolSlugByPath[Object.keys(toolSlugByPath).find(p => pathname.startsWith(p + "/"))];
  if (slug) {
    const guideKey = toolToGuideKey[slug] || slug;
    const guide = getGuideData(language, guideKey);
    blocks = [...(guide.blocks || []), ...(guide.pathBlocks?.[pathname] || [])];
  }
"""

content = re.sub(
    r'let blocks = \[\];\s*try \{[\s\S]*?\} catch \(e\) \{\s*// ignore\s*\}',
    new_func.strip(),
    content
)

with open("scripts/generate-static-pages.mjs", "w", encoding="utf-8") as f:
    f.write(content)

print("makePage patched")
