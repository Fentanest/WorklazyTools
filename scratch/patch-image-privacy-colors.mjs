import fs from "fs";

let content = fs.readFileSync("src/features/image-privacy/ImagePrivacyPage.tsx", "utf-8");

// Download button: blue -> primary
content = content.replace(
  'bg-blue-700 font-bold text-white hover:bg-blue-800',
  'bg-primary font-bold text-primary-foreground hover:bg-primary/90'
);

// Meta: pink -> primary
content = content.replace(
  'text-pink-600 dark:text-pink-300',
  'text-primary'
);

// Result (cleanTitle): it is semantic success, but maybe we should use UtilityNotice for it?
// The instructions don't explicitly say replace it, but "results, downloads, info" are mentioned in scope.
// Wait! If it's a semantic state (success), should it stay green? Yes, "Distinguish semantic state colors from decorative theme colors." means semantic colors should remain semantic (green for success, red/amber for warning), while decorative ones (pink, blue) should become theme-aware.
// So we keep green!

fs.writeFileSync("src/features/image-privacy/ImagePrivacyPage.tsx", content);
