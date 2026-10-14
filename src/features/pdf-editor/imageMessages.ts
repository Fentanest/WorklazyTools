import { featureMessage } from '../../i18n/featureMessages';
import type { AppLanguage } from '../../i18n/languages';
import { ImageInputError, type ImageStage } from './imageInput.ts';
export function imageStageMessage(language: AppLanguage, stage: ImageStage) {
  return featureMessage(language, `pdf.imageInput.stages.${stage}`);
}
export function imageFailureMessage(language: AppLanguage, name: string, index: number, stage: ImageStage) {
  return featureMessage(language, 'pdf.imageInput.failure', { index: index+1, name, stage: imageStageMessage(language,stage) });
}
export function imageConversionError(reason: unknown, language: AppLanguage, file: File, index: number, id: string) {
  const stage = reason instanceof ImageInputError ? reason.stage : 'read';
  return Object.assign(new Error(imageFailureMessage(language,file.name,index,stage), { cause: reason }), {
    imageId: id, stage, errorName: reason instanceof Error && reason.cause instanceof Error ? reason.cause.name : (reason as Error)?.name,
  });
}
