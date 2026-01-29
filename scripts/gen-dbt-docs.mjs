import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const publicDbtDocs = path.join(repoRoot, 'public', 'dbt-docs');
const targetDir = path.join(repoRoot, 'dbt', 'ryagent_warehouse', 'target');

// Delete existing public/dbt-docs
if (fs.existsSync(publicDbtDocs)) {
  fs.rmSync(publicDbtDocs, { recursive: true, force: true });
  console.log('🗑️  Deleted existing /public/dbt-docs/');
}

// Check if target directory exists
if (!fs.existsSync(targetDir)) {
  console.error('❌ dbt target directory not found. Run "dbt docs generate" first in dbt/ryagent_warehouse/');
  process.exit(1);
}

// Copy target to public/dbt-docs
fs.cpSync(targetDir, publicDbtDocs, { recursive: true });
console.log('✅ dbt docs copied to /public/dbt-docs/');
console.log('📖 Docs available at: http://localhost:3000/dbt-docs/');
