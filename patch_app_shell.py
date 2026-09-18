import re

with open("src/components/AppShell.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import_statement = 'import { setAdIneligible } from "../app/adEligibility";\n'
content = content.replace('import { AdSenseLoader } from "./AdSenseLoader";', 'import { AdSenseLoader } from "./AdSenseLoader";\n' + import_statement)

effect = """
  const [focusMode, setFocusMode] = useState<"default" | "editor">("default");
  useEffect(() => {
    setAdIneligible("focusMode", focusMode === "editor");
  }, [focusMode]);
"""
content = re.sub(
    r'const \[focusMode, setFocusMode\] = useState<"default" \| "editor">\("default"\);',
    effect.strip(),
    content
)

# For DocumentCompareResult, we can check the path inside AppShell
path_effect = """
  const location = useLocation();
  useEffect(() => {
    const isResult = location.pathname.includes("/tools/document-compare/results");
    setAdIneligible("noContentResult", isResult);
  }, [location.pathname]);
"""
content = re.sub(
    r'const location = useLocation\(\);',
    path_effect.strip(),
    content,
    count=1
)

with open("src/components/AppShell.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("AppShell patched")
