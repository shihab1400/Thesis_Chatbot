import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { dot, embedTexts } from './embeddings';
import { Source } from './chat.types';

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private items: any[] | null = null;

  private load(): any[] {
    if (this.items) return this.items;
    const file = path.join(process.env.DATA_DIR ?? 'data', 'index.json');
    if (!fs.existsSync(file)) {
      throw new InternalServerErrorException(
        'Search index not found. Run "npm run ingest" in the backend folder.',
      );
    }
    const idx = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (idx.model && idx.model !== process.env.LMSTUDIO_EMBED_MODEL) {
      this.logger.warn(
        `Index was built with "${idx.model}" but .env uses "${process.env.LMSTUDIO_EMBED_MODEL}". Re-run ingest.`,
      );
    }
    this.items = idx.items;
    this.logger.log(`Loaded ${this.items!.length} chunks`);
    return this.items!;
  }

  /** Python retrieval service (ChromaDB). Used when RETRIEVAL_URL is set. */
  private async searchRemote(query: string): Promise<Source[]> {
    const base = process.env.RETRIEVAL_URL!.replace(/\/$/, '');
    const k = Number(process.env.TOP_K ?? 5);
    const min = Number(process.env.MIN_SCORE ?? 0);

    let res: Response;
    try {
      res = await fetch(`${base}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, k }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new InternalServerErrorException(
        `Cannot reach the search service at ${base}. Start it: python -m uvicorn server:app --port 8000`,
      );
    }
    if (!res.ok) {
      this.logger.error(`Search service ${res.status}: ${await res.text()}`);
      throw new InternalServerErrorException(
        'The search service returned an error. Did you run "python ingest.py"?',
      );
    }
    const data: any = await res.json();
    return data.results
      .filter((r: any) => r.score >= min)
      .map(({ text, ...r }: any) => ({ ...r, _text: text })) as Source[];
  }

  async search(query: string): Promise<Source[]> {
    if (process.env.RETRIEVAL_URL) return this.searchRemote(query);
    const items = this.load();
    const k = Number(process.env.TOP_K ?? 5);
    const min = Number(process.env.MIN_SCORE ?? 0);

    let q: number[];
    try {
      [q] = await embedTexts([query], process.env.EMBED_QUERY_PREFIX ?? 'search_query: ');
    } catch (e) {
      throw new InternalServerErrorException((e as Error).message);
    }

    return items
      .map((it) => ({ it, score: dot(q, it.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .filter((x) => x.score >= min)
      .map(({ it, score }) => {
        // text = header lines + body; keep only the body for the excerpt
        const lines: string[] = it.text.split('\n');
        const secIdx = lines.findIndex((l) => l.startsWith('Section'));
        const body = lines.slice(secIdx + 1).join(' ');
        return {
          id: it.id,
          act: it.act_title,
          year: it.act_year,
          actNo: it.act_no,
          section: it.section_no,
          title: it.section_title,
          chapter: it.chapter_no,
          score: Number(score.toFixed(3)),
          excerpt: body.length > 450 ? body.slice(0, 450) + '…' : body,
          // full text is used for the prompt, not sent to the browser
          _text: it.text,
        } as Source & { _text: string };
      });
  }
}
