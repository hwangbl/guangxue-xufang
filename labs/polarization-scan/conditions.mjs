import {MODEL,fresh,settings,changeSettings} from './physics.mjs';
export function validateConditions(v){
 if(!v||v.version!==1||v.lab!=='polarization-scan'||v.model!==MODEL||v.polarizerDeg!==0||v.sampleFastDeg!==45||v.compensatorFastDeg!==0||v.compensator!=='matched-quarter-wave')throw new RangeError('仅支持起偏器0°、样品快轴45°、快轴0°的匹配四分之一波片。');
 return {version:1,lab:'polarization-scan',model:MODEL,polarizerDeg:0,sampleFastDeg:45,compensatorFastDeg:0,compensator:'matched-quarter-wave',...settings(v)};
}
export const fromInstrument=s=>validateConditions({version:1,lab:'polarization-scan',model:MODEL,polarizerDeg:0,sampleFastDeg:45,compensatorFastDeg:0,compensator:'matched-quarter-wave',...settings(s)});
export const defaults=()=>fromInstrument(fresh());
// Transfer optical settings only: a principle page cannot manufacture a measured blank zero.
export const applyConditions=(s,c)=>changeSettings(s,settings(validateConditions(c)));
