# Project Page Template

This template ensures consistent evidence structure for portfolio projects, enabling the Portfolio Assistant to provide accurate, evidence-grounded answers.

## Required Sections

### 1. Problem Statement
**Purpose:** Context for why the project exists

**Format:**
- 2-3 sentences describing the business problem or analytical question
- Clear, recruiter-friendly language

**Example:**
```
This project addresses the need to understand flood risk at both building and neighborhood levels in NYC. By merging FEMA flood zones, building footprints, and neighborhood boundaries, we can identify which buildings are most vulnerable and which neighborhoods need targeted mitigation strategies.
```

### 2. Data Sources
**Purpose:** Prove data engineering capability

**Format:**
- List each data source with format/type
- Mention any data quality challenges addressed

**Example:**
```
- FEMA Flood Zones (GeoJSON, ~50MB)
- NYC Building Footprints (Shapefile, ~200MB)
- Neighborhood Tabulation Areas (GeoJSON, ~5MB)
- All sources required coordinate system transformations (WGS84)
```

### 3. Modeling Approach
**Purpose:** Demonstrate layered/dbt-style discipline

**Format:**
- Describe transformation layers (bronze/silver/gold or equivalent)
- Mention any canonical layer or star schema design
- Reference specific patterns (CDC Type 2, medallion architecture, etc.)

**Example:**
```
Applied medallion architecture:
- Bronze: Raw spatial data ingestion
- Silver: Coordinate system standardization, geometry validation
- Gold: Polygon joins, enrichment, final analytical dataset

Used canonical layer pattern for consistent access across downstream consumers.
```

### 4. Transformations
**Purpose:** Show technical implementation

**Format:**
- List specific transformations (Python functions, SQL queries, etc.)
- Mention tools/languages used
- Reference specific files in repo if applicable

**Example:**
```
- Python (GeoPandas): Spatial joins using `sjoin()` for polygon intersections
- Python: Geometry validation and repair using `shapely`
- SQL: Aggregations for neighborhood-level statistics
- PMTiles: Vector tile optimization for web delivery
```

### 5. Validation/Tests
**Purpose:** Prove quality and rigor

**Format:**
- Describe sanity checks performed
- Mention any statistical significance tests (for A/B testing projects)
- Reference data quality validations

**Example:**
```
- Validated join results: 100% of buildings assigned to flood zones
- Sanity check: Total building count matches source data
- Geometry validation: All polygons valid and non-self-intersecting
- For A/B tests: Calculated p-values and Bayesian posterior probabilities
```

### 6. Outputs
**Purpose:** Show deliverables and impact

**Format:**
- Link to Power BI dashboard (if applicable)
- Screenshots or preview images
- CSV outputs, notebooks, or other artifacts
- Live demo links

**Example:**
```
- Interactive React dashboard: [Link to live demo]
- Power BI dashboard: [Embed link or screenshot]
- PMTiles hosted on: [CDN URL]
- Analysis notebook: [GitHub link]
```

### 7. Repo Link + Relevant Files
**Purpose:** Enable code review

**Format:**
- GitHub repository URL
- List key files with brief descriptions
- Highlight notable patterns or techniques

**Example:**
```
Repository: https://github.com/rowens2025/nyc-flood-risk

Key files:
- `notebooks/spatial_joins.ipynb`: Main analysis with GeoPandas joins
- `scripts/optimize_pmtiles.py`: PMTiles conversion script
- `README.md`: Setup and usage instructions
```

### 8. Skills Demonstrated
**Purpose:** Map to skills_matrix.json

**Format:**
- Use EXACT skill names from skills_matrix.json
- List 3-8 relevant skills
- Be honest - only include skills actually used

**Example:**
```
Skills demonstrated:
- Python
- Geospatial Analytics
- Data Engineering
- React (for dashboard)
- PMTiles
```

## Template Checklist

Before publishing a project page, verify:

- [ ] Problem statement is clear and recruiter-friendly
- [ ] Data sources are listed with formats
- [ ] Modeling approach mentions specific patterns (medallion, star schema, etc.)
- [ ] Transformations reference specific tools/files
- [ ] Validation/tests are described
- [ ] Outputs include links (dashboards, repos, demos)
- [ ] Repo link is provided with key files listed
- [ ] Skills list uses exact names from skills_matrix.json
- [ ] All claims are backed by evidence (repo, dashboard, or work experience)

## Example Structure

```markdown
# Project Title

## Problem Statement
[2-3 sentences]

## Data Sources
- Source 1 (format, size)
- Source 2 (format, size)

## Modeling Approach
[Describe layers, patterns, architecture]

## Transformations
- Tool/Language: Specific transformation
- Reference: File path or query

## Validation/Tests
- Check 1: Result
- Check 2: Result

## Outputs
- [Link] Dashboard
- [Link] Repository
- [Screenshot] Preview

## Repository
[GitHub URL]

Key files:
- `file1.py`: Description
- `file2.sql`: Description

## Skills Demonstrated
- Skill 1 (exact name from skills_matrix.json)
- Skill 2
- Skill 3
```

## Notes

- Keep language professional but accessible
- Prioritize evidence over claims
- Update skills_matrix.json when adding new projects
- Link to live demos whenever possible
- Include code snippets for complex transformations (optional)
