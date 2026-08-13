import { CheckCheck, Copy, Eraser, LetterText, ScanText } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { PageHeader, PrimaryButton, SectionCard } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";

type TextAction = "trim-lines" | "collapse-spaces" | "remove-linebreaks" | "dedupe-lines" | "camel" | "snake" | "kebab" | "title";
interface Finding { id: string; label: string; before: string; after: string; count: number }

const ACTIONS: Array<{ value: TextAction; label: string }> = [
  { value: "trim-lines", label: "줄 앞뒤 정리" }, { value: "collapse-spaces", label: "다중 공백 제거" },
  { value: "remove-linebreaks", label: "줄바꿈 합치기" }, { value: "dedupe-lines", label: "중복 줄 제거" },
  { value: "camel", label: "camelCase" }, { value: "snake", label: "snake_case" },
  { value: "kebab", label: "kebab-case" }, { value: "title", label: "Title Case" },
];

export function TextToolsPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [ruleCount, setRuleCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | undefined>(undefined);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = (message: object) => {
    workerRef.current?.terminate();
    const worker = new Worker(new URL("./text-tools.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    setBusy(true);
    worker.onmessage = (event) => {
      if (event.data.type === "result") setOutput(event.data.text);
      if (event.data.type === "inspection") { setFindings(event.data.findings); setRuleCount(event.data.ruleCount); }
      if (event.data.type === "error") window.alert(event.data.message);
      setBusy(false);
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = undefined;
    };
    worker.onerror = () => { setBusy(false); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
    worker.postMessage(message);
  };

  return (
    <div className="page tool-page page-enter utility-page text-tools-page">
      <PageHeader eyebrow="TEXT TOOLS" title="텍스트 정돈·케이스 변환" description="복잡한 공백과 줄을 정리하고 개발용 케이스 변환과 한국어 문장 검토를 브라우저에서 실행하세요."><PrivacyBanner compact /></PageHeader>
      <div className="utility-editor-grid">
        <SectionCard title="원문" description="붙여넣은 텍스트는 외부 서버로 전송되지 않습니다."><textarea className="utility-textarea" value={input} onChange={(event) => setInput(event.target.value)} placeholder="정리할 텍스트를 입력하세요." /><div className="utility-inline-actions utility-inline-actions-spacer" aria-hidden="true" /></SectionCard>
        <SectionCard title="정돈 결과" description={`${output.length.toLocaleString()}자`}><textarea className="utility-textarea" value={output} onChange={(event) => setOutput(event.target.value)} placeholder="선택한 작업 결과가 표시됩니다." /><div className="utility-inline-actions"><button className="secondary-button" type="button" disabled={!output} onClick={() => void navigator.clipboard.writeText(output)}><Copy size={16} /> 복사</button><button className="secondary-button" type="button" onClick={() => { setInput(""); setOutput(""); setFindings([]); }}><Eraser size={16} /> 비우기</button></div></SectionCard>
      </div>
      <SectionCard title="빠른 정돈과 케이스 변환" description="원문을 바꾸지 않고 오른쪽 결과 영역에 적용합니다."><div className="utility-action-grid">{ACTIONS.map((action) => <button type="button" key={action.value} disabled={!input || busy} onClick={() => run({ type: "transform", text: input, action: action.value })}><LetterText size={17} /><span>{action.label}</span></button>)}</div></SectionCard>
      <SectionCard title="한국어 맞춤법·띄어쓰기 가이드" description="로컬 정규식으로 의심 구간을 찾습니다. 문맥에 따라 원문이 맞을 수 있으므로 제안 내용을 직접 확인하세요.">
        <PrimaryButton accent="blue" disabled={!input} loading={busy} onClick={() => run({ type: "inspect", text: input })}><ScanText size={18} /> 로컬 문장 검사</PrimaryButton>
        {ruleCount > 0 && <p className="utility-summary"><CheckCheck size={16} /> {ruleCount}개 로컬 패턴 검사 · {findings.length}개 유형 발견</p>}
        <div className="finding-list">{findings.map((finding) => <article key={finding.id}><div><strong>{finding.before}</strong><span>→</span><b>{finding.after}</b></div><p>{finding.label} · {finding.count}곳</p></article>)}{ruleCount > 0 && !findings.length && <p className="utility-empty">현재 규칙에서 발견된 항목이 없습니다.</p>}</div>
      </SectionCard>
      <ToolGuide title="로컬 텍스트 도구 안내" description="텍스트는 현재 탭의 Worker 안에서만 처리됩니다." blocks={[{ title: "정돈", paragraphs: ["공백·줄바꿈 정돈은 원문의 의미를 해석하지 않고 선택한 규칙만 적용합니다."] }, { title: "한국어 가이드", paragraphs: ["사전 전체를 사용하는 맞춤법 검사기가 아니라 자주 틀리는 표기와 띄어쓰기 패턴을 빠르게 점검하는 보조 도구입니다."] }]} faq={[{ question: "문서 내용이 저장되나요?", answer: "아니요. 입력 내용은 서버나 브라우저 저장소에 보관하지 않습니다." }, { question: "제안을 모두 적용해도 되나요?", answer: "문맥에 따른 예외가 있으므로 원문과 제안을 직접 비교한 뒤 적용하세요." }]} />
    </div>
  );
}
