// Calls the /api/parse-invoice serverless function for Purchase Management's
// "Import Invoice (PDF)" feature — the Anthropic API key lives server-side
// only (see api/parse-invoice.js), never in client code or the browser bundle.

// base64Pdf: raw base64 string (no "data:application/pdf;base64," prefix)
export const parseInvoicePdf = async (base64Pdf) => {
  try {
    const response = await fetch('/api/parse-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Pdf }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || `Request failed (${response.status})`);
    }
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error parsing invoice PDF:', error);
    return { success: false, error: error.message };
  }
};
