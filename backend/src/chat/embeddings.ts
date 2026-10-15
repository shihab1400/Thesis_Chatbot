/** Talks to LM Studio's OpenAI-compatible /v1/embeddings endpoint. */

export function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export async function embedTexts(
  texts: string[],
  prefix = '',
): Promise<number[][]> {
  const base = process.env.LMSTUDIO_URL ?? 'http://localhost:1234/v1';
  const model = process.env.LMSTUDIO_EMBED_MODEL;
  if (!model) throw new Error('LMSTUDIO_EMBED_MODEL is not set in .env');

  let res: Response;
  try {
    res = await fetch(`${base}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: texts.map((t) => prefix + t) }),
    });
  } catch {
    throw new Error(
      `Cannot reach LM Studio at ${base}. Is the local server started?`,
    );
  }
  if (!res.ok) {
    throw new Error(`LM Studio embeddings error ${res.status}: ${await res.text()}`);
  }
  const data: any = await res.json();
  return data.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => normalize(d.embedding));
}
