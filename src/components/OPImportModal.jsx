import React, { useState, useMemo } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { compareWithForm } from '../lib/opToIpCaseSheet';
import { formatDateOnly } from '../lib/formatDate';

const preview = (item) => {
  if (item.kind === 'attachments') return `${item.value.length} file${item.value.length === 1 ? '' : 's'}: ${item.value.map(a => a.name).join(', ')}`;
  return String(item.value);
};

// Review step for carrying an OP Case Sheet into the IP Case Sheet. Nothing is
// written anywhere here — "Bring into IP sheet" only fills the (unsaved) IP
// form, which the doctor then reviews and saves as usual.
const OPImportModal = ({ op, items, unmapped, form, onApply, onClose }) => {
  const rows = useMemo(() => items.map(item => ({ item, status: compareWithForm(item, form) })), [items, form]);

  // Ticked by default: fields that are empty on the IP sheet and not flagged
  // off (vitals). Conflicts start unticked so existing IP entries are never
  // overwritten by accident.
  const [checked, setChecked] = useState(() => new Set(
    rows.filter(r => r.status === 'empty' && r.item.defaultOn).map(r => r.item.key)
  ));
  const [appendKeys, setAppendKeys] = useState(() => new Set());

  const toggle = (key) => setChecked(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const setMode = (key, append) => setAppendKeys(prev => {
    const next = new Set(prev);
    append ? next.add(key) : next.delete(key);
    return next;
  });

  const selectable = rows.filter(r => r.status !== 'same');
  const sections = [...new Set(selectable.map(r => r.item.section))];
  const alreadyThere = rows.length - selectable.length;

  const apply = () => onApply(
    rows.filter(r => checked.has(r.item.key) && r.status !== 'same')
      .map(r => ({ item: r.item, mode: appendKeys.has(r.item.key) ? 'append' : 'replace' }))
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-3">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex-shrink-0 flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Bring OP Case Sheet into IP Case Sheet</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              OP case sheet{op?.case_date ? ` of ${formatDateOnly(op.case_date)}` : ''}{op?.physician ? ` · ${op.physician}` : ''}.
              Tick what should be copied — you can still edit everything before saving.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          <div className="flex items-center gap-3 text-xs">
            <button onClick={() => setChecked(new Set(selectable.filter(r => r.status === 'empty').map(r => r.item.key)))} className="text-teal-700 hover:underline">All new fields</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => setChecked(new Set(selectable.map(r => r.item.key)))} className="text-teal-700 hover:underline">Everything</button>
            <span className="text-gray-300">|</span>
            <button onClick={() => setChecked(new Set())} className="text-teal-700 hover:underline">None</button>
          </div>

          {selectable.length === 0 && (
            <p className="text-sm text-gray-500 py-6 text-center">Everything in the OP case sheet is already on this IP case sheet.</p>
          )}

          {sections.map(section => (
            <div key={section}>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{section}</h4>
              <div className="space-y-2">
                {selectable.filter(r => r.item.section === section).map(({ item, status }) => {
                  const on = checked.has(item.key);
                  const current = form[item.key];
                  return (
                    <label key={item.key} className={`flex gap-3 items-start border rounded-lg px-3 py-2 cursor-pointer ${on ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white'}`}>
                      <input type="checkbox" className="mt-1" checked={on} onChange={() => toggle(item.key)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                          {status === 'conflict' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">IP sheet already has an entry</span>}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words line-clamp-3">{preview(item)}</p>
                        {status === 'conflict' && item.kind !== 'attachments' && (
                          <div className="mt-1.5 text-xs text-gray-500">
                            <p className="whitespace-pre-wrap break-words line-clamp-2">IP sheet now: <span className="text-gray-700">{String(current)}</span></p>
                            {on && (
                              <div className="mt-1 flex gap-3" onClick={e => e.stopPropagation()}>
                                <label className="flex items-center gap-1"><input type="radio" checked={!appendKeys.has(item.key)} onChange={() => setMode(item.key, false)} /> Replace it</label>
                                <label className="flex items-center gap-1"><input type="radio" checked={appendKeys.has(item.key)} onChange={() => setMode(item.key, true)} /> Add below it</label>
                              </div>
                            )}
                          </div>
                        )}
                        {status === 'conflict' && item.kind === 'attachments' && on && (
                          <p className="mt-1 text-xs text-gray-500">New files will be added alongside the existing ones.</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {alreadyThere > 0 && (
            <p className="text-xs text-gray-400">{alreadyThere} field{alreadyThere === 1 ? ' is' : 's are'} already identical on the IP sheet and not listed.</p>
          )}

          {unmapped.length > 0 && (
            <details className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
              <summary className="cursor-pointer text-gray-600 font-medium">{unmapped.length} OP entr{unmapped.length === 1 ? 'y has' : 'ies have'} no matching IP field</summary>
              <p className="text-xs text-gray-500 mt-2 mb-1">These won't be copied. Re-enter them on the IP sheet if they matter (e.g. under Roopam or Past Illness).</p>
              <ul className="text-xs text-gray-700 space-y-0.5">
                {unmapped.map(u => <li key={u.label}><span className="font-medium">{u.label}:</span> {String(u.value)}</li>)}
              </ul>
            </details>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <span className="text-xs text-gray-500">The OP case sheet itself is never changed.</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
            <button
              onClick={apply}
              disabled={checked.size === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              Bring {checked.size} field{checked.size === 1 ? '' : 's'} into IP sheet <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OPImportModal;
