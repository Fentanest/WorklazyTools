import re

with open("src/i18n/guideData.ts", "r", encoding="utf-8") as f:
    content = f.read()

new_func = """
export function getFaqsForPath(language: AppLanguage, slug: string, path: string): { question: string, answer: string }[] {
  const guideKey = toolToGuideKey[slug] || slug;
  const guide = getGuideData(language, guideKey);
  const faqIds = guide.pathFaqs?.[path];
  
  if (faqIds && faqIds.length > 0) {
    return faqIds.map(id => {
      const f = guide.faq[id];
      if (!f) throw new Error(`Missing FAQ ID '${id}' for path '${path}' in guide '${guideKey}' (${language})`);
      return { question: f.q, answer: f.a };
    });
  }
  
  return Object.values(guide.faq).map(item => ({ question: item.q, answer: item.a }));
}
"""

content = re.sub(
    r'export function getFaqsForPath[\s\S]*?\}\s*\}',
    new_func.strip(),
    content
)

with open("src/i18n/guideData.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("guideData.ts patched")
