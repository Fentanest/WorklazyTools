#!/usr/bin/env python3
"""Run one bounded search lane and expose only its classified transport result."""
import json
import os
import subprocess
import sys


def main() -> int:
    result = subprocess.run([sys.executable, "scripts/foliotrace/folio.py", "scan-secondary", *sys.argv[1:]],
                            text=True, capture_output=True, check=False)
    # scan-secondary emits bounded JSON codes and never includes the API key or URL.
    for stream in (result.stdout, result.stderr):
        if stream:
            print(stream.rstrip())
    transport = False
    for line in result.stderr.splitlines():
        try:
            transport |= json.loads(line).get("code") == "SEARCH_TRANSPORT"
        except (json.JSONDecodeError, AttributeError):
            continue
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as handle:
            handle.write(f"site_transport={'true' if transport else 'false'}\n")
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
