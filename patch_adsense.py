import re

with open("src/components/AdSenseLoader.tsx", "r", encoding="utf-8") as f:
    content = f.read()

effect = """
  useEffect(() => {
    if (!import.meta.env.PROD || isLocalQaBuild || consent !== "granted" || ineligible || isAdIneligible() || document.querySelector("script[data-worklazy-adsense]")) return;
    const script = document.createElement("script");
"""

content = re.sub(
    r'useEffect\(\(\) => \{\s*if \(\!import\.meta\.env\.PROD \|\| isLocalQaBuild \|\| consent \!\=\= "granted" \|\| ineligible \|\| document\.querySelector\("script\[data-worklazy-adsense\]"\)\) return;\s*const script = document\.createElement\("script"\);',
    effect.strip(),
    content
)

with open("src/components/AdSenseLoader.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("AdSenseLoader patched")
