// Calls the /api/check-writing serverless function (spelling / grammar /
// clarity suggestions for the log text boxes). Only the text itself is sent.
export const checkWriting = async (text) => {
  try {
    const token = localStorage.getItem('sessionToken') || '';
    const response = await fetch('/api/check-writing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || `Request failed (${response.status})`);
    return { success: true, correctedText: result.corrected_text, changes: result.changes || [] };
  } catch (error) {
    console.error('Error checking writing:', error);
    return { success: false, error: error.message };
  }
};
