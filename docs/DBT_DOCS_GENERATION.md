# Generating dbt Docs

This guide explains how to generate and update the dbt documentation hosted at `/dbt-docs/`.

## Quick Start

Run the npm script to generate and copy dbt docs:

```bash
npm run gen:dbt-docs
```

This script will:
1. Navigate to `dbt/ryagent_warehouse/`
2. Run `dbt docs generate` to create documentation
3. Delete the existing `/public/dbt-docs/` folder
4. Copy the generated docs from `dbt/ryagent_warehouse/target/` to `/public/dbt-docs/`

## Prerequisites

- dbt must be installed locally (not installed in Vercel build)
- dbt project must be configured with valid `profiles.yml` or environment variables
- Database connection must be accessible from your local machine

## Manual Steps (if script fails)

If the npm script doesn't work, you can run these commands manually:

```bash
# 1. Generate docs
cd dbt/ryagent_warehouse
dbt docs generate

# 2. Copy to public folder (from repo root)
cd ../..
rm -rf public/dbt-docs
cp -r dbt/ryagent_warehouse/target public/dbt-docs
```

## Viewing Docs

After generation, the docs will be available at:
- **Local dev**: `http://localhost:3000/dbt-docs/`
- **Production**: `https://www.powervisualize.com/dbt-docs/`

## When to Regenerate

Regenerate dbt docs when:
- New models are added
- Model schemas change
- Tests are added or modified
- Documentation in `schema.yml` files is updated

## Notes

- The docs are committed to the repo under `/public/dbt-docs/` so Vercel can serve them as static assets
- No database changes are made during doc generation (read-only operation)
- The lineage graph shows the full transformation pipeline from raw tables → staging → dims/facts → marts
