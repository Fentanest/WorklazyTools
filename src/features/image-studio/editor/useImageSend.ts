import { useCallback, useRef, useState } from 'react';
import { useMemoryHandoff } from '../../../components/AppShell';
import type { HandoffInput } from '../../../app/memoryHandoff';
import { setUnsavedWork } from '../../../app/toolState';

/** A prepared result belongs to one scene/output revision and one dispatch. */
export function useImageSend() {
  const sender = useMemoryHandoff();
  const [preparedSend, setPreparedSend] = useState<HandoffInput>();
  const current = useRef<HandoffInput | undefined>(undefined);
  const revision = useRef(0);
  const invalidatePrepared = useCallback(() => {
    revision.current++; current.current = undefined; setPreparedSend(undefined);
  }, []);
  const dispatch = (input: HandoffInput) => sender.send(input, {
    isCurrent: () => current.current === input,
    onDispatched: () => { if (current.current === input) { current.current = undefined; setPreparedSend(undefined); } },
  });
  const prepareAndSend = (input: HandoffInput, expectedRevision = revision.current) => {
    if (expectedRevision !== revision.current) return false;
    current.current = input; setPreparedSend(input);
    setUnsavedWork('image-studio', { hasWork: true, kind: 'files', scopePath: '/tools/image-studio' });
    dispatch(input); return true;
  };
  const retryPrepared = () => { if (current.current) dispatch(current.current); };
  const downloadPrepared = () => {
    for (const file of current.current?.files ?? []) {
      const url = URL.createObjectURL(file), anchor = document.createElement('a');
      anchor.href = url; anchor.download = file.name; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
  };
  return { preparedSend, reason: sender.reason, prepareAndSend, retryPrepared, downloadPrepared, invalidatePrepared, captureSendRevision: () => revision.current };
}
