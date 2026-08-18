/**
 * Quran Intelligence — API proxy.
 *
 * Exists for one reason: the Anthropic key must never ship inside the mobile
 * app, where anyone can extract it from the bundle. The device talks to this
 * process; this process talks to the model.
 *
 *   cp .env.example .env   # add ANTHROPIC_API_KEY
 *   npm install
 *   npm run dev
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { createClient, runAnalysis, type AnalyzeRequestBody } from './analyze.js';

const app = express();
const PORT = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const client = createClient();

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'quran-intelligence',
    aiConfigured: client !== null,
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
  });
});

app.post('/api/analyze', async (req, res) => {
  const body = req.body as AnalyzeRequestBody;

  if (!body?.question || typeof body.question !== 'string') {
    res.status(400).json({ ok: false, error: 'حقل question مطلوب.' });
    return;
  }

  // The mode is not a suggestion: anything else is refused rather than
  // silently downgraded, so the evidentiary boundary cannot be widened by a
  // malformed client.
  if (body.mode !== 'quran-only') {
    res.status(400).json({ ok: false, error: 'الوضع المدعوم الوحيد هو quran-only.' });
    return;
  }

  if (!client) {
    res.status(503).json({
      ok: false,
      error:
        'لم يُضبط ANTHROPIC_API_KEY في الخادم. أنشئ ملف server/.env وضع المفتاح فيه. ' +
        'التطبيق سيستمر في العمل بالمحرك المحلي.',
    });
    return;
  }

  try {
    const result = await runAnalysis(client, body);
    res.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[analyze]', message);
    res.status(500).json({ ok: false, error: message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Quran Intelligence API`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  المفتاح مضبوط: ${client ? 'نعم' : 'لا — سيعمل التطبيق محليًا فقط'}\n`);
});
