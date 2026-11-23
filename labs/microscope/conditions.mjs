import {MODEL,fresh,settings,changeSettings} from './physics.mjs';
export function validateConditions(v){
 if(!v||v.version!==1||v.lab!=='microscope'||v.model!==MODEL||v.wavelengthNm!==550||v.eyepiece!==10||v.imagePlaneMm!==160)throw new RangeError('仅支持550 nm、10×目镜及160 mm像方主平面距离教学配置。');
 return {version:1,lab:'microscope',model:MODEL,wavelengthNm:550,eyepiece:10,imagePlaneMm:160,...settings(v)};
}
export const fromInstrument=s=>validateConditions({version:1,lab:'microscope',model:MODEL,wavelengthNm:550,eyepiece:10,imagePlaneMm:160,...settings(s)});
export const defaults=()=>fromInstrument(fresh());
export const applyConditions=(s,c)=>changeSettings(s,settings(validateConditions(c)));
