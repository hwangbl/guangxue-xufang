import {MODEL,LEGACY_MODEL,fresh,settings,normalize} from './physics.mjs';
export function validateConditions(v){
 if(!v||!((v.version===2&&v.model===MODEL)||(v.version===1&&v.model===LEGACY_MODEL&&v.m===0&&v.n===0))||v.lab!=='resonator'||v.wavelengthNm!==632.8)throw Error('仅支持632.8 nm同轴两镜腔和仪器镜片配置。');
 return {version:2,lab:'resonator',model:MODEL,wavelengthNm:632.8,...settings(v)};
}
export const fromInstrument=s=>validateConditions({version:2,lab:'resonator',model:MODEL,wavelengthNm:632.8,...settings(s)});
export const defaults=()=>fromInstrument(fresh());
export function applyConditions(s,c){
 const v=settings(validateConditions(c)),pair=[v.mirror1,v.mirror2].sort().join('/');
 const task=pair==='plane/r200'?'plano':pair==='r200/r300'?'asymmetric':'special';
 return normalize({...s,...v,task});
}

