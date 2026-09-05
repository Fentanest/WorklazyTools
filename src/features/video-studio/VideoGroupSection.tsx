import { ChevronLeft, ChevronRight, Copy, Expand, Film, Gauge, GripVertical, Link2, Minimize2, Pause, Play, Scissors, Timer, Volume2, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type DragEvent, type MutableRefObject } from "react";

import { UtilitySelect } from "../../components/UtilitySurface";
import { SegmentedControl, formatBytes } from "../../components/ui";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { featureMessage } from "../../i18n/featureMessages";
import type { AppLanguage } from "../../i18n/languages";
import { cn } from "../../lib/utils";
import { MAX_VIDEO_GROUP, VIDEO_GROUP_IDS, type VideoGroupId, type VideoGroupSettings, type VideoItem } from "./types";
import { VideoTrimLane } from "./VideoTrimLane";
import { areVideoGroupRenderInputsEqual } from "./videoMemo";
import { MIN_VIDEO_RANGE_SECONDS, type VideoRangeApplicationSummary } from "./videoRanges";

interface VideoGroupSectionProps {
  group: VideoGroupId;
  items: VideoItem[];
  settings: VideoGroupSettings;
  availableGroups: VideoGroupId[];
  activeId?: string;
  language: AppLanguage;
  players: MutableRefObject<Record<string, HTMLVideoElement | null>>;
  onActivate: (itemId: string) => void;
  onUpdateItem: (itemId: string, patch: Partial<VideoItem>) => void;
  onUpdateSettings: (group: VideoGroupId, patch: Partial<VideoGroupSettings>) => void;
  onMoveItem: (itemId: string, group: VideoGroupId, targetId?: string) => void;
  onRemoveItem: (itemId: string) => void;
  onProbeItem: (itemId: string, preserveTiming?: boolean) => void;
  onApplyRange: (source: VideoItem) => void;
  onApplyGroupRanges: (sourceGroup: VideoGroupId, targetGroups: VideoGroupId[]) => VideoRangeApplicationSummary;
  onNotice: (message: string) => void;
}

export const VideoGroupSection = memo(function VideoGroupSection({
  group,
  items,
  settings,
  availableGroups,
  activeId,
  language,
  players,
  onActivate,
  onUpdateItem,
  onUpdateSettings,
  onMoveItem,
  onRemoveItem,
  onProbeItem,
  onApplyRange,
  onApplyGroupRanges,
  onNotice,
}: VideoGroupSectionProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const playheadInputRef = useRef<HTMLInputElement | null>(null);
  const playheadLabelRef = useRef<HTMLElement | null>(null);
  const expectedSeeks = useRef(new Map<string, number>());
  const syncing = useRef(false);
  const [draggedId, setDraggedId] = useState<string>();
  const [fullscreen, setFullscreen] = useState(false);
  const [rangeCopyOpen, setRangeCopyOpen] = useState(false);
  const [rangeCopyTargets, setRangeCopyTargets] = useState<VideoGroupId[]>([]);
  const [rangeNotice, setRangeNotice] = useState("");
  const audioItemId = settings.audioItemId && items.some((item) => item.id === settings.audioItemId) ? settings.audioItemId : items[0].id;
  const activeItemIndex = Math.max(0, items.findIndex((item) => item.id === activeId));
  const activeItem = items[activeItemIndex];
  const otherGroups = availableGroups.filter((candidate) => candidate !== group);
  const availableGroupsKey = availableGroups.join("|");
  const groupDuration = Math.max(...items.map((item) => item.duration || 0), 0.01);
  const synchronizationKey = `${settings.sync}:${items.map((item) => `${item.id}:${item.duration}`).join("|")}`;

  const updatePlayhead = useCallback((value: number) => {
    const input = playheadInputRef.current;
    if (input) input.value = String(Math.min(Number(input.max) || value, value));
    if (playheadLabelRef.current) playheadLabelRef.current.textContent = formatTime(value);
  }, []);

  const activateItem = useCallback((itemId: string) => {
    onActivate(itemId);
    const player = players.current[itemId];
    const currentTime = player?.currentTime;
    if (player && player.readyState >= 1 && typeof currentTime === "number" && Number.isFinite(currentTime)) {
      updatePlayhead(currentTime);
    }
  }, [onActivate, players, updatePlayhead]);

  const synchronizePlayers = useCallback(async (sourceId: string, action: "play" | "pause" | "seek") => {
    if (!settings.sync || syncing.current) return;
    const source = players.current[sourceId];
    if (!source) return;
    syncing.current = true;
    try {
      await Promise.all(items.map(async (item) => {
        const player = players.current[item.id];
        if (!player || item.id === sourceId) return;
        const targetTime = Math.min(source.currentTime, Number.isFinite(player.duration) ? player.duration : source.currentTime);
        if (Math.abs(player.currentTime - targetTime) >= 0.05) {
          expectedSeeks.current.set(item.id, targetTime);
          player.currentTime = targetTime;
        }
        if (action === "play") await player.play().catch(() => undefined);
        if (action === "pause") player.pause();
      }));
    } finally {
      window.requestAnimationFrame(() => { syncing.current = false; });
    }
  }, [items, players, settings.sync]);

  const seekItem = useCallback((item: VideoItem, value: number) => {
    const player = players.current[item.id];
    if (player) player.currentTime = value;
    updatePlayhead(value);
    void synchronizePlayers(item.id, "seek");
  }, [players, synchronizePlayers, updatePlayhead]);

  const seekGroup = useCallback((value: number) => {
    updatePlayhead(value);
    items.forEach((item) => {
      const player = players.current[item.id];
      if (!player) return;
      const target = Math.min(value, item.duration);
      expectedSeeks.current.set(item.id, target);
      player.currentTime = target;
    });
  }, [items, players, updatePlayhead]);

  const toggleFullscreen = useCallback(async () => {
    const element = containerRef.current;
    if (document.fullscreenElement === element) {
      try {
        await document.exitFullscreen();
        setFullscreen(false);
      } catch {
        onNotice(featureMessage(language, "video.messages.VideoGroupSection.unableToExitFullscreen"));
      }
      return;
    }
    if (!element?.requestFullscreen) {
      onNotice(featureMessage(language, "video.messages.VideoGroupSection.thisBrowserDoesNotSupportSplitFullscreen"));
      return;
    }
    try {
      if (!items.some((item) => item.id === activeId)) activateItem(items[0].id);
      await element.requestFullscreen();
      setFullscreen(true);
    } catch {
      onNotice(featureMessage(language, "video.messages.VideoGroupSection.unableToEnterFullscreenCheckTheBrowserS"));
    }
  }, [activateItem, activeId, items, language, onNotice]);

  const setCurrentAsBoundary = useCallback((item: VideoItem, boundary: "start" | "end") => {
    const player = players.current[item.id];
    const current = player?.currentTime;
    if (!player || player.readyState < 1 || typeof current !== "number" || !Number.isFinite(current)) {
      setRangeNotice(featureMessage(language, "video.messages.VideoGroupSection.currentPositionUnavailable", { p0: item.file.name }));
      return;
    }
    const next = boundary === "start"
      ? Math.max(0, Math.min(current, item.end - Math.min(MIN_VIDEO_RANGE_SECONDS, item.duration)))
      : Math.min(item.duration, Math.max(current, item.start + Math.min(MIN_VIDEO_RANGE_SECONDS, item.duration)));
    onUpdateItem(item.id, { [boundary]: next });
    setRangeNotice(featureMessage(language, boundary === "start"
      ? "video.messages.VideoGroupSection.startPositionSet"
      : "video.messages.VideoGroupSection.endPositionSet", { p0: item.file.name, p1: formatTime(next) }));
  }, [language, onUpdateItem, players]);

  const playItemRange = useCallback((item: VideoItem) => {
    const player = players.current[item.id];
    if (!player) return;
    player.currentTime = item.start;
    void player.play();
  }, [players]);

  const nudgeItem = useCallback((item: VideoItem, delta: number) => {
    const current = players.current[item.id]?.currentTime ?? item.start;
    seekItem(item, Math.min(item.duration, Math.max(0, current + delta)));
  }, [players, seekItem]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    setRangeCopyTargets((current) => current.filter((target) => availableGroups.includes(target) && target !== group));
  }, [availableGroupsKey, group]);

  const openRangeCopy = () => {
    setRangeCopyTargets(otherGroups);
    setRangeCopyOpen(true);
  };

  const applyRangesToSelectedGroups = () => {
    if (!rangeCopyTargets.length) return;
    const summary = onApplyGroupRanges(group, rangeCopyTargets);
    const messages = [featureMessage(language, "video.messages.VideoGroupSection.groupRangesApplied", {
      p0: group,
      p1: summary.appliedGroups,
      p2: summary.appliedItems,
    })];
    if (summary.shortenedItems) messages.push(featureMessage(language, "video.messages.VideoGroupSection.groupRangesShortened", { p0: summary.shortenedItems }));
    if (summary.skippedShortItems) messages.push(featureMessage(language, "video.messages.VideoGroupSection.groupRangesTooShortSkipped", { p0: summary.skippedShortItems }));
    if (summary.unmatchedSlots) messages.push(featureMessage(language, "video.messages.VideoGroupSection.groupRangePositionsSkipped", { p0: summary.unmatchedSlots }));
    setRangeNotice(messages.join(" "));
    setRangeCopyOpen(false);
  };

  const drop = (event: DragEvent, targetId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.dataTransfer.getData("text/plain");
    if (itemId) onMoveItem(itemId, group, targetId);
    setDraggedId(undefined);
  };

  return (
    <section
      className={cn(
        "video-sync-group flex flex-col rounded-2xl border border-border bg-muted/60 p-[11px]",
        fullscreen && "h-screen overflow-hidden rounded-none border-0 bg-[#0a0a0d] p-3.5 text-[#f5f5f7]",
      )}
      data-testid="video-group"
      data-video-group={group}
      data-fullscreen={fullscreen || undefined}
      ref={containerRef}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
      onDrop={(event) => drop(event)}
    >
      <header className={cn("video-group-header mb-2.5 grid grid-cols-[minmax(170px,1fr)_minmax(220px,340px)_auto] items-center gap-2.5 max-[820px]:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] max-[620px]:grid-cols-1", fullscreen && "order-1 shrink-0")}>
        <span className="video-group-title flex min-w-0 items-center gap-2 text-pink-700 dark:text-pink-300"><Link2 size={16} /><span className="flex min-w-0 flex-col gap-0.5"><strong className={cn("text-sm text-foreground", fullscreen && "text-[#f5f5f7]")}>{featureMessage(language, "video.messages.VideoGroupSection.group")} {group}</strong><small className={cn("text-[13px] text-muted-foreground", fullscreen && "text-[#aaaab2]")}>{featureMessage(language, "video.messages.VideoGroupSection.videosExportedInCardOrder", { p0: items.length })}</small></span></span>
        <div className="video-group-output-mode [&_[data-ui-component=segmented-control]]:m-0 [&_button]:min-h-[31px] [&_button]:px-2 [&_button]:py-1 [&_button]:text-[13px]">
          <SegmentedControl value={settings.outputMode} options={[{ value: "individual", label: featureMessage(language, "video.messages.VideoGroupSection.individual") }, { value: "concat", label: featureMessage(language, "video.messages.VideoGroupSection.concatenate") }]} onChange={(value) => onUpdateSettings(group, { outputMode: value })} label={featureMessage(language, "video.messages.VideoGroupSection.groupOutputMode", { p0: group })} />
        </div>
        <div className="video-group-actions flex items-center justify-end gap-2 max-[820px]:col-span-full max-[820px]:justify-start max-[620px]:col-auto max-[620px]:flex-wrap">
          <label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs font-bold text-muted-foreground"><Switch size="sm" checked={settings.sync} disabled={items.length < 2} onCheckedChange={(checked) => onUpdateSettings(group, { sync: checked })} aria-label={featureMessage(language, "video.messages.VideoGroupSection.syncPlayback")} nativeButton render={<button type="button" />} /><span>{featureMessage(language, "video.messages.VideoGroupSection.syncPlayback")}</span></label>
          {otherGroups.length > 0 && <Button type="button" variant="secondary" size="sm" className="video-copy-group-ranges min-h-8 whitespace-nowrap" data-testid="video-copy-group-ranges" onClick={openRangeCopy}><Copy size={15} /> {featureMessage(language, "video.messages.VideoGroupSection.copyRangesToOtherGroups")}</Button>}
          {items.length > 1 && <Button type="button" variant="secondary" size="sm" className="min-h-8 whitespace-nowrap" onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize2 size={15} /> : <Expand size={15} />} {featureMessage(language, fullscreen ? "video.messages.VideoGroupSection.closeSplitFullscreen" : "video.messages.VideoGroupSection.splitFullscreen")}</Button>}
        </div>
      </header>

      {rangeCopyOpen && (
        <Card className={cn("video-group-range-copy mb-2.5 grid grid-cols-[minmax(220px,1fr)_minmax(180px,auto)_auto] items-center gap-3 overflow-visible rounded-xl border border-pink-600/20 bg-card p-2.5 shadow-none ring-0 max-[820px]:grid-cols-1", fullscreen && "order-2 shrink-0 border-white/10 bg-[#232328]/95 text-[#f5f5f7]")} role="group" aria-label={featureMessage(language, "video.messages.VideoGroupSection.copyGroupRangesTitle", { p0: group })}>
          <span className="flex min-w-0 flex-col gap-[3px]"><strong className={cn("text-[13px] text-foreground", fullscreen && "text-[#f5f5f7]")}>{featureMessage(language, "video.messages.VideoGroupSection.copyGroupRangesTitle", { p0: group })}</strong><small className={cn("text-xs leading-snug text-muted-foreground", fullscreen && "text-[#aaaab2]")}>{featureMessage(language, "video.messages.VideoGroupSection.copyGroupRangesHelp")}</small></span>
          <div className="video-group-range-targets flex flex-wrap gap-1.5">
            {otherGroups.map((target) => <label className={cn("inline-flex min-h-[31px] cursor-pointer items-center gap-1.5 rounded-lg bg-muted px-2 text-xs font-bold text-muted-foreground", fullscreen && "bg-white/10 text-[#f5f5f7]")} key={target}><input className="size-4 accent-pink-600" type="checkbox" checked={rangeCopyTargets.includes(target)} onChange={(event) => setRangeCopyTargets((current) => event.target.checked ? [...current, target].sort((left, right) => left - right) : current.filter((candidate) => candidate !== target))} /><span>{featureMessage(language, "video.messages.VideoGroupSection.group")} {target}</span></label>)}
          </div>
          <div className="video-group-range-copy-actions flex justify-end gap-1.5 max-[820px]:justify-start max-[620px]:grid max-[620px]:grid-cols-1 [&_button]:min-h-[34px] [&_button]:whitespace-nowrap max-[620px]:[&_button]:w-full">
            <Button type="button" variant="secondary" size="sm" onClick={() => setRangeCopyOpen(false)}>{featureMessage(language, "video.messages.VideoGroupSection.cancelRangeCopy")}</Button>
            <Button type="button" size="sm" className="bg-pink-700 text-white hover:bg-pink-800 focus-visible:ring-pink-700/30" data-testid="video-apply-group-ranges" disabled={!rangeCopyTargets.length} onClick={applyRangesToSelectedGroups}>{featureMessage(language, "video.messages.VideoGroupSection.applyToSelectedGroups", { p0: rangeCopyTargets.length })}</Button>
          </div>
        </Card>
      )}

      {items.length > 1 && (
        <div className={cn("video-group-master-controls mb-2.5 grid grid-cols-[30px_30px_minmax(120px,1fr)_auto_minmax(150px,auto)] items-center gap-[7px] rounded-xl border border-border bg-background p-2 max-[620px]:grid-cols-[30px_30px_minmax(90px,1fr)_auto]", fullscreen && "order-4 mt-[7px] mb-0 shrink-0 border-white/10 bg-[#232328]/95 text-[#f5f5f7]")}>
          <Button type="button" variant="secondary" size="icon-xs" className="size-[30px] rounded-lg bg-pink-600/10 text-pink-700 hover:bg-pink-600/20 dark:text-pink-300" aria-label={featureMessage(language, "video.messages.VideoGroupSection.playGroupTogether", { p0: group })} onClick={() => void Promise.all(items.map((item) => players.current[item.id]?.play().catch(() => undefined)))}><Play size={15} /></Button>
          <Button type="button" variant="secondary" size="icon-xs" className="size-[30px] rounded-lg bg-pink-600/10 text-pink-700 hover:bg-pink-600/20 dark:text-pink-300" aria-label={featureMessage(language, "video.messages.VideoGroupSection.pauseGroupTogether", { p0: group })} onClick={() => items.forEach((item) => players.current[item.id]?.pause())}><Pause size={15} /></Button>
          <input className="w-full accent-pink-600" ref={playheadInputRef} type="range" min={0} max={groupDuration} step="0.01" defaultValue={0} aria-label={featureMessage(language, "video.messages.VideoGroupSection.groupPlayhead", { p0: group })} onChange={(event) => seekGroup(Number(event.target.value))} />
          <b className="text-[13px] tabular-nums text-pink-700 dark:text-pink-300" ref={playheadLabelRef}>{formatTime(0)}</b>
          <label className="grid min-w-0 grid-cols-[auto_auto_minmax(90px,1fr)] items-center gap-1.5 text-[13px] font-bold text-muted-foreground max-[620px]:col-span-full"><Volume2 size={14} /><span>{featureMessage(language, "video.messages.VideoGroupSection.audio")}</span><UtilitySelect className={cn("h-[29px] px-[7px] text-[13px]", fullscreen && "border-white/10 bg-white/10 text-[#f5f5f7]")} value={audioItemId} onChange={(event) => onUpdateSettings(group, { audioItemId: event.target.value })}>{items.map((item, index) => <option value={item.id} key={item.id}>{index + 1}. {item.file.name}</option>)}</UtilitySelect></label>
        </div>
      )}

      <div className={cn(
        "multi-video-grid grid grid-cols-1 gap-2.5 min-[621px]:grid-cols-2",
        items.length === 1 && "mx-auto w-full max-w-[720px] min-[621px]:grid-cols-1",
        items.length >= 5 && "min-[821px]:grid-cols-3",
        items.length === 3 && "max-[820px]:[&>article:last-child]:col-span-2 max-[820px]:[&>article:last-child]:w-1/2 max-[820px]:[&>article:last-child]:justify-self-center max-[620px]:[&>article:last-child]:col-auto max-[620px]:[&>article:last-child]:w-full",
        fullscreen && "order-2 min-h-0 flex-1 auto-rows-[minmax(0,1fr)] items-stretch",
      )}>
        {items.map((item, groupIndex) => {
          const mutedForGroupView = items.length > 1 && (settings.sync || fullscreen) && audioItemId !== item.id;
          return (
            <Card
              as="article"
              className={cn(
                "relative gap-0 overflow-hidden rounded-[14px] border-2 border-transparent bg-[#121215] py-0 shadow-[0_9px_24px_rgba(20,20,30,.1)] ring-0 transition-[border-color,transform]",
                activeId === item.id && "-translate-y-0.5 border-pink-600",
                draggedId === item.id && "scale-[.98] opacity-45",
                fullscreen && "min-h-0",
              )}
              data-active={activeId === item.id || undefined}
              data-dragging={draggedId === item.id || undefined}
              key={item.id}
              onClick={() => activateItem(item.id)}
              onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; }}
              onDrop={(event) => drop(event, item.id)}
            >
              <div
                className="video-drag-handle absolute top-[7px] left-[7px] z-[2] flex h-[27px] min-w-[37px] cursor-grab touch-none items-center justify-center gap-0.5 rounded-lg border border-white/15 bg-[#141418]/80 px-1.5 text-white shadow-sm active:cursor-grabbing"
                draggable
                title={featureMessage(language, "video.messages.VideoGroupSection.dragToReorderOrChangeGroup")}
                onDragStart={(event) => { setDraggedId(item.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); }}
                onDragEnd={() => setDraggedId(undefined)}
              ><GripVertical size={16} /><span>{groupIndex + 1}</span></div>
              <video
                className={cn("block aspect-video w-full bg-black object-contain", fullscreen && "min-h-0 flex-1 [aspect-ratio:auto]")}
                ref={(element) => { players.current[item.id] = element; }}
                src={item.url}
                controls
                onPointerDownCapture={() => activateItem(item.id)}
                onFocusCapture={() => activateItem(item.id)}
                muted={mutedForGroupView}
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const duration = event.currentTarget.duration;
                  if (!Number.isFinite(duration) || duration <= 0) {
                    onProbeItem(item.id);
                    return;
                  }
                  onUpdateItem(item.id, { duration, width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight, end: item.end || duration, metadataSource: "browser", probing: false, metadataError: undefined });
                  if (activeItem.id === item.id) updatePlayhead(event.currentTarget.currentTime);
                  if (!(item.frameRate && item.frameRate > 0)) onProbeItem(item.id, true);
                }}
                onError={() => onProbeItem(item.id)}
                onPlay={() => void synchronizePlayers(item.id, "play")}
                onPause={() => void synchronizePlayers(item.id, "pause")}
                onSeeked={() => {
                  const player = players.current[item.id];
                  const expected = expectedSeeks.current.get(item.id);
                  if (player && expected !== undefined && Math.abs(player.currentTime - expected) < 0.05) {
                    expectedSeeks.current.delete(item.id);
                    return;
                  }
                  expectedSeeks.current.delete(item.id);
                  void synchronizePlayers(item.id, "seek");
                }}
                onTimeUpdate={(event) => {
                  if (event.currentTarget.currentTime >= item.end - 0.01 && !event.currentTarget.paused) {
                    event.currentTarget.pause();
                    event.currentTarget.currentTime = item.end;
                  }
                  if (activeItem.id !== item.id) return;
                  const currentTime = event.currentTarget.currentTime;
                  updatePlayhead(currentTime);
                  if (!settings.sync) return;
                  items.forEach((target) => {
                    if (target.id === item.id) return;
                    const player = players.current[target.id];
                    if (!player || Math.abs(player.currentTime - currentTime) <= 0.15) return;
                    const expected = Math.min(currentTime, target.duration);
                    expectedSeeks.current.set(target.id, expected);
                    player.currentTime = expected;
                  });
                }}
              />
              {item.metadataSource === "ffmpeg" && <div className="video-preview-fallback pointer-events-none absolute inset-[34px_8px_48px] z-[2] flex flex-col items-center justify-center gap-1.5 rounded-[14px] bg-[#121216]/90 p-4 text-center text-white"><Film size={22} /><strong className="text-[15px]">{featureMessage(language, "video.messages.VideoGroupSection.noBrowserPreview")}</strong><span className="max-w-[260px] text-sm leading-relaxed text-white/70">{featureMessage(language, "video.messages.VideoGroupSection.metadataIsAvailableUseTheNumericFieldsBelow")}</span></div>}
              {item.probing && item.metadataSource !== "browser" && <div className="video-preview-fallback pointer-events-none absolute inset-[34px_8px_48px] z-[2] flex flex-col items-center justify-center gap-1.5 rounded-[14px] bg-[#121216]/90 p-4 text-center text-white"><Gauge size={22} /><strong className="text-[15px]">{featureMessage(language, "video.messages.VideoGroupSection.readingVideoMetadata")}</strong><span className="max-w-[260px] text-sm leading-relaxed text-white/70">{featureMessage(language, "video.messages.VideoGroupSection.preparingTheFfmpegCompatibilityPath")}</span></div>}
              <div className="video-card-footer grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2 py-[7px] text-[#f5f5f7] max-[820px]:grid-cols-1">
                <span className="flex min-w-0 flex-col"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs">{groupIndex + 1}. {item.file.name}</strong><small className="mt-[3px] text-xs tabular-nums text-[#9a9aa0]">{formatBytes(item.file.size)} · {item.duration ? `${formatTime(item.duration)}${item.metadataSource === "ffmpeg" ? featureMessage(language, "video.messages.VideoGroupSection.metadataReadyForConversion") : ""}` : item.metadataError || featureMessage(language, "video.messages.VideoGroupSection.readingPlaybackMetadata")}</small>{item.metadataSource === "browser" && item.frameRateProbeStatus === "running" && <small className="mt-[3px] text-xs text-[#9a9aa0]">{featureMessage(language, "video.messages.VideoGroupSection.checkingFrameRateWithoutBlockingExport")}</small>}{item.metadataSource === "browser" && (item.frameRateProbeStatus === "done" || item.frameRateProbeStatus === "failed") && !(item.frameRate && item.frameRate > 0) && <small className="mt-[3px] text-xs text-[#9a9aa0]">{featureMessage(language, "video.messages.VideoGroupSection.frameRateUnavailableUsingTenthsOfASecond")}</small>}</span>
                <span className="video-card-actions flex items-center justify-end gap-[3px]">
                  <Button type="button" variant="ghost" size="icon-xs" className="size-[27px] rounded-lg bg-white/10 text-[#d4d4da] hover:bg-white/15 hover:text-white disabled:opacity-30" disabled={item.group === 1} aria-label={featureMessage(language, "video.messages.VideoGroupSection.moveToThePreviousGroup", { p0: item.file.name })} onClick={(event) => { event.stopPropagation(); onMoveItem(item.id, Math.max(1, item.group - 1) as VideoGroupId); }}><ChevronLeft size={14} /></Button>
                  <label className="video-group-select"><span className="sr-only">{item.file.name} {featureMessage(language, "video.messages.VideoGroupSection.group2")}</span><UtilitySelect className="h-[27px] max-w-[82px] rounded-lg border-white/10 bg-white/10 px-[5px] text-xs font-bold text-[#f5f5f7] dark:bg-[#3a3a3c]" value={item.group} aria-label={featureMessage(language, "video.messages.VideoGroupSection.moveToAGroup", { p0: item.file.name })} onClick={(event) => event.stopPropagation()} onChange={(event) => onMoveItem(item.id, Number(event.target.value) as VideoGroupId)}>{VIDEO_GROUP_IDS.map((id) => <option value={id} key={id}>{featureMessage(language, "video.messages.VideoGroupSection.group")} {id}</option>)}</UtilitySelect></label>
                  <Button type="button" variant="ghost" size="icon-xs" className="size-[27px] rounded-lg bg-white/10 text-[#d4d4da] hover:bg-white/15 hover:text-white disabled:opacity-30" disabled={item.group === MAX_VIDEO_GROUP} aria-label={featureMessage(language, "video.messages.VideoGroupSection.moveToTheNextGroup", { p0: item.file.name })} onClick={(event) => { event.stopPropagation(); onMoveItem(item.id, Math.min(MAX_VIDEO_GROUP, item.group + 1) as VideoGroupId); }}><ChevronRight size={14} /></Button>
                  <Button type="button" variant="ghost" size="icon-xs" className="size-[27px] rounded-lg bg-white/10 text-[#d4d4da] hover:bg-red-500/20 hover:text-red-300" aria-label={featureMessage(language, "video.messages.VideoGroupSection.remove", { p0: item.file.name })} onClick={(event) => { event.stopPropagation(); onRemoveItem(item.id); }}><X size={14} /></Button>
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {items.length > 1 && (
        <div
          className={cn("video-fullscreen-trim-toolbar hidden", fullscreen && "order-3 mt-2.5 grid shrink-0 grid-cols-[minmax(220px,.8fr)_minmax(0,auto)] items-center gap-2.5 rounded-xl border border-white/10 bg-[#232328]/95 p-2 text-[#f5f5f7] max-[1100px]:grid-cols-1")}
          data-testid="video-fullscreen-trim-toolbar"
          role="group"
          aria-label={featureMessage(language, "video.messages.VideoGroupSection.fullscreenRangeControls", { p0: activeItem.file.name })}
        >
          <div className="video-fullscreen-trim-selection flex min-w-0 flex-col gap-1 max-[1100px]:flex-row max-[1100px]:items-center max-[1100px]:justify-between">
            <span className="flex min-w-0 items-center gap-1.5 text-[#ff6b88]"><Scissors size={15} /><small className="shrink-0 text-xs font-bold text-[#aaaab2]">{featureMessage(language, "video.messages.VideoGroupSection.selectedVideo")} {activeItemIndex + 1}</small><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[#f5f5f7]" title={activeItem.file.name}>{activeItem.file.name}</strong></span>
            <b className="shrink-0 text-xs tabular-nums text-[#ff6b88]">{formatTime(activeItem.start)} — {formatTime(activeItem.end)}</b>
            {rangeNotice && <small className="video-range-notice m-0 bg-transparent p-0 text-xs font-bold text-[#ff9aae]" aria-live="polite">{rangeNotice}</small>}
          </div>
          <div className="video-fullscreen-trim-actions flex min-w-0 flex-wrap items-center justify-end gap-1.5 max-[1100px]:flex-nowrap max-[1100px]:justify-start max-[1100px]:overflow-x-auto max-[1100px]:pb-px [&_button]:min-h-8 [&_button]:shrink-0 [&_button]:rounded-lg [&_button]:border-white/10 [&_button]:bg-white/10 [&_button]:px-2 [&_button]:text-xs [&_button]:font-bold [&_button]:text-[#ff6b88]">
            <Button type="button" variant="outline" size="sm" disabled={!(activeItem.duration > 0)} onClick={() => setCurrentAsBoundary(activeItem, "start")}><Timer size={14} /> {featureMessage(language, "video.messages.VideoTrimLane.currentStart")}</Button>
            <Button type="button" variant="outline" size="sm" disabled={!(activeItem.duration > 0)} onClick={() => setCurrentAsBoundary(activeItem, "end")}><Timer size={14} /> {featureMessage(language, "video.messages.VideoTrimLane.currentEnd")}</Button>
            <Button type="button" variant="outline" size="sm" disabled={!(activeItem.duration > 0)} onClick={() => playItemRange(activeItem)}><Play size={14} /> {featureMessage(language, "video.messages.VideoTrimLane.playRange")}</Button>
            <Button type="button" variant="outline" size="sm" disabled={!(activeItem.duration > 0)} onClick={() => nudgeItem(activeItem, -0.1)}>−0.1s</Button>
            <Button type="button" variant="outline" size="sm" disabled={!(activeItem.duration > 0)} onClick={() => nudgeItem(activeItem, 0.1)}>+0.1s</Button>
            <Button type="button" size="sm" className="apply-group-range ml-1 !border-transparent !bg-pink-600/85 !text-white" disabled={!(activeItem.duration > 0)} onClick={() => onApplyRange(activeItem)}>{featureMessage(language, "video.messages.VideoTrimLane.applyRangeToEntireGroup")}</Button>
          </div>
        </div>
      )}

      <div className={cn("group-trim-editor mt-3 rounded-[14px] border border-pink-600/15 bg-pink-600/10 p-[11px]", fullscreen && "hidden")}>
        <div className="group-trim-heading mb-[9px] flex items-center justify-between gap-2.5 max-[620px]:flex-col max-[620px]:items-start"><span className="flex items-center gap-[7px] text-pink-700 dark:text-pink-300"><Scissors size={17} /><strong className="text-sm text-foreground">{featureMessage(language, "video.messages.VideoGroupSection.groupTrimRanges", { p0: group })}</strong></span><small className="text-[13px] text-muted-foreground">{featureMessage(language, "video.messages.VideoGroupSection.eachVideoCanUseADifferentRange")}</small></div>
        {rangeNotice && <div className="video-range-notice mb-2 rounded-lg bg-pink-600/10 px-[9px] py-2 text-xs font-bold leading-relaxed text-pink-800 dark:text-pink-300" aria-live="polite">{rangeNotice}</div>}
        {items.map((item, groupIndex) => (
          <VideoTrimLane
            key={item.id}
            item={item}
            index={groupIndex}
            active={activeId === item.id}
            groupSize={items.length}
            synchronizationKey={synchronizationKey}
            language={language}
            onActivate={() => activateItem(item.id)}
            onStart={(value, seek) => { onUpdateItem(item.id, { start: value }); if (seek) seekItem(item, value); }}
            onEnd={(value, seek) => { onUpdateItem(item.id, { end: value }); if (seek) seekItem(item, value); }}
            onBoundary={(boundary) => setCurrentAsBoundary(item, boundary)}
            onPlay={() => playItemRange(item)}
            onNudge={(delta) => nudgeItem(item, delta)}
            onApplyGroup={() => onApplyRange(item)}
          />
        ))}
      </div>
    </section>
  );
}, areVideoGroupRenderInputsEqual);

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${rest.toFixed(2).padStart(5, "0")}`;
}
