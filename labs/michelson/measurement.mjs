import { ready, result } from './physics.mjs';

export const REFERENCE_NM = 632.8;
export const MAX_RECORDS = 500;
export const reading = value => Number(value.toFixed(4));

export function measurementIssue(state, count, loaded = true) {
  if (!loaded) return '请等待三维仪器加载完成。';
  if (!ready(state)) return '请先开启光源、对准镜架并移入扩束镜。';
  if (state.start === null) return '请先记录起点，再沿同一方向微调。';
  if (state.reversed) return '本组已反向移动，请重新记录起点。';
  if (reading(state.x) === state.start) return '起止显示读数相同，请继续同向微调。';
  if (String(count).trim() === '') return '请手动输入经过中心的条纹数。';
  try { result(state.start, reading(state.x), Number(count)); }
  catch (error) { return error.message; }
  if (state.records.length >= MAX_RECORDS) return '已达到500组记录，请导出并删除部分记录后继续。';
  return '';
}

export function restoreMeasurement(raw) {
  if (!raw || raw.length > 200000) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || !Number.isFinite(value.x) || value.x < 0 || value.x > 100 ||
        !Number.isFinite(value.yaw) || Math.abs(value.yaw) > 1 ||
        !Number.isFinite(value.pitch) || Math.abs(value.pitch) > 1 ||
        typeof value.lamp !== 'boolean' || typeof value.expanded !== 'boolean' ||
        !Array.isArray(value.records)) return null;
    const records = [];
    let dropped = 0;
    for (const row of value.records) {
      try {
        if (!row || records.length >= MAX_RECORDS) throw Error();
        const wave = result(row.a, row.b, row.n);
        records.push({ a: row.a, b: row.b, n: row.n, wave, assisted: row.assisted === true });
      } catch { dropped++; }
    }
    return { x: value.x, yaw: value.yaw, pitch: value.pitch,
      lamp: value.lamp, expanded: value.expanded, records, dropped };
  } catch { return null; }
}
