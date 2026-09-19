import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { getGuideKeyForPath } from "../src/i18n/guideData.ts";
import { toolSlugByPath } from "../src/app/seo.ts";
import faqExpectations from "./static-faq-expectations.json" with { type: "json" };

export const removedProductionMemoTexts = Object.freeze([
  "카드 순서: 직접 입력 “1. 오전 회의” → 오전.txt → 직접 입력 “2. 오후 회의” → 오후.txt. 구분자 빈 줄을 선택한 결과를 보여준다.",
  "대구”는 항목 경계를 유지해야 하는 목록이다. 실제 결합 시 공백 처리 결과와 예문을 맞춘다.",
  "예시: 같은 날짜 범위를 두고 회사 휴무일 한 날을 추가했을 때 영업일 수가 어떻게 바뀌는지 보여준다. 실제 공휴일 날짜를 임의로 정해 사례에 쓰지 않는다.",
  "예시를 만들 때 실제 GPS 좌표·기기 소유자 이름을 쓰지 않는다. “보이는 정보/숨은 정보” 두 칸으로 구분해 도구 선택을 돕는다.",
  "예시 문장 형식: “서울: ○월 ○일 ○시 / 다른 도시: ○월 ○일 ○시”. 고정 시차 숫자 대신 실제 선택 결과가 들어가게 하며, 날짜가 다른 도시를 별도 표시한다.",
  "예시: 1월·2월 자료를 각 탭으로 남기면 시트별, 같은 열의 거래내역을 아래로 이어 붙이면 세로. 가로 병합은 두 자료의 행 순서가 같다는 전제에서 사용한다. 제목 행을 자동으로 한 번만 남긴다고 안내하지 않는다.",
  "예시: 가로 1600px 사진을 800px로 줄이기와, 사진은 유지하고 정사각 캔버스에 여백 넣기를 나란히 설명. 자동 크롭/배경제거 기능으로 오해시키지 않는다.",
  "예시: 회의 녹화에서 00:30~01:10을 남기는 경우. 빠른 복사와 다시 변환의 의미를 설명하되, 모든 파일에서 정확히 같은 성능·품질 수치를 약속하지 않는다.",
  "Example: Prepare two DOCX files where the submission date of a notice is changed from \"October 1\" to \"October 5\" and only one cell in the department table is modified. On the result screen, you can distinctly check the changes made to the body text and the table structure.",
  "Example: The sentence \"Please check",
  "Example: Show how the number of business days changes when one company holiday is added to the same date range. Do not assign arbitrary dates to actual public holidays for use in examples.",
  "Do not use real GPS coordinates or device owner names when creating examples. Distinguish between \"visible information / hidden information\" in two columns to help users choose the right tool.",
  "Example: Leaving January and February data in separate tabs is merge by sheet; appending transaction details of the same columns downward is vertical merge. Horizontal merge assumes the row order of both datasets is identical. Do not state that the header row is automatically kept only once.",
  "Example: Deleting the middle 3 seconds of a 20-second recording reduces the total length, while muting the same part maintains the total length. Post after confirming with the actual implementation of selected section processing.",
  "Example: Explain shrinking a 1600px wide photo to 800px side-by-side with keeping the photo as is and adding margins to a square canvas. Do not mislead users into thinking it has automatic crop/background removal features.",
  "Example: \"Seoul \" and \"Seoul\" can become the same value after whitespace cleanup. However, if \"0012\" and \"12\" are product codes, they might be different values, so do not apply number conversion first.",
  "Example: If the original is 3 pages without a cover and the revision has 4 pages (a new cover + 3 body pages), you must link page 1 of the original to page 2 of the revision for an accurate comparison. If the structures differ, use the manual matching feature to align the pages correctly.",
  "Short status guide: \"Preparing editing environment — You can select a file in advance.\" / \"Preparation complete — Drop the file to edit.\" / \"Opening document\" / \"Downloaded the saved file.\" Connect the displays to the actual statuses.",
  "Example: Keeping 00:30~01:10 from a meeting recording. Explain the meaning of quick copy vs. re-conversion, but do not promise exact performance/quality numbers across all files.",
]);

const removedMemoSet = new Set(removedProductionMemoTexts);
const enMemoPatterns = [
  /^Example: (?:Show|Explain|Describe|Prepare)/,
  /Do not use real/i,
  /before publishing/i,
  /Show where/i,
  /composite value/i,
  /Connect the display/i,
  /fixture/i,
  /do not promise/i,
];
const koMemoPhrases = ["게시 전", "예시를 만들 때", "설명하되"];

const normalizeRoute = (route) => {
  const value = `/${String(route).replace(/^\/+|\/+$/g, "")}`;
  return value === "/" ? value : value.replace(/\/+$/, "");
};

function routeAttribute(node) {
  const attributes = ts.isJsxElement(node) ? node.openingElement.attributes.properties : node.attributes.properties;
  const pathAttribute = attributes.find((attribute) => (
    ts.isJsxAttribute(attribute) && ts.isIdentifier(attribute.name) && attribute.name.text === "path"
  ));
  return pathAttribute?.initializer && ts.isStringLiteral(pathAttribute.initializer)
    ? pathAttribute.initializer.text
    : undefined;
}

function isRouteNode(node) {
  const tagName = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
  return ts.isIdentifier(tagName) && tagName.text === "Route";
}

export function extractAppRoutes(source, fileName = "src/app/App.tsx") {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const routes = new Set();
  const join = (base, segment) => segment?.startsWith("/") ? segment : [base, segment].filter(Boolean).join("/");
  const visit = (node, base = "") => {
    if (ts.isJsxElement(node) && isRouteNode(node)) {
      const ownPath = routeAttribute(node);
      const nextBase = ownPath === undefined ? base : join(base, ownPath);
      if (ownPath !== undefined) routes.add(nextBase);
      node.children.forEach((child) => visit(child, nextBase));
      return;
    }
    if (ts.isJsxSelfClosingElement(node) && isRouteNode(node)) {
      const ownPath = routeAttribute(node);
      if (ownPath !== undefined) routes.add(join(base, ownPath));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, base));
  };
  visit(sourceFile);
  return [...routes]
    .map((route) => route.replace(/^\/?(?:\:lang\/)?/, "/"))
    .map(normalizeRoute)
    .filter((route) => route.startsWith("/tools/"))
    .sort();
}

function isMemo(lang, text) {
  if (removedMemoSet.has(text)) return true;
  if (lang === "ko") {
    if (koMemoPhrases.some((phrase) => text.includes(phrase))) return true;
    return /다\.$/.test(text) && !/니다\.$/.test(text);
  }
  return enMemoPatterns.some((pattern) => pattern.test(text));
}

function terminallyComplete(text) {
  const last = [...text.trim()].at(-1);
  return last !== undefined && ".!?。！？…'\"”’)]0123456789".includes(last);
}

function resolveSlug(route, slugByPath) {
  const candidates = Object.keys(slugByPath)
    .filter((root) => route === root || route.startsWith(`${root}/`))
    .sort((a, b) => b.length - a.length);
  return candidates.length ? slugByPath[candidates[0]] : undefined;
}

function resolvedFaqs(guides, slug, route) {
  const guide = guides[getGuideKeyForPath(slug, route)];
  if (!guide) return [];
  const ids = guide.pathFaqs?.[route];
  const entries = ids === undefined ? Object.values(guide.faq || {}) : ids.map((id) => guide.faq?.[id]).filter(Boolean);
  return entries.map((entry) => entry.q);
}

export function validateGuidesData({ guidesData, appRoutes, expectations = faqExpectations, slugByPath = toolSlugByPath }) {
  const errors = [];
  const routeSet = new Set(appRoutes.map(normalizeRoute));
  const addError = (message) => errors.push(message);
  const faqConnectionsByGuide = new Map();
  for (const [route, expectation] of Object.entries(expectations)) {
    const guideKey = getGuideKeyForPath(expectation.slug, route);
    const connections = faqConnectionsByGuide.get(guideKey) || [];
    connections.push({ route, slug: expectation.slug });
    faqConnectionsByGuide.set(guideKey, connections);
  }

  for (const lang of ["ko", "en"]) {
    const guides = guidesData[lang];
    const allTitles = new Set();
    for (const guide of Object.values(guides)) {
      for (const block of [...(guide.blocks || []), ...Object.values(guide.pathBlocks || {}).flat()]) {
        if (typeof block.title === "string") allTitles.add(block.title.trim());
      }
    }
    const inspectBlocks = (guideKey, blocks, context) => {
      for (const [index, block] of blocks.entries()) {
        if (context === "blocks" && (!block?.title || typeof block.title !== "string" || !block.title.trim())) addError(`[${lang}] Guide '${guideKey}' ${context}[${index}] missing 'title'`);
        if (typeof block?.title === "string" && isMemo(lang, block.title)) addError(`[${lang}] Guide '${guideKey}' contains production memo at ${context}[${index}].title`);
        const paragraphs = Array.isArray(block?.paragraphs) ? block.paragraphs : [];
        const items = Array.isArray(block?.items) ? block.items : [];
        [...paragraphs.map((text, i) => [`${context}[${index}].paragraphs[${i}]`, text]), ...items.map((text, i) => [`${context}[${index}].items[${i}]`, text])]
          .forEach(([location, text]) => {
            if (typeof text === "string" && isMemo(lang, text)) addError(`[${lang}] Guide '${guideKey}' contains production memo at ${location}`);
          });
        const last = paragraphs.at(-1)?.trim();
        if (last && ((Array.from(last).length < 40 && !terminallyComplete(last)) || allTitles.has(last))) {
          addError(`[${lang}] Guide '${guideKey}' has orphan trailing paragraph at ${context}[${index}]: ${last}`);
        }
      }
    };
    const inspectMemoText = (guideKey, value, context) => {
      if (typeof value === "string" && isMemo(lang, value)) {
        addError(`[${lang}] Guide '${guideKey}' contains production memo at ${context}`);
      }
    };

    for (const [guideKey, guide] of Object.entries(guides)) {
      if (lang === "en" && guideKey === "hwpEditor") continue;
      if (!guide.title || typeof guide.title !== "string" || !guide.title.trim()) addError(`[${lang}] Guide '${guideKey}' is missing 'title'`);
      if (!guide.description || typeof guide.description !== "string" || !guide.description.trim()) addError(`[${lang}] Guide '${guideKey}' is missing 'description'`);
      inspectMemoText(guideKey, guide.title, "title");
      inspectMemoText(guideKey, guide.description, "description");
      inspectBlocks(guideKey, Array.isArray(guide.blocks) ? guide.blocks : [], "blocks");
      for (const [route, blocks] of Object.entries(guide.pathBlocks || {})) {
        if (!routeSet.has(normalizeRoute(route))) addError(`[${lang}] Guide '${guideKey}' pathBlocks route is not an exact App route: ${route}`);
        inspectBlocks(guideKey, Array.isArray(blocks) ? blocks : [], `pathBlocks['${route}']`);
      }
      for (const [id, faq] of Object.entries(guide.faq || {})) {
        if (!faq?.q || !faq?.a) addError(`[${lang}] Guide '${guideKey}' faq '${id}' is missing q or a`);
        inspectMemoText(guideKey, faq?.q, `faq['${id}'].q`);
        inspectMemoText(guideKey, faq?.a, `faq['${id}'].a`);
      }
      for (const [route, ids] of Object.entries(guide.pathFaqs || {})) {
        if (!routeSet.has(normalizeRoute(route))) addError(`[${lang}] Guide '${guideKey}' pathFaqs route is not an exact App route: ${route}`);
        if (!Array.isArray(ids) || ids.length === 0) addError(`[${lang}] Guide '${guideKey}' pathFaqs['${route}'] must not be empty`);
        for (const id of Array.isArray(ids) ? ids : []) if (!guide.faq?.[id]) addError(`[${lang}] Guide '${guideKey}' pathFaqs['${route}'] references missing FAQ ID '${id}'`);
      }
    }

    for (const route of routeSet) {
      const slug = resolveSlug(route, slugByPath);
      if (!slug || (lang === "en" && slug === "hwp-editor")) continue;
      const guideKey = getGuideKeyForPath(slug, route);
      const guide = guides[guideKey];
      if (!guide || !guide.title?.trim() || !guide.description?.trim() || !Array.isArray(guide.blocks) || guide.blocks.length === 0) {
        addError(`[${lang}] Route '${route}' resolves to incomplete guide '${guideKey}' for slug '${slug}'`);
      }
    }

    for (const [guideKey, connections] of faqConnectionsByGuide) {
      if (connections.length < 2) continue;
      const guide = guides[guideKey];
      for (const { route } of connections) {
        const ids = guide?.pathFaqs?.[route];
        if (!Array.isArray(ids) || ids.length === 0) {
          addError(`[${lang}] Explicit pathFaqs required for shared guide key '${guideKey}' at route '${route}'`);
        }
      }
    }

    for (const [route, expectation] of Object.entries(expectations)) {
      if (!routeSet.has(route)) addError(`[${lang}] FAQ expectation route is not declared in App.tsx: ${route}`);
      const questions = resolvedFaqs(guides, expectation.slug, route);
      if (!questions.includes(expectation[lang])) addError(`[${lang}] Required FAQ missing for (${expectation.slug}, ${route}): ${expectation[lang]}`);
    }
  }
  return errors;
}

export async function main() {
  const guidesData = Object.fromEntries(["ko", "en"].map((lang) => [lang, JSON.parse(fs.readFileSync(path.join("src/locales", lang, "guides.json"), "utf8"))]));
  const appRoutes = extractAppRoutes(fs.readFileSync("src/app/App.tsx", "utf8"));
  const errors = validateGuidesData({ guidesData, appRoutes });
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(`Guides validation passed: ${appRoutes.length} App tool routes checked.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
