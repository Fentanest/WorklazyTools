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
  { id: "spacing-can", label: "의존 명사 ‘수’는 앞말과 띄어 씁니다.", labelEn: "The Korean bound noun ‘수’ is normally spaced from the preceding word.", pattern: /할수(?=$|[\s,.!?])/g, replacement: "할 수" },
  { id: "spacing-thing", label: "‘것’은 앞말과 띄어 쓰는 형태인지 확인하세요.", labelEn: "Check whether the Korean bound noun ‘것’ should be spaced.", pattern: /할것(?=$|[\s,.!?])/g, replacement: "할 것" },
  { id: "spacing-because", label: "‘때문’은 앞말과 띄어 씁니다.", labelEn: "The Korean noun ‘때문’ is spaced from the preceding word.", pattern: /하기때문/g, replacement: "하기 때문" },
  { id: "spacing-not", label: "독립 부정 부사 ‘못’은 뒤 동사와 띄어 씁니다.", labelEn: "The independent Korean negative adverb ‘못’ is spaced from the following verb.", pattern: /(?<!지\s)못하(?=[는여였면지]|$)/g, replacement: "못 하" },
  { id: "spacing-several", label: "횟수를 나타내는 ‘몇 번’은 띄어 씁니다.", labelEn: "Korean ‘몇 번’, meaning several occurrences, is written with a space.", pattern: /몇번/g, replacement: "몇 번" },
  { id: "spacing-for", label: "기간을 나타내는 ‘동안’은 앞말과 띄어 씁니다.", labelEn: "Korean ‘동안’, denoting a duration, is spaced from the preceding word.", pattern: /(일|주|개월|년)동안/g, replacement: "$1 동안" },
  { id: "spacing-after", label: "시간 순서를 나타내는 ‘후’는 앞말과 띄어 씁니다.", labelEn: "Korean ‘후’, denoting after, is spaced from the preceding word.", pattern: /(완료|작업|처리|저장|확인)후/g, replacement: "$1 후" },
  { id: "spacing-before", label: "시간 순서를 나타내는 ‘전’은 앞말과 띄어 씁니다.", labelEn: "Korean ‘전’, denoting before, is spaced from the preceding word.", pattern: /(시작|작업|처리|저장|사용)전/g, replacement: "$1 전" },
  { id: "typo-several", label: "‘며칠’의 표기를 확인하세요.", labelEn: "Check the standard Korean spelling ‘며칠’.", pattern: /몇일/g, replacement: "며칠" },
  { id: "typo-predicate", label: "‘어떻게’와 ‘어떡해’를 문맥에 맞게 구분하세요.", labelEn: "Distinguish Korean ‘어떻게’ and ‘어떡해’ by context.", pattern: /어떻해/g, replacement: "어떡해" },
  { id: "typo-rate", label: "명사 ‘비율’의 표기를 확인하세요.", labelEn: "Check the standard Korean spelling ‘비율’.", pattern: /비률/g, replacement: "비율" },
  { id: "typo-role", label: "명사 ‘역할’의 표기를 확인하세요.", labelEn: "Check the standard Korean spelling ‘역할’.", pattern: /역활/g, replacement: "역할" },
  { id: "typo-payment", label: "명사 ‘결제’와 ‘결재’를 문맥에 맞게 구분하세요.", labelEn: "Distinguish Korean ‘결제’ (payment) and ‘결재’ (approval) by context.", pattern: /결재(?=\s*(?:금액|수단|카드))/g, replacement: "결제" },
];

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
    const rawFindings = RULES.flatMap((rule) => {
      const matches = Array.from(event.data.text.matchAll(rule.pattern));
      rule.pattern.lastIndex = 0;
      if (!matches.length) return [];
      const sample = matches[0]?.[0] ?? "";
      return [{ id: rule.id, label: event.data.language === "en" ? rule.labelEn : rule.label, before: sample, after: sample.replace(rule.pattern, rule.replacement), count: matches.length }];
    });
    const findings = [...new Map(rawFindings.map((finding) => [`${finding.before}\u0000${finding.after}`, finding])).values()];
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
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).join("\n");
  }
  const transformLine = action === "camel" ? camelCase : action === "snake" ? snakeCase : action === "kebab" ? kebabCase : capitalCase;
  return text.split(/(\r?\n)/).map((part) => /^\r?\n$/.test(part) ? part : transformLine(part)).join("");
}

export {};
