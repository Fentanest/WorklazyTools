import { Copy, KeyRound, RefreshCw, Shield, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { ZxcvbnFactory } from "@zxcvbn-ts/core";

import { PageHeader, PrimaryButton, SectionCard, ToggleRow } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";

const SETS = { upper: "ABCDEFGHJKLMNPQRSTUVWXYZ", lower: "abcdefghijkmnopqrstuvwxyz", number: "23456789", symbol: "!@#$%^&*()-_=+[]{}?" };
const strengthChecker = new ZxcvbnFactory();

export function SecurityToolsPage() {
  const [length, setLength] = useState(20); const [upper, setUpper] = useState(true); const [lower, setLower] = useState(true); const [number, setNumber] = useState(true); const [symbol, setSymbol] = useState(true);
  const [password, setPassword] = useState(() => generatePassword(20, Object.values(SETS)));
  const strength = useMemo(() => strengthChecker.check(password), [password]);
  const charsetSize = (upper ? SETS.upper.length : 0) + (lower ? SETS.lower.length : 0) + (number ? SETS.number.length : 0) + (symbol ? SETS.symbol.length : 0);
  const entropy = password ? password.length * Math.log2(Math.max(1, charsetSize)) : 0;
  const regenerate = () => { const selected = [upper && SETS.upper, lower && SETS.lower, number && SETS.number, symbol && SETS.symbol].filter(Boolean) as string[]; if (selected.length) setPassword(generatePassword(length, selected)); };
  return <div className="page tool-page page-enter utility-page security-page">
    <PageHeader eyebrow="PASSWORD GENERATOR" title="비밀번호 생성기" description="운영체제의 암호학적 난수로 비밀번호를 만들고 추측 공격에 대한 강도를 로컬에서 점검하세요." />
    <SectionCard title="안전한 비밀번호 생성"><div className="password-output"><KeyRound size={22} /><input value={password} onChange={(event) => setPassword(event.target.value)} aria-label="생성 또는 검사할 비밀번호" /><button type="button" aria-label="비밀번호 복사" onClick={() => void navigator.clipboard.writeText(password)}><Copy size={18} /></button></div><label className="range-control"><span>길이 <strong>{length}자</strong></span><input type="range" min={8} max={64} value={length} onChange={(event) => setLength(Number(event.target.value))} /></label><div className="toggle-card-grid"><ToggleRow label="영문 대문자" checked={upper} onChange={setUpper} /><ToggleRow label="영문 소문자" checked={lower} onChange={setLower} /><ToggleRow label="숫자" checked={number} onChange={setNumber} /><ToggleRow label="특수문자" checked={symbol} onChange={setSymbol} /></div><PrimaryButton accent="blue" disabled={!charsetSize} onClick={regenerate}><RefreshCw size={18} /> 새 비밀번호 생성</PrimaryButton></SectionCard>
    <SectionCard title="강도 분석" description="입력값은 어디에도 전송되지 않습니다."><div className={`strength-meter score-${strength.score}`}><div>{[0, 1, 2, 3, 4].map((score) => <i className={score <= strength.score ? "filled" : ""} key={score} />)}</div><strong>{["매우 약함", "약함", "보통", "강함", "매우 강함"][strength.score]}</strong></div><div className="metric-grid compact"><article><Shield /><span>추정 엔트로피</span><strong>{entropy.toFixed(1)} bit</strong></article><article><ShieldCheck /><span>오프라인 고속 공격</span><strong>{strength.crackTimes.offlineFastHashingXPerSecond.display}</strong></article></div>{strength.feedback.warning && <p className="legal-note">{strength.feedback.warning}</p>}</SectionCard>
    <ToolGuide title="비밀번호 생성기 안내" description="생성기는 crypto.getRandomValues를 사용하며 서버 난수나 네트워크 요청을 사용하지 않습니다." blocks={[{ title: "길고 고유하게", paragraphs: ["사이트마다 서로 다른 16자 이상의 비밀번호를 사용하고 비밀번호 관리자에 보관하는 것이 좋습니다."] }, { title: "강도 점수", paragraphs: ["점수는 문자열 패턴을 기반으로 한 추정치이며 유출 여부나 계정의 다중 인증 상태까지 확인하지는 않습니다."] }]} faq={[{ question: "생성한 비밀번호가 저장되나요?", answer: "아니요. 현재 화면을 벗어나면 사라집니다." }, { question: "복사한 비밀번호는 안전한가요?", answer: "클립보드에는 다른 앱이 접근할 수 있으므로 사용 후 다른 내용을 복사해 덮어쓰는 것이 좋습니다." }]} />
  </div>;
}

function generatePassword(length: number, groups: string[]) {
  if (!groups.length) return "";
  const all = groups.join(""); const output = groups.map((group) => secureCharacter(group));
  while (output.length < length) output.push(secureCharacter(all));
  for (let index = output.length - 1; index > 0; index -= 1) { const other = secureIndex(index + 1); [output[index], output[other]] = [output[other], output[index]]; }
  return output.slice(0, length).join("");
}
function secureCharacter(source: string) { return source[secureIndex(source.length)]; }
function secureIndex(max: number) { const limit = Math.floor(0x1_0000_0000 / max) * max; const array = new Uint32Array(1); do crypto.getRandomValues(array); while (array[0] >= limit); return array[0] % max; }
