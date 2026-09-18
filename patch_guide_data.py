with open("src/i18n/guideData.ts", "r", encoding="utf-8") as f:
    content = f.read()

faq_logic = """
export function getFaqsForPath(language: AppLanguage, slug: string, path: string): { question: string, answer: string }[] {
  try {
    const guideKey = toolToGuideKey[slug] || slug;
    const guide = getGuideData(language, guideKey);
    const faqIds = guide.pathFaqs?.[path];
    
    if (faqIds && faqIds.length > 0) {
      return faqIds.map(id => {
        const f = guide.faq[id];
        return f ? { question: f.q, answer: f.a } : null;
      }).filter(Boolean) as { question: string, answer: string }[];
    }
    
    return Object.values(guide.faq).map(item => ({ question: item.q, answer: item.a }));
  } catch {
    return [];
  }
}
"""

import re
content = re.sub(
    r'export function getFaqsForPath.*?catch {\n\s*return \[\];\n\s*}\n}',
    faq_logic.strip(),
    content,
    flags=re.DOTALL
)

with open("src/i18n/guideData.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("guideData patched")
