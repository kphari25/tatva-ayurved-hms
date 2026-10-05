// Vercel serverless function — spelling / grammar / clarity check for the
// free-text boxes in the IP and OP logs. The Anthropic API key stays in this
// server-side function (ANTHROPIC_API_KEY, same one the invoice import uses);
// only the text being checked is sent — no patient name, ID or other context.

import { verifySessionToken } from './_lib/session.js';

const MAX_CHARS = 6000;

const SYSTEM_PROMPT = `You proofread short clinical notes written by staff at an Ayurveda hospital (doctor's notes, diet, treatment, history, findings). Fix spelling, grammar and punctuation, and rewrite vague or unclear phrasing so it reads clearly — WITHOUT changing the clinical meaning and WITHOUT adding facts that are not in the text.

Rules:
- Keep Ayurvedic and medical terms, drug/medicine names, Sanskrit/Malayalam terms and treatment names (e.g. Abhyanga, Shirodhara, Panchakarma, Kampavata) exactly as written unless one is clearly misspelled.
- Keep dosage notation, abbreviations and shorthand (1-0-1, BD, TDS, c/o, h/o, OD, wks, mg, ml), numbers, units and dates as written.
- Clinical notes may be terse fragments (for example "c/o back pain x 3 wks") — leave that style alone; only fix real errors or genuine ambiguity.
- Keep the original language (English), the same line breaks, lists and ordering.
- Make the smallest edits that fix the problems. If the text is already correct and clear, return it unchanged with no changes listed.
Call the record_correction tool.`;

const TOOL = {
  name: 'record_correction',
  description: 'Return the corrected text and the list of changes made.',
  input_schema: {
    type: 'object',
    properties: {
      corrected_text: { type: 'string', description: 'The full corrected text (identical to the input if nothing needed fixing).' },
      changes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            original: { type: 'string', description: 'The word or phrase as written.' },
            suggestion: { type: 'string', description: 'The replacement.' },
            reason: { type: 'string', description: 'Very short reason, e.g. "spelling", "grammar", "unclear wording".' },
          },
          required: ['original', 'suggestion', 'reason'],
        },
      },
    },
    required: ['corrected_text', 'changes'],
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'Anthropic API key not configured on the server. Set ANTHROPIC_API_KEY in Vercel project settings.' });
    return;
  }

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!verifySessionToken(bearer)) {
    res.status(403).json({ success: false, error: 'Not authorized. Please log in again and retry.' });
    return;
  }

  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  if (!text.trim()) {
    res.status(400).json({ success: false, error: 'Nothing to check.' });
    return;
  }
  if (text.length > MAX_CHARS) {
    res.status(400).json({ success: false, error: `Text is too long to check (max ${MAX_CHARS} characters).` });
    return;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'record_correction' },
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      res.status(response.status).json({ success: false, error: `Writing check failed (${response.status}): ${errBody.slice(0, 300)}` });
      return;
    }

    const data = await response.json();
    const toolUse = data.content?.find(b => b.type === 'tool_use' && b.name === 'record_correction');
    if (!toolUse || typeof toolUse.input?.corrected_text !== 'string') {
      res.status(502).json({ success: false, error: 'The writing check returned an unexpected response. Please try again.' });
      return;
    }

    res.status(200).json({
      success: true,
      corrected_text: toolUse.input.corrected_text,
      changes: Array.isArray(toolUse.input.changes) ? toolUse.input.changes : [],
    });
  } catch (error) {
    console.error('Error checking writing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
