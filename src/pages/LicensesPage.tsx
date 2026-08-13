import { ExternalLink, FileText, Scale, ShieldCheck } from "lucide-react";

import { PageHeader } from "../components/ui";

const libraries = [
  { name: "rhwp / @rhwp/core·@rhwp/editor 0.8.4", license: "MIT", url: "https://github.com/edwardkim/rhwp", purpose: "HWP·HWPX·HML 문서 해석, 편집기 UI와 파일 저장" },
  { name: "ffmpeg.wasm / @ffmpeg/core 0.12.10", license: "GPL-2.0-or-later", url: "https://github.com/ffmpegwasm/ffmpeg.wasm", purpose: "브라우저 비디오·오디오 인코딩" },
  { name: "@ffmpeg/ffmpeg 0.12.15", license: "MIT", url: "https://github.com/ffmpegwasm/ffmpeg.wasm", purpose: "FFmpeg WebAssembly Worker API" },
  { name: "Fabric.js 7.4.0", license: "MIT", url: "https://github.com/fabricjs/fabric.js", purpose: "대화형 이미지 레이어 편집" },
  { name: "gifenc 1.0.3", license: "MIT", url: "https://github.com/mattdesl/gifenc", purpose: "이미지 프레임 GIF 인코딩" },
  { name: "ExcelJS 4.4.0", license: "MIT", url: "https://github.com/exceljs/exceljs", purpose: "XLSX·CSV 읽기와 쓰기" },
  { name: "SheetJS 0.20.3", license: "Apache-2.0", url: "https://git.sheetjs.com/sheetjs/sheetjs", purpose: "XLS·XLSB·XLSM 입력 해석" },
  { name: "PDF.js 6.2.108", license: "Apache-2.0", url: "https://github.com/mozilla/pdf.js", purpose: "PDF 페이지 해석과 화면 렌더링" },
  { name: "pdf-lib 1.17.1", license: "MIT", url: "https://github.com/Hopding/pdf-lib", purpose: "PDF 병합·추출·회전과 결과 생성" },
  { name: "Tesseract.js 7.0.0", license: "Apache-2.0", url: "https://github.com/naptha/tesseract.js", purpose: "브라우저 OCR" },
  { name: "React·React Router", license: "MIT", url: "https://github.com/facebook/react", purpose: "사용자 인터페이스와 브라우저 라우팅" },
];

export function LicensesPage() {
  const worklazyLicenseUrl = `${import.meta.env.BASE_URL}legal/worklazy-license.txt`;
  const thirdPartyLicenseUrl = `${import.meta.env.BASE_URL}legal/third-party-licenses.txt`;
  return (
    <div className="page standard-page page-enter content-page">
      <PageHeader eyebrow="LICENSES" title="라이선스 및 제3자 고지" description="Worklazy Tools 자체 저작물의 이용 조건과 오픈소스 구성요소의 원 라이선스를 구분해 안내합니다." />
      <div className="policy-summary"><Scale size={25} /><div><strong>서로 다른 권리 범위</strong><p>Worklazy가 직접 작성한 부분은 All Rights Reserved이며, 오픈소스와 제3자 자료는 각 권리자가 정한 라이선스가 계속 적용됩니다.</p></div></div>
      <article className="prose-card">
        <section>
          <h2>Worklazy Tools 자체 코드와 디자인</h2>
          <p>직접 작성한 소스 코드, UI 디자인, 설명 문서와 고유 시각 자료는 저작권자의 사전 서면 허가 없이 복제·수정·재배포·미러링하거나 경쟁 서비스에 이용할 수 없습니다. 복제본이나 파생 서비스에 광고, 구독, 유료 접근 등으로 수익을 붙이는 행위도 허용하지 않습니다.</p>
          <p>브라우저에서 공식 서비스를 불러오고 합법적인 파일 작업에 사용하는 것은 허용됩니다. 이 조건은 아래 오픈소스 구성요소에 각 라이선스가 부여한 권리를 제한하지 않습니다.</p>
          <p><a href={worklazyLicenseUrl} target="_blank" rel="noreferrer"><ShieldCheck size={13} /> Worklazy Tools 라이선스 전문</a></p>
        </section>
        <section>
          <h2>명칭과 브랜드</h2>
          <p>Worklazy Tools 이름, 로고, 도메인과 서비스 식별 요소를 공식 서비스·제휴·후원으로 오인하게 사용할 수 없습니다. 일반적인 출처 표기나 사실에 근거한 언급은 가능하지만, 공식 복제본처럼 보이게 만드는 사용은 허용하지 않습니다.</p>
        </section>
        <section>
          <h2>제3자 라이선스 전문</h2>
          <p>배포 빌드에는 설치된 프로덕션 의존성에서 수집한 라이선스와 고지 전문 묶음을 포함합니다. 정확한 버전은 배포에 사용된 패키지 잠금 파일을 기준으로 합니다.</p>
          <p><a href={thirdPartyLicenseUrl} target="_blank" rel="noreferrer"><FileText size={13} /> 제3자 라이선스 전문 묶음</a></p>
        </section>
        {libraries.map((library) => <section key={library.name}><h2>{library.name}</h2><p>{library.purpose} · {library.license}</p><p><a href={library.url} target="_blank" rel="noreferrer">공식 소스와 라이선스 확인 <ExternalLink size={13} /></a></p></section>)}
        <h2>FFmpeg 소스 제공</h2>
        <p>FFmpeg WebAssembly 코어는 Worklazy 자체 라이선스의 대상이 아니며 GPL-2.0-or-later 조건이 우선합니다. 대응하는 소스 코드, 빌드 설정과 라이선스 정보는 위 ffmpeg.wasm 공식 저장소와 배포 고지 묶음에서 확인할 수 있습니다. 결과 미디어의 이용 권리와 코덱 관련 의무는 사용 지역과 용도에 따라 사용자가 확인해야 합니다.</p>
      </article>
    </div>
  );
}
