// Shared optical conditions for the 2D / JCD3 bridge. Mechanical coordinates stay in 3D.
import {contact} from './physics.js';
const bounded=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
export function validateConditions(v){
 if(!v||v.version!==1||v.lab!=='jcd3'||v.model!=='jcd3-ideal-v1'||v.index!==1||v.mode!=='reflection')throw Error('3D仪器仅支持空气膜反射条件（n=1）。');
 if(!bounded(v.wavelength,400,700)||!bounded(v.radius,300,3000)||!bounded(v.gap,0,50))throw Error('3D范围：波长400–700 nm，曲率半径300–3000 mm，中心间隙0–50 nm。');
 return {version:1,lab:'jcd3',model:'jcd3-ideal-v1',wavelength:v.wavelength,radius:v.radius,index:1,gap:v.gap,mode:'reflection'};
}
export const fromPrinciple=s=>validateConditions({...s,version:1,lab:'jcd3',model:'jcd3-ideal-v1'});
export function fromInstrument(s){
 if(!s||!['cell_turn_1','cell_turn_2','cell_turn_3'].every(k=>bounded(s[k],-.5,.5)))throw Error('三维薄膜状态无效。');
 const c=contact(s);
 if(Math.abs(c.tilt_x_um_per_mm)>1e-9||Math.abs(c.tilt_y_um_per_mm)>1e-9)throw Error('三维薄膜尚未调平。请将三枚牛顿环螺钉调到相同值，再带入二维同心圆模型。');
 return validateConditions({version:1,lab:'jcd3',model:'jcd3-ideal-v1',wavelength:s.wavelength_nm,radius:s.radius_mm,index:1,gap:Math.round(c.offset_um*1000*1e6)/1e6,mode:'reflection'});
}
export function applyConditions(state,conditions){
 const c=validateConditions(conditions),turn=-c.gap/100;
 return {...state,wavelength_nm:c.wavelength,radius_mm:c.radius,cell_turn_1:turn,cell_turn_2:turn,cell_turn_3:turn};
}
export function completedRecords(records){return new Map([...records].filter(([,row])=>row.left&&row.right));}
