import React from 'react';
import { createRoot } from 'react-dom/client';
import { FileDropZone } from '../../src/components/ui';
export function mountDropHarness() {
  const host = document.createElement('div'); host.id = 'drop-harness'; document.body.append(host);
  const root = createRoot(host);
  const state = { received: [] as string[][], release: () => {}, unmount: () => root.unmount(), render };
  function render(multiple: boolean, asyncMode: boolean, delta = false) {
    root.render(<FileDropZone files={[new File(['a'], 'old.txt')]} multiple={multiple} accept=".txt" hint="test"
      onFiles={files => { state.received.push(files.map(f => f.name)); if (asyncMode) return new Promise<void>(r => { state.release = r; }); }}
      onNewFiles={delta ? files => { state.received.push(files.map(f => f.name)); } : undefined} />);
  }
  render(true, false); return state;
}
