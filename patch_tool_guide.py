import re

with open("src/components/ToolGuideWrapper.tsx", "r", encoding="utf-8") as f:
    content = f.read()

correct_order = """
  let path = location.pathname.replace(new RegExp(`^/(${i18n.language}|en|ko)`), "");
  if (!path) path = "/";
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  const pathFaqs = data.pathFaqs?.[path];
  const faqs = pathFaqs && pathFaqs.length > 0
    ? pathFaqs.map(id => data.faq[id]).filter(Boolean).map(item => ({ question: item.q, answer: item.a }))
    : Object.values(data.faq).map(item => ({ question: item.q, answer: item.a }));
"""

content = re.sub(
    r'const pathFaqs = data\.pathFaqs\?\.\[path\];[\s\S]*?let path = location\.pathname\.replace[^;]*;\s*if \(\!path\) path = "/";\s*if \(\!path\.startsWith\("/"\)\) path = "/" \+ path;',
    correct_order.strip(),
    content
)

with open("src/components/ToolGuideWrapper.tsx", "w", encoding="utf-8") as f:
    f.write(content)
