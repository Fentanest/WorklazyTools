import { ExternalLink, FileText, Scale, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../components/ui";
import { useAppLanguage } from "../i18n/routing";

const libraries = [
  { name: "rhwp / @rhwp/core·@rhwp/editor 0.8.4", license: "MIT", url: "https://github.com/edwardkim/rhwp", purpose: "HWP·HWPX·HML 문서 해석, 편집기 UI와 파일 저장" },
  { name: "ZetaOffice / LibreOffice browser build snapshot 2026-08-25", license: "MPL-2.0", url: "https://git.libreoffice.org/core/+/refs/heads/distro/allotropia/zeta-24-2", purpose: "Writer·Calc·Impress 브라우저 편집 화면" },
  { name: "ZetaJS 1.2.0", license: "MIT", url: "https://github.com/allotropia/zetajs", purpose: "LibreOffice UNO JavaScript 연결" },
  { name: "JSDoc legacy Word reader snapshot 821695a", license: "0BSD", url: "https://github.com/Alpaq92/JSDoc", purpose: "Word 97–2003 DOC 문서 해석" },
  { name: "ffmpeg.wasm / @ffmpeg/core·@ffmpeg/core-mt 0.12.10", license: "GPL-2.0-or-later", url: "https://github.com/ffmpegwasm/ffmpeg.wasm", purpose: "브라우저 단일·멀티스레드 비디오 및 오디오 인코딩" },
  { name: "@ffmpeg/ffmpeg 0.12.15", license: "MIT", url: "https://github.com/ffmpegwasm/ffmpeg.wasm", purpose: "FFmpeg WebAssembly Worker API" },
  { name: "coi-serviceworker 0.1.7", license: "MIT", url: "https://github.com/gzuidhof/coi-serviceworker", purpose: "GitHub Pages 비디오·오피스 작업 화면의 교차 출처 격리" },
  { name: "Fabric.js 7.4.0", license: "MIT", url: "https://github.com/fabricjs/fabric.js", purpose: "대화형 이미지 레이어 편집" },
  { name: "gifenc 1.0.3", license: "MIT", url: "https://github.com/mattdesl/gifenc", purpose: "이미지 프레임 GIF 인코딩" },
  { name: "ExcelJS 4.4.0", license: "MIT", url: "https://github.com/exceljs/exceljs", purpose: "XLSX·CSV 읽기와 쓰기" },
  { name: "SheetJS 0.20.3", license: "Apache-2.0", url: "https://git.sheetjs.com/sheetjs/sheetjs", purpose: "XLS·XLSB·XLSM 입력 해석" },
  { name: "PDF.js 6.2.108", license: "Apache-2.0", url: "https://github.com/mozilla/pdf.js", purpose: "PDF 페이지 해석과 화면 렌더링" },
  { name: "pdf-lib 1.17.1", license: "MIT", url: "https://github.com/Hopding/pdf-lib", purpose: "PDF 병합·추출·회전과 결과 생성" },
  { name: "Tesseract.js 7.0.0", license: "Apache-2.0", url: "https://github.com/naptha/tesseract.js", purpose: "브라우저 OCR" },
  { name: "change-case", license: "MIT", url: "https://github.com/blakeembrey/change-case", purpose: "텍스트 케이스 변환" },
  { name: "sql-formatter·fast-xml-parser", license: "MIT", url: "https://github.com/sql-formatter-org/sql-formatter", purpose: "SQL·XML 포맷과 문법 검사" },
  { name: "date-fns·Luxon", license: "MIT", url: "https://github.com/date-fns/date-fns", purpose: "영업일·연차·IANA 타임존 계산" },
  { name: "d3-geo·TopoJSON Client·World Atlas", license: "ISC / Natural Earth Public Domain", url: "https://github.com/d3/d3-geo", purpose: "세계지도 투영·TopoJSON 변환과 Natural Earth 국가 경계 렌더링" },
  { name: "ExifReader", license: "MPL-2.0", url: "https://github.com/mattiasw/ExifReader", purpose: "사진 EXIF 메타데이터 읽기" },
  { name: "zxcvbn-ts", license: "MIT", url: "https://github.com/zxcvbn-ts/zxcvbn", purpose: "비밀번호 패턴과 강도 분석" },
  { name: "qrcode·jsQR", license: "MIT / Apache-2.0", url: "https://github.com/soldair/node-qrcode", purpose: "QR 코드 생성과 이미지 디코딩" },
  { name: "Papa Parse", license: "MIT", url: "https://github.com/mholt/PapaParse", purpose: "CSV 파싱과 직렬화" },
  { name: "React·React Router", license: "MIT", url: "https://github.com/facebook/react", purpose: "사용자 인터페이스와 브라우저 라우팅" },
];

export function LicensesPage() {
  const { t } = useTranslation("pages");
  const language = useAppLanguage();
  const worklazyLicenseUrl = `${import.meta.env.BASE_URL}legal/worklazy-license.txt`;
  const thirdPartyLicenseUrl = `${import.meta.env.BASE_URL}legal/third-party-licenses.txt`;
  return (
    <div className="page standard-page page-enter content-page">
      <PageHeader eyebrow="LICENSES" title={t("licenses.title")} description={t("licenses.description")} />
      <div className="policy-summary"><Scale size={25} /><div><strong>{t("licenses.summaryTitle")}</strong><p>{t("licenses.summary")}</p></div></div>
      <article className="prose-card">
        <section>
          <h2>{t("licenses.ownTitle")}</h2>
          {(t("licenses.own", { returnObjects: true }) as string[]).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <p><a href={worklazyLicenseUrl} target="_blank" rel="noreferrer"><ShieldCheck size={13} /> {t("licenses.ownLink")}</a></p>
        </section>
        <section>
          <h2>{t("licenses.brandTitle")}</h2>
          <p>{t("licenses.brand")}</p>
        </section>
        <section>
          <h2>{t("licenses.thirdTitle")}</h2>
          <p>{t("licenses.third")}</p>
          <p><a href={thirdPartyLicenseUrl} target="_blank" rel="noreferrer"><FileText size={13} /> {t("licenses.thirdLink")}</a></p>
        </section>
        {libraries.map((library) => <section key={library.name}><h2>{library.name}</h2><p>{language === "ko" ? `${library.purpose} · ` : ""}{library.license}</p><p><a href={library.url} target="_blank" rel="noreferrer">{t("licenses.sourceLink")} <ExternalLink size={13} /></a></p></section>)}
        <h2>{t("licenses.ffmpegTitle")}</h2>
        <p>{t("licenses.ffmpeg")}</p>
      </article>
    </div>
  );
}
