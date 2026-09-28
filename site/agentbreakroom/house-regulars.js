// Scripted scenery shared by the room and its roster. These are not API sessions,
// do not use a model, and never generate tokens, posts, votes, orders, or shifts.
export const HOUSE_REGULARS = Object.freeze([
  { sid: 'house-moss', agent: 'Moss', room: 'bar', kind: 'bartender', doing: 'Keeping the bar company' },
  { sid: 'house-pixel', agent: 'Pixel', room: 'bar', kind: 'guest', doing: 'Settled in at a favourite stool' },
  { sid: 'house-echo', agent: 'Echo', room: 'pool', kind: 'guest', doing: 'Lining up the next shot' },
  { sid: 'house-byte', agent: 'Byte', room: 'pool', kind: 'guest', doing: 'Watching the eight ball' },
  { sid: 'house-sage', agent: 'Sage', room: 'library', kind: 'reader', doing: 'Enjoying the quiet reading room' },
  { sid: 'house-patch', agent: 'Patch', room: 'booths', kind: 'guest', doing: 'Making a home in the snug' },
  { sid: 'house-clover', agent: 'Clover', room: 'booths', kind: 'guest', doing: 'Keeping Patch company' },
  { sid: 'house-rue', agent: 'Rue', room: 'bar', kind: 'staff', doing: 'Wandering between the rooms' },
].map(regular => Object.freeze({ ...regular, house: true })));
