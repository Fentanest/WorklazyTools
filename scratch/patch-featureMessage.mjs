import fs from "fs";

let content = fs.readFileSync("src/i18n/featureMessages.ts", "utf-8");

const fallbackHelper = `
export function featureMessageOrDefault(language: AppLanguage, key: string, values: FeatureMessageValues | null | undefined, defaultValue: string) {
  const template = featureResource<unknown>(language, key);
  if (typeof template !== "string") return defaultValue;
  return featureMessage(language, key, values || {});
}
`;

content = content.replace("export function featureResource", fallbackHelper + "\nexport function featureResource");
fs.writeFileSync("src/i18n/featureMessages.ts", content);

