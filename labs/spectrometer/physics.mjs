export const APEX=60, INDEX=1.6475, WAVELENGTH=589.3;
const rad=Math.PI/180;
export const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export const wrap=x=>((x%360)+360)%360;
export const signed=x=>wrap(x+180)-180;
export const separation=(a,b)=>Math.abs(signed(a-b));
export const quantize=x=>wrap(Math.round(wrap(x)*60)/60);
export function dms(x){const m=Math.round(wrap(x)*60)%21600;return `${Math.floor(m/60)}° ${String(m%60).padStart(2,'0')}′`;}
export function readouts(angle){return [quantize(angle+90),quantize(angle+270)];}
export function deviation(table){
 const i=30-table;
 if(i<=0||i>=90)return null;
 const r1=Math.asin(Math.sin(i*rad)/INDEX)/rad,r2=APEX-r1,exit=INDEX*Math.sin(r2*rad);
 if(r2<0||exit>1)return null;
 return i+Math.asin(exit)/rad-APEX;
}
export const minimumTable=30-Math.asin(INDEX*Math.sin(APEX*rad/2))/rad;
export function beams(s){
 if(s.mode==='direct')return [{angle:0,label:'直射像'}];
 if(s.mode==='reflect')return Math.abs(s.table-90)<=15?[{angle:signed(2*s.table+240),label:'左反射像'},{angle:signed(2*s.table+480),label:'右反射像'}]:[];
 const d=deviation(s.table);return d===null?[]:[{angle:-d,label:'折射像'}];
}
export function alignmentIssue(s){
 if(!s.lamp)return '请先开启钠灯。';
 if(Math.abs(s.diopter)>.2)return '叉丝不清晰，请调节目镜视度。';
 if(Math.abs(s.focus)>.25||Math.abs(s.collimator)>.25)return '狭缝像不清晰，请调节望远镜与平行光管焦距。';
 if(Math.abs(s.tiltX)>.05||Math.abs(s.tiltZ)>.05)return '载物台未调平，请调节两个倾斜方向。';
 if(s.slit>.3)return '狭缝过宽，请收窄至 0.30 mm 以内。';
 return '';
}
export function minimumBracketed(samples){return samples.some(p=>p.table<minimumTable-.2)&&samples.some(p=>p.table>minimumTable+.2);}
export function motionIssue(s,id,value,fine=false){
 if(!['telescope','table'].includes(id))return '';
 if(!Number.isFinite(value))return '请输入有效角度。';
 if(fine&&!s[id+'Locked'])return '请先锁紧，再使用微动。';
 if(!fine&&s[id+'Locked'])return '已锁紧：请使用微动，或先松开再粗调。';
 if(fine&&Math.abs(signed(value-s[id+'Anchor']))>2+1e-8)return '微动已到 ±2° 教学行程边界，请松开、重新粗定位后锁紧。';
 return '';
}
export function recordIssue(s,target,loaded=true){
 if(!loaded)return '三维仪器尚未就绪。';
 const issue=alignmentIssue(s);if(issue)return issue;
 if(!s.telescopeLocked)return '请先锁紧望远镜，再微动对准后读数。';
 if(target!=='direct'&&!s.tableLocked)return '请先锁紧载物台再记录。';
 const modes={left:'reflect',right:'reflect',direct:'direct',minimum:'refract'};
 if(s.mode!==modes[target])return '请先切换到对应的观察方式。';
 const beam=beams(s)[target==='right'?1:0];
 if(!beam)return '当前棱镜方位无可见光束，请调整载物台。';
 if(separation(s.telescope,beam.angle)>1.1/60)return '狭缝像未对准纵丝，请微调望远镜至偏差不超过 1′。';
 if(target==='minimum'){
  if(!minimumBracketed(s.samples))return '请转动载物台，观察折射像在最低偏向位置两侧的折返。';
  if(Math.abs(s.table-minimumTable)>.25)return '尚未到最小偏向位置，请回到折返附近再对准。';
 }
 return '';
}
export function pairAngle(a,b){
 if(![a,b].every(v=>Array.isArray(v)&&v.length===2&&v.every(x=>Number.isFinite(x)&&x>=0&&x<360)))throw Error('双游标读数无效。');
 for(const v of [a,b])if(Math.abs(separation(...v)-180)>2/60)throw Error('两游标相差应为 180°，请复核。');
 const d=a.map((x,i)=>separation(x,b[i]));
 if(Math.abs(d[0]-d[1])>2/60)throw Error('两游标的角度差不一致，请复核。');
 return (d[0]+d[1])/2;
}
export function calculate(slots){
 if(!['left','right','direct','minimum'].every(k=>slots[k]))throw Error('请完成左右反射、直射和最小偏向四次读数。');
 if(Math.abs(slots.left.table-slots.right.table)>1e-6)throw Error('测顶角期间载物台发生转动，请重新记录两面反射像。');
 const a=pairAngle(slots.left.values,slots.right.values)/2,d=pairAngle(slots.direct.values,slots.minimum.values);
 if(a<40||a>80||d<=0||d>=90||a+d>=180)throw Error('角度不在本教学棱镜的有效范围，请复核。');
 const n=Math.sin((a+d)*rad/2)/Math.sin(a*rad/2);
 if(!Number.isFinite(n)||n<=1||n>=2)throw Error('折射率结果无效，请重新测量。');
 return {a,d,n};
}
export const fresh=()=>({telescopeLocked:false,tableLocked:false,telescopeAnchor:3,tableAnchor:90,lamp:false,mode:'direct',telescope:3,table:90,focus:1.2,collimator:-1,diopter:.7,tiltX:.15,tiltZ:-.12,slit:.6,slots:{},samples:[],records:[],assisted:false});
export function restore(raw){
 const s=fresh();let dropped=0;
 try{const data=JSON.parse(raw);if(!data||data.version!==1)return {s,dropped:1};
  for(const r of Array.isArray(data.records)?data.records.slice(-200):[]){
   try{const result=calculate(r.slots);if(!Number.isFinite(r.slots.left.table)||!Number.isFinite(r.slots.right.table))throw Error();s.records.push({slots:r.slots,...result,assisted:!!r.assisted});}catch{dropped++;}
  }
 }catch{dropped=1;}
 return {s,dropped};
}
export function csv(records){
 const head='组次,波长_nm,左_I_deg,左_II_deg,右_I_deg,右_II_deg,直射_I_deg,直射_II_deg,最小_I_deg,最小_II_deg,顶角_deg,最小偏向角_deg,折射率,辅助操作';
 return '\ufeff'+[head,...records.map((r,i)=>[i+1,WAVELENGTH,...['left','right','direct','minimum'].flatMap(k=>r.slots[k].values.map(x=>x.toFixed(6))),r.a.toFixed(6),r.d.toFixed(6),r.n.toFixed(6),r.assisted?'是':'否'].join(','))].join('\r\n');
}
