import fs from "fs";

let content = fs.readFileSync("src/features/audio-studio/AudioStudioPage.tsx", "utf-8");

content = content.replace(
  '        color: "rgba(139, 92, 246, 0.22)",',
  '        color: getSemanticColors().region,'
);
content = content.replace(
  '      color: "rgba(139, 92, 246, 0.22)",',
  '      color: getSemanticColors().region,'
);

fs.writeFileSync("src/features/audio-studio/AudioStudioPage.tsx", content);
