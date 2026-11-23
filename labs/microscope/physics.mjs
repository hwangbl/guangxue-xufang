// Finite-conjugate ideal teaching microscope. Optical distances mm; specimen µm.
export const MODEL='microscope-finite-scalar-v1';
export const OBJECTIVES=Object.freeze({
 low:Object.freeze({label:'10× / NA 0.25',magnification:10,na:.25,workingDistanceMm:4.4}),
 high:Object.freeze({label:'40× / NA 0.65',magnification:40,na:.65,workingDistanceMm:.6}),
});
export const SAMPLES=Object.freeze({ruler:'10 μm刻线',points:'0.8 μm双点'});
const finite=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const fail=m=>{throw new RangeError(m);};
export function settings(s){
 if(!s||typeof s.objective!=='string'||!Object.hasOwn(OBJECTIVES,s.objective)||typeof s.sample!=='string'||!Object.hasOwn(SAMPLES,s.sample))fail('请选择10×/40×物镜和教学样品。');
 if(!finite(s.focusUm,-20,20)||!finite(s.stageXUm,-500,500)||!finite(s.stageYUm,-500,500))fail('调焦范围±20 μm，样品XY范围±500 μm。');
 return {objective:s.objective,sample:s.sample,focusUm:s.focusUm,stageXUm:s.stageXUm,stageYUm:s.stageYUm};
}
export function simulate(s){
 const c=settings(s),o=OBJECTIVES[c.objective],v0=160,u0=v0/o.magnification,f=v0/(o.magnification+1),u=u0-c.focusUm/1000;
 const imageDistanceMm=f*u/(u-f),lateralMagnification=-v0/u;
 return {...c,...o,wavelengthUm:.55,eyepiece:10,fieldNumberMm:20,imagePlaneMm:v0,
  focalLengthMm:f,objectDistanceMm:u,nominalObjectDistanceMm:u0,imageDistanceMm,lateralMagnification,
  totalMagnification:Math.abs(lateralMagnification)*10,fieldUm:20000/Math.abs(lateralMagnification),
  rayleighUm:.61*.55/o.na,abbeUm:.55/(2*o.na),workingGapMm:o.workingDistanceMm-c.focusUm/1000,
  focused:Math.abs(c.focusUm)<1e-9,scalarDefocus:Math.PI*o.na**2*c.focusUm/.55};
}

// J0 rational approximation (Abramowitz-Stegun form); suitable for pupil quadrature.
export function besselJ0(x){
 x=Math.abs(x);if(!Number.isFinite(x))fail('径向参数无效。');
 if(x<8){const y=x*x;return (57568490574+y*(-13362590354+y*(651619640.7+y*(-11214424.18+y*(77392.33017+y*(-184.9052456))))))/(57568490411+y*(1029532985+y*(9494680.718+y*(59272.64853+y*(267.8532712+y)))));}
 const z=8/x,y=z*z,p=1+y*(-.001098628627+y*(.00002734510407+y*(-.000002073370639+y*.0000002093887211))),q=-.01562499995+y*(.0001430488765+y*(-.000006911147651+y*(.0000007621095161-y*.0000000934945152)));
 return Math.sqrt(.636619772/x)*(Math.cos(x-.785398164)*p-z*Math.sin(x-.785398164)*q);
}
/** Scalar circular pupil with quadratic defocus, intensity normalized to focused peak.
 * No per-image normalization: defocus lowers the peak. Radius/defocus in object-space µm.
 * Teaching approximation, not a vector high-NA or full retinal model.
 */
export function psf(radiusUm,focusUm,na,steps=128){
 if(!finite(radiusUm,0,100)||!finite(focusUm,-20,20)||!finite(na,.1,.65)||!Number.isInteger(steps)||steps<32||steps>2048||steps%2)fail('点扩散函数参数或采样数无效。');
 const k=2*Math.PI*na*radiusUm/.55,a=Math.PI*na*na*focusUm/.55;
 let re=0,im=0;
 for(let i=0;i<=steps;i++){const rho=i/steps,w=(i===0||i===steps?1:i%2?4:2)*rho*besselJ0(k*rho),phase=a*rho*rho;re+=w*Math.cos(phase);im+=w*Math.sin(phase);}
 re*=2/(3*steps);im*=2/(3*steps);return re*re+im*im;
}
/** Fixed normalized observation coordinate [-.5,.5] to specimen; inverted image. */
export function specimenPoint(s,nx,ny){
 if(!finite(nx,-.5,.5)||!finite(ny,-.5,.5))fail('请在观察窗内选点。');
 const r=simulate(s);return {xUm:-nx*r.fieldUm-s.stageXUm,yUm:ny*r.fieldUm-s.stageYUm};
}
export const fresh=()=>({objective:'low',sample:'ruler',focusUm:8,stageXUm:0,stageYUm:0,task:'focus',picks:[],hints:false,assisted:false,records:[],prediction:'',conclusion:''});
const TASKS=Object.freeze({focus:'调焦对照',measure:'刻线测量',resolution:'双点分辨'});
function picks(value){if(!Array.isArray(value)||value.length>2||value.some(p=>!p||!finite(p.nx,-.5,.5)||!finite(p.ny,-.5,.5)))fail('测量选点无效。');return value.map(p=>({nx:p.nx,ny:p.ny}));}
function measurement(m){
 const c=settings(m),p=picks(m.picks),r=simulate(c);
 if(typeof m.task!=='string'||!Object.hasOwn(TASKS,m.task)||typeof m.assisted!=='boolean'||m.model!==MODEL||typeof m.at!=='string'||m.at.length>32||!Number.isFinite(Date.parse(m.at)))fail('记录版本、任务或时间无效。');
 if(m.task==='measure'&&(c.sample!=='ruler'||p.length!==2))fail('刻线测量需要两个选点。');
 const a=p.length===2?specimenPoint(c,p[0].nx,p[0].ny):null,b=p.length===2?specimenPoint(c,p[1].nx,p[1].ny):null;
 const measuredUm=a?Math.hypot(a.xUm-b.xUm,a.yUm-b.yUm):null;
 for(const [key,value] of Object.entries({measuredUm,fieldUm:r.fieldUm,rayleighUm:r.rayleighUm}))if(m[key]!==value&&!(typeof m[key]==='number'&&value!==null&&Math.abs(m[key]-value)<1e-8))fail('记录结果与原始条件不符。');
 return {...c,picks:p,task:m.task,assisted:m.assisted,model:MODEL,at:m.at,measuredUm,fieldUm:r.fieldUm,rayleighUm:r.rayleighUm};
}
export function normalize(s){
 const c=settings(s),p=picks(s.picks);
 if(typeof s.task!=='string'||!Object.hasOwn(TASKS,s.task)||typeof s.hints!=='boolean'||typeof s.assisted!=='boolean'||!Array.isArray(s.records)||s.records.length>200)fail('实验任务或记录无效。');
 for(const key of ['prediction','conclusion'])if(typeof s[key]!=='string'||s[key].length>4000)fail('文字无效或超过4000字。');
 const records=s.records.map(measurement);
 return {...c,picks:p,task:s.task,hints:s.hints,assisted:s.assisted||s.hints||records.some(r=>r.assisted),records,prediction:s.prediction,conclusion:s.conclusion};
}
export function changeSettings(s,p){
 const changed=Object.keys(settings(s)).some(key=>Object.hasOwn(p,key)&&p[key]!==s[key]);
 return normalize({...s,...p,picks:changed?[]:(p.picks??s.picks),assisted:!!(s.assisted||p.assisted||p.hints)});
}
export function record(s,at=new Date().toISOString()){
 s=normalize(s);if(s.records.length>=200)fail('最多保存200条记录。');
 const r=simulate(s),p=s.picks,a=p.length===2?specimenPoint(s,p[0].nx,p[0].ny):null,b=p.length===2?specimenPoint(s,p[1].nx,p[1].ny):null;
 const m=measurement({...s,model:MODEL,at,fieldUm:r.fieldUm,rayleighUm:r.rayleighUm,measuredUm:a?Math.hypot(a.xUm-b.xUm,a.yUm-b.yUm):null});
 return {...s,records:[...s.records,m]};
}
export function report(s){
 s=normalize(s);return {title:'显微镜实验',model:MODEL,columns:['组次/任务','物镜/样品','调焦/μm','XY/μm','物方视场/μm','测得距离/μm','瑞利参考/μm','辅助/UTC'],
 rows:s.records.map((r,i)=>[`${i+1} ${TASKS[r.task]}`,`${OBJECTIVES[r.objective].label}\n${SAMPLES[r.sample]}`,r.focusUm.toFixed(2),`${r.stageXUm}\n${r.stageYUm}`,r.fieldUm.toFixed(3),r.measuredUm===null?'—':r.measuredUm.toFixed(3),r.rayleighUm.toFixed(3),`${r.assisted?'辅助':'自主'}\n${r.at}`]),
 summaries:[`共${s.records.length}条记录。测得距离来自两个手动选点，未自动填入标称刻线间距。`,'预测：'+s.prediction,'结论：'+s.conclusion],series:[],
 formula:'1/f=1/u+1/v；固定像面横倍率m=−160/u。瑞利参考d=0.61λ/NA。',limitation:'550 nm，固定10×目镜，有限共轭理想教学模型；160 mm是所选像方主平面距离，不是厂家机械筒长。标量圆瞳离焦近似，不模拟完整高NA矢量、盖玻片像差或人眼调节。'};
}
