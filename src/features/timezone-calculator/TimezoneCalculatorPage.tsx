import { Check, Clock3, Globe2, LocateFixed, Moon, Search, Sun, X } from "lucide-react";
import { DateTime } from "luxon";
import { useMemo, useState } from "react";

import { PageHeader, SectionCard } from "../../components/ui";
import { ToolGuide } from "../../components/ToolGuide";
import { CITY_BY_ID, WORLD_CITIES, type WorldCity } from "./cities";
import { WorldTimeMap } from "./WorldTimeMap";

const SELECTION_LIMIT = 6;
const INITIAL_CITY_IDS = ["seoul", "new-york", "london", "tokyo"];

export function TimezoneCalculatorPage() {
  const initialNow = useMemo(() => DateTime.now().setZone("Asia/Seoul"), []);
  const [baseCityId, setBaseCityId] = useState("seoul");
  const [date, setDate] = useState(initialNow.toISODate() ?? "");
  const [time, setTime] = useState(initialNow.toFormat("HH:mm"));
  const [selectedIds, setSelectedIds] = useState<string[]>(INITIAL_CITY_IDS);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const baseCity = CITY_BY_ID.get(baseCityId) ?? WORLD_CITIES[0];
  const base = DateTime.fromISO(`${date}T${time}`, { zone: baseCity.zone }).setLocale("ko");
  const selectedCities = selectedIds.flatMap((id) => {
    const city = CITY_BY_ID.get(id);
    return city ? [city] : [];
  });
  const meetingSlots = useMemo(() => findMeetingSlots(date, baseCity, selectedCities), [date, baseCity, selectedCities]);
  const searchResults = useMemo(() => searchCities(query), [query]);

  const toggleCity = (cityId: string) => {
    setSelectedIds((current) => {
      if (current.includes(cityId)) {
        if (cityId === baseCityId) {
          setNotice("기준 도시는 비교 목록에 유지됩니다. 다른 도시를 기준으로 지정한 뒤 해제할 수 있습니다.");
          return current;
        }
        setNotice("");
        return current.filter((id) => id !== cityId);
      }
      if (current.length >= SELECTION_LIMIT) {
        setNotice(`도시는 최대 ${SELECTION_LIMIT}개까지 비교할 수 있습니다. 선택된 도시 하나를 먼저 해제하세요.`);
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
      <PageHeader eyebrow="WORLD TIME" title="시차·글로벌 회의 시간" description="세계지도에서 도시를 선택하고 IANA 타임존과 일광절약시간제를 반영한 현지 시각과 중복 근무시간을 비교하세요." />

      <SectionCard title="기준 시간" description="기준 도시의 날짜와 시각을 다른 도시의 현지 시간으로 변환합니다.">
        <div className="utility-form-grid timezone-base-form">
          <label><span>기준 도시</span><select value={baseCityId} onChange={(event) => changeBaseCity(event.target.value)}>{WORLD_CITIES.map((city) => <option value={city.id} key={city.id}>{city.city} · {city.country}</option>)}</select></label>
          <label><span>날짜</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label><span>시간</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
        </div>
        <div className="timezone-current-action"><button type="button" className="secondary-button" onClick={useCurrentTime}><LocateFixed size={16} /> 기준 도시의 현재 시각</button></div>
        {!base.isValid && <p className="utility-error">선택한 도시에서 존재하지 않는 현지 시각입니다. 일광절약시간 전환 시각을 피해서 다시 입력하세요.</p>}
      </SectionCard>

      <SectionCard title="세계지도에서 도시 선택" description={`${WORLD_CITIES.length}개 주요 도시 중 최대 ${SELECTION_LIMIT}개를 비교할 수 있습니다.`}>
        <div className="city-picker-header">
          <label className="city-search-field">
            <Search size={17} />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="도시·국가·IANA 타임존 검색" aria-label="비교할 도시 검색" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기"><X size={15} /></button>}
          </label>
          <strong>{selectedIds.length}<span> / {SELECTION_LIMIT} 선택</span></strong>
        </div>

        {query && (
          <div className="city-search-results" role="listbox" aria-label="도시 검색 결과">
            {searchResults.length ? searchResults.map((city) => {
              const isSelected = selectedIds.includes(city.id);
              return <button type="button" role="option" aria-selected={isSelected} key={city.id} onClick={() => { toggleCity(city.id); setQuery(""); }}><Globe2 size={16} /><span><strong>{city.city}</strong><small>{city.country} · {city.zone}</small></span>{isSelected && <Check size={16} />}</button>;
            }) : <p>일치하는 도시가 없습니다.</p>}
          </div>
        )}

        <WorldTimeMap cities={WORLD_CITIES} selectedIds={selectedIds} baseCityId={baseCityId} instant={base} selectionLimit={SELECTION_LIMIT} onToggle={toggleCity} />

        <div className="selected-city-chips" aria-label="선택한 도시">
          {selectedCities.map((city) => <button type="button" key={city.id} className={city.id === baseCityId ? "is-base" : ""} onClick={() => toggleCity(city.id)} aria-label={`${city.city} 비교에서 해제`}><span>{city.city}</span>{city.id === baseCityId ? <small>기준</small> : <X size={14} />}</button>)}
        </div>
        {notice && <p className="timezone-selection-notice" role="status">{notice}</p>}
      </SectionCard>

      <div className="world-clock-grid">
        {selectedCities.map((city) => {
          const local = base.setZone(city.zone).setLocale("ko");
          const working = local.isValid && local.hour >= 9 && local.hour < 18;
          return (
            <article className={city.id === baseCityId ? "is-base" : ""} key={city.id} data-city-id={city.id}>
              <div className="world-clock-heading">
                <span>{working ? <Sun size={18} /> : <Moon size={18} />}<b>{city.city}</b></span>
                <button type="button" disabled={city.id === baseCityId} onClick={() => toggleCity(city.id)} aria-label={`${city.city} 비교에서 해제`}><X size={14} /></button>
              </div>
              <strong>{local.isValid ? local.toFormat("HH:mm") : "--:--"}</strong>
              <p>{local.isValid ? local.toFormat("yyyy. LL. dd · ccc") : "시간을 계산할 수 없습니다."}</p>
              <small>{local.isValid ? `${formatDayShift(base, local)} · UTC${local.toFormat("ZZ")} · ${formatTimeDifference(base, local)}` : "날짜와 시간을 확인하세요."}</small>
            </article>
          );
        })}
      </div>

      <SectionCard title="모두의 중복 근무 시간" description="각 도시 현지 시간 09:00~18:00를 기본 근무시간으로 계산합니다.">
        {meetingSlots.length ? <div className="meeting-slot-list">{meetingSlots.map((slot) => <div key={slot.key}><Clock3 size={18} /><strong>{slot.base}</strong><span>{slot.locals.join(" · ")}</span></div>)}</div> : <p className="utility-empty">선택한 날짜에는 모든 도시가 동시에 09:00~18:00인 구간이 없습니다.</p>}
      </SectionCard>

      <ToolGuide
        title="세계 시차 지도 사용 안내"
        description="지도와 도시 좌표는 사이트에 포함되어 있으며 선택 정보는 브라우저 밖으로 전송되지 않습니다."
        blocks={[
          { title: "지도와 도시 선택", paragraphs: ["핀 또는 도시 검색을 이용해 최대 6개 도시를 선택할 수 있습니다. 확대 후에는 지도를 드래그해 밀집된 지역의 핀을 확인하세요."] },
          { title: "서머타임", paragraphs: ["뉴욕·런던·시드니 등은 전환일이 서로 다릅니다. 선택한 날짜의 IANA 타임존 규칙을 적용해 UTC 오프셋을 계산합니다."] },
          { title: "회의 추천", paragraphs: ["30분 단위로 모든 선택 도시가 현지 09:00~18:00인 구간만 표시합니다."] },
        ]}
        faq={[
          { question: "지도 사용 중 외부 지도 서버에 접속하나요?", answer: "아니요. Natural Earth 기반 세계지도와 도시 좌표를 정적 자산으로 함께 배포합니다." },
          { question: "지도 아무 곳이나 눌러 시간대를 찾을 수 있나요?", answer: "현재는 정확한 IANA 타임존이 등록된 주요 도시 핀과 검색 결과만 선택할 수 있습니다." },
          { question: "공휴일도 반영되나요?", answer: "이 도구는 시차와 현지 업무시간만 비교하며 국가별 공휴일은 반영하지 않습니다." },
        ]}
      />
    </div>
  );
}

function searchCities(query: string) {
  const normalized = query.trim().toLocaleLowerCase().replaceAll("-", " ");
  if (!normalized) return [];
  return WORLD_CITIES.filter((city) => `${city.city} ${city.country} ${city.zone} ${city.id.replaceAll("-", " ")}`.toLocaleLowerCase().includes(normalized)).slice(0, 8);
}

function findMeetingSlots(date: string, baseCity: WorldCity, cities: WorldCity[]) {
  if (cities.length < 2) return [];
  const start = DateTime.fromISO(`${date}T00:00`, { zone: baseCity.zone }).setLocale("ko");
  if (!start.isValid) return [];
  return Array.from({ length: 48 }, (_, index) => start.plus({ minutes: index * 30 }))
    .filter((point) => cities.every((city) => {
      const local = point.setZone(city.zone);
      const hour = local.hour + local.minute / 60;
      return hour >= 9 && hour < 18;
    }))
    .map((point) => ({
      key: point.toMillis(),
      base: `${point.toFormat("HH:mm")} (${baseCity.city})`,
      locals: cities.map((city) => `${city.city} ${point.setZone(city.zone).toFormat("HH:mm")}`),
    }));
}

function formatDayShift(base: DateTime, local: DateTime) {
  const baseDay = Date.UTC(base.year, base.month - 1, base.day);
  const localDay = Date.UTC(local.year, local.month - 1, local.day);
  const difference = Math.round((localDay - baseDay) / 86_400_000);
  if (difference === 0) return "같은 날짜";
  if (difference === 1) return "다음 날";
  if (difference === -1) return "전날";
  return difference > 0 ? `${difference}일 뒤` : `${Math.abs(difference)}일 전`;
}

function formatTimeDifference(base: DateTime, local: DateTime) {
  const hours = (local.offset - base.offset) / 60;
  if (hours === 0) return "기준과 같은 시각";
  const amount = Number.isInteger(hours) ? Math.abs(hours).toString() : Math.abs(hours).toFixed(1);
  return `기준보다 ${amount}시간 ${hours > 0 ? "빠름" : "느림"}`;
}
