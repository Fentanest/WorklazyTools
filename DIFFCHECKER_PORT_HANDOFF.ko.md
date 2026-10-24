# Diffchecker 선별 이식 인계

**요청한 구현 단계는 마쳤습니다.** 마지막 Word 세 항목의 구현·범위별 Astra 검수와 필요한 결합 영향 검사를 끝냈습니다. 사용자 요청에 따라 **전체 빌드·전체 단위/정적 검사·루트/하위 경로 브라우저 검증·전체 후보 Astra 검수·정식 Claude 감사는 실행하지 않고 이월합니다.** 부분 검수 통과는 전체 코드의 통합 승인이나 배포 승인이 아닙니다.

**기존 `dist`와 로컬 작업 기록의 `subpath-site`는 중간 산출물입니다. 현재 전달 브랜치의 빌드 결과가 아닙니다.** 재개할 때는 현재 소스를 먼저 빌드해야 합니다. 이번에는 다시 빌드하지 않았습니다. main 반영·push·배포도 하지 않았습니다.

## 전체 이식 작업 요약

아래는 전용 브랜치에 구현하고 기능별 근거를 남긴 범위입니다. 현재 코드 전체의 통합 검사·출시 승인과는 구분합니다.

| 영역 | 구현한 내용 |
| --- | --- |
| Word·HWP | Word는 기존 TypeScript 비교 판단을 화면·DOCX가 공유하고 지원되는 그림·링크·표·구역·각주·미주 복원을 보강했습니다. 수정 추적은 양쪽이 모두 DOCX인 검증 범위에 한정합니다. HWP는 기존 비교를 유지하며 보고서 실패 시 완료한 결과를 보존합니다. |
| Excel | 기존 비교·대사 결과에 수동 열 대응, 제한된 날짜 문자열 처리, 원본 격자와 여러 보기·보고서를 연결했습니다. |
| Text | 양쪽 입력, 명시적 변환, 무시 규칙·검색·보기, 원문 위치를 보존하는 병합·되돌리기·인코딩 저장을 추가했습니다. |
| Images·OCR | 아홉 보기, 변경 영역·정렬·영역 선택과 로컬 OCR 비교·검토·정정을 연결했습니다. 인식 원문·위치·점수와 사용자 정정을 구분합니다. |
| PDF | 기존 비교 민감도·통계를 유지하면서 페이지 대응 후보·새 보기·페이지 OCR과 보고서 흐름을 보강했습니다. |
| Folder·ZIP | 원래 경로·충돌을 보존하는 읽기 전용 내용 비교, 이름 변경 후보와 선택한 쌍의 상세 비교를 연결했습니다. 파일을 수정하지 않습니다. |
| 보고서 | 같은 확정 결과를 사용하는 XLSX·읽기 쉬운 PDF와 선택 범위의 전체 데이터 첨부·PNG를 연결했습니다. 보고서 실패가 완료한 비교를 지우지 않도록 했습니다. |
| 사이트 | 한·영 화면·안내·FAQ·SEO·정적 경로를 연결했습니다. 기존 광고·방문 분석 정책을 유지하고, QA에서는 실제 공급자 통신을 차단합니다. |

코드 책임·흐름은 [구조 문서](docs/COMPARISON-PORT.ko.md), 변경 이력은 [CHANGELOG](CHANGELOG.md), 판단과 제한은 [검토 기록](docs/review-notes.md)에 있습니다.

## 마지막 세 항목의 완료 범위

| 항목 | 완료한 범위 | 남겨 둔 정확한 제한 |
| --- | --- | --- |
| 비교에서 제외한 표의 각주·미주 연결 | 포함된 본문에서 이미 대응이 정해진 각주·미주 쌍을 재사용합니다. 표와 참조 ID는 수정본을 유지하고 연결된 내용·자원을 비교합니다. | 표 안에만 있고 기존 대응이 없는 참조는 차단합니다. 새 대응 알고리즘은 추가하지 않았습니다. |
| 책갈피(북마크)·내부 이동 링크 | 위치·이름이 유지되는 일반 본문 전체 범위와 바뀌지 않은 이동 링크를 보존합니다. 기존 글자 변경을 그대로 사용합니다. | 부분 범위, 이동·추가·삭제·이름/연결 변경, 복잡한 문맥은 차단합니다. |
| 각주·미주 안의 번호 목록(예: 1., 2.) 보존·실제 파트 경로 | 지원되는 단일 단계 십진 목록 정의와 이미지·링크를 보존하고 실제 문서 관계로 각주·미주 파일을 찾습니다. 같은 대상을 유지한 대조 입력으로 포함된 영역의 경로·자원 보존을 검증했습니다. | 원래 고정 입력의 링크 대상 변경은 정확한 차단으로 남깁니다. 삭제된 비대응 노트는 자신의 목록 정의를 복원하고 수정본 본문의 번호 목록은 덮어쓰지 않습니다. 기존 공유 NoteStyle 정책도 유지합니다. |

고정 Word 종료 목록 10개는 모두 정해진 반례에 대한 구현·재사용 또는 선별 차단 판정을 마치고 범위 검수를 통과했습니다. **차단을 기능 지원 통과로 세지 않았습니다.** 현재 남겨 둔 필수 후속은 아래의 종합 검증이며, 임의 OOXML 변형이나 데스크톱 앱·라이선스 업무를 새 필수 작업으로 추가하지 않습니다.

## 코드 위치와 근거

| 항목 | 값 |
| --- | --- |
| 작업 폴더 | `/home/better0101/projects/worklazytools-wt/diffchecker-port-20261023` |
| 브랜치 | `feat/diffchecker-browser-port-20261023` |
| 최초 기준 커밋 | `92c21cabb930bce8cc306b95e2214bb6f1925379` |
| 최종 제품·테스트·사용자 문구 기준 | `ad673c63fc51809c759475b9f94082c0210f771b` |
| 마지막 Word 결합 영향 검사 기준 | `99c76abe1e86d9e4637bfa08b0a1c2bf38b3d070` |
| 문서 포함 최종 HEAD | 로컬 `delivery.json`에 별도 기록합니다. 위 제품 기준 이후의 이 인계 문서 커밋과 구분합니다. |

원래 주 작업 폴더의 HEAD/status와 기준 source 425개 해시가 유지되었다는 읽기 전용 기록을 남겼습니다. 원래 해시가 없던 untracked 파일 내용까지 모두 같은 바이트라고 주장하지 않습니다.

상세 자료는 [로컬 작업 기록](docs/jobs/todo/diffchecker-port-20261023/)의 다음 파일에서 찾을 수 있습니다. gitignored 자료이므로 로컬 보존이 필요합니다.

- `handoff-evidence-index.json`: 고정 후보·검수 보고·실제 명령·종료 코드·로그 해시.
- `final-three-source-integration.json`: 검수한 책갈피/의존성 코드의 정확한 공유 소스 병합과 영향 검사.
- `finite-p-closure.json`: 고정 반례와 지원/선별 차단 판정.
- `adoption-decisions.json`: 승인된 143단계의 근거 연결. 전체 후보 승인으로 표시하지 않습니다.
- `root-main-preservation-check.json`, `owned-test-cleanup.json`: 원래 작업 폴더 보존과 소유 테스트 프로세스 정리.

## 수행한 검사와 수행하지 않은 검사의 구분

마지막 코드에서 다음 **영향 범위 검사**는 모두 종료 코드 0으로 통과했습니다. 이것이 전체 unit/static/browser 검사라는 뜻은 아닙니다.

| 실행한 검사 | 확인 범위 |
| --- | --- |
| `node --experimental-strip-types tests/word-note-dependencies.mjs` | 14개 정책 결과, 원래 사용자 지정 입력 2개 차단, 번호/파트/단방향 링크/위조 입력 차단. |
| `node --experimental-strip-types tests/word-excluded-table-note-anchors.mjs` | 12개 결과, 권한 없는 4개 차단, 28개 위조 참조 차단. |
| `node --experimental-strip-types tests/word-stable-bookmark-packages.mjs` | 3개 정상 입력의 수락·거절 결과 6개, 미지원 문맥 13개와 위조 입력 차단. |
| `python3 tests/word-stable-bookmark-resource.py` | 소스 단위 경계 4개와 잘못된 설정 12개. |
| `node --experimental-strip-types tests/word-whole-table-projection.mjs` | 영향받은 수락 처리: 지원 표 반례·빈 표 차단·유효한 감싼 행 보존. |
| `npx tsc -p tsconfig.app.json --noEmit` | 타입 검사. 빌드나 전체 단위 검사가 아닙니다. |
| `npm run test:guides`, `npm run test:i18n` | 마지막 한영 문구·안내 소스의 일관성. 생성된 사이트 검사가 아닙니다. |

기능별 고정 후보는 Astra 부분 검수를 받았고, 합친 공유 Python 소스는 검수한 기준·변경의 정확한 병합과 대조했습니다. 검수 과정에서 발견된 유효한 감싼 행 삭제와 VML의 전체/세부 배치 제외 위반은 원래 실패 근거를 보존한 채 수정·재검수했습니다.

표 생성·삭제의 지원 반례 네 개는 LibreOffice의 실제 수락·거절 8회에서 변경 기록이 인식된 뒤 0개가 되었고, 표 존재·본문·그림·링크·각주가 옵션에 맞는 원본·수정본 결과와 맞았습니다. 이 실제 동작 근거는 해당 반례에 한정합니다. 다른 구역·각주·VML·책갈피의 파일 열기/렌더는 실제 편집기 수락·거절 동작이나 책갈피 클릭 검증으로 확대하지 않았습니다. 노트 내부 목록의 접두 표시가 LO 원본·결과 양쪽에서 빠지므로 번호 정의의 의미는 원시 패키지 그래프로 검증했습니다.

과거 중간 후보의 **826개 unit/119개 정적 페이지** 기록은 이번 마지막 코드의 종합 통과 기록이 아닙니다. 마지막 변경 후 전체 웹 화면 검사도 미실행입니다. Fable 가용성 프로브는 실제 정식 감사가 아니며, 실제 감사는 사용자 요청에 따라 호출하지 않았습니다.

소유 Vite/Python 테스트 서버는 실제 PID·명령·작업 폴더를 대조한 뒤 종료했습니다. 5273/5274/5275에 남은 리스너가 없음을 확인했습니다. 모르는 사용자 브라우저/앱 프로세스는 종료하지 않았으며, 상태 파일만으로 감시나 서비스 실행을 주장하지 않습니다.

## 사용자 요청으로 이번에 실행하지 않을 종합 검사

아래 명령은 재개 시 현재 코드를 빌드한 뒤 실행할 목록이다. 이번 작업에서 실행했다는 뜻이 아니다.

```bash
npm run build
npm run test:unit
npm run test:static
```

루트 빌드가 준비된 뒤 하위 경로 검증 산출물을 별도 폴더에 만든다. Vite의 `--outDir`은 설치된 6.4.3 CLI 도움말에서 확인했고, 환경변수는 현재 설정/생성기에서 확인했다. `example.test`는 로컬 QA용 canonical 예시이며 배포 설정이 아니다.

```bash
VITE_BASE_PATH=/worklazytools/ VITE_SITE_URL=https://example.test/worklazytools/ npx vite build --outDir docs/jobs/todo/diffchecker-port-20261023/final-subpath-site/worklazytools
VITE_BASE_PATH=/worklazytools/ VITE_SITE_URL=https://example.test/worklazytools/ WORKLAZY_STATIC_OUTPUT_DIR=docs/jobs/todo/diffchecker-port-20261023/final-subpath-site/worklazytools node --experimental-strip-types scripts/generate-static-pages.mjs
```

각각 별도 터미널에서 일반 정적 서버를 시작한다. 포트가 비었는지와 해당 서버의 실제 작업 폴더를 먼저 확인한다. COOP/COEP 개발 서버 검증으로 대신하지 않는다.

```bash
python3 -m http.server 5274 --bind 127.0.0.1 --directory dist
python3 -m http.server 5275 --bind 127.0.0.1 --directory docs/jobs/todo/diffchecker-port-20261023/final-subpath-site
```

실제 Word 워커·다운로드와 모바일/테마를 검증하는 기존 진입점은 다음과 같다. 산출물 경로는 실행마다 분리한다. 두 번째 base에도 같은 명령을 적용한다.

```bash
TEST_BASE_URL=http://127.0.0.1:5274 EXPECT_STATIC=1 WORD_VISUAL_MATRIX=1 WORD_BROWSER_EVIDENCE=docs/jobs/todo/diffchecker-port-20261023/final-word-root node tests/document-compare-port-smoke.mjs
TEST_BASE_URL=http://127.0.0.1:5275/worklazytools EXPECT_STATIC=1 WORD_VISUAL_MATRIX=1 WORD_BROWSER_EVIDENCE=docs/jobs/todo/diffchecker-port-20261023/final-word-subpath node tests/document-compare-port-smoke.mjs
TEST_BASE_URL=http://127.0.0.1:5274 EXPECT_STATIC=1 GRID_BROWSER_EVIDENCE=docs/jobs/todo/diffchecker-port-20261023/final-grid-root node tests/word-table-grid-browser-smoke.mjs
TEST_BASE_URL=http://127.0.0.1:5275/worklazytools EXPECT_STATIC=1 GRID_BROWSER_EVIDENCE=docs/jobs/todo/diffchecker-port-20261023/final-grid-subpath node tests/word-table-grid-browser-smoke.mjs
npm run test:ads
npm run test:analytics
npm run test:analytics-base
```

Text/Images·실제 OCR/PDF/Folder·보고서의 영향 범위 검사 선택자는 `final-validation-plan.json`에 있다. 최종 소스/입력에 그대로 적용되는 기존 근거만 재사용한다. 광고/분석 QA는 실제 공급자 통신을 막으며, 알려지지 않은 원격 모델·엔진·사용자 데이터 요청은 실패로 처리한다.

광고 검사는 자체 4182 서버를, 브라우저 분석 정책 검사는 자체 4186 서버를 시작합니다. 위의 5274/5275 서버를 자동으로 검사하는 명령이 아닙니다. `test:analytics-base`는 JSDOM에서 루트/하위 경로의 직접 진입·SPA 이동·재방문 시 GA/네이버 이벤트를 확인하는 컴포넌트 검사이며 실제 브라우저 검사가 아닙니다. 실제 하위 경로 산출물에서의 브라우저 이동·자산·정책 확인은 별도로 남아 있습니다.

최종 KO/EN·명암·화면 크기·인쇄 열람, 전체 후보 Astra 검수, 실제 정식 감사도 이번 사용자 요청으로 미실행이다. Fable 가용성 프로브는 실제 감사가 아니며, 소규모 체크포인트 통과를 전체 승인으로 확대하지 않는다.

이미지 처리의 256MiB는 필요한 작업 공간을 계산해 작업을 허용하거나 거절하는 예산입니다. 브라우저 전체 메모리가 그보다 적게 쓰인다는 보장은 아닙니다. 기존 측정에서도 작업 버퍼·JS/WASM 관측값·브라우저 관련 프로세스 메모리를 구분했으며, 다른 기기나 장시간 작업의 보장값으로 사용하지 않습니다.

## 별도로 남긴 호환성 확인과 선택적 후속

MS Word GUI·작성자별 변경 처리, 실제 OS 폴더 선택·권한 대화상자, S10 실제 광고 겹침은 미확인입니다. 현재 완료한 고정 반례 및 아래 종합 검사와 구분합니다. 추가 OOXML 형식·데스크톱 앱·라이선스 작업을 이번 이식의 새 필수 후속으로 만들지 않습니다.

작성: Codx
