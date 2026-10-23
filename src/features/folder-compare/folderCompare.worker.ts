import { FolderOwner } from './owner.ts';
import type { MatchOptions } from './core.ts';
import type { SourceInput } from './owner.ts';
const owner = new FolderOwner();
let revision = 0;
self.onmessage = (event: MessageEvent<{ type: 'compare' | 'cancel' | 'clear'; revision: number; left: SourceInput; right: SourceInput; options: MatchOptions }>) => {
  const request = event.data;
  if (request.type === 'cancel') { if (request.revision === revision) owner.cancel(); return; }
  revision = request.revision;
  if (request.type === 'clear') { void owner.clear(request.revision); return; }
  void owner.compare(request.revision, request.left, request.right, request.options, view => self.postMessage(view));
};
