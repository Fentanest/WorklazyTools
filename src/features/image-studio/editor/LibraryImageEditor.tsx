import { ImageEditor, ERROR_MESSAGES, type BeforeExportContext, type ExportDecision } from '@ascentsparksoftware/react-image-editor';
import '@ascentsparksoftware/react-image-editor/styles.css';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDropZone } from '../../../components/ui';
import { Button } from '../../../components/ui/button';
import { UtilityNotice, UtilitySectionCard } from '../../../components/UtilitySurface';
import type { IntakeContext } from '../../../app/memoryHandoff';
import { setUnsavedWork } from '../../../app/toolState';
import type { ImageEditorDirectHandle } from '../ImageStudioPage';
import type { ImageDirectPreset } from '../imageDirect';
import { ClipboardHint, filterRasterImages, RASTER_IMAGE_ACCEPT } from '../imageStudioShared';
import { BackgroundRemovalController, BgRemovalError, messages, productRiskMessages, productRecoveryMarker, productRecoveryMessages, productDeviceRestriction, type BgMode, type ConsentInfo } from '../bgRemoval';
import { actualShrinkNotice, classifyD6, draftD6Props } from './d6Policy';
import { prepareImage, type PreparedImage } from './prepareImage';
import { resizeResult } from './resizeResult';
import { useImageSend } from './useImageSend';
import { encodeSendImage } from './encodeSendImage';
import type { ImageOutputFormat } from '../types';
import type { PixelSize } from './d6Policy';
import './libraryImageEditor.css';

interface Props {
  active: boolean; preset?: ImageDirectPreset; handleRef: React.MutableRefObject<ImageEditorDirectHandle | undefined>;
  onDirty: (dirty: boolean) => void; onEditedResult: (file: File) => void;
  batchCount: number; batchNotice?: 'added' | 'limit';
}
type PendingDecision<T> = { resolve: (value: T) => void };
const FORMATS = ['png', 'jpeg', 'webp', 'pdf', 'svg', 'json'] as const;
const localFonts = new Set(['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New', 'Noto Sans']);
const fontResolver = (family: string) => localFonts.has(family) || family.includes('system-ui') ? 'local' as const : 'google' as const;
const readThemeMode = (): 'light' | 'dark' => document.documentElement.dataset.theme?.startsWith('dark') || getComputedStyle(document.documentElement).colorScheme === 'dark' ? 'dark' : 'light';
const resultPlanKey = (format: ImageOutputFormat, size?: PixelSize) => `${format}:${size?.width ?? 'auto'}x${size?.height ?? 'auto'}`;
const initialTool = (preset?: ImageDirectPreset) => preset?.purpose === 'mosaic' ? 'redact' : preset?.purpose === 'watermark' ? 'text' : preset?.purpose === 'resize' ? 'resize' : 'select';
const coarsePrimaryPointer = () => matchMedia('(pointer: coarse)').matches;
const subscribePrimaryPointer = (notify: () => void) => {
  const query = matchMedia('(pointer: coarse)');
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const serverPrimaryPointer = () => false;

export default function LibraryImageEditor({ active, preset, handleRef, onDirty, onEditedResult, batchCount, batchNotice }: Props) {
  const { t, i18n } = useTranslation('features');
  const { t: sendT } = useTranslation('common');
  const { preparedSend, reason: sendReason, prepareAndSend, retryPrepared, downloadPrepared, invalidatePrepared, captureSendRevision } = useImageSend();
  const [outputFormat, setOutputFormat] = useState<ImageOutputFormat>('png');
  const language = i18n.language === 'en' ? 'en' : 'ko';
  const root = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<PreparedImage>();
  const [generation, setGeneration] = useState(0);
  const latestGeneration = useRef(generation); latestGeneration.current = generation;
  const lastStableSource = useRef<PreparedImage | undefined>(undefined);
  const [selectedPreset, setSelectedPreset] = useState(preset);
  const [loaded, setLoaded] = useState(false);
  const [outputSize, setOutputSize] = useState<PixelSize>();
  const [nativeOutputSize, setNativeOutputSize] = useState<PixelSize>();
  const [ratioLocked, setRatioLocked] = useState(true);
  const documentRevision = useRef(0);
  const pendingCommits = useRef<{ version: number; revision: number; destination: 'result' | 'batch' | 'download' | 'privacy' | 'pdf'; size?: PixelSize; outputFormat: ImageOutputFormat; sendRevision: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [hasHistoryInput, setHasHistoryInput] = useState(false);
  const [hasTemplateInput, setHasTemplateInput] = useState(false);
  const [error, setErrorText] = useState('');
  const [errorPresentation, setErrorPresentation] = useState(0);
  const setError = useCallback((message: string) => { setErrorText(message); if (message) setErrorPresentation(value => value + 1); }, []);
  const [errorCode, setErrorCode] = useState<string>();
  const clearProductRestrictionError = useCallback(() => {
    setErrorText(current => current === messages.ko['bg-product-device-restricted'] || current === messages.en['bg-product-device-restricted'] ? '' : current);
    setErrorCode(current => current === 'bg-product-device-restricted' ? undefined : current);
  }, []);
  const [notice, setNoticeText] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState(() => productRecoveryMarker.hasInterrupted());
  useEffect(() => { if (recoveryNotice) productRecoveryMarker.consume(); }, [recoveryNotice]);
  const [jpegTransparencyNotice, setJpegTransparencyNotice] = useState(false);
  const transientFeedback = useRef(false);
  const setNotice = useCallback((message: string) => { transientFeedback.current = false; setNoticeText(message); }, []);
  const [backgroundCancelled, setBackgroundCancelled] = useState(false);
  const noticeRevision = useRef(0);
  const clearFeedback = useCallback(() => { noticeRevision.current++; transientFeedback.current = false; setNoticeText(''); setBackgroundCancelled(false); setJpegTransparencyNotice(false); }, []);
  const [mode, setMode] = useState<BgMode>('person');
  const modeRef = useRef(mode); modeRef.current = mode;
  const modeChosen = useRef(false);
  const [bgBusy, setBgBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bgPhase, setBgPhase] = useState<'preparing' | 'download' | 'processing'>('preparing');
  const [result, setResult] = useState<File>();
  const [resultPlan, setResultPlan] = useState('');
  const [resultSize, setResultSize] = useState<PixelSize>();
  const [resultUrl, setResultUrl] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [exportPrompt, setExportPrompt] = useState<PendingDecision<ExportDecision>>();
  const [riskConsent, setRiskConsent] = useState<PendingDecision<boolean>>();
  const riskPending = useRef<PendingDecision<boolean> | undefined>(undefined);
  const [consent, setConsent] = useState<ConsentInfo & PendingDecision<boolean>>();
  const exportPending = useRef<PendingDecision<ExportDecision> | undefined>(undefined);
  const consentPending = useRef<PendingDecision<boolean> | undefined>(undefined);
  const bg = useRef<BackgroundRemovalController | undefined>(undefined);
  const version = useRef(0);
  const sourceRef = useRef(source); sourceRef.current = source;
  const activeRef = useRef(active); activeRef.current = active;
  const onDirtyRef = useRef(onDirty); onDirtyRef.current = onDirty;
  const loadedAck = useRef<{ resolve: (ok: boolean) => void; version: number } | undefined>(undefined);
  useEffect(() => {
    if (!error) return;
    const frame = requestAnimationFrame(() => {
      const heading = root.current?.querySelector<HTMLElement>('[data-testid="image-editor-operation-error"]');
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [error, errorPresentation]);
  const destination = useRef<'result' | 'batch' | 'download' | 'privacy' | 'pdf'>('result');
  const batchLock = useRef(false);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef(false);
  const [policy] = useState(() => draftD6Props(classifyD6({
    primaryPointerCoarse: matchMedia('(pointer: coarse)').matches ? true : matchMedia('(pointer: fine)').matches ? false : null,
    maxTouchPoints: navigator.maxTouchPoints, screenShortEdgeCssPx: Math.min(screen.width, screen.height),
  })));
  const secureBackgroundContext = globalThis.isSecureContext && !!globalThis.crypto?.subtle;
  const productRestricted = !!productDeviceRestriction();
  const touchInput = useSyncExternalStore(subscribePrimaryPointer, coarsePrimaryPointer, serverPrimaryPointer);
  const labels = useMemo<Record<string, string>>(() => ({
    ...t('image.library.labels', { returnObjects: true }) as Record<string, string>,
    ...(touchInput ? { 'Click an object on the canvas to select it. Use the Layers panel to lock, reorder, group, align, or change opacity. Shift-click to multi-select.': t('image.library.touchSelectionHelp') } : {}),
    'This browser cannot encode this image format. Choose PNG or JPEG.': t('image.library.unsupportedFormat'),
    'runs an AI model entirely in your browser — no upload. The model (~tens of MB) downloads once on first use, then is cached.': '\n' + (!secureBackgroundContext ? t('image.library.httpsHint') : mode === 'product' && productRestricted ? messages[language]['bg-product-device-restricted'] : t(mode === 'person' ? 'image.library.personModelHelp' : 'image.library.productModelHelp')),
  }), [t, mode, secureBackgroundContext, productRestricted, language, touchInput]);
  const exportFileName = `${(source?.file.name || 'worklazy-image').replace(/\.[^.]+$/, '')}-edited`;
  const labelsRef = useRef(labels); labelsRef.current = labels;
  const applyPresetRef = useRef<(next?: ImageDirectPreset) => void>(() => {});

  const dismissPending = useCallback(() => {
    riskPending.current?.resolve(false); riskPending.current = undefined; setRiskConsent(undefined);
    exportPending.current?.resolve('cancel'); exportPending.current = undefined; setExportPrompt(undefined);
    consentPending.current?.resolve(false); consentPending.current = undefined; setConsent(undefined);
  }, []);
  const cancel = useCallback(() => {
    version.current++; bg.current?.cancel(); dismissPending();
    if (loadedAck.current) {
      loadedAck.current.resolve(false); loadedAck.current = undefined;
      setSource(lastStableSource.current); setGeneration(value => value + 1);
    }
    saving.current = false; destination.current = 'result'; pendingCommits.current = [];
    setBgBusy(false); setLoading(false);
  }, [dismissPending]);
  const cancelBackgroundRemoval = useCallback(() => { cancel(); clearFeedback(); transientFeedback.current = true; setBackgroundCancelled(true); }, [cancel, clearFeedback]);
  useEffect(() => {
    const controller = new BackgroundRemovalController({ language,
      confirmProductRisk: () => new Promise<boolean>(resolve => { const pending = { resolve }; riskPending.current = pending; setRiskConsent(pending); }),
      confirm: info => new Promise<boolean>(resolve => {
        consentPending.current = { resolve }; setConsent({ ...info, resolve });
      }), notice: setNotice,
    });
    bg.current = controller;
    void controller.defaultMode().then(value => { if (bg.current === controller && !modeChosen.current) setMode(value); });
    return () => { controller.dispose(); dismissPending(); if (bg.current === controller) bg.current = undefined; };
  }, [language, dismissPending, setNotice]);
  useEffect(() => { if (!active) { cancel(); clearFeedback(); } }, [active, cancel, clearFeedback]);
  useEffect(() => {
    onDirtyRef.current(!!source || hasTemplateInput || hasHistoryInput || dirty || loading || bgBusy || !!result || !!preparedSend);
  }, [source, hasTemplateInput, hasHistoryInput, dirty, loading, bgBusy, result, preparedSend]);
  useEffect(() => () => { version.current++; loadedAck.current?.resolve(false); clearTimeout(batchTimer.current); onDirtyRef.current(false); }, []);
  useEffect(() => {
    if (!result) { setResultUrl(undefined); return; }
    const url = URL.createObjectURL(result); setResultUrl(url); return () => URL.revokeObjectURL(url);
  }, [result]);
  const [theme, setTheme] = useState<'light' | 'dark'>(readThemeMode);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readThemeMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] }); return () => observer.disconnect();
  }, []);

  useEffect(() => { invalidatePrepared(); clearFeedback(); }, [outputFormat, outputSize?.width, outputSize?.height, invalidatePrepared, clearFeedback]);

  const receive = async (file: File, context?: IntakeContext) => {
    if (!filterRasterImages([file]).length || context?.signal.aborted) return false;
    setRecoveryNotice(false); cancel(); const request = version.current;
    invalidatePrepared(); setLoading(true); setError(''); setErrorCode(undefined); clearFeedback(); setResult(undefined); setOutputSize(undefined); setNativeOutputSize(undefined);
    const abort = () => { if (request === version.current) cancel(); };
    context?.signal.addEventListener('abort', abort, { once: true });
    try {
      const prepared = await prepareImage(file, policy.resolutionLimits.inputMaxDimension);
      if (request !== version.current || context?.signal.aborted) return false;
      setUnsavedWork('image-studio', { hasWork: true, kind: 'files', scopePath: '/tools/image-studio' });
      setLoaded(false); setHasTemplateInput(false); setSource(prepared); setGeneration(value => value + 1);
      return await new Promise<boolean>(resolve => { loadedAck.current = { resolve, version: request }; });
    } catch {
      if (request === version.current) setError(t('image.library.loadFailed'));
      return false;
    } finally {
      context?.signal.removeEventListener('abort', abort);
      if (request === version.current) setLoading(false);
    }
  };
  const receiveRef = useRef(receive); receiveRef.current = receive;
  useEffect(() => {
    const handle: ImageEditorDirectHandle = {
      receive: (file, context) => receiveRef.current(file, context), cancel,
      invalidate: cancel,
      apply: next => applyPresetRef.current(next),
    };
    handleRef.current = handle;
    return () => { if (handleRef.current === handle) handleRef.current = undefined; };
  }, [handleRef, cancel]);
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (!activeRef.current || (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]'))) return;
      const file = Array.from(event.clipboardData?.files ?? []).find(value => filterRasterImages([value]).length);
      if (!file) return;
      event.preventDefault(); event.stopImmediatePropagation(); void receiveRef.current(file);
    };
    document.addEventListener('paste', paste, true);
    return () => document.removeEventListener('paste', paste, true);
  }, []);
  const editorArea = useRef<HTMLDivElement>(null);
  const clearWatermarkDraft = () => {
    const input = editorArea.current?.querySelector<HTMLInputElement>('#asp-text-input');
    if (!input) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  applyPresetRef.current = next => {
    cancel(); clearFeedback(); invalidatePrepared(); setSelectedPreset(next); setResult(undefined);
    const request = version.current;
    requestAnimationFrame(() => {
      if (request !== version.current || !activeRef.current) return;
      // The pinned fork has no imperative tool API. Select its existing chrome
      // without remounting: direct-entry changes must keep layers and history.
      const english = next?.purpose === 'mosaic' ? 'Redact' : next?.purpose === 'watermark' ? 'Text' : next?.purpose === 'resize' ? 'Crop & rotate' : 'Select';
      const label = labelsRef.current[english] ?? english;
      const button = Array.from(editorArea.current?.querySelectorAll<HTMLButtonElement>('.asp-rail__slot > button:first-child') ?? []).find(node => node.textContent?.trim() === label);
      button?.click();
      requestAnimationFrame(() => {
        if (request !== version.current || !activeRef.current) return;
        if (next?.purpose === 'watermark') clearWatermarkDraft();
        if (next?.purpose === 'mosaic') {
          const label = labelsRef.current.Pixelate ?? 'Pixelate';
          Array.from(editorArea.current?.querySelectorAll<HTMLButtonElement>('.asp-options-panel .asp-chip') ?? []).find(node => node.textContent?.trim() === label)?.click();
        }
      });
    });
  };
  // FileDropZone registers the single global target through useFileDropTarget.
  // A second canvas target would create duplicate choices for the same editor.


  const beforeExport = async ({ format, path, hasConcealment }: BeforeExportContext): Promise<ExportDecision> => {
    clearFeedback();
    setError(''); setErrorCode(undefined);
    // Commit may apply a pending crop before this hook. Snapshot the resulting
    // revision and each request's destination/size before asynchronous encoding.
    if (path === 'commit') {
      pendingCommits.current.push({ version: version.current, revision: documentRevision.current, destination: destination.current, size: outputSize, outputFormat, sendRevision: captureSendRevision() });
      destination.current = 'result';
    }
    if (!hasConcealment || !['svg', 'json'].includes(format)) return 'proceed';
    if (exportPending.current) return 'cancel';
    return new Promise(resolve => { const pending = { resolve }; exportPending.current = pending; setExportPrompt(pending); });
  };
  const finishExport = (value: ExportDecision) => { exportPending.current?.resolve(value); exportPending.current = undefined; setExportPrompt(undefined); };
  const finishConsent = (value: boolean) => {
    consentPending.current?.resolve(value); consentPending.current = undefined; setConsent(undefined);
    if (!value) { clearFeedback(); transientFeedback.current = true; setBackgroundCancelled(true); }
  };
  const finishProductRisk = (value: boolean) => {
    riskPending.current?.resolve(value); riskPending.current = undefined; setRiskConsent(undefined);
    if (!value) { clearFeedback(); transientFeedback.current = true; setBackgroundCancelled(true); }
  };
  const backgroundRemovalLoader = async () => ({ removeBackground: async (input: Blob | string, options?: { progress?: (key: string, current: number, total: number) => void }) => {
    const request = version.current; setRecoveryNotice(false); clearFeedback(); setBgBusy(true); setProgress(0); setBgPhase('preparing'); setError(''); setErrorCode(undefined);
    try {
      const controller = bg.current;
      if (!controller || !activeRef.current) throw new BgRemovalError('ai-cancelled');
      const cutout = await controller.removeBackground(input, { mode: modeRef.current, progress: (key, current, total) => {
        if (request === version.current) {
          setBgPhase(key.startsWith('fetch') ? 'download' : 'processing');
          setProgress(total > 0 ? Math.round(current / total * 100) : 0);
          options?.progress?.(key, current, total);
        }
      } });
      if (request === version.current) clearProductRestrictionError();
      return cutout;
    } catch (cause) {
      if (request === version.current && cause instanceof BgRemovalError && cause.code !== 'ai-cancelled') { setErrorCode(cause.code); setError(messages[language][cause.code]); }
      throw cause;
    } finally { if (request === version.current) setBgBusy(false); }
  } });
  const saved = async (blob: Blob) => {
    const intent = pendingCommits.current.shift();
    if (!intent) return;
    const { version: request, revision, size: target } = intent;
    try {
      let encoded = await resizeResult(blob, target);
      const sending = intent.destination === 'privacy' || intent.destination === 'pdf';
      if (intent.destination !== 'batch') encoded = await encodeSendImage(encoded, intent.outputFormat, hasTransparency => {
        if (activeRef.current && request === version.current && revision === documentRevision.current && intent.sendRevision === captureSendRevision()) setJpegTransparencyNotice(hasTransparency);
      });
      if (!activeRef.current || request !== version.current) return;
      if (revision !== documentRevision.current) { setNotice(t('image.library.resultChanged')); return; }
      const outputChanged = intent.sendRevision !== captureSendRevision();
      const extension = encoded.type === 'image/jpeg' ? 'jpg' : encoded.type === 'image/webp' ? 'webp' : 'png';
      const file = new File([encoded], `${(sourceRef.current?.file.name || 'worklazy-image').replace(/\.[^.]+$/, '')}-edited.${extension}`, { type: encoded.type });
      if (sending) {
        if (intent.destination === 'pdf' && intent.outputFormat === 'webp') return;
        const ok = prepareAndSend({ receiverId: intent.destination === 'pdf' ? 'image-to-pdf' : 'image-privacy', entryPath: intent.destination === 'pdf' ? '/tools/pdf-converter/image-to-pdf' : '/tools/image-privacy', files:[file], origin:'generated', source:'image-studio' }, intent.sendRevision);
        if (!ok) setNotice(t('image.library.resultChanged'));
      } else if (intent.destination === 'batch') onEditedResult(file);
      else {
        setResultSize(undefined); setResult(file); setResultPlan(resultPlanKey(intent.outputFormat, target));
        if (intent.destination === 'result' && outputChanged) setNotice(t('image.library.resultChanged'));
        if (intent.destination === 'download') {
          const url = URL.createObjectURL(file), anchor = document.createElement('a');
          anchor.href = url; anchor.download = file.name; anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
        }
      }
    } catch (cause) { if (request === version.current) setError(t(cause instanceof Error && cause.message === 'export-format-unsupported' ? 'image.library.unsupportedFormat' : 'image.library.exportFailed')); }
    finally { if (request === version.current) { destination.current = 'result'; saving.current = false; } }
  };
  const changeOutputSize = (axis: 'width' | 'height', value: number) => {
    const current = outputSize ?? nativeOutputSize ?? source?.decoded ?? { width: 640, height: 480 };
    const edge = policy.resolutionLimits.inputMaxDimension;
    const bounded = Math.max(1, Math.min(edge, Math.round(value) || 1));
    const other = axis === 'width' ? 'height' : 'width';
    const next = { ...current, [axis]: bounded };
    if (ratioLocked) next[other] = Math.max(1, Math.round(bounded * current[other] / current[axis]));
    if (next[other] > edge) { next[axis] = Math.max(1, Math.round(next[axis] * edge / next[other])); next[other] = edge; }
    setOutputSize(next);
  };
  const commit = (target: 'result' | 'batch' | 'download' | 'privacy' | 'pdf') => {
    if (target === 'batch') {
      clearTimeout(batchTimer.current);
      batchTimer.current = setTimeout(() => { batchLock.current = false; setAdding(false); }, 600);
      if (batchLock.current) return;
      batchLock.current = true; setAdding(true);
      if (batchCount >= 50) { setNotice(t('image.handoff.limit')); return; }
    }
    if (saving.current || !loaded || loading || bgBusy || (target === 'pdf' && outputFormat === 'webp')) return;
    destination.current = target; saving.current = true;
    // The fork's public commit action owns export hooks and forced PNG encoding.
    const button = editorArea.current?.querySelector<HTMLButtonElement>('.asp-commit');
    if (button) button.click(); else { saving.current = false; destination.current = 'result'; setError(t('image.library.exportFailed')); }
  };
  const displayedError = errorCode?.startsWith('bg-') ? messages[language][errorCode as keyof typeof messages.ko] || error : error;
  const shrink = source && actualShrinkNotice(source.original, source.decoded, language);
  return <UtilitySectionCard title={t('image.editor.title')} description={t('image.library.description')}>
    <div ref={root} data-testid="library-image-editor">
      {recoveryNotice && <UtilityNotice role="status" className="mb-3" data-testid="image-background-recovery">
        <p>{productRecoveryMessages[language].body}</p><Button type="button" variant="ghost" onClick={() => setRecoveryNotice(false)}>{productRecoveryMessages[language].dismiss}</Button>
      </UtilityNotice>}
      <FileDropZone files={source ? [source.file] : []} disabled={loading || bgBusy} accept={RASTER_IMAGE_ACCEPT} hint={t('image.editor.hint')} onFiles={files => { const next = filterRasterImages(files).at(-1); if (next) void receiveRef.current(next); }} accent="sky" />
      <ClipboardHint mode="replace" />
      {shrink && <UtilityNotice role="status" className="mt-2" data-testid="image-editor-shrink">{shrink}</UtilityNotice>}
      {displayedError && <div className="mt-2"><h3 tabIndex={-1} data-testid="image-editor-operation-error" className="mb-1 text-sm font-medium">{t('image.library.operationErrorTitle')}</h3><UtilityNotice kind="error" role="alert">{displayedError}{mode === 'product' && (errorCode === 'bg-inference-failed' || errorCode === 'bg-unsupported' || errorCode === 'bg-product-device-restricted') && <Button className="ml-2" type="button" variant="outline" onClick={() => {
        modeChosen.current = true; modeRef.current = 'person'; setMode('person'); setError(''); setErrorCode(undefined); setNotice(t('image.library.retryReady'));
      }}>{t('image.library.retryPerson')}</Button>}</UtilityNotice></div>}
      {notice && <UtilityNotice role="status" className="mt-2">{notice}</UtilityNotice>}
      <UtilityNotice className="mt-2">{t('image.library.redactionHint')}</UtilityNotice>
      <div className="my-3 flex flex-wrap items-center gap-2" data-testid="image-background-controls">
        <label className="flex min-h-11 items-center gap-2 text-sm">{t('image.library.backgroundMode')}<select aria-describedby={productRestricted ? 'image-background-product-restriction' : undefined} className="min-h-11 rounded-xl border border-border bg-background px-3" value={mode} disabled={bgBusy} onChange={event => { setRecoveryNotice(false); clearFeedback(); clearProductRestrictionError(); modeChosen.current = true; modeRef.current = event.target.value as BgMode; setMode(modeRef.current); }}>
          <option value="person">{t('image.library.person')}</option><option value="product" disabled={productRestricted}>{t('image.library.product')}</option>
        </select></label>
        <Button type="button" variant="outline" onClick={() => {
          cancel(); clearFeedback(); const revision = noticeRevision.current; const controller = bg.current;
          void controller?.clearStoredModels().then(ok => { if (ok && activeRef.current && controller === bg.current && revision === noticeRevision.current) { setNotice(t('image.library.modelsCleared')); transientFeedback.current = true; } });
        }}>{t('image.library.clearModels')}</Button>
        {bgBusy && <><span role="status">{t(bgPhase === 'download' ? 'image.library.downloadProgress' : bgPhase === 'preparing' ? 'image.library.backgroundPreparing' : 'image.library.backgroundProcessing', { progress })}</span><Button type="button" variant="secondary" onClick={cancelBackgroundRemoval}>{t('image.cancel')}</Button></>}
      </div>
      {productRestricted && <UtilityNotice kind="warning" role="status" id="image-background-product-restriction" data-testid="image-background-product-restriction">{messages[language]['bg-product-device-restricted']}</UtilityNotice>}
      <p className="mb-2 text-sm text-muted-foreground">{t('image.library.magicWandHint')}</p>
      <p className="mb-3 text-sm text-muted-foreground">{t('image.library.templateHelp')}</p>
      <fieldset className="mb-3 rounded-xl border border-border p-3" data-testid="image-editor-png-size">
        <legend className="px-1 text-sm font-medium">{t('image.library.pngSize')}</legend>
        <p className="mb-2 text-xs text-muted-foreground">{t('image.library.pngSizeHelp')}</p>
        <div className="flex flex-wrap items-center gap-3">
          {(['width','height'] as const).map(axis => <label key={axis} className="flex items-center gap-2 text-sm">{t(axis === 'width' ? 'image.editor.dimensionWidth' : 'image.editor.dimensionHeight')}<input className="min-h-11 w-24 rounded-lg border border-border bg-background px-2" type="number" disabled={!loaded || loading || bgBusy} min={1} max={policy.resolutionLimits.inputMaxDimension} placeholder="auto" value={outputSize?.[axis] ?? ''} onChange={event => changeOutputSize(axis, Number(event.target.value))} /></label>)}
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={ratioLocked} onChange={event => setRatioLocked(event.target.checked)} />{t('image.library.keepRatio')}</label>
          {outputSize && <Button type="button" variant="ghost" onClick={() => { setOutputSize(undefined); }}>{t('image.library.autoSize')}</Button>}
        </div>
      </fieldset>
      <div ref={editorArea} className="library-image-editor" data-testid="image-editor-workspace" onClickCapture={event => {
        // Opening tools or touching the canvas is not a new operation. Native
        // format selection is; actual edits are observed below and in history.
        if (event.target instanceof Element && event.target.closest('.asp-fmt')) clearFeedback();
      }} onInputCapture={clearFeedback} onChangeCapture={event => {
        const input = event.target;
        // Template loading establishes a clean library baseline, but still owns a
        // user file. Protect it and cancel any operation on the previous scene.
        if (input instanceof HTMLInputElement && input.type === 'file' && input.accept.includes('.json') && input.files?.length) {
          if (loading) { event.stopPropagation(); input.value = ''; setNotice(t('image.library.loading')); return; }
          cancel(); clearFeedback(); invalidatePrepared(); setHasTemplateInput(true); setResult(undefined);
          setUnsavedWork('image-studio', { hasWork: true, kind: 'files', scopePath: '/tools/image-studio' });
        }
        // Route source replacement through the host's measured File-only import.
        if (input instanceof HTMLInputElement && input.type === 'file' && input.accept === 'image/*' && input.closest('.asp-menu') && !input.closest('label')?.classList.contains('asp-mt-sm')) {
          event.stopPropagation(); const file = input.files?.[0]; input.value = ''; if (file) void receiveRef.current(file);
        }
      }}>
        <ImageEditor key={generation} src={source?.file ?? null} mode="full" height={640} themeMode={theme} baseColor={theme === 'dark' ? '#18181b' : '#ffffff'} accentColor="#0284c7"
          exportFormats={FORMATS} exportQuality={92} jpegExportQuality={95} commitFormat="png" showCommit commitLabel={t('image.library.makeResult')}
          resolutionLimits={policy.resolutionLimits} exportArea="image" exportFileName={exportFileName} onCancelBackgroundRemoval={cancelBackgroundRemoval} onOutputSizeChange={size => { if (generation === latestGeneration.current) setNativeOutputSize(old => old?.width === size.width && old?.height === size.height ? old : size); }} initialTool={initialTool(selectedPreset)} initialRedactMode="pixelate" fontResolver={fontResolver}
          onJpegTransparencyChange={hasTransparency => { if (generation === latestGeneration.current) setJpegTransparencyNotice(hasTransparency); }}
          labels={labels} onBeforeExport={beforeExport} backgroundRemovalLoader={backgroundRemovalLoader}
          onImageLoaded={() => {
            const request = version.current;
            const ready = () => {
              if (generation !== latestGeneration.current || request !== version.current) return;
              // Clear the fork's sample text before exposing readiness or H1 ack.
              // Otherwise a fast edit can race the next-frame initialization.
              if (selectedPreset?.purpose === 'watermark') clearWatermarkDraft();
              setJpegTransparencyNotice(false); lastStableSource.current = source; bg.current?.onImageReplaced(); setLoaded(true); setResult(undefined); setDirty(false);
              loadedAck.current?.resolve(true); loadedAck.current = undefined; setLoading(false);
            };
            if (selectedPreset?.purpose === 'watermark') requestAnimationFrame(ready); else ready();
          }}
          onDirtyChange={value => { if (generation !== latestGeneration.current) return; setDirty(value); if (value) setResult(undefined); }}
          onHistoryChange={state => { if (generation === latestGeneration.current) { setJpegTransparencyNotice(false); if (transientFeedback.current) clearFeedback(); else noticeRevision.current++; documentRevision.current++; setHasHistoryInput(state.length > 1); invalidatePrepared(); setResult(undefined); } }}
          onSaved={blob => { if (generation === latestGeneration.current) void saved(blob); }} suppressHandledErrorToast onError={failure => {
            if (generation !== latestGeneration.current) return true;
            saving.current = false; destination.current = 'result'; pendingCommits.current = []; loadedAck.current?.resolve(false); loadedAck.current = undefined; setLoading(false);
            if (!failure.code.endsWith('cancelled')) { setErrorCode(failure.code); setError(messages[language][failure.code as keyof typeof messages.ko] || labels[ERROR_MESSAGES[failure.code]] || t('image.library.failed')); }
            return true;
          }} />
        {backgroundCancelled && <UtilityNotice role="status" announce="polite" data-testid="image-background-cancelled" className="sticky bottom-20 z-10 mt-2 bg-background shadow-md">{t('image.library.cancelled')}</UtilityNotice>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="image-editor-result-actions">
        <Button variant="outline" type="button" data-testid="image-editor-add-to-batch" aria-disabled={adding} className={adding ? 'opacity-60' : ''} disabled={!loaded || loading || bgBusy} onClick={() => commit('batch')}>{t('image.handoff.add', { count: batchCount })}</Button>
        {batchNotice && <span role="status">{t(`image.handoff.${batchNotice}`)}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="image-editor-send-actions" data-prepared-send={!!preparedSend}>
        <p className="w-full text-sm text-muted-foreground">{t('image.library.outputFormatHelp')}</p>
        <div role="group" aria-label={t('image.editor.format')} className="flex gap-1">
          {(['png','jpeg','webp'] as const).map(format => <Button key={format} type="button" variant={outputFormat === format ? 'secondary' : 'outline'} aria-pressed={outputFormat === format} onClick={() => { clearFeedback(); setOutputFormat(format); }}>{format === 'jpeg' ? 'JPG' : format === 'webp' ? 'WebP' : 'PNG'}</Button>)}
        </div>
        <Button type="button" className="h-auto min-h-11 whitespace-normal" data-testid="image-send-to-privacy" disabled={!loaded || loading || bgBusy} onClick={() => commit('privacy')}>{sendT('sendTo.privacy')}</Button>
        <Button type="button" className="h-auto min-h-11 whitespace-normal" data-testid="image-send-to-pdf" disabled={outputFormat === 'webp' || !loaded || loading || bgBusy} aria-describedby={outputFormat === 'webp' ? 'image-send-webp-reason' : undefined} onClick={() => commit('pdf')}>{sendT('sendTo.imagePdf')}</Button>
        {outputFormat === 'webp' && <p id="image-send-webp-reason" className="w-full text-sm text-muted-foreground">{sendT('sendTo.webp')}</p>}
        {sendReason && preparedSend && <div role="alert" className="w-full"><p>{sendT('sendTo.failed')}</p><Button type="button" variant="outline" onClick={downloadPrepared}>{sendT('sendTo.download')}</Button><Button type="button" variant="outline" onClick={retryPrepared}>{sendT('sendTo.retry')}</Button></div>}
      </div>
      {jpegTransparencyNotice && <p role="status" data-testid="image-jpeg-transparency" className="mt-2 text-sm text-muted-foreground">{t('image.library.jpegTransparency')}</p>}
      <div className="mt-3" data-testid="image-editor-export-action"><Button type="button" variant="outline" disabled={!loaded || loading || bgBusy} onClick={() => commit('download')}>{t('image.editor.download')}</Button></div>
      {result && resultUrl && resultPlan === resultPlanKey(outputFormat, outputSize) && <div className="mt-3 rounded-xl border border-border p-3" data-testid="image-editor-export-result" data-width={resultSize?.width} data-height={resultSize?.height}><div data-testid="image-editor-result">
        <img src={resultUrl} onLoad={event => { const image = event.currentTarget; if (image.currentSrc === resultUrl) setResultSize({ width: image.naturalWidth, height: image.naturalHeight }); }} alt={t('image.library.resultAlt')} className="max-h-64 max-w-full object-contain" />
        <a className="mt-2 inline-flex min-h-11 items-center text-primary underline" href={resultUrl} download={result.name}>{t('image.editor.download')}</a>
      </div></div>}
      {exportPrompt && <DecisionDialog title={t('image.library.exportWarningTitle')} onCancel={() => finishExport('cancel')}>
        <p>{t('image.library.exportWarning')}</p><div className="mt-4 flex flex-wrap gap-2">
          <Button autoFocus onClick={() => finishExport('flatten')}>{t('image.library.flatten')}</Button><Button variant="outline" onClick={() => finishExport('proceed')}>{t('image.library.proceed')}</Button><Button variant="ghost" onClick={() => finishExport('cancel')}>{t('image.cancel')}</Button>
        </div>
      </DecisionDialog>}
      {riskConsent && <DecisionDialog title={productRiskMessages[language].title} onCancel={() => finishProductRisk(false)}>
        <p>{productRiskMessages[language].body}</p>
        <div className="mt-4 flex gap-2"><Button variant="ghost" autoFocus onClick={() => finishProductRisk(false)}>{productRiskMessages[language].cancel}</Button><Button onClick={() => finishProductRisk(true)}>{productRiskMessages[language].proceed}</Button></div>
      </DecisionDialog>}
      {consent && <DecisionDialog title={t('image.library.downloadTitle')} onCancel={() => finishConsent(false)}>
        <p>{t('image.library.downloadDescription', { mode: consent.label, bytes: consent.downloadBytes.toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US') })}</p>
        <p className="mt-2">{consent.programFilesNote}</p><p className="mt-2">{t('image.library.downloadPrivacy')}</p>
        <div className="mt-4 flex gap-2"><Button autoFocus onClick={() => finishConsent(true)}>{t('image.library.download')}</Button><Button variant="ghost" onClick={() => finishConsent(false)}>{t('image.cancel')}</Button></div>
      </DecisionDialog>}
    </div>
  </UtilitySectionCard>;
}

function DecisionDialog({ title, onCancel, children }: { title: string; onCancel: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = ref.current; node?.showModal(); return () => { node?.close(); }; }, []);
  return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); onCancel(); }} className="m-auto max-h-[85vh] w-[min(92vw,560px)] overflow-auto rounded-2xl border border-border bg-background p-5 text-foreground shadow-xl backdrop:bg-black/50">
    <h2 className="mb-3 text-lg font-bold">{title}</h2>{children}
  </dialog>;
}
