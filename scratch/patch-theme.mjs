import fs from "fs";

let content = fs.readFileSync("src/theme.ts", "utf-8");

const hookCode = `
import { useState, useEffect } from "react";
export function useAppliedTheme(): WorklazyTheme {
  const [theme, setTheme] = useState(readAppliedTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readAppliedTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export function getSemanticColors() {
  const style = getComputedStyle(document.documentElement);
  // Default to primary if not found
  const primaryRaw = style.getPropertyValue("--primary").trim() || "250 84% 54%";
  return {
    wave: \`hsl(\${primaryRaw} / 0.4)\`,
    progress: \`hsl(\${primaryRaw})\`,
    region: \`hsl(\${primaryRaw} / 0.22)\`,
    cursor: \`hsl(var(--destructive, 348 100% 61%))\`,
  };
}
`;

if (!content.includes("useAppliedTheme")) {
  content += "\n" + hookCode;
  fs.writeFileSync("src/theme.ts", content);
}
