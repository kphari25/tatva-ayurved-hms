// Single source of truth for the IP room list — used by the IP Case Sheet's
// room assignment dropdown and by the Invoice form's room-rate pre-fill, so
// numbers/types/rates can't drift apart between the two screens.
export const ROOMS = [
  { number: '21', type: 'A/C', rate: 1000 },
  { number: '22', type: 'A/C', rate: 1000 },
  { number: '23', type: 'Non-A/C', rate: 700 },
  { number: '24', type: 'Non-A/C', rate: 700 },
  { number: '25', type: 'Non-A/C', rate: 700 },
];

export const getRoomInfo = (roomNumber) => ROOMS.find(r => r.number === String(roomNumber || ''));
