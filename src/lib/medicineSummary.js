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
