// Vercel serverless function — proxies the vendor PDF invoice read for
// Purchase Management's "Import Invoice (PDF)" feature. The Anthropic API
// key lives only in this server-side function (ANTHROPIC_API_KEY, no VITE_
// prefix, set in Vercel project settings), so it never reaches the browser.

const EXTRACTION_PROMPT = `You are reading a vendor B2B tax invoice for medicines/goods sent to an Ayurveda hospital's pharmacy. Extract the data and return ONLY a single JSON object — no markdown fences, no explanation — matching exactly this shape:

{
  "vendor_name": string,
  "vendor_gstin": string,
  "invoice_number": string,
  "invoice_date": string,
  "items": [
    {
      "description": string,
      "batch_number": string,
      "expiry_date": string,
      "quantity": number,
      "unit_price": number,
      "discount_amount": number,
      "gst_percent": number
    }
  ]
}

Rules:
- description: name of the medicine/goods only, without pack size or batch info.
- expiry_date and invoice_date: use YYYY-MM-DD format; use "" if not present on the invoice.
- gst_percent: the combined tax rate (sum of CGST+SGST, or IGST alone).
- Only include real line items (goods rows), not subtotal/total/tax-summary rows.
- Use "" for missing text fields and 0 for missing numbers.
- Numbers must be plain numbers — no currency symbols, no commas, no strings.
- Return valid JSON only.`;

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
    const text = data.content?.find(block => block.type === 'text')?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      const reason = data.stop_reason === 'max_tokens' ? ' (response was cut off — hit the token limit)' : '';
      res.status(502).json({ success: false, error: `AI response did not contain the expected JSON data${reason}. Response started with: ${text.slice(0, 300) || '(empty)'}` });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      res.status(502).json({ success: false, error: `Could not parse the AI's JSON response: ${parseErr.message}. Raw text: ${jsonMatch[0].slice(0, 300)}` });
      return;
    }
    res.status(200).json({ success: true, data: parsed });
  } catch (error) {
    console.error('Error parsing invoice PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
