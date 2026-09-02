# CHANGELOG

작업 기록 정본. 한 일은 자신의 이름(Claude · Codx · Gemini)으로 남긴다(「작업 기록」 규칙). 핵심 결과와 함께 **기각 사유**도 기록한다 — 이미 기각된 길을 다시 파지 않기 위해서다.

## 2026-09-02

- Gemini 위임 경로를 확립: 이 호스트의 Gemini 호출은 agy CLI로 수행하며(`--add-dir` 필수 — 없으면 저장소 파일 접근 불가 실측), 타임아웃 상향·`--json-schema` 구조화·`--sandbox` 사용 기준과 산출물 검증 절차를 `CLAUDE.md` 「호스트 참고」에 기록. — Claude
- Chrome 기반 앱 아이콘 생성기를 추가해 SVG 그라데이션을 8-bit RGBA PNG 5종으로 재생성하고 manifest의 `any`/`maskable` 자산을 분리했다. 그라데이션 미지원 래스터라이저 재사용과 투명 라운드 아이콘의 Apple·maskable 겸용은 각각 색상 소실·마스크 크롭 문제로 기각했으며 픽셀·알파 검증, 빌드, 단위 테스트 58개, 정적 산출물 검증을 통과했다. — Codx
- 세 에이전트 협업 체계 도입: 공통 규칙 정본 `PROJECT_RULES.md` 신설(기존 CLAUDE/AGENTS 공통 3규칙을 「GitHub Pages 스택」·「현지화·SEO·AdSense 동시 검토」·「내부 구현 비노출」로 명명해 이관), 역할 지시서 `CLAUDE.md`(오케스트레이터·판정자) · `AGENTS.md`(Codex, 코드 유일 작성자) · `GEMINI.md`(대규모 컨텍스트 분석·조사) 분리. `docs/jobs/` 오프라인 작업지시서 체계와 `docs/backlog.md` 도입. 사용자 결정으로 「커밋·업로드·배포는 Codex」 규칙 추가. — Claude
- 운영 문서를 규칙 정본의 부속 명세로 연계: 「생성물 직접 수정 금지」에 벤더 스냅샷 해시 검증 원칙과 `docs/OFFICE_EDITOR_ASSETS.md` 참조, 「현지화·SEO·AdSense 동시 검토」·「커밋·업로드·배포는 Codex」에 `docs/PUBLISHING_CHECKLIST.md` 참조를 추가. 수치·절차는 규칙이 아니라 해당 문서에서 갱신한다. — Claude
- 2026-08-15–16 신뢰성 작업지시서 4개를 종결하고 `docs/jobs/archive/` 오프라인 아카이브로 이관. 1차는 비디오·오디오·이미지·PDF·데이터·문서·계산/보안 전 영역의 약 120개 항목을 감사해 P0 데이터 무결성 결함과 주요 P1을 수정했고, 2차는 수정 회귀와 부분 해결분을 재검증했으며, 3차는 R1–R14 해결과 블러·비디오 회귀 S1–S14를 추적했고, 4차는 S1–S14 해결을 확인했다. — Codx
- 3차 이의 제기 판정 보존: 규칙 출처 표기는 일부 수용, `w:trackRevisions` 삭제 지시는 정식 OOXML 요소라는 증거로 기각하고 잘못된 `trackChanges`만 제거, 오디오 워커의 파일 전환 종료는 메모리 정리 정책상 유지, Excel 끝단 트림 안전장치 완화는 불변식 검증 전까지 기각, 비디오 memo 콜백 비교는 의도적 무시 계약을 주석·테스트로 확정했다. — Codx
- 현행 `72981cc`에서 4차 T1–T7을 재검증: T1·T2·T3·T5·T6·T7 해결, T4 미해결. 근거는 `rg` 실측으로 T1의 `getObjectScaling`과 DPR 비의존 단위 테스트, T2의 유효 구간 기반 export readiness와 60초 probe timeout, T3의 `frameRateProbeStatus` 1회 완료 가드, T5의 base 위 효과 레이어 재정렬과 Safari 2–3 pass 폴백, T6의 선택 영역 소스 픽셀 렌더(효과 경로 전체 `toCanvasElement` 없음), T7의 원본 샘플링 주석·ko/en 가이드·좌표/memo 테스트·시트 참조 인덱스 1회 구축을 확인했다. T4는 `resolveConcatFrameRate(..., fallback = 30)`과 `[undefined, 0, NaN] -> 30` 테스트가 남아 있어 `docs/backlog.md`로 이관했다. FPS 필터를 단순 생략하는 안은 재인코딩 세그먼트를 stream-copy 결합하는 현재 구조에서 공통 호환 레이트를 잃으므로 기각했다. — Codx
- 종결 검증: `npm run build` 통과(2,336 modules transformed, 55 localized crawlable pages generated), `npm run test:unit` 통과(15 tests, 15 pass, 0 fail), `npm run test:static` 통과(localized pages·hreflang·self-hosted runtimes·ads.txt·robots.txt·sitemap.xml). — Codx
