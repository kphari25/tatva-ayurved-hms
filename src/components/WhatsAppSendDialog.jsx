import React, { useState } from 'react';
import { X, MessageCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { openWhatsAppChat, previewTemplate, sendTemplate, toWhatsAppNumber, whatsappApiEnabled } from '../lib/whatsapp';

// Confirmation step for every WhatsApp message: shows who it goes to and the
// exact text, and nothing is sent until the user presses the button.
//  - API on (VITE_WHATSAPP_API_ENABLED): "Send" posts the approved template
//    through the WhatsApp Business API; if that fails, "Open WhatsApp instead"
//    falls back to the one-click chat.
//  - API off: the button opens the pre-filled WhatsApp chat, as before.
// `template` is { name, params } (see lib/whatsapp.js); `chatMessage` is the
// free text used for the one-click chat.
const WhatsAppSendDialog = ({ phone, template, chatMessage, onClose, onSent }) => {
  const [state, setState] = useState('confirm'); // confirm | sending | sent | failed
  const [error, setError] = useState('');
  const number = toWhatsAppNumber(phone);
  const preview = whatsappApiEnabled && template ? previewTemplate(template) : chatMessage;

  const handleSend = async () => {
    if (!whatsappApiEnabled || !template) {
      if (openWhatsAppChat(phone, chatMessage)) onClose();
      return;
    }
    setState('sending');
    const res = await sendTemplate(phone, template);
    if (res.success) {
      setState('sent');
      if (onSent) onSent();
    } else {
      setError(res.error || 'Could not send the message.');
      setState('failed');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-600" /> Send on WhatsApp
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {state === 'sent' ? (
            <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
              <CheckCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-semibold">Message sent</p>
                <p className="text-sm">Delivered to WhatsApp for +{number}.</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                Send this message to <strong>{number ? `+${number}` : 'no valid number'}</strong>?
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                {preview}
              </div>
              {state === 'failed' && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Automatic send failed: {error}</span>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3">
            {state === 'sent' ? (
              <button onClick={onClose} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Close</button>
            ) : (
              <>
                <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                {state === 'failed' && (
                  <button
                    onClick={() => { if (openWhatsAppChat(phone, chatMessage)) onClose(); }}
                    className="flex-1 px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50"
                  >
                    Open WhatsApp instead
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={state === 'sending' || !number}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {state === 'sending'
                    ? 'Sending…'
                    : state === 'failed'
                      ? 'Try again'
                      : whatsappApiEnabled && template ? 'Send' : 'Open WhatsApp'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppSendDialog;
