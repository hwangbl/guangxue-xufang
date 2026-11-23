import {MODEL,fresh,settings,normalize} from './physics.mjs';
export function validateConditions(v) {
  if(!v||v.version!==1||v.lab!=='telescope'||v.model!==MODEL||v.objectiveMm!==200||v.wavelengthNm!==550) throw new RangeError('仅支持200 mm物镜、550 nm及教学台目镜配置。');
  return {version:1,lab:'telescope',model:MODEL,objectiveMm:200,wavelengthNm:550,...settings(v)};
}
export const fromInstrument = s => validateConditions({version:1,lab:'telescope',model:MODEL,objectiveMm:200,wavelengthNm:550,...settings(s)});
export const defaults = () => fromInstrument(fresh());
export function applyConditions(s,c) { return normalize({...s,...settings(validateConditions(c))}); }
