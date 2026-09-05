import { ChevronLeft, ChevronRight, Play, Timer } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

import { UtilityInput } from "../../components/UtilitySurface";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { featureMessage } from "../../i18n/featureMessages";
import type { AppLanguage } from "../../i18n/languages";
import { cn } from "../../lib/utils";
import type { VideoItem } from "./types";
import { areVideoTrimRenderInputsEqual } from "./videoMemo";

const trimRangeInputClass = "pointer-events-none absolute inset-0 z-[2] m-0 h-7 w-full appearance-none bg-transparent p-0 outline-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-[18px] [&::-moz-range-thumb]:cursor-ew-resize [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-pink-600 [&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:shadow-sm [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:size-[18px] [&::-webkit-slider-thumb]:cursor-ew-resize [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-pink-600 [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-sm focus-visible:[&::-webkit-slider-thumb]:outline-3 focus-visible:[&::-webkit-slider-thumb]:outline-offset-2 focus-visible:[&::-webkit-slider-thumb]:outline-pink-600/25";

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
  if (!(item.duration > 0)) return <div className="video-trim-loading rounded-xl bg-background p-3 text-[13px] text-muted-foreground">{featureMessage(language, "video.messages.VideoTrimLane.readingPlaybackMetadataFor", { p0: item.file.name })}</div>;
  return (
    <Card
      className={cn(
        "video-trim-lane gap-0 overflow-visible rounded-xl border border-transparent bg-background p-2.5 shadow-none ring-0 transition-[border-color,box-shadow] [&+.video-trim-lane]:mt-2",
        active && "border-pink-600/35 shadow-[0_5px_16px_rgba(255,55,95,.08)]",
      )}
      data-active={active || undefined}
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
      <div className="video-trim-lane-title mb-[7px] flex items-center justify-between gap-2 max-[620px]:flex-col max-[620px]:items-start"><strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-foreground">{index + 1}. {item.file.name}</strong><b className="shrink-0 text-[13px] font-bold tabular-nums text-pink-700 dark:text-pink-300">{formatTime(item.start)} — {formatTime(item.end)}</b></div>
      <div className="video-range-control relative mx-[7px] mt-1 mb-px h-7">
        <span className="pointer-events-none absolute top-[11px] right-0 left-0 z-0 h-1.5 rounded-full bg-muted" />
        <span
          className="video-range-selection pointer-events-none absolute top-[11px] z-[1] h-1.5 rounded-full bg-pink-600"
          style={{ left: `${item.start / item.duration * 100}%`, right: `${100 - item.end / item.duration * 100}%` }}
        />
        <input className={trimRangeInputClass} aria-label={featureMessage(language, "video.messages.VideoTrimLane.startTime", { p0: item.file.name })} type="range" min={0} max={item.duration} step="0.01" value={item.start} onChange={(event) => onStart(Math.min(Number(event.target.value), item.end - 0.05), true)} />
        <input className={trimRangeInputClass} aria-label={featureMessage(language, "video.messages.VideoTrimLane.endTime", { p0: item.file.name })} type="range" min={0} max={item.duration} step="0.01" value={item.end} onChange={(event) => onEnd(Math.max(Number(event.target.value), item.start + 0.05), true)} />
      </div>
      <div className="video-range-values mt-0.5 grid grid-cols-[auto_minmax(90px,1fr)_auto] items-end gap-2.5 max-[620px]:grid-cols-2">
        <label className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground max-[620px]:flex-col max-[620px]:items-start" data-trim-boundary="start"><span>{featureMessage(language, "video.messages.VideoTrimLane.start")}</span><div className="video-boundary-stepper inline-flex shrink-0 items-center gap-[3px]"><Button type="button" variant="secondary" size="icon-xs" className="h-[29px] w-[27px] shrink-0 rounded-lg text-pink-700 dark:text-pink-300" aria-label={featureMessage(language, "video.messages.VideoTrimLane.moveStartEarlier", { p0: stepLabel })} aria-keyshortcuts="Alt+ArrowLeft" onClick={() => adjustBoundary("start", -1)}><ChevronLeft size={13} /></Button><TrimNumberInput value={item.start} min={0} max={item.end - 0.05} onCommit={(value) => onStart(value, false)} /><Button type="button" variant="secondary" size="icon-xs" className="h-[29px] w-[27px] shrink-0 rounded-lg text-pink-700 dark:text-pink-300" aria-label={featureMessage(language, "video.messages.VideoTrimLane.moveStartLater", { p0: stepLabel })} aria-keyshortcuts="Alt+ArrowRight" onClick={() => adjustBoundary("start", 1)}><ChevronRight size={13} /></Button></div></label>
        <small className="self-center text-center text-[13px] text-muted-foreground max-[620px]:col-span-2 max-[620px]:row-start-2">{featureMessage(language, "video.messages.VideoTrimLane.selection")} {formatTime(item.end - item.start)}</small>
        <label className="flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground max-[620px]:items-end max-[620px]:justify-self-end max-[620px]:flex-col" data-trim-boundary="end"><span>{featureMessage(language, "video.messages.VideoTrimLane.end")}</span><div className="video-boundary-stepper inline-flex shrink-0 items-center gap-[3px]"><Button type="button" variant="secondary" size="icon-xs" className="h-[29px] w-[27px] shrink-0 rounded-lg text-pink-700 dark:text-pink-300" aria-label={featureMessage(language, "video.messages.VideoTrimLane.moveEndEarlier", { p0: stepLabel })} aria-keyshortcuts="Alt+Shift+ArrowLeft" onClick={() => adjustBoundary("end", -1)}><ChevronLeft size={13} /></Button><TrimNumberInput value={item.end} min={item.start + 0.05} max={item.duration} onCommit={(value) => onEnd(value, false)} /><Button type="button" variant="secondary" size="icon-xs" className="h-[29px] w-[27px] shrink-0 rounded-lg text-pink-700 dark:text-pink-300" aria-label={featureMessage(language, "video.messages.VideoTrimLane.moveEndLater", { p0: stepLabel })} aria-keyshortcuts="Alt+Shift+ArrowRight" onClick={() => adjustBoundary("end", 1)}><ChevronRight size={13} /></Button></div></label>
      </div>
      <small className="video-trim-shortcut-hint mt-[7px] block text-right text-xs text-muted-foreground max-[620px]:text-left">{featureMessage(language, "video.messages.VideoTrimLane.fineTrimAltStartAltShiftEnd", { p0: stepLabel })}</small>
      <div className="trim-play-buttons mt-3 flex flex-wrap gap-[7px]">
        <Button type="button" variant="secondary" size="sm" className="text-pink-700 dark:text-pink-300" onClick={() => onBoundary("start")}><Timer size={14} /> {featureMessage(language, "video.messages.VideoTrimLane.currentStart")}</Button>
        <Button type="button" variant="secondary" size="sm" className="text-pink-700 dark:text-pink-300" onClick={() => onBoundary("end")}><Timer size={14} /> {featureMessage(language, "video.messages.VideoTrimLane.currentEnd")}</Button>
        <Button type="button" variant="secondary" size="sm" className="text-pink-700 dark:text-pink-300" onClick={onPlay}><Play size={14} /> {featureMessage(language, "video.messages.VideoTrimLane.playRange")}</Button>
        <Button type="button" variant="secondary" size="sm" className="text-pink-700 dark:text-pink-300" onClick={() => onNudge(-0.1)}>−0.1s</Button>
        <Button type="button" variant="secondary" size="sm" className="text-pink-700 dark:text-pink-300" onClick={() => onNudge(0.1)}>+0.1s</Button>
        {groupSize > 1 && <Button type="button" variant="secondary" size="sm" className="text-pink-700 dark:text-pink-300" onClick={onApplyGroup}>{featureMessage(language, "video.messages.VideoTrimLane.applyRangeToEntireGroup")}</Button>}
      </div>
    </Card>
  );
}, areVideoTrimRenderInputsEqual);

function TrimNumberInput({ value, min, max, onCommit }: { value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(value.toFixed(2));
  const shortcutPendingRef = useRef(false);
  useEffect(() => { setDraft(value.toFixed(2)); }, [value]);
  const commit = () => {
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
    setDraft(next.toFixed(2));
    onCommit(next);
  };
  return <UtilityInput className="h-[29px] w-[70px] shrink-0 px-[7px] text-[13px] tabular-nums max-[620px]:w-16" type="number" min={min} max={max} step="0.01" value={draft} onChange={(event) => { shortcutPendingRef.current = false; setDraft(event.target.value); }} onBlur={() => { if (shortcutPendingRef.current) { shortcutPendingRef.current = false; return; } commit(); }} onKeyDown={(event) => { if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) shortcutPendingRef.current = true; if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { setDraft(value.toFixed(2)); event.currentTarget.blur(); } }} />;
}

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${rest.toFixed(2).padStart(5, "0")}`;
}
