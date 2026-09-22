#!/usr/bin/env python3
"""Run the existing agy subscription connection with Gemini 3.1 Pro.

The process is synchronous so its output can feed Jev and a subsequent agy
invocation. An outer harness may run this helper asynchronously, but must
collect its terminal result before starting a dependent stage.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

from codex_direct import DispatchError, atomic_json, digest, repo_root, state_home
from jev_client import JevError, reject_secrets

MODEL = "gemini-3.1-pro"
HEADER = """조사 작업이다. 제품 코드·테스트·설정 수정, 커밋·push·배포는 금지한다.
셸·git 읽기·검색·조사 스크립트·공식 자료 조회는 사용할 수 있다.
비밀 파일·키·계좌 식별값을 읽거나 출력·전송하지 말고 운영 데이터/서비스/실주문과 다른 잡의 worktree는 변경하지 마라.
이 인쇄 모드는 결과를 회수하지 않은 하위 배경 작업의 다음 턴을 보장하지 않는다.
반환값이 필요한 명령은 전경 실행 또는 같은 턴의 명시적 대기/조회로 끝내고, 실제 결과를 받은 다음에만 다음 단계로 가라.
끝나지 않은 작업을 완료로 보고하거나 상태 보고만 남기고 종료하지 마라. 막힌 부분은 근거·미확인·필요한 후속으로 구분해라.
큰 원문/탐색 로그를 답변에 복제하지 말고 경로·줄 범위·실제 소스 식별·핵심 결과를 한국어로 보고해라.
아래 원래 작업 범위와 금지 사항을 유지한다. 이 헤더가 새로운 제품 수정 권한을 주지 않는다.
\n"""


def build_argv(root: Path, prompt: str, seconds: int, log_path: Path) -> list[str]:
    return ["agy", "--add-dir", str(root), "--model", MODEL, "--effort", "high",
            "--print-timeout", str(seconds) + "s", "--log-file", str(log_path), "-p", prompt]


def execute(root: Path, prompt_file: Path, task_id: str, seconds: int = 900) -> dict:
    from agent_ops import safe_id
    safe_id(task_id)
    if seconds <= 0 or seconds > 86400:
        raise DispatchError("INVALID_GEMINI_TIMEOUT")
    raw = prompt_file.read_text(encoding="utf-8")
    if not raw.strip() or len(raw.encode("utf-8")) > 150_000:
        raise DispatchError("INVALID_GEMINI_PROMPT_SIZE")
    reject_secrets(raw)
    folder = state_home(root) / "gemini" / (task_id + "-" + str(time.time_ns()))
    folder.mkdir(parents=True, mode=0o700)
    prompt = HEADER + "작업 공간: " + str(root) + "\n\n" + raw
    argv = build_argv(root, prompt, seconds, folder / "native.log")
    status = "execution_unavailable"
    stdout = stderr = b""
    code = None
    try:
        proc = subprocess.Popen(argv, cwd=root, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, start_new_session=True)
        try:
            stdout, stderr = proc.communicate(timeout=seconds + 15)
            code = proc.returncode
            status = "process_exited" if code == 0 and stdout.strip() else "execution_failed_or_empty"
        except subprocess.TimeoutExpired:
            # Terminate only the process group created by this invocation.
            os.killpg(proc.pid, signal.SIGTERM)
            try: stdout, stderr = proc.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                stdout, stderr = proc.communicate()
            code = proc.returncode; status = "timed_out_partial_output"
    except OSError:
        status = "execution_unavailable"
    for filename, raw_output in (("stdout.md", stdout), ("stderr.log", stderr)):
        text = raw_output.decode("utf-8", errors="replace")
        try: reject_secrets(text)
        except JevError:
            text = "SENSITIVE_OUTPUT_REDACTED; inspect the source of the disclosure without reproducing the value\n"
            status = "sensitive_output_blocked"
        path = folder / filename; path.write_text(text, encoding="utf-8"); os.chmod(path, 0o600)
    # The CLI's native log is not echoed or copied to the parent/model. Keep local permissions tight.
    native = folder / "native.log"
    if native.exists():
        os.chmod(native, 0o600)
        try:
            reject_secrets(native.read_text(encoding="utf-8", errors="replace"))
        except JevError:
            native.write_text("SENSITIVE_NATIVE_LOG_REDACTED\n", encoding="utf-8")
            status = "sensitive_output_blocked"
    record = {"task_id": task_id, "model": MODEL, "workspace": str(root), "status": status,
              "exit_code": code, "stdout_path": str(folder / "stdout.md"), "stderr_path": str(folder / "stderr.log"),
              "prompt_sha256": digest(prompt.encode()), "completion": "validate_outputs_before_the_next_dependent_stage",
              "automatic_fallback": False}
    atomic_json(folder / "result.json", record)
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=".")
    parser.add_argument("--prompt-file", required=True)
    parser.add_argument("--task-id", required=True)
    parser.add_argument("--timeout", type=int, default=900)
    args = parser.parse_args()
    try:
        result = execute(repo_root(args.repo), Path(args.prompt_file).expanduser().resolve(), args.task_id, args.timeout)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["status"] == "process_exited" else 2
    except (DispatchError, JevError, OSError, ValueError) as error:
        msg = str(error) if isinstance(error, (DispatchError, JevError)) else "INVALID_INPUT_OR_LOCAL_IO"
        print(json.dumps({"status": "blocked", "error": msg}, ensure_ascii=False)); return 2


if __name__ == "__main__": raise SystemExit(main())
