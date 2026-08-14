import { Check, Clock3, Globe2, LocateFixed, Moon, Search, Sun, X } from "lucide-react";
import { DateTime } from "luxon";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader, SectionCard } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";
import { CITY_BY_ID, WORLD_CITIES, cityName, countryName, type WorldCity } from "./cities";
import { WorldTimeMap } from "./WorldTimeMap";

const SELECTION_LIMIT = 6;
const INITIAL_CITY_IDS = ["seoul", "new-york", "london", "tokyo"];

export function TimezoneCalculatorPage() {
  const { t, i18n } = useTranslation("features");
  const language = i18n.language === "en" ? "en" : "ko";
  const initialNow = useMemo(() => DateTime.now().setZone("Asia/Seoul"), []);
  const [baseCityId, setBaseCityId] = useState("seoul");
  const [date, setDate] = useState(initialNow.toISODate() ?? "");
  const [time, setTime] = useState(initialNow.toFormat("HH:mm"));
  const [selectedIds, setSelectedIds] = useState<string[]>(INITIAL_CITY_IDS);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const baseCity = CITY_BY_ID.get(baseCityId) ?? WORLD_CITIES[0];
  const base = DateTime.fromISO(`${date}T${time}`, { zone: baseCity.zone }).setLocale(language);
  const selectedCities = selectedIds.flatMap((id) => {
    const city = CITY_BY_ID.get(id);
    return city ? [city] : [];
  });
  const meetingSlots = useMemo(() => findMeetingSlots(date, baseCity, selectedCities, language), [date, baseCity, selectedCities, language]);
  const searchResults = useMemo(() => searchCities(query, language), [query, language]);

  const toggleCity = (cityId: string) => {
    setSelectedIds((current) => {
      if (current.includes(cityId)) {
        if (cityId === baseCityId) {
          setNotice(t("timezone.keepBase"));
          return current;
        }
        setNotice("");
        return current.filter((id) => id !== cityId);
      }
      if (current.length >= SELECTION_LIMIT) {
        setNotice(t("timezone.limit", { limit: SELECTION_LIMIT }));
        return current;
      }
      setNotice("");
      return [...current, cityId];
    });
  };

  const changeBaseCity = (cityId: string) => {
    const previousBaseId = baseCityId;
    setBaseCityId(cityId);
    setSelectedIds((current) => {
      if (current.includes(cityId)) return current;
      if (current.length < SELECTION_LIMIT) return [cityId, ...current];
      const replaceIndex = current.indexOf(previousBaseId);
      if (replaceIndex < 0) return [cityId, ...current.slice(0, SELECTION_LIMIT - 1)];
      return current.map((id, index) => index === replaceIndex ? cityId : id);
    });
    setNotice("");
  };

  const useCurrentTime = () => {
    const now = DateTime.now().setZone(baseCity.zone);
    setDate(now.toISODate() ?? "");
    setTime(now.toFormat("HH:mm"));
  };

  return (
    <div className="page tool-page page-enter utility-page timezone-page">
      <PageHeader eyebrow="WORLD TIME" title={t("timezone.title")} description={t("timezone.description")} />

      <SectionCard title={t("timezone.baseTime")} description={t("timezone.baseHelp")}>
        <div className="utility-form-grid timezone-base-form">
          <label><span>{t("timezone.baseCity")}</span><select value={baseCityId} onChange={(event) => changeBaseCity(event.target.value)}>{WORLD_CITIES.map((city) => <option value={city.id} key={city.id}>{cityName(city, language)} · {countryName(city, language)}</option>)}</select></label>
          <label><span>{t("timezone.date")}</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label><span>{t("timezone.time")}</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
        </div>
        <div className="timezone-current-action"><button type="button" className="secondary-button" onClick={useCurrentTime}><LocateFixed size={16} /> {t("timezone.current")}</button></div>
        {!base.isValid && <p className="utility-error">{t("timezone.invalid")}</p>}
      </SectionCard>

      <SectionCard title={t("timezone.selectTitle")} description={t("timezone.selectHelp", { total: WORLD_CITIES.length, limit: SELECTION_LIMIT })}>
        <div className="city-picker-header">
          <label className="city-search-field">
            <Search size={17} />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("timezone.search")} aria-label={t("timezone.searchLabel")} />
            {query && <button type="button" onClick={() => setQuery("")} aria-label={t("timezone.clear")}><X size={15} /></button>}
          </label>
          <strong>{t("timezone.selectedCount", { count: selectedIds.length, limit: SELECTION_LIMIT })}</strong>
        </div>

        {query && (
          <div className="city-search-results" role="listbox" aria-label={t("timezone.results")}>
            {searchResults.length ? searchResults.map((city) => {
              const isSelected = selectedIds.includes(city.id);
              return <button type="button" role="option" aria-selected={isSelected} key={city.id} onClick={() => { toggleCity(city.id); setQuery(""); }}><Globe2 size={16} /><span><strong>{cityName(city, language)}</strong><small>{countryName(city, language)} · {city.zone}</small></span>{isSelected && <Check size={16} />}</button>;
            }) : <p>{t("timezone.none")}</p>}
          </div>
        )}

        <WorldTimeMap cities={WORLD_CITIES} selectedIds={selectedIds} baseCityId={baseCityId} instant={base} selectionLimit={SELECTION_LIMIT} onToggle={toggleCity} language={language} />

        <div className="selected-city-chips" aria-label={t("timezone.selectedCities")}>
          {selectedCities.map((city) => <button type="button" key={city.id} className={city.id === baseCityId ? "is-base" : ""} onClick={() => toggleCity(city.id)} aria-label={t("timezone.remove", { city: cityName(city, language) })}><span>{cityName(city, language)}</span>{city.id === baseCityId ? <small>{t("timezone.base")}</small> : <X size={14} />}</button>)}
        </div>
        {notice && <p className="timezone-selection-notice" role="status">{notice}</p>}
      </SectionCard>

      <div className="world-clock-grid">
        {selectedCities.map((city) => {
          const local = base.setZone(city.zone).setLocale(language);
          const working = local.isValid && local.hour >= 9 && local.hour < 18;
          return (
            <article className={city.id === baseCityId ? "is-base" : ""} key={city.id} data-city-id={city.id}>
              <div className="world-clock-heading">
                <span>{working ? <Sun size={18} /> : <Moon size={18} />}<b>{cityName(city, language)}</b></span>
                <button type="button" disabled={city.id === baseCityId} onClick={() => toggleCity(city.id)} aria-label={t("timezone.remove", { city: cityName(city, language) })}><X size={14} /></button>
              </div>
              <strong>{local.isValid ? local.toFormat("HH:mm") : "--:--"}</strong>
              <p>{local.isValid ? local.toFormat(language === "en" ? "ccc, LLL dd, yyyy" : "yyyy. LL. dd · ccc") : t("timezone.invalidTime")}</p>
              <small>{local.isValid ? `${formatDayShift(base, local, t)} · UTC${local.toFormat("ZZ")} · ${formatTimeDifference(base, local, t)}` : t("timezone.checkDate")}</small>
            </article>
          );
        })}
      </div>

      <SectionCard title={t("timezone.meetingTitle")} description={t("timezone.meetingHelp")}>
        {meetingSlots.length ? <div className="meeting-slot-list">{meetingSlots.map((slot) => <div key={slot.key}><Clock3 size={18} /><strong>{slot.base}</strong><span>{slot.locals.join(" · ")}</span></div>)}</div> : <p className="utility-empty">{t("timezone.noMeeting")}</p>}
      </SectionCard>

      <ToolGuide
        title={t("timezone.guide.title")}
        description={t("timezone.guide.description")}
        blocks={(t("timezone.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))}
        faq={(t("timezone.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))}
      />
    </div>
  );
}

function searchCities(query: string, language: "ko" | "en") {
  const normalized = query.trim().toLocaleLowerCase().replaceAll("-", " ");
  if (!normalized) return [];
  return WORLD_CITIES.filter((city) => `${city.city} ${city.country} ${cityName(city, language)} ${countryName(city, language)} ${city.zone} ${city.id.replaceAll("-", " ")}`.toLocaleLowerCase().includes(normalized)).slice(0, 8);
}

function findMeetingSlots(date: string, baseCity: WorldCity, cities: WorldCity[], language: "ko" | "en") {
  if (cities.length < 2) return [];
  const start = DateTime.fromISO(`${date}T00:00`, { zone: baseCity.zone }).setLocale(language);
  if (!start.isValid) return [];
  return Array.from({ length: 48 }, (_, index) => start.plus({ minutes: index * 30 }))
    .filter((point) => cities.every((city) => {
      const local = point.setZone(city.zone);
      const hour = local.hour + local.minute / 60;
      return hour >= 9 && hour < 18;
    }))
    .map((point) => ({
      key: point.toMillis(),
      base: `${point.toFormat("HH:mm")} (${cityName(baseCity, language)})`,
      locals: cities.map((city) => `${cityName(city, language)} ${point.setZone(city.zone).toFormat("HH:mm")}`),
    }));
}

function formatDayShift(base: DateTime, local: DateTime, t: (key: never, options?: Record<string, unknown>) => string) {
  const baseDay = Date.UTC(base.year, base.month - 1, base.day);
  const localDay = Date.UTC(local.year, local.month - 1, local.day);
  const difference = Math.round((localDay - baseDay) / 86_400_000);
  if (difference === 0) return t("timezone.day.same" as never);
  if (difference === 1) return t("timezone.day.next" as never);
  if (difference === -1) return t("timezone.day.previous" as never);
  return difference > 0 ? t("timezone.day.after" as never, { count: difference }) : t("timezone.day.before" as never, { count: Math.abs(difference) });
}

function formatTimeDifference(base: DateTime, local: DateTime, t: (key: never, options?: Record<string, unknown>) => string) {
  const hours = (local.offset - base.offset) / 60;
  if (hours === 0) return t("timezone.difference.same" as never);
  const amount = Number.isInteger(hours) ? Math.abs(hours).toString() : Math.abs(hours).toFixed(1);
  return t(hours > 0 ? "timezone.difference.ahead" as never : "timezone.difference.behind" as never, { hours: amount });
}
