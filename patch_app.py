import re

with open("src/app/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

if 'import { setAdIneligible } from "./adEligibility";' not in content:
    imports = 'import { ToolReady } from "../components/RouteErrorBoundary";\nimport { setAdIneligible } from "./adEligibility";'
    content = content.replace('import { ToolReady } from "../components/RouteErrorBoundary";', imports)

loading_component = """
function ToolRouteLoading({ tool }: { tool: string }) {
  const { t } = useTranslation("common");
  useLayoutEffect(() => {
    setAdIneligible("routePending", true);
    return () => setAdIneligible("routePending", false);
  }, []);
  return <div className="page tool-page page-enter tool-route-loading min-h-screen" role="status">{t("status.loadingTool", { tool })}</div>;
}

function PdfRoute(props: PdfRouteProps) {
"""

if "function ToolRouteLoading" not in content:
    content = re.sub(r'function PdfRoute\(props: PdfRouteProps\) \{', loading_component.strip() + '\n', content)

def replacer(m):
    tool_name = re.search(r'tool: "([^"]+)"', m.group(0)).group(1)
    return f'<Suspense fallback={{<ToolRouteLoading tool="{tool_name}" />}}>'

content = re.sub(
    r'<Suspense fallback=\{<div className="page tool-page page-enter tool-route-loading min-h-screen" role="status">\{t\("status\.loadingTool", \{ tool: "[^"]+" \}\)\}</div>\}>',
    replacer,
    content
)

content = re.sub(
    r'<Suspense fallback=\{<div className="page tool-page page-enter tool-route-loading min-h-screen" role="status">\{t\("status\.loadingTool", \{ tool: label \}\)\}</div>\}>',
    '<Suspense fallback={<ToolRouteLoading tool={label} />}>',
    content
)

with open("src/app/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("App.tsx patched")
