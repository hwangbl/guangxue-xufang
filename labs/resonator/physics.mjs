// Air, coaxial spherical mirrors. All solver lengths are mm; null radius means plane.
export const MODEL='resonator-hg-v2';
export const LEGACY_MODEL='resonator-tem00-v1';
// Normalized one-dimensional HG intensity; integral over x is one.
export function modeIntensity1D(n,x,w){
 if(!Number.isInteger(n)||n<0||n>5||!Number.isFinite(x)||!Number.isFinite(w)||w<=0)throw RangeError('无效横模或光束尺度。');
 const u=Math.SQRT2*x/w;let h=1,prev=0,fact=1;
 for(let j=1;j<=n;j++){const next=2*u*h-2*(j-1)*prev;prev=h;h=next;fact*=j;}
 return Math.sqrt(2/Math.PI)/w*h*h*Math.exp(-u*u)/(2**n*fact);
}
export const MIRRORS=Object.freeze({plane:{label:'平面镜',radius:null},r200:{label:'凹面镜 R=200 mm',radius:200},r300:{label:'凹面镜 R=300 mm',radius:300}});
export const LABELS=Object.freeze({stable:'稳定',confocal:'共焦退化',marginal:'临界',unstable:'不稳定',invalid:'数值不可用'});
export function classify(g1,g2){
 if(!Number.isFinite(g1)||!Number.isFinite(g2)||!Number.isFinite(g1*g2))return 'invalid';
 // Exact design endpoints only: never classify using rounded display values.
 if(g1===0&&g2===0)return 'confocal';
 const p=g1*g2;if(p===0||p===1)return 'marginal';
 return p>0&&p<1?'stable':'unstable';
}
export function solve(R1,R2,L,wavelengthMm=.0006328){
 const validR=r=>r===null||(typeof r==='number'&&Number.isFinite(r)&&r!==0);
 if(!validR(R1)||!validR(R2)||![L,wavelengthMm].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0))throw RangeError('曲率须非零且有限；腔长和波长须为正有限数。');
 const c1=R1===null?0:1/R1,c2=R2===null?0:1/R2;
 const g1=R1===null?1:1-L/R1,g2=R2===null?1:1-L/R2,g1g2=g1*g2;
 const a=1-2*L*c2,b=2*L*g2,roundTrip={a,b,c:-2*c1*a-2*c2,d:a-2*c1*b};
 let status=classify(g1,g2),waistPos=null,zR=null,w0=null,w1=null,w2=null;
 if(status==='confocal'){waistPos=L/2;zR=L/2;}
 else if(status==='stable'){
  const den=g1+g2-2*g1g2;
  waistPos=L*g2*(1-g1)/den;zR=L*Math.sqrt(g1g2*(1-g1g2))/Math.abs(den);
 }
 if(zR!==null){w0=Math.sqrt(wavelengthMm*zR/Math.PI);w1=w0*Math.hypot(1,waistPos/zR);w2=w0*Math.hypot(1,(L-waistPos)/zR);}
 if(!Object.values(roundTrip).every(Number.isFinite)||(zR!==null&&(![waistPos,zR,w0,w1,w2].every(Number.isFinite)||zR<=0||w0<=0))){status='invalid';waistPos=zR=w0=w1=w2=null;}
 const widthAt=z=>zR!==null&&Number.isFinite(z)?w0*Math.hypot(1,(z-waistPos)/zR):null;
 const reason=status==='confocal'?'展示选定的对称高斯模；退化往返方程不唯一确定该模式。':status==='stable'?'理想同轴腔具有有限高斯本征模；不代表激光已起振。':status==='marginal'?'边界需单独分析，此处不显示有限基模尺寸。':status==='unstable'?'此条件下无稳定的束缚高斯基模。':'计算超出数值范围，请调整条件。';
 return {status,reason,g1,g2,g1g2,waistPos,zR,w0,w1,w2,widthAt,roundTrip,confocalParam:zR===null?null:2*zR};
}
export const fresh=()=>({mirror1:'plane',mirror2:'r200',lengthMm:100,probe:.5,m:0,n:0,task:'plano',hints:false,assisted:false,records:[],prediction:'',conclusion:''});
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const fail=m=>{throw Error(m);};
export function settings(s){
 if(!s||typeof s.mirror1!=='string'||typeof s.mirror2!=='string'||!Object.hasOwn(MIRRORS,s.mirror1)||!Object.hasOwn(MIRRORS,s.mirror2))fail('请选择平面、200 mm或300 mm凹面镜。');
 if(!finite(s.lengthMm,50,550)||!Number.isInteger(s.lengthMm)||!finite(s.probe,0,1))fail('腔长须为50至550 mm整数，截面位置须在腔内。');
 const m=s.m===undefined?0:s.m,n=s.n===undefined?0:s.n;
 if(![m,n].every(v=>Number.isInteger(v)&&v>=0&&v<=5))fail('横模阶数 m、n 须为0至5的整数。');
 return {mirror1:s.mirror1,mirror2:s.mirror2,lengthMm:s.lengthMm,probe:s.probe,m,n};
}
export function simulate(s){const c=settings(s);return solve(MIRRORS[c.mirror1].radius,MIRRORS[c.mirror2].radius,c.lengthMm);}
const TASKS={plano:'平凹边界',asymmetric:'双稳定区',special:'共焦与平平'};
function measurement(r){
 const c=settings(r),v=simulate(c);
 if(typeof r.task!=='string'||!Object.hasOwn(TASKS,r.task)||!(r.model===MODEL||(r.model===LEGACY_MODEL&&c.m===0&&c.n===0))||typeof r.assisted!=='boolean'||typeof r.at!=='string'||r.at.length>32||!Number.isFinite(Date.parse(r.at))||r.status!==v.status||v.status==='invalid')fail('记录的条件、版本或状态无效。');
 for(const k of ['w0','w1','w2','waistPos'])if(r[k]!==v[k]&&!(finite(r[k],-1e9,1e9)&&v[k]!==null&&Math.abs(r[k]-v[k])<1e-10))fail('模式尺寸与记录条件不符。');
 return {...c,task:r.task,model:MODEL,status:r.status,w0:r.w0,w1:r.w1,w2:r.w2,waistPos:r.waistPos,assisted:r.assisted,at:r.at};
}
export function normalize(s){
 const c=settings(s);
 if(typeof s.task!=='string'||!Object.hasOwn(TASKS,s.task)||!Array.isArray(s.records)||s.records.length>200)fail('任务无效或记录超过200条。');
 for(const k of ['hints','assisted'])if(typeof s[k]!=='boolean')fail('辅助状态无效。');
 for(const k of ['prediction','conclusion'])if(typeof s[k]!=='string'||s[k].length>4000)fail('实验文字无效或超过4000字。');
 const records=s.records.map(measurement);
 return {...c,task:s.task,hints:s.hints,assisted:s.assisted||s.hints||records.some(r=>r.assisted),records,prediction:s.prediction,conclusion:s.conclusion};
}
export const changeSettings=(s,p)=>normalize({...s,...p,assisted:!!(s.assisted||p.assisted||p.hints)});
export function record(s,at=new Date().toISOString()){
 s=normalize(s);if(s.records.length>=200)fail('已达到200条记录上限。');
 if(s.records.some(r=>r.task===s.task&&r.mirror1===s.mirror1&&r.mirror2===s.mirror2&&r.lengthMm===s.lengthMm&&r.m===s.m&&r.n===s.n))fail('该任务的这个镜组、腔长与横模已记录。');
 const v=simulate(s),r=measurement({...settings(s),...v,task:s.task,model:MODEL,at,assisted:s.assisted});
 return {...s,records:[...s.records,r]};
}
export const format=v=>v===null?'—':v.toFixed(4);
export function report(s){
 s=normalize(s);
 // Split branches even when no marginal point was sampled.
 const groups=new Map();
 for(const r of s.records){if(r.w0===null)continue;const R1=MIRRORS[r.mirror1].radius??Infinity,R2=MIRRORS[r.mirror2].radius??Infinity;
  const branch=r.status==='confocal'?'共焦':r.lengthMm<Math.min(R1,R2)?'第一稳定区':'第二稳定区';
  const key=TASKS[r.task]+' · '+r.mirror1+'/'+r.mirror2+' · TEM'+r.m+r.n+' · '+branch;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({x:r.lengthMm,y:r.w0});}
 return {title:'谐振腔实验',model:MODEL,columns:['组次/任务','横模','镜组 R₁/R₂\nmm','L/mm','状态','w₀/w₁/w₂\nmm','束腰z/mm','截面z/mm','辅助/时间 UTC'],rows:s.records.map((r,i)=>[String(i+1)+' '+TASKS[r.task],'TEM'+r.m+r.n,String(MIRRORS[r.mirror1].radius??'∞')+'/'+String(MIRRORS[r.mirror2].radius??'∞'),String(r.lengthMm),LABELS[r.status],[r.w0,r.w1,r.w2].map(format).join('\n'),format(r.waistPos),(r.probe*r.lengthMm).toFixed(2),(r.assisted?'使用提示':'自主')+'\n'+r.at.replace('T','\n')]),summaries:['共'+s.records.length+'条仿真观测记录；临界及不稳定记录保留状态，空尺寸不表示零。','预测：'+s.prediction,'结论：'+s.conclusion],series:[...groups].map(([title,points])=>({title,xLabel:'腔长 / mm',yLabel:'束腰半径 / mm',points:points.sort((a,b)=>a.x-b.x)})),formula:'gᵢ=1−L/Rᵢ；常规稳定0<g₁g₂<1。w²(z)=λzR/π · [1+((z−z₀)/zR)²]。共焦单独显示选定对称模式。',limitation:'632.8 nm；理想同轴空气两镜腔、HG横模 m/n=0–5。w为高斯基准尺度，高阶模不是单一1/e²光斑。尺寸为仿真计算值；未模拟增益、起振、功率、失调及衍射损耗。高阶模的2σ尺寸为sqrt(2m+1)w与sqrt(2n+1)w。通用教学装置采用自定外观尺寸；包络横向放大20倍，截面为虚拟观察。'};
}
