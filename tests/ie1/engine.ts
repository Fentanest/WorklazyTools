// QA-only host: exercise the exact installed package and the production BG controller.
import { EditorEngine } from '@ascentsparksoftware/react-image-editor';
import * as fabric from 'fabric';
import { BackgroundRemovalController, createBackgroundRemovalLoader } from '../../src/features/image-studio/bgRemoval';
const w = window as any;
const bg = new BackgroundRemovalController({ confirm: () => true });
w.api = { fabric };
w.newEngine = async (options = {}) => {
  if (w.engine) { await w.engine.destroy(); document.querySelector('.canvas-container')?.remove(); }
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  w.engine = await EditorEngine.create(canvas, { width: 640, height: 480,
    backgroundRemovalLoader: createBackgroundRemovalLoader(bg, () => 'person'), ...options });
  return w.engine;
};
w.ready = true;
