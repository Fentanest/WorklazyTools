import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { ExcelMergerPage } from "../features/excel-merger/ExcelMergerPage";
import { WordComparePage } from "../features/word-compare/WordComparePage";
import { WordCompareResultPage } from "../features/word-compare/WordCompareResultPage";
import { WordCompareSessionProvider } from "../features/word-compare/wordCompareSession";
import { HwpCompareSessionProvider } from "../features/hwp-compare/hwpCompareSession";
import { AboutPage } from "../pages/AboutPage";
import { ContactPage } from "../pages/ContactPage";
import { HomePage } from "../pages/HomePage";
import { LicensesPage } from "../pages/LicensesPage";
import { PrivacyPage } from "../pages/PrivacyPage";
import { TermsPage } from "../pages/TermsPage";
import { ToolsPage } from "../pages/ToolsPage";
import type { PdfToolMode } from "../features/pdf-editor/types";

const PdfEditorPage = lazy(() => import("../features/pdf-editor/PdfEditorPage").then((module) => ({ default: module.PdfEditorPage })));
const HwpEditorPage = lazy(() => import("../features/hwp-editor/HwpEditorPage").then((module) => ({ default: module.HwpEditorPage })));
const HwpComparePage = lazy(() => import("../features/hwp-compare/HwpComparePage").then((module) => ({ default: module.HwpComparePage })));
const HwpCompareResultPage = lazy(() => import("../features/hwp-compare/HwpCompareResultPage").then((module) => ({ default: module.HwpCompareResultPage })));
const VideoStudioPage = lazy(() => import("../features/video-studio/VideoStudioPage").then((module) => ({ default: module.VideoStudioPage })));
const ImageStudioPage = lazy(() => import("../features/image-studio/ImageStudioPage").then((module) => ({ default: module.ImageStudioPage })));

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="tools" element={<ToolsPage />} />
        <Route path="tools/excel-merger" element={<ExcelMergerPage />} />
        <Route path="tools/pdf-editor" element={<PdfRoute mode="organize" />} />
        <Route path="tools/pdf-editor/split" element={<Navigate to="/tools/pdf-editor" replace />} />
        <Route path="tools/pdf-editor/image-to-pdf" element={<PdfRoute mode="image-to-pdf" />} />
        <Route path="tools/pdf-editor/pdf-to-image" element={<PdfRoute mode="pdf-to-image" />} />
        <Route path="tools/pdf-editor/convert" element={<PdfRoute mode="convert" />} />
        <Route path="tools/word-compare" element={<WordCompareSessionProvider />}>
          <Route index element={<WordComparePage />} />
          <Route path="results/:pairNumber" element={<WordCompareResultPage />} />
        </Route>
        <Route path="tools/hwp-compare" element={<HwpCompareSessionProvider />}>
          <Route index element={<LazyToolRoute label="HWP 비교"><HwpComparePage /></LazyToolRoute>} />
          <Route path="results/:pairNumber" element={<LazyToolRoute label="HWP 비교 결과"><HwpCompareResultPage /></LazyToolRoute>} />
        </Route>
        <Route path="tools/hwp-editor" element={<LazyToolRoute label="HWP 도구"><HwpEditorPage /></LazyToolRoute>} />
        <Route path="tools/video-studio" element={<LazyToolRoute label="비디오 도구"><VideoStudioPage /></LazyToolRoute>} />
        <Route path="tools/image-studio" element={<LazyToolRoute label="이미지 도구"><ImageStudioPage /></LazyToolRoute>} />
        <Route path="hwp-editor" element={<Navigate to="/tools/hwp-editor" replace />} />
        <Route path="video-studio" element={<Navigate to="/tools/video-studio" replace />} />
        <Route path="image-studio" element={<Navigate to="/tools/image-studio" replace />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="licenses" element={<LicensesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function PdfRoute({ mode }: { mode: PdfToolMode }) {
  return <Suspense fallback={<div className="page tool-page page-enter tool-route-loading" role="status">PDF 도구를 준비하는 중…</div>}><PdfEditorPage mode={mode} /></Suspense>;
}

function LazyToolRoute({ label, children }: { label: string; children: React.ReactNode }) {
  return <Suspense fallback={<div className="page tool-page page-enter tool-route-loading" role="status">{label}를 준비하는 중…</div>}>{children}</Suspense>;
}
