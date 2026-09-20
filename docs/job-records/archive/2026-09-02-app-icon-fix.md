# 웹앱 설치 아이콘 결함 수정 작업계획서

- 기준 해시: `d64cb9af57d73bf5573b1fc9e649600fe0fbf763`
- 작성 근거: 사용자가 전달한 Claude 실측 수정 지시서
- Codex 반박 결과: 현행 `icon.svg`, PNG 메타데이터, manifest, 생성 스크립트 패턴을 실측했으며 이견 없음

## 작업 범위

1. `scripts/generate-app-icons.mjs`를 `puppeteer-core`와 기존 `findBrowser` 패턴으로 작성한다.
2. SVG를 Chrome에서 렌더링하여 any 192/512, maskable 192/512, apple-touch 180 PNG를 8-bit RGBA로 생성한다.
3. maskable은 `#09090D` 풀블리드 배경과 중앙 safe-zone용 70% 아이콘 배치를 사용하고, apple-touch는 불투명 풀블리드로 만든다.
4. `package.json`에 수동 `icons:generate` 스크립트를 추가한다.
5. `public/site.webmanifest`의 any/maskable 항목을 별도 파일 네 개로 분리하고 기존 이름·설명·URL 메타데이터는 유지한다.
6. 생성 명령을 실행해 PNG 다섯 개를 생성·교체한다.
7. `CHANGELOG.md`에 결과와 기각 사유를 Codx 서명으로 기록한다.

## 완료 기준

- Node 일회성 검사로 PNG bit depth/color type, 모서리 alpha, W 좌·우 색상 픽셀을 단언하고 출력을 보존한다.
- `file public/icon-*.png`에서 180/192/512 규격과 8-bit RGBA를 확인한다.
- `npm run build` 통과.
- `npm run test:static` 통과.
- 명시 경로만 스테이징·커밋하고 `git push origin main` 성공.
- `git rev-parse HEAD origin/main`이 같은 해시를 출력.

## 명시 허용/제외 목록

- 스테이징 허용: `public/icon-180.png`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-192.png`, `public/icon-maskable-512.png`, `scripts/generate-app-icons.mjs`, `package.json`, `public/site.webmanifest`, `CHANGELOG.md`.
- 제외: 루트의 미추적 MP4, DOCX, `.codex/`, `dist/`, `docs/jobs/` 및 그 밖의 사용자 변경.
- 빌드 체인·사용자 노출 문자열·i18n·SEO 본문·광고 경로는 변경하지 않는다.

## 제품·배포 판정

- 정적 생성 스크립트이므로 GitHub Pages 스택 유지.
- 사용자 노출 문자열 변경 없음. manifest의 기존 `name`, `short_name`, 설명, URL, 색상은 유지.
- 설치 메타데이터와 정적 자산만 바뀌므로 SEO 본문·AdSense 격리 경로 영향 없음.
- `main` push가 Pages 배포를 트리거하므로 검증 통과 후에만 push한다.
