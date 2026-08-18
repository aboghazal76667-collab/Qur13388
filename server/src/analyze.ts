/**
 * The /api/analyze handler.
 *
 * The device has already done the retrieval and the counting before this is
 * called. What arrives is a bundle of verified facts, and the model's job is
 * narrowly scoped: reason over them and return structured JSON. It is not asked
 * to recall the Quran, and the schema gives it nowhere to put a quotation even
 * if it tried.
 */

import Anthropic from '@anthropic-ai/sdk';

import { ANALYSIS_SCHEMA, ANALYSIS_TOOL_NAME } from './schema.js';
import { buildSystemPrompt } from './prompts/modules.js';

export interface AnalyzeRequestBody {
  question: string;
  mode: 'quran-only';
  context?: { key: string; surah: number; ayah: number; text: string }[];
  lexicalFacts?: {
    term: string;
    root?: string;
    occurrenceCount: number;
    verseCount: number;
    forms: string[];
    sampleKeys: string[];
  }[];
  questionAnalysis?: unknown;
}

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';
const MAX_TOKENS = 8000;

export function createClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

function buildUserMessage(body: AnalyzeRequestBody): string {
  const parts: string[] = [];

  parts.push(`السؤال: ${body.question}`);
  parts.push(`الوضع: ${body.mode} (القرآن فقط — لا حديث ولا مذاهب فقهية كمصادر إثبات)`);

  if (body.questionAnalysis) {
    parts.push(
      'تفكيك أوّلي للسؤال أنتجه التطبيق محليًا (استعمله ولا تناقضه في الوقائع العددية):\n' +
        JSON.stringify(body.questionAnalysis, null, 1)
    );
  }

  if (body.lexicalFacts && body.lexicalFacts.length > 0) {
    parts.push(
      'وقائع لغوية محسوبة من قاعدة بيانات المصحف ومورفولوجيته. ' +
        'هذه أرقام قطعية مأخوذة من النص، فلا تعدّلها ولا تخالفها:\n' +
        body.lexicalFacts
          .map(
            (f) =>
              `• «${f.term}»${f.root ? ` (الجذر ${f.root})` : ''}: ` +
              `${f.occurrenceCount} موضعًا في ${f.verseCount} آية. ` +
              `من صيغه: ${f.forms.slice(0, 8).join('، ')}. ` +
              `أمثلة مواضع: ${f.sampleKeys.slice(0, 10).join('، ')}`
          )
          .join('\n')
    );
  }

  if (body.context && body.context.length > 0) {
    parts.push(
      'الآيات التي استرجعها التطبيق (النص هنا للاطلاع فقط — لا تُعده في مخرجاتك، ' +
        'واكتفِ بأرقام السور والآيات):\n' +
        body.context.map((c) => `[${c.surah}:${c.ayah}] ${c.text}`).join('\n')
    );
  }

  parts.push(
    'المطلوب: استدع الأداة ' +
      ANALYSIS_TOOL_NAME +
      ' مرة واحدة بكائن مطابق للمخطط. ' +
      'لا تكتب نص أي آية داخل الحقول، اكتفِ بالأرقام. ' +
      'لا تنسب أي رأي إلى أي مفكر. ' +
      'إن لم تجد في النص ما يحسم المسألة فقل ذلك في الخلاصة وفي سبب درجة الثقة.'
  );

  return parts.join('\n\n');
}

export async function runAnalysis(client: Anthropic, body: AnalyzeRequestBody): Promise<unknown> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(),
    tools: [
      {
        name: ANALYSIS_TOOL_NAME,
        description:
          'أرسل نتيجة التحليل النهائية بصيغة منظّمة. استدعِ هذه الأداة مرة واحدة فقط.',
        input_schema: ANALYSIS_SCHEMA as unknown as Anthropic.Tool['input_schema'],
      },
    ],
    tool_choice: { type: 'tool', name: ANALYSIS_TOOL_NAME },
    messages: [{ role: 'user', content: buildUserMessage(body) }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === 'tool_use' && block.name === ANALYSIS_TOOL_NAME
  );

  if (!toolUse) {
    throw new Error('لم يُرجع النموذج نتيجة منظّمة.');
  }

  return toolUse.input;
}
