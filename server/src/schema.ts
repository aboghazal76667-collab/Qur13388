/**
 * The JSON contract the model must return.
 *
 * Note what is absent: no verse text and no thinker opinions. The model supplies
 * `surah`/`ayah` numbers only; the app resolves the text locally, and the
 * thinker section is served entirely from the app's own database. Leaving those
 * fields out of the schema is what makes the two strongest hallucination risks
 * structurally impossible rather than merely discouraged.
 */

export const ANALYSIS_TOOL_NAME = 'submit_analysis';

const reference = {
  type: 'object',
  properties: {
    surah: { type: 'integer', minimum: 1, maximum: 114, description: 'رقم السورة' },
    ayah: { type: 'integer', minimum: 1, description: 'رقم الآية' },
    relevance: { type: 'string', description: 'سبب ارتباط هذه الآية بالسؤال' },
  },
  required: ['surah', 'ayah'],
  additionalProperties: false,
} as const;

export const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'خلاصة قصيرة جدًا وواضحة، جملتان أو ثلاث على الأكثر.',
    },
    centralVerses: {
      type: 'array',
      maxItems: 10,
      items: reference,
      description: 'الآيات المركزية. أرقام فقط — لا تكتب نص الآية.',
    },
    quranicAnalysis: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['title', 'body'],
        additionalProperties: false,
      },
      description: 'أقسام التحليل الداخلي للنص.',
    },
    arguments: {
      type: 'array',
      maxItems: 4,
      items: {
        type: 'object',
        properties: {
          conclusion: { type: 'string' },
          premises: { type: 'array', items: { type: 'string' }, maxItems: 6 },
          quranEvidence: { type: 'array', items: reference, maxItems: 6 },
          assumptions: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 6,
            description: 'المقدمات التي أُضيفت ولم تُستخرج من النص.',
          },
          counterArguments: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          alternativeInterpretations: { type: 'array', items: { type: 'string' }, maxItems: 4 },
          confidence: { type: 'string', enum: ['high', 'medium', 'low', 'undetermined'] },
          directness: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] },
          chain: {
            type: 'array',
            maxItems: 8,
            items: {
              type: 'object',
              properties: {
                kind: {
                  type: 'string',
                  enum: [
                    'quran-text',
                    'linguistic-observation',
                    'inference',
                    'external-assumption',
                  ],
                },
                content: { type: 'string' },
                references: { type: 'array', items: reference, maxItems: 3 },
                isAssumption: { type: 'boolean' },
              },
              required: ['kind', 'content'],
              additionalProperties: false,
            },
            description: 'سلسلة الاستدلال: آية ← ملاحظة ← افتراض ← استنتاج.',
          },
        },
        required: ['conclusion', 'premises', 'quranEvidence', 'assumptions', 'confidence', 'directness', 'chain'],
        additionalProperties: false,
      },
    },
    leadingView: {
      type: 'object',
      properties: {
        statement: { type: 'string' },
        rationale: { type: 'string', description: 'سبب الترجيح' },
        directness: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] },
      },
      required: ['statement', 'rationale', 'directness'],
      additionalProperties: false,
    },
    strongestCounterArgument: {
      type: 'object',
      properties: {
        statement: { type: 'string' },
        quranEvidence: { type: 'array', items: reference, maxItems: 4 },
        response: { type: 'string', description: 'الرد على الاعتراض إن وُجد' },
        strength: { type: 'string', enum: ['high', 'medium', 'low', 'undetermined'] },
      },
      required: ['statement', 'strength'],
      additionalProperties: false,
    },
    confidence: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['high', 'medium', 'low', 'undetermined'] },
        reason: { type: 'string', description: 'سبب هذه الدرجة تحديدًا' },
      },
      required: ['level', 'reason'],
      additionalProperties: false,
    },
  },
  required: ['summary', 'centralVerses', 'quranicAnalysis', 'arguments', 'confidence'],
  additionalProperties: false,
} as const;
