// Generate cube/.env from the DATABASE_URL in .env.local (Neon portfolio DB).
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
if (!line) throw new Error('DATABASE_URL not found in .env.local');
const url = new URL(line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, ''));

const out = [
  'CUBEJS_DEV_MODE=true',
  'CUBEJS_DB_TYPE=postgres',
  `CUBEJS_DB_HOST=${url.hostname}`,
  `CUBEJS_DB_PORT=${url.port || '5432'}`,
  `CUBEJS_DB_NAME=${url.pathname.slice(1).split('?')[0] || 'neondb'}`,
  `CUBEJS_DB_USER=${decodeURIComponent(url.username)}`,
  `CUBEJS_DB_PASS=${decodeURIComponent(url.password)}`,
  'CUBEJS_DB_SSL=true',
  `CUBEJS_API_SECRET=${randomBytes(32).toString('hex')}`,
  '',
].join('\n');

writeFileSync(new URL('../cube/.env', import.meta.url), out);
console.log('Wrote cube/.env for host', url.hostname);
