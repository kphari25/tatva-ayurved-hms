// Single source of truth for the IP room list — used by the IP Case Sheet's
// room assignment dropdown, the Invoice form's room-rate pre-fill, and the
// Room Management floor plan, so numbers/rates/floors can't drift apart
// between screens.
//
// Every room except 23 has both an A/C and a Non-A/C unit — staff pick
// which one a stay is billed under at booking/admission time, and that
// choice (not the room number) is what determines the rate. Room 23 only
// has a Non-A/C unit, so it's the one room with just a single option.
export const ROOM_TYPES = ['A/C', 'Non-A/C'];

export const ROOM_RATES = { 'A/C': 1200, 'Non-A/C': 900 };

export const getRoomRate = (type) => ROOM_RATES[type] || 0;

export const ROOMS = [
  { number: '21', floor: 'Ground Floor', types: ['A/C', 'Non-A/C'] },
  { number: '22', floor: 'Ground Floor', types: ['A/C', 'Non-A/C'] },
  { number: '23', floor: 'First Floor', types: ['Non-A/C'] },
  { number: '24', floor: 'First Floor', types: ['A/C', 'Non-A/C'] },
  { number: '25', floor: 'First Floor', types: ['A/C', 'Non-A/C'] },
];

export const getRoomInfo = (roomNumber) => ROOMS.find(r => r.number === String(roomNumber || ''));

// Flat (room, type) combinations for booking dropdowns — one selectable
// option per bookable configuration, since the same physical room can be
// listed under either type it supports. `key` is what the dropdown's
// <option value> actually uses, encoding both pieces so a single selection
// sets room_number and room_type together.
export const ROOM_BOOKING_OPTIONS = ROOMS.flatMap(r =>
  r.types.map(type => ({ number: r.number, type, rate: ROOM_RATES[type], floor: r.floor, key: `${r.number}|${type}` }))
);

export const parseRoomBookingKey = (key) => {
  const [number, type] = String(key || '').split('|');
  return { number: number || '', type: type || '' };
};
