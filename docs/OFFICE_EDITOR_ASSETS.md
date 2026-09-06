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

QR 일괄 생성의 라벨 PDF는 Noto CJK 저장소의 고정 태그 `Sans2.004`에 있는 한국어 Noto Sans KR Regular OTF를 사용한다. 라벨 원문과 NFC 정규화 문자열이 고정 3,394 코드포인트 안에 모두 있으면 빌드 타임 서브셋을, 하나라도 범위 밖이면 기존 전체 OTF를 사용한다. 두 폰트 모두 `@pdf-lib/fontkit`에는 `subset: false`로 전달하며 런타임 서브셋은 사용하지 않는다. 라이선스는 SIL Open Font License 1.1이다.

| 역할 / 파일 | 위치 | 바이트 | SHA-256 |
| --- | --- | ---: | --- |
| 전체 폴백 OTF · `NotoSansKR-Regular.otf` | `public/vendor/qr-label-font/noto-cjk-sans-2.004/` | 4,644,748 | `69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68` |
| 공용 라이선스 · `OFL.txt` | 같은 전체 snapshot 및 생성된 subset snapshot | 4,301 | `6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2` |
| 코드포인트 생성 입력 · `unicodes-alias.txt` | `scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/` | 23,757 | `ac8fefb54a969022fc1b139a3a7a1937f711e71280fb992683eb0d4d43978b0c` |
| 추적 전개 입력 · `NotoSansKR-Regular.ksx1001.otf.gz` | 같은 생성 입력 폴더 | 561,161 | `e1db3cdcbb8d76fc0546ec582bed773b3b7ef3da60867b6828493a6b342c7e66` |
| 브라우저 subset OTF · `NotoSansKR-Regular.ksx1001.otf` | 생성된 `public/vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/` | 931,704 | `b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be` |
| 런타임 coverage · `coverage.json` | 생성 입력 폴더 및 생성된 subset snapshot | 19,686 | `58f248442d4e8e5726559644a746740bd0066cebabf154956e0bb7e1458eafea` |
| coverage 명세 · `coverage.schema.json` | 생성 입력 폴더 | 444 | `919d01b6713b3438f6cd36091d3244a04a28822b031a5cdd7ac135ff3d17e6b0` |
| 재현 기록 · `provenance.json` | 생성 입력 폴더 및 생성된 subset snapshot | 1,201 | `30e10e1815835b8076a100ecdc9804c2613b115b555cbcc0b122150b92f77667` |
| 도구 lock · `fonttools==4.59.2` wheel | `scripts/requirements-fonts.txt` | — | `738f31f23e0339785fd67652a94bc69ea49e413dfdb14dcb8c8ff383d249464e` |

일반 `npm run vendor:qr-font`와 prebuild는 Python을 실행하지 않는다. 추적된 gzip·coverage·provenance를 먼저 검증하고 bounded gunzip한 뒤 원본 전체 OTF·OFL까지 확인해 두 소유 snapshot을 staging에서 교체한다. 서브셋을 의도적으로 갱신할 때만 `/tmp` 가상환경에 `scripts/requirements-fonts.txt`를 `--require-hashes`로 설치하고 `scripts/build-qr-label-font-subset.py`를 실행한다. 이 스크립트는 fontTools 4.59.2, GNU gzip 1.12, 입력·출력 SHA, cmap 3,394개, GID·hmtx·outline 불변을 모두 확인한 뒤 추적 입력만 원자적으로 교체한다.

rhwp Studio WOFF2와 pdf-lib 런타임 subset은 Poppler에서 빈 글리프 또는 한글 누락을 일으켜 계속 기각한다. 현재 빌드 타임 subset은 GID를 보존하고 layout closure의 원본 cmap 매핑을 포함한다. 고정 회귀는 전체 OTF와 subset OTF를 각각 `subset: false`로 임베드해 sample·inventory·expanded 17페이지에서 Poppler 픽셀 차이 0과 PDF.js 추출 결과 동일을 요구한다.

## 라이선스 원본

- ZetaJS: MIT, <https://github.com/allotropia/zetajs>
- ZetaOffice에 사용된 LibreOffice 소스: <https://git.libreoffice.org/core/+/refs/heads/distro/allotropia/zeta-24-2>
- LibreOffice 라이선스 안내: <https://www.libreoffice.org/about-us/licenses/>

`npm run build`는 `public/legal/third-party-licenses.txt`도 다시 생성한다. 스냅샷을 교체할 때는 실제 배포 바이너리와 위 소스 링크의 대응 관계를 다시 확인해야 한다.

## RHWP Studio 고정 스냅샷

HWP 편집기는 공식 rhwp Studio를 Worklazy Tools와 같은 origin의 정적 자산으로 제공한다. 현재 고정값은 다음과 같다.

| 항목 | 고정값 |
| --- | --- |
| 버전 / 태그 | `0.8.6` / `v0.8.6` |
| upstream 커밋 | `f1f9c6ae58344ee9368996d3543f76b9345cf227` |
| npm 패키지 | `@rhwp/core@0.8.6`, `@rhwp/editor@0.8.6` |
| payload | 77파일, 60,680,448바이트 |
| `rhwp-vendor.json` | 11,836바이트, SHA-256 `a559f14562af337834843d3f9e207f93005faaa205a948e6110537f0acfc3440` |
| manifest 포함 전체 | 78파일, 60,692,284바이트 |

`scripts/vendor-rhwp-studio.mjs`는 GitHub의 정확한 `v0.8.6` 태그를 sparse clone하고, 설치된 두 npm 패키지 버전이 목표 버전과 정확히 일치할 때만 Studio를 빌드한다. 외부 웹폰트는 `RHWP_DISABLE_EXTERNAL_WEBFONTS=1`로 차단한다. Studio 단독 배포에는 HwpCtrl 플러그인이 필요하지 않아 `RHWP_WITHOUT_HWPCTRL=1`을 기본 적용하며, 이에 따라 플러그인 포함 빌드보다 payload가 1파일·54,571바이트 작고 `studio-plugin` 청크가 남지 않는다.

생성과 검증 절차는 다음과 같다.

1. `npm install`을 실행하고 `npm ls @rhwp/core @rhwp/editor --depth=0`과 두 설치 package.json에서 버전이 모두 `0.8.6`인지 확인한다.
2. `npm run vendor:rhwp`를 실행한다. 스크립트는 Studio 빌드 뒤 `workbox-*.js`, `registerSW.js`, `sw.js`, `manifest.webmanifest`를 재귀 제거하고 잔존 파일이 있으면 실패한다.
3. 생성된 `rhwp-vendor.json`의 각 파일 `{bytes, sha256}`를 검토한 뒤 `node scripts/validate-rhwp-vendor.mjs`를 실행한다. validator는 manifest에 없는 추가 파일과 실제로 누락된 파일, 바이트·SHA-256 불일치를 모두 거부한다. 같은 검증은 `npm run build`의 prebuild 게이트에서도 실행된다.
4. 교체 검증이 끝난 이전 스냅샷만 `npm run vendor:rhwp:prune`으로 제거한다. 스크립트의 명시 허용목록 밖 버전과 현재 버전은 제거할 수 없다.

rollback은 업그레이드 커밋을 revert해 package/lock/config와 이전 고정 스냅샷을 함께 복원한 뒤 `npm ci`, `node scripts/validate-rhwp-vendor.mjs`, HWP 전용 왕복 스모크를 다시 실행한다. `public/vendor/**` 파일을 손으로 복사·수정·삭제해서 되돌리지 않는다.
