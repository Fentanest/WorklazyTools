interface VideoGroupMemoInput {
  group: number;
  settings: unknown;
  language: string;
  players: unknown;
  items: ReadonlyArray<{ id: string }>;
  activeId?: string;
}

interface VideoTrimMemoInput {
  item: unknown;
  index: number;
  active: boolean;
  groupSize: number;
  synchronizationKey: string;
  language: string;
}

// Callback props are intentionally omitted: the parent keeps them stable, while synchronizationKey invalidates timeline behavior changes.
export function areVideoGroupRenderInputsEqual(previous: VideoGroupMemoInput, next: VideoGroupMemoInput) {
  if (previous.group !== next.group || previous.settings !== next.settings || previous.language !== next.language || previous.players !== next.players) return false;
  if (previous.items.length !== next.items.length || previous.items.some((item, index) => item !== next.items[index])) return false;
  const previousActiveInGroup = previous.items.some((item) => item.id === previous.activeId);
  const nextActiveInGroup = next.items.some((item) => item.id === next.activeId);
  return (!previousActiveInGroup && !nextActiveInGroup) || previous.activeId === next.activeId;
}

// Callback props are intentionally omitted for the same stable-parent-callback contract.
export function areVideoTrimRenderInputsEqual(previous: VideoTrimMemoInput, next: VideoTrimMemoInput) {
  return previous.item === next.item
    && previous.index === next.index
    && previous.active === next.active
    && previous.groupSize === next.groupSize
    && previous.synchronizationKey === next.synchronizationKey
    && previous.language === next.language;
}
