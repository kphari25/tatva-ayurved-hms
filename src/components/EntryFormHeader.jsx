import React from 'react';

// Title row of a log-entry form (IP Daily Log / Follow up, OP Visit Log) with
// its autosave status. A new entry is only a draft until Add; an entry being
// edited is saved as you type. `restored` = { saved_at, saved_by } when a
// draft from an earlier session was put back in the form.
const EntryFormHeader = ({ title, editing, autosave, hasContent, restored, addLabel, onDiscard }) => (
  <div className="mb-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{title}</h3>
      {(editing || hasContent) && autosave.indicator}
    </div>
    {!editing && hasContent && (
      <p className="text-xs text-gray-500 mt-1">
        Draft — kept safe if the sheet closes, but not in the log until you click <strong>{addLabel}</strong>.
      </p>
    )}
    {editing && <p className="text-xs text-gray-500 mt-1">Changes to this entry save automatically.</p>}
    {restored && (
      <div className="flex items-center justify-between gap-3 mt-2 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
        <span>
          Unfinished entry restored
          {restored.saved_at ? ` (last saved ${new Date(restored.saved_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${restored.saved_by ? ` by ${restored.saved_by}` : ''})` : ''}.
          Review it and click <strong>{addLabel}</strong>.
        </span>
        <button onClick={onDiscard} className="text-amber-800 underline flex-shrink-0">Discard draft</button>
      </div>
    )}
  </div>
);

export default EntryFormHeader;
