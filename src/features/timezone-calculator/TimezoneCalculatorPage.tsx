import { Check, Clock3, Globe2, LocateFixed, Moon, Search, Sun, X } from "lucide-react";
import type { TFunction } from "i18next";
import { DateTime } from "luxon";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ToolGuide } from "../../components/ToolGuide";
import {
  UtilityField,
  UtilityInput,
  UtilityNotice,
  UtilityPage,
  UtilitySectionCard,
  UtilitySelect,
} from "../../components/UtilitySurface";
import { cn } from "../../lib/utils";
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
  const daylightSavingAdjusted = base.isValid && base.toFormat("yyyy-MM-dd HH:mm") !== `${date} ${time}`;
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
    <UtilityPage toolId="timezone-calculator">
      <PageHeader eyebrow="WORLD TIME" title={t("timezone.title")} description={t("timezone.description")} />

      <UtilitySectionCard title={t("timezone.baseTime")} description={t("timezone.baseHelp")}>
        <div className="grid grid-cols-3 gap-[11px] max-[620px]:grid-cols-1" data-testid="timezone-base-form">
          <UtilityField><span>{t("timezone.baseCity")}</span><UtilitySelect data-testid="timezone-base-city" value={baseCityId} onChange={(event) => changeBaseCity(event.target.value)}>{WORLD_CITIES.map((city) => <option value={city.id} key={city.id}>{cityName(city, language)} · {countryName(city, language)}</option>)}</UtilitySelect></UtilityField>
          <UtilityField><span>{t("timezone.date")}</span><UtilityInput type="date" value={date} onChange={(event) => setDate(event.target.value)} /></UtilityField>
          <UtilityField><span>{t("timezone.time")}</span><UtilityInput type="time" value={time} onChange={(event) => setTime(event.target.value)} /></UtilityField>
        </div>
        <div className="mt-2.5 flex justify-end"><Button type="button" variant="secondary" size="lg" className="rounded-xl font-bold" onClick={useCurrentTime}><LocateFixed size={16} /> {t("timezone.current")}</Button></div>
        {!base.isValid && <UtilityNotice className="mt-3" tone="error" role="alert">{t("timezone.invalid")}</UtilityNotice>}
        {daylightSavingAdjusted && <UtilityNotice className="mt-[9px]" role="status">{t("timezone.adjusted", { time: base.toFormat("HH:mm") })}</UtilityNotice>}
      </UtilitySectionCard>

      <UtilitySectionCard title={t("timezone.selectTitle")} description={t("timezone.selectHelp", { total: WORLD_CITIES.length, limit: SELECTION_LIMIT })}>
        <div className="mb-3 flex items-center justify-between gap-3.5 max-[620px]:flex-col max-[620px]:items-stretch">
          <label className="flex min-h-[42px] flex-1 items-center gap-2 rounded-xl border border-input bg-background px-2.5 text-sky-700 outline-none transition-[border-color,box-shadow] focus-within:border-sky-600 focus-within:ring-3 focus-within:ring-sky-600/20 dark:text-sky-400" data-testid="timezone-city-search">
            <Search size={17} />
            <input className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground max-[620px]:text-base" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("timezone.search")} aria-label={t("timezone.searchLabel")} />
            {query && <Button className="size-7 rounded-lg text-muted-foreground" size="icon-xs" variant="ghost" type="button" onClick={() => setQuery("")} aria-label={t("timezone.clear")}><X size={15} /></Button>}
          </label>
          <strong className="shrink-0 text-base tracking-[-.03em] text-sky-700 max-[620px]:self-end dark:text-sky-400">{t("timezone.selectedCount", { count: selectedIds.length, limit: SELECTION_LIMIT })}</strong>
        </div>

        {query && (
          <div className="relative z-[3] mb-3 mt-[-3px] grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-card p-2 shadow-md max-[620px]:grid-cols-1" data-testid="timezone-search-results" role="listbox" aria-label={t("timezone.results")}>
            {searchResults.length ? searchResults.map((city) => {
              const isSelected = selectedIds.includes(city.id);
              return <Button className="h-auto min-w-0 justify-start rounded-xl border border-transparent px-2.5 py-[9px] text-left text-sky-700 hover:border-sky-600/30 dark:text-sky-400" variant="secondary" type="button" role="option" aria-selected={isSelected} key={city.id} onClick={() => { toggleCity(city.id); setQuery(""); }}><Globe2 size={16} /><span className="min-w-0 flex-1"><strong className="block min-w-0 text-sm text-foreground">{cityName(city, language)}</strong><small className="mt-0.5 block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-muted-foreground">{countryName(city, language)} · {city.zone}</small></span>{isSelected && <Check size={16} />}</Button>;
            }) : <p className="col-span-full m-0 p-3.5 text-center text-[13px] text-muted-foreground">{t("timezone.none")}</p>}
          </div>
        )}

        <WorldTimeMap cities={WORLD_CITIES} selectedIds={selectedIds} baseCityId={baseCityId} instant={base} selectionLimit={SELECTION_LIMIT} onToggle={toggleCity} language={language} />

        <div className="mt-[11px] flex flex-wrap gap-[7px]" aria-label={t("timezone.selectedCities")}>
          {selectedCities.map((city) => <Button type="button" size="sm" variant="outline" key={city.id} className={cn("min-h-[31px] rounded-full border-sky-600/20 bg-sky-500/10 px-[9px] text-[13px] font-bold text-sky-700 hover:bg-sky-500/15 dark:text-sky-300", city.id === baseCityId && "cursor-default border-orange-500/20 bg-orange-500/10 text-orange-700 hover:bg-orange-500/10 dark:text-orange-300")} onClick={() => toggleCity(city.id)} aria-label={t("timezone.remove", { city: cityName(city, language) })}><span>{cityName(city, language)}</span>{city.id === baseCityId ? <small className="text-xs">{t("timezone.base")}</small> : <X size={14} />}</Button>)}
        </div>
        {notice && <UtilityNotice className="mt-[9px]" role="status">{notice}</UtilityNotice>}
      </UtilitySectionCard>

      <div className="mb-[15px] grid grid-cols-3 gap-2.5 max-[620px]:grid-cols-1" data-testid="timezone-world-clocks">
        {selectedCities.map((city) => {
          const local = base.setZone(city.zone).setLocale(language);
          const working = local.isValid && local.hour >= 9 && local.hour < 18;
          return (
            <Card as="article" className={cn("min-w-0 gap-0 rounded-2xl border border-transparent p-[15px] py-[15px] shadow-md ring-1 ring-foreground/5", city.id === baseCityId && "border-orange-500/25 shadow-orange-500/10")} key={city.id} data-city-id={city.id}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("flex min-w-0 items-center gap-[7px] text-sm text-sky-700 dark:text-sky-400", city.id === baseCityId && "text-orange-700 dark:text-orange-300")}>{working ? <Sun size={18} /> : <Moon size={18} />}<b className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-foreground">{cityName(city, language)}</b></span>
                <Button className="size-[27px] shrink-0 rounded-lg text-muted-foreground" size="icon-xs" variant="ghost" type="button" disabled={city.id === baseCityId} onClick={() => toggleCity(city.id)} aria-label={t("timezone.remove", { city: cityName(city, language) })}><X size={14} /></Button>
              </div>
              <strong className="mt-[13px] block text-[28px] tracking-[-.05em]">{local.isValid ? local.toFormat("HH:mm") : "--:--"}</strong>
              <p className="mt-[5px] text-[13px] leading-6 text-muted-foreground">{local.isValid ? local.toFormat(language === "en" ? "ccc, LLL dd, yyyy" : "yyyy. LL. dd · ccc") : t("timezone.invalidTime")}</p>
              <small className="mt-[7px] block text-[13px] leading-5 text-muted-foreground">{local.isValid ? `${formatDayShift(base, local, t)} · UTC${local.toFormat("ZZ")} · ${formatTimeDifference(base, local, t)}` : t("timezone.checkDate")}</small>
            </Card>
          );
        })}
      </div>

      <UtilitySectionCard title={t("timezone.meetingTitle")} description={t("timezone.meetingHelp")}>
        {meetingSlots.length ? <div className="grid gap-1.5">{meetingSlots.map((slot) => <div className="grid grid-cols-[auto_160px_minmax(0,1fr)] items-center gap-[9px] rounded-xl bg-sky-500/10 p-2.5 text-sky-700 max-[620px]:grid-cols-[auto_minmax(0,1fr)] dark:text-sky-300" key={slot.key}><Clock3 size={18} /><strong className="text-sm text-foreground">{slot.base}</strong><span className="min-w-0 text-xs leading-5 text-muted-foreground max-[620px]:col-span-full">{slot.locals.join(" · ")}</span></div>)}</div> : <p className="m-0 rounded-xl bg-muted p-[22px] text-center text-sm text-muted-foreground">{t("timezone.noMeeting")}</p>}
      </UtilitySectionCard>

      <ToolGuide
        title={t("timezone.guide.title")}
        description={t("timezone.guide.description")}
        blocks={(t("timezone.guide.blocks", { returnObjects: true }) as Array<{title:string;text:string}>).map((item) => ({ title: item.title, paragraphs: [item.text] }))}
        faq={(t("timezone.guide.faq", { returnObjects: true }) as Array<{q:string;a:string}>).map((item) => ({ question: item.q, answer: item.a }))}
      />
    </UtilityPage>
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
  const end = start.plus({ days: 1 });
  const points: DateTime[] = [];
  for (let point = start; point < end; point = point.plus({ minutes: 30 })) points.push(point);
  return points
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

function formatDayShift(base: DateTime, local: DateTime, t: TFunction<"features">) {
  const baseDay = Date.UTC(base.year, base.month - 1, base.day);
  const localDay = Date.UTC(local.year, local.month - 1, local.day);
  const difference = Math.round((localDay - baseDay) / 86_400_000);
  if (difference === 0) return t("timezone.day.same");
  if (difference === 1) return t("timezone.day.next");
  if (difference === -1) return t("timezone.day.previous");
  return difference > 0 ? t("timezone.day.after", { count: difference }) : t("timezone.day.before", { count: Math.abs(difference) });
}

function formatTimeDifference(base: DateTime, local: DateTime, t: TFunction<"features">) {
  const hours = (local.offset - base.offset) / 60;
  if (hours === 0) return t("timezone.difference.same");
  const amount = Number.isInteger(hours) ? Math.abs(hours).toString() : Math.abs(hours).toFixed(1);
  return t(hours > 0 ? "timezone.difference.ahead" : "timezone.difference.behind", { hours: amount });
}
