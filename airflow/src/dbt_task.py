"""Tasks 2 & 3 — run dbt (build the snapshot table, then test it and the sports
marts). Shells out to the dbt CLI so the same models used everywhere else run
here unchanged; raises on non-zero exit so a failing quality gate stops the DAG."""
from __future__ import annotations

import re
import subprocess

from .config import dbt_dirs


def run_dbt(command: str, select: list[str] | None = None) -> dict:
    project_dir, profiles_dir = dbt_dirs()
    args = ["dbt", command, "--project-dir", project_dir, "--profiles-dir", profiles_dir]
    if select:
        args += ["--select", *select]

    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.stdout:
        print(proc.stdout)
    if proc.stderr:
        print(proc.stderr)
    if proc.returncode != 0:
        raise RuntimeError(f"dbt {command} failed (exit {proc.returncode})")

    passed = None
    m = re.search(r"PASS=(\d+)", proc.stdout or "")
    if m:
        passed = int(m.group(1))
    return {"command": command, "returncode": proc.returncode, "passed": passed}
