import { CalendarCheck, CalendarDays, Calculator, Palmtree } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PrivacyBanner } from "../../components/PrivacyBanner";
import { PageHeader, SectionCard, SegmentedControl } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";
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

  return <div className="page tool-page page-enter utility-page work-calculator-page">
    <PageHeader eyebrow="WORK CALCULATOR" title={t("work.title")} description={t("work.description")}><PrivacyBanner compact /></PageHeader>
    <div className="standard-notice"><CalendarCheck size={20} /><p><strong>{t("work.koreanNotice")}</strong></p></div>
    <div className="mode-switch"><SegmentedControl value={mode} onChange={setMode} label={t("work.modeLabel")} options={[{ value: "business", label: t("work.businessMode") }, { value: "leave", label: t("work.leaveMode") }]} /></div>
    {mode === "business" ? <>
      <SectionCard title={t("work.period")} description={t("work.periodHelp")}><div className="utility-form-grid"><label><span>{t("work.start")}</span><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label><span>{t("work.end")}</span><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label><label className="span-2"><span>{t("work.extra")}</span><input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="2026-08-17, 2026-12-31" /><small>{t("work.extraHelp")}</small></label></div></SectionCard>
      {business && <SectionCard title={t("work.result")}><div className="metric-grid"><article><CalendarDays /><span>{t("work.total")}</span><strong>{t("work.days", { count: business.total })}</strong></article><article><CalendarCheck /><span>{t("work.business")}</span><strong>{t("work.days", { count: business.business })}</strong></article><article><Palmtree /><span>{t("work.excluded")}</span><strong>{t("work.days", { count: business.excluded.length })}</strong></article></div><details className="result-details"><summary>{t("work.excludedDates")}</summary><ul>{business.excluded.map((item) => <li key={item.date}><time>{item.date}</time><span>{item.reason}</span></li>)}</ul></details></SectionCard>}
    </> : <>
      <SectionCard title={t("work.employment")}><div className="utility-form-grid"><label><span>{t("work.hire")}</span><input type="date" value={hire} onChange={(event) => setHire(event.target.value)} /></label><label><span>{t("work.asOf")}</span><input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} /></label></div><div className="sub-segment"><SegmentedControl value={method} onChange={setMethod} label={t("work.basisLabel")} options={[{ value: "hire", label: t("work.hireBasis") }, { value: "fiscal", label: t("work.fiscalBasis") }]} /></div></SectionCard>
      {leave && <SectionCard title={t("work.leaveResult")}><div className="hero-result"><Calculator size={28} /><div><strong>{t("work.days", { count: leave.days })}</strong><p>{leave.detail}</p></div></div><p className="legal-note">{t("work.leaveNote")}</p></SectionCard>}
    </>}
    {businessState.error && mode === "business" && <p className="utility-error">{businessState.error}</p>}
    {leaveState.error && mode === "leave" && <p className="utility-error" role="alert">{leaveState.error}</p>}
    <ToolGuide title={t("work.guide.title")} description={t("work.guide.description")} blocks={(t("work.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))} faq={(t("work.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))} />
  </div>;
}
