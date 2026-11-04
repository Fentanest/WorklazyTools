// Prebundle worker dependencies before launching workers so Vite cannot reload mid-job.
import "gifenc";
import "pdf-lib";
import { pdfToImageArchive, releasePdf } from '../src/features/pdf-editor/pdfPreview';
import { exportPdfGroups } from '../src/features/pdf-editor/pdfWorkerClient';
import { batchProcessImages } from '../src/features/image-studio/imageWorkerClient';
import { createVideoZip } from '../src/features/video-studio/videoZipClient';

Object.assign(window, { zipDownloadTest: { pdfToImageArchive, releasePdf, exportPdfGroups, batchProcessImages, createVideoZip } });
