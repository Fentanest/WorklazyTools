import { CalendarCheck, CalendarDays, Calculator, Palmtree } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { PageHeader, SegmentedControl } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";
import {
  UtilityField,
  UtilityInput,
  UtilityNotice,
  UtilityPage,
  UtilitySectionCard,
} from "../../components/UtilitySurface";
import { localIsoDate } from "../../utils/date";
import { calculateAnnualLeave, calculateBusinessDays } from "./workCalculator";

export function WorkCalculatorPage() {
  const { t, i18n } = useTranslation("features");
  const language = i18n.language === "en" ? "en" : "ko";
  const [mode, setMode] = useState<"business" | "leave">("business");
  const [start, setStart] = useState(() => localIsoDate()); const [end, setEnd] = useState(() => localIsoDate());
  const [custom, setCustom] = useState("");
  const [hire, setHire] = useState(() => `${new Date().getFullYear() - 1}-01-01`); const [asOf, setAsOf] = useState(() => localIsoDate());
  const [method, setMethod] = useState<"hire" | "fiscal">("hire");
  const businessState = useMemo(() => { try { return { result: calculateBusinessDays(start, end, custom.split(/[\s,]+/), language), error: "" }; } catch (reason) { return { result: undefined, error: reason instanceof Error ? reason.message : t("work.periodError") }; } }, [start, end, custom, language, t]);
  const business = businessState.result;
  const leaveState = useMemo(() => {
    try { return { result: calculateAnnualLeave(hire, asOf, method, language), error: "" }; }
    catch (reason) { return { result: undefined, error: reason instanceof Error ? reason.message : t("work.periodError") }; }
  }, [hire, asOf, method, language, t]);
  const leave = leaveState.result;

  const fieldGridClassName = "grid grid-cols-3 gap-[11px] max-[620px]:grid-cols-1";

  return <UtilityPage toolId="work-calculator">
    <PageHeader eyebrow="WORK CALCULATOR" title={t("work.title")} description={t("work.description")}><PrivacyBanner compact /></PageHeader>
    <UtilityNotice className="mt-1 mb-[18px]" tone="success"><CalendarCheck className="mt-0.5 shrink-0" size={20} /><strong>{t("work.koreanNotice")}</strong></UtilityNotice>
    <div className="mb-4 mt-1 rounded-2xl bg-muted p-1" data-testid="work-mode"><SegmentedControl value={mode} onChange={setMode} label={t("work.modeLabel")} options={[{ value: "business", label: t("work.businessMode") }, { value: "leave", label: t("work.leaveMode") }]} /></div>
    {mode === "business" ? <>
      <UtilitySectionCard title={t("work.period")} description={t("work.periodHelp")}><div className={fieldGridClassName}><UtilityField><span>{t("work.start")}</span><UtilityInput type="date" value={start} onChange={(event) => setStart(event.target.value)} /></UtilityField><UtilityField><span>{t("work.end")}</span><UtilityInput type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></UtilityField><UtilityField className="col-span-2 max-[620px]:col-auto"><span>{t("work.extra")}</span><UtilityInput value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="2026-08-17, 2026-12-31" /><small className="text-xs font-medium text-muted-foreground">{t("work.extraHelp")}</small></UtilityField></div></UtilitySectionCard>
      {business && <UtilitySectionCard title={t("work.result")}><div className="grid grid-cols-3 gap-2.5 max-[620px]:grid-cols-1" data-testid="business-day-results"><Metric icon={<CalendarDays />} label={t("work.total")} value={t("work.days", { count: business.total })} /><Metric icon={<CalendarCheck />} label={t("work.business")} value={t("work.days", { count: business.business })} /><Metric icon={<Palmtree />} label={t("work.excluded")} value={t("work.days", { count: business.excluded.length })} /></div><details className="mt-3 overflow-hidden rounded-xl border border-border"><summary className="cursor-pointer px-3.5 py-3 text-sm font-bold">{t("work.excludedDates")}</summary><ul className="m-0 max-h-[260px] list-none overflow-auto px-3.5 pb-2.5">{business.excluded.map((item) => <li className="flex justify-between gap-3 border-t border-border py-2 text-[13px] text-muted-foreground" key={item.date}><time>{item.date}</time><span>{item.reason}</span></li>)}</ul></details></UtilitySectionCard>}
    </> : <>
      <UtilitySectionCard title={t("work.employment")}><div className={fieldGridClassName}><UtilityField><span>{t("work.hire")}</span><UtilityInput type="date" value={hire} onChange={(event) => setHire(event.target.value)} /></UtilityField><UtilityField><span>{t("work.asOf")}</span><UtilityInput type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} /></UtilityField></div><div className="mt-[15px] max-w-[520px]" data-testid="leave-method"><SegmentedControl value={method} onChange={setMethod} label={t("work.basisLabel")} options={[{ value: "hire", label: t("work.hireBasis") }, { value: "fiscal", label: t("work.fiscalBasis") }]} /></div></UtilitySectionCard>
      {leave && <UtilitySectionCard title={t("work.leaveResult")}><div className="flex items-center gap-4 rounded-2xl border border-green-200 bg-green-50/70 p-5 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300" data-testid="leave-result"><Calculator size={28} /><div><strong className="block text-3xl tracking-[-.045em] text-foreground">{t("work.days", { count: leave.days })}</strong><p className="mt-1 text-sm text-muted-foreground">{leave.detail}</p></div></div><p className="mt-3 rounded-xl bg-amber-500/10 px-3.5 py-3 text-[13px] leading-relaxed text-amber-800 dark:text-amber-300">{t("work.leaveNote")}</p></UtilitySectionCard>}
    </>}
    {businessState.error && mode === "business" && <UtilityNotice tone="error" role="alert">{businessState.error}</UtilityNotice>}
    {leaveState.error && mode === "leave" && <UtilityNotice tone="error" role="alert">{leaveState.error}</UtilityNotice>}
    <ToolGuide title={t("work.guide.title")} description={t("work.guide.description")} blocks={(t("work.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("work.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))} />
  </UtilityPage>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <article className="min-w-0 rounded-2xl bg-blue-50 p-[15px] text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{icon}<span className="mt-3 block text-[13px] font-bold text-muted-foreground">{label}</span><strong className="mt-1 block [overflow-wrap:anywhere] text-xl tracking-[-.04em] text-foreground">{value}</strong></article>;
}
