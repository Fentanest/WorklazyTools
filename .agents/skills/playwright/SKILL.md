---
name: "playwright"
description: "Use when the task requires automating a real browser from the terminal (navigation, form filling, snapshots, screenshots, data extraction, UI-flow debugging) via `playwright-cli` or the bundled wrapper script."
---

# Playwright CLI Skill

Drive a real browser from the terminal using `playwright-cli`. Prefer the bundled wrapper script so the CLI works even when it is not globally installed.
Treat this skill as CLI-first automation. Do not pivot to `@playwright/test` unless the user explicitly asks for test files.

## Prerequisite check (required)

Before proposing commands, check whether `npx` is available:

```bash
command -v npx >/dev/null 2>&1
```

If it is not available, report '실행 준비 미완료' (Execution preparation incomplete) and wait for the user's approved installation method. Do not suggest or run automatic global installations like `npm install -g @playwright/cli@latest`. Note that running `npx` may trigger package downloads.

## Skill path (set once)

Use the following snippet to set up the environment before running commands. This should be run in the product repository or the testing copy.

```bash
# 제품 저장소 또는 검수용 복사본 안에서 먼저 실행한다.
ROOT="$(git rev-parse --show-toplevel)" || exit 1
SKILL_DIR="$ROOT/.agents/skills/playwright"
PWCLI="$SKILL_DIR/scripts/playwright_cli.sh"
test -f "$PWCLI" || { printf '%s\n' 'Playwright 스킬 경로 확인 필요' >&2; exit 1; }
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/worklazy-playwright.XXXXXXXX")" || exit 1
cd "$RUN_DIR" || exit 1
# 이후 필요한 브라우저 명령은 bash "$PWCLI" ... 형태로 호출한다.
```

In the same verification session, reuse `RUN_DIR`. If you open a new shell, restore the recorded absolute paths. Keep screenshots, traces, and snapshot outputs in this temporary `RUN_DIR` (or a user-specified testing copy output path) to avoid polluting the product repository.

## Quick start

Use the wrapper script:

```bash
bash "$PWCLI" open https://playwright.dev --headed
bash "$PWCLI" snapshot
bash "$PWCLI" click e15
bash "$PWCLI" type "Playwright"
bash "$PWCLI" press Enter
bash "$PWCLI" screenshot
```

## Core workflow

1. Open the page.
2. Snapshot to get stable element refs.
3. Interact using refs from the latest snapshot.
4. Re-snapshot after navigation or significant DOM changes.
5. Capture artifacts (screenshot, pdf, traces) when useful.

Minimal loop:

```bash
bash "$PWCLI" open https://example.com
bash "$PWCLI" snapshot
bash "$PWCLI" click e3
bash "$PWCLI" snapshot
```

## When to snapshot again

Snapshot again after:

- navigation
- clicking elements that change the UI substantially
- opening/closing modals or menus
- tab switches

Refs can go stale. When a command fails due to a missing ref, snapshot again.

## Recommended patterns

### Form fill and submit

```bash
bash "$PWCLI" open https://example.com/form
bash "$PWCLI" snapshot
bash "$PWCLI" fill e1 "user@example.com"
bash "$PWCLI" fill e2 "password123"
bash "$PWCLI" click e3
bash "$PWCLI" snapshot
```

### Debug a UI flow with traces

```bash
bash "$PWCLI" open https://example.com --headed
bash "$PWCLI" tracing-start
# ...interactions...
bash "$PWCLI" tracing-stop
```

### Multi-tab work

```bash
bash "$PWCLI" tab-new https://example.com
bash "$PWCLI" tab-list
bash "$PWCLI" tab-select 0
bash "$PWCLI" snapshot
```

## Wrapper script

The wrapper script uses `npx --package @playwright/cli playwright-cli` so the CLI can run without a global install:

```bash
bash "$PWCLI" --help
```

## References

Open only what you need:

- CLI command reference: `references/cli.md`
- Practical workflows and troubleshooting: `references/workflows.md`

## Guardrails

- Always snapshot before referencing element ids like `e12`.
- Re-snapshot when refs seem stale.
- Prefer explicit commands over `eval` and `run-code` unless needed.
- When you do not have a fresh snapshot, use placeholder refs like `eX` and say why; do not bypass refs with `run-code`.
- Use `--headed` when a visual check will help.
- When capturing artifacts, use the temporary `$RUN_DIR`. Do not write to the product repository.
- Default to CLI commands and workflows, not Playwright test specs.
- Do not migrate existing product tests to a new framework or create new Playwright configuration files unless explicitly asked.
