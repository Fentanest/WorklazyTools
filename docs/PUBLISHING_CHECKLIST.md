# 배포·검색·AdSense 체크리스트

## 적용 범위 — 최초 공개·광범위 변경용

이 전체 목록은 **최초 공개, 도구군·공통 실행/출력 계약의 광범위 변경, 도메인·광고·게시 기반 변경** 때 확인한다. 평상시 작은 수정·보존용 커밋·중간 묶음 검수마다 전 항목을 반복하지 않는다. 적용 여부·변경 영향·기존 유효 결과를 먼저 확인한다.

일반 제품 수정의 최종 후보는 PROJECT_RULES.md와 verification-guide.md의 기본/영향 범위 검사만 한다. 이 체크리스트는 CI·기존 브랜치 보호·배포의 강제 검사를 비활성화하는 근거가 아니다. 외부 계정·법정 고지·운영 값은 해당 항목을 실제 적용할 때 공식 원문과 현재 설정을 확인한다.

## 1. 공개 주소 확정

기본 주소는 `https://worklazy.net/`이다. `public/CNAME`, 빌드 URL과 Vite 기본 경로를 루트 도메인 기준으로 맞추고 최종 도구 주소는 `/tools/...`이며 `/worklazytools`를 붙이지 않는다. `VITE_SITE_URL=https://worklazy.net/`, `VITE_BASE_PATH=/`와 실제 배포 workflow를 대조한다. 도메인 변경 시 두 값·CNAME·Pages Custom domain·DNS를 함께 확인한다. 미변경이면 매 소규모 수정마다 재설정하지 않는다.

## 2. ads.txt

기존 게시자 `pub-8940087269746960`의 ads.txt가 실제 최종 도메인 루트에서 HTTP 200인지 최초 공개·게시 기반 변경 때 확인한다. GitHub 프로젝트 Pages의 `/저장소/ads.txt`와 호스트 루트 `/ads.txt`를 혼동하지 않는다. 사용자 Pages 또는 커스텀 도메인 구조에 맞게 확인한다.

## 3. AdSense 계정

최종 도메인 등록·소유권, 준비됨 상태, 자동 광고/직접 광고 단위, 파일 선택/실행/다운로드와 광고 구분, 개인정보·쿠키 고지와 실제 설정을 확인한다. EEA·영국·스위스에 광고를 제공하는 경우 기존 Google 인증 CMP·TCF 메시지 설정(기존 문서 v2.3 표기)을 현행 공식 요구와 대조한다. 이 문서 유지보수에서 계정 설정·광고 노출을 임의 변경하지 않는다. 코드 설치만으로 승인·노출이 보장되지 않는다.

## 4. Search Console·공유 정보

최초 공개·주소/SEO 구조 변경 때 소유권·sitemap 제출·대표 도구/정책 URL 검사·canonical·404·모바일·Core Web Vitals를 확인한다. 한·영 도구 Open Graph PNG는 `public/social/tools/`의 1200×630, summary_large_image 사용 여부와 실제 메타데이터를 대조한다.

도구 이름·핵심 문구 변경 시 `scripts/generate-social-images.mjs`의 해당 항목을 갱신하고 필요한 `npm run social:generate`를 실행한다. 실제 Chrome/Chromium 필요 시 `WORKLAZY_CHROME_PATH`를 확인한다. 공유 이미지는 본문에서 불필요하게 선로드하지 않는다. 무관한 모든 도구의 이미지를 다시 만들지 않는다.

## 5. 운영 정보·광범위 기능 확인

연간 운영 점검 또는 관련 계산기 변경 시 `workCalculator.ts`의 EXTRA_HOLIDAYS를 정부 발표와 대조한다. 문의 채널·정책 운영 주체/연락처는 최초 공개·실제 변경 때 확인한다. 중요 기능 변경의 시행일·FAQ·지원 범위·sitemap 영향도 해당 범위에서 확인한다.

최초 공개 또는 관련 도구군의 광범위 변경 때 XLSX·XLS·XLSB·XLSM·CSV·암호화 파일·DOCX·EXIF·QR·그림판 등 **영향 있는 형식·도구군**을 실제 브라우저에서 확인한다. `test:utilities`, `test:new-tools`, `test:browser`, `test:static` 중 해당 범위 검사를 선택한다. 전체 목록이 적용되지 않는 경우 ‘최초/광범위 체크리스트 비적용’으로 기록하고 평상시 필수 검사·영향 범위 스모크는 유지한다. 이전 유효한 결과를 재사용하고 무관한 전수 검사를 새로 강제하지 않는다.
