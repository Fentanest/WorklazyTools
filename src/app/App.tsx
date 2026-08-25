import { lazy, Suspense, useLayoutEffect } from "react";
import { Outlet, Route, Routes, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AppShell } from "../components/AppShell";
import { ExcelMergerPage } from "../features/excel-merger/ExcelMergerPage";
import { DocumentCompareSessionProvider } from "../features/document-compare/documentCompareSession";
import { AboutPage } from "../pages/AboutPage";
import { ContactPage } from "../pages/ContactPage";
import { HomePage } from "../pages/HomePage";
import { LicensesPage } from "../pages/LicensesPage";
import { PrivacyPage } from "../pages/PrivacyPage";
import { TermsPage } from "../pages/TermsPage";
import { ToolsPage } from "../pages/ToolsPage";
import { LanguageLandingPage } from "../pages/LanguageLandingPage";
import type { PdfToolMode } from "../features/pdf-editor/types";
import { InvalidLanguageRedirect, LocalizedNavigate, useAppLanguage } from "../i18n/routing";
import { isAppLanguage } from "../i18n/languages";

const PdfEditorPage = lazy(() => import("../features/pdf-editor/PdfEditorPage").then((module) => ({ default: module.PdfEditorPage })));
const HwpEditorPage = lazy(() => import("../features/hwp-editor/HwpEditorPage").then((module) => ({ default: module.HwpEditorPage })));
const DocumentComparePage = lazy(() => import("../features/document-compare/DocumentComparePage").then((module) => ({ default: module.DocumentComparePage })));
const DocumentCompareResultPage = lazy(() => import("../features/document-compare/DocumentCompareResultPage").then((module) => ({ default: module.DocumentCompareResultPage })));
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
const OfficeEditorPage = lazy(() => import("../features/office-editor/OfficeEditorPage").then((module) => ({ default: module.OfficeEditorPage })));
const OfficeEditorAppPage = lazy(() => import("../features/office-editor/OfficeEditorAppPage").then((module) => ({ default: module.OfficeEditorAppPage })));

export function App() {
  return (
    <Routes>
      <Route index element={<LanguageLandingPage />} />
      <Route path=":lang" element={<LanguageLayout />}>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="tools" element={<ToolsPage />} />
          <Route path="tools/excel-merger" element={<ExcelMergerPage />} />
          <Route path="tools/excel-merger/xls-preserve" element={<ExcelMergerPage />} />
          <Route path="tools/pdf-editor" element={<PdfRoute mode="organize" />} />
          <Route path="tools/pdf-editor/split" element={<LocalizedNavigate to="/tools/pdf-editor" />} />
          <Route path="tools/pdf-editor/image-to-pdf" element={<PdfRoute mode="image-to-pdf" />} />
          <Route path="tools/pdf-editor/pdf-to-image" element={<PdfRoute mode="pdf-to-image" />} />
          <Route path="tools/pdf-editor/convert" element={<PdfRoute mode="convert" />} />
          <Route path="tools/document-compare" element={<DocumentCompareSessionProvider />}>
            <Route index element={<LazyToolRoute label="Document compare"><DocumentComparePage /></LazyToolRoute>} />
            <Route path="results/:pairNumber" element={<LazyToolRoute label="Document comparison results"><DocumentCompareResultPage /></LazyToolRoute>} />
          </Route>
          <Route path="tools/word-compare/*" element={<LocalizedNavigate to="/tools/document-compare" />} />
          <Route path="tools/hwp-compare/*" element={<LocalizedNavigate to="/tools/document-compare" />} />
          <Route path="tools/hwp-editor" element={<KoreanOnlyRoute><LazyToolRoute label="HWP editor"><HwpEditorPage /></LazyToolRoute></KoreanOnlyRoute>} />
          <Route path="tools/office-editor" element={<LazyToolRoute label="Office editor"><OfficeEditorPage /></LazyToolRoute>} />
          <Route path="tools/office-editor/app" element={<LazyToolRoute label="Office editor workspace"><OfficeEditorAppPage /></LazyToolRoute>} />
          <Route path="tools/video-studio" element={<LazyToolRoute label="Video Studio"><VideoStudioPage /></LazyToolRoute>} />
          <Route path="tools/audio-studio" element={<LazyToolRoute label="Audio Studio"><AudioStudioPage /></LazyToolRoute>} />
          <Route path="tools/image-studio" element={<LazyToolRoute label="Image Studio"><ImageStudioPage /></LazyToolRoute>} />
          <Route path="tools/text-tools" element={<LazyToolRoute label="Text Tools"><TextToolsPage /></LazyToolRoute>} />
          <Route path="tools/text-formatter" element={<LazyToolRoute label="Formatter"><TextFormatterPage /></LazyToolRoute>} />
          <Route path="tools/work-calculator" element={<LazyToolRoute label="Workday Calculator"><WorkCalculatorPage /></LazyToolRoute>} />
          <Route path="tools/timezone-calculator" element={<LazyToolRoute label="World Time Planner"><TimezoneCalculatorPage /></LazyToolRoute>} />
          <Route path="tools/payroll-calculator" element={<LazyToolRoute label="Payroll Calculator"><PayrollCalculatorPage /></LazyToolRoute>} />
          <Route path="tools/image-privacy" element={<LazyToolRoute label="Photo Metadata Remover"><ImagePrivacyPage /></LazyToolRoute>} />
          <Route path="tools/security-tools" element={<LazyToolRoute label="Password Generator"><SecurityToolsPage /></LazyToolRoute>} />
          <Route path="tools/qr-studio" element={<LazyToolRoute label="QR Studio"><QrStudioPage /></LazyToolRoute>} />
          <Route path="tools/data-converter" element={<LazyToolRoute label="Table Data Converter"><DataConverterPage /></LazyToolRoute>} />
          <Route path="hwp-editor" element={<LocalizedNavigate to="/tools/hwp-editor" />} />
          <Route path="video-studio" element={<LocalizedNavigate to="/tools/video-studio/" />} />
          <Route path="audio-studio" element={<LocalizedNavigate to="/tools/audio-studio" />} />
          <Route path="image-studio" element={<LocalizedNavigate to="/tools/image-studio" />} />
          <Route path="text-tools" element={<LocalizedNavigate to="/tools/text-tools" />} />
          <Route path="text-formatter" element={<LocalizedNavigate to="/tools/text-formatter" />} />
          <Route path="work-calculator" element={<LocalizedNavigate to="/tools/work-calculator" />} />
          <Route path="timezone-calculator" element={<LocalizedNavigate to="/tools/timezone-calculator" />} />
          <Route path="payroll-calculator" element={<LocalizedNavigate to="/tools/payroll-calculator" />} />
          <Route path="image-privacy" element={<LocalizedNavigate to="/tools/image-privacy" />} />
          <Route path="security-tools" element={<LocalizedNavigate to="/tools/security-tools" />} />
          <Route path="qr-studio" element={<LocalizedNavigate to="/tools/qr-studio" />} />
          <Route path="data-converter" element={<LocalizedNavigate to="/tools/data-converter" />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="licenses" element={<LicensesPage />} />
          <Route path="*" element={<LocalizedNavigate to="/" />} />
        </Route>
      </Route>
      <Route path="*" element={<InvalidLanguageRedirect />} />
    </Routes>
  );
}

function LanguageLayout() {
  const { lang } = useParams();
  const { i18n } = useTranslation();

  useLayoutEffect(() => {
    if (!isAppLanguage(lang)) return;
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  }, [i18n, lang]);

  if (!isAppLanguage(lang)) return <InvalidLanguageRedirect />;
  return <Outlet />;
}

function KoreanOnlyRoute({ children }: { children: React.ReactNode }) {
  const language = useAppLanguage();
  return language === "ko" ? children : <LocalizedNavigate to="/tools" />;
}

function PdfRoute({ mode }: { mode: PdfToolMode }) {
  const { t } = useTranslation("common");
  return <Suspense fallback={<div className="page tool-page page-enter tool-route-loading" role="status">{t("status.loadingTool", { tool: "PDF Tools" })}</div>}><PdfEditorPage mode={mode} /></Suspense>;
}

function LazyToolRoute({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useTranslation("common");
  return <Suspense fallback={<div className="page tool-page page-enter tool-route-loading" role="status">{t("status.loadingTool", { tool: label })}</div>}>{children}</Suspense>;
}
