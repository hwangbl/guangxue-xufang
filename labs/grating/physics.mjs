import {signed,separation,readouts,dms,motionIssue} from '../spectrometer/physics.mjs';
export {signed,separation,readouts,dms,motionIssue};
export const DENSITY=600,SPACING_NM=1e6/DENSITY;
export const LINES={sodium:{name:'钠黄线（等效单线）',nm:589.3,color:'#ffdb63',source:'sodium'},green:{name:'汞绿线',nm:546.1,color:'#89ff87',source:'mercury'},blue:{name:'汞蓝线',nm:435.8,color:'#8d9cff',source:'mercury'}};
export const fresh=()=>({lamp:false,mounted:false,source:'sodium',line:'sodium',order:1,telescope:3,table:4,focus:1,collimator:-1,diopter:.5,tiltX:.12,tiltZ:-.1,slit:.6,telescopeLocked:false,tableLocked:false,telescopeAnchor:3,tableAnchor:4,slots:{},records:[],assisted:false});
// Tangential phase matching: beta = alpha + asin(m*lambda/d - sin(alpha)).
// The grating normal makes angle alpha to the incident ray; zero order stays at zero.
export function angle(nm,m,alpha=0){if(!Number.isFinite(nm)||nm<=0||!Number.isInteger(m)||!Number.isFinite(alpha)||Math.abs(alpha)>=90)return null;const v=m*nm/SPACING_NM-Math.sin(alpha*Math.PI/180);return Math.abs(v)>1?null:alpha+Math.asin(v)*180/Math.PI;}
export function beams(s){if(!s.mounted)return [{angle:0,order:0,line:s.line,color:s.source==='mercury'?'#e6fff0':'#ffdb63'}];const list=[{angle:0,order:0,line:s.line,color:s.source==='mercury'?'#e6fff0':'#ffdb63'}];for(const [line,info]of Object.entries(LINES)){if(info.source!==s.source)continue;for(const m of [-2,-1,1,2]){const a=angle(info.nm,m,s.table);if(a!==null)list.push({angle:a,order:m,line,color:info.color});}}return list;}
export function setupIssue(s){if(!s.lamp)return '请先开启光源。';if(Math.abs(s.diopter)>.2)return '请先调节目镜视度，使叉丝清晰。';if(Math.abs(s.focus)>.25||Math.abs(s.collimator)>.25)return '狭缝像模糊，请调节两镜筒焦距。';if(Math.abs(s.tiltX)>.05||Math.abs(s.tiltZ)>.05)return '请调平载物台，使谱线与横丝等高。';if(s.slit>.3)return '狭缝过宽，请收窄至0.30 mm以内。';return '';}
export function target(s,side){return beams(s).find(b=>side==='zero'?b.order===0:b.order===(side==='left'?-s.order:s.order)&&b.line===s.line);}
export function recordIssue(s,side,loaded=true){if(!loaded)return '模型尚未就绪。';if(!['zero','left','right'].includes(side))return '请选择有效测量位置。';const issue=setupIssue(s);if(issue)return issue;if(!s.mounted)return '请将光栅放上载物台。';if(Math.abs(s.table)>.05)return '光栅未正对入射光，请调正至法线偏角不超过0.05°。';if(!s.tableLocked)return '请锁紧载物台，测量期间保持光栅方位不变。';if(!s.telescopeLocked)return '请锁紧望远镜，再微动对准。';if(side!=='zero'&&!s.slots.zero)return '请先记录零级位置。';const b=target(s,side);if(!b)return '所选级次无可传播谱线，请更换级次。';if(separation(s.telescope,b.angle)>1.1/60)return '尚未对准所选谱线，微动使谱线中心与纵丝重合。';return '';}
export function snapshot(s){return {values:readouts(s.telescope),table:s.table,line:s.line,order:s.order,source:s.source};}
export function calculate(slots){
 const a=['zero','left','right'].map(k=>slots?.[k]);if(a.some(v=>!v))throw Error('请记录零级及左右同级谱线。');
 for(const r of a){if(!LINES[r.line]||r.source!==LINES[r.line].source||![1,2].includes(r.order)||!Number.isFinite(r.table)||Math.abs(r.table)>.05)throw Error('光源、级次或光栅方位无效。');if(!Array.isArray(r.values)||r.values.length!==2||r.values.some(v=>!Number.isFinite(v)||v<0||v>=360)||Math.abs(separation(...r.values)-180)>2/60)throw Error('双游标读数无效。');}
 const [z,l,r]=a;if(a.some(v=>v.line!==z.line||v.order!==z.order||v.source!==z.source||Math.abs(v.table-z.table)>1e-8))throw Error('本组光源、谱线、级次或光栅方位发生变化，请重新记录。');
 const left=z.values.map((v,i)=>signed(l.values[i]-v)),right=z.values.map((v,i)=>signed(r.values[i]-v));
 if(left.some(v=>v>=0||v<=-90)||right.some(v=>v<=0||v>=90))throw Error('左右谱线必须位于零级两侧，且各自偏角小于90°。');
 if(Math.abs(left[0]-left[1])>2/60||Math.abs(right[0]-right[1])>2/60)throw Error('两游标角度差不一致。');
 const thetaL=-(left[0]+left[1])/2,thetaR=(right[0]+right[1])/2;
 if(Math.abs(thetaL-thetaR)>.1)throw Error('左右谱线不对称，请复核光栅调正或谱线选择。');
 const theta=(thetaL+thetaR)/2,wave=SPACING_NM*Math.sin(theta*Math.PI/180)/z.order;
 if(wave<380||wave>780)throw Error('波长超出本实验的可见光范围，请复核读数。');return {thetaL,thetaR,theta,wave,line:z.line,order:z.order};
}
export function restore(raw){const s=fresh();let dropped=0;try{const d=JSON.parse(raw);if(d?.version!==1||!Array.isArray(d.records))return {s,dropped:1};for(const r of d.records.slice(-200)){try{s.records.push({...calculate(r.slots),slots:r.slots,assisted:!!r.assisted});}catch{dropped++;}}}catch{dropped=1;}return {s,dropped};}
export function csv(records){return '\ufeff'+['组次,谱线,级次,刻线密度_lines_mm,零_I_deg,零_II_deg,左_I_deg,左_II_deg,右_I_deg,右_II_deg,左偏角_deg,右偏角_deg,平均角_deg,波长_nm,辅助',...records.map((r,i)=>[i+1,LINES[r.line].name,r.order,DENSITY,...['zero','left','right'].flatMap(k=>r.slots[k].values.map(v=>v.toFixed(6))),r.thetaL.toFixed(6),r.thetaR.toFixed(6),r.theta.toFixed(6),r.wave.toFixed(4),r.assisted?'是':'否'].join(','))].join('\r\n');}
