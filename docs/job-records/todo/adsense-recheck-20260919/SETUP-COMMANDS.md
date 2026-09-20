# 정본화 후 실행할 준비 명령 (Claude, 구현 허가 확인 후)

ROOT=/home/better0101/projects/worklazytools; BASE=29fe72c
git -C "$ROOT" worktree list --porcelain; git -C "$ROOT" status --short
git -C "$ROOT" worktree add -b work/adsense-guides-20260919 /home/better0101/projects/wt-adsense-guides "$BASE"
git -C "$ROOT" worktree add -b work/adsense-adtest-20260919 /home/better0101/projects/wt-adsense-adtest "$BASE"
# 지시서·항목표 사본(docs/jobs는 git 제외) — 각 worktree에 복사 후 sha256 기록
for W in wt-adsense-guides wt-adsense-adtest; do mkdir -p /home/better0101/projects/$W/docs/jobs/todo/adsense-recheck-20260919; cp $ROOT/docs/jobs/todo/adsense-recheck-20260919/PLAN.md /home/better0101/projects/$W/docs/jobs/todo/adsense-recheck-20260919/; cp $ROOT/docs/jobs/todo/adsense-content-audit-20260919.md /home/better0101/projects/$W/docs/jobs/todo/; done
# 의존성: 각 worktree에서 npm ci (node_modules 공유 금지). 벤더 자산은 prebuild가 준비.
mkdir -p /tmp/wl-adsense/wu1 /tmp/wl-adsense/wu2 /tmp/wl-adsense/wu3 /tmp/wl-adsense/review
