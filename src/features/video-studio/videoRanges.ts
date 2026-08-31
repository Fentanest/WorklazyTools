import type { VideoGroupId, VideoItem } from "./types";

export const MIN_VIDEO_RANGE_SECONDS = 0.05;

export interface VideoRangeApplicationSummary {
  appliedGroups: number;
  appliedItems: number;
  adjustedItems: number;
  unmatchedSlots: number;
}

export function clampVideoRange(start: number, end: number, duration: number) {
  const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  const minimumLength = Math.min(MIN_VIDEO_RANGE_SECONDS, safeDuration);
  let nextStart = Math.min(safeDuration, Math.max(0, Number.isFinite(start) ? start : 0));
  let nextEnd = Math.min(safeDuration, Math.max(0, Number.isFinite(end) ? end : safeDuration));

  if (nextEnd - nextStart < minimumLength) {
    if (nextEnd >= minimumLength) nextStart = nextEnd - minimumLength;
    else {
      nextStart = 0;
      nextEnd = minimumLength;
    }
  }

  return { start: nextStart, end: nextEnd };
}

export function applyVideoRangeToGroup(items: VideoItem[], source: VideoItem) {
  return items.map((item) => {
    if (item.group !== source.group) return item;
    const range = clampVideoRange(source.start, source.end, item.duration);
    if (item.start === range.start && item.end === range.end) return item;
    return { ...item, ...range };
  });
}

export function applyGroupRangesByPosition(
  items: VideoItem[],
  sourceGroup: VideoGroupId,
  requestedTargetGroups: VideoGroupId[],
) {
  const sourceItems = items.filter((item) => item.group === sourceGroup);
  const targetGroups = Array.from(new Set(requestedTargetGroups.filter((group) => group !== sourceGroup)));
  const targetSet = new Set(targetGroups);
  const positions = new Map<string, number>();
  const counts = new Map<VideoGroupId, number>();

  items.forEach((item) => {
    const position = counts.get(item.group) ?? 0;
    positions.set(item.id, position);
    counts.set(item.group, position + 1);
  });

  let appliedItems = 0;
  let adjustedItems = 0;
  const groupsWithApplications = new Set<VideoGroupId>();
  const nextItems = items.map((item) => {
    if (!targetSet.has(item.group)) return item;
    const source = sourceItems[positions.get(item.id) ?? -1];
    if (!source) return item;
    const range = clampVideoRange(source.start, source.end, item.duration);
    appliedItems += 1;
    groupsWithApplications.add(item.group);
    if (Math.abs(range.start - source.start) > 0.000_001 || Math.abs(range.end - source.end) > 0.000_001) adjustedItems += 1;
    if (item.start === range.start && item.end === range.end) return item;
    return { ...item, ...range };
  });

  const unmatchedSlots = targetGroups.reduce((total, group) => (
    total + Math.abs(sourceItems.length - (counts.get(group) ?? 0))
  ), 0);

  return {
    items: nextItems,
    summary: {
      appliedGroups: groupsWithApplications.size,
      appliedItems,
      adjustedItems,
      unmatchedSlots,
    } satisfies VideoRangeApplicationSummary,
  };
}
