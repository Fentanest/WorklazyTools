import { Banknote, Calculator, Landmark, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { PageHeader, SectionCard, SegmentedControl } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";
import { calculateNetPay, calculateSeverance, calculateWeeklyAllowance, PAYROLL_STANDARD } from "./payroll";

type PayrollMode = "weekly" | "net" | "severance";
const won = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });

export function PayrollCalculatorPage() {
  const [mode, setMode] = useState<PayrollMode>("weekly");
  const [hours, setHours] = useState(40); const [wage, setWage] = useState(10_500);
  const [salary, setSalary] = useState(3_000_000); const [dependents, setDependents] = useState(1); const [children, setChildren] = useState(0);
  const [hireDate, setHireDate] = useState("2023-01-01"); const [retirementDate, setRetirementDate] = useState(new Date().toISOString().slice(0, 10));
  const [threeMonthWages, setThreeMonthWages] = useState(9_000_000); const [annualBonus, setAnnualBonus] = useState(0); const [annualLeavePay, setAnnualLeavePay] = useState(0); const [periodDays, setPeriodDays] = useState(92);
  const weekly = calculateWeeklyAllowance(hours, wage); const net = calculateNetPay(salary, dependents, children);
  const severance = calculateSeverance({ hireDate, retirementDate, wagesThreeMonths: threeMonthWages, annualBonus, annualLeavePay, periodDays, weeklyHours: hours });
  return <div className="page tool-page page-enter utility-page payroll-page">
    <PageHeader eyebrow="PAYROLL" title="급여·주휴수당·퇴직금 계산기" description="민감한 급여 정보를 전송하거나 저장하지 않고 현재 브라우저에서 간이 계산합니다."><PrivacyBanner compact /></PageHeader>
    <div className="mode-switch"><SegmentedControl value={mode} onChange={setMode} label="급여 계산 종류" options={[{ value: "weekly", label: "주휴수당" }, { value: "net", label: "실수령액" }, { value: "severance", label: "퇴직금" }]} /></div>
    {mode === "weekly" && <><SectionCard title="근로 조건"><div className="utility-form-grid"><NumberInput label="주 소정근로시간" value={hours} onChange={setHours} suffix="시간" /><NumberInput label="약정 시급" value={wage} onChange={setWage} suffix="원" /></div></SectionCard><PayrollHero icon={<Banknote />} value={won.format(weekly.allowance)} label={weekly.eligible ? `유급 주휴 ${weekly.paidHours.toFixed(1)}시간` : "주 15시간 미만으로 적용 대상 아님"} /></>}
    {mode === "net" && <><SectionCard title="월 급여와 공제 정보"><div className="utility-form-grid"><NumberInput label="월 과세 대상 급여" value={salary} onChange={setSalary} suffix="원" help="식대 등 비과세 수당은 제외하세요." /><NumberInput label="공제대상 가족 수(본인 포함)" value={dependents} onChange={setDependents} suffix="명" /><NumberInput label="8~20세 자녀 수" value={children} onChange={setChildren} suffix="명" /></div></SectionCard><PayrollHero icon={<Calculator />} value={won.format(net.net)} label="예상 월 실수령액" /><SectionCard title="예상 공제 내역"><dl className="payroll-breakdown"><Row label="국민연금" value={net.pension} /><Row label="건강보험" value={net.health} /><Row label="장기요양보험" value={net.longTermCare} /><Row label="고용보험" value={net.employment} /><Row label="근로소득세" value={net.incomeTax} /><Row label="지방소득세" value={net.localTax} /><Row label="공제 합계" value={net.deductions} total /></dl></SectionCard></>}
    {mode === "severance" && <><SectionCard title="재직·임금 정보"><div className="utility-form-grid"><label><span>입사일</span><input type="date" value={hireDate} onChange={(event) => setHireDate(event.target.value)} /></label><label><span>퇴직일</span><input type="date" value={retirementDate} onChange={(event) => setRetirementDate(event.target.value)} /></label><NumberInput label="퇴직 전 3개월 임금 총액" value={threeMonthWages} onChange={setThreeMonthWages} suffix="원" /><NumberInput label="최근 1년 상여금 총액" value={annualBonus} onChange={setAnnualBonus} suffix="원" /><NumberInput label="최근 1년 연차수당 총액" value={annualLeavePay} onChange={setAnnualLeavePay} suffix="원" /><NumberInput label="퇴직 전 3개월의 달력상 일수" value={periodDays} onChange={setPeriodDays} suffix="일" help="근무한 날 수가 아니라 해당 기간의 전체 날짜 수입니다." /></div></SectionCard><PayrollHero icon={<Landmark />} value={won.format(severance.severance)} label={severance.eligible ? `평균임금 ${won.format(severance.averageDailyWage)} · 재직 ${severance.serviceDays}일` : "1년 미만 또는 주 15시간 미만으로 법정 적용 대상 아님"} /></>}
    <div className="standard-notice"><ShieldCheck size={20} /><p><strong>적용 기준 {PAYROLL_STANDARD.effectiveDate}</strong><span>국민연금 근로자 {PAYROLL_STANDARD.pensionEmployeeRate * 100}% · 건강보험 {PAYROLL_STANDARD.healthEmployeeRate * 100}% · 장기요양 건강보험료의 {PAYROLL_STANDARD.longTermCareToHealthRate * 100}% · 고용보험 {PAYROLL_STANDARD.employmentEmployeeRate * 100}%</span></p></div>
    <nav className="official-source-links" aria-label="급여 계산 공식 기준"><a href="https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0038M0.do?menuId=MN24001113&tab=tab5" target="_blank" rel="noreferrer">국민연금공단 기준</a><a href="https://edi.nhis.or.kr/portal/images/popup/20251204_pop01longdesc.html" target="_blank" rel="noreferrer">건강보험 2026 요율</a><a href="https://mob.tbht.hometax.go.kr/jsonAction.do?actionId=UTBSFAAM06F001" target="_blank" rel="noreferrer">국세청 간이세액표 조회</a></nav>
    <ToolGuide title="간이 급여 계산 안내" description="실제 급여명세서와 법정 정산을 대체하지 않습니다." blocks={[{ title: "실수령액", paragraphs: ["식대 같은 비과세 수당을 제외한 월 과세 대상 급여와 부양가족 수로 사회보험과 월 소득세를 추정합니다. 회사의 신고 기준소득월액, 비과세 항목과 원천징수 비율에 따라 달라질 수 있습니다."] }, { title: "퇴직금", paragraphs: ["퇴직 전 3개월 임금과 최근 1년 상여·연차수당의 3/12를 반영합니다. 3개월 총 일수에는 휴일을 포함한 달력상 날짜 수를 입력합니다. 산출 평균임금이 통상임금보다 낮은 경우 등은 별도 확인이 필요합니다."] }]} faq={[{ question: "입력한 연봉이 저장되나요?", answer: "아니요. 모든 값은 현재 화면 상태와 브라우저 메모리에서만 계산합니다." }, { question: "세금 신고에 사용해도 되나요?", answer: "아니요. 참고용 예상치이며 실제 원천징수와 퇴직금은 회사 급여 담당자 또는 관계 기관에서 확인하세요." }]} />
  </div>;
}

function NumberInput({ label, value, onChange, suffix, help }: { label: string; value: number; onChange: (value: number) => void; suffix: string; help?: string }) { return <label><span>{label}</span><div className="number-suffix"><input type="number" min={0} value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value)))} /><b>{suffix}</b></div>{help && <small>{help}</small>}</label>; }
function PayrollHero({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) { return <div className="payroll-hero">{icon}<div><strong>{value}</strong><p>{label}</p></div></div>; }
function Row({ label, value, total = false }: { label: string; value: number; total?: boolean }) { return <div className={total ? "total" : ""}><dt>{label}</dt><dd>{won.format(value)}</dd></div>; }
