import { CalendarCheck, CalendarDays, Calculator, Palmtree } from "lucide-react";
import { useMemo, useState } from "react";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { PageHeader, PrimaryButton, SectionCard, SegmentedControl } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";
import { calculateAnnualLeave, calculateBusinessDays } from "./workCalculator";

const today = new Date().toISOString().slice(0, 10);

export function WorkCalculatorPage() {
  const [mode, setMode] = useState<"business" | "leave">("business");
  const [start, setStart] = useState(today); const [end, setEnd] = useState(today);
  const [custom, setCustom] = useState("");
  const [hire, setHire] = useState(`${new Date().getFullYear() - 1}-01-01`); const [asOf, setAsOf] = useState(today);
  const [method, setMethod] = useState<"hire" | "fiscal">("hire");
  const businessState = useMemo(() => { try { return { result: calculateBusinessDays(start, end, custom.split(/[\s,]+/)), error: "" }; } catch (reason) { return { result: undefined, error: reason instanceof Error ? reason.message : "기간을 계산하지 못했습니다." }; } }, [start, end, custom]);
  const business = businessState.result;
  let leave: ReturnType<typeof calculateAnnualLeave> | undefined;
  try { leave = calculateAnnualLeave(hire, asOf, method); } catch { leave = undefined; }

  return <div className="page tool-page page-enter utility-page work-calculator-page">
    <PageHeader eyebrow="WORK CALCULATOR" title="영업일·연차 계산기" description="대한민국 주말과 법정·대체공휴일을 반영하고 입사일 또는 회계연도 기준 연차를 간편 계산하세요."><PrivacyBanner compact /></PageHeader>
    <div className="mode-switch"><SegmentedControl value={mode} onChange={setMode} label="계산 종류" options={[{ value: "business", label: "영업일 계산" }, { value: "leave", label: "연차 계산" }]} /></div>
    {mode === "business" ? <>
      <SectionCard title="기간 설정" description="시작일과 종료일을 모두 포함합니다."><div className="utility-form-grid"><label><span>시작일</span><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label><span>종료일</span><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label><label className="span-2"><span>추가 휴일</span><input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="2026-08-17, 2026-12-31" /><small>회사 휴무일 등을 쉼표 또는 공백으로 구분</small></label></div></SectionCard>
      {business && <SectionCard title="계산 결과"><div className="metric-grid"><article><CalendarDays /><span>전체 기간</span><strong>{business.total}일</strong></article><article><CalendarCheck /><span>영업일</span><strong>{business.business}일</strong></article><article><Palmtree /><span>제외일</span><strong>{business.excluded.length}일</strong></article></div><details className="result-details"><summary>제외된 날짜 확인</summary><ul>{business.excluded.map((item) => <li key={item.date}><time>{item.date}</time><span>{item.reason}</span></li>)}</ul></details></SectionCard>}
    </> : <>
      <SectionCard title="재직 정보"><div className="utility-form-grid"><label><span>입사일</span><input type="date" value={hire} onChange={(event) => setHire(event.target.value)} /></label><label><span>계산 기준일</span><input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} /></label></div><div className="sub-segment"><SegmentedControl value={method} onChange={setMethod} label="연차 산정 기준" options={[{ value: "hire", label: "입사일 기준" }, { value: "fiscal", label: "회계연도 기준" }]} /></div></SectionCard>
      {leave && <SectionCard title="예상 발생 연차"><div className="hero-result"><Calculator size={28} /><div><strong>{leave.days.toLocaleString()}일</strong><p>{leave.detail}</p></div></div><p className="legal-note">개근·출근율 80% 충족을 가정한 간이 결과입니다. 첫해 월 단위 연차의 사용·소멸과 회계연도 정산 방식은 회사 규정 및 실제 근태에 따라 달라집니다.</p></SectionCard>}
    </>}
    {businessState.error && mode === "business" && <p className="utility-error">{businessState.error}</p>}
    <ToolGuide title="근무일 계산 기준" description="공휴일 정보와 연차 결과는 일정 계획을 위한 참고값입니다." blocks={[{ title: "공휴일", paragraphs: ["양력 공휴일과 설·추석·부처님오신날, 대체공휴일을 계산합니다. 임시공휴일과 선거일은 직접 추가 휴일에 입력하세요."] }, { title: "연차", paragraphs: ["근로기준법상 기본 발생 구조를 적용하지만 회사의 회계연도 운영과 근태 정산 방식에 따라 실제 부여일수가 달라질 수 있습니다."] }]} faq={[{ question: "임시공휴일도 자동 반영되나요?", answer: "법령에 고정되지 않은 임시공휴일과 선거일은 직접 추가해 주세요." }, { question: "퇴사 시 정산 연차와 같나요?", answer: "아니요. 퇴사 정산은 입사일 기준 발생분과 회사에서 사용한 일수를 함께 확인해야 합니다." }]} />
  </div>;
}
