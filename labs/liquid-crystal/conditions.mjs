import {MODEL,fresh,settings,changeSettings} from './physics.mjs';
export function validateConditions(v){
 if(!v||v.version!==1||v.lab!=='liquid-crystal'||v.model!==MODEL||v.cellGapUm!==5||v.drive!=='ac-rms'||v.twistDeg!==90||v.material!=='teaching-tn-fixed')throw new RangeError('仅支持固定教学材料、5 μm、90°TN盒及交流有效值。');
 return {version:1,lab:'liquid-crystal',model:MODEL,cellGapUm:5,drive:'ac-rms',twistDeg:90,material:'teaching-tn-fixed',...settings(v)};
}
export const fromInstrument=s=>validateConditions({version:1,lab:'liquid-crystal',model:MODEL,cellGapUm:5,drive:'ac-rms',twistDeg:90,material:'teaching-tn-fixed',...settings(s)});
export const defaults=()=>fromInstrument(fresh());
export const applyConditions=(s,c)=>changeSettings(s,settings(validateConditions(c)));
