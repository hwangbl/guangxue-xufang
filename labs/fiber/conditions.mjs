import {MODEL,LEGACY_MODEL,CONFIG,fresh,settings,normalize} from './physics.mjs';
export function validateConditions(v){
 const legacy=v?.version===1&&v.model===LEGACY_MODEL&&v.tiltRad===0&&v.axialUm===0&&(v.pitchMrad===undefined||v.pitchMrad===0)&&(v.yawMrad===undefined||v.yawMrad===0);
 if(!v||!(legacy||(v.version===2&&v.model===MODEL&&(v.tiltRad===undefined||v.tiltRad===0)))||v.lab!=='fiber'||v.wavelengthNm!==633||v.mfdUm!==4.3||v.beamRadiusUm!==2.15)throw Error('仅支持633 nm固定单模五轴配置；请使用独立俯仰、偏转条件。');
 return {version:2,lab:'fiber',model:MODEL,wavelengthNm:633,mfdUm:CONFIG.mfdUm,beamRadiusUm:CONFIG.beamRadiusUm,...settings(v)};
}
export const defaults=()=>fromInstrument(fresh());
export function fromInstrument(s){return validateConditions({version:2,lab:'fiber',model:MODEL,wavelengthNm:633,mfdUm:4.3,beamRadiusUm:2.15,...settings(s)});}
export function applyConditions(s,v){return normalize({...s,...settings(validateConditions(v)),task:'align',scanYUm:null,scanFixed:null});}

