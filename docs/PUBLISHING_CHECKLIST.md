# 배포·검색·AdSense 체크리스트

## 1. 공개 주소 확정

이 프로젝트의 기본 배포 주소는 커스텀 도메인 `https://worklazy.net/`입니다. `public/CNAME`, 빌드 기본 URL과 Vite 기본 경로를 루트 도메인 기준으로 맞춰 두었으므로 최종 도구 주소는 `https://worklazy.net/tools/...` 형태이며 `/worklazytools`가 붙지 않습니다.

- `VITE_SITE_URL`: `https://worklazy.net/`
- `VITE_BASE_PATH`: `/`

현재 값은 배포 워크플로에 명시되어 있어 기존 Actions 변수의 영향을 받지 않습니다. 다른 도메인으로 바꿀 때는 워크플로의 두 값과 `public/CNAME`을 함께 변경해야 합니다. GitHub 저장소의 **Settings → Pages → Custom domain**에도 `worklazy.net`을 입력하고 DNS를 연결해야 합니다.

## 2. ads.txt의 루트 주소 확인

빌드 결과에는 게시자 `pub-8940087269746960`의 `ads.txt`가 포함됩니다. 배포 뒤 브라우저에서 반드시 아래 주소가 HTTP 200으로 열리는지 확인합니다.

```text
https://실제-등록-도메인/ads.txt
```

GitHub 프로젝트 Pages의 `/저장소/ads.txt`는 호스트의 루트 `/ads.txt`와 다릅니다. AdSense에 `계정.github.io`를 등록한다면 `https://계정.github.io/ads.txt`에서도 파일이 제공되어야 하므로, 사용자 Pages 저장소에서 루트 파일을 제공하거나 커스텀 도메인을 연결하는 편이 명확합니다.

## 3. AdSense 계정 설정

- AdSense의 사이트 목록에 최종 도메인을 추가하고 소유권 확인
- 광고 설정에서 자동 광고 또는 직접 만든 반응형 광고 단위 선택
- 파일 선택 버튼, 실행 버튼, 다운로드 버튼과 광고가 혼동되지 않도록 배치 확인
- EEA·영국·스위스 사용자에게 광고를 제공한다면 **Privacy & messaging**에서 Google 인증 CMP와 TCF v2.3 메시지 설정
- 개인정보처리방침의 광고·쿠키 고지가 실제 계정 설정과 일치하는지 확인

현재 HTML에는 AdSense 게시자 메타 태그와 공통 스크립트가 들어 있습니다. 실제 광고 노출은 AdSense에서 사이트가 준비됨 상태이고 광고 설정이 활성화되어야 시작됩니다.

## 4. Search Console 등록

- 최종 도메인 속성 등록 및 소유권 확인
- `https://실제-주소/sitemap.xml` 제출
- 홈, Excel 병합, Word 비교, 신규 계산·보안 도구와 개인정보처리방침 URL을 URL 검사 도구로 확인
- canonical이 최종 공개 주소를 가리키는지 확인
- 각 도구의 한국어·영어 Open Graph 이미지가 `public/social/tools/`의 1200×630 PNG로 표시되고 `summary_large_image` 카드가 생성되는지 확인
- 배포 후 404, 모바일 사용성, Core Web Vitals 확인

도구 이름이나 핵심 기능 문구를 바꾸면 `scripts/generate-social-images.mjs`의 같은 항목도 갱신하고 `npm run social:generate`를 실행합니다. 생성에는 Chrome 또는 Chromium이 필요하며 자동 탐색되지 않으면 `WORKLAZY_CHROME_PATH`에 실행 파일 경로를 지정합니다. 공유 이미지는 메타데이터에서만 참조하므로 일반 페이지 콘텐츠에서 미리 불러오지 않습니다.

## 5. 게시 전 운영 정보 확인

- 매년 1회 `workCalculator.ts`의 확정 임시공휴일·선거일(`EXTRA_HOLIDAYS`)을 정부 발표와 대조해 갱신
- 문의 페이지의 GitHub 채널이 실제 문의를 받을 수 있는지 확인
- 개인정보처리방침과 이용약관의 운영 주체·연락 방법을 필요에 따라 보강
- 중요 기능 변경 시 시행일, FAQ, 지원 범위와 sitemap을 함께 갱신
- 실제 브라우저에서 XLSX·XLS·XLSB·XLSM·CSV·암호화 파일·DOCX와 EXIF·QR·그림판 테스트
- `npm run test:utilities`, `npm run test:new-tools`, `npm run test:browser`, `npm run test:static` 통과 확인

AdSense 승인은 코드 설치만으로 보장되지 않습니다. 명확한 내비게이션, 실제 사용 가치가 있는 독창적인 설명, 정상 작동하는 페이지와 정책 준수가 함께 평가됩니다.
