"""Write dbt/profiles.yml from the DATABASE_URL env var, for CI.

Local dev uses the hand-maintained (gitignored) dbt/profiles.yml; CI has no such
file, so this reconstructs it from the DATABASE_URL secret. Mirrors the local
profile exactly: profile `ryagent_warehouse`, target `dev`, schema `analytics`.
"""
from __future__ import annotations

import os
import pathlib
import urllib.parse


def render(url: str) -> str:
    u = urllib.parse.urlparse(url)
    return (
        "ryagent_warehouse:\n"
        "  target: dev\n"
        "  outputs:\n"
        "    dev:\n"
        "      type: postgres\n"
        f'      host: "{u.hostname}"\n'
        f'      user: "{urllib.parse.unquote(u.username or "")}"\n'
        f'      password: "{urllib.parse.unquote(u.password or "")}"\n'
        f"      port: {u.port or 5432}\n"
        f'      dbname: "{(u.path or "/").lstrip("/")}"\n'
        "      schema: analytics\n"
        "      threads: 4\n"
        "      sslmode: require\n"
    )


def main() -> None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is not set")
    out = pathlib.Path(__file__).resolve().parents[2] / "dbt" / "profiles.yml"
    out.write_text(render(url), encoding="utf-8")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
