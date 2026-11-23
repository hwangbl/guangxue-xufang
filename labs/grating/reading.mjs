import {angle,LINES,setupIssue} from './physics.mjs';
export function vernier(angleDeg){
 if(!Number.isFinite(angleDeg))throw Error('角度必须是有限数值');
 const minutes=((Math.round(angleDeg*60)%21600)+21600)%21600;
 return {value:minutes/60,base:Math.floor(minutes/30)/2,index:minutes%30};
}
export function alignment(s,loaded=true){
 const left=angle(LINES[s.line].nm,-s.order,s.table),right=angle(LINES[s.line].nm,s.order,s.table);
 const available=left!==null&&right!==null&&left<0&&right>0;
 const delta=available?(right+left)*60:null;
 const stage=!loaded||setupIssue(s)?0:!s.mounted?1:Math.abs(s.table)>.05?2:!s.tableLocked?3:4;
 return {left,right,delta,available,stage};
}
