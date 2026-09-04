# 브라우저 오피스 편집 자산 운영

브라우저 오피스 편집기와 XLS 정밀 보존은 GitHub Pages의 정적 파일만 사용한다. `npm run build`의 사전 단계가 공식 ZetaOffice 배포본을 내려받아 크기와 SHA-256을 확인한 뒤 `public/vendor/zetaoffice/2026-08-26/`에 복사한다. 이 디렉터리와 로컬 다운로드 캐시는 Git에 포함하지 않는다.

## 고정 스냅샷

| 파일 | 바이트 | SHA-256 |
| --- | ---: | --- |
| `soffice.js` | 858,124 | `5143e5354f470b87f86ba272bcfef857bd13e6f07b59666e48a7ccb89643cd77` |
| `soffice.wasm` | 161,667,499 | `9ebd9a487e849a24b9c69f843ebdb451709c27b7722c010e36846433474a5bd4` |
| `soffice.data` | 99,520,604 | `3dab0a5448e599dccc1b1e69f4f86ea9eb30777c3f1ed7b9c386a5f4163e361c` |
| `soffice.data.js.metadata` | 215,180 | `5d9d909d0b9b38443c0f19704032d0fc12d654f6c9c24c2c3b237739c4848ae3` |

공식 무료 CDN은 `zetaoffice_latest` 주소만 제공한다. 따라서 배포 스크립트는 위 해시와 다른 응답을 조용히 채택하지 않고 빌드를 중단한다. Actions 캐시는 검증된 스냅샷을 재사용한다. 별도 보관한 동일 스냅샷을 사용할 때는 빌드 환경의 `ZETAOFFICE_ASSET_BASE_URL`을 해당 디렉터리 URL로 지정한다. URL은 네 파일을 같은 경로에서 제공해야 한다.

스냅샷을 갱신할 때는 다음 항목을 한 변경으로 처리한다.

1. 별도 브랜치에서 공식 배포 파일을 내려받고 브라우저 편집 열기·저장을 검증한다.
2. `scripts/vendor-browser-runtimes.mjs`, `src/features/office-editor/officeAssets.ts`, `scripts/validate-static-output.mjs`의 버전·크기·해시를 함께 갱신한다.
3. GitHub Actions 캐시 키와 개인정보처리방침의 스냅샷 설명, 라이선스·원본 소스 링크를 검토한다.
4. 첫 다운로드 진행률, 취소 후 재시도, 캐시 재사용, 저장 파일 재열기를 Chrome과 Edge에서 확인한다.

## 배포·정책 경계

- 편집 안내 페이지는 일반 색인·광고·동의 정책을 따른다.
- `/ko/tools/office-editor/app/`와 `/en/tools/office-editor/app/`는 편집 전용 문서이며 `noindex`이고 사이트맵에서 제외한다. 방문 분석과 광고 코드는 이 작업 문서에서 시작하지 않는다.
- 문서는 네트워크 업로드나 Cache Storage에 넣지 않는다. Cache Storage에는 편집 프로그램 정적 자산만 저장한다.
- 문서를 열 때 매크로 실행과 외부 문서 갱신을 차단한다. 저장 결과는 ZIP 또는 Compound File 컨테이너 서명을 확인한 뒤 다운로드한다.
- 정확한 글꼴, 페이지 나눔, 수식, 매크로, 고급 Microsoft Office 개체 호환은 보장하지 않는다.

## QR 라벨 PDF 한글 글꼴 스냅샷

QR 일괄 생성의 라벨 PDF는 Noto CJK 저장소의 고정 태그 `Sans2.004`에 있는 한국어 subset Noto Sans KR Regular OTF를 사용한다. `scripts/vendor-qr-label-font.mjs`가 내려받은 응답의 크기와 SHA-256을 확인한 뒤 `public/vendor/qr-label-font/noto-cjk-sans-2.004/`를 생성한다. 라이선스는 SIL Open Font License 1.1이다.

| 파일 | 바이트 | SHA-256 | 라이선스 |
| --- | ---: | --- | --- |
| `NotoSansKR-Regular.otf` | 4,644,748 | `69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68` | SIL OFL 1.1 |
| `OFL.txt` | 4,301 | `6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2` | SIL OFL 1.1 |

`@pdf-lib/fontkit`은 rhwp Studio의 `NotoSansKR-Regular.woff2`를 읽고 PDF 저장까지 했지만 Poppler가 임베드 글꼴을 invalid로 판정하고 렌더 결과가 비었다. 고정 OTF는 정상 렌더됐으나 subset 임베드에서 한글 대부분이 누락되는 현상이 재현되어 라벨 PDF는 `subset: false` 전체 임베드를 사용한다.

## 라이선스 원본

- ZetaJS: MIT, <https://github.com/allotropia/zetajs>
- ZetaOffice에 사용된 LibreOffice 소스: <https://git.libreoffice.org/core/+/refs/heads/distro/allotropia/zeta-24-2>
- LibreOffice 라이선스 안내: <https://www.libreoffice.org/about-us/licenses/>

`npm run build`는 `public/legal/third-party-licenses.txt`도 다시 생성한다. 스냅샷을 교체할 때는 실제 배포 바이너리와 위 소스 링크의 대응 관계를 다시 확인해야 한다.
