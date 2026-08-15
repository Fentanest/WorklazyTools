import { Play, Timer } from "lucide-react";
import { memo, useEffect, useState, type CSSProperties } from "react";

import type { AppLanguage } from "../../i18n/languages";
import type { VideoItem } from "./VideoStudioPage";

export const VideoTrimLane = memo(function VideoTrimLane({ item, index, active, groupSize, language, onActivate, onStart, onEnd, onBoundary, onPlay, onNudge, onApplyGroup }: {
  item: VideoItem;
  index: number;
  active: boolean;
  groupSize: number;
  language: AppLanguage;
  onActivate: () => void;
  onStart: (value: number, seek: boolean) => void;
  onEnd: (value: number, seek: boolean) => void;
  onBoundary: (boundary: "start" | "end") => void;
  onPlay: () => void;
  onNudge: (delta: number) => void;
  onApplyGroup: () => void;
}) {
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  if (!(item.duration > 0)) return <div className="video-trim-loading">{L(`${item.file.name} 재생 정보를 확인하는 중…`, `Reading playback metadata for ${item.file.name}…`)}</div>;
  return (
    <div className={`video-trim-lane${active ? " active" : ""}`} onClick={onActivate}>
      <div className="video-trim-lane-title"><strong>{index + 1}. {item.file.name}</strong><b>{formatTime(item.start)} — {formatTime(item.end)}</b></div>
      <div className="video-range-control" style={{ "--range-start": `${item.start / item.duration * 100}%`, "--range-end": `${item.end / item.duration * 100}%` } as CSSProperties}>
        <span className="video-range-selection" />
        <input aria-label={L(`${item.file.name} 시작 지점`, `${item.file.name} start time`)} type="range" min={0} max={item.duration} step="0.01" value={item.start} onChange={(event) => onStart(Math.min(Number(event.target.value), item.end - 0.05), true)} />
        <input aria-label={L(`${item.file.name} 종료 지점`, `${item.file.name} end time`)} type="range" min={0} max={item.duration} step="0.01" value={item.end} onChange={(event) => onEnd(Math.max(Number(event.target.value), item.start + 0.05), true)} />
      </div>
      <div className="video-range-values">
        <label><span>{L("시작", "Start")}</span><TrimNumberInput value={item.start} min={0} max={item.end - 0.05} onCommit={(value) => onStart(value, false)} /></label>
        <small>{L("선택 구간", "Selection")} {formatTime(item.end - item.start)}</small>
        <label><span>{L("종료", "End")}</span><TrimNumberInput value={item.end} min={item.start + 0.05} max={item.duration} onCommit={(value) => onEnd(value, false)} /></label>
      </div>
      <div className="trim-play-buttons">
        <button type="button" className="secondary-button small" onClick={() => onBoundary("start")}><Timer size={14} /> {L("현재 위치→시작", "Current → start")}</button>
        <button type="button" className="secondary-button small" onClick={() => onBoundary("end")}><Timer size={14} /> {L("현재 위치→종료", "Current → end")}</button>
        <button type="button" className="secondary-button small" onClick={onPlay}><Play size={14} /> {L("구간 재생", "Play range")}</button>
        <button type="button" className="secondary-button small" onClick={() => onNudge(-0.1)}>−0.1s</button>
        <button type="button" className="secondary-button small" onClick={() => onNudge(0.1)}>+0.1s</button>
        {groupSize > 1 && <button type="button" className="secondary-button small" onClick={onApplyGroup}>{L("이 구간을 그룹 전체에 적용", "Apply range to entire group")}</button>}
      </div>
    </div>
  );
}, (previous, next) => previous.item === next.item && previous.index === next.index && previous.active === next.active && previous.groupSize === next.groupSize && previous.language === next.language);

function TrimNumberInput({ value, min, max, onCommit }: { value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(value.toFixed(2));
  useEffect(() => setDraft(value.toFixed(2)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
    setDraft(next.toFixed(2));
    onCommit(next);
  };
  return <input type="number" min={min} max={max} step="0.01" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(value.toFixed(2)); event.currentTarget.blur(); } }} />;
}

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${rest.toFixed(2).padStart(5, "0")}`;
}
