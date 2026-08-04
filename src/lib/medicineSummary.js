// Renders a plain-text summary of MedicineTable rows so older code that only
// reads `medication_details` (e.g. PrescriptionModal) keeps working unchanged.
export const summarizeMedicineItems = (items = []) =>
  items
    .filter(i => i.item_name)
    .map(i => {
      const details = [i.dose, i.frequency, i.days ? `${i.days} days` : '', i.instructions]
        .filter(Boolean)
        .join(', ');
      return details ? `${i.item_name} (${details})` : i.item_name;
    })
    .join('; ');

// Renders MedicineTable rows as a compact Sl/Medicine/Dose/Frequency/
// Instructions/Days table — the same column layout used on the printed
// Prescription — for embedding inside case sheet print templates (OP Visit
// Log, IP Vitals & Daily Log) so every printout shows medicines the same
// way. Returns '' when there's nothing structured to show, so callers can
// fall back to an older flattened-text field.
export const buildMedicineItemsTableHTML = (items = []) => {
  const rows = (items || []).filter(i => i.item_name);
  if (rows.length === 0) return '';
  const rowsHTML = rows.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.item_name}</td>
      <td>${item.dose || ''}</td>
      <td>${item.frequency || ''}</td>
      <td>${item.instructions || ''}</td>
      <td>${item.days || ''}</td>
    </tr>
  `).join('');
  return `<table class="med-table">
    <thead><tr><th>#</th><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Instructions</th><th>Days</th></tr></thead>
    <tbody>${rowsHTML}</tbody>
  </table>`;
};
