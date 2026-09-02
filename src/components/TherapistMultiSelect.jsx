// Shared by every "Add/Edit Appointment" form (Dashboard, Scheduling) that
// lets front desk assign up to 3 therapists to one appointment.
export const toggleTherapistInFields = (fields, t, max = 3) => {
  const idx = fields.therapistIds.indexOf(t.id);
  if (idx !== -1) {
    return {
      ...fields,
      therapistIds: fields.therapistIds.filter(id => id !== t.id),
      therapistNames: fields.therapistNames.filter((_, i) => i !== idx),
    };
  }
  if (fields.therapistIds.length >= max) return fields;
  return { ...fields, therapistIds: [...fields.therapistIds, t.id], therapistNames: [...fields.therapistNames, t.name] };
};

const TherapistMultiSelect = ({ therapists, selectedIds, onToggle }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">👤 Therapist(s) <span className="text-gray-400 font-normal">(up to 3)</span></label>
    <div className="border border-gray-300 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
      {therapists.length === 0 && <p className="text-xs text-gray-400 px-1 py-0.5">No therapists found</p>}
      {therapists.map(t => {
        const checked = selectedIds.includes(t.id);
        const disabled = !checked && selectedIds.length >= 3;
        return (
          <label key={t.id} className={`flex items-center gap-2 text-sm px-1 py-0.5 rounded ${disabled ? 'text-gray-300' : 'text-gray-700'}`}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(t)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            {t.name}
          </label>
        );
      })}
    </div>
  </div>
);

export default TherapistMultiSelect;
