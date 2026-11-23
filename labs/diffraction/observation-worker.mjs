import {intensity,settings,APERTURES} from './physics.mjs';
import {patternPixels} from './pattern.mjs';
export function calculateObservation(state){
 settings(state);
 const samples=Float64Array.from({length:2801},(_,i)=>intensity(state,i*.05)),circular=APERTURES[state.aperture].kind==='circular';
 return {samples,eye:patternPixels(samples,1000,400,80,32,0,circular),screen:patternPixels(samples,660,800,165,200,10,circular)};
}
if(typeof self!=='undefined')self.onmessage=({data:{id,key,state}})=>{
 try{const value=calculateObservation(state);self.postMessage({id,key,value},[value.samples.buffer,value.eye.buffer,value.screen.buffer]);}catch(error){self.postMessage({id,key,error:error.message||'图样计算失败。'});}
};
