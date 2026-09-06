# Backlog

종결된 작업 묶음에서 살아남은 후속 항목을 여기에 남긴다(「작업지시서 관리」 규칙). 항목마다 배경이 된 작업과 판단 근거를 한 줄로 병기한다.

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

- **ZIP 라이브러리 이중 의존 — 단일화 판정 필요** — 이 저장소는 ZIP 라이브러리 **두 개**를 함께 의존한다: `@zip.js/zip.js` 2.9.0(공용 C3 결과 ZIP 경로)과 `jszip` ^3.10.1(PDF `pdf-to-image` 경로가 소비 — `PdfImagePanel.tsx:149-164`). 실측 근거: `grep -n "zip.js\|jszip" package.json`(53행·72행). **두 경로의 한글 파일명 처리와 대용량(zip64) 동작이 갈릴 수 있다.** 두 구현을 같은 입력으로 실측 대조하고 C3 로 단일화할지 판정한다. 단일화되면 번들도 줄어든다 — **2026-09-06 사용자 지시 「QR 번들 무게 축소」와 같은 표면이므로 함께 재는 것이 효율적이다.** — Claude
- **`zipArchive.ts` 유니코드 파일명 옵션 미명시** — `src/utils/zipArchive.ts:49-56` 의 `zipWriter.add(...)` 는 `bufferedWrite`·`dataDescriptor`·`level`·`signal`·`zip64`·`onprogress` 만 넘기고 **`useUnicodeFileNames` 를 명시하지 않아 라이브러리 기본값에 의존**한다. 한글 파일명이 포함된 결과 ZIP 에서 동작이 라이브러리 버전에 따라 바뀔 수 있으므로 방어적으로 명시한다. 완료 기준: 한글 파일명 fixture 로 생성한 ZIP 을 최소 두 해제 도구(예: OS 기본 · `unzip`)에서 이름 보존 확인. — Claude

## PDF 글꼴 임베드 후속

- **Ghostscript 한글 tofu — pdf-lib OTF descriptor 경계** — S2b QR 글꼴 감량 렌더 대조에서 전체·빌드 타임 subset OTF 모두 Poppler는 정상 렌더했지만 Ghostscript는 원본 전체 OTF부터 한글을 tofu로 표시했다. PDF의 `FontFile2` descriptor에 `OTTO` CFF 스트림이 들어가는 pdf-lib/fontkit 임베드 경계의 기존 결함이며 S2b subset 회귀가 아니다. U4 공용 PDF 글꼴 임베드 경계를 구현할 때 descriptor/stream 조합을 교정하고 GS·Poppler 동시 렌더로 판정한다. — Codx
- **PDF.js 텍스트 추출이 입력 문자열과 다름 — U4 관련** — 같은 S2b fixture에서 PDF.js는 전체 OTF와 subset OTF 사이 추출 결과는 동일했지만 일부 공백을 `堺`로, shaping 숫자를 한자로 추출하는 기존 오류가 남았다. S2b의 oracle은 전체 대비 불변이고 입력 문자열과의 완전 일치는 범위 밖이다. U4에서 ToUnicode/CMap 생성 경계를 다룰 때 입력 문자열 일치 fixture를 별도 추가한다. — Codx

## UI 색 체계 — 도구 고유색 축소·컨트롤 단일 primary

> 2026-09-06 사용자 결정("1안"). shadcn 전환 후 스위치·버튼·포커스 링은 `--primary`(인디고) 단일인데 도구 고유색(아이콘 타일 6색)이 따로 놀아 어색하다는 사용자 소견. **`!계획!` 미발동 — 결정 기록만.** UI 변경이므로 「배포 전 로컬 시각 검수」·시각 기준선 갱신 수반. 로드맵(`roadmap-completion-20260906`) 순서상 S2 이후 별도 단위 후보. — Claude

- **컨트롤은 인디고 단일 유지**: 스위치·버튼·체크·포커스 링은 `--primary` 그대로(흰 글자 대비 8.09:1 검증 완료). 도구별 `--primary` 덧씌우기(도구 테마)는 **기각** — 6색 대비 재검증·시각 기준선 175장 전면 갱신·통일성 역행.
- **도구색은 "분류 표지"로 축소**: 아이콘 타일(`src/components/toolAccentStyles.ts` — 도구 카드·사이드바만 소비, 2026-09-06 grep 실측)·헤더 눈썹 라벨·상단 얇은 선 정도. 현행 `*-100` 배경/`*-700` 글자 톤 유지.
- **색 수 6→4**: `toolRegistry.ts` 카테고리 accent(documents·media·text-data 등)를 도구가 상속. **blue 계열은 인디고 primary 와 겹쳐 교체**(회색 계열 또는 teal 후보).
- 완료 기준 후보: 시각 회귀 2로케일 기준선 갱신 사유 기록 · a11y `A11Y_MAX_TOTAL=0` · 카드/사이드바 색 매핑 unit · Gemini 로컬 시각 검수.

## 배포 후 라이브 감사에서 나온 기존 결함 (S0 배포 2026-09-06 — S0 회귀 아님)

- **HWP 편집기 iframe 접근성 위반 4노드** — 벤더 rhwp Studio 내부(`#sb-message` 대비 3.54 · `#style-name`·`#font-lang`·`#font-name` 는 title 만으로 라벨). `4d0bae9` 에서도 동일 검출(`/tmp/worklazy-s0/deploy/logs/baseline-findings-full.log`). `public/vendor/**` 라 저장소에서 수정 불가 — 선택지: ① 상류(rhwp) 이슈 제기 ② 접근성 게이트에서 벤더 iframe 을 목적·소유자 명시 예외로 분리(광역 wildcard 금지). S2-H ③ 에서 결정. — Claude
- **모바일 하단 탭 라벨 대비 3.06**(`.bottom-tab > span`, `#909098`/`#fbfbfd`, 12px bold, 기준 4.5) — P2 셸 스타일, S0 diff 무관. 색 토큰 1개 조정 + 시각 기준선 갱신. 접근성 하네스가 mobile viewport 를 재지 않아 게이트에 안 걸렸다 — S2-H ③ 페이지·viewport 등록 확장과 함께. — Claude
- **없는 경로의 인앱 NotFound 뷰 부재** — 정적 `404.html`(noindex)·HTTP 404 는 정상이나 앱 기동 후 React Router 가 홈을 렌더한다(`4d0bae9` 동일). SEO 영향 없음(HTTP 404 유지). 제품 결정 필요: 홈 폴백 유지 vs ko/en NotFound 뷰 신설(신설 시 「현지화·SEO·AdSense 동시 검토」·시각 회귀 추가). — Claude
