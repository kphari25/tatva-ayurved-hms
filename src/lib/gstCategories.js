// Ayurvedic products don't all carry the same GST rate — it depends on how
// the item is classified: a standard Ayurvedic medicine, a classical
// ("Traditional") formulation, or an Ayurvedic-branded cosmetic (soap,
// shampoo, toothpaste, etc. — taxed as a cosmetic, not a medicine, even
// though it's Ayurvedic). Rates below are the hospital's confirmed figures.
// CGST/SGST are always an even split of the total (standard for an
// intra-state sale), e.g. 12% -> 6% + 6%.
export const GST_CATEGORIES = [
  { key: 'standard', label: 'Standard (Ayurvedic Medicine)', rate: 12 },
  { key: 'traditional', label: 'Traditional (Classical Formulation)', rate: 5 },
  { key: 'cosmetics', label: 'Ayurvedic Cosmetics', rate: 18 },
];

export const GST_CATEGORY_MAP = Object.fromEntries(GST_CATEGORIES.map(c => [c.key, c]));

export const gstCategoryLabel = (key) => GST_CATEGORY_MAP[key]?.label || '';

export const rateForGSTCategory = (key) => GST_CATEGORY_MAP[key]?.rate ?? null;

// Splits a total GST% evenly into { cgst, sgst }.
export const splitGST = (totalRate) => {
  const half = Math.round(((Number(totalRate) || 0) / 2) * 100) / 100;
  return { cgst: half, sgst: half };
};
