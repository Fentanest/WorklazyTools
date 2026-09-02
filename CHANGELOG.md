# CHANGELOG

코드에 일어난 변경을 자신의 이름(Claude · Codx · Gemini)으로 간결히 기록한다(「작업 기록」 규칙). 검토 과정의 판정·기각 사유·실측 수치는 [`docs/review-notes.md`](docs/review-notes.md)에 기록한다.

## 2026-09-03

- 비디오 job별 route 결정표와 상위 처리 오케스트레이터를 추가하고, 현재 모든 job의 FFmpeg 동작을 보존했다. 진행률 단계·단조성·종결 계약과 결과 이름·MIME·warning·오류·개수 공통 모듈, route 조합/회귀 테스트를 함께 반영했다. — Codx
- 이미지 편집기에 base+effect 최하단 블록을 보존하는 공통 레이어 순서 계약, 레이어 패널의 선택·표시·삭제·재정렬, 데스크톱 다중 선택·6방향 정렬·다중 복제와 대상별 우클릭 메뉴를 추가했다. ko/en·모바일 레이어 시트·히스토리/내보내기/입력 우선순위 회귀를 함께 반영했다. — Codx
- 비디오 완성 결과를 공통 buffer/File/브라우저 임시 파일 계약으로 확장하고 세션 소유권·만료·실패/취소 정리를 도입했다. 비디오 ZIP은 zip.js 순차 스트리밍·강제 ZIP64로 교체했으며 비동기 결과 저장 대기, 용량 부족 폴백, ko/en 안내와 힙·ZIP64·수명주기 회귀를 추가했다. — Codx

## 2026-09-02

- 비디오 concat 세그먼트를 생성 직후 Blob으로 오프로드하고 MEMFS 파일을 삭제한 뒤 WORKERFS 절대경로로 재마운트해 조인하도록 변경했다. mount 수명주기 정리 단위 테스트와 Chrome 대용량 MEMFS·RSS·SHA 벤치를 추가했다. — Codx
- 이미지 편집기에 전 객체 행렬 리샘플·중앙 기준 캔버스 크기 변경·원본 화질/지정 px 내보내기와 4096/8192px 상한을 추가하고, 출력 배율을 Undo·Redo에 포함했다. 우측 옵션 패널은 세션 기억 접기/펼치기와 모바일 강제 시트 동작을 지원하며 ko/en·SEO·가이드·브라우저 회귀를 함께 갱신했다. — Codx
- 이미지 자르기의 900px 캔버스 강제 비율 변경을 폐기하고, 이동·실시간 경계 제한·정규화되는 8핸들 crop 박스와 5비율+자유 preset을 도입했다. preset 핸들 잠금, Shift 정사각형·Alt 중심 조절, 핀치 유지, ko/en 비활성 사유와 P4-2 브라우저 회귀를 추가했다. — Codx
- 이미지 자르기·영역 효과 overlay 원점을 좌상단으로 고정하고 두 도구의 선택 상태·취소 처리를 분리했다. 자르기 적용 시 선택 패널로 동기화하며, 적용 버튼의 상시 비활성 사유와 ko/en 접근성 문구·드래그 중/박스 우하단 px 라벨·8조합 합성 회귀를 추가했다. — Codx
- Word 비교의 동일 서식 인접 런을 OOXML 경계를 지키며 병합하고 highlight 차이를 표시해 실문서 웹 서식 변경을 133건에서 진양성 4건으로 정정했다. 기존 리비전을 수락한 사본으로 비교·생성하고 신규 변경 작성자와 후 문서의 신규 메모 작성자만 통일하는 선택 옵션을 ko/en UI와 합성 회귀·LibreOffice 검사까지 추가했다. — Codx
- 비디오 인코딩 스레드 캡 상향안을 실측 게이트에서 기각하고 현행 4스레드 캡 유지. `multiThreaded` 상태의 인자 조립 배선과 스레드 벤치 스크립트(`scripts/benchmark-video-threads.mjs`)·hc 경계 단위 테스트는 추가. — Codx
- 이미지 편집기에 도형 7종(둥근 사각형·삼각형·별·육각형·말풍선·단/양방향 화살표·형광펜)을 단일 Fabric 객체로 추가하고, Twemoji v17.0.3 기반 스티커 112종을 해시 고정 벤더 파이프라인(`scripts/vendor-image-studio-assets.mjs`)+카테고리·검색 피커로 도입. ko/en 문구·모바일 피커·스모크 포함. — Codx
- 무접두사 `/tools/excel-merger/xls-preserve/` 정적 페이지를 ko판과 동일 정책(noindex·사이트맵/hreflang 제외·canonical)으로 산출하고 정적 검사에 고정. — Codx
- XLS 보존 경로 첫 진입 시 엑셀 워커가 격리 헤더 부재로 차단되던 문제 수정: 전역 SW가 same-origin worker/sharedworker 응답에 `COEP: require-corp`·`CORP: same-origin`을 부여하고, 문서 격리 준비는 세션 가드로 최대 1회 자동 리로드. 무헤더 동형 서버 재현 스모크(`test:xls-first-load`) 신설. — Codx
- 이미지 편집기에 사용자 보기 전용 25–400% 줌·팬 추가(휠·Space+드래그·모바일 두 손가락 중재). 내보내기는 보기 변환을 잠시 제거해 픽셀 결과 불변 보장, 치수 변경 전이는 100% fit 초기화·치수 불변 undo/redo는 보기 보존, 미니바 위치 보기 추종. — Codx
- SpreadsheetML 위장 `.xls`의 CDATA 섹션을 파싱 전 XML 이스케이프로 전개해 CDATA 포함 파일도 시트 표시·병합 지원. 합성 혼합 배치 스모크 추가. — Codx
- Excel XLS 보존 판정을 확장자에서 OLE compound 시그니처로 교체(XML 위장 .xls는 일반 검사 경로), 변환 실패는 파일별 격리+원본 파일명 ko/en 안내, 변환 FS·URL은 순번 기반 ASCII 내부명으로 제한. — Codx
- 이미지 스튜디오 편집기를 상호작용 모드/8패널 상태 분리 + 상단 툴바·sticky 캔버스·우측 패널·모바일 하단 시트로 재구성. 그리기 서브도구 보존, 삽입 후 패널 유지, 선택 객체 플로팅 미니바(색·굵기·맨앞/뒤·복제·삭제, base 보호) 추가. aria/data-testid 스모크·390×844 검증 포함. — Codx
- Excel 시트 선택기를 1~2열 카드 그리드로 재배치: custom 모드 `aria-pressed` 칩 토글, all/positions 상태 칩, 카드 접근성·목록 내부 스크롤·모바일 44px 타깃·Step 2 sticky 요약(ko/en). — Codx
- VP9 인코딩에 `-deadline good -cpu-used 4` 추가(호스트 실측 3.2배 가속·품질 동등), 전체 인자 배열 회귀 테스트와 고정 벤치 fixture·스크립트 추가. — Codx
- Gemini 위임 경로 확립: agy CLI 호출 방법(`--add-dir` 필수, 타임아웃·구조화 출력·샌드박스 기준)과 산출물 검증 절차를 `CLAUDE.md` 「호스트 참고」에 기록. — Claude
- Chrome 렌더링 기반 앱 아이콘 생성기(`scripts/generate-app-icons.mjs`)로 그라데이션 PNG 5종 재생성, manifest `any`/`maskable` 분리, iOS용 불투명 180px 생성. — Codx
- 세 에이전트 협업 체계 도입: `PROJECT_RULES.md` 신설(공통 3규칙 명명 이관), 역할 지시서 `CLAUDE.md`·`AGENTS.md`·`GEMINI.md` 분리, `docs/jobs/` 작업지시서 체계·`docs/backlog.md` 도입, 「커밋·업로드·배포는 Codex」 규칙 추가(사용자 결정). 운영 문서 2종을 규칙 부속 명세로 연계. — Claude
- 2026-08-15–16 신뢰성 작업지시서 4개 종결·`docs/jobs/archive/` 이관(검토 내역은 `docs/review-notes.md`). — Codx
