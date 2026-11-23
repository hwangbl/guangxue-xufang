import {renderNewtonImage} from './newton-image.mjs';
import {observe} from '../liquid-crystal/physics.mjs';
export function calculate(task,input){
 if(task==='newton-image')return renderNewtonImage(input.settings,input.half);
 if(task==='lc-curve')return Array.from({length:51},(_,i)=>observe({voltageRms:i/10,analyzerDeg:input.analyzerDeg,wavelengthNm:550}));
 throw Error('未知的计算任务。');
}
if(typeof self!=='undefined')self.onmessage=({data:{task,input}})=>{
 try{const value=calculate(task,input);self.postMessage({value},value.data?[value.data.buffer]:[]);}catch(error){self.postMessage({error:error.message||'计算失败。'});}
};
