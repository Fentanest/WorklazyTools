#!/usr/bin/env python3
"""Prepare and run a separately ledgered next-day OpenDART collection.

Preparation is offline. --run enforces the Asia/Seoul calendar gate, then uses
the existing downloader and ZIP parser as day-directory snapshots. It makes no
provider request of its own and never reads or prints credentials.
"""
from __future__ import annotations

import argparse
import collections
import csv
import fcntl
import hashlib
import heapq
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

BASE = Path(__file__).resolve().parent
REPO = BASE.parents[2]
SOURCE = BASE.parent / "dart-fulltext-receipts"
SCRIPTS = ("download.py", "source_extract.py", "parse_api_worker.py")
KEYS = ("DART_API_KEY1", "DART_API_KEY2")


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    raw = path.read_bytes()
    if raw and not raw.endswith(b"\n"):
        raise ValueError(f"PARTIAL_JSONL:{path.name}")
    try:
        rows = [json.loads(line) for line in raw.splitlines() if line.strip()]
    except (ValueError, UnicodeError) as exc:
        raise ValueError(f"INVALID_JSONL:{path.name}") from exc
    if any(not isinstance(row, dict) for row in rows):
        raise ValueError(f"NONOBJECT_JSONL:{path.name}")
    return rows


def append(path: Path, row: dict) -> None:
    raw = json.dumps(row, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode() + b"\n"
    with path.open("ab") as stream:
        stream.write(raw); stream.flush(); os.fsync(stream.fileno())


def append_many(path: Path, rows: list[dict]) -> None:
    if not rows:
        return
    with path.open("ab") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode() + b"\n")
        stream.flush(); os.fsync(stream.fileno())


def write_jsonl(path: Path, rows: list[dict]) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("wb") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode() + b"\n")
    os.replace(temporary, path)


def kind(name: str) -> str:
    while re.match(r"^\[[^]]+\]\s*", name):
        name = re.sub(r"^\[[^]]+\]\s*", "", name)
    name = re.sub(r"\s*\(\d{4}[^)]*\)", "", name).strip()
    return name.split(" ")[0]


def _existing_ids(base: Path, next_day: Path) -> set[str]:
    known = set()
    for directory in sorted(base.parent.glob("dart-api-ledger-*")):
        if directory == next_day or not directory.is_dir():
            continue
        requests = read_jsonl(directory / "api-requests.jsonl")
        identity = lambda r: (r.get("rcept_no"), r.get("key_slot"), r.get("started_at"))
        maintenance = {identity(r) for r in requests
                       if str(r.get("api_status")) == "800" and r.get("status") == 200
                       and r.get("zip_received") is False}
        # A queued target is not a completed or attempted download. Carry it
        # forward if an earlier day stopped before reserving its request.
        for filename in ("api-reservations.jsonl", "api-requests.jsonl", "corpus.jsonl"):
            for row in read_jsonl(directory / filename):
                if filename != "corpus.jsonl" and identity(row) in maintenance:
                    continue
                rid = row.get("rcept_no")
                if isinstance(rid, str):
                    known.add(rid)
    return known


def _originals(source: Path) -> tuple[dict[str, dict], dict[str, str]]:
    originals, hashes = {}, {}
    for filename, label in (("confirmed_equity_receipts.csv", "confirmed"),
                            ("excluded_noise_receipts.csv", "excluded")):
        path = source / filename
        hashes[filename] = digest(path.read_bytes())
        with path.open(newline="", encoding="utf-8") as stream:
            for row in csv.DictReader(stream):
                rid = row["rcept_no"]
                if rid in originals:
                    raise ValueError("DUPLICATE_ORIGINAL_RECEIPT")
                originals[rid] = dict(row, original_list=label)
    return originals, hashes


def _allocate(groups: dict[str, list[dict]], slots: int, seed: str) -> list[dict]:
    population = sum(len(rows) for rows in groups.values())
    slots = min(slots, population)
    if not slots:
        return []
    counts = {name: slots * len(rows) // population for name, rows in groups.items()}
    remainder = slots - sum(counts.values())
    order = sorted(groups, key=lambda name: (-(slots * len(groups[name]) % population), name))
    for name in order[:remainder]:
        counts[name] += 1
    selected = []
    for name, group in groups.items():
        strata = collections.defaultdict(list)
        for row in group:
            strata[(row["filing_date"][:4], row["original_list"])].append(row)
        n = counts[name]
        parts = {key: n * len(rows) // len(group) for key, rows in strata.items()}
        for key in sorted(strata, key=lambda key: (-(n * len(strata[key]) % len(group)), key))[:n - sum(parts.values())]:
            parts[key] += 1
        for key, rows in strata.items():
            rows.sort(key=lambda row: digest((seed + row["rcept_no"]).encode()))
            selected.extend(rows[:parts[key]])
    by_kind = collections.defaultdict(list)
    for row in selected:
        by_kind[kind(row["report_name"])].append(row)
    heap = []
    for name, rows in by_kind.items():
        rows.sort(key=lambda row: digest((seed + "queue" + row["rcept_no"]).encode()))
        heapq.heappush(heap, (1 / len(rows), name, 0))
    ordered = []
    while heap:
        _, name, index = heapq.heappop(heap)
        ordered.append(by_kind[name][index])
        if index + 1 < len(by_kind[name]):
            heapq.heappush(heap, ((index + 2) / len(by_kind[name]), name, index + 1))
    return ordered


def _target(row: dict, slot: str) -> dict:
    return {"rcept_no": row["rcept_no"], "disclosure_company": row["company_name"],
            "filing_date": row["filing_date"], "report_name": row["report_name"],
            "report_kind": kind(row["report_name"]), "filer_name": row["filer_name"],
            "report_url": row["report_url"], "collection_source": "opendart_api", "key_slot": slot}


# 2026-10-05 사용자 지시: 키당 하루 10회는 수집에 쓰지 않고 남긴다(회사코드 목록 등 별도 API 호출용).
RESERVED_PER_KEY = 10
DAILY_SLOTS = 2 * (20000 - RESERVED_PER_KEY)


def prepare_next_day(base: Path, day: str, slots: int = DAILY_SLOTS) -> dict:
    base = Path(base).resolve()
    day_value = date.fromisoformat(day)
    if day_value <= date(2026, 10, 4):
        raise ValueError("NEXT_DAY_MUST_FOLLOW_2026_10_04")
    if slots < 2 or slots > 40000 or slots % 2:
        raise ValueError("SLOTS_MUST_BE_EVEN_AND_AT_MOST_40000")
    directory = base.parent / f"dart-api-ledger-{day_value:%Y%m%d}"
    manifest_path = directory / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        # 이미 준비된 날은 당시 계획(할당 수)을 그대로 쓴다. 날짜만 대조한다.
        if manifest.get("collection_date_kst") != day:
            raise ValueError("EXISTING_DAY_MANIFEST_MISMATCH")
        return dict(manifest, directory=str(directory))
    originals, hashes = _originals(base.parent / "dart-fulltext-receipts")
    known = _existing_ids(base, directory)
    groups = collections.defaultdict(list)
    for rid, row in originals.items():
        if rid not in known:
            groups[kind(row["report_name"])].append(row)
    ordered = _allocate(groups, slots, f"api-ledger-{day_value:%Y%m%d}-v1")
    queue = [_target(row, KEYS[index % 2]) for index, row in enumerate(ordered)]
    planned = min(slots, sum(map(len, groups.values())))
    if len(queue) != planned or len({row["rcept_no"] for row in queue}) != planned:
        raise ValueError("ALLOCATION_COUNT_OR_DUPLICATE_ERROR")
    directory.mkdir(parents=True, exist_ok=True)
    for filename in SCRIPTS:
        shutil.copy2(base / filename, directory / filename)
    write_jsonl(directory / "targets.jsonl", queue)
    write_jsonl(directory / "api-queue.jsonl", queue)
    write_jsonl(directory / "gemini-labels.jsonl", ordered)
    old_failures = []
    for old_dir in sorted(base.parent.glob("dart-api-ledger-*")):
        if old_dir == directory:
            continue
        old_failures.extend(row for row in read_jsonl(old_dir / "download-failures.jsonl")
                            if str(row.get("api_status")) == "014")
    fallback = [{"rcept_no": row["rcept_no"], "api_status": "014", "source": "prior_download_failure",
                 "report_url": originals.get(row["rcept_no"], {}).get("report_url")}
                for row in old_failures]
    write_jsonl(directory / "web-fallback-queue.jsonl", fallback)
    manifest = {"target_receipts": len(queue), "existing_web_receipts": 0, "existing_web_documents": 0,
                "new_api_receipts_planned": len(queue), "api_request_budget_per_key": slots // 2,
                "key_budget_includes_pilot_calls": False, "keys_distinct_checked": False,
                "source_population": len(originals), "eligible_population": sum(map(len, groups.values())),
                "excluded_prior_receipts": len(known & originals.keys()), "collection_date_kst": day,
                "input_sha256": hashes, "sampling": "proportional by actual report kind and year/original-list within kind; largest remainder; SHA256 selection; labels blinded",
                "report_kind_allocations": dict(collections.Counter(row["report_kind"] for row in queue)),
                "source_kind_population": dict(collections.Counter(kind(row["report_name"]) for row in originals.values())),
                "prior_api_014_web_fallback": len(fallback),
                "runner_scripts_sha256": {filename: digest((directory / filename).read_bytes()) for filename in SCRIPTS}}
    temporary = manifest_path.with_suffix(".tmp")
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    os.replace(temporary, manifest_path)
    return dict(manifest, directory=str(directory))


def sync_day(base: Path, day: str) -> dict:
    base = Path(base).resolve()
    directory = base.parent / f"dart-api-ledger-{date.fromisoformat(day):%Y%m%d}"
    if not (directory / "manifest.json").is_file():
        raise ValueError("DAY_NOT_PREPARED")
    copied = {"corpus": 0, "gemini_labels": 0}
    with (base / "canonical-corpus.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for filename, key, output_key in (("corpus.jsonl", "rcept_no", "corpus"),
                                          ("gemini-labels.jsonl", "rcept_no", "gemini_labels")):
            marker = directory / "gemini-labels-synced.json"
            if output_key == "gemini_labels" and marker.exists():
                continue
            old = {row[key] for row in read_jsonl(base / filename)}
            fresh = []
            for row in read_jsonl(directory / filename):
                if row[key] not in old:
                    fresh.append(row)
                    old.add(row[key])
            append_many(base / filename, fresh)
            copied[output_key] = len(fresh)
            if output_key == "gemini_labels":
                temporary = marker.with_suffix(".tmp")
                temporary.write_text(json.dumps({"source_sha256": digest((directory / filename).read_bytes()),
                                                 "added": len(fresh)}, ensure_ascii=False) + "\n")
                os.replace(temporary, marker)
    return copied


def run_day(base: Path, day: str, interval: float = 2.0) -> dict:
    if datetime.now(ZoneInfo("Asia/Seoul")).date() < date.fromisoformat(day):
        raise ValueError("BEFORE_KST_COLLECTION_DATE")
    manifest = prepare_next_day(base, day)
    directory = Path(manifest["directory"])
    if not manifest["new_api_receipts_planned"]:
        return {"download_exit_code": 0, "day": day, "queue": 0, "completed": 0,
                "parse_pending": 0, "parse_unresolved": 0, "attempted_receipts": 0,
                "unattempted_receipts": 0, "download_stopped": False, "disabled_keys": {}}
    # No credentials are read here. The existing downloader owns quota,
    # reservation, HTTP and credential handling in this separate day ledger.
    command = [sys.executable, str(directory / "download.py"), "--defer-parse", "--interval", "0.08",
               "--max-per-minute", "780", "--max-per-key", str(manifest["api_request_budget_per_key"])]
    with (directory / "daily-run.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with (directory / "download.log").open("ab") as output, (directory / "parse.log").open("ab") as parse_log:
            downloader = subprocess.Popen(command, cwd=REPO, stdout=output, stderr=output)
            try:
                while downloader.poll() is None:
                    subprocess.run([sys.executable, str(directory / "parse_api_worker.py"), "--directory", str(directory),
                                    "--workers", "4", "--batch-size", "500"], cwd=REPO,
                                   stdout=parse_log, stderr=parse_log, check=True)
                    sync_day(base, day)
                    time.sleep(interval)
                while True:
                    subprocess.run([sys.executable, str(directory / "parse_api_worker.py"), "--directory", str(directory),
                                    "--workers", "4", "--batch-size", "500"], cwd=REPO,
                                   stdout=parse_log, stderr=parse_log, check=True)
                    sync_day(base, day)
                    state = json.loads((directory / "parse-progress.json").read_text())
                    if not state.get("pending"):
                        break
            finally:
                if downloader.poll() is None:
                    downloader.send_signal(signal.SIGTERM)
                downloader.wait()
            attempts = {row["rcept_no"] for row in read_jsonl(directory / "api-reservations.jsonl")}
            download_progress = json.loads((directory / "download-progress.json").read_text())
            return {"download_exit_code": downloader.returncode, "day": day,
                    "queue": state.get("queue"), "completed": state.get("completed"),
                    "parse_pending": state.get("pending"), "parse_unresolved": state.get("unresolved"),
                    "attempted_receipts": len(attempts),
                    "unattempted_receipts": manifest["new_api_receipts_planned"] - len(attempts),
                    "download_stopped": download_progress.get("stopped"),
                    "disabled_keys": download_progress.get("disabled_keys")}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, default=BASE)
    parser.add_argument("--date", required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--prepare-only", action="store_true")
    mode.add_argument("--sync", action="store_true")
    mode.add_argument("--run", action="store_true")
    args = parser.parse_args()
    if args.prepare_only:
        result = prepare_next_day(args.base, args.date)
    elif args.sync:
        result = sync_day(args.base, args.date)
    else:
        result = run_day(args.base, args.date)
    print(json.dumps({k: value for k, value in result.items() if k not in
                      ("report_kind_allocations", "source_kind_population", "input_sha256")}, ensure_ascii=False))
    return 1 if args.run and (result.get("download_exit_code") != 0 or result.get("unattempted_receipts")
                               or result.get("parse_unresolved")) else 0


if __name__ == "__main__":
    raise SystemExit(main())
