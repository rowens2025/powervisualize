# Evidence Guide

How to write proof points, link evidence, and keep claims honest for the Portfolio Assistant system.

## Core Principles

1. **Evidence-First:** Every skill claim must have at least one proof link
2. **No Hallucinations:** Only claim what you can prove
3. **Receipts-First:** Lead with evidence, then explain
4. **Confidence Levels:** Use only "expert" or "strong" (never "moderate" or "planned")

## Writing Proof Points

### Format
- Use bullet points (1-3 per proof item)
- Start with action verb
- Be specific about what was done
- Reference technologies/tools used

### Good Examples

✅ **Good:**
```
- Built production Power BI platform with RLS/OLS automation via PowerShell + XMLA/REST
- Implemented CI/CD workflows using PBIP + Azure DevOps pipelines
- Created semantic models with governance and capacity awareness
```

✅ **Good:**
```
- Developed A/B testing pipeline producing Power BI-friendly CSV outputs
- Implemented frequentist and Bayesian statistical metrics
- Automated workflow with GitHub Actions
```

❌ **Bad (too vague):**
```
- Worked with Power BI
- Did some data stuff
- Used Python sometimes
```

❌ **Bad (no proof):**
```
- Expert in dbt (but no repo or work evidence)
- Strong Kubernetes skills (but never used it)
```

## Linking Dashboards

### Power BI Dashboards
- Use embed links or public report URLs
- If private, use screenshots + description
- Mention specific features (DAX measures, custom visuals, etc.)

**Format:**
```json
{
  "type": "dashboard",
  "title": "Sales Performance Dashboard",
  "url": "https://app.powerbi.com/view?r=...",
  "proof_points": [
    "Complex DAX measures for time intelligence",
    "Custom Deneb visualizations",
    "RLS implementation for multi-tenant access"
  ]
}
```

### React/Web Dashboards
- Link to live demo if available
- Include GitHub repo link
- Mention key features (interactivity, data visualization, etc.)

**Format:**
```json
{
  "type": "project_page",
  "title": "NYC Flood Risk Dashboard",
  "url": "https://www.powervisualize.com/data-projects",
  "proof_points": [
    "Interactive map with PMTiles vector data",
    "Real-time KPI calculations",
    "Responsive design with Tailwind CSS"
  ]
}
```

## Linking Repositories

### Requirements
- Repository must be public (or provide access instructions)
- README should explain the project
- Key files should be documented
- Code should be reasonably clean (not required to be perfect)

### Format
```json
{
  "type": "repo",
  "title": "A/B Testing Pipeline",
  "url": "https://github.com/rowens2025/AB_Analytics",
  "proof_points": [
    "Production pipeline with frequentist metrics",
    "Bayesian statistical analysis implementation",
    "GitHub Actions workflow for automation"
  ],
  "stack": ["Python", "Statistics", "CI/CD"]
}
```

### What to Include
- Main language/framework
- Key libraries or tools used
- Notable patterns or techniques
- Any automation (CI/CD, scripts, etc.)

## Linking Work Experience

### When to Use
- For skills demonstrated in production work (not just repos)
- When work is confidential but you can describe it generally
- For skills that span multiple projects

### Format
```json
{
  "type": "work",
  "title": "Production Power BI Platform",
  "url": "https://www.powervisualize.com",
  "proof_points": [
    "Built multiple production Power BI platforms",
    "Implemented RLS/OLS automation",
    "Established CI/CD workflows"
  ],
  "stack": ["Power BI", "Azure DevOps", "PowerShell"]
}
```

### Guidelines
- Be specific about what was built
- Mention scale/complexity if relevant
- Reference technologies used
- Don't reveal confidential details

## Confidence Level Rules

### "Expert"
Use when:
- Multiple proofs exist (work + repos + projects)
- Production experience demonstrated
- Repeated use across projects
- Advanced patterns/techniques shown

**Example:**
- Power BI: Multiple dashboards + production platforms + CI/CD = Expert
- Python: Multiple repos + production pipelines + geospatial work = Expert

### "Strong"
Use when:
- At least one solid proof exists
- Demonstrated capability (even if not repeated)
- Credible evidence (repo or work)
- Would have been "moderate" or "planned" → upgrade to "strong"

**Example:**
- R: One repo with statistical modeling = Strong
- Geospatial Analytics: One project with GeoPandas = Strong
- React: Portfolio site + serverless functions = Strong

### Never Use
- "Moderate" → Use "strong" instead
- "Planned" → Use "strong" if you have any proof, otherwise don't include
- "Beginner" → Don't include in skills matrix
- "Learning" → Don't include until you have proof

## Keeping Claims Honest

### Red Flags to Avoid
1. **Claiming skills without proof**
   - ❌ "Expert in Kubernetes" (but no repos or work)
   - ✅ "Strong in React" (portfolio site proves it)

2. **Overstating confidence**
   - ❌ "Expert in R" (one repo = strong, not expert)
   - ✅ "Strong in R" (one repo with good code)

3. **Vague proof points**
   - ❌ "Worked with data"
   - ✅ "Built ETL pipeline using Azure Data Factory"

4. **Missing links**
   - ❌ Proof point without URL
   - ✅ Proof point with GitHub/dashboard link

### Self-Check Questions
Before adding a skill to skills_matrix.json:

1. Can I point to at least one proof link?
2. Is the proof link accessible (public repo, live demo, or work description)?
3. Does the proof actually demonstrate this skill?
4. Is my confidence level justified?
5. Would a recruiter believe this claim?

## Updating Skills Matrix

### When to Update
- New project goes live → Add proof links
- New skill demonstrated → Add new skill entry
- New repo created → Link to relevant skills
- Work experience gained → Add work proof items

### How to Update
1. Edit `data/skills_matrix.json`
2. Add proof item with required fields:
   - `type`: "repo" | "work" | "project_page" | "dashboard"
   - `title`: Descriptive title
   - `url`: Accessible link
   - `proof_points`: Array of 1-3 specific bullets
   - `stack`: Array of technologies used
   - `tags`: Optional array of tags

3. Verify confidence level matches evidence
4. Test with Portfolio Assistant

## Example: Complete Proof Item

```json
{
  "skill": "Python",
  "aliases": ["Python", "ETL", "notebooks"],
  "confidence": "expert",
  "summary": "Expert Python developer for ETL, data analysis, and geospatial analytics.",
  "proof": [
    {
      "type": "repo",
      "title": "A/B Testing Pipeline",
      "url": "https://github.com/rowens2025/AB_Analytics",
      "proof_points": [
        "Production A/B testing pipeline with statistical analysis",
        "Power BI-friendly CSV outputs",
        "GitHub Actions workflow"
      ],
      "stack": ["Python", "Statistics", "CI/CD"],
      "tags": ["testing", "analytics"]
    },
    {
      "type": "repo",
      "title": "NYC Flood Zone Analysis",
      "url": "https://github.com/rowens2025/nyc-flood-zones",
      "proof_points": [
        "Geospatial analysis with GeoPandas",
        "Spatial joins and polygon operations",
        "PMTiles optimization"
      ],
      "stack": ["Python", "GeoPandas", "Folium"],
      "tags": ["geospatial"]
    }
  ]
}
```

## Best Practices

1. **Be Specific:** "Built ETL pipeline" → "Built ETL pipeline using Azure Data Factory with medallion architecture"
2. **Show Impact:** "Created dashboard" → "Created production dashboard serving 100+ users with RLS"
3. **Link Everything:** Every proof point should have a URL
4. **Update Regularly:** Add new projects as they go live
5. **Test Claims:** Use Portfolio Assistant to verify your skills matrix works

## Common Mistakes

1. **Forgetting URLs:** Every proof item needs a URL
2. **Vague Proof Points:** "Used Python" → "Built A/B testing pipeline with Python"
3. **Wrong Confidence:** One repo ≠ expert (use "strong")
4. **Missing Aliases:** "Power BI" should alias "DAX", "M", "PBIP"
5. **No Stack Info:** Include technologies used in each proof item

Remember: The Portfolio Assistant is only as good as your evidence. Keep it honest, keep it updated, keep it linked.
