// Optional recollection profile; ordinary audit registrations and gates stay intact.
// Syntax: light-coral|ko|desktop (one complete 4 x 2 x 2 run uses 16 profiles).
export function applyAccessibilityProfile(target, profile) {
  if (!profile) return target;
  const match = /^(light|dark)-(coral|mint)\|(ko|en)\|(desktop|mobile)$/.exec(profile);
  if (!match) throw new Error(`Invalid A11Y_PROFILE: ${profile}.`);
  const [, scheme, family, language, viewport] = match;
  const route = target.path.replace(/^\/(ko|en)(?=\/|$)/, "");
  return {
    ...target,
    path: `/${language}${route === "/" ? "" : route}`,
    language,
    locale: language === "ko" ? "ko-KR" : "en-US",
    colorScheme: scheme,
    theme: family === "coral" ? scheme : `${scheme}-mint`,
    viewport: viewport === "mobile" ? { width: 412, height: 839 } : undefined,
    // The same vendor frame is localized in English. Do not enlarge its exception.
    ...(target.id === "hwp-editor" ? { readySelector: `iframe[title="${language === "ko" ? "rhwp HWP 문서 편집기" : "rhwp HWP document editor"}"]` } : {}),
  };
}
