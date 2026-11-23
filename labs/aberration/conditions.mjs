import {MODEL,fresh,settings,changeSettings} from './physics.mjs';
export function validateConditions(v){
 if(!v||v.version!==1||v.lab!=='aberration'||v.model!==MODEL||v.wavelengthNm!==550||v.focalMm!==200||v.referenceRadiusMm!==10)throw new RangeError('仅支持550 nm、200 mm等效焦距与10 mm参考瞳半径。');
 return {version:1,lab:'aberration',model:MODEL,wavelengthNm:550,focalMm:200,referenceRadiusMm:10,...settings(v)};
}
export const fromInstrument=s=>validateConditions({version:1,lab:'aberration',model:MODEL,wavelengthNm:550,focalMm:200,referenceRadiusMm:10,...settings(s)});
export const defaults=()=>fromInstrument(fresh());
export const applyConditions=(s,c)=>changeSettings(s,settings(validateConditions(c)));
