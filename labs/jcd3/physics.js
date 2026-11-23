// Units throughout the experiment: millimetres; wavelength input in nanometres.
import { MECHANICAL_DEFAULTS } from './assets/instrument-config.js';
export const DEFAULTS = Object.freeze({
  ...MECHANICAL_DEFAULTS,
  lamp: true,
  wavelength_nm: 589.3,
  radius_mm: 1000,
  zoom: 1,
  guide: true
});
export const radians = d => d * Math.PI / 180;
export function reflection(tilt = 45, yaw = 0) {
  const a = radians(tilt),
    b = radians(yaw);
  const n = [-Math.sin(b) * Math.sin(a), Math.cos(b) * Math.sin(a), Math.cos(a)];
  return [-2 * n[1] * n[0], 1 - 2 * n[1] * n[1], -2 * n[1] * n[2]];
}
export function illumination(s) {
  if (!s.lamp) return 0;
  const ray = reflection(s.mirror_deg, s.mirror_yaw_deg + s.column_deg);
  return .015 + .985 * Math.exp(-(1 + ray[2]) * 48);
}
export function ringRadius(order, s) {
  return Math.sqrt(order * s.wavelength_nm * 1e-6 * s.radius_mm);
}
export function radiusFromDiameters(dm, dn, m, n, wavelength_nm) {
  if (!(m > n && dm > dn && dn > 0 && wavelength_nm > 0)) return null;
  return (dm * dm - dn * dn) / (4 * (m - n) * wavelength_nm * 1e-6);
}
export function contact(s) {
  const v = [s.cell_turn_1, s.cell_turn_2, s.cell_turn_3];
  return {
    offset_um: .1 * Math.max(0, -(v[0] + v[1] + v[2]) / 3),
    tilt_x_um_per_mm: .035 * (v[0] - v[1]),
    tilt_y_um_per_mm: .035 * (v[0] + v[1] - 2 * v[2])
  };
}
export function intensity(x, y, s) {
  const c = contact(s);
  const lambda = s.wavelength_nm * 1e-6;
  const t = (x * x + y * y) / (2 * s.radius_mm) + .001 * (c.offset_um + c.tilt_x_um_per_mm * x + c.tilt_y_um_per_mm * y);
  return .045 + .955 * Math.sin(2 * Math.PI * t / lambda) ** 2;
}
export function observationOffset(s) {
  const t = radians(s.column_deg);
  const x = 25 - s.reading_mm;
  const y = -99 + s.arm_mm;
  return {
    x: x * Math.cos(t) - y * Math.sin(t),
    y: 99 + x * Math.sin(t) + y * Math.cos(t)
  };
}
export function focusQuality(s) {
  return Math.exp(-(((s.focus_mm + s.column_mm - 12) / 2.1) ** 2));
}
export function measurementConditions(s) {
  const issues = [];
  if (illumination(s) < .35) issues.push('照明未对准');
  if (focusQuality(s) < .65) issues.push('物像尚未清晰');
  if (Math.abs(Math.sin(radians(s.reticle_deg))) > .06) issues.push('纵丝未垂直于测量方向');
  if (Math.abs(observationOffset(s).y) > .1) issues.push('测量路径偏离环心');
  return issues;
}
