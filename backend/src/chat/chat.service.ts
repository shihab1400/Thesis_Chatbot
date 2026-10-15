import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { MessageDto } from './chat.dto';
import { RetrievalService } from './retrieval.service';
import { Source } from './chat.types';

type Hit = Source & { _text: string };

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly retrieval: RetrievalService) {}

  async reply(messages: MessageDto[]): Promise<{ reply: string; sources: Source[] }> {
    const hits = (await this.retrieval.search(this.buildQuery(messages))) as Hit[];
    const system = this.buildSystemPrompt(hits);
    const history = messages.slice(-6);
    // chat templates expect the first turn to be the user's
    while (history.length && history[0].role === 'assistant') history.shift();

    const provider = process.env.LLM_PROVIDER ?? 'lmstudio';
    const reply =
      provider === 'gemini'
        ? await this.callGemini(system, history)
        : await this.callLmStudio(system, history);

    // strip the internal prompt text before sending sources to the browser
    const sources = hits.map(({ _text, ...s }) => s);
    return { reply, sources };
  }

  /** Short follow-ups ("and section 3?") are searched together with the previous question. */
  private buildQuery(messages: MessageDto[]): string {
    const users = messages.filter((m) => m.role === 'user');
    const last = users[users.length - 1]?.content ?? '';
    const prev = users[users.length - 2]?.content;
    return last.length < 40 && prev ? `${prev}\n${last}` : last;
  }

  private buildSystemPrompt(hits: Hit[]): string {
    const excerpts = hits.length
      ? hits.map((h, i) => `[${i + 1}] ${h._text}`).join('\n\n')
      : '(no relevant excerpts were found)';
    return [
      'You answer questions about Bangladesh education law using ONLY the excerpts below.',
      'Rules:',
      '- Cite the Act and section number for every claim, e.g. (Public Examinations (Offences) Act, 1980, Section 2).',
      '- If the excerpts do not contain the answer, say you could not find it in the available laws. Never guess or use outside knowledge.',
      '- Do not invent section numbers or quotes.',
      '- Reply in the same language the user writes in. Be concise.',
      '- You give general information, not legal advice.',
      '',
      'EXCERPTS:',
      excerpts,
    ].join('\n');
  }

  private async callLmStudio(system: string, history: MessageDto[]): Promise<string> {
    const base = process.env.LMSTUDIO_URL ?? 'http://localhost:1234/v1';
    const model = process.env.LMSTUDIO_CHAT_MODEL;
    if (!model) throw new InternalServerErrorException('LMSTUDIO_CHAT_MODEL is not set.');

    let res: Response;
    try {
      res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [{ role: 'system', content: system }, ...history],
        }),
        signal: AbortSignal.timeout(180_000), // local models can be slow
      });
    } catch (err) {
      this.logger.error('LM Studio unreachable', err as Error);
      throw new BadGatewayException(
        'Could not reach LM Studio. Make sure its local server is running and a model is loaded.',
      );
    }
    if (!res.ok) {
      this.logger.error(`LM Studio ${res.status}: ${await res.text()}`);
      throw new BadGatewayException('LM Studio returned an error. Check its logs.');
    }
    const data: any = await res.json();
    const text: string = (data?.choices?.[0]?.message?.content ?? '')
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .trim();
    if (!text) throw new BadGatewayException('The model returned an empty answer.');
    return text;
  }

  private async callGemini(system: string, history: MessageDto[]): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new InternalServerErrorException('GEMINI_API_KEY is not set.');
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: history.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
          }),
        },
      );
    } catch (err) {
      this.logger.error('Could not reach Gemini', err as Error);
      throw new BadGatewayException('Could not reach the AI service.');
    }
    if (!res.ok) {
      this.logger.error(`Gemini ${res.status}: ${await res.text()}`);
      throw new BadGatewayException('The AI service returned an error.');
    }
    const data: any = await res.json();
    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new BadGatewayException('The AI service returned no answer.');
    return text;
  }
}
