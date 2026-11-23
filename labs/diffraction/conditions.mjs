import {MODEL,fresh,settings,normalize} from './physics.mjs';
export function validateConditions(value){
  if(!value||value.version!==1||value.lab!=='diffraction'||value.model!==MODEL||value.wavelengthNm!==650)throw Error('仅支持650 nm基础衍射仪器条件，其他模式请留在原理工坊探索。');
  return {version:1,lab:'diffraction',model:MODEL,wavelengthNm:650,...settings(value)};
}
export const defaults=()=>fromInstrument(fresh());
export function fromInstrument(state){return validateConditions({version:1,lab:'diffraction',model:MODEL,wavelengthNm:650,...settings(state)});}
export function applyConditions(state,value){const c=validateConditions(value);return normalize({...state,...settings(c),leftMm:null,rightMm:null,order:1,assisted:state.hints});}
