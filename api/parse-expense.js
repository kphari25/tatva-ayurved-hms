// Vercel serverless function — reads a store bill / receipt / invoice (photo or
// PDF) for the Expenses page's "Scan Invoice / Receipt" feature. Same pattern as
// api/parse-invoice.js: the Anthropic API key lives only in this server-side
// function (ANTHROPIC_API_KEY, no VITE_ prefix), so it never reaches the browser.

import { verifySessionToken } from './_lib/session.js';

const CATEGORIES = [
  'other', 'electricity', 'mess', 'medicine_purchase', 'utilities', 'maintenance',
  'supplies', 'equipment', 'grocery', 'rent', 'misc', 'salary', 'marketing',
];

const EXTRACTION_PROMPT = `You are reading a bill, receipt or invoice from a store/vendor that an Ayurveda hospital paid for. Call the record_expense tool with the data printed on it.

Rules:
- total_amount: the final amount payable (grand total including tax), as a plain number — no currency symbols, no commas. Use 0 if you cannot read it.
- bill_date: the bill/invoice date in YYYY-MM-DD format; use "" if it is not printed or not legible.
- vendor_name and invoice_number: exactly as printed; use "" if not present.
- category: pick the closest of the allowed values for what was bought (e.g. rice, vegetables, oil = grocery; light bill = electricity; stationery, cleaning items = supplies; repairs = maintenance). Use "other" if unsure.
- payment_mode: only if the bill states how it was paid (cash, card, upi, bank, cheque); otherwise "".
- items: the main line items (description and line amount). Skip subtotal / tax / total rows. Use at most 15 items; if there are more, include the largest ones.
- summary: one short line describing the purchase, e.g. "Vegetables and groceries from Sree Stores".
- Never guess. If a value is unclear, leave it empty / 0 rather than inventing one.`;

const EXTRACTION_TOOL = {
  name: 'record_expense',
  description: 'Record the header and line items read from a store bill or receipt.',
  input_schema: {
    type: 'object',
    properties: {
      vendor_name: { type: 'string' },
      invoice_number: { type: 'string' },
      bill_date: { type: 'string', description: 'YYYY-MM-DD, or "" if not present' },
      total_amount: { type: 'number' },
      category: { type: 'string', enum: CATEGORIES },
      payment_mode: { type: 'string', enum: ['', 'cash', 'card', 'upi', 'bank', 'cheque'] },
      summary: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            amount: { type: 'number' },
          },
          required: ['description', 'amount'],
        },
      },
    },
    required: ['vendor_name', 'invoice_number', 'bill_date', 'total_amount', 'category', 'summary', 'items'],
  },
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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
  const session = verifySessionToken(bearer);
  if (!session) {
    res.status(403).json({ success: false, error: 'Not authorized. Please log in again and retry.' });
    return;
  }

  const { base64, mediaType } = req.body || {};
  if (!base64 || !mediaType) {
    res.status(400).json({ success: false, error: 'Missing base64 or mediaType in request body' });
    return;
  }

  let fileBlock;
  if (mediaType === 'application/pdf') {
    fileBlock = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  } else if (IMAGE_TYPES.includes(mediaType)) {
    fileBlock = { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };
  } else {
    res.status(400).json({ success: false, error: `Unsupported file type: ${mediaType}` });
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
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: 'record_expense' },
        messages: [{
          role: 'user',
          content: [fileBlock, { type: 'text', text: EXTRACTION_PROMPT }],
        }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      res.status(response.status).json({ success: false, error: `Anthropic API error (${response.status}): ${errBody}` });
      return;
    }

    const data = await response.json();
    const toolUse = data.content?.find(block => block.type === 'tool_use' && block.name === 'record_expense');
    if (!toolUse) {
      res.status(502).json({ success: false, error: 'AI response did not include the expected extraction data.' });
      return;
    }

    res.status(200).json({ success: true, data: toolUse.input });
  } catch (error) {
    console.error('Error parsing expense document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
