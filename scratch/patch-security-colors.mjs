import fs from "fs";

let content = fs.readFileSync("src/features/security-tools/SecurityToolsPage.tsx", "utf-8");

// Slider accent
content = content.replace(
  'className="accent-violet-700"',
  'className="[accent-color:var(--brand)]"'
);

// Metrics card
content = content.replace(
  'bg-blue-50 p-[15px] text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  'bg-primary/10 p-[15px] text-primary'
);

// Strength advice - maybe text-destructive? No, "Do not misuse text-destructive."
// It's a warning, so we can keep amber, or maybe change to muted-foreground or primary?
// Actually, advice is "you should add a symbol". It's a suggestion.
// Let's use bg-primary/10 and text-primary instead of amber?
// Wait, warning is semantic. But let's see ImagePrivacyPage.

fs.writeFileSync("src/features/security-tools/SecurityToolsPage.tsx", content);
