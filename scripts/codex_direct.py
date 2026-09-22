#!/usr/bin/env python3
"""Invoke the INSTALLED official Claude Codex plugin, without an LLM forwarder.

This does not implement an alternate Codex runtime. It calls the plugin's
codex-companion.mjs and uses its own state resolver. No shell interpolation,
API-key arguments, global permission changes, or automatic re-dispatch.
"""
from __future__ import annotations
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from typing import Any


class DispatchError(RuntimeError):
    pass


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run(argv: list[str], cwd: Path, *, env: dict | None = None, timeout: float = 30) -> str:
    try:
        result = subprocess.run(argv, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise DispatchError("PROCESS_START_OR_TIMEOUT; inspect the recorded launch before retrying") from None
    if result.returncode:
        # Provider and plugin stderr may contain the task. Do not echo it.
        raise DispatchError("COMMAND_FAILED_EXIT_" + str(result.returncode))
    return result.stdout.decode("utf-8", errors="replace")


def git(root: Path, *args: str) -> str:
    return run(["git", *args], root).strip()


def repo_root(path: str | Path) -> Path:
    p = Path(path).expanduser().resolve()
    top = Path(git(p, "rev-parse", "--show-toplevel")).resolve()
    if top != p:
        raise DispatchError("WORKSPACE_MUST_BE_WORKTREE_ROOT")
    return top


def state_home(root: Path) -> Path:
    common = Path(git(root, "rev-parse", "--git-common-dir"))
    if not common.is_absolute():
        common = root / common
    home = common.resolve() / "agent-ops"
    home.mkdir(parents=True, exist_ok=True, mode=0o700)
    return home


def atomic_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    tmp = path.with_name(path.name + f".{os.getpid()}.tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as fp:
        json.dump(data, fp, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False)
        fp.write("\n"); fp.flush(); os.fsync(fp.fileno())
    os.replace(tmp, path)


@contextlib.contextmanager
def locked(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with path.open("a+") as fp:
        fcntl.flock(fp, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(fp, fcntl.LOCK_UN)


def read_json(path: Path, default=None):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        raise DispatchError("INVALID_STATE_FILE: " + path.name) from None


def find_plugin(explicit: str | None = None) -> Path:
    choices: list[Path] = []
    if explicit:
        choices = [Path(explicit).expanduser()]
    else:
        env = os.environ.get("CLAUDE_PLUGIN_ROOT")
        if env and (Path(env) / "scripts/codex-companion.mjs").is_file():
            choices.append(Path(env))
        registry = Path.home() / ".claude/plugins/installed_plugins.json"
        if not choices and registry.is_file():
            obj = read_json(registry, {})
            entries = obj.get("plugins", {}).get("codex@openai-codex", [])
            if isinstance(entries, dict):
                entries = [entries]
            for item in entries:
                if isinstance(item, dict) and isinstance(item.get("installPath"), str):
                    choices.append(Path(item["installPath"]))
        if not choices:
            choices = list((Path.home() / ".claude/plugins/cache/openai-codex/codex").glob("*/"))
    valid = {p.resolve() for p in choices if (p / "scripts/codex-companion.mjs").is_file()
             and (p / "agents/codex-rescue.md").is_file()}
    if len(valid) != 1:
        raise DispatchError("PLUGIN_ROOT_NOT_UNIQUE; use --plugin-root with the installed codex plugin directory")
    return valid.pop()


def plugin_contract(plugin: Path) -> dict:
    rescue = plugin / "agents/codex-rescue.md"
    companion = plugin / "scripts/codex-companion.mjs"
    rule = rescue.read_bytes()  # Deliberately consulted on EVERY launch.
    code = companion.read_text(encoding="utf-8")
    required = ["--model", "--write", "--fresh", "--background", "prompt-file", "cwd"]
    if any(flag not in code for flag in required):
        raise DispatchError("PLUGIN_CLI_CONTRACT_CHANGED; inspect installed codex-rescue.md and companion before invoking")
    if b"codex-companion" not in rule:
        raise DispatchError("RESCUE_CONTRACT_CHANGED")
    return {"plugin_root": str(plugin), "rescue_sha256": digest(rule),
            "companion_sha256": digest(companion.read_bytes())}


def job_dir(plugin: Path, workspace: Path, env: dict) -> Path:
    # Use the installed plugin's resolver instead of guessing ~/.claude/.../state.
    resolver = plugin / "scripts/lib/state.mjs"
    js = "const m=await import(process.argv[1]);console.log(m.resolveJobsDir(process.argv[2]));"
    value = run(["node", "--input-type=module", "-e", js, resolver.as_uri(), str(workspace)], workspace, env=env)
    return Path(value.strip()).resolve()


def job_data(plugin: Path, workspace: Path, job: str, env: dict) -> dict:
    if not re.fullmatch(r"task-[A-Za-z0-9-]+", job):
        raise DispatchError("INVALID_JOB_ID")
    data = read_json(job_dir(plugin, workspace, env) / (job + ".json"))
    if not isinstance(data, dict):
        raise DispatchError("JOB_RECORD_NOT_FOUND")
    return data


def unwrap_job(record: dict) -> dict:
    return record.get("job", record) if isinstance(record.get("job", record), dict) else record


def terminal(record: dict) -> bool:
    return unwrap_job(record).get("status") in {"completed", "failed", "cancelled", "canceled", "interrupted", "error", "done"}


def requested_fields(record: dict) -> tuple[Any, Any, Any, Any]:
    job = unwrap_job(record)
    req = record.get("request", job.get("request", {}))
    req = req if isinstance(req, dict) else {}
    model = req.get("model", job.get("model"))
    cwd = job.get("workspaceRoot", req.get("cwd"))
    write = job.get("write", req.get("write"))
    thread = job.get("threadId") or record.get("threadId")
    for obj in (record.get("result"), job.get("result"), record.get("payload")):
        if not thread and isinstance(obj, dict):
            thread = obj.get("threadId")
    return model, cwd, write, thread


def observed_turn(thread: str) -> dict | None:
    # threadId is the Codex ID; do NOT confuse the plugin's Claude sessionId.
    if not re.fullmatch(r"[A-Za-z0-9-]{8,100}", thread):
        raise DispatchError("INVALID_CODEX_THREAD_ID")
    home = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex"))).expanduser()
    files = list((home / "sessions").glob(f"**/*{thread}*.jsonl"))
    if len(files) != 1:
        return None
    last = None
    with files[0].open(encoding="utf-8") as fp:
        for line in fp:
            try:
                item = json.loads(line)
            except ValueError:
                continue
            if item.get("type") == "turn_context" and isinstance(item.get("payload"), dict):
                last = item["payload"]
    if last is None:
        return None
    return {"model": last.get("model"), "cwd": last.get("cwd"),
            "sandbox_policy": last.get("sandbox_policy"), "rollout": str(files[0])}


def verify_job(plugin: Path, workspace: Path, job: str, expected_model: str, write: bool,
               env: dict, timeout: float = 20) -> dict:
    end = time.monotonic() + timeout
    while True:
        try:
            record = job_data(plugin, workspace, job, env)
        except DispatchError as error:
            if str(error) != "JOB_RECORD_NOT_FOUND" or time.monotonic() >= end:
                raise
            time.sleep(.25); continue
        model, cwd, recorded_write, thread = requested_fields(record)
        if model != expected_model:
            raise DispatchError("MODEL_MISMATCH")
        if not isinstance(cwd, str) or Path(cwd).resolve() != workspace:
            raise DispatchError("CWD_MISMATCH")
        if recorded_write is not write:
            raise DispatchError("WRITE_MISMATCH")
        obs = observed_turn(thread) if isinstance(thread, str) else None
        if obs:
            if obs["model"] != expected_model:
                raise DispatchError("ACTUAL_SESSION_MODEL_MISMATCH")
            if not isinstance(obs["cwd"], str) or Path(obs["cwd"]).resolve() != workspace:
                raise DispatchError("ACTUAL_SESSION_CWD_MISMATCH")
            sandbox = obs["sandbox_policy"]
            kind = sandbox.get("type") if isinstance(sandbox, dict) else sandbox
            if kind not in {"read-only", "workspace-write"}:
                raise DispatchError("UNEXPECTED_OR_UNVERIFIABLE_SANDBOX")
            if (kind == "workspace-write") is not write:
                raise DispatchError("ACTUAL_SESSION_WRITE_MISMATCH")
            roots = sandbox.get("writable_roots", []) if isinstance(sandbox, dict) else []
            others = [Path(line[9:]).resolve() for line in git(workspace, "worktree", "list", "--porcelain").splitlines()
                      if line.startswith("worktree ") and Path(line[9:]).resolve() != workspace]
            if not isinstance(roots, list) or any(not isinstance(p, str) for p in roots):
                raise DispatchError("UNVERIFIABLE_WRITE_ROOTS")
            for writable in roots:
                rw = Path(writable).resolve()
                if any(other == rw or other.is_relative_to(rw) for other in others):
                    raise DispatchError("WRITE_ROOT_INCLUDES_ANOTHER_WORKTREE")
            return {"job_id": job, "model": obs["model"], "workspace": str(workspace),
                    "write": write, "thread_id": thread, "rollout": obs["rollout"], "verified": True}
        if time.monotonic() >= end:
            raise DispatchError("ACTUAL_SESSION_UNVERIFIED")
        time.sleep(.25)


def effective_env() -> dict:
    # Preserve installed authentication/configuration and subscription routing.
    return dict(os.environ)


def invoke(plugin: Path, workspace: Path, command: str, job: str, env: dict) -> str:
    return run(["node", str(plugin / "scripts/codex-companion.mjs"), command, "--cwd", str(workspace), job, "--json"],
               workspace, env=env, timeout=30)


def dispatch(root: Path, request: dict, config: dict, plugin_arg: str | None = None) -> dict:
    root = repo_root(root)
    workspace = repo_root(request["workspace"])
    if state_home(root).resolve() != state_home(workspace).resolve():
        raise DispatchError("WORKSPACE_BELONGS_TO_ANOTHER_REPOSITORY")
    role, execution = request.get("role"), request.get("execution")
    if role not in {"implementation", "review", "research"} or execution not in {"research", "verification", "implementation"}:
        raise DispatchError("INVALID_ROLE_OR_EXECUTION_TYPE")
    if role == "implementation" and execution != "implementation":
        raise DispatchError("IMPLEMENTER_EXECUTION_MISMATCH")
    if role != "implementation" and execution == "implementation":
        raise DispatchError("IMPLEMENTATION_ROLE_MISMATCH")
    if role == "research" and execution != "research":
        raise DispatchError("RESEARCH_MUST_USE_READ_ONLY_EXECUTION")
    if role == "research" and request.get("fallback_reason") != "gemini_quota_exceeded":
        raise DispatchError("LUNA_RESEARCH_REQUIRES_CONFIRMED_GEMINI_QUOTA")
    if role == "research" and not request.get("failure_evidence"):
        raise DispatchError("MISSING_QUOTA_EVIDENCE_REFERENCE")
    if execution == "implementation" and (request.get("request_mode") != "plan-and-implement" or request.get("implementation_authorized") is not True):
        raise DispatchError("IMPLEMENTATION_NOT_AUTHORIZED")
    if not request.get("approval_reference"):
        raise DispatchError("MISSING_APPROVAL_REFERENCE")
    # Implementing or running verification in the primary checkout is not allowed.
    if execution in {"implementation", "verification"} and not (workspace / ".git").is_file():
        raise DispatchError("LINKED_WORKTREE_REQUIRED")
    if role == "review" and execution == "verification" and request.get("isolated_verification_workspace") is not True:
        raise DispatchError("ISOLATED_REVIEW_WORKSPACE_REQUIRED")
    model = config["models"][role]
    if request.get("model", model) != model:
        raise DispatchError("ROLE_MODEL_CONFLICT")
    plugin = find_plugin(plugin_arg)
    contract = plugin_contract(plugin)
    prompt_file = Path(request["prompt_file"]).expanduser().resolve()
    if not prompt_file.is_file() or prompt_file.stat().st_size == 0 or prompt_file.stat().st_size > 512_000:
        raise DispatchError("INVALID_PROMPT_FILE")
    # Arguments are arrays; $, backticks, quotes and newlines are DATA, not shell code.
    prompt_hash = digest(prompt_file.read_bytes())
    write = execution != "research"
    key = digest(json.dumps({"workspace": str(workspace), "task_id": request.get("task_id"),
                             "target": request.get("target_digest"), "prompt": prompt_hash,
                             "model": model, "write": write}, sort_keys=True).encode())
    home = state_home(root)
    ledger_file = home / "dispatches.json"
    env = effective_env()
    with locked(home / "dispatch.lock"):
        ledger = read_json(ledger_file, {})
        if key in ledger:
            old = ledger[key]
            if old.get("status") in {"launching", "launch_unknown", "running", "completed", "cancel_requested", "cancel_failed"}:
                return {**old, "deduplicated": True}
            raise DispatchError("PRIOR_LAUNCH_REQUIRES_RECONCILIATION; no automatic retry")
        # Check ALL records in this installed plugin workspace, not only our ledger.
        directory = job_dir(plugin, workspace, env)
        if directory.exists():
            for file in directory.glob("task-*.json"):
                item = read_json(file, {})
                if unwrap_job(item).get("status") in {"queued", "starting", "running", "pending"}:
                    raise DispatchError("WORKSPACE_HAS_EXISTING_JOB; inspect status and result before replacing it")
        for old in ledger.values():
            if old.get("workspace") == str(workspace) and old.get("status") in {"launching", "launch_unknown", "running", "cancel_requested", "cancel_failed"}:
                raise DispatchError("WORKSPACE_ALREADY_RESERVED")
        record = {"key": key, "status": "launching", "workspace": str(workspace), "model": model,
                  "write": write, "task_id": request.get("task_id"), "target_digest": request.get("target_digest"),
                  "plugin": contract, "plugin_data": env.get("CLAUDE_PLUGIN_DATA"), "prompt_sha256": prompt_hash,
                  "created_at": time.time()}
        ledger[key] = record; atomic_json(ledger_file, ledger)
    argv = ["node", str(plugin / "scripts/codex-companion.mjs"), "task", "--background", "--fresh",
            "--model", model, "--cwd", str(workspace), "--prompt-file", str(prompt_file), "--json"]
    if write:
        argv.append("--write")
    job = None
    try:
        output = run(argv, workspace, env=env, timeout=45)
        try:
            obj = json.loads(output); job = obj.get("jobId") or obj.get("job_id") or obj.get("id")
        except (ValueError, AttributeError):
            ids = set(re.findall(r"\btask-[A-Za-z0-9-]+\b", output))
            job = next(iter(ids)) if len(ids) == 1 else None
        if not isinstance(job, str) or not re.fullmatch(r"task-[A-Za-z0-9-]+", job):
            raise DispatchError("LAUNCH_OUTCOME_UNKNOWN")
        record["job_id"] = job
        observed = verify_job(plugin, workspace, job, model, write, env)
        record.update(observed); record["status"] = "running"
    except DispatchError as error:
        record["error"] = str(error)
        record["status"] = "launch_unknown"
        if job:
            try:
                invoke(plugin, workspace, "cancel", job, env)
                record["status"] = "cancel_requested"
            except DispatchError:
                record["status"] = "cancel_failed"
    with locked(home / "dispatch.lock"):
        ledger = read_json(ledger_file, {}); ledger[key] = record; atomic_json(ledger_file, ledger)
    return record


def inspect_job(root: Path, job: str, command: str = "status") -> dict:
    if command not in {"status", "result", "cancel"}:
        raise DispatchError("UNSUPPORTED_JOB_OPERATION")
    home = state_home(repo_root(root)); ledger = read_json(home / "dispatches.json", {})
    matches = [(key, rec) for key, rec in ledger.items() if rec.get("job_id") == job]
    if len(matches) != 1:
        raise DispatchError("JOB_NOT_UNIQUELY_REGISTERED; inspect native plugin records before adopting an old job")
    key, record = matches[0]
    plugin = Path(record["plugin"]["plugin_root"]); workspace = Path(record["workspace"])
    if plugin_contract(plugin) != record["plugin"]:
        raise DispatchError("PLUGIN_CHANGED_DURING_JOB")
    env = effective_env()
    if record.get("plugin_data") is not None:
        env["CLAUDE_PLUGIN_DATA"] = record["plugin_data"]
    else:
        env.pop("CLAUDE_PLUGIN_DATA", None)
    raw = invoke(plugin, workspace, command, job, env)
    try:
        result = json.loads(raw)
    except ValueError:
        raise DispatchError("UNEXPECTED_PLUGIN_JSON; result kept in plugin records") from None
    current = job_data(plugin, workspace, job, env)
    if terminal(current):
        record["status"] = "completed"  # terminal execution, NOT review approval
    elif command == "cancel":
        record["status"] = "cancel_requested"
    with locked(home / "dispatch.lock"):
        ledger = read_json(home / "dispatches.json", {}); ledger[key] = record; atomic_json(home / "dispatches.json", ledger)
    return {"job_id": job, "execution_terminal": terminal(current), "native_status": unwrap_job(current).get("status"), "record": record, "plugin_result": result}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("dispatch"); p.add_argument("--request", required=True); p.add_argument("--plugin-root")
    for action in ("status", "result", "cancel"):
        p = sub.add_parser(action); p.add_argument("job")
    p = sub.add_parser("doctor"); p.add_argument("--plugin-root")
    args = parser.parse_args()
    try:
        root = repo_root(args.repo)
        if args.cmd == "doctor":
            plugin = find_plugin(args.plugin_root)
            result = {**plugin_contract(plugin), "workspace": str(root),
                      "jobs_dir": str(job_dir(plugin, root, effective_env())), "node_available": bool(shutil.which("node"))}
        elif args.cmd == "dispatch":
            config = read_json(root / "docs/agent-ops-config.json")
            result = dispatch(root, read_json(Path(args.request)), config, args.plugin_root)
        else:
            result = inspect_job(root, args.job, args.cmd)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("status") not in {"launch_unknown", "cancel_requested", "cancel_failed"} else 2
    except (DispatchError, KeyError, TypeError) as error:
        safe = str(error) if isinstance(error, DispatchError) else "INVALID_REQUEST_STRUCTURE"
        print(json.dumps({"status": "blocked", "error": safe}, ensure_ascii=False)); return 2


if __name__ == "__main__":
    raise SystemExit(main())
