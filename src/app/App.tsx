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
const AudioStudioPage = lazy(() => import("../features/audio-studio/AudioStudioPage").then((module) => ({ default: module.AudioStudioPage })));
const ImageStudioPage = lazy(() => import("../features/image-studio/ImageStudioPage").then((module) => ({ default: module.ImageStudioPage })));
const TextToolsPage = lazy(() => import("../features/text-tools/TextToolsPage").then((module) => ({ default: module.TextToolsPage })));
const TextFormatterPage = lazy(() => import("../features/text-formatter/TextFormatterPage").then((module) => ({ default: module.TextFormatterPage })));
const WorkCalculatorPage = lazy(() => import("../features/work-calculator/WorkCalculatorPage").then((module) => ({ default: module.WorkCalculatorPage })));
const TimezoneCalculatorPage = lazy(() => import("../features/timezone-calculator/TimezoneCalculatorPage").then((module) => ({ default: module.TimezoneCalculatorPage })));
const PayrollCalculatorPage = lazy(() => import("../features/payroll-calculator/PayrollCalculatorPage").then((module) => ({ default: module.PayrollCalculatorPage })));
const ImagePrivacyPage = lazy(() => import("../features/image-privacy/ImagePrivacyPage").then((module) => ({ default: module.ImagePrivacyPage })));
const SecurityToolsPage = lazy(() => import("../features/security-tools/SecurityToolsPage").then((module) => ({ default: module.SecurityToolsPage })));
const QrStudioPage = lazy(() => import("../features/qr-studio/QrStudioPage").then((module) => ({ default: module.QrStudioPage })));
const DataConverterPage = lazy(() => import("../features/data-converter/DataConverterPage").then((module) => ({ default: module.DataConverterPage })));

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
        <Route path="tools/audio-studio" element={<LazyToolRoute label="오디오 도구"><AudioStudioPage /></LazyToolRoute>} />
        <Route path="tools/image-studio" element={<LazyToolRoute label="이미지 도구"><ImageStudioPage /></LazyToolRoute>} />
        <Route path="tools/text-tools" element={<LazyToolRoute label="텍스트 도구"><TextToolsPage /></LazyToolRoute>} />
        <Route path="tools/text-formatter" element={<LazyToolRoute label="포맷터"><TextFormatterPage /></LazyToolRoute>} />
        <Route path="tools/work-calculator" element={<LazyToolRoute label="근무일 계산기"><WorkCalculatorPage /></LazyToolRoute>} />
        <Route path="tools/timezone-calculator" element={<LazyToolRoute label="시차 계산기"><TimezoneCalculatorPage /></LazyToolRoute>} />
        <Route path="tools/payroll-calculator" element={<LazyToolRoute label="급여 계산기"><PayrollCalculatorPage /></LazyToolRoute>} />
        <Route path="tools/image-privacy" element={<LazyToolRoute label="사진 개인정보 도구"><ImagePrivacyPage /></LazyToolRoute>} />
        <Route path="tools/security-tools" element={<LazyToolRoute label="비밀번호 생성기"><SecurityToolsPage /></LazyToolRoute>} />
        <Route path="tools/qr-studio" element={<LazyToolRoute label="QR 도구"><QrStudioPage /></LazyToolRoute>} />
        <Route path="tools/data-converter" element={<LazyToolRoute label="표 데이터 변환기"><DataConverterPage /></LazyToolRoute>} />
        <Route path="hwp-editor" element={<Navigate to="/tools/hwp-editor" replace />} />
        <Route path="video-studio" element={<Navigate to="/tools/video-studio/" replace />} />
        <Route path="audio-studio" element={<Navigate to="/tools/audio-studio" replace />} />
        <Route path="image-studio" element={<Navigate to="/tools/image-studio" replace />} />
        <Route path="text-tools" element={<Navigate to="/tools/text-tools" replace />} />
        <Route path="text-formatter" element={<Navigate to="/tools/text-formatter" replace />} />
        <Route path="work-calculator" element={<Navigate to="/tools/work-calculator" replace />} />
        <Route path="timezone-calculator" element={<Navigate to="/tools/timezone-calculator" replace />} />
        <Route path="payroll-calculator" element={<Navigate to="/tools/payroll-calculator" replace />} />
        <Route path="image-privacy" element={<Navigate to="/tools/image-privacy" replace />} />
        <Route path="security-tools" element={<Navigate to="/tools/security-tools" replace />} />
        <Route path="qr-studio" element={<Navigate to="/tools/qr-studio" replace />} />
        <Route path="data-converter" element={<Navigate to="/tools/data-converter" replace />} />
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
