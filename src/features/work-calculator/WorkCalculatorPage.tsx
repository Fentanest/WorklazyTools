import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader, SegmentedControl } from "../../components/ui";
import { ToolGuideWrapper } from "../../components/ToolGuideWrapper";
import { UtilityInput, UtilityPage } from "../../components/UtilitySurface";
import { calculateAnnualLeave, calculateBusinessDays, parseCustomHolidays, seoulToday, validateWorkDate } from "./workCalculator";
import type { AnnualLeaveResult, BusinessResult, LeaveEvent, WorkDateErrorCode, WorkDateField } from "./workCalculatorTypes";
import "./WorkCalculatorPage.css";

type CalculationState = {
  business?: BusinessResult;
  leave?: AnnualLeaveResult;
  errors: Partial<Record<WorkDateField, string>>;
  error: string;
};

export function WorkCalculatorPage() {
  const { t, i18n } = useTranslation("features");
  const language = i18n.resolvedLanguage?.startsWith("en") ? "en" : "ko";
  const [mode, setMode] = useState<"business" | "leave">("business");
  const [start, setStart] = useState(seoulToday);
  const [end, setEnd] = useState(seoulToday);
  const [hire, setHire] = useState(() => `${Number(seoulToday().slice(0, 4)) - 1}-01-01`);
  const [asOf, setAsOf] = useState(seoulToday);
  const [method, setMethod] = useState<"hire" | "fiscal">("hire");
  const [custom, setCustom] = useState<string[]>([]);
  const [customDate, setCustomDate] = useState("");
  const [customText, setCustomText] = useState("");
  const [customError, setCustomError] = useState<{ source: "date" | "text"; reason: unknown }>();
  const [addedCount, setAddedCount] = useState<number>();
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [excludedPage, setExcludedPage] = useState(0);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const messageForError = useCallback((reason: unknown) => {
    const error = reason as { code?: WorkDateErrorCode; field?: WorkDateField; value?: string };
    if (!error?.code || !error.field) return t("work.periodError");
    const field = t(`work.${error.field === "custom" ? "extraDate" : error.field}`);
    const min = error.field === "custom" || mode === "business" ? "2000-01-01" : error.field === "hire" ? "1900-01-01" : "2018-05-29";
    return t(`work.inputErrors.${error.code}`, { field, value: error.value ?? "", min, max: "2050-12-31" });
  }, [mode, t]);

  // Only the visible calculator runs. Draft holidays never enter the calculation.
  const state = useMemo<CalculationState>(() => {
    const errors: CalculationState["errors"] = {};
    const fields: [WorkDateField, string][] = mode === "business" ? [["start", start], ["end", end]] : [["hire", hire], ["asOf", asOf]];
    for (const [field, value] of fields) {
      try { validateWorkDate(value, field, language, mode); }
      catch (error) { errors[field] = messageForError(error); }
    }
    if (Object.keys(errors).length) return { errors, error: Object.values(errors)[0] || t("work.periodError") };
    try {
      return mode === "business"
        ? { business: calculateBusinessDays(start, end, custom, language), errors, error: "" }
        : { leave: calculateAnnualLeave(hire, asOf, method, language), errors, error: "" };
    } catch (error) {
      const message = messageForError(error);
      const field = error && typeof error === "object" && "field" in error ? error.field : undefined;
      if (field === "start" || field === "end" || field === "hire" || field === "asOf") errors[field] = message;
      return { errors, error: message };
    }
  }, [mode, start, end, hire, asOf, method, custom, language, t, messageForError]);
  const resultRef = useRef<HTMLElement>(null);
  const readyHeight = useRef({ business: 0, leave: 0 });
  useLayoutEffect(() => {
    const element = resultRef.current;
    if (state.error || !element) return;
    const remember = () => { readyHeight.current[mode] = element.getBoundingClientRect().height; };
    remember();
    // Viewport, font and translated-content changes can resize a valid result
    // without changing calculator inputs. Keep the last actually displayed size.
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(remember);
    observer?.observe(element);
    if (!observer) window.addEventListener("resize", remember);
    return () => { observer?.disconnect(); window.removeEventListener("resize", remember); };
  }, [state.error, mode]);
  const business = state.business;
  const leave = state.leave;
  const excluded = useMemo(() => business && excludedOpen ? business.excludedPage(excludedPage, 40) : undefined, [business, excludedOpen, excludedPage]);
  const events = useMemo(() => leave && eventsOpen ? [...leave.monthly.events, ...(leave.annual ? [leave.annual] : [])].sort((a, b) => a.date.localeCompare(b.date)) : [], [leave, eventsOpen]);
  const number = (value: number) => value > 0 && value < 0.01 ? "<0.01" : value.toLocaleString(language, { maximumFractionDigits: 2 });
  const days = (value: number) => t("work.dayValue", { count: value, value: number(value) });

  const addHolidays = (source: "date" | "text") => {
    try {
      const text = source === "date" ? customDate : customText;
      if (!text.trim()) validateWorkDate("", "custom", language, "business");
      const incoming = parseCustomHolidays(text, language);
      const next = [...new Set([...custom, ...incoming])].sort();
      setAddedCount(next.length - custom.length);
      setCustom(next);
      setCustomError(undefined);
      if (source === "date") setCustomDate(""); else setCustomText("");
      setExcludedPage(0);
    } catch (error) {
      setCustomError({ source, reason: error });
      setAddedCount(undefined);
    }
  };
  const updateRange = (kind: "month" | "year") => {
    const today = seoulToday();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));
    setStart(kind === "year" ? `${year}-01-01` : `${today.slice(0, 7)}-01`);
    setEnd(kind === "year" ? `${year}-12-31` : `${today.slice(0, 7)}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`);
    setExcludedPage(0);
  };
  const dateField = (field: "start" | "end" | "hire" | "asOf", value: string, onChange: (value: string) => void) => <div className="work-date-field">
    <label htmlFor={`work-${field}`}>{t(`work.${field}`)}</label>
    <UtilityInput id={`work-${field}`} type="date" value={value}
      min={mode === "business" ? "2000-01-01" : field === "hire" ? "1900-01-01" : "2018-05-29"} max="2050-12-31"
      aria-invalid={Boolean(state.errors[field])} aria-describedby={state.errors[field] ? `work-${field}-error` : "work-date-help"}
      onChange={event => { onChange(event.target.value); setExcludedPage(0); }} />
    {state.errors[field] && <p className="work-field-error" id={`work-${field}-error`}>{state.errors[field]}</p>}
  </div>;
  const annualLabel = leave?.annual?.kind === "prorated" ? t("work.fiscalProrated") : method === "fiscal" ? t("work.fiscalGrant") : t("work.cycleGrant");
  const eventKind = (event: LeaveEvent) => t(`work.eventKinds.${event.kind}`);

  return <UtilityPage toolId="work-calculator" className="work-calculator-page">
    <PageHeader eyebrow="WORK CALCULATOR" title={t("work.title")} description={t("work.description")} />
    <section className="work-core" aria-label={t("work.title")} data-testid="work-core">
      <div className="work-mode" data-testid="work-mode"><SegmentedControl value={mode} onChange={setMode} label={t("work.modeLabel")} options={[{ value: "business", label: t("work.businessMode") }, { value: "leave", label: t("work.leaveMode") }]} /></div>
      <div className="work-core-grid">
        <div className="work-inputs">
          <div className="work-date-row">
            {mode === "business" ? <>{dateField("start", start, setStart)}{dateField("end", end, setEnd)}</> : <>{dateField("hire", hire, setHire)}{dateField("asOf", asOf, setAsOf)}</>}
          </div>
          <div className="work-shortcuts">
            {mode === "business" ? <>
              <button type="button" onClick={() => updateRange("month")}>{t("work.thisMonth")}</button>
              <button type="button" onClick={() => updateRange("year")}>{t("work.thisYear")}</button>
              <button type="button" onClick={() => { const today = seoulToday(); setStart(today); setEnd(today); setExcludedPage(0); }}>{t("work.today")}</button>
            </> : <button type="button" onClick={() => setAsOf(seoulToday())}>{t("work.asOfToday")}</button>}
            <span id="work-date-help">{t("work.seoulDates")}</span>
          </div>
          {mode === "business" ? <details className="work-extra">
            <summary>{t("work.extraCount", { count: custom.length })}</summary>
            <div className="work-extra-content">
              <div className="work-add-row">
                <div className="work-date-field">
                  <label htmlFor="work-custom-date">{t("work.extraDate")}</label>
                  <UtilityInput id="work-custom-date" type="date" min="2000-01-01" max="2050-12-31" value={customDate}
                    aria-invalid={customError?.source === "date"} aria-describedby={customError?.source === "date" ? "work-custom-error" : "work-custom-help"}
                    onChange={event => { setCustomDate(event.target.value); setCustomError(undefined); setAddedCount(undefined); }}
                    onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addHolidays("date"); } }} />
                </div>
                <button type="button" className="work-add-button" onClick={() => addHolidays("date")}>{t("work.add")}</button>
              </div>
              <label className="work-paste-label" htmlFor="work-custom-text">{t("work.pasteDates")}</label>
              <div className="work-paste-row">
                <textarea id="work-custom-text" rows={2} value={customText} placeholder="2026-08-17, 2026-12-31"
                  aria-invalid={customError?.source === "text"} aria-describedby={customError?.source === "text" ? "work-custom-help work-custom-error" : "work-custom-help"}
                  onChange={event => { setCustomText(event.target.value); setCustomError(undefined); setAddedCount(undefined); }} />
                <button type="button" className="work-add-button" onClick={() => addHolidays("text")}>{t("work.add")}</button>
              </div>
              <p className="work-help" id="work-custom-help">{t("work.extraHelp")}</p>
              {customError && <p className="work-field-error" id="work-custom-error" role="alert">{messageForError(customError.reason)}</p>}
              <p className="work-action-status" role="status">{addedCount !== undefined ? t("work.addedCount", { count: addedCount }) : ""}</p>
              {custom.length > 0 && <ul className="work-holiday-chips">{custom.map(date => <li key={date}>
                <span><time>{date}</time>{business && (date < start || date > end) && <small>{t("work.outsidePeriod")}</small>}</span>
                <button type="button" aria-label={t("work.removeDate", { date })} onClick={() => { setCustom(custom.filter(item => item !== date)); setAddedCount(undefined); setExcludedPage(0); }}>×</button>
              </li>)}</ul>}
            </div>
          </details> : <div className="work-method" data-testid="leave-method">
            <p className="work-control-label">{t("work.basisLabel")}</p>
            <SegmentedControl value={method} onChange={setMethod} label={t("work.basisLabel")} options={[{ value: "hire", label: t("work.hireBasis") }, { value: "fiscal", label: t("work.fiscalBasis") }]} />
          </div>}
        </div>
        <section ref={resultRef} style={state.error && readyHeight.current[mode] ? { minHeight: readyHeight.current[mode] } : undefined} className="work-result" aria-label={t("work.result")} data-testid="work-result-region">
          {state.error ? <div className="work-result-message"><h2>{t("work.inputNeeded")}</h2><p>{state.error}</p></div> : business ? <div data-testid="business-day-results">
            <h2>{t("work.business")}</h2>
            <strong className="work-primary-value">{days(business.business)}</strong>
            <p className="work-secondary-value">{t("work.businessSummary", { total: number(business.total), excluded: number(business.excludedCount) })}</p>
          </div> : leave && <div data-testid="leave-result">
            <h2>{leave.annual ? annualLabel : t("work.monthlyHistory")}</h2>
            {leave.annual ? <><strong className="work-primary-value">{days(leave.annual.days)}</strong><p className="work-period">{t("work.grantDate", { date: leave.annual.date })}</p><p className="work-period">{t("work.earningPeriod", { start: leave.annual.periodStart, end: leave.annual.periodEnd })}</p>
              {leave.annual.kind === "prorated" && leave.annual.numerator !== undefined && leave.annual.denominator !== undefined && <p className="work-help">{t("work.proratedFormula", { numerator: leave.annual.numerator, denominator: leave.annual.denominator })}</p>}</> : leave.monthly.total !== null ? <strong className="work-primary-value">{days(leave.monthly.total)}</strong> : <p>{t("work.historyUnsupported")}</p>}
            {leave.annual && <div className="work-monthly-summary"><strong>{t("work.monthlyHistory")}</strong><p>{leave.monthly.total === null ? t("work.historyUnsupported") : days(leave.monthly.total)}</p></div>}
            {leave.monthly.total !== null && <p className="work-period">{t("work.monthlyPeriod", { start: leave.monthly.periodStart, end: leave.monthly.periodEnd, date: asOf })}</p>}
            {leave.nextEvent && <p className="work-next-event">{t("work.nextEvent", { date: leave.nextEvent.date, kind: eventKind(leave.nextEvent), days: days(leave.nextEvent.days) })}</p>}
          </div>}
          <p className="work-assumptions">{t(mode === "business" ? "work.businessAssumptions" : "work.leaveAssumptions")}</p>
          {business && <div className="work-data-status">
            <p>{t(`work.dataStatuses.${business.holidayInfo.status}`)}</p>
            <p>{t("work.checkedAt", { date: business.holidayInfo.checkedAt })}</p>
            <p>{t("work.supportedYears", { start: business.holidayInfo.minYear, end: business.holidayInfo.maxYear })}</p>
          </div>}
        </section>
      </div>
    </section>
    {mode === "business" && <details className="work-details" open={excludedOpen} onToggle={event => setExcludedOpen(event.currentTarget.open)}>
      <summary>{t("work.excludedDates")}{business ? ` (${number(business.excludedCount)})` : ""}</summary>
      {excludedOpen && <div className="work-detail-content">{excluded ? <>
        {excluded.items.length ? <div className="work-table-scroll"><table><thead><tr><th>{t("work.date")}</th><th>{t("work.weekday")}</th><th>{t("work.reason")}</th></tr></thead><tbody>
          {excluded.items.map(item => <tr key={item.date}><td><time>{item.date}</time></td><td>{new Intl.DateTimeFormat(language, { weekday: "short", timeZone: "UTC" }).format(new Date(`${item.date}T00:00:00Z`))}</td><td>{item.reasons.join(" · ")}</td></tr>)}
        </tbody></table></div> : <p>{t("work.noExcluded")}</p>}
        {excluded.pageCount > 1 && <nav className="work-pagination" aria-label={t("work.excludedDates")}><button type="button" disabled={excluded.page <= 0} onClick={() => setExcludedPage(excluded.page - 1)}>{t("work.previous")}</button><span>{t("work.pageCount", { page: excluded.page + 1, count: excluded.pageCount })}</span><button type="button" disabled={excluded.page >= excluded.pageCount - 1} onClick={() => setExcludedPage(excluded.page + 1)}>{t("work.next")}</button></nav>}
      </> : <p>{state.error}</p>}</div>}
    </details>}
    {mode === "leave" && <details className="work-details" open={eventsOpen} onToggle={event => setEventsOpen(event.currentTarget.open)}>
      <summary>{t("work.leaveEvents")}</summary>
      {eventsOpen && <div className="work-detail-content">{leave ? <>
        {!leave.monthly.historySupported && <p>{t("work.historyUnsupported")}</p>}
        {events.length ? <div className="work-table-scroll"><table><thead><tr><th>{t("work.date")}</th><th>{t("work.kind")}</th><th>{t("work.dayCount")}</th><th>{t("work.eventPeriod")}</th></tr></thead><tbody>{events.map(event => <tr key={`${event.date}-${event.kind}`}><td><time>{event.date}</time></td><td>{eventKind(event)}</td><td>{days(event.days)}</td><td>{event.periodStart} – {event.periodEnd}{event.kind === "prorated" && event.numerator !== undefined && event.denominator !== undefined && <small>{t("work.proratedFormula", { numerator: event.numerator, denominator: event.denominator })}</small>}</td></tr>)}</tbody></table></div> : <p>{t("work.noEvents")}</p>}
        <p className="work-help">{t("work.historyNote")}</p>
      </> : <p>{state.error}</p>}</div>}
    </details>}
    <details className="work-details work-guide" open={guideOpen} onToggle={event => setGuideOpen(event.currentTarget.open)}><summary>{t("work.guide")}</summary>{guideOpen && <ToolGuideWrapper slug="work"><div className="work-sources"><h3>{t("work.sources")}</h3><ul>
      <li><a href="https://www.law.go.kr/법령/근로기준법" target="_blank" rel="noreferrer">{t("work.sourceLaw")}</a></li>
      <li><a href="https://www.moel.go.kr/policy/policydata/view.do?bbs_seq=20180600335" target="_blank" rel="noreferrer">{t("work.sourceLeaveGuide")}</a></li>
      <li><a href="https://www.moel.go.kr/news/enews/report/enewsView.do?bbs_id=12&news_seq=13052&pageIndex=1&searchField=3" target="_blank" rel="noreferrer">{t("work.sourceAccrual")}</a></li>
      <li><a href="https://www.mpm.go.kr/mpm/info/infoService/BizService02/" target="_blank" rel="noreferrer">{t("work.sourceHolidays")}</a></li>
    </ul></div></ToolGuideWrapper>}</details>
  </UtilityPage>;
}
