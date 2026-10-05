import React, { useEffect, useState } from 'react';
import { SpellCheck, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { checkWriting } from '../lib/writingCheck';

// Word-level diff of the suggestion against what was written, so changed
// words stand out in the suggested text.
const diffTokens = (original, corrected) => {
  const a = original.split(/(\s+)/);
  const b = corrected.split(/(\s+)/);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) { out.push({ t: b[j], changed: false }); i++; j++; }
    else if (i < a.length && dp[i + 1][j] >= dp[i][j + 1]) i++;
    else { out.push({ t: b[j], changed: !/^\s+$/.test(b[j]) }); j++; }
  }
  return out;
};

// Adds a "Check writing" button and a suggestion panel to a text box.
//   const wc = useWritingCheck(value, onChange);
//   ...put {wc.button} next to the label and {wc.panel} under the box.
// Nothing changes until the user clicks Accept; editing the text clears the suggestion.
export const useWritingCheck = (value, onApply) => {
  const [state, setState] = useState({ status: 'idle' }); // idle | loading | done | error

  useEffect(() => { setState(s => (s.status === 'idle' ? s : { status: 'idle' })); }, [value]);

  const run = async () => {
    const text = value || '';
    setState({ status: 'loading' });
    const r = await checkWriting(text);
    if (!r.success) { setState({ status: 'error', message: r.error }); return; }
    setState({ status: 'done', original: text, correctedText: r.correctedText, changes: r.changes });
  };

  const canCheck = (value || '').trim().length >= 3 && state.status !== 'loading';

  const button = (
    <button
      type="button"
      onClick={run}
      disabled={!canCheck}
      title="Check spelling, grammar and clarity"
      className="flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 hover:bg-teal-50 px-2 py-1 rounded disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {state.status === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SpellCheck className="w-3.5 h-3.5" />}
      {state.status === 'loading' ? 'Checking…' : 'Check writing'}
    </button>
  );

  let panel = null;
  if (state.status === 'error') {
    panel = (
      <div className="mt-1.5 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span className="flex-1">{state.message}</span>
        <button type="button" onClick={() => setState({ status: 'idle' })} className="text-red-400 hover:text-red-700"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  } else if (state.status === 'done') {
    const unchanged = state.correctedText.trim() === state.original.trim();
    panel = unchanged ? (
      <div className="mt-1.5 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <Check className="w-4 h-4" />
        <span className="flex-1">Looks good — no spelling or grammar problems found.</span>
        <button type="button" onClick={() => setState({ status: 'idle' })} className="text-green-500 hover:text-green-800"><X className="w-3.5 h-3.5" /></button>
      </div>
    ) : (
      <div className="mt-1.5 border border-teal-200 bg-teal-50/60 rounded-lg px-3 py-2.5 text-sm">
        <p className="text-xs font-semibold text-teal-800 mb-1">Suggested correction</p>
        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
          {diffTokens(state.original, state.correctedText).map((p, i) => (
            <span key={i} className={p.changed ? 'bg-green-100 text-green-900 underline decoration-green-500 rounded-sm' : ''}>{p.t}</span>
          ))}
        </p>
        {state.changes.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-gray-600">
            {state.changes.map((c, i) => (
              <li key={i}>
                <span className="line-through text-red-500">{c.original}</span>
                <span className="mx-1">→</span>
                <span className="text-green-700 font-medium">{c.suggestion}</span>
                {c.reason && <span className="text-gray-400"> · {c.reason}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 mt-2.5">
          <button
            type="button"
            onClick={() => { onApply(state.correctedText); setState({ status: 'idle' }); }}
            className="flex items-center gap-1 px-3 py-1 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700"
          >
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button
            type="button"
            onClick={() => setState({ status: 'idle' })}
            className="px-3 py-1 border border-gray-300 bg-white rounded-lg text-xs hover:bg-gray-50"
          >
            Keep mine
          </button>
        </div>
      </div>
    );
  }

  return { button, panel };
};
