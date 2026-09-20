# 지시서 — U4(PDF 마무리) 계획 v7 · Codex astra 6차 반박 (2026-09-06)
## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(신설 「모델 역할 분담」 — 이 라운드는 astra 반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박) → `docs/jobs/todo/pdf-finish-20260905.md` 전문(**「v7 확정」 절이 최신**) → `roadmap-completion-20260906.md` §2·§3 S3·§결정 10·11 → 자신의 3차·4차 보고 `/tmp/worklazy-u4-r3/REPORT.md`·`/tmp/worklazy-u4-r4/REPORT.md`·`/tmp/worklazy-u4-r5/REPORT.md`.
## 1. 성격·기준
- **반박 라운드(실험 모드)** — 저장소 파일 수정·커밋·push·`dist` 변경·npm 설치 절대 금지. 실험은 `/tmp/worklazy-u4-r6/`(3차·4차의 `/tmp/worklazy-u4-r3/project/`·`/tmp/worklazy-u4-r4/project/`·`/tmp/worklazy-u4-r5/` 복제본·계측 플러그인·OCG fixture 재사용 가능). 시작·종료 불변 증명(3차의 `verify-unchanged.py` 방식).
- 저장소 루트 `/home/better0101/projects/worklazytools`, 기준 HEAD `main` = `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`. **`AGENTS.md`·`CLAUDE.md` 는 워킹트리에 Claude 의 문서 변경이 있다(모델 역할 규칙 추가) — 이는 알려진 변경이며 불변 증명에서 제외하고 그 외 파일 불변을 증명한다.**
- 동시에 S2b 1차 반박(읽기 전용)이 같은 저장소를 읽는다.
## 2. 반박 대상
「v7 확정」 절 D3·D4·D5·N3. 항목별 [동의]/[이견] + 명령·출력. 특히:
- **D4 OCG**: 5차 OCG fixture(파란 사각형 + OFF 빨간 레이어)에서 "기본 가시성 굳히기"(OFF content BDC…EMC 블록·OFF XObject 호출 제거, ON 은 유지하되 `/OC` 마크·참조·OCProperties·Properties 제거) 를 pdf-lib 저수준 API 로 구현해 **Poppler 픽셀이 원본 기본 표시와 동일(red 0·blue 1,600)** 인지 probe. 평가 불가 입력(OCMD `/VE`·중첩·폼 XObject 내부 `/OC`)의 감지 기준이 코드로 성립하는지.
- **D3**: 임계 `floor(DPI×0.057)`(150→8·200→11·300→17)가 5차 표(9/12/17~18)와 정합하는지; paired 중앙값 식; "B 는 차단 미사용·경고 2규칙" 이 로드맵과 충돌 없는지.
- **D5**: `setTimeout(0)`(또는 MessageChannel) 양보 helper 로 5차 취소 반례(12/12 → 1/12)가 해소되는지 재실행; adapter 범위 "실제 pdfWorkerClient 이관·finish 미소비" 문안의 정합.
- **N3**: 전처리 순수 함수(TAB→4공백·기타 제어문자 차단·LF 분리) 결정성과 width/draw 동일 입력; 말줄임 폭·수직 overflow·타일 400 규칙의 실행 가능성.
- **HEAD 주의**: 기준 `main` 은 `f29d249…`(1a04f25 + CLAUDE.md 문서 커밋). 번들 baseline 은 1a04f25 의 r3 산출을 그대로 쓴다(사후 변경 금지). `AGENTS.md` 워킹트리 변경은 Claude 것.
- **sol 관점 최종 점검**: v7 로 U4-0~8 코딩 시 재해석 지점이 남는가. 없으면 "Claude–Codex 간 이견 0 · [정본화 가능]" 명시.
## 3. 판정 형식
항목별 표 · 잔여 이견 수 · [정본화 가능]/[재왕복 필요]. 잔여 0 이면 "Claude–Codex 간 이견 0" 명시. 산출물 `/tmp/worklazy-u4-r6/REPORT.md`.
## 4. 금지
저장소 변경 · 계획서 편집 · 사용자 파일 조작 · 상한 변경 제안.
