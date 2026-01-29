# PowerVisualize

Portfolio site with evidence-grounded AI assistant powered by dbt (data build tool) marts and analytics engineering.

## Quickstart

```bash
npm install
npm run dev
```

**Important:** For local development with API routes, use Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

This runs both the Vite app and serverless API functions locally.

## Environment Variables

Create `.env.local` (already in `.gitignore`):

```
OPENAI_API_KEY=sk-your-key-here
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

Add both keys in Vercel Dashboard → Settings → Environment Variables for production.

## Deploy to Vercel

- Import repo → Deploy (Vite detected)
- Build: `npm run build` → Output: `dist`
- API routes in `/api` are automatically deployed as serverless functions

## API Endpoints

### GET `/api/openai-smoke`
Smoke test endpoint to verify OpenAI API key works.

**Response:**
```json
{
  "ok": true,
  "message": "Hello, smoke test successful!",
  "model": "gpt-3.5-turbo-..."
}
```

### POST `/api/ask`
Portfolio Assistant endpoint for evidence-grounded Q&A.

**Request:**
```json
{
  "question": "Does Ryan have Power BI experience?",
  "history": [] // optional conversation history
}
```

**Response:**
```json
{
  "answer": "Yes, Ryan is an expert...",
  "skills_confirmed": ["Power BI", "DAX"],
  "evidence_links": [
    {"title": "Power BI Dashboards", "url": "https://..."}
  ],
  "missing_info": []
}
```

**Rate Limits:**
- 20 requests per 10 minutes per IP
- Returns `429` with `Retry-After: 600` when exceeded

**Validation:**
- Question required, max 800 characters
- Returns `400` for invalid input

## RyAgent: Database-Driven Portfolio Assistant

RyAgent is an evidence-grounded AI assistant powered by dbt (data build tool) marts. The assistant's responses are dynamically generated from dbt marts (`analytics.mart_project_profile`, `analytics.fct_project_skills`) that determine which projects to surface, which skills to confirm, and what evidence to cite—demonstrating dbt's semantic layer concept in production.

### Architecture

- **Primary Data Source**: Neon Postgres with dbt marts (project profiles, skill mappings, page relationships)
- **Retrieval**: Skill-first matching with trigram search and alias expansion
- **Fallback**: JSON-based evidence files when DB mappings are incomplete
- **Response Generation**: OpenAI GPT-4o-mini with strict guardrails against hallucination

### Features

- Real-time project and skill matching from database queries
- Evidence links sourced from project pages and dashboards
- Trace narration showing actual search results
- Dynamic fallback to resume-based evidence when DB mappings are incomplete

## Data Management

Portfolio data is managed through dbt (data build tool) marts in Neon Postgres. The system uses structured project profiles, skill mappings, and page relationships built with dbt to drive evidence-grounded responses. JSON fallback files (`/data`) are maintained for resilience during development and migration.

## Documentation

Project documentation and evidence standards are maintained in `/docs`.

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Vercel Serverless Functions (TypeScript)
- **Database**: Neon Postgres with dbt marts
- **AI**: OpenAI GPT-4o-mini
- **Analytics**: Vercel Analytics
- **Deployment**: Vercel

## Safety & Rate Limiting

- Rate limiting: 20 requests / 10 minutes / IP
- Input validation: Question max 800 chars
- Error handling: No stack traces exposed to client
- JSON parsing: Robust fallbacks for malformed responses
- Environment detection: Works locally and in production

## Local Development

**With API routes:**
```bash
vercel dev
```
Access at `http://localhost:3000`

**Frontend only:**
```bash
npm run dev
```
Access at `http://localhost:5173` (API routes won't work)

## Production Checklist

- [ ] `OPENAI_API_KEY` and `DATABASE_URL` set in Vercel environment variables
- [ ] dbt marts deployed and indexed (trigram indexes for fuzzy matching)
- [ ] All proof links are accessible
- [ ] RyAgent tested with sample questions
- [ ] Rate limiting tested

## File Structure

```
/
├── api/
│   ├── openai-smoke.ts    # Smoke test endpoint
│   └── ask.ts             # Portfolio Assistant API
├── data/
│   ├── resume_canonical.json
│   ├── skills_matrix.json
│   ├── projects.json
│   └── employer_questions.json
├── docs/
│   ├── PROJECT_PAGE_TEMPLATE.md
│   └── EVIDENCE_GUIDE.md
├── src/
│   ├── components/
│   │   └── PortfolioAssistant.tsx
│   └── App.tsx
└── README.md
```

## Content Management

Portfolio content is managed through structured data models. Projects, skills, and evidence relationships are maintained in dbt marts for consistency and real-time retrieval.

## License

Private project - All rights reserved.
