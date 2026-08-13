import { Braces, CodeXml, Copy, Database, Minimize2, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { PageHeader, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";

type FormatKind = "json" | "sql" | "xml";

export function TextFormatterPage() {
  const [kind, setKind] = useState<FormatKind>("json");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [indent, setIndent] = useState(2);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const workerRef = useRef<Worker | undefined>(undefined);
  useEffect(() => () => workerRef.current?.terminate(), []);

  const execute = (mode: "pretty" | "minify") => {
    workerRef.current?.terminate(); setBusy(true); setError("");
    const worker = new Worker(new URL("./text-formatter.worker.ts", import.meta.url), { type: "module" }); workerRef.current = worker;
    worker.onmessage = (event) => {
      if (event.data.type === "result") setOutput(event.data.result);
      else setError(event.data.message);
      setBusy(false); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined;
    };
    worker.onerror = (event) => { setBusy(false); setError(event.message || "포맷터를 실행하지 못했습니다."); worker.terminate(); if (workerRef.current === worker) workerRef.current = undefined; };
    worker.postMessage({ kind, mode, text: input, indent });
  };

  return <div className="page tool-page page-enter utility-page formatter-page">
    <PageHeader eyebrow="FORMATTER" title="JSON·SQL·XML 포맷터" description="문법을 검사하고 읽기 좋은 들여쓰기 또는 한 줄 형식으로 정리하세요."><PrivacyBanner compact /></PageHeader>
    <SectionCard title="형식과 출력 설정"><div className="formatter-toolbar"><SegmentedControl value={kind} onChange={(value) => { setKind(value); setError(""); }} label="텍스트 형식" options={[{ value: "json", label: "JSON" }, { value: "sql", label: "SQL" }, { value: "xml", label: "XML" }]} /><label><span>들여쓰기</span><select value={indent} onChange={(event) => setIndent(Number(event.target.value))}><option value={2}>2칸</option><option value={4}>4칸</option></select></label></div></SectionCard>
    <div className="utility-editor-grid">
      <SectionCard title="입력" description={`${input.length.toLocaleString()}자`}><textarea className="utility-textarea code-textarea" spellCheck={false} value={input} onChange={(event) => setInput(event.target.value)} placeholder={kind === "json" ? '{"name":"Worklazy"}' : kind === "sql" ? "select * from tools where enabled = true" : '<tools><tool id="1" /></tools>'} /><div className="utility-inline-actions utility-inline-actions-spacer" aria-hidden="true" /></SectionCard>
      <SectionCard title="결과" description={error ? "문법 오류" : `${output.length.toLocaleString()}자`}><textarea className={`utility-textarea code-textarea${error ? " has-error" : ""}`} readOnly value={error || output} placeholder="정돈 결과가 표시됩니다." /><div className="utility-inline-actions"><button type="button" className="secondary-button" disabled={!output || Boolean(error)} onClick={() => void navigator.clipboard.writeText(output)}><Copy size={16} /> 복사</button></div></SectionCard>
    </div>
    <div className="formatter-actions"><PrimaryButton accent="violet" loading={busy} disabled={!input} onClick={() => execute("pretty")}><WandSparkles size={18} /> 들여쓰기 정돈</PrimaryButton><button className="secondary-button" type="button" disabled={!input || busy} onClick={() => execute("minify")}><Minimize2 size={17} /> 한 줄로 축소</button></div>
    <div className="format-capabilities"><span><Braces size={17} /> JSON.parse</span><span><Database size={17} /> SQL Formatter</span><span><CodeXml size={17} /> XML Validator</span></div>
    <ToolGuide title="포맷터 사용 안내" description="입력 문자열은 브라우저 Worker에서만 해석됩니다." blocks={[{ title: "오류 확인", paragraphs: ["JSON과 XML은 파서가 제공하는 위치를 표시하며 SQL은 토큰 구조를 기준으로 정돈합니다."] }, { title: "Minify", paragraphs: ["문자열 리터럴 내부 공백은 유지하면서 구조 공백을 줄입니다."] }]} faq={[{ question: "SQL을 실행하나요?", answer: "아니요. 데이터베이스 연결 없이 텍스트만 정리합니다." }, { question: "잘못된 JSON도 자동 복구하나요?", answer: "데이터가 달라지는 일을 막기 위해 임의 복구하지 않고 오류를 표시합니다." }]} />
  </div>;
}
