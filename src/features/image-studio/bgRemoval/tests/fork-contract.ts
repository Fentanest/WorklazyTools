import { createBackgroundRemovalLoader, type BackgroundRemovalController } from '../controller.ts';
/** Upstream fork @ad632d4 engine/loaders.ts contract; checked against the actual file in local QA too. */
type ForkLoader = () => Promise<{ readonly removeBackground: (source: Blob | string, config?: { progress?: (key: string, current: number, total: number) => void }) => Promise<Blob> }>;
export function assertForkLoaderContract(controller: BackgroundRemovalController): ForkLoader {
  return createBackgroundRemovalLoader(controller, () => 'person');
}
