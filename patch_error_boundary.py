import re

with open("src/components/RouteErrorBoundary.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import_statement = 'import { setAdIneligible } from "../app/adEligibility";\n'

# Find imports and add
content = content.replace('import { Button } from "./ui/button";', 'import { Button } from "./ui/button";\n' + import_statement)

# Inside RouteFailure
route_failure = """
function RouteFailure() {
  const { t } = useTranslation("common");
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    notice.current?.focus();
    setAdIneligible("routeError", true);
    return () => setAdIneligible("routeError", false);
  }, []);
"""
content = re.sub(
    r'function RouteFailure\(\) \{\s*const \{ t \} = useTranslation\("common"\);\s*const notice = useRef<HTMLDivElement>\(null\);\s*useEffect\(\(\) => \{ notice\.current\?\.focus\(\); \}, \[\]\);',
    route_failure.strip(),
    content
)

with open("src/components/RouteErrorBoundary.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("RouteErrorBoundary patched")
