// Generated from src/lib/optics/newton-rings.ts. Do not edit.
export const DEFAULT_RINGS = { wavelength: 589.3, radius: 1000, index: 1, gap: 0, mode: 'reflection' };
const finite = (x, a, b) => typeof x === 'number' && Number.isFinite(x) && x >= a && x <= b;
export function normalizeRings(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    return { wavelength: finite(s.wavelength, 400, 700) ? s.wavelength : 589.3, radius: finite(s.radius, 300, 3000) ? s.radius : 1000,
        index: finite(s.index, 1, 1.4) ? s.index : 1, gap: finite(s.gap, 0, 1000) ? s.gap : 0, mode: s.mode === 'transmission' ? 'transmission' : 'reflection' };
}
export function filmThickness(r, s) { return s.gap * 1e-6 + r * r / (2 * s.radius); }
export function ringIntensity(r, s) {
    const reflected = Math.sin(2 * Math.PI * s.index * filmThickness(r, s) / (s.wavelength * 1e-6)) ** 2;
    return s.mode === 'reflection' ? reflected : 1 - reflected;
}
/** k is the interference order (not the visible-ring ordinal when there is a gap). */
export function darkRadius(order, s) {
    if (!Number.isInteger(order) || order < 0)
        return null;
    const squared = s.radius * (order * s.wavelength * 1e-6 / s.index - 2 * s.gap * 1e-6);
    return squared >= 0 ? Math.sqrt(squared) : null;
}
export function sameConditions(a, b) {
    return a.wavelength === b.wavelength && a.radius === b.radius && a.index === b.index && a.gap === b.gap && a.mode === b.mode;
}
export function makeReading(order, left, right, s, assisted) {
    if (s.mode !== 'reflection' || !Number.isInteger(order) || order < 1 || order > 30 || !finite(left, -6, -.001) || !finite(right, .001, 6) || !darkRadius(order, s))
        throw Error('请在反射模式选择存在的暗环，并分别记录中心左右两侧的位置。');
    return { order, left, right, settings: { ...s }, assisted };
}
export function curvatureFromPair(a, b) {
    if (!sameConditions(a.settings, b.settings) || a.order === b.order)
        return null;
    const value = a.settings.index * ((b.right - b.left) ** 2 - (a.right - a.left) ** 2) / (4 * (b.order - a.order) * a.settings.wavelength * 1e-6);
    return Number.isFinite(value) && value > 0 ? value : null;
}
export function restoreReadings(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.slice(0, 80).flatMap(row => {
        try {
            if (!row || !row.settings || typeof row.assisted !== 'boolean')
                return [];
            const settings = normalizeRings(row.settings);
            if (!sameConditions(settings, row.settings))
                return [];
            return [makeReading(row.order, row.left, row.right, settings, row.assisted)];
        }
        catch {
            return [];
        }
    });
}
export function readingsCsv(rows) {
    return '\uFEFF' + ['k,x_left_mm,x_right_mm,D_mm,D_squared_mm2,wavelength_nm,R_set_mm,film_index,gap_nm,theory_assisted',
        ...rows.map(r => [r.order, r.left, r.right, (r.right - r.left).toFixed(4), ((r.right - r.left) ** 2).toFixed(6), r.settings.wavelength, r.settings.radius, r.settings.index, r.settings.gap, r.assisted ? 1 : 0].join(','))].join('\r\n');
}
