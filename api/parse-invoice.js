// Vercel serverless function — proxies the vendor PDF invoice read for
// Purchase Management's "Import Invoice (PDF)" feature. The Anthropic API
// key lives only in this server-side function (ANTHROPIC_API_KEY, no VITE_
// prefix, set in Vercel project settings), so it never reaches the browser.

import { verifySessionToken } from './_lib/session.js';

const EXTRACTION_PROMPT = `You are reading a vendor B2B tax invoice for medicines/goods sent to an Ayurveda hospital's pharmacy. Call the extract_invoice tool with the data from this invoice.

Rules:
- description: name of the medicine/goods only, without pack size or batch info.
- hsn_code: the HSN/SAC code printed on that line item; use "" if not present.
- expiry_date and invoice_date: use YYYY-MM-DD format; use "" if not present on the invoice.
- gst_percent: the combined tax rate (sum of CGST+SGST, or IGST alone).
- Only include real line items (goods rows), not subtotal/total/tax-summary rows.
- Use "" for missing text fields and 0 for missing numbers.
- Numbers must be plain numbers — no currency symbols, no commas, no strings.`;

// Tool-forced extraction instead of asking for freeform JSON in a text block:
// the API guarantees tool_use.input is valid, schema-shaped JSON, so there's
// nothing left to regex out of prose or hand-parse — no more "malformed JSON"
// failures when an invoice's item text happens to contain a stray quote/comma.
const EXTRACTION_TOOL = {
  name: 'extract_invoice',
  description: 'Record the vendor invoice header and line items read from the PDF.',
  input_schema: {
    type: 'object',
    properties: {
      vendor_name: { type: 'string' },
      vendor_gstin: { type: 'string' },
      invoice_number: { type: 'string' },
      invoice_date: { type: 'string', description: 'YYYY-MM-DD, or "" if not present' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            hsn_code: { type: 'string' },
            batch_number: { type: 'string' },
            expiry_date: { type: 'string', description: 'YYYY-MM-DD, or "" if not present' },
            quantity: { type: 'number' },
            unit_price: { type: 'number' },
            discount_amount: { type: 'number' },
            gst_percent: { type: 'number' },
          },
          required: ['description', 'quantity', 'unit_price'],
        },
      },
    },
    required: ['vendor_name', 'invoice_number', 'items'],
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
  const session = verifySessionToken(bearer);
  if (!session) {
    res.status(403).json({ success: false, error: 'Not authorized. Please log in again and retry.' });
    return;
  }

  const { base64Pdf } = req.body || {};
  if (!base64Pdf) {
    res.status(400).json({ success: false, error: 'Missing base64Pdf in request body' });
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
        max_tokens: 8192,
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: 'extract_invoice' },
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      res.status(response.status).json({ success: false, error: `Anthropic API error (${response.status}): ${errBody}` });
      return;
    }

    const data = await response.json();
    const toolUse = data.content?.find(block => block.type === 'tool_use' && block.name === 'extract_invoice');
    if (!toolUse) {
      const reason = data.stop_reason === 'max_tokens' ? ' (response was cut off — hit the token limit, the invoice may have too many line items)' : '';
      const text = data.content?.find(block => block.type === 'text')?.text || '';
      res.status(502).json({ success: false, error: `AI response did not include the expected extraction data${reason}.${text ? ` Response: ${text.slice(0, 300)}` : ''}` });
      return;
    }

    res.status(200).json({ success: true, data: toolUse.input });
  } catch (error) {
    console.error('Error parsing invoice PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
