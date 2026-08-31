export interface TextMergeItem {
  id: string;
  source: "direct" | "file";
  name: string;
  content: string;
  originalContent?: string;
}

export interface TextMergeOptions {
  separator: string;
  trimItems: boolean;
  excludeEmpty: boolean;
}

export function mergeTextItems(items: TextMergeItem[], options: TextMergeOptions) {
  return items
    .map((item) => options.trimItems ? item.content.trim() : item.content)
    .filter((content) => !options.excludeEmpty || content.trim().length > 0)
    .join(options.separator);
}

export function moveTextItem(items: TextMergeItem[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
