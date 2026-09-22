// Extracts the first number out of a free-text height/weight field (e.g.
// "70", "70 kg", "5'7\"") and computes BMI assuming cm and kg. Returns ''
// (not a number) when either input isn't parseable, so callers can just
// assign the result straight into a form field.
export const calculateBMI = (heightInput, weightInput) => {
  const height = parseFloat(String(heightInput).replace(',', '.'));
  const weight = parseFloat(String(weightInput).replace(',', '.'));
  if (!Number.isFinite(height) || !Number.isFinite(weight) || height <= 0 || weight <= 0) {
    return '';
  }
  const heightM = height / 100;
  const bmi = weight / (heightM * heightM);
  return Number.isFinite(bmi) ? bmi.toFixed(1) : '';
};
