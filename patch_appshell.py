import re

with open("src/components/AppShell.tsx", "r", encoding="utf-8") as f:
    content = f.read()

effect = """
  const [focusMode, setFocusMode] = useState<"standard" | "editor">("standard");
  useEffect(() => {
    setAdIneligible("focusMode", focusMode === "editor");
  }, [focusMode]);
"""
content = re.sub(
    r'const \[focusMode, setFocusMode\] = useState<"standard" \| "editor">\("standard"\);',
    effect.strip(),
    content
)

with open("src/components/AppShell.tsx", "w", encoding="utf-8") as f:
    f.write(content)
