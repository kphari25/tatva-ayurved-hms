// Single source of truth for the IP room list — used by the IP Case Sheet's
// room assignment dropdown, the Invoice form's room-rate pre-fill, and the
// Room Management floor plan, so numbers/types/rates/floors can't drift
// apart between screens.
export const ROOMS = [
  { number: '21', type: 'A/C', rate: 1000, floor: 'Ground Floor' },
  { number: '22', type: 'A/C', rate: 1000, floor: 'Ground Floor' },
  { number: '23', type: 'Non-A/C', rate: 700, floor: 'First Floor' },
  { number: '24', type: 'Non-A/C', rate: 700, floor: 'First Floor' },
  { number: '25', type: 'Non-A/C', rate: 700, floor: 'First Floor' },
];

export const getRoomInfo = (roomNumber) => ROOMS.find(r => r.number === String(roomNumber || ''));
