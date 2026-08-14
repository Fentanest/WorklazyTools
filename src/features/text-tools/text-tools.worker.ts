/// <reference lib="webworker" />

import { camelCase, capitalCase, kebabCase, snakeCase } from "change-case";

type TextAction = "trim-lines" | "collapse-spaces" | "remove-linebreaks" | "dedupe-lines" | "camel" | "snake" | "kebab" | "title";

interface TextRule {
  id: string;
  label: string;
  labelEn: string;
  pattern: RegExp;
  replacement: string;
}

const CORE_RULES: TextRule[] = [
  ["spacing-can", "의존 명사 ‘수’는 앞말과 띄어 씁니다.", "The Korean bound noun ‘수’ is normally spaced from the preceding word.", /할수(?=$|[\s,.!?])/g, "할 수"],
  ["spacing-thing", "‘것’은 앞말과 띄어 쓰는 형태인지 확인하세요.", "Check whether the Korean bound noun ‘것’ should be spaced.", /할것(?=$|[\s,.!?])/g, "할 것"],
  ["spacing-because", "‘때문’은 앞말과 띄어 씁니다.", "The Korean noun ‘때문’ is spaced from the preceding word.", /하기때문/g, "하기 때문"],
  ["spacing-no", "‘안 되다’의 부정 표현은 띄어 씁니다.", "The negative Korean expression ‘안 되다’ is written with a space.", /안되(?=[는어었면지]|$)/g, "안 되"],
  ["spacing-not", "‘못 하다’의 부정 표현은 띄어 쓰는 것이 원칙입니다.", "The negative Korean expression ‘못 하다’ is normally written with a space.", /못하(?=[는여였면지]|$)/g, "못 하"],
  ["spacing-once", "횟수를 나타내는 ‘한 번’은 띄어 씁니다.", "Korean ‘한 번’, meaning one occurrence, is written with a space.", /한번(?=\s*(?:해|보|확인|사용|시도|클릭))/g, "한 번"],
  ["spacing-several", "횟수를 나타내는 ‘몇 번’은 띄어 씁니다.", "Korean ‘몇 번’, meaning several occurrences, is written with a space.", /몇번/g, "몇 번"],
  ["spacing-for", "기간을 나타내는 ‘동안’은 앞말과 띄어 씁니다.", "Korean ‘동안’, denoting a duration, is spaced from the preceding word.", /(일|주|개월|년)동안/g, "$1 동안"],
  ["spacing-after", "시간 순서를 나타내는 ‘후’는 앞말과 띄어 씁니다.", "Korean ‘후’, denoting after, is spaced from the preceding word.", /(완료|작업|처리|저장|확인)후/g, "$1 후"],
  ["spacing-before", "시간 순서를 나타내는 ‘전’은 앞말과 띄어 씁니다.", "Korean ‘전’, denoting before, is spaced from the preceding word.", /(시작|작업|처리|저장|사용)전/g, "$1 전"],
  ["typo-several", "‘며칠’의 표기를 확인하세요.", "Check the standard Korean spelling ‘며칠’.", /몇일/g, "며칠"],
  ["typo-predicate", "‘어떻게’와 ‘어떡해’를 문맥에 맞게 구분하세요.", "Distinguish Korean ‘어떻게’ and ‘어떡해’ by context.", /어떻해/g, "어떡해"],
  ["typo-rate", "명사 ‘비율’의 표기를 확인하세요.", "Check the standard Korean spelling ‘비율’.", /비률/g, "비율"],
  ["typo-role", "명사 ‘역할’의 표기를 확인하세요.", "Check the standard Korean spelling ‘역할’.", /역활/g, "역할"],
  ["typo-payment", "명사 ‘결제’와 ‘결재’를 문맥에 맞게 구분하세요.", "Distinguish Korean ‘결제’ (payment) and ‘결재’ (approval) by context.", /결재(?=\s*(?:금액|수단|카드|취소|완료))/g, "결제"],
].map(([id, label, labelEn, pattern, replacement]) => ({ id: id as string, label: label as string, labelEn: labelEn as string, pattern: pattern as RegExp, replacement: replacement as string }));

const GUIDE_STEMS = [
  "할", "될", "볼", "갈", "올", "쓸", "읽을", "먹을", "찾을", "만들", "사용할", "확인할", "처리할", "변경할", "저장할", "삭제할", "추가할", "비교할", "선택할", "다운로드할",
];
const GUIDE_NOUNS = ["수", "때", "뿐", "만큼", "대로", "듯", "리", "바", "것", "데", "중", "후"];

const GUIDE_RULES: TextRule[] = GUIDE_STEMS.flatMap((stem) => GUIDE_NOUNS.map((noun, index) => ({
  id: `spacing-${stem}-${noun}-${index}`,
  label: `‘${stem} ${noun}’의 띄어쓰기를 확인하세요.`,
  labelEn: `Check the spacing in the Korean expression ‘${stem} ${noun}’.`,
  pattern: new RegExp(`${stem}${noun}(?=$|[\\s,.!?])`, "g"),
  replacement: `${stem} ${noun}`,
})));

const RULES = [...CORE_RULES, ...GUIDE_RULES];

self.onmessage = (event: MessageEvent<{ type: "transform" | "inspect"; text: string; action?: TextAction; language?: string }>) => {
  try {
    if (event.data.type === "transform") {
      self.postMessage({ type: "result", text: transformText(event.data.text, event.data.action ?? "trim-lines") });
      return;
    }
    const findings = RULES.flatMap((rule) => {
      const matches = Array.from(event.data.text.matchAll(rule.pattern));
      rule.pattern.lastIndex = 0;
      if (!matches.length) return [];
      const sample = matches[0]?.[0] ?? "";
      return [{ id: rule.id, label: event.data.language === "en" ? rule.labelEn : rule.label, before: sample, after: sample.replace(rule.pattern, rule.replacement), count: matches.length }];
    });
    self.postMessage({ type: "inspection", findings, ruleCount: RULES.length });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : event.data.language === "en" ? "The text could not be processed." : "텍스트를 처리하지 못했습니다." });
  }
};

function transformText(text: string, action: TextAction) {
  if (action === "trim-lines") return text.split(/\r?\n/).map((line) => line.trim()).join("\n").replace(/\n{3,}/g, "\n\n");
  if (action === "collapse-spaces") return text.replace(/[\t ]{2,}/g, " ").replace(/[\t ]+$/gm, "");
  if (action === "remove-linebreaks") return text.replace(/\s*\r?\n\s*/g, " ").replace(/[\t ]{2,}/g, " ").trim();
  if (action === "dedupe-lines") {
    const seen = new Set<string>();
    return text.split(/\r?\n/).filter((line) => {
      const key = line.trim();
      if (!key || seen.has(key)) return Boolean(key) && false;
      seen.add(key);
      return true;
    }).join("\n");
  }
  if (action === "camel") return camelCase(text);
  if (action === "snake") return snakeCase(text);
  if (action === "kebab") return kebabCase(text);
  return capitalCase(text);
}

export {};
