import {
  ChevronLeft,
  ChevronRight,
  Download,
  Expand,
  Film,
  Gauge,
  GripVertical,
  Link2,
  ListVideo,
  Music2,
  Pause,
  Play,
  Scissors,
  Sparkles,
  Timer,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";

import { OperationProgress } from "../../components/OperationProgress";
import { PrivacyBanner } from "../../components/PrivacyBanner";
import { ToolGuide } from "../../components/ToolGuide";
import { FileDropZone, PageHeader, PrimaryButton, SectionCard, SegmentedControl, ToggleRow, formatBytes } from "../../components/ui";
import { useOperationProgress } from "../../hooks/useOperationProgress";
import type {
  VideoAspect,
  VideoAudioBitrate,
  VideoBitrate,
  VideoCodec,
  VideoOutputFormat,
  VideoOutputJob,
  VideoResolution,
  VideoTask,
  VideoWorkerInput,
} from "./types";
import { runVideoTask } from "./videoWorkerClient";

type VideoGroupId = 1 | 2 | 3 | 4 | 5 | 6;
type GroupOutputMode = "individual" | "concat";

interface VideoItem {
  id: string;
  file: File;
  buffer: ArrayBuffer;
  url: string;
  duration: number;
  width: number;
  height: number;
  start: number;
  end: number;
  group: VideoGroupId;
}

interface GroupSettings {
  sync: boolean;
  outputMode: GroupOutputMode;
  audioItemId?: string;
}

interface VideoJobEntry {
  name: string;
  mode: "individual" | "concat";
  items: VideoItem[];
}

const GROUP_IDS: VideoGroupId[] = [1, 2, 3, 4, 5, 6];

export function VideoStudioPage() {
  const [items, setItems] = useState<VideoItem[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [groupSettings, setGroupSettings] = useState<Record<VideoGroupId, GroupSettings>>(createGroupSettings);
  const [draggedId, setDraggedId] = useState<string>();
  const [fullscreenGroup, setFullscreenGroup] = useState<VideoGroupId>();
  const [groupPlayheads, setGroupPlayheads] = useState<Record<VideoGroupId, number>>(() => createGroupValues(0));
  const [allGroupsOneFile, setAllGroupsOneFile] = useState(false);
  const [outputFormat, setOutputFormat] = useState<VideoOutputFormat>("mp4");
  const [codec, setCodec] = useState<VideoCodec>("h264");
  const [resolution, setResolution] = useState<VideoResolution>("source");
  const [aspect, setAspect] = useState<VideoAspect>("source");
  const [crf, setCrf] = useState(23);
  const [bitrate, setBitrate] = useState<VideoBitrate>("copy");
  const [audioBitrate, setAudioBitrate] = useState<VideoAudioBitrate>("192k");
  const [gifFps, setGifFps] = useState<10 | 12 | 15 | 20>(12);
  const [gifWidth, setGifWidth] = useState<480 | 720 | 1080>(720);
  const [lastResult, setLastResult] = useState("");
  const progress = useOperationProgress();
  const players = useRef<Record<string, HTMLVideoElement | null>>({});
  const groupContainers = useRef<Partial<Record<VideoGroupId, HTMLElement | null>>>({});
  const itemsRef = useRef<VideoItem[]>([]);
  const syncing = useRef(false);
  const activeController = useRef<AbortController | undefined>(undefined);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setFullscreenGroup(undefined);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);
  useEffect(() => () => {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    activeController.current?.abort();
  }, []);

  const files = useMemo(() => items.map((item) => item.file), [items]);
  const active = items.find((item) => item.id === activeId);
  const usedGroups = useMemo(() => GROUP_IDS
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length), [items]);
  const ready = items.length > 0 && items.every((item) => item.duration > 0 && item.end > item.start);
  const isVideoOutput = outputFormat === "mp4" || outputFormat === "mkv" || outputFormat === "webm";
  const passthroughTransformConflict = isVideoOutput && bitrate === "copy" && (resolution !== "source" || aspect !== "source");
  const passthroughConcatConflict = isVideoOutput && bitrate === "copy" && hasIncompatibleConcatDimensions(items, usedGroups, groupSettings, allGroupsOneFile);
  const passthroughConflict = passthroughTransformConflict || passthroughConcatConflict;
  const outputCount = allGroupsOneFile
    ? (items.length ? 1 : 0)
    : usedGroups.reduce((count, entry) => count + (groupSettings[entry.group].outputMode === "concat" ? 1 : entry.items.length), 0);

  const handleFiles = async (nextFiles: File[]) => {
    const supported = nextFiles.filter((file) => file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(file.name));
    const unique = supported.filter((file, index) => supported.findIndex((candidate) => fileKey(candidate) === fileKey(file)) === index).slice(0, 6);
    const existing = new Map(items.map((item) => [fileKey(item.file), item]));
    const hasNewFiles = unique.some((file) => !existing.has(fileKey(file)));
    if (hasNewFiles) progress.start("선택한 영상을 브라우저 메모리에 안전하게 복사하는 중…");
    const prepared: Array<VideoItem | { file: File; buffer: ArrayBuffer }> = [];
    try {
      for (let index = 0; index < unique.length; index += 1) {
        const file = unique[index];
        const current = existing.get(fileKey(file));
        if (current) {
          prepared.push(current);
          continue;
        }
        const start = 4 + (index / unique.length) * 90;
        const span = 90 / unique.length;
        const buffer = await readVideoFile(file, (loaded, total, attempt) => {
          const ratio = total > 0 ? loaded / total : 0;
          progress.update(start + ratio * span, `[${index + 1}/${unique.length}] ${file.name} 읽는 중${attempt > 1 ? ` · 재시도 ${attempt}` : ""}… ${formatBytes(loaded)} / ${formatBytes(total)}`);
        });
        prepared.push({ file, buffer });
      }
    } catch (error) {
      progress.fail(toUserFacingVideoError(error));
      return;
    }
    const next = prepared.map((entry) => "id" in entry ? entry : {
      id: createId(),
      file: entry.file,
      buffer: entry.buffer,
      url: URL.createObjectURL(new Blob([entry.buffer], { type: entry.file.type || "video/mp4" })),
      duration: 0,
      width: 0,
      height: 0,
      start: 0,
      end: 0,
      group: 1 as VideoGroupId,
    });
    items.forEach((item) => { if (!next.includes(item)) URL.revokeObjectURL(item.url); });
    setItems(next);
    setActiveId((current) => next.some((item) => item.id === current) ? current : next[0]?.id);
    setLastResult(nextFiles.length > 6 ? "최대 6개까지만 추가할 수 있어 앞의 6개 영상을 유지했습니다." : "");
    progress.reset();
  };

  const removeItem = (itemId: string) => {
    const target = items.find((item) => item.id === itemId);
    if (target) URL.revokeObjectURL(target.url);
    const next = items.filter((item) => item.id !== itemId);
    setItems(next);
    if (activeId === itemId) setActiveId(next[0]?.id);
    delete players.current[itemId];
  };

  const updateItem = (itemId: string, patch: Partial<VideoItem>) => {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, ...patch } : item));
  };

  const updateGroup = (group: VideoGroupId, patch: Partial<GroupSettings>) => {
    setGroupSettings((current) => ({ ...current, [group]: { ...current[group], ...patch } }));
  };

  const moveItem = (itemId: string, group: VideoGroupId, targetId?: string) => {
    setItems((current) => {
      const moved = current.find((item) => item.id === itemId);
      if (!moved) return current;
      const remaining = current.filter((item) => item.id !== itemId);
      const movedItem = { ...moved, group };
      if (!targetId || targetId === itemId) {
        const lastGroupIndex = remaining.reduce((last, item, index) => item.group === group ? index : last, -1);
        remaining.splice(lastGroupIndex + 1, 0, movedItem);
        return remaining;
      }
      const targetIndex = remaining.findIndex((item) => item.id === targetId);
      if (targetIndex < 0) return [...remaining, movedItem];
      remaining.splice(targetIndex, 0, movedItem);
      return remaining;
    });
    setActiveId(itemId);
  };

  const dropOnGroup = (event: DragEvent, group: VideoGroupId, targetId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const itemId = draggedId || event.dataTransfer.getData("text/plain");
    if (itemId) moveItem(itemId, group, targetId);
    setDraggedId(undefined);
  };

  const moveToAdjacentGroup = (item: VideoItem, direction: -1 | 1) => {
    const next = Math.min(6, Math.max(1, item.group + direction)) as VideoGroupId;
    if (next !== item.group) moveItem(item.id, next);
  };

  const synchronizePlayers = async (sourceId: string, action: "play" | "pause" | "seek") => {
    const sourceItem = itemsRef.current.find((item) => item.id === sourceId);
    if (!sourceItem || !groupSettings[sourceItem.group].sync || syncing.current) return;
    const source = players.current[sourceId];
    if (!source) return;
    syncing.current = true;
    try {
      await Promise.all(itemsRef.current.map(async (item) => {
        const player = players.current[item.id];
        if (!player || item.id === sourceId || item.group !== sourceItem.group) return;
        player.currentTime = Math.min(source.currentTime, Number.isFinite(player.duration) ? player.duration : source.currentTime);
        if (action === "play") await player.play().catch(() => undefined);
        if (action === "pause") player.pause();
      }));
    } finally {
      window.requestAnimationFrame(() => { syncing.current = false; });
    }
  };

  const seekItem = (item: VideoItem, value: number) => {
    const player = players.current[item.id];
    if (player) player.currentTime = value;
    setGroupPlayheads((current) => ({ ...current, [item.group]: value }));
    void synchronizePlayers(item.id, "seek");
  };

  const setBoundaryFromPlayer = (item: VideoItem, kind: "start" | "end") => {
    const current = players.current[item.id]?.currentTime ?? 0;
    if (kind === "start") updateItem(item.id, { start: Math.max(0, Math.min(current, item.end - 0.05)) });
    else updateItem(item.id, { end: Math.min(item.duration, Math.max(current, item.start + 0.05)) });
  };

  const applyRangeToGroup = (source: VideoItem) => {
    setItems((current) => current.map((item) => item.group !== source.group ? item : {
      ...item,
      start: Math.min(source.start, Math.max(0, item.duration - 0.05)),
      end: Math.min(source.end, item.duration),
    }));
  };

  const playGroup = async (group: VideoGroupId) => {
    await Promise.all(itemsRef.current.filter((item) => item.group === group).map((item) => players.current[item.id]?.play().catch(() => undefined)));
  };

  const pauseGroup = (group: VideoGroupId) => {
    itemsRef.current.filter((item) => item.group === group).forEach((item) => players.current[item.id]?.pause());
  };

  const seekGroup = (group: VideoGroupId, value: number) => {
    setGroupPlayheads((current) => ({ ...current, [group]: value }));
    itemsRef.current.filter((item) => item.group === group).forEach((item) => {
      const player = players.current[item.id];
      if (player) player.currentTime = Math.min(value, item.duration);
    });
  };

  const openGroupFullscreen = async (group: VideoGroupId) => {
    const element = groupContainers.current[group];
    if (!element?.requestFullscreen) {
      setLastResult("이 브라우저에서는 분할 전체화면을 지원하지 않습니다.");
      return;
    }
    try {
      await element.requestFullscreen();
      setFullscreenGroup(group);
    } catch {
      setLastResult("전체화면을 열지 못했습니다. 브라우저의 전체화면 권한을 확인해 주세요.");
    }
  };

  const outputAction = async () => {
    if (!ready || !validateSegments(items) || passthroughConflict) return;
    const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);
    if (totalSize > 500 * 1024 * 1024 && !window.confirm("선택한 영상의 합계가 500MB를 넘습니다. 브라우저 메모리 부족으로 중단될 수 있는데 계속할까요?")) return;
    const task = createTask({ outputFormat, codec, resolution, aspect, crf, bitrate, audioBitrate, gifFps, gifWidth });
    const jobEntries = createJobEntries(items, usedGroups, groupSettings, allGroupsOneFile);
    await executeTask(async (controller) => {
      const jobs: VideoOutputJob[] = await Promise.all(jobEntries.map(async (job) => ({
        name: job.name,
        mode: job.mode,
        inputs: await Promise.all(job.items.map(toWorkerInput)),
      })));
      return runVideoTask({ mode: "batch", jobs, task }, progress.update, controller.signal);
    });
  };

  const executeTask = async (task: (controller: AbortController) => ReturnType<typeof runVideoTask>) => {
    const controller = new AbortController();
    activeController.current = controller;
    progress.start("그룹별 영상 파일을 브라우저 메모리로 읽는 중…");
    setLastResult("");
    try {
      const result = await task(controller);
      downloadResult(result.buffer, result.mimeType, result.fileName);
      setLastResult(`${result.fileName}을 내려받았습니다.${result.warnings.length ? ` ${result.warnings[0]}` : ""}`);
      progress.succeed(`${result.fileName} 생성 완료`);
    } catch (error) {
      progress.fail(error instanceof DOMException && error.name === "AbortError" ? "비디오 작업을 취소했습니다." : toUserFacingVideoError(error));
    } finally {
      if (activeController.current === controller) activeController.current = undefined;
    }
  };

  const validateSegments = (targets: VideoItem[]) => {
    const invalid = targets.find((item) => !item.duration || item.end <= item.start);
    if (!invalid) return true;
    progress.start("구간 설정을 확인하는 중…");
    progress.fail(`${invalid.file.name}: 종료 시간은 시작 시간보다 뒤여야 합니다.`);
    return false;
  };

  const changeOutputFormat = (format: VideoOutputFormat) => {
    setOutputFormat(format);
    if (format === "webm") setCodec("vp9");
    setLastResult("");
    progress.reset();
  };

  return (
    <div className="page tool-page page-enter video-studio-page">
      <PageHeader eyebrow="VIDEO STUDIO" title="비디오 스튜디오" description="최대 6개 영상을 6개 그룹으로 나누고, 그룹마다 개별 저장하거나 순서대로 이어붙이세요.">
        <PrivacyBanner compact />
      </PageHeader>

      <SectionCard step={1} title="비디오 선택" description="최대 6개 영상을 추가할 수 있습니다. 업로드 후 그룹 박스 안에서 순서와 출력 방식을 정합니다.">
        <FileDropZone files={files} onFiles={handleFiles} accept="video/*,.mkv,.avi" multiple hint="MP4·MOV·WebM·MKV·AVI · 최대 6개" accent="pink" />
      </SectionCard>

      {items.length > 0 && (
        <SectionCard step={2} title="그룹별 미리보기와 구간 설정" description="영상을 끌어서 같은 그룹 안의 순서를 바꾸거나 다른 그룹으로 옮길 수 있습니다.">
          <div className="video-sync-groups">
            {usedGroups.map(({ group, items: groupItems }) => {
              const settings = groupSettings[group];
              const audioItemId = settings.audioItemId && groupItems.some((item) => item.id === settings.audioItemId) ? settings.audioItemId : groupItems[0].id;
              const groupDuration = Math.max(...groupItems.map((item) => item.duration || 0), 0.01);
              return (
                <section
                  className={`video-sync-group${fullscreenGroup === group ? " is-fullscreen" : ""}`}
                  key={group}
                  ref={(element) => { groupContainers.current[group] = element; }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                  onDrop={(event) => dropOnGroup(event, group)}
                >
                  <header className="video-group-header">
                    <span className="video-group-title"><Link2 size={16} /><span><strong>그룹 {group}</strong><small>{groupItems.length}개 영상 · 카드 순서대로 출력</small></span></span>
                    <div className="video-group-output-mode">
                      <SegmentedControl value={settings.outputMode} options={[{ value: "individual", label: "개별 출력" }, { value: "concat", label: "이어붙이기" }]} onChange={(value) => updateGroup(group, { outputMode: value })} label={`그룹 ${group} 출력 방식`} />
                    </div>
                    <div className="video-group-actions">
                      <label className="compact-sync-toggle"><input type="checkbox" checked={settings.sync} disabled={groupItems.length < 2} onChange={(event) => updateGroup(group, { sync: event.target.checked })} /><span>동기 재생</span></label>
                      {groupItems.length > 1 && <button type="button" className="secondary-button small" onClick={() => void openGroupFullscreen(group)}><Expand size={15} /> 분할 전체화면</button>}
                    </div>
                  </header>

                  {groupItems.length > 1 && (
                    <div className="video-group-master-controls">
                      <button type="button" aria-label={`그룹 ${group} 함께 재생`} onClick={() => void playGroup(group)}><Play size={15} /></button>
                      <button type="button" aria-label={`그룹 ${group} 함께 정지`} onClick={() => pauseGroup(group)}><Pause size={15} /></button>
                      <input type="range" min={0} max={groupDuration} step="0.01" value={Math.min(groupPlayheads[group], groupDuration)} aria-label={`그룹 ${group} 공통 재생 위치`} onChange={(event) => seekGroup(group, Number(event.target.value))} />
                      <b>{formatTime(groupPlayheads[group])}</b>
                      <label><Volume2 size={14} /><span>소리</span><select value={audioItemId} onChange={(event) => updateGroup(group, { audioItemId: event.target.value })}>{groupItems.map((item, index) => <option value={item.id} key={item.id}>{index + 1}. {item.file.name}</option>)}</select></label>
                    </div>
                  )}

                  <div className={`multi-video-grid count-${groupItems.length}`}>
                    {groupItems.map((item, groupIndex) => {
                      const mutedForGroupView = groupItems.length > 1 && (settings.sync || fullscreenGroup === group) && audioItemId !== item.id;
                      return (
                        <article
                          className={`${activeId === item.id ? "active" : ""}${draggedId === item.id ? " dragging" : ""}`}
                          key={item.id}
                          onClick={() => setActiveId(item.id)}
                          onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move"; }}
                          onDrop={(event) => dropOnGroup(event, group, item.id)}
                        >
                          <div
                            className="video-drag-handle"
                            draggable
                            title="드래그하여 순서 또는 그룹 이동"
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
                              updateItem(item.id, { duration, width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight, end: item.end || duration });
                            }}
                            onPlay={() => void synchronizePlayers(item.id, "play")}
                            onPause={() => void synchronizePlayers(item.id, "pause")}
                            onSeeked={() => void synchronizePlayers(item.id, "seek")}
                            onTimeUpdate={(event) => {
                              if (audioItemId === item.id) {
                                const currentTime = event.currentTarget.currentTime;
                                setGroupPlayheads((current) => ({ ...current, [group]: currentTime }));
                              }
                            }}
                          />
                          <div className="video-card-footer">
                            <span><strong>{groupIndex + 1}. {item.file.name}</strong><small>{formatBytes(item.file.size)} · {item.duration ? formatTime(item.duration) : "재생 정보 확인 중…"}</small></span>
                            <span className="video-card-actions">
                              <button type="button" disabled={item.group === 1} aria-label={`${item.file.name} 왼쪽 그룹으로 이동`} onClick={(event) => { event.stopPropagation(); moveToAdjacentGroup(item, -1); }}><ChevronLeft size={14} /></button>
                              <label className="video-group-select"><span className="visually-hidden">{item.file.name} 그룹</span><select value={item.group} aria-label={`${item.file.name} 그룹 이동`} onClick={(event) => event.stopPropagation()} onChange={(event) => moveItem(item.id, Number(event.target.value) as VideoGroupId)}>{GROUP_IDS.map((id) => <option value={id} key={id}>그룹 {id}</option>)}</select></label>
                              <button type="button" disabled={item.group === 6} aria-label={`${item.file.name} 오른쪽 그룹으로 이동`} onClick={(event) => { event.stopPropagation(); moveToAdjacentGroup(item, 1); }}><ChevronRight size={14} /></button>
                              <button type="button" aria-label={`${item.file.name} 제거`} onClick={(event) => { event.stopPropagation(); removeItem(item.id); }}><X size={14} /></button>
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="group-trim-editor">
                    <div className="group-trim-heading"><span><Scissors size={17} /><strong>그룹 {group} 구간 설정</strong></span><small>각 영상에 서로 다른 구간을 지정할 수 있습니다.</small></div>
                    {groupItems.map((item, groupIndex) => item.duration > 0 ? (
                      <div className={`video-trim-lane${activeId === item.id ? " active" : ""}`} key={item.id} onClick={() => setActiveId(item.id)}>
                        <div className="video-trim-lane-title"><strong>{groupIndex + 1}. {item.file.name}</strong><b>{formatTime(item.start)} — {formatTime(item.end)}</b></div>
                        <div
                          className="video-range-control"
                          style={{ "--range-start": `${item.start / item.duration * 100}%`, "--range-end": `${item.end / item.duration * 100}%` } as CSSProperties}
                        >
                          <span className="video-range-selection" />
                          <input aria-label={`${item.file.name} 시작 지점`} type="range" min={0} max={item.duration} step="0.01" value={item.start} onChange={(event) => { const value = Math.min(Number(event.target.value), item.end - 0.05); updateItem(item.id, { start: value }); seekItem(item, value); }} />
                          <input aria-label={`${item.file.name} 종료 지점`} type="range" min={0} max={item.duration} step="0.01" value={item.end} onChange={(event) => { const value = Math.max(Number(event.target.value), item.start + 0.05); updateItem(item.id, { end: value }); seekItem(item, value); }} />
                        </div>
                        <div className="video-range-values">
                          <label><span>시작</span><input type="number" min={0} max={item.end} step="0.1" value={item.start.toFixed(1)} onChange={(event) => updateItem(item.id, { start: Math.max(0, Math.min(Number(event.target.value), item.end - 0.05)) })} /></label>
                          <small>선택 구간 {formatTime(item.end - item.start)}</small>
                          <label><span>종료</span><input type="number" min={item.start} max={item.duration} step="0.1" value={item.end.toFixed(1)} onChange={(event) => updateItem(item.id, { end: Math.min(item.duration, Math.max(Number(event.target.value), item.start + 0.05)) })} /></label>
                        </div>
                        <div className="trim-play-buttons">
                          <button type="button" className="secondary-button small" onClick={() => setBoundaryFromPlayer(item, "start")}><Timer size={14} /> 현재 위치→시작</button>
                          <button type="button" className="secondary-button small" onClick={() => setBoundaryFromPlayer(item, "end")}><Timer size={14} /> 현재 위치→종료</button>
                          <button type="button" className="secondary-button small" onClick={() => { const player = players.current[item.id]; if (player) { player.currentTime = item.start; void player.play(); } }}><Play size={14} /> 구간 재생</button>
                          {groupItems.length > 1 && <button type="button" className="secondary-button small" onClick={() => applyRangeToGroup(item)}>이 구간을 그룹 전체에 적용</button>}
                        </div>
                      </div>
                    ) : <div className="video-trim-loading" key={item.id}>{item.file.name} 재생 정보를 확인하는 중…</div>)}
                  </div>
                </section>
              );
            })}
          </div>
        </SectionCard>
      )}

      {items.length > 0 && (
        <SectionCard step={3} title="출력 설정" description="별도 작업을 고를 필요 없이 출력 형식이 GIF 생성, 음원 추출 또는 영상 출력을 결정합니다.">
          <div className="video-output-format-grid">
            <label><span>출력 형식</span><select value={outputFormat} onChange={(event) => changeOutputFormat(event.target.value as VideoOutputFormat)}><option value="mp4">MP4 영상</option><option value="mkv">MKV 영상</option><option value="webm">WebM 영상</option><option value="gif">GIF 움짤</option><option value="mp3">MP3 음원</option><option value="aac">AAC 음원</option></select></label>
            <div className="video-output-count"><ListVideo size={18} /><span><strong>{outputCount}개 결과 파일</strong><small>{outputCount > 1 ? "ZIP으로 한 번에 내려받습니다." : "완료 후 바로 내려받습니다."}</small></span></div>
          </div>

          {isVideoOutput && (
            <EncodingSettings
              container={outputFormat}
              codec={codec}
              resolution={resolution}
              aspect={aspect}
              crf={crf}
              bitrate={bitrate}
              onCodec={setCodec}
              onResolution={setResolution}
              onAspect={setAspect}
              onCrf={setCrf}
              onBitrate={setBitrate}
            />
          )}

          {outputFormat === "gif" && <div className="quick-tool-settings"><label><span>GIF 초당 프레임</span><select value={gifFps} onChange={(event) => setGifFps(Number(event.target.value) as 10 | 12 | 15 | 20)}><option value={10}>10 fps · 작은 용량</option><option value={12}>12 fps · 권장</option><option value={15}>15 fps</option><option value={20}>20 fps · 부드럽게</option></select></label><label><span>최대 가로 크기</span><select value={gifWidth} onChange={(event) => setGifWidth(Number(event.target.value) as 480 | 720 | 1080)}><option value={480}>480px</option><option value={720}>720px · 권장</option><option value={1080}>1080px</option></select></label></div>}
          {(outputFormat === "mp3" || outputFormat === "aac") && <div className="quick-tool-settings single"><label><span>오디오 비트레이트</span><select value={audioBitrate} onChange={(event) => setAudioBitrate(event.target.value as VideoAudioBitrate)}><option value="128k">128 kbps</option><option value="192k">192 kbps · 권장</option><option value="256k">256 kbps</option><option value="320k">320 kbps</option></select></label></div>}

          <div className="video-global-output-toggle"><ToggleRow label="모든 그룹을 한 파일로 이어붙이기" description="그룹 번호와 그룹 내부 카드 순서대로 연결하며, 그룹별 개별·이어붙이기 설정을 이번 출력에만 덮어씁니다." checked={allGroupsOneFile} onChange={setAllGroupsOneFile} /></div>

          {isVideoOutput && bitrate === "copy" && !passthroughConflict && <div className="inline-warning"><Gauge size={17} /><span>패스스루는 재인코딩 없이 원본 스트림을 복사합니다. 빠르고 화질 손실이 없지만 시작점이 키프레임 경계에 맞춰질 수 있으며, 서로 다른 영상은 이어붙이지 못할 수 있습니다.</span></div>}
          {passthroughTransformConflict && <div className="inline-warning error"><Gauge size={17} /><span>화면 비율 변경 또는 해상도 일괄 변경에는 인코딩이 필요합니다. 두 설정을 원본 유지로 되돌리거나 CRF 자동·지정 비트레이트를 선택하세요.</span></div>}
          {!passthroughTransformConflict && passthroughConcatConflict && <div className="inline-warning error"><Gauge size={17} /><span>크기나 화면 비율이 다른 영상은 패스스루로 이어붙일 수 없습니다. CRF 자동·지정 비트레이트를 선택하면 각 영상의 원본 비율을 유지하고 첫 영상 크기의 화면에 맞춰 연결합니다.</span></div>}
          {outputFormat === "gif" && <div className="video-output-note"><Sparkles size={17} /><span>각 그룹의 선택 구간을 설정한 순서와 출력 방식대로 GIF로 만듭니다.</span></div>}
          {(outputFormat === "mp3" || outputFormat === "aac") && <div className="video-output-note"><Music2 size={17} /><span>영상 화면은 제외하고 각 그룹의 선택 구간에서 음원만 추출합니다.</span></div>}

          <div className="video-output-summary">
            {allGroupsOneFile
              ? <p><strong>전체 그룹</strong><span>그룹 1→6 순서대로 이어붙이기</span><b>1개</b></p>
              : usedGroups.map(({ group, items: groupItems }) => <p key={group}><strong>그룹 {group}</strong><span>{groupSettings[group].outputMode === "concat" ? `${groupItems.length}개 영상을 순서대로 이어붙이기` : `${groupItems.length}개 영상을 각각 출력`}</span><b>{groupSettings[group].outputMode === "concat" ? 1 : groupItems.length}개</b></p>)}
          </div>
          <div className="section-actions"><PrimaryButton accent="pink" disabled={!ready || passthroughConflict} loading={progress.status === "running"} onClick={() => void outputAction()}><Download size={18} /> 설정대로 {outputCount}개 결과 만들기</PrimaryButton></div>
        </SectionCard>
      )}

      <OperationProgress {...progress} accent="pink" title="비디오 처리 로그" />
      {progress.status === "running" && <div className="cancel-operation"><button type="button" className="secondary-button" onClick={() => activeController.current?.abort()}>작업 취소</button></div>}
      {lastResult && <div className="inline-success"><Download size={18} /><span>{lastResult}</span></div>}

      <ToolGuide
        title="브라우저 비디오 처리 안내"
        description="영상 바이트는 외부 인코딩 서버에 업로드하지 않습니다. FFmpeg WebAssembly가 현재 브라우저의 전용 Worker 안에서 처리합니다."
        blocks={[
          { title: "그룹과 출력 방식", paragraphs: ["최대 6개 그룹에서 영상 순서를 드래그로 정합니다. 각 그룹은 영상을 각각 출력하거나 선택 구간만 순서대로 이어붙일 수 있습니다. 결과가 여러 개면 ZIP으로 묶습니다."] },
          { title: "패스스루와 정확도", paragraphs: ["패스스루는 원본 영상·음원 스트림을 그대로 복사해 빠르고 화질 손실이 없습니다. 키프레임 때문에 시작점이 조금 앞설 수 있으며, 서로 다른 코덱이나 해상도의 영상은 인코딩 없이 이어붙일 수 없습니다."] },
          { title: "동기 재생과 분할 전체화면", paragraphs: ["그룹 안의 영상을 함께 재생하고 공통 탐색 바로 위치를 맞출 수 있습니다. 분할 전체화면에서는 최대 6개 영상을 한 화면에서 비교하며 선택한 영상 하나의 소리만 듣습니다."] },
          { title: "성능과 메모리", paragraphs: ["입력과 중간 결과는 브라우저 메모리에 보관합니다. 여러 개의 긴 4K 영상은 메모리 부족으로 중단될 수 있으므로 필요한 구간을 먼저 줄이고 데스크톱 브라우저를 사용하는 것이 좋습니다."] },
        ]}
        faq={[
          { question: "영상이 서버로 전송되나요?", answer: "아니요. 선택한 파일은 브라우저 메모리와 FFmpeg Worker의 임시 파일 시스템에서만 사용합니다." },
          { question: "그룹별 출력은 어떻게 내려받나요?", answer: "결과가 하나면 해당 형식으로, 둘 이상이면 모든 결과가 든 ZIP으로 내려받습니다." },
          { question: "GIF와 음원 추출은 어디서 선택하나요?", answer: "출력 형식에서 GIF, MP3 또는 AAC를 고르면 필요한 설정만 자동으로 표시됩니다." },
          { question: "이어붙이면서 패스스루할 수 있나요?", answer: "코덱, 해상도와 스트림 구성이 호환되는 영상은 가능합니다. 호환되지 않으면 자동으로 품질을 바꾸지 않고 인코딩이 필요하다고 안내합니다." },
          { question: "왜 첫 실행이 오래 걸리나요?", answer: "FFmpeg 실행 코어를 처음 불러오고 WebAssembly 메모리를 준비하기 때문입니다. 브라우저 캐시에 저장되면 이후 다운로드는 빨라질 수 있습니다." },
        ]}
      />
    </div>
  );
}

function EncodingSettings({ container, codec, resolution, aspect, crf, bitrate, onCodec, onResolution, onAspect, onCrf, onBitrate }: {
  container: "mp4" | "mkv" | "webm";
  codec: VideoCodec;
  resolution: VideoResolution;
  aspect: VideoAspect;
  crf: number;
  bitrate: VideoBitrate;
  onCodec: (value: VideoCodec) => void;
  onResolution: (value: VideoResolution) => void;
  onAspect: (value: VideoAspect) => void;
  onCrf: (value: number) => void;
  onBitrate: (value: VideoBitrate) => void;
}) {
  const passthrough = bitrate === "copy";
  return (
    <div className="encoding-grid">
      <label><span>비디오 코덱</span><select value={codec} disabled={passthrough} onChange={(event) => onCodec(event.target.value as VideoCodec)}><option value="h264" disabled={container === "webm"}>H.264</option><option value="hevc" disabled={container === "webm"}>HEVC · 지원 시</option><option value="vp9">VP9</option></select></label>
      <label><span>해상도 일괄 변경</span><select value={resolution} disabled={passthrough} onChange={(event) => onResolution(event.target.value as VideoResolution)}><option value="source">변경 안 함</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option></select></label>
      <label><span>화면 비율</span><select value={aspect} disabled={passthrough} onChange={(event) => onAspect(event.target.value as VideoAspect)}><option value="source">원본 비율 유지</option><option value="9:16">9:16 세로</option><option value="1:1">1:1 정사각형</option><option value="16:9">16:9 가로</option></select></label>
      <label><span>비트레이트·처리 방식</span><select value={bitrate} onChange={(event) => onBitrate(event.target.value as VideoBitrate)}><option value="copy">패스스루 · 인코딩 없음</option><option value="0">CRF 자동</option><option value="2M">2 Mbps</option><option value="5M">5 Mbps</option><option value="8M">8 Mbps</option></select></label>
      <label className="crf-control"><span>화질 CRF <b>{crf}</b></span><input type="range" min={18} max={32} value={crf} disabled={passthrough} onChange={(event) => onCrf(Number(event.target.value))} /></label>
    </div>
  );
}

function createTask(settings: {
  outputFormat: VideoOutputFormat;
  codec: VideoCodec;
  resolution: VideoResolution;
  aspect: VideoAspect;
  crf: number;
  bitrate: VideoBitrate;
  audioBitrate: VideoAudioBitrate;
  gifFps: 10 | 12 | 15 | 20;
  gifWidth: 480 | 720 | 1080;
}): VideoTask {
  if (settings.outputFormat === "gif") return { kind: "gif", fps: settings.gifFps, width: settings.gifWidth };
  if (settings.outputFormat === "mp3" || settings.outputFormat === "aac") return { kind: "audio", format: settings.outputFormat, bitrate: settings.audioBitrate };
  return { kind: "encode", container: settings.outputFormat, codec: settings.codec, resolution: settings.resolution, aspect: settings.aspect, crf: settings.crf, bitrate: settings.bitrate };
}

function createJobEntries(
  items: VideoItem[],
  groups: Array<{ group: VideoGroupId; items: VideoItem[] }>,
  settings: Record<VideoGroupId, GroupSettings>,
  allGroupsOneFile: boolean,
): VideoJobEntry[] {
  if (allGroupsOneFile) return [{ name: "전체-그룹", mode: "concat" as const, items: groups.flatMap((group) => group.items) }];
  const entries: VideoJobEntry[] = [];
  groups.forEach(({ group, items: groupItems }) => {
    if (settings[group].outputMode === "concat") entries.push({ name: `그룹-${group}`, mode: "concat", items: groupItems });
    else groupItems.forEach((item, index) => entries.push({ name: `${item.file.name.replace(/\.[^.]+$/, "")}-그룹${group}-${index + 1}`, mode: "individual", items: [item] }));
  });
  return entries;
}

async function toWorkerInput(item: VideoItem): Promise<VideoWorkerInput> {
  return { fileName: item.file.name, buffer: item.buffer.slice(0), duration: item.duration, width: item.width, height: item.height, start: item.start, end: item.end };
}

function hasIncompatibleConcatDimensions(
  items: VideoItem[],
  groups: Array<{ group: VideoGroupId; items: VideoItem[] }>,
  settings: Record<VideoGroupId, GroupSettings>,
  allGroupsOneFile: boolean,
) {
  const targets = allGroupsOneFile ? [items] : groups.filter(({ group }) => settings[group].outputMode === "concat").map((group) => group.items);
  return targets.some((target) => target.length > 1 && target.some((item) => item.width !== target[0].width || item.height !== target[0].height));
}

function createGroupSettings() {
  return Object.fromEntries(GROUP_IDS.map((group) => [group, { sync: false, outputMode: "individual" as GroupOutputMode }])) as Record<VideoGroupId, GroupSettings>;
}

function createGroupValues<T>(value: T) {
  return Object.fromEntries(GROUP_IDS.map((group) => [group, value])) as Record<VideoGroupId, T>;
}

function createId() { return globalThis.crypto?.randomUUID?.() || `video-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function fileKey(file: File) { return `${file.name}:${file.size}:${file.lastModified}`; }

class VideoFileReadError extends Error {
  constructor(public readonly file: File, public readonly original: unknown) {
    super(original instanceof Error ? original.message : String(original));
    this.name = "VideoFileReadError";
  }
}

async function readVideoFile(file: File, onProgress: (loaded: number, total: number, attempt: number) => void) {
  if (!file.size) throw new VideoFileReadError(file, new Error("파일 크기가 0바이트입니다."));
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await readBlobWithFileReader(file, (loaded, total) => onProgress(loaded, total || file.size, attempt));
    } catch (error) {
      lastError = error;
      if (!isFileReadAccessError(error) || attempt === 2) break;
      await new Promise((resolve) => window.setTimeout(resolve, 240));
    }
  }

  // Chromium may fail one FileReader path for cloud-backed or temporarily
  // locked files while the Blob stream path remains available.
  try {
    return await readBlobStream(file, (loaded) => onProgress(loaded, file.size, 3));
  } catch (error) {
    throw new VideoFileReadError(file, error || lastError);
  }
}

function readBlobWithFileReader(blob: Blob, onProgress: (loaded: number, total: number) => void) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("progress", (event) => onProgress(event.loaded, event.lengthComputable ? event.total : blob.size));
    reader.addEventListener("load", () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("영상 파일을 바이너리 데이터로 변환하지 못했습니다."));
    }, { once: true });
    reader.addEventListener("error", () => reject(reader.error || new DOMException("영상 파일 읽기에 실패했습니다.", "NotReadableError")), { once: true });
    reader.addEventListener("abort", () => reject(new DOMException("영상 파일 읽기가 취소되었습니다.", "AbortError")), { once: true });
    reader.readAsArrayBuffer(blob);
  });
}

async function readBlobStream(blob: Blob, onProgress: (loaded: number) => void) {
  if (typeof blob.stream !== "function") return new Response(blob).arrayBuffer();
  const output = new Uint8Array(blob.size);
  const reader = blob.stream().getReader();
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > output.byteLength) throw new Error("영상 파일 크기가 읽는 도중 변경되었습니다.");
      output.set(value, offset);
      offset += value.byteLength;
      onProgress(offset);
    }
  } finally {
    reader.releaseLock();
  }
  if (offset !== output.byteLength) throw new Error(`영상 파일을 끝까지 읽지 못했습니다 (${formatBytes(offset)} / ${formatBytes(blob.size)}).`);
  return output.buffer;
}

function isFileReadAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (error instanceof DOMException && (error.name === "NotReadableError" || error.name === "SecurityError"))
    || /requested file could not be read|permission problems|concurrent lock|not readable/i.test(message);
}

function toUserFacingVideoError(error: unknown) {
  if (error instanceof VideoFileReadError) {
    const detail = error.original instanceof DOMException ? error.original.name : error.original instanceof Error ? error.original.name : "ReadError";
    return `${error.file.name} (${formatBytes(error.file.size)})을 브라우저 메모리로 복사하지 못했습니다. 다른 앱에서 파일을 사용 중이면 닫고, OneDrive·Google Drive·네트워크·외장 저장소의 파일이면 로컬 폴더에 완전히 내려받은 사본을 선택해 주세요. 오류 종류: ${detail}`;
  }
  const message = error instanceof Error ? error.message : String(error);
  if ((error instanceof DOMException && error.name === "NotReadableError") || /requested file could not be read|permission problems/i.test(message)) {
    return "선택한 영상 파일을 읽을 수 없습니다. 파일이 이동·교체되었거나 브라우저의 접근 권한이 해제되었을 수 있습니다. 원본 파일을 다시 선택해 주세요.";
  }
  return message || "비디오 처리에 실패했습니다.";
}
function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00.0";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${remaining.toFixed(1).padStart(4, "0")}`;
}
function downloadResult(buffer: ArrayBuffer, mimeType: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
