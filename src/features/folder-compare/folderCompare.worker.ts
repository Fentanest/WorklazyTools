import { FolderOwner } from './owner.ts';
import type { MatchOptions } from './core.ts';
import type { SourceInput } from './owner.ts';
const owner = new FolderOwner();
let revision = 0;
self.onmessage = (event: MessageEvent<{ type: 'compare' | 'cancel' | 'clear' | 'selected' | 'renames'; revision: number; left: SourceInput; right: SourceInput; options: MatchOptions; requestId: number; leftId: string; rightId: string; limit: number }>) => {
  const request = event.data;
  if (request.type === 'cancel') { if (request.revision === revision) owner.cancel(); return; }
  if (request.type === 'selected' || request.type === 'renames') {
    const operation = request.type === 'selected' ? owner.selected(request.revision, request.leftId, request.rightId, request.limit) : owner.renames(request.revision);
    void operation.then(value => self.postMessage({ type: request.type, requestId: request.requestId, revision: request.revision, value }), () => self.postMessage({ type: 'operation-error', requestId: request.requestId, revision: request.revision }));
    return;
  }
  revision = request.revision;
  if (request.type === 'clear') { void owner.clear(request.revision); return; }
  void owner.compare(request.revision, request.left, request.right, request.options, view => self.postMessage(view));
};
