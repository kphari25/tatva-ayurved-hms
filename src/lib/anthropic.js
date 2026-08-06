// Anthropic Claude API — reads vendor PDF invoices for Purchase Management's
// "Import Invoice (PDF)" feature. Set VITE_ANTHROPIC_API_KEY in .env (see .env.example).

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || '';
const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';

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

// base64Pdf: raw base64 string (no "data:application/pdf;base64," prefix)
export const parseInvoicePdf = async (base64Pdf) => {
  if (!API_KEY) {
    return { success: false, error: 'Anthropic API key not configured. Set VITE_ANTHROPIC_API_KEY in .env' };
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
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
      throw new Error(`Anthropic API error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    const text = data.content?.find(block => block.type === 'text')?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI response did not contain the expected JSON data');

    const parsed = JSON.parse(jsonMatch[0]);
    return { success: true, data: parsed };
  } catch (error) {
    console.error('Error parsing invoice PDF:', error);
    return { success: false, error: error.message };
  }
};
