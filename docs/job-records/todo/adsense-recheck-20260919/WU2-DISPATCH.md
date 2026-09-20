# WU2 위임문 — Muse (OpenCode, 신규 세션)

MODEL=opencode/muse-spark-1.3-contributor-free (연결 실패 시 opencode-go/muse-spark-1.3-contributor, 실제 사용값 기록)
MUSE_WORKTREE=/home/better0101/projects/wt-adsense-adtest
SP=/tmp/wl-adsense/wu2
명령 형식(런북 「새 세션이 맞는 경우」): opencode run --dir "$MUSE_WORKTREE" --model "$MODEL" "$PROMPT" > "$SP/muse-out.log" 2> "$SP/muse-err.log"
세션 선택 근거: 이 작업 ID의 기존 Muse 세션 없음 → 신규. 생성된 세션 ID를 WU2-REPORT.md와 PLAN.md §2 작업표에 기록. 후속은 `-s <id>`.

PROMPT 원문:
구현 작업(파일 수정·커밋 필요). 작업 ID adsense-recheck-20260919 / WU2. 지시서 정본: /home/better0101/projects/wt-adsense-adtest/docs/jobs/todo/adsense-recheck-20260919/PLAN.md (버전 v0.3, sha256 앞 16자 40c69eeb25b6ec4c). 요청 모드 plan-and-implement, 계획 상태 정본화 완료, 구현 허가 있음(사용자 `!계획!` 2026-09-19, Claude 정본화 2026-09-20).
작업 공간: git worktree /home/better0101/projects/wt-adsense-adtest, 브랜치 work/adsense-adtest-20260919, 기준 커밋 29fe72c. 이 worktree 밖에는 쓰지 않는다. 임시 산출물은 /home/better0101/projects/wt-adsense-adtest/tests/visual-artifacts/adsense-recheck/ (git 제외)에만.
역할: 당신은 구현 담당 Muse다. PLAN.md §4(WU2) 전부와 §4-4 소유 범위만 수행한다. §3·§5·§6은 범위 밖. 규칙 정본은 worktree의 PROJECT_RULES.md·AGENTS.md.
핵심 조건(변경 불가): 광고 제외 4경로군 유지, 광고 범위 확대 금지, noindex 금지, 실제 광고 요청·클릭 금지. 로컬 외 모든 HTTP(S)는 사전 차단(fail-closed)하고 정확한 AdSense 스크립트 URL만 CORS 가능한 스텁으로 응답. 분석(googletagmanager.com, wcs.pstatic.net)도 차단. 시나리오·문서별 `시도/스텁/차단/실제 허용` 계수 기록, 실제 허용은 항상 0.
빌드: `npm run build`를 VITE_LOCAL_QA 미설정으로. 서버: tests/recovery-server.mjs 재사용, RECOVERY_TEST_PORT=4182. 브라우저: playwright 1.63 + /usr/bin/google-chrome.
순서: 스텁·차단 헬퍼 → S1·S2(+자체 판별력 확인) → S3·S4 → S6·S7 → S8 → S9 → S5 시도(§4-2 순서, 불가 시 재현 불가 기록) → S10 미확인 기록 → package.json 스크립트 `test:ads` 추가·개행 복원 → 보고.
결함 수정은 §4-3 범위(AdSenseLoader.tsx, adEligibility.ts, AppShell.tsx 광고 관련 줄)에서 테스트가 드러낸 것만 최소로. AppShell의 비광고 줄·라우팅을 바꿔야 하면 중단하고 보고.
금지: guides.json·검증기·seo.ts·문서 본문 수정, 광고 정책 확대, 저장소 루트 새 파일, push.
커밋: 작업 브랜치에 의미 단위로. 최종 SHA 고정 제출.
보고: docs/jobs/todo/adsense-recheck-20260919/WU2-REPORT.md(worktree 사본 경로)에 최종 SHA, 변경 파일, 빌드 플래그, 시나리오별 결과 표(URL/언어/상태/script 수/시도·스텁·차단·실제/문서 교체 수/증거 파일), 재현 불가·미확인 항목과 이유, 실행 명령·종료 코드·로그 경로. 실패·권한 오류는 원인과 함께 중단 보고.
