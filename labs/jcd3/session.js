// Independent, per-window progress. Never writes the original platform store.
import { DEFAULTS } from './physics.js';
import { INSTRUMENT } from './assets/instrument-config.js';
export const SESSION_KEY = 'wxgs-jcd3-session-v1';
const conditions = ['radius_mm', 'wavelength_nm', 'arm_mm', 'column_mm', 'column_deg', 'cell_turn_1', 'cell_turn_2', 'cell_turn_3'];
const extra = { wavelength_nm: {min:400,max:700}, radius_mm:{min:300,max:3000}, zoom:{min:1,max:2} };
function validValue(key, value) {
  if (typeof DEFAULTS[key] === 'boolean') return typeof value === 'boolean';
  const bounds = INSTRUMENT.properties[key] || extra[key];
  return !!bounds && typeof value === 'number' && Number.isFinite(value) && value >= bounds.min && value <= bounds.max;
}
export function decodeSession(raw) {
  if (!raw || raw.length > 100000) return null;
  try {
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || !saved.state || !Array.isArray(saved.records)) return null;
    for (const key of Object.keys(DEFAULTS)) if (!validValue(key, saved.state[key])) return null;
    if (saved.records.length > 4) return null;
    const seen = new Set();
    for (const entry of saved.records) {
      if (!Array.isArray(entry) || entry.length !== 2) return null;
      const [order, row] = entry;
      if (![5,10,15,20].includes(order) || seen.has(order) || !row || typeof row !== 'object' || Array.isArray(row)) return null;
      if (!Object.hasOwn(row,'left') && !Object.hasOwn(row,'right')) return null;
      seen.add(order);
      for (const side of Object.keys(row)) {
        const shot = row[side];
        if (!['left','right'].includes(side) || !shot || !validValue('reading_mm', shot.value)) return null;
        if (!shot.conditions || conditions.some(key => !validValue(key, shot.conditions[key]))) return null;
        if (!Array.isArray(shot.issues) || shot.issues.length > 10 || shot.issues.some(issue => typeof issue !== 'string' || issue.length > 100)) return null;
        if (typeof shot.time !== 'string' || !Number.isFinite(Date.parse(shot.time))) return null;
      }
    }
    return { state:Object.fromEntries(Object.keys(DEFAULTS).map(key=>[key,saved.state[key]])), records:saved.records };
  } catch { return null; }
}
export function restoreSession(storage) {
  try { return decodeSession(storage.getItem(SESSION_KEY)); } catch { return null; }
}
export function persistSession(storage, state, records) {
  try { storage.setItem(SESSION_KEY, JSON.stringify({version:1,state,records:[...records]})); return true; } catch { return false; }
}
