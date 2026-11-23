// Equivalent primary wave-aberration bench, air, paraxial slopes. Distances mm.
// W is actual-minus-reference OPD in waves on a FIXED 10 mm reference pupil.
export const MODEL='aberration-primary-wave-v1';
export const OPTICS=Object.freeze({focalMm:200,referenceRadiusMm:10,wavelengthMm:.00055,fieldScaleRad:.01});
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const fail=m=>{throw new RangeError(m);};
export function settings(v){
 if(!v||!finite(v.apertureMm,4,20)||!finite(v.field,-1,1)||!finite(v.screenOffsetMm,-3,3)||!finite(v.spherical,-3,3)||!finite(v.coma,-3,3))fail('光阑直径4–20 mm，视场±1，观察面偏移±3 mm，像差系数±3波。');
 return {apertureMm:v.apertureMm,field:v.field,screenOffsetMm:v.screenOffsetMm,spherical:v.spherical,coma:v.coma};
}
/** Fixed reference pupil coordinates, not rescaled to the current aperture. */
export function wavefront(v,x,y){
 const c=settings(v);if(!finite(x,-1,1)||!finite(y,-1,1)||x*x+y*y>1+1e-12)fail('参考瞳坐标超界。');
 const q=x*x+y*y,A=c.spherical,B=c.coma*c.field;
 return {waves:A*q*q+B*x*q,dx:4*A*x*q+B*(3*x*x+y*y),dy:4*A*y*q+2*B*x*y};
}
/** Every display uses these same unexaggerated positions/slopes. */
export function ray(v,x,y){
 const c=settings(v),a=c.apertureMm/(2*OPTICS.referenceRadiusMm);
 if(x*x+y*y>a*a+1e-12)fail('光线被当前光阑挡住。');
 const w=wavefront(c,x,y),{focalMm:f,referenceRadiusMm:R,wavelengthMm:lambda,fieldScaleRad:t}=OPTICS;
 const pupilX=x*R,pupilY=y*R,z=f+c.screenOffsetMm,theta=c.field*t;
 const slopeX=theta-pupilX/f-lambda*w.dx/R,slopeY=-pupilY/f-lambda*w.dy/R;
 const screenX=pupilX+z*slopeX,screenY=pupilY+z*slopeY,chiefX=z*theta;
 return {x,y,pupilX,pupilY,slopeX,slopeY,screenZ:z,screenX,screenY,chiefX,exUm:(screenX-chiefX)*1000,eyUm:screenY*1000,waves:w.waves};
}
/** Equal-area midpoint quadrature in r^2; uniformly spaced angles. */
export function simulate(v,rings=24,angles=96){
 const c=settings(v);if(!Number.isInteger(rings)||rings<4||rings>128||!Number.isInteger(angles)||angles<16||angles>512||angles%4)fail('瞳面采样参数无效。');
 const a=c.apertureMm/20,rays=[];
 for(let j=0;j<rings;j++){const r=a*Math.sqrt((j+.5)/rings);for(let i=0;i<angles;i++){const t=2*Math.PI*i/angles;rays.push(ray(c,r*Math.cos(t),r*Math.sin(t)));}}
 const n=rays.length,centroidXUm=rays.reduce((s,p)=>s+p.exUm,0)/n,centroidYUm=rays.reduce((s,p)=>s+p.eyUm,0)/n;
 const rmsUm=Math.sqrt(rays.reduce((s,p)=>s+(p.exUm-centroidXUm)**2+(p.eyUm-centroidYUm)**2,0)/n);
 const chiefRmsUm=Math.sqrt(rays.reduce((s,p)=>s+p.exUm**2+p.eyUm**2,0)/n);
 const fan=Array.from({length:81},(_,i)=>{const u=a*(i/40-1);return {u,tangential:ray(c,u,0),sagittal:ray(c,0,u)};});
 return {...c,rays,fan,centroidXUm,centroidYUm,rmsUm,chiefRmsUm,screenMm:200+c.screenOffsetMm,idealXmm:(200+c.screenOffsetMm)*c.field*.01,sampling:{rings,angles}};
}
export const fresh=()=>({apertureMm:20,field:0,screenOffsetMm:0,spherical:2,coma:0,task:'spherical',readingUm:null,hints:false,assisted:false,records:[],prediction:'',conclusion:''});
const TASKS=Object.freeze({spherical:'球差与孔径',coma:'彗差与视场',focus:'观察面比较'});
function measurement(m){
 const c=settings(m);
 if(typeof m.task!=='string'||!Object.hasOwn(TASKS,m.task)||!finite(m.readingUm,-600,600)||typeof m.assisted!=='boolean'||m.model!==MODEL||typeof m.at!=='string'||m.at.length>32||!Number.isFinite(Date.parse(m.at)))fail('记录任务、手动读数、版本或时间无效。');
 const r=simulate(c);
 for(const key of ['rmsUm','chiefRmsUm','centroidXUm','centroidYUm'])if(!finite(m[key],-1000,1000)||Math.abs(m[key]-r[key])>1e-8)fail('记录结果与原始条件不符。');
 return {...c,task:m.task,readingUm:m.readingUm,assisted:m.assisted,model:MODEL,at:m.at,rmsUm:r.rmsUm,chiefRmsUm:r.chiefRmsUm,centroidXUm:r.centroidXUm,centroidYUm:r.centroidYUm};
}
export function normalize(v){
 const c=settings(v);
 if(typeof v.task!=='string'||!Object.hasOwn(TASKS,v.task)||(v.readingUm!==null&&!finite(v.readingUm,-600,600))||typeof v.hints!=='boolean'||typeof v.assisted!=='boolean'||!Array.isArray(v.records)||v.records.length>100)fail('实验状态或记录无效。');
 for(const k of ['prediction','conclusion'])if(typeof v[k]!=='string'||v[k].length>4000)fail('文字无效或超过4000字。');
 const records=v.records.map(measurement);
 return {...c,task:v.task,readingUm:v.readingUm,hints:v.hints,assisted:v.assisted||v.hints||records.some(r=>r.assisted),records,prediction:v.prediction,conclusion:v.conclusion};
}
export function changeSettings(s,p){
 const changed=Object.keys(settings(s)).some(k=>Object.hasOwn(p,k)&&p[k]!==s[k]);
 return normalize({...s,...p,readingUm:changed?null:(Object.hasOwn(p,'readingUm')?p.readingUm:s.readingUm),assisted:!!(s.assisted||p.assisted||p.hints)});
}
export function record(s,at=new Date().toISOString()){
 s=normalize(s);if(s.records.length>=100)fail('最多保存100条记录。');
 if(s.readingUm===null)fail('请先从固定刻度点列窗读取横向位置（μm）。');
 const r=simulate(s),m=measurement({...s,...r,model:MODEL,at});return {...s,records:[...s.records,m]};
}
export function report(v){
 const s=normalize(v);
 return {title:'像差实验',model:MODEL,columns:['组次/任务','孔径/mm','视场/屏偏移mm','球差/彗差系数λ','手动横向读数/μm','质心X/μm','质心RMS/μm','辅助/UTC'],
 rows:s.records.map((r,i)=>[`${i+1} ${TASKS[r.task]}`,r.apertureMm.toFixed(2),`${r.field.toFixed(2)} / ${r.screenOffsetMm.toFixed(2)}`,`${r.spherical.toFixed(2)} / ${r.coma.toFixed(2)}`,r.readingUm.toFixed(2),r.centroidXUm.toFixed(3),r.rmsUm.toFixed(3),`${r.assisted?'辅助':'自主'}\n${r.at}`]),
 summaries:[`共${s.records.length}条记录。手动横向位置来自学生读图；质心及RMS为独立计算值。`,'预测：'+s.prediction,'结论：'+s.conclusion],series:[],formula:'令w=W/λ=A(x²+y²)²+BHx(x²+y²)。附加斜率=−(λ/R)grad(w)；观察面位置=瞳面位置+传播距离×总斜率。',
 limitation:'550 nm，200 mm等效焦距，固定参考瞳半径10 mm，空气近轴初级球差/彗差模型。不是具体镜头处方或精确表面追迹。RMS为均匀瞳面采样的几何光斑质心半径，不等于衍射分辨率；不逐图缩放坐标。'};
}
