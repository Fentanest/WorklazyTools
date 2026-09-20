# 지시서 — U4(PDF 마무리) 계획 v8 · Codex astra 7차 반박 (2026-09-06)
## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(신설 「모델 역할 분담」 — 이 라운드는 astra 반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박) → `docs/jobs/todo/pdf-finish-20260905.md` 전문(**「v8 확정」 절이 최신**) → `roadmap-completion-20260906.md` §2·§3 S3·§결정 10·11 → 자신의 3차·4차 보고 `/tmp/worklazy-u4-r3/REPORT.md`·`/tmp/worklazy-u4-r4/REPORT.md`·`/tmp/worklazy-u4-r5/REPORT.md`·`/tmp/worklazy-u4-r6/REPORT.md`.
## 1. 성격·기준
- **반박 라운드(실험 모드)** — 저장소 파일 수정·커밋·push·`dist` 변경·npm 설치 절대 금지. 실험은 `/tmp/worklazy-u4-r7/`(3차·4차의 `/tmp/worklazy-u4-r3/project/`·`/tmp/worklazy-u4-r4/project/`·`/tmp/worklazy-u4-r5/`·`/tmp/worklazy-u4-r6/` 복제본·계측 플러그인·OCG fixture 7종·parser probe 재사용 가능). 시작·종료 불변 증명(3차의 `verify-unchanged.py` 방식).
- 저장소 루트 `/home/better0101/projects/worklazytools`, 기준 HEAD `main` = `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`. **`AGENTS.md`·`CLAUDE.md` 는 워킹트리에 Claude 의 문서 변경이 있다(모델 역할 규칙 추가) — 이는 알려진 변경이며 불변 증명에서 제외하고 그 외 파일 불변을 증명한다.**
- 동시에 S2b 1차 반박(읽기 전용)이 같은 저장소를 읽는다.
## 2. 반박 대상
「v8 확정」 절 D3·D4·N3. 항목별 [동의]/[이견] + 명령·출력. 특히:
- **D4**: 자기완결 조건 ①~⑤(q/Q 감싸기·path 종결·BT/ET 균형·depth 1·inline image 없음)를 6차 fixture 7종(자기완결 5 + `cm` 전파·current path 전파 2)에 순수 분류 함수로 적용 → 기대 = 5 제거 허용(RGBA SHA 동일) · 2 지원 제외. 조건이 과소(반례 통과)·과다(정상 fixture 거부)인지 판정. 추가 반례가 있으면 제시.
- **D3**: 등록 전 `retained+current>200MiB` 검사 표 4행(200 / 199,2,1 / 201 / 100,100,1) 재현; abort→용량→등록 순서; OPFS write 실패 경계; 계수 `max(finalPdfBytes/selectedPixels)` 집계가 5차 photo-scan 셀에서 하나의 값으로 정해지는지.
- **N3**: `{date:<format>}` 화이트리스트 parser 골든(허용 5·오류 4) 결정성.
- **HEAD 주의**: 기준 `main` = `f29d249…`, 번들 baseline 은 1a04f25 유지. `AGENTS.md` 워킹트리 변경은 Claude 것. 동시 세션이 `docs/jobs/todo/*.md`(gitignore) 를 갱신할 수 있으므로 계획서 SHA 변화는 이견 아님.
- **sol 관점 최종 점검**: v8 로 U4-0~8 코딩 시 재해석 지점이 남는가. 없으면 "Claude–Codex 간 이견 0 · [정본화 가능]" 명시.
## 3. 판정 형식
항목별 표 · 잔여 이견 수 · [정본화 가능]/[재왕복 필요]. 잔여 0 이면 "Claude–Codex 간 이견 0" 명시. 산출물 `/tmp/worklazy-u4-r7/REPORT.md`.
## 4. 금지
저장소 변경 · 계획서 편집 · 사용자 파일 조작 · 상한 변경 제안.
