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
    // 403 = the 24-hour sign-in token is missing or has expired (the app can
    // still look signed in) — say what to do instead of a vague failure.
    if (response.status === 403) throw new Error('Your sign-in has expired. Please log out and log back in, then try Check writing again.');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || `Request failed (${response.status})`);
    return { success: true, correctedText: result.corrected_text, changes: result.changes || [] };
  } catch (error) {
    console.error('Error checking writing:', error);
    return { success: false, error: error.message };
  }
};
