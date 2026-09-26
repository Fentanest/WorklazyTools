# Backlog

종결된 작업 묶음에서 살아남은 후속 항목을 여기에 남긴다(「작업지시서 관리」 규칙). 항목마다 배경이 된 작업과 판단 근거를 한 줄로 병기한다.

## FolioTrace 역사적 이력 후속 (2026-09-27)

- **제3자 공시 언급의 체계적 조사**: 2006-02-08 포스코 권유 문서의 국민연금공단 보통주 피권유자 명단(수량 비공개)과 2008-10-07 KB금융지주 공시의 국민연금공단 최대주주 5.03% 서술을 직접 국민연금 제출 D001과 별도로 구조화했다. 현재 2건은 사용자가 제시한 공개 원문 표본이며, 모든 제3자 공시의 국민연금 언급을 완전 탐색했다는 뜻은 아니다. 향후 별도 수집 범위·중복·관계 대상 검증 없이는 보유 수량/평가로 확장하지 않는다. — Codx
- **실수집 확인 — 역사적 백필**: 2005–2008년 엄격 조회 0건, 첫 기관 D001 접수 2009-02-27을 확인했으므로 2009-01-01부터 `foliotrace-data`에서 수동 시작하고 별도 커서를 매일 재개한다. 오래된 접수에서 원문 파싱 실패가 발생하면 목록 확인과 수량 미확인을 구분해 남기고 원인을 조사한다. 운영 완료 창·신규 접수·원문 재확인 수는 첫 실제 Actions 실행 결과로 기록한다. — Codx

## FolioTrace 후속 (2026-09-26)

- **후속 — 원장·게시 검증**: 첫 build-only CI에서 DART 목록 9페이지, 262개 종목 가격 조회가 실행됐고 데이터 브랜치에 상태가 보존됐다. 이후 정규장 15:30 분봉과 과거 공시 사실 보강 코드를 수정했으므로 새 후보의 live 재실행·정식 검수·최종 배포 수치를 별도로 판정한다. 과거 전체 공시 coverage는 여전히 미검증이다. — Codx
- **후속 — 공시 정정·metadata 복구**: 원문 수량의 '주식등'과 의결권 주식량 일치만으로 보통주를 단정하지 않는다. 별도 종목코드·증권종류 근거가 없는 보유는 평가에서 제외한다. 정정 원접수번호의 확인된 연결·철회 확정, metadata 미해결 596건의 한정 복구, 실제 다일 추이는 추가 실증 대상이다. — Codx
- **후속 — 특별 거래시간·기업행위 근거 확대**: 네이버 분봉은 날짜·종목이 맞는 KRX 확정 종가와 매 종목 대조하고, KRX 공식 연도별 휴장일을 조회한다. 특별 거래시간은 공식 발표로 확인한 날짜만 등록한다. 향후 변경 공지는 날짜별로 반영해야 하며, 확인되지 않은 세션의 가격이 공식 종가와 맞지 않으면 미평가한다. 상장주식 수가 접수일 이후 달라졌고 사건별 직접 근거가 없으면 해당 보유를 미평가로 남긴다. — Codx
- **후속 — 독립 시각 검토**: Gemini 3.1 Pro 한도 초과로 고정 후보의 독립 픽셀 열람은 미실행이다. 로컬 합성 fixture 브라우저 스모크와 구분하고 가용 시 실제 검토·수리를 회수한다. — Codx

## 번들 다이어트 (2026-09-21) — 종결

- **종결 — B1/B2/B3 착수하지 않음(사용자 결정)** — pdf-lib 중복 공급 제거는 게이트 위반 해소가 아니라 선택적 최적화다. 커밋 `0f02458`(사용자 결정)이 기본 번들 상한 5종을 `null`로 없애 정본이 조사 대상으로 삼은 `sharedJsGzip > +30720` 실패가 현재 소스에서 발생할 수 없고, 고정 비교 입력 3종도 소실됐다. 회수량 154,886 B(151.3 KiB, 앱 전체 배포 JS gzip의 2.61%)에 비해 21개 worker 회귀·PDF 바이트 동일성·캐시/해시 설계 비용(추정 5~10인일)이 커 착수하지 않기로 했다. 관련 문서 3건은 `docs/jobs/archive/`로 이동했다. — Claude 판정(Opus) / Codx 진단
- **비차단·작업 없음 — 번들 계측 사각지대** — `scripts/bundle-module-attribution.mjs`가 non-main module을 거부해 worker·public 산출물이 opaque로 빠진다. 다이어트와 무관한 계측 정확도 문제이며 현재 어떤 게이트도 이에 의존하지 않는다. — Claude

## 접근성 (2026-09-22)

- **완료 — 대비·랜드마크 수정** — 자동 위반 64→28, `region` 57→0, `color-contrast` 위반 89→72, incomplete 1,858→1,807. 라이트 `--label-secondary` 한 단계 하향 + 미달 tertiary 소비자 4곳 교체(위계 보존), 320px 배지 겹침 수정, 상단바 `role=region`. — Muse 구현 / Claude 감사
- **기각 — 브랜드 카드 흰 글씨 대비** — 사용자 결정. 코랄을 눈에 띄게 어둡게 해야 하므로 채택하지 않았다. **수용된 부채이며 이후 감사에서 새 결함으로 보고하지 않는다.** 결정이 바뀌면 `docs/jobs/archive/TODO-STATUS-AUDIT-20260920.md` §F를 갱신한다. — Claude 판정
- **완료 — 접근성 감사기 언어 정합** — 루트 `/`를 ko-KR로 가정해 첫 페이지에서 중단되던 것을 제품 기본 언어(`en`)를 읽도록 고쳤다. 선언을 못 찾으면 실패하므로 조용히 어긋나지 않는다. — Codx 구현 / Claude 감사

## 시각·접근성 (2026-09-21)

- **완료 — 시각 회귀 스위트 복구** — 기준 이미지 249장 재생성(표본 12건 육안 판정 후), 구식 하네스 셀렉터 14건 수정, desktop-1920 viewport 추가(+4), mint family 연결(+4), VISUAL_SHARD 구현. N=274, shard 계약 합집합 274·교집합 0·누락 0·중복 0 총괄 재확인. `src/` 변경 0건. — Muse 구현 / Claude 감사
- **결정 대기 — 접근성 대비 수정** — 자동 위반 64건(146노드)과 incomplete 판정 실제 결함 514노드. 네 군데 색 문제가 반복 집계된 것이다. `--label-secondary` 한 단계 하향은 육안 차이 없이 다수를 해소하지만, 브랜드 카드 흰 글씨 문제는 코랄을 눈에 띄게 어둡게 해야 해 승인된 테마 변경에 해당한다. 사용자 판단 필요. — Claude 판정 / Codx 판정
- **접근성 감사기 선행 결함** — `tests/accessibility-audit.mjs`가 `/`를 ko-KR로 추정하나 현행 기본 언어는 `en`이라 첫 페이지에서 감사가 중단된다. 우회 없이는 접근성 검사가 헛돈다. 수정 필요. — Codx

## 스모크 기대값 드리프트 (2026-09-22)

오늘 하루에 발견한 **"검사가 조용히 헛도는" 네 번째·다섯 번째 사례**다. 제품 변경 뒤 검사 기대값이 따라오지 않아 첫 관문에서 막히고, 그 뒤 단언이 아예 실행되지 않는다. 실패가 쌓여도 CI 게이트가 아니라 아무도 보지 않았다.

- **완료 — excel-compare 타이틀 기대값** — `6eff3de`. `"Excel 비교·대사"` → `"Excel 비교"`. 제품이 맞고 검사가 낡았다(`92925e8`, 09-16). 관문 통과 후 **약 25개 단언이 실제로 실행·통과**했다. — Muse 구현 / Claude 판정
- **완료 — pdf-finish 준비 상태 안내 허용목록** — `3568b42`. alert 0건 기대를 의도된 안내 2건(`pdf-finish-link-preservation`, `pdf-finish-preview-disclaimer`) 명시 허용으로 바꿨다(`cea060b`, 09-08). 그 외 alert는 여전히 실패하고 허용목록 2건이 없어도 실패한다. 관문 통과 후 **약 50개 단언이 실제로 실행·통과**했다. — Muse 구현 / Claude 판정
- **남음 — excel-compare `assertB4Affordance`(`:243`)** — 검사가 `hover:bg-green-500/10!`를 요구하나 제품은 `eea9b1e`(액센트 정리, main 포함)의 `hover:bg-primary/10!`다. `origin/main`에서도 동일 실패. 제품이 맞고 검사가 낡았다. — Muse 보고 / Claude
- **남음 — pdf-finish `testFinishWorkflow`(`:663`)** — `[role='alert'].last()`가 글꼴 오류 대신 미리보기 고지를 잡는다. `6fd7c8a`(warning 기본 role=alert, main 포함) 이후 페이지 전역 `.last()` 선택자가 낡았다. `origin/main`에서도 동일 실패. lifecycle·golden 4종은 아직 미실행. — Muse 보고 / Claude
- **판정 — 배포를 막지 않는다** — 두 스모크는 CI 게이트가 아니며(`deploy-pages.yml`은 build·unit·ads·static·video-hybrid만 강제) `origin/main`에서도 동일하게 실패한다. 즉 현재 운영도 이 검사를 통과한 적이 없다. 검증된 제품 수정을 기존 검사 부패 때문에 붙잡지 않는다. 복구는 별도 작업으로 이어간다. — Claude 판정(Opus)

## 화면 결함·기술 부채 묶음 (2026-09-22)

- **완료 — T8 사이드바 메뉴 경계 잘림**(사용자 직접 신고) — `858af6e`. 박스 겹침이 아니라 클리핑 경계가 행 가운데를 지나는 것이 원인. 단일 여백값으로 3높이를 동시에 만족할 수 없어 `margin-bottom: 8px` + `padding-bottom: 56px` + 하단 페이드 마스크 채택. — Muse 구현 / Claude 감사
- **잔여 위험 — ZIP 4GiB+ 크기 경계 미실측** — entry 수 경계(65,536)는 통과했으나 크기 경계는 실측하지 않았다. — Codx

## 모바일 셸 (2026-09-21)

- **완료 — 모바일 수평 오버플로 24px** — `.wl-topbar`의 1020px 이하 `margin: 0 -24px`를 820px 이하 규칙이 되돌리지 않아 390px에서 상단바 폭이 438px이 되고 문서가 24px 넘쳤다. 4개 도구 bottom 모바일 8/8이 전부 24px였고 운영 3페이지에서도 재현됐다. 820px 이하에 `margin: 0`을 추가해 해소했다. 390·900·1365px에서 오버플로 0을 확인했고 900px 구간의 음수 여백은 의도대로 유지된다. — Codx 진단 / Muse 구현 / Claude 감사
- **완료 — 라이트 테마 브랜드 워드마크 대비** — 모바일 브랜드는 텍스트가 아니라 `logo.svg` 이미지이고 워드마크가 `#FFFFFF`로 박혀 있어 라이트 테마의 밝은 헤더에서 묻혔다. 워드마크만 `#18181B`로 바꾼 `public/logo-light.svg`를 추가해 라이트 2종에서만 교체한다. 4테마 실측 대비 라이트 16.86:1 · 다크 17.26:1. 언어 선택 화면은 이미지에 `background: #111118` 어두운 타일이 깔려 있어(`global.css:132`) 양 테마 모두 18.80:1이므로 교체 대상이 아니다. — Muse 구현·반박 / Claude 감사

## AdSense 재검토 후속 (2026-09-20)

- **완료 — 기존 unit 실패 잔여 4건 해소** — `p1b-components` 3건은 승인된 현행 컴포넌트 계약을 놓친 낡은 단언으로 판정해 갱신했고, `ui-legacy-isolation` 1건은 유효한 Tailwind checkbox utility를 동등한 arbitrary utility로 치환했다. 최종 통합 전체 unit 605/605, 실패 0을 확인했다. — Codx
- **ToolCard 제목 h2/h3 결정 대기** — 제품과 테스트는 모두 `h2`이나 정본 `ui-theme-redesign-20260907:159`는 `h3`이고 `c5b64f6`에서 회귀가 유입됐다. 제품·테스트 중 어느 계약을 고칠지 사용자 결정을 기다린다. — Claude 판정 / Codx 확인
- **완료 — Muse 새 worktree 부트스트랩 정지 원인 조사** — 원인은 stdin이 닫히지 않는 소켓/파이프였다(정지 프로세스의 fd 0이 socket, epoll 등록, `ep_poll` 대기). `< /dev/null`을 붙이면 7초 만에 세션이 생성된다. DB 크기와 inotify 한도 고갈 가설은 모두 기각했다. 런북 반영 `7fb3290`, 상세 `docs/review-notes.md` 2026-09-21. — Claude 판정(Opus) / Muse 반영
- **완료 — PdfComparePage 가이드 미연결** — `PdfComparePage`에 기존 `pdfCompare` 가이드를 연결해 한·영 사용법 안내와 FAQ 3개를 런타임에 표시한다. — Codx
- **Office Editor 랜딩 가이드의 `?guide=1` 한정 노출** — 일반 랜딩은 `/tools/office-editor/app/`으로 즉시 이동하고 편집기에서 안내 링크로 돌아온 `?guide=1`일 때만 랜딩 가이드가 보인다. 의도와 발견 가능성을 별도 판정한다. — Codx
- **완료 — S5 도구 로딩 실패 시 광고 제외 오류 페이지 이동** — Auto ads 초기화 API 부재 이유로 광고 없는 독립 오류 문서로의 전체 문서 이동으로 구현했다. 첫 시도 1·재로드 1, 최종 광고 0 실측. — Codx
- **S10 모바일 overlay 이번 범위 제외** — 사용자 판단에 따라 2026-09-21 배포에서 제외. 실제 광고 overlay를 만들려면 정확 URL 스텁이 필요. — Claude 판정
- **S6 PDF Editor 루트 SPA 이동** — `/tools/pdf-editor/merge` 정확 링크 부재는 확인했고 PDF 루트 전환은 한국어·영어에서 검사했다. 후속으로 제외 하위 경로의 직접 링크가 생기면 해당 전환을 추가 검사한다. — Muse
- **AdSense 계정 설정 확인** — 계정의 페이지 제외 목록에 광고 전면 제외 4경로군과 격리 경로가 포함됐는지, 사이트 수준 Auto ads 설정과 실제 노출 표본이 코드 정책과 일치하는지 확인한다. — Muse
- **Codex worktree 신뢰 등록 정리** — 작업을 위해 `~/.codex/config.toml`에 추가한 `wt-adsense-guides`, `wt-adsense-adtest`, `wt-adsense-integration` 신뢰 등록 3줄은 관련 worktree 작업 종료 뒤 제거한다. — Codx
- **완료 — S9 보호 가드 광고 제외 경로 문서 교체 — 2026-09-21** — 앱 확인창에서 승인한 동일 이동을 `beforeunload`가 다시 차단한 것이 원인이었다. 승인 intent를 출발 URL·작업 세대에 한정해 재차단을 건너뛰되, 승인 없는 새로고침·닫기 보호는 유지했다. — Claude 판정(Opus) / Codx 확인
- **완료 — 데스크톱 `.bottom-tabs` 노출** — 전역 기본값을 `display: none`으로 두고 기존 모바일 미디어 쿼리의 3열 `display: grid`를 유지했다. 통합 production 화면에서 1365×900 숨김과 412×839 3열 표시를 재확인했다. — Codx
- **완료 — 광고 스모크 빌드 출처 메타데이터 오기** — 하드코딩 문구를 제거하고 실행 시점의 `runHead`와 `distMtime`을 구분해 기록한다. — Muse
- **완료 — 광고 스모크 판별·네트워크 단언 보강** — 기대 실패의 타입·코드·정확한 메시지를 함께 검사하고 S5·판별 경로에서도 네트워크 단언을 독립 실행하며 실패 결과의 계수를 보존한다. — Muse

## UI 시각 기준선 재설정


## Excel 비교 — 중복키·머리글 후속

- **완료 — BL01 마지막 더보기 소진 뒤 초점 목적지** (2026-09-22, `5139c75`. 중복 목록 한정 정책, ko/en 완료 문구 추가) — 151행 중복 목록을 키보드로 펼친 뒤 마지막 50개를 불러오면 버튼이 DOM에서 사라지고 초점이 `BODY`로 이동했다(ko/en × light/dark **4/4**). `/ko/tools/excel-compare/`에서 151행 동일 키 CSV 두 파일 → 키 비교 → 중복 목록 → 마지막 더보기를 Tab·Enter로 실행해 재현한다. 다음 Tab의 목적지와 완료 안내 정책을 별도 접근성 계약으로 정한다. — Codx
- **종결(수정 없음) — BL02 긴 시트명 잘림** (2026-09-22. `guides.json`에 대상 문자열 0건, 390px·dark 직접 열람 넘침 0. 기존 변경으로 해소) — Excel 비교 안내 카드의 연속 영문 시트명 문자열이 카드 오른쪽에서 잘리는 상태가 기존 시각 기준선과 S2/S3 캡처에 동일하게 남아 있다. `/ko/tools/excel-compare/` guide를 모바일 폭 390px·dark에서 최하단까지 내려 재현하며, 표현 또는 줄바꿈을 고친 뒤 해당 기준선만 갱신한다. — Codx
- **완료 — BL03 desktop 컨트롤 상단 가림** (2026-09-22, `0899636`. 죽은 `.app-topbar` 셀렉터가 원인. 셸 개별 평가 + 뷰포트 fallback) — 1365×900 한국어 사용자 1행/B 결과에서 오른쪽 목록을 Enter로 펼친 뒤 toggle rect가 `y=-19.53125..24.46875`, 전후 Tab·Shift+Tab 상태는 `y=0.46875`로 3px 초점 링 여백이 부족했다. 중앙 hit는 보이지만 라벨·링 일부가 잘리며 두 테마 **6상태**가 이전 커밋과 동일하다. `/ko/tools/excel-compare/` 결과에서 오른쪽 toggle을 키보드로 열고 앞뒤로 이동해 재현한다. 고정 shell이 없는 desktop 상단 회피 정책은 UI 재설계 계획에서 정한다. — Codx
- **완료 — BL05 결과 검색 입력 헤더 가림** (2026-09-22, `0cded0d`. 입력이 보정 대상에 미등록이 원인. 활성 요소와 링 측정 분리) — 390×844 결과 준비 단계에서 검색 입력 중앙 가시성은 전체 72상태 중 **71/72**였고, 실제 Tab 진입 시 ko/en `y=44.5/44.53125`, header bottom `63`, 중앙 hit가 `HEADER`였다. `/ko/tools/excel-compare/` 또는 `/en/tools/excel-compare/`에서 결과를 만든 뒤 검색 입력까지 Tab으로 이동해 재현한다. 고정 chrome 회피 범위를 검색 입력까지 넓힐지는 UI 재설계 계획에서 정한다. — Codx
- **BL06 · Excel cleaner의 오류 셀 재출력 타입 — 중간 우선순위(spreadsheet-core 소비자)** — BL04 부모 `d9c79b7`부터 cleaner 모델은 공용 셀의 `type`을 투영하지 않고 출력도 `value/cachedValue`만으로 작성해 실제 오류 표시값을 일반 문자열로 재출력한다. BL04는 머리글 감지 정확도를 위한 입력 모델 교정이므로 출력 정책까지 넓히지 않았다. 실제 오류와 같은 literal 문자열을 구별해 정리 결과의 오류 셀 타입을 보존할지 별도 출력 계약과 roundtrip oracle로 정한다. — Codx

## 비디오 스튜디오

- **B단계 10단계(확대) 후속** — 비디오 성능·용량 정본 계획(2026-09-02, 1~9단계 완료·아카이브) 잔여: ① WebM 스트리밍 확대(mediabunny 기각으로 보류 — 채택 조건은 대안 demuxer/muxer의 WebM roundtrip 검증) ② 브라우저 네이티브 AudioEncoder 지원 범위 확대(미지원 AAC는 현재 FFmpeg 오디오-only 하이브리드로 처리) ③ copy 모드의 비호환 음향을 FFmpeg로 변환해 영상 패스스루와 합치는 별도 하이브리드(현재는 품질을 암묵 변경하지 않고 job별 음향 제외만 제안). 근거·기각 이력은 `docs/review-notes.md` 참조.
- **A5 · 속도/품질 토글(코덱별 전문가 옵션)** — 계획 왕복에서 제외 확정(VideoTask에 preset 필드 부재·VP9는 cpu-used 체계·CRF/비트레이트 모드별 의미 상이·UI 복잡도). B3 하드웨어 인코딩 배포로 필요성 재평가 후 설계.

- **T4 · 모든 concat 입력의 FPS 확인 실패 시 30fps 강제 폴백** — 4차 신뢰성 작업지시서 후속. 현행 `src/features/video-studio/videoEncoding.ts`의 `resolveConcatFrameRate(frameRates, fallback = 30)`과 `tests/unit/video-encoding.test.ts`의 `[undefined, 0, NaN] -> 30` 단언을 `rg -n 'resolveConcatFrameRate|fallback = 30|undefined, 0, Number.NaN' ...`로 확인했다. 60fps 원본이 모두 probe 실패하면 30fps로 낮아질 수 있다. FPS 필터를 단순 생략하는 안은 재인코딩 세그먼트의 stream-copy 결합 호환성을 깨므로 기각하며, 입력 스트림에서 신뢰 가능한 레이트를 추가 취득하거나 사용자 선택 공통 레이트로 정규화하는 방식이 필요하다. — Codx

## 문서 비교

- **도달 불가 컴포넌트 3종 제거 검토** — P2 UI 마이그레이션 정본(`p2-tool-migration-20260904.md` 확정 2항)에서 **P2 명시 제외 + backlog 이관**으로 판정한 항목. `/word-compare`·`/hwp-compare`는 독립 route 가 아니라 `/document-compare` redirect 이므로 아래 3개 파일은 route 도달성이 없다. 전환 비용을 들일 이유가 없어 P2 에서 손대지 않았고, 제거는 별도 단위로 남긴다.
  - 대상(2026-09-05 Claude 실측 — `grep -rn "<심볼>" src/ --include=*.ts --include=*.tsx`): `src/features/word-compare/WordComparePage.tsx`(318줄) · `src/features/hwp-compare/HwpComparePage.tsx`(231줄) · `src/features/hwp-compare/HwpCompareResultPage.tsx`(19줄). 세 심볼 모두 자기 `export` 선언 외 **참조 0건**.
  - **제거 시 주의 — 같은 디렉터리에 살아 있는 모듈이 섞여 있다.** `WordCompareResultPage`(448줄·외부 참조 1건)는 `DocumentCompareResultPage` 가 소비하는 **현역**이고, `wordWorkerClient`·`hwpWorkerClient`(각 외부 참조 2건)도 현역이다. `wordCompareSession`·`hwpCompareSession`·`docModel`·`word.worker`·`hwp-compare.worker`·`*.py` 는 디렉터리 **외부** 참조가 0이지만 내부에서 현역 client 체인에 물려 있을 수 있으므로, 페이지 3개를 지운 직후 그 자리에서 각 모듈의 남은 사용처를 다시 grep 해 죽은 것만 함께 정리한다(「사용처를 하나 지우면 그 자리에서 다른 사용처를 grep 한다」). 디렉터리 통째 삭제 금지.
  - 완료 기준: `npm run build` · `npx tsc -b` · `TEST_SCOPE=word npm run test:browser` · `TEST_ONLY_HWP=1 npm run test:new-tools` 통과 + `/word-compare`·`/hwp-compare` redirect 동작 유지. — Claude

## ZIP 출력 공통

> 두 항목 모두 **U5 파일 정리 선조사(2026-09-05)에서 나왔으나 U5 와 무관하게 성립하는 저장소 결함 후보**다. U5 는 2026-09-06 사용자 결정으로 로드맵에서 드랍됐고, 이 둘만 살려 이관했다. — Claude

- **완료 — ZIP 결과 쓰기 4경로 공통화** (2026-09-22, `aff608b`. DOCX·읽기 3경로는 계약 상이로 제외, ExcelJS 간접 의존은 잔존. unzip·jar 한글 및 65,536 entry ZIP64 통과, 4GiB+ 경계 미실측) — 이 저장소는 ZIP 라이브러리 **두 개**를 함께 의존한다: `@zip.js/zip.js` 2.9.0(공용 C3 결과 ZIP 경로)과 `jszip` ^3.10.1(PDF `pdf-to-image` 경로가 소비 — `PdfImagePanel.tsx:149-164`). 실측 근거: `grep -n "zip.js\|jszip" package.json`(53행·72행). **두 경로의 한글 파일명 처리와 대용량(zip64) 동작이 갈릴 수 있다.** 두 구현을 같은 입력으로 실측 대조하고 C3 로 단일화할지 판정한다. 단일화되면 번들도 줄어든다 — **2026-09-06 사용자 지시 「QR 번들 무게 축소」와 같은 표면이므로 함께 재는 것이 효율적이다.** — Claude
- **`zipArchive.ts` 유니코드 파일명 옵션 미명시** — `src/utils/zipArchive.ts:49-56` 의 `zipWriter.add(...)` 는 `bufferedWrite`·`dataDescriptor`·`level`·`signal`·`zip64`·`onprogress` 만 넘기고 **`useUnicodeFileNames` 를 명시하지 않아 라이브러리 기본값에 의존**한다. 한글 파일명이 포함된 결과 ZIP 에서 동작이 라이브러리 버전에 따라 바뀔 수 있으므로 방어적으로 명시한다. 완료 기준: 한글 파일명 fixture 로 생성한 ZIP 을 최소 두 해제 도구(예: OS 기본 · `unzip`)에서 이름 보존 확인. — Claude

## PDF 글꼴 임베드 후속

- **완료 — Ghostscript 한글 tofu** (2026-09-22, `d5f3112`. CID-keyed CFF 전용 임베더로 해결, 의존성 패치 없음. 총괄 렌더 확인) — S2b QR 글꼴 감량 렌더 대조에서 전체·빌드 타임 subset OTF 모두 Poppler는 정상 렌더했지만 Ghostscript는 원본 전체 OTF부터 한글을 tofu로 표시했다. PDF의 `FontFile2` descriptor에 `OTTO` CFF 스트림이 들어가는 pdf-lib/fontkit 임베드 경계의 기존 결함이며 S2b subset 회귀가 아니다. U4 공용 PDF 글꼴 임베드 경계를 구현할 때 descriptor/stream 조합을 교정하고 GS·Poppler 동시 렌더로 판정한다. — Codx
- **완료 — PDF 텍스트 추출 불일치** (2026-09-22, `d5f3112`. 원문별 ToUnicode + CID 기준 `/W` 생성. 총괄 왕복 5/5 일치 확인) — 같은 S2b fixture에서 PDF.js는 전체 OTF와 subset OTF 사이 추출 결과는 동일했지만 일부 공백을 `堺`로, shaping 숫자를 한자로 추출하는 기존 오류가 남았다. S2b의 oracle은 전체 대비 불변이고 입력 문자열과의 완전 일치는 범위 밖이다. U4에서 ToUnicode/CMap 생성 경계를 다룰 때 입력 문자열 일치 fixture를 별도 추가한다. — Codx

## PDF 생성 라이브러리 중복 배포

- **main·legacy worker의 `pdf-lib` 단일화** — U4-6 번들 조사에서 main 그래프의 `pdf-lib` 귀속 **118,977B**와 legacy `pdf.worker` **219,622B** 내부의 별도 `pdf-lib` 번들을 확인했다. 목표는 중복 실행 경계를 하나로 합쳐 **순감량 80~120KB**를 확보하는 것이다. 예상 비용은 설계·연결 **3~6인일**, 회귀·계측 **2~4인일**, 합계 **5~10인일**이다. U4-6의 app/PDF route 상한 상향은 이 부채를 해결한 것이 아니라 U4 완료 뒤 구조 변경으로 미룬 결정이다. — Codx

## 공용 데스크톱 언어 전환 UI

- **종결(재현 불가) — 고정 언어 스위처 가림** (2026-09-22. 독립 fixed 스위처가 현행에 없음. 관찰되는 것은 고정 헤더 아래 정상 통과) — 1365px에서 PDF 마무리 화면을 아래로 스크롤하면 우상단 KO/EN 스위처가 모드 탭의 마지막 라벨 위에 겹친다. `src/styles/global.css`의 fixed 위치는 `76ceecc7`부터 존재하며 U4에서 바뀌지 않았다. 최상단에서는 탭이 보이고 이번 UI 추가 회귀는 아니다. UI 재설계에서 공용 고정 요소의 가림 정책으로 함께 처리한다. 실제 이미지 `/tmp/worklazy-u4-mergegate3/f5-audit/ko-light-1365-combined.png`, Claude 직접 열람 및 Codx source blame 교차. — Codx
- **PDF 마무리 한국어 제목·탭의 단어 중간 줄바꿈 — U4 cosmetic P3** — 320/821px에서 제목이나 `머리글·바닥글` 탭의 마지막 글자가 다음 줄에 놓인다. 821px 탭 라벨 폭은 77.75px이며 두 줄이다. U4 라벨·4개 탭 구성의 영향이므로 부모 `d3a8d89`와 같다는 이유로 U4 이전 부채라고 부르지 않는다. UI 재설계에서 한국어 줄바꿈·폭 정책으로 묶어 처리한다. 개인정보 안내 pill의 같은 현상은 공용 CSS는 U4 이전이지만 F5 제목의 인접 폭 영향이 있어 정확한 증상 귀속은 미확정이다. P2 도장 공지의 제목 수직 붕괴는 이 항목으로 미루지 않고 U4에서 별도 수리했다. 근거 `/tmp/worklazy-u4-audit3/visual-dom-initial-final/REPORT.md`. — Codx

## PDF 마무리 확장 동작의 레이아웃 안정성

- **업로드부터 다운로드까지 확장 구간 CLS — P3, 도입 시점 미확정** — 최초 U4 배포 뒤 합성 두 파일을 프로그램으로 선택하고 PDF·ZIP 다운로드까지 누적하면 CLS **0.189165**, 최대 단일 이동 **0.172023**이었다. 기존 초기 표시 게이트와 측정 구간이 달라 같은 목표 통과/실패로 혼합하지 않는다. 초기 표시 검증은 별도로 통과했다. 실제 사용자 입력의 `hadRecentInput`과 완료·결과 카드 삽입을 포함한 측정 계약을 UI 재설계에서 정하고 부모 실증으로 도입 시점을 확인한다. 이전 결함이라고 단정하지 않는다. 근거 `/tmp/worklazy-u4-mergegate4/live-asset-attribution/audit/CLS-SCOPE.md`, `live-network-ci-initial/rendering-ko-finish.json`. — Codx

## PDF 마무리 API 후속

- **머리글·바닥글 파일명 축약 길이 직접 지정 — 사용자 요청, 비긴급 P3** — 2026-09-09 사용자가 긴 파일명을 자동 말줄임으로 줄이면 파일 식별 의미가 약해진다고 지적했다. 머리글·바닥글에 넣는 파일명의 축약 기준을 숫자로 입력받고, 지정한 글자 수 이상인 경우 줄이는 옵션을 요청했다. 진행 중 작업 사이의 PDF 관련 후속으로 편성하며 기존 작업 순서를 대체하거나 종결된 U4를 다시 미완료로 바꾸지 않는다. 미리보기와 생성 PDF에 같은 기준을 적용하고, 사용자가 지정한 길이와 실제 배치 폭이 충돌할 때의 표시 방법은 함께 검토한다. 현재는 요청 기록이며 상세 정본·구현·배포 완료가 아니다. — Codx
  - 2026-09-14 정본 v1대로 구현·검증 완료(빈 값=문자 축약 없이 폭 맞춤, N이상=앞N−1그래핌+말줄임). 배포·라이브 확인은 U9 묶음과 함께 이월한다. — Muse
- **상위 텍스트 옵션의 조용한 누락 — 기존 P2 API 계약** — `PdfFinishDecorationOptions`가 상위 텍스트 필드를 유지하면서 `textDecorations`는 optional인 계약(`src/features/pdf-editor/finish/engine.ts:151-173`) 때문에, 배열을 생략하고 stamp 또는 image watermark를 함께 넘기면 `engine.ts:785-788`에서 상위 텍스트 장식이 조용히 버려진다. 부모 revision도 같고 제품 UI는 항상 명시적 `textDecorations` 배열을 넘겨 안전하므로 이번 회귀 수리 범위에는 넣지 않았다. 후속 수리는 ① typed/discriminated 계약과 문서로 호출 의미를 명시하거나 ② 모호한 입력을 오류로 거부하는 두 방향을 비교한다. 단순 fallback은 기존 stamp-only 호출에 placeholder 텍스트를 새로 출력할 수 있어 기각한다. — Codx

## PDF 이미지 평탄화 후속

- **`save()` 할당 실패의 부분 결과 비노출 — 기존 P2** — `PDFDocument.save()`가 두 번째 파일에서 할당 오류를 내면 부모와 U4-7 대상 모두 완료된 첫 파일을 `partialResults`로 공개하지 않는다. U4-7 fix-1에서 수리한 새 `Blob()` 할당 경로와 별개이며, 일반 저장·직렬화 예외를 완료 결과 보존 계약에 연결하는 후속 작업이 필요하다. — Codx
- **스모크 preview의 점유 포트 오인 — 기존 P2 하네스 부채** — `startPreview()`가 자신이 띄운 child의 listen 성공을 확인하기 전에 같은 포트의 HTTP 응답만 보고 준비 완료로 판정할 수 있다. 자기 서버 식별/준비 로그를 확인하고 점유 포트는 즉시 실패시키는 계약이 필요하다. fix-1 검증은 4270을 건드리지 않고 4275~4279의 점유 확인·고정 `--strictPort` 서버만 썼다. — Codx
- **scoped browser 완료 문구 과장 — 기존 P3** — `TEST_SCOPE=pdf` 실행도 마지막 문구가 Excel·Word까지 완료했다고 열거한다. 실제 분기와 종료 코드만 PDF 범위 증거로 사용했으며, 후속에서 선택된 scope만 출력하게 한다. — Codx
- **공용 UI incomplete — 기존 UI 재설계 부채** — U4-7의 125건과 전량 통합 감사의 표본 수를 혼합하지 않는다. 2026-09-09 통합 QA 43페이지에서는 상속 incomplete **1,973건**을 보존했고 F2/F3/F4a/F4b 소유 미확인은 0이었다. 별도 F5 8환경×5상태의 토글·파일 목록·다중 결과 원자료에서도 위반·incomplete는 0이다. 공용 미확인을 성공으로 재분류하지 않고 UI 재설계에서 표시·스크롤 상태를 포함해 해결한다. 근거 `/tmp/worklazy-u4-mergegate3/a11y.json`, `f5-audit/summary.json`. — Codx
- **실기기 모바일 메모리 한계 미교정** — 벤치는 Pixel 7 에뮬레이션의 호스트 CDP heap만 측정했고 native/renderer/canvas 및 물리 기기 한계는 측정하지 않았다. 150 DPI는 사전 명시된 미교정 폴백이며, 실기기 확보 뒤 별도 교정하기 전에는 “기기 한계의 50% 안전 마진 달성”을 주장하지 않는다. — Codx
- **PDF 마무리 heartbeat 목표 미달·PDF.js 의존 패치 유지 — 기존 P2** — 2026-09-09 같은 하네스·합성 12입력×3회 대조에서 부모 `d3a8d89`와 통합 `0f02458` 모두 **20/36회**가 실행별 200ms 목표를 넘었다(최대 **329.4/333.8ms**). 미달은 128MiB 저장에 한정되지 않고 사전 검사·미리보기와 생성에서도 재현된다. PDF 제품 소스는 두 후보 사이 동일하며 취소 응답 **111.1/159.5ms**, 늦은 결과 0·재시도·폴백은 통과했다. 중앙값·취소 가능성을 근거로 heartbeat 목표를 통과로 바꾸지 않는다. 원자료 `/tmp/worklazy-u4-performance-attribution/{parent,candidate-rerun}.json`; 첫 통합 재실행은 30/36에서 SIGTERM으로 중단됐으므로 별도 실패 로그로 보존했다. 의존 갱신 때 exact/lock/4SHA·4빌드×180렌더·음성·worker/fallback 검증을 다시 수행한다. — Codx
- **접근성 요약 검사기의 빈 근거 수용 — 기존 P2 하네스 부채** — 통합 감사 독립 음성 대조에서 `targets:[""]`, `reasons:[""]`, 전체 `incomplete:[]` 치환은 요약 검사가 거부하지 못했다. 요약 함수는 부모 `d3a8d89`와 byte 동일하고 실제 브라우저 수집기는 빈 target·reason을 검사하므로 이번 원자료가 지워졌다는 뜻은 아니다. 수집·요약 사이 완전성 계약과 빈 문자열 거부를 별도 보강한다. 재현 `/tmp/worklazy-u4-audit3/a11y/results.json`; 현행 원자료의 상속 1,973건은 그대로 보존했다. — Codx

## UI 색 체계 — 도구 고유색 축소·컨트롤 단일 primary

> 2026-09-06 사용자 결정("1안"). shadcn 전환 후 스위치·버튼·포커스 링은 `--primary`(인디고) 단일인데 도구 고유색(아이콘 타일 6색)이 따로 놀아 어색하다는 사용자 소견. **`!계획!` 미발동 — 결정 기록만.** UI 변경이므로 「배포 전 로컬 시각 검수」·시각 기준선 갱신 수반. 로드맵(`roadmap-completion-20260906`) 순서상 S2 이후 별도 단위 후보. — Claude

- **컨트롤은 인디고 단일 유지**: 스위치·버튼·체크·포커스 링은 `--primary` 그대로(흰 글자 대비 8.09:1 검증 완료). 도구별 `--primary` 덧씌우기(도구 테마)는 **기각** — 6색 대비 재검증·시각 기준선 175장 전면 갱신·통일성 역행.
- **도구색은 "분류 표지"로 축소**: 아이콘 타일(`src/components/toolAccentStyles.ts` — 도구 카드·사이드바만 소비, 2026-09-06 grep 실측)·헤더 눈썹 라벨·상단 얇은 선 정도. 현행 `*-100` 배경/`*-700` 글자 톤 유지.
- **색 수 6→4**: `toolRegistry.ts` 카테고리 accent(documents·media·text-data 등)를 도구가 상속. **blue 계열은 인디고 primary 와 겹쳐 교체**(회색 계열 또는 teal 후보).
- 완료 기준 후보: 시각 회귀 2로케일 기준선 갱신 사유 기록 · a11y `A11Y_MAX_TOTAL=0` · 카드/사이드바 색 매핑 unit · Gemini 로컬 시각 검수.

## 공용 UI 접근성 대비·ARIA — UI 전면 재설계 게이트

- **U4-4(F2) 접근성 감사에서 분리된 기존 결함** — 2026-09-07 1차 수동 판정은 color-contrast incomplete **930노드** 중 기준 이상 743·미달 183·미확정 4, aria-prohibited-attr incomplete **3노드**였다. 미달은 home 0, document-compare 15, tools 28, excel-compare 11, pdf-editor 16, pdf-finish-ko/en/watermark 각 18, pdf-finish-mobile 12, hwp-editor 14, home-mobile 9, tools-mobile 24였다. 대표 원인은 footer 정책 링크·광고 설정·copyright **2.839:1**, sidebar caption **2.954~2.991:1**, 로컬 처리 안내 약 **2.899~3.110:1**, 검색 placeholder **2.524:1**, 도구 수 **2.341:1**이며 공용 AppShell/global CSS/ToolsPage/HWP host 소유다. F2 blob 변경 전부터 존재하므로 워터마크 단계에서 전역 팔레트를 임의 수정하지 않는다.
- **귀속과 완료 조건** — `docs/jobs/todo/ui-theme-redesign-20260907.md`가 채택한 WCAG 보정 팔레트·대비 게이트에서 위 노드와 역할 없는 `div aria-label` 3건을 처리한다. U4-4 fix-1 하네스는 incomplete의 target·reason을 삭제하지 않고 F2/공용 소유를 분리하며, 현행 QA 실측은 **공용 상속 925·F2 신규 0**이다. 925를 pass로 바꾸거나 광역 예외 처리하지 않는다. UI 계획 완료 시 표시/스크롤 상태를 포함해 다시 측정하고 미확정 4건도 판정한다. — Codx

## 배포 후 라이브 감사에서 나온 기존 결함 (S0 배포 2026-09-06 — S0 회귀 아님)

- **HWP 편집기 iframe 접근성 위반 4노드** — 벤더 rhwp Studio 내부(`#sb-message` 대비 3.54 · `#style-name`·`#font-lang`·`#font-name` 는 title 만으로 라벨). `4d0bae9` 에서도 동일 검출(`/tmp/worklazy-s0/deploy/logs/baseline-findings-full.log`). `public/vendor/**` 라 저장소에서 수정 불가 — 선택지: ① 상류(rhwp) 이슈 제기 ② 접근성 게이트에서 벤더 iframe 을 목적·소유자 명시 예외로 분리(광역 wildcard 금지). S2-H ③ 에서 결정. — Claude
- **모바일 하단 탭 라벨 대비 3.06**(`.bottom-tab > span`, `#909098`/`#fbfbfd`, 12px bold, 기준 4.5) — P2 셸 스타일, S0 diff 무관. 색 토큰 1개 조정 + 시각 기준선 갱신. 접근성 하네스가 mobile viewport 를 재지 않아 게이트에 안 걸렸다 — S2-H ③ 페이지·viewport 등록 확장과 함께. — Claude
- **없는 경로의 인앱 NotFound 뷰 부재** — 정적 `404.html`(noindex)·HTTP 404 는 정상이나 앱 기동 후 React Router 가 홈을 렌더한다(`4d0bae9` 동일). SEO 영향 없음(HTTP 404 유지). 제품 결정 필요: 홈 폴백 유지 vs ko/en NotFound 뷰 신설(신설 시 「현지화·SEO·AdSense 동시 검토」·시각 회귀 추가). — Claude
## U6 검수에서 확인한 공용 UI 후속

- **EN320 동의 배너의 오른쪽 동작 잘림** — 320px에서 `Accept and continue` 버튼 right 381.97px, viewport 320px이며 문서 가로 스크롤로 복구되지 않는다. U6와 기존 PDF Merge에서 같은 geometry라 U6 회귀가 아니다. UI v3에서 버튼 줄바꿈·세로 배치를 포함해 공용 배너 경계를 고친다. 근거 `/tmp/worklazy-u6-preflight/final-ui-review/inherited-comparison.json`.
- **고정 데스크톱 언어 스위처의 배경 의존 대비** — U6 결과 화면의 안정 axe에서 기존 translucent LanguageSwitcher 대비 1건이 남았다. UI v3에서 이 공용 control의 실제 배경별 대비를 고정한다. U6에서 전역 스위처 색을 임의 변경하지 않는다.
