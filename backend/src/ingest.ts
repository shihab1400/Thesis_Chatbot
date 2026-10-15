/**
 * Builds the search index.  Run:  npm run ingest
 * Reads  data/laws.jsonl  ->  writes  data/index.json
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { embedTexts } from './chat/embeddings';

dotenv.config();

const DIR = process.env.DATA_DIR ?? 'data';
const BATCH = 8;

async function main() {
  const file = path.join(DIR, 'laws.jsonl');
  if (!fs.existsSync(file)) {
    throw new Error(`Put your dataset at ${file} first.`);
  }
  const records = fs
    .readFileSync(file, 'utf-8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));

  console.log(`Embedding ${records.length} chunks...`);
  const prefix = process.env.EMBED_DOC_PREFIX ?? 'search_document: ';
  const items: any[] = [];

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const vectors = await embedTexts(
      batch.map((r) => r.text),
      prefix,
    );
    batch.forEach((r, j) => items.push({ ...r, vector: vectors[j] }));
    process.stdout.write(`\r${Math.min(i + BATCH, records.length)}/${records.length}`);
  }

  const out = path.join(DIR, 'index.json');
  fs.writeFileSync(
    out,
    JSON.stringify({
      model: process.env.LMSTUDIO_EMBED_MODEL,
      createdAt: new Date().toISOString(),
      items,
    }),
  );
  console.log(`\nDone -> ${out}  (vector size ${items[0]?.vector.length})`);
}

main().catch((e) => {
  console.error('\nIngest failed:', e.message);
  process.exit(1);
});
