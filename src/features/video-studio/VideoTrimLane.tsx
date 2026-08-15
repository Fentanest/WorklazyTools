import { ChevronLeft, ChevronRight, Play, Timer } from "lucide-react";
import { memo, useEffect, useState, type CSSProperties } from "react";

import { featureMessage } from "../../i18n/featureMessages";
import type { AppLanguage } from "../../i18n/languages";
import type { VideoItem } from "./types";

export const VideoTrimLane = memo(function VideoTrimLane({ item, index, active, groupSize, language, onActivate, onStart, onEnd, onBoundary, onPlay, onNudge, onApplyGroup }: {
  item: VideoItem;
  index: number;
  active: boolean;
  groupSize: number;
  synchronizationKey: string;
  language: AppLanguage;
  onActivate: () => void;
  onStart: (value: number, seek: boolean) => void;
  onEnd: (value: number, seek: boolean) => void;
  onBoundary: (boundary: "start" | "end") => void;
  onPlay: () => void;
  onNudge: (delta: number) => void;
  onApplyGroup: () => void;
}) {
  const trimStep = item.frameRate && item.frameRate > 0 ? 1 / item.frameRate : 0.1;
  const stepLabel = item.frameRate && item.frameRate > 0 ? featureMessage(language, "video.messages.VideoTrimLane.message1Frame") : "0.1s";
  const adjustBoundary = (boundary: "start" | "end", direction: -1 | 1) => {
    if (boundary === "start") onStart(Math.min(item.end - 0.05, Math.max(0, item.start + trimStep * direction)), true);
    else onEnd(Math.min(item.duration, Math.max(item.start + 0.05, item.end + trimStep * direction)), true);
  };
  if (!(item.duration > 0)) return <div className="video-trim-loading">{featureMessage(language, "video.messages.VideoTrimLane.readingPlaybackMetadataFor", { p0: item.file.name })}</div>;
  return (
    <div
      className={`video-trim-lane${active ? " active" : ""}`}
      tabIndex={0}
      aria-label={featureMessage(language, "video.messages.VideoTrimLane.fineTrimEditor", { p0: item.file.name })}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
        event.preventDefault();
        event.stopPropagation();
        adjustBoundary(event.shiftKey ? "end" : "start", event.key === "ArrowLeft" ? -1 : 1);
      }}
    >
      <div className="video-trim-lane-title"><strong>{index + 1}. {item.file.name}</strong><b>{formatTime(item.start)} — {formatTime(item.end)}</b></div>
      <div className="video-range-control" style={{ "--range-start": `${item.start / item.duration * 100}%`, "--range-end": `${item.end / item.duration * 100}%` } as CSSProperties}>
        <span className="video-range-selection" />
        <input aria-label={featureMessage(language, "video.messages.VideoTrimLane.startTime", { p0: item.file.name })} type="range" min={0} max={item.duration} step="0.01" value={item.start} onChange={(event) => onStart(Math.min(Number(event.target.value), item.end - 0.05), true)} />
        <input aria-label={featureMessage(language, "video.messages.VideoTrimLane.endTime", { p0: item.file.name })} type="range" min={0} max={item.duration} step="0.01" value={item.end} onChange={(event) => onEnd(Math.max(Number(event.target.value), item.start + 0.05), true)} />
      </div>
      <div className="video-range-values">
        <label data-trim-boundary="start"><span>{featureMessage(language, "video.messages.VideoTrimLane.start")}</span><div className="video-boundary-stepper"><button type="button" aria-label={featureMessage(language, "video.messages.VideoTrimLane.moveStartEarlier", { p0: stepLabel })} aria-keyshortcuts="Alt+ArrowLeft" onClick={() => adjustBoundary("start", -1)}><ChevronLeft size={13} /></button><TrimNumberInput value={item.start} min={0} max={item.end - 0.05} onCommit={(value) => onStart(value, false)} /><button type="button" aria-label={featureMessage(language, "video.messages.VideoTrimLane.moveStartLater", { p0: stepLabel })} aria-keyshortcuts="Alt+ArrowRight" onClick={() => adjustBoundary("start", 1)}><ChevronRight size={13} /></button></div></label>
        <small>{featureMessage(language, "video.messages.VideoTrimLane.selection")} {formatTime(item.end - item.start)}</small>
        <label data-trim-boundary="end"><span>{featureMessage(language, "video.messages.VideoTrimLane.end")}</span><div className="video-boundary-stepper"><button type="button" aria-label={featureMessage(language, "video.messages.VideoTrimLane.moveEndEarlier", { p0: stepLabel })} aria-keyshortcuts="Alt+Shift+ArrowLeft" onClick={() => adjustBoundary("end", -1)}><ChevronLeft size={13} /></button><TrimNumberInput value={item.end} min={item.start + 0.05} max={item.duration} onCommit={(value) => onEnd(value, false)} /><button type="button" aria-label={featureMessage(language, "video.messages.VideoTrimLane.moveEndLater", { p0: stepLabel })} aria-keyshortcuts="Alt+Shift+ArrowRight" onClick={() => adjustBoundary("end", 1)}><ChevronRight size={13} /></button></div></label>
      </div>
      <small className="video-trim-shortcut-hint">{featureMessage(language, "video.messages.VideoTrimLane.fineTrimAltStartAltShiftEnd", { p0: stepLabel })}</small>
      <div className="trim-play-buttons">
        <button type="button" className="secondary-button small" onClick={() => onBoundary("start")}><Timer size={14} /> {featureMessage(language, "video.messages.VideoTrimLane.currentStart")}</button>
        <button type="button" className="secondary-button small" onClick={() => onBoundary("end")}><Timer size={14} /> {featureMessage(language, "video.messages.VideoTrimLane.currentEnd")}</button>
        <button type="button" className="secondary-button small" onClick={onPlay}><Play size={14} /> {featureMessage(language, "video.messages.VideoTrimLane.playRange")}</button>
        <button type="button" className="secondary-button small" onClick={() => onNudge(-0.1)}>−0.1s</button>
        <button type="button" className="secondary-button small" onClick={() => onNudge(0.1)}>+0.1s</button>
        {groupSize > 1 && <button type="button" className="secondary-button small" onClick={onApplyGroup}>{featureMessage(language, "video.messages.VideoTrimLane.applyRangeToEntireGroup")}</button>}
      </div>
    </div>
  );
}, (previous, next) => previous.item === next.item
  && previous.index === next.index
  && previous.active === next.active
  && previous.groupSize === next.groupSize
  && previous.synchronizationKey === next.synchronizationKey
  && previous.language === next.language);

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
