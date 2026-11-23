// Gaussian field radii are 1/e amplitude (1/e² intensity) radii, in metres.
export const MODEL='fiber-five-axis-v2';
export const LEGACY_MODEL='fiber-gaussian-overlap-v1';
export const CONFIG=Object.freeze({id:'fsv-633-matched',wavelengthNm:633,mfdUm:4.3,beamRadiusUm:2.15,rangeUm:10,stepUm:.01,source:'Newport Technical Note 14, F-SV @ 633 nm'});
const fail=m=>{throw Error(m);};
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
export function gaussianOverlap({beamRadiusM,fiberRadiusM,xM=0,yM=0,tiltRad=0,wavelengthM}){
 if(![beamRadiusM,fiberRadiusM,wavelengthM].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0)||![xM,yM,tiltRad].every(v=>typeof v==='number'&&Number.isFinite(v)))fail('模场、波长和偏移必须是有效物理量。');
 const sum=beamRadiusM**2+fiberRadiusM**2;
 const spatial=(2*beamRadiusM*fiberRadiusM/sum)**2*Math.exp(-2*(xM*xM+yM*yM)/sum);
 const angular=Math.exp(-2*Math.PI**2*beamRadiusM**2*fiberRadiusM**2*tiltRad**2/(wavelengthM**2*sum));
 return Math.min(1,Math.max(0,spatial*angular));
}
// Marcuse approximation is deliberately bounded; unsupported original-page cases have no SM result.
export function singleModeRadiusUm(coreRadiusUm,V){
 if(!finite(coreRadiusUm,Number.MIN_VALUE,1000)||!finite(V,1.5,2.404999999))return null;
 return coreRadiusUm*(.65+1.619/V**1.5+2.879/V**6);
}
export const AXES=Object.freeze({
 xUm:{id:'x',label:'横向 X',unit:'μm',min:-10,max:10,step:.01,nudge:.1,knob:'KnobX'},
 yUm:{id:'y',label:'竖直 Y',unit:'μm',min:-10,max:10,step:.01,nudge:.1,knob:'KnobY'},
 axialUm:{id:'z',label:'轴向 Z',unit:'μm',min:-100,max:100,step:.1,nudge:1,knob:'KnobZ'},
 pitchMrad:{id:'pitch',label:'俯仰',unit:'mrad',min:-30,max:30,step:.1,nudge:1,knob:'KnobPitch'},
 yawMrad:{id:'yaw',label:'偏转',unit:'mrad',min:-30,max:30,step:.1,nudge:1,knob:'KnobYaw'}
});
export const fresh=()=>({config:CONFIG.id,xUm:3,yUm:2,axialUm:0,pitchMrad:0,yawMrad:0,sourceOn:true,task:'align',scanYUm:null,scanFixed:null,hints:false,assisted:false,records:[],prediction:'',conclusion:''});
export function settings(s){
 if(!s||s.config!==CONFIG.id)fail('仅支持633 nm、模场直径4.3 μm的固定单模配置。');
 const c={config:CONFIG.id,sourceOn:s.sourceOn};
 if(typeof s.sourceOn!=='boolean')fail('光源状态无效。');
 for(const [key,a] of Object.entries(AXES)){
  const v=s[key]===undefined&&!['xUm','yUm'].includes(key)?0:s[key];
  if(!finite(v,a.min,a.max))fail(a.label+'须在'+a.min+'至'+a.max+' '+a.unit+'内。');c[key]=v;
 }
 return c;
}
export function beamAt(axialUm){
 const w0=CONFIG.beamRadiusUm,lambda=CONFIG.wavelengthNm/1000,zR=Math.PI*w0*w0/lambda;
 return {radiusUm:w0*Math.hypot(1,axialUm/zR),zRUm:zR,curvature:axialUm/(axialUm*axialUm+zR*zR)};
}
// Analytic integral of two normalized complex Gaussian fields at the fiber input plane.
// E_b ~ exp[-r²/wb² + i*k*r²/(2R)], E_f ~ exp[-|r-d|²/wf² + i*k*theta.(r-d)].
// Units here are micrometres; pitch/yaw are converted from mrad to phase slope.
// Unlike a product of independent losses, this retains offset/curvature/tilt cross terms.
export function power(s){
 const c=settings(s);if(!c.sourceOn)return 0;
 const b=beamAt(c.axialUm),wf=CONFIG.mfdUm/2,k=2*Math.PI/(CONFIG.wavelengthNm/1000);
 const ar=1/b.radiusUm**2+1/wf**2,ai=-k*b.curvature/2,den=ar*ar+ai*ai;
 let exponent=-2*(c.xUm*c.xUm+c.yUm*c.yUm)/(wf*wf);
 for(const [offset,theta] of [[c.xUm,c.yawMrad/1000],[c.yUm,c.pitchMrad/1000]]){
  const br=2*offset/(wf*wf),bi=-k*theta;
  exponent+=((br*br-bi*bi)*ar+2*br*bi*ai)/(2*den);
 }
 return Math.max(0,Math.min(1,4/(b.radiusUm*b.radiusUm*wf*wf*den)*Math.exp(exponent)));
}
const fixed=s=>({yUm:s.yUm,axialUm:s.axialUm,pitchMrad:s.pitchMrad,yawMrad:s.yawMrad});
export const sameScan=(a,b)=>Object.keys(fixed(a)).every(k=>a[k]===b[k]);
function measurement(r){
 const c=settings(r),legacy=r.model===LEGACY_MODEL&&c.axialUm===0&&c.pitchMrad===0&&c.yawMrad===0;
 if(!['align','scan'].includes(r.task)||!c.sourceOn||!(r.model===MODEL||legacy)||typeof r.assisted!=='boolean'||typeof r.at!=='string'||r.at.length>32||!Number.isFinite(Date.parse(r.at))||!finite(r.power,0,1)||Math.abs(r.power-power(c))>1e-12)fail('测量记录、模型版本或归一化读数无效。');
 return {...c,task:r.task,power:r.power,model:MODEL,assisted:r.assisted,at:r.at};
}
export function normalize(s){
 const c=settings(s);
 if(!['align','scan'].includes(s.task)||!(s.scanYUm===null||finite(s.scanYUm,-10,10))||(s.task==='scan'&&s.scanYUm!==c.yUm))fail('扫描任务需要锁定Y。');
 const scanFixed=s.task==='scan'?(s.scanFixed??fixed(c)):null;
 if(scanFixed&&!sameScan(scanFixed,c))fail('扫描期间Y、Z及倾角条件必须锁定。');
 if(!Array.isArray(s.records)||s.records.length>200)fail('最多记录200条读数。');
 for(const k of ['hints','assisted'])if(typeof s[k]!=='boolean')fail('辅助状态无效。');
 for(const k of ['prediction','conclusion'])if(typeof s[k]!=='string'||s[k].length>4000)fail('实验文字无效或超过4000字。');
 const records=s.records.map(measurement);
 return {...c,task:s.task,scanYUm:s.scanYUm,scanFixed:scanFixed?fixed(c):null,hints:s.hints,assisted:s.assisted||s.hints||records.some(r=>r.assisted),records,prediction:s.prediction,conclusion:s.conclusion};
}
export function changeSettings(s,patch){
 if(s.task==='scan'&&patch.task!=='align'&&Object.keys(fixed(s)).some(k=>patch[k]!==undefined&&patch[k]!==s[k]))fail('扫描时Y、Z和倾角已锁定；请先返回对准任务。');
 const next={...s,...patch};
 if(patch.task==='scan'){next.scanYUm=next.yUm;next.scanFixed=fixed(next);}
 if(patch.task==='align'){next.scanYUm=null;next.scanFixed=null;}
 return normalize(next);
}
export function record(s,at=new Date().toISOString()){
 s=normalize(s);if(!s.sourceOn)fail('请开启光源后记录。');if(s.records.length>=200)fail('已达到200条记录上限。');
 if(s.records.some(r=>r.task===s.task&&Object.keys(AXES).every(k=>r[k]===s[k])))fail('该任务的这个五轴位置已记录，请选择其他位置。');
 const r=measurement({...settings(s),task:s.task,power:power(s),model:MODEL,at,assisted:s.assisted});
 return {...s,records:[...s.records,r]};
}
export function report(s){
 s=normalize(s);const groups=[];
 for(const r of s.records.filter(r=>r.task==='scan')){let g=groups.find(g=>sameScan(g[0],r));if(!g){g=[];groups.push(g);}g.push(r);}
 const caption=r=>'Y='+r.yUm.toFixed(2)+' μm / Z='+r.axialUm.toFixed(1)+' μm / 俯仰='+r.pitchMrad.toFixed(1)+' / 偏转='+r.yawMrad.toFixed(1)+' mrad';
 return {title:'五轴光纤耦合实验',model:MODEL,columns:['组次','任务','X/μm','Y/μm','Z/μm','俯仰/mrad','偏转/mrad','P/P入射','辅助','记录时间/UTC'],
 rows:s.records.map((r,i)=>[String(i+1),r.task==='align'?'对准':'扫描',r.xUm.toFixed(2),r.yUm.toFixed(2),r.axialUm.toFixed(1),r.pitchMrad.toFixed(1),r.yawMrad.toFixed(1),r.power.toPrecision(6),r.assisted?'使用提示':'自主读数',r.at.replace('T','\n')]),
 summaries:[...groups.map(rs=>{const peak=rs.reduce((a,b)=>a.power>b.power?a:b);return caption(rs[0])+'：'+rs.length+'个采样点；已采样峰 X='+peak.xUm.toFixed(2)+' μm，P/P入射='+peak.power.toPrecision(5)+'。'+(rs.length<9?'建议至少9点。':'')+(rs.some(r=>r.xUm<peak.xUm)&&rs.some(r=>r.xUm>peak.xUm)?'已覆盖采样峰两侧。':'尚未覆盖采样峰两侧，不能认定找到峰值。');}),'预测：'+s.prediction,'结论：'+s.conclusion],
 series:groups.map(rs=>({title:caption(rs[0]),xLabel:'X / μm',yLabel:'P / P入射',points:[...rs].sort((a,b)=>a.xUm-b.xUm).map(r=>({x:r.xUm,y:r.power}))})),
 formula:'η=|A|²；A 为 Eb Ef* 在端面区域的二维积分。两个复高斯场分别按功率归一化，包含离焦曲率和两轴倾斜相位。零离焦、零倾角时 η=exp[−(x²+y²)/w₀²]，w₀=2.15 μm。',
 limitation:'633 nm理想近轴单模模型；端面为角度调节中心，倾角以mrad表示。Z以入射束腰平面为零点。忽略端面反射、连接器与传播损耗、噪声及回差；显示的是模式重叠而非真实绝对功率。数值步进不是实物精度；外观尺寸为教学设计。'};
}
