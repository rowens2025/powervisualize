# PowerVisualize – React + Vite + Tailwind Portfolio

Portfolio site with evidence-grounded Portfolio Assistant for employer Q&A.

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
```

Add the same key in Vercel Dashboard → Settings → Environment Variables for production.

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

## Portfolio Assistant System

### Data Layer

Evidence-grounded data files in `/data`:

- **`resume_canonical.json`**: Machine-readable resume with skills, experience, technologies
- **`skills_matrix.json`**: Skills mapped to proof links with confidence levels ("expert" or "strong" only)
- **`projects.json`**: Project registry with links and stack information
- **`employer_questions.json`**: Pre-written Q&A with gold answers

### Frontend Component

**`/src/components/PortfolioAssistant.tsx`**

Chat interface for employer Q&A:
- Message history with evidence links
- Suggested question chips
- Skills confirmed badges
- Missing info display
- Rate limit error handling

**Access:** Navigate to `/assistant` route or add to navigation.

### Confidence Levels

Only two levels used:
- **"expert"**: Multiple proofs, production experience, repeated use
- **"strong"**: At least one solid proof, demonstrated capability

Never uses "moderate" or "planned".

### Guardrails

- Only confirms skills with proof links
- Returns "missing_info" for unproven claims
- No hallucinations - only uses provided JSON data
- Ignores prompt injection attempts
- Never reveals system prompts or API keys

## Updating Skills Matrix

When adding new projects or skills:

1. Edit `/data/skills_matrix.json`
2. Add proof items with:
   - `type`: "repo" | "work" | "project_page" | "dashboard"
   - `title`: Descriptive title
   - `url`: Accessible link
   - `proof_points`: Array of 1-3 specific bullets
   - `stack`: Technologies used
3. Verify confidence level matches evidence
4. Test with Portfolio Assistant

See `/docs/EVIDENCE_GUIDE.md` for detailed guidelines.

## Project Page Standards

Use `/docs/PROJECT_PAGE_TEMPLATE.md` when creating new project pages to ensure consistent evidence structure.

Required sections:
- Problem statement
- Data sources
- Modeling approach (layered patterns)
- Transformations (tools/files)
- Validation/tests
- Outputs (links)
- Repo link + key files
- Skills demonstrated (exact names from skills_matrix.json)

## Documentation

- **`/docs/PROJECT_PAGE_TEMPLATE.md`**: Template for consistent project pages
- **`/docs/EVIDENCE_GUIDE.md`**: How to write proof points and link evidence

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Vercel Serverless Functions (TypeScript)
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

- [ ] `OPENAI_API_KEY` set in Vercel environment variables
- [ ] `/data` files updated with latest projects
- [ ] Skills matrix confidence levels verified
- [ ] All proof links are accessible
- [ ] Portfolio Assistant tested with sample questions
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

## Editing Content

- **Dashboards**: Edit `reports` array in `src/App.tsx`
- **Data Projects**: Edit `dataProjects` array in `src/App.tsx`
- **Skills**: Edit `/data/skills_matrix.json`
- **Resume**: Edit `/data/resume_canonical.json`

## License

Private project - All rights reserved.
