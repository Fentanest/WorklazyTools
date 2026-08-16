import { ChevronLeft, ChevronRight, Expand, Film, Gauge, GripVertical, Link2, Pause, Play, Scissors, Volume2, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type DragEvent, type MutableRefObject } from "react";

import { SegmentedControl, formatBytes } from "../../components/ui";
import { featureMessage } from "../../i18n/featureMessages";
import type { AppLanguage } from "../../i18n/languages";
import { MAX_VIDEO_GROUP, VIDEO_GROUP_IDS, type VideoGroupId, type VideoGroupSettings, type VideoItem } from "./types";
import { VideoTrimLane } from "./VideoTrimLane";
import { areVideoGroupRenderInputsEqual } from "./videoMemo";

interface VideoGroupSectionProps {
  group: VideoGroupId;
  items: VideoItem[];
  settings: VideoGroupSettings;
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
  onNotice: (message: string) => void;
}

export const VideoGroupSection = memo(function VideoGroupSection({
  group,
  items,
  settings,
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
  onNotice,
}: VideoGroupSectionProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const playheadInputRef = useRef<HTMLInputElement | null>(null);
  const playheadLabelRef = useRef<HTMLElement | null>(null);
  const expectedSeeks = useRef(new Map<string, number>());
  const syncing = useRef(false);
  const [draggedId, setDraggedId] = useState<string>();
  const [fullscreen, setFullscreen] = useState(false);
  const audioItemId = settings.audioItemId && items.some((item) => item.id === settings.audioItemId) ? settings.audioItemId : items[0].id;
  const groupDuration = Math.max(...items.map((item) => item.duration || 0), 0.01);
  const synchronizationKey = `${settings.sync}:${items.map((item) => `${item.id}:${item.duration}`).join("|")}`;

  const updatePlayhead = useCallback((value: number) => {
    const input = playheadInputRef.current;
    if (input) input.value = String(Math.min(Number(input.max) || value, value));
    if (playheadLabelRef.current) playheadLabelRef.current.textContent = formatTime(value);
  }, []);

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

  const openFullscreen = useCallback(async () => {
    const element = containerRef.current;
    if (!element?.requestFullscreen) {
      onNotice(featureMessage(language, "video.messages.VideoGroupSection.thisBrowserDoesNotSupportSplitFullscreen"));
      return;
    }
    try {
      await element.requestFullscreen();
      setFullscreen(true);
    } catch {
      onNotice(featureMessage(language, "video.messages.VideoGroupSection.unableToEnterFullscreenCheckTheBrowserS"));
    }
  }, [language, onNotice]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const drop = (event: DragEvent, targetId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.dataTransfer.getData("text/plain");
    if (itemId) onMoveItem(itemId, group, targetId);
    setDraggedId(undefined);
  };

  return (
    <section
      className={`video-sync-group${fullscreen ? " is-fullscreen" : ""}`}
      ref={containerRef}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
      onDrop={(event) => drop(event)}
    >
      <header className="video-group-header">
        <span className="video-group-title"><Link2 size={16} /><span><strong>{featureMessage(language, "video.messages.VideoGroupSection.group")} {group}</strong><small>{featureMessage(language, "video.messages.VideoGroupSection.videosExportedInCardOrder", { p0: items.length })}</small></span></span>
        <div className="video-group-output-mode">
          <SegmentedControl value={settings.outputMode} options={[{ value: "individual", label: featureMessage(language, "video.messages.VideoGroupSection.individual") }, { value: "concat", label: featureMessage(language, "video.messages.VideoGroupSection.concatenate") }]} onChange={(value) => onUpdateSettings(group, { outputMode: value })} label={featureMessage(language, "video.messages.VideoGroupSection.groupOutputMode", { p0: group })} />
        </div>
        <div className="video-group-actions">
          <label className="compact-sync-toggle"><input type="checkbox" checked={settings.sync} disabled={items.length < 2} onChange={(event) => onUpdateSettings(group, { sync: event.target.checked })} /><span>{featureMessage(language, "video.messages.VideoGroupSection.syncPlayback")}</span></label>
          {items.length > 1 && <button type="button" className="secondary-button small" onClick={() => void openFullscreen()}><Expand size={15} /> {featureMessage(language, "video.messages.VideoGroupSection.splitFullscreen")}</button>}
        </div>
      </header>

      {items.length > 1 && (
        <div className="video-group-master-controls">
          <button type="button" aria-label={featureMessage(language, "video.messages.VideoGroupSection.playGroupTogether", { p0: group })} onClick={() => void Promise.all(items.map((item) => players.current[item.id]?.play().catch(() => undefined)))}><Play size={15} /></button>
          <button type="button" aria-label={featureMessage(language, "video.messages.VideoGroupSection.pauseGroupTogether", { p0: group })} onClick={() => items.forEach((item) => players.current[item.id]?.pause())}><Pause size={15} /></button>
          <input ref={playheadInputRef} type="range" min={0} max={groupDuration} step="0.01" defaultValue={0} aria-label={featureMessage(language, "video.messages.VideoGroupSection.groupPlayhead", { p0: group })} onChange={(event) => seekGroup(Number(event.target.value))} />
          <b ref={playheadLabelRef}>{formatTime(0)}</b>
          <label><Volume2 size={14} /><span>{featureMessage(language, "video.messages.VideoGroupSection.audio")}</span><select value={audioItemId} onChange={(event) => onUpdateSettings(group, { audioItemId: event.target.value })}>{items.map((item, index) => <option value={item.id} key={item.id}>{index + 1}. {item.file.name}</option>)}</select></label>
        </div>
      )}

      <div className={`multi-video-grid count-${items.length}`}>
        {items.map((item, groupIndex) => {
          const mutedForGroupView = items.length > 1 && (settings.sync || fullscreen) && audioItemId !== item.id;
          return (
            <article
              className={`${activeId === item.id ? "active" : ""}${draggedId === item.id ? " dragging" : ""}`}
              key={item.id}
              onClick={() => onActivate(item.id)}
              onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; }}
              onDrop={(event) => drop(event, item.id)}
            >
              <div
                className="video-drag-handle"
                draggable
                title={featureMessage(language, "video.messages.VideoGroupSection.dragToReorderOrChangeGroup")}
                onDragStart={(event) => { setDraggedId(item.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); }}
                onDragEnd={() => setDraggedId(undefined)}
              ><GripVertical size={16} /><span>{groupIndex + 1}</span></div>
              <video
                ref={(element) => { players.current[item.id] = element; }}
                src={item.url}
                controls
                muted={mutedForGroupView}
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const duration = event.currentTarget.duration;
                  if (!Number.isFinite(duration) || duration <= 0) {
                    onProbeItem(item.id);
                    return;
                  }
                  onUpdateItem(item.id, { duration, width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight, end: item.end || duration, metadataSource: "browser", probing: false, metadataError: undefined });
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
                  if (audioItemId !== item.id) return;
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
              {item.metadataSource === "ffmpeg" && <div className="video-preview-fallback"><Film size={22} /><strong>{featureMessage(language, "video.messages.VideoGroupSection.noBrowserPreview")}</strong><span>{featureMessage(language, "video.messages.VideoGroupSection.metadataIsAvailableUseTheNumericFieldsBelow")}</span></div>}
              {item.probing && item.metadataSource !== "browser" && <div className="video-preview-fallback"><Gauge size={22} /><strong>{featureMessage(language, "video.messages.VideoGroupSection.readingVideoMetadata")}</strong><span>{featureMessage(language, "video.messages.VideoGroupSection.preparingTheFfmpegCompatibilityPath")}</span></div>}
              <div className="video-card-footer">
                <span><strong>{groupIndex + 1}. {item.file.name}</strong><small>{formatBytes(item.file.size)} · {item.duration ? `${formatTime(item.duration)}${item.metadataSource === "ffmpeg" ? featureMessage(language, "video.messages.VideoGroupSection.metadataReadyForConversion") : ""}` : item.metadataError || featureMessage(language, "video.messages.VideoGroupSection.readingPlaybackMetadata")}</small>{item.metadataSource === "browser" && item.frameRateProbeStatus === "running" && <small>{featureMessage(language, "video.messages.VideoGroupSection.checkingFrameRateWithoutBlockingExport")}</small>}{item.metadataSource === "browser" && (item.frameRateProbeStatus === "done" || item.frameRateProbeStatus === "failed") && !(item.frameRate && item.frameRate > 0) && <small>{featureMessage(language, "video.messages.VideoGroupSection.frameRateUnavailableUsingTenthsOfASecond")}</small>}</span>
                <span className="video-card-actions">
                  <button type="button" disabled={item.group === 1} aria-label={featureMessage(language, "video.messages.VideoGroupSection.moveToThePreviousGroup", { p0: item.file.name })} onClick={(event) => { event.stopPropagation(); onMoveItem(item.id, Math.max(1, item.group - 1) as VideoGroupId); }}><ChevronLeft size={14} /></button>
                  <label className="video-group-select"><span className="visually-hidden">{item.file.name} {featureMessage(language, "video.messages.VideoGroupSection.group2")}</span><select value={item.group} aria-label={featureMessage(language, "video.messages.VideoGroupSection.moveToAGroup", { p0: item.file.name })} onClick={(event) => event.stopPropagation()} onChange={(event) => onMoveItem(item.id, Number(event.target.value) as VideoGroupId)}>{VIDEO_GROUP_IDS.map((id) => <option value={id} key={id}>{featureMessage(language, "video.messages.VideoGroupSection.group")} {id}</option>)}</select></label>
                  <button type="button" disabled={item.group === MAX_VIDEO_GROUP} aria-label={featureMessage(language, "video.messages.VideoGroupSection.moveToTheNextGroup", { p0: item.file.name })} onClick={(event) => { event.stopPropagation(); onMoveItem(item.id, Math.min(MAX_VIDEO_GROUP, item.group + 1) as VideoGroupId); }}><ChevronRight size={14} /></button>
                  <button type="button" aria-label={featureMessage(language, "video.messages.VideoGroupSection.remove", { p0: item.file.name })} onClick={(event) => { event.stopPropagation(); onRemoveItem(item.id); }}><X size={14} /></button>
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="group-trim-editor">
        <div className="group-trim-heading"><span><Scissors size={17} /><strong>{featureMessage(language, "video.messages.VideoGroupSection.groupTrimRanges", { p0: group })}</strong></span><small>{featureMessage(language, "video.messages.VideoGroupSection.eachVideoCanUseADifferentRange")}</small></div>
        {items.map((item, groupIndex) => (
          <VideoTrimLane
            key={item.id}
            item={item}
            index={groupIndex}
            active={activeId === item.id}
            groupSize={items.length}
            synchronizationKey={synchronizationKey}
            language={language}
            onActivate={() => onActivate(item.id)}
            onStart={(value, seek) => { onUpdateItem(item.id, { start: value }); if (seek) seekItem(item, value); }}
            onEnd={(value, seek) => { onUpdateItem(item.id, { end: value }); if (seek) seekItem(item, value); }}
            onBoundary={(boundary) => {
              const current = players.current[item.id]?.currentTime ?? 0;
              if (boundary === "start") onUpdateItem(item.id, { start: Math.max(0, Math.min(current, item.end - 0.05)) });
              else onUpdateItem(item.id, { end: Math.min(item.duration, Math.max(current, item.start + 0.05)) });
            }}
            onPlay={() => { const player = players.current[item.id]; if (player) { player.currentTime = item.start; void player.play(); } }}
            onNudge={(delta) => seekItem(item, Math.min(item.duration, Math.max(0, (players.current[item.id]?.currentTime ?? item.start) + delta)))}
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
