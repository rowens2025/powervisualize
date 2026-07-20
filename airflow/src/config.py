"""Shared config: resolve the Neon connection string and repo paths."""
from __future__ import annotations

import os
import re
import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]


def get_conn_str() -> str:
    """DATABASE_URL from the environment (CI / Airflow), falling back to the
    repo's .env.local for local development."""
    v = os.environ.get("DATABASE_URL")
    if v:
        return v
    env_file = REPO_ROOT / ".env.local"
    if env_file.exists():
        m = re.search(r"^DATABASE_URL=(.*)$", env_file.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    raise RuntimeError("DATABASE_URL is not set (env or .env.local)")


def dbt_dirs() -> tuple[str, str]:
    """(project_dir, profiles_dir) for dbt, overridable via env for CI."""
    project = os.environ.get("DBT_PROJECT_DIR", str(REPO_ROOT / "dbt" / "ryagent_warehouse"))
    profiles = os.environ.get("DBT_PROFILES_DIR", str(REPO_ROOT / "dbt"))
    return project, profiles
