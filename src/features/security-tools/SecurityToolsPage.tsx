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
  const guessBits = password ? Math.log2(Math.max(1, strength.guesses)) : 0;
  const strengthAdvice = password && strength.score <= 2
    ? strength.score <= 1
      ? "흔한 단어·반복·연속 문자 대신 더 길고 고유한 조합을 사용하세요."
      : "사용할 수는 있지만 길이를 늘리고 이름·생일처럼 예측 가능한 정보를 피하는 편이 안전합니다."
    : "";
  const regenerate = () => { const selected = [upper && SETS.upper, lower && SETS.lower, number && SETS.number, symbol && SETS.symbol].filter(Boolean) as string[]; if (selected.length) setPassword(generatePassword(length, selected)); };
  return <div className="page tool-page page-enter utility-page security-page">
    <PageHeader eyebrow="PASSWORD GENERATOR" title="비밀번호 생성기" description="운영체제의 보안 난수로 비밀번호를 만들고 얼마나 추측하기 어려운지 브라우저에서 점검하세요." />
    <SectionCard title="안전한 비밀번호 생성"><div className="password-output"><KeyRound size={22} /><input value={password} onChange={(event) => setPassword(event.target.value)} aria-label="생성 또는 검사할 비밀번호" /><button type="button" aria-label="비밀번호 복사" onClick={() => void navigator.clipboard.writeText(password)}><Copy size={18} /></button></div><label className="range-control"><span>길이 <strong>{length}자</strong></span><input type="range" min={8} max={64} value={length} onChange={(event) => setLength(Number(event.target.value))} /></label><div className="toggle-card-grid"><ToggleRow label="영문 대문자" checked={upper} onChange={setUpper} /><ToggleRow label="영문 소문자" checked={lower} onChange={setLower} /><ToggleRow label="숫자" checked={number} onChange={setNumber} /><ToggleRow label="특수문자" checked={symbol} onChange={setSymbol} /></div><PrimaryButton accent="blue" disabled={!charsetSize} onClick={regenerate}><RefreshCw size={18} /> 새 비밀번호 생성</PrimaryButton></SectionCard>
    <SectionCard title="강도 분석" description="입력값은 어디에도 전송되지 않습니다."><div className={`strength-meter score-${strength.score}`}><div>{[0, 1, 2, 3, 4].map((score) => <i className={score <= strength.score ? "filled" : ""} key={score} />)}</div><strong>{["매우 약함", "약함", "보통", "강함", "매우 강함"][strength.score]}</strong></div><div className="metric-grid compact"><article><Shield /><span>추정 추측 난이도</span><strong>{guessBits.toFixed(1)} bit</strong><small>1비트가 늘면 필요한 추측 횟수는 약 2배가 됩니다.</small></article><article><ShieldCheck /><span>예상 해독 시간</span><strong>{formatCrackTime(strength.crackTimes.offlineFastHashingXPerSecond.seconds)}</strong><small>해시 유출 후 초당 100억 회 대입하는 상황을 가정합니다.</small></article></div>{strengthAdvice && <p className="legal-note">{strengthAdvice}</p>}</SectionCard>
    <ToolGuide title="비밀번호 생성기 안내" description="운영체제가 제공하는 보안 난수 기능으로 만들며 비밀번호를 서버에 보내지 않습니다." blocks={[{ title: "길고 고유하게", paragraphs: ["사이트마다 서로 다른 16자 이상의 비밀번호를 사용하고 비밀번호 관리자에 보관하는 것이 좋습니다."] }, { title: "강도 점수", paragraphs: ["흔한 단어·반복·연속 문자 같은 패턴과 예상 추측 횟수를 바탕으로 계산합니다. 유출 여부나 계정의 다중 인증 상태까지 확인하지는 않습니다."] }, { title: "예상 해독 시간", paragraphs: ["저장된 비밀번호 해시가 유출되어 공격자가 초당 100억 회 대입할 수 있다고 가정한 비교값입니다. 사이트의 저장 방식과 보안 설정에 따라 실제 시간은 크게 달라집니다."] }]} faq={[{ question: "생성한 비밀번호가 저장되나요?", answer: "아니요. 현재 화면을 벗어나면 사라집니다." }, { question: "예상 해독 시간이 실제 보안 시간을 뜻하나요?", answer: "아니요. 비밀번호끼리 강도를 비교하기 위한 가정값입니다. 로그인 횟수 제한, 비밀번호 저장 방식과 다중 인증에 따라 실제 공격 조건은 달라집니다." }, { question: "복사한 비밀번호는 안전한가요?", answer: "클립보드에는 다른 앱이 접근할 수 있으므로 사용 후 다른 내용을 복사해 덮어쓰는 것이 좋습니다." }]} />
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
function formatCrackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds >= 100 * 365 * 24 * 60 * 60) return "100년 이상";
  if (seconds < 1) return "1초 미만";
  if (seconds < 60) return `약 ${Math.max(1, Math.round(seconds))}초`;
  if (seconds < 60 * 60) return `약 ${Math.round(seconds / 60)}분`;
  if (seconds < 24 * 60 * 60) return `약 ${Math.round(seconds / (60 * 60))}시간`;
  if (seconds < 365 * 24 * 60 * 60) return `약 ${Math.round(seconds / (24 * 60 * 60))}일`;
  return `약 ${Math.round(seconds / (365 * 24 * 60 * 60))}년`;
}
