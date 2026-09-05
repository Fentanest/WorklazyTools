import { Fragment } from "react";

const MAX_GROUPED_SEGMENT_LENGTH = 24;
const separatorPattern = /([\u00b7,])(\s*)/g;

interface HintSegment {
  text: string;
  trailingSpace: string;
}

function groupShortDelimitedSegments(hint: string): HintSegment[] | undefined {
  const segments: HintSegment[] = [];
  let cursor = 0;

  for (const match of hint.matchAll(separatorPattern)) {
    const text = `${hint.slice(cursor, match.index)}${match[1]}`;
    if (!text || text.length > MAX_GROUPED_SEGMENT_LENGTH) return undefined;
    segments.push({ text, trailingSpace: match[2] });
    cursor = (match.index ?? 0) + match[0].length;
  }

  const tail = hint.slice(cursor);
  if (segments.length === 0 || !tail || tail.length > MAX_GROUPED_SEGMENT_LENGTH) return undefined;
  segments.push({ text: tail, trailingSpace: "" });
  return segments;
}

export function DropZoneHint({ children }: { children: string }) {
  const segments = groupShortDelimitedSegments(children);

  return (
    <span data-ui-part="drop-hint" className="block text-sm text-muted-foreground">
      {segments ? segments.map((segment, index) => (
        <Fragment key={`${segment.text}-${index}`}>
          <span data-ui-part="drop-hint-segment" className="whitespace-nowrap">{segment.text}</span>
          {index < segments.length - 1 && <><wbr />{segment.trailingSpace}</>}
        </Fragment>
      )) : children}
    </span>
  );
}
