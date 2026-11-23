// Static 1D TN teaching cell: fixed-voltage Frank energy + lossless sliced Jones optics.
export const MODEL='tn-static-frank-v1';
export const MATERIAL=Object.freeze({k11:10e-12,k22:6e-12,k33:15e-12,epsilonPerp:5,deltaEpsilon:10,no:1.5,ne:1.7,thicknessUm:5,pretiltDeg:2,twistDeg:90});
const EPS0=8.8541878128e-12,RAD=Math.PI/180;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
function checkVoltage(v){if(!finite(v,0,5))throw new RangeError('电压必须为0–5 V RMS。');}
function checkMaterial(m){
 if(!m||!['k11','k22','k33'].every(k=>finite(m[k],1e-13,1e-10))||!finite(m.epsilonPerp,1,30)||!finite(m.deltaEpsilon,0,30)||!finite(m.no,1,3)||!finite(m.ne,m.no,3)||!finite(m.thicknessUm,0,50)||!finite(m.pretiltDeg,0,20)||!finite(m.twistDeg,0,90))throw new RangeError('材料基准参数无效。');
}
/** x holds interior tilt angles followed by azimuths (radians); boundaries strongly anchored. */
export function energyGradient(x,voltageRms,segments,material=MATERIAL){
 checkVoltage(voltageRms);checkMaterial(material);if(!Number.isInteger(segments)||segments<4||segments>512||!Array.isArray(x)||x.length!==2*(segments-1)||!x.every(Number.isFinite))throw new RangeError('指向矢网格无效。');
 const m=segments-1,h=1/segments,t=[material.pretiltDeg*RAD,...x.slice(0,m),material.pretiltDeg*RAD],p=[0,...x.slice(m),material.twistDeg*RAD],gt=new Array(segments+1).fill(0),gp=gt.slice();
 let energy=0,J=0;const eps=t.map(v=>material.epsilonPerp+material.deltaEpsilon*Math.sin(v)**2);
 for(let i=0;i<=segments;i++)J+=(i===0||i===segments?.5:1)*h/eps[i];
 for(let i=0;i<segments;i++){
  const mid=(t[i]+t[i+1])/2,s=Math.sin(mid),c=Math.cos(mid),dt=t[i+1]-t[i],dp=p[i+1]-p[i];
  const k1=material.k11/material.k11,k2=material.k22/material.k11,k3=material.k33/material.k11;
  const A=k1*c*c+k3*s*s,B=c*c*(k2*c*c+k3*s*s),Ap=2*(k3-k1)*s*c,Bp=2*s*c*((k3-2*k2)*c*c-k3*s*s);
  energy+=(A*dt*dt+B*dp*dp)/(2*h);const common=(Ap*dt*dt+Bp*dp*dp)/(4*h);
  gt[i]+=common-A*dt/h;gt[i+1]+=common+A*dt/h;gp[i]-=B*dp/h;gp[i+1]+=B*dp/h;
 }
 const C=EPS0*voltageRms**2/(2*material.k11);energy-=C/J;
 for(let i=1;i<segments;i++)gt[i]-=C/(J*J)*h*material.deltaEpsilon*Math.sin(2*t[i])/(eps[i]*eps[i]);
 return {energy,gradient:[...gt.slice(1,-1),...gp.slice(1,-1)],theta:t,phi:p,relativeField:eps.map(e=>1/(J*e)),capacitanceFactor:1/J};
}
export function solveDirector(voltageRms,{segments=64,maxIterations=3000,tolerance=2e-6,material=MATERIAL}={}){
 checkVoltage(voltageRms);if(!Number.isInteger(segments)||segments<4||segments>512||!Number.isInteger(maxIterations)||maxIterations<0||!finite(tolerance,1e-12,.01))throw new RangeError('求解设置无效。');
 const m=segments-1,x0=Array.from({length:m},(_,i)=>material.pretiltDeg*RAD+Math.min(1.2,voltageRms*.25)*Math.sin(Math.PI*(i+1)/segments));
 let x=[...x0,...Array.from({length:m},(_,i)=>material.twistDeg*RAD*(i+1)/segments)],r=energyGradient(x,voltageRms,segments,material),history=[],iteration=0,reason='达到迭代上限';
 for(;iteration<maxIterations;iteration++){
  if(Math.max(...r.gradient.map(Math.abs))<tolerance){reason='梯度收敛';break;}
  const q=r.gradient.slice(),alpha=[];
  for(let j=history.length-1;j>=0;j--){const v=history[j];alpha[j]=dot(v.s,q)/v.sy;for(let k=0;k<q.length;k++)q[k]-=alpha[j]*v.y[k];}
  const last=history.at(-1),scale=last?last.sy/dot(last.y,last.y):1/(2*segments),direction=q.map(v=>v*scale);
  for(let j=0;j<history.length;j++){const v=history[j],beta=dot(v.y,direction)/v.sy;for(let k=0;k<q.length;k++)direction[k]+=v.s[k]*(alpha[j]-beta);}
  for(let k=0;k<direction.length;k++)direction[k]*=-1;
  let slope=dot(r.gradient,direction);if(!(slope<0)){history=[];for(let k=0;k<direction.length;k++)direction[k]=-r.gradient[k]/(2*segments);slope=dot(r.gradient,direction);}
  let step=1,next,nx;
  for(let trial=0;trial<35;trial++){nx=x.map((v,k)=>v+step*direction[k]);next=energyGradient(nx,voltageRms,segments,material);if(next.energy<=r.energy+1e-4*step*slope)break;step*=.5;next=null;}
  if(!next){reason='线搜索未找到下降步';break;}
  const s=nx.map((v,k)=>v-x[k]),y=next.gradient.map((v,k)=>v-r.gradient[k]),sy=dot(s,y);if(sy>1e-18){history.push({s,y,sy});if(history.length>10)history.shift();}
  x=nx;r=next;
 }
 const residual=Math.max(...r.gradient.map(Math.abs)),converged=residual<tolerance;
 return {voltageRms,segments,iterations:iteration,residual,converged,reason:converged?'梯度收敛':reason,theta:r.theta,phi:r.phi,relativeField:r.relativeField,energy:r.energy};
}
/** Retarders with extraordinary phase +delta, common ordinary phase removed. No clipping. */
export function propagateJones(layers,{wavelengthNm=550,polarizerDeg=0,analyzerDeg=90,no=MATERIAL.no,ne=MATERIAL.ne}={}){
 if(!finite(wavelengthNm,400,700)||!finite(no,1,3)||!finite(ne,1,3)||!finite(polarizerDeg,-360,360)||!finite(analyzerDeg,-360,360))throw new RangeError('光学参数无效。');
 let xr=Math.cos(polarizerDeg*RAD),xi=0,yr=Math.sin(polarizerDeg*RAD),yi=0;
 for(const {theta,phi,thicknessUm} of layers){
  if(!Number.isFinite(theta)||!Number.isFinite(phi)||!finite(thicknessUm,0,100))throw new RangeError('光学层无效。');
  const s=Math.sin(theta),c=Math.cos(theta),effective=1/Math.sqrt(s*s/(no*no)+c*c/(ne*ne)),delta=2*Math.PI*(effective-no)*thicknessUm*1000/wavelengthNm,cr=Math.cos(delta),ci=Math.sin(delta),a=Math.cos(phi),b=Math.sin(phi);
  const ur=a*xr+b*yr,ui=a*xi+b*yi,vr=-b*xr+a*yr,vi=-b*xi+a*yi,pr=cr*ur-ci*ui,pi=ci*ur+cr*ui;
  xr=a*pr-b*vr;xi=a*pi-b*vi;yr=b*pr+a*vr;yi=b*pi+a*vi;
 }
 const a=Math.cos(analyzerDeg*RAD),b=Math.sin(analyzerDeg*RAD),intensity=(a*xr+b*yr)**2+(a*xi+b*yi)**2,power=xr*xr+xi*xi+yr*yr+yi*yi;
 if(Math.abs(power-1)>1e-9||intensity<0||intensity>1+1e-9)throw new Error('光学能量校验失败。');
 return {intensity,power,field:[xr,xi,yr,yi]};
}
export function simulate({voltageRms=0,analyzerDeg=90,wavelengthNm=550}={},options={}){
 if(![0,90].includes(analyzerDeg)||wavelengthNm!==550)throw new RangeError('本台固定550 nm，检偏器仅支持平行或正交。');
 const director=solveDirector(voltageRms,options);if(!director.converged)return {...director,intensity:null,power:null};
 const material=options.material??MATERIAL,layers=Array.from({length:director.segments},(_,i)=>({theta:(director.theta[i]+director.theta[i+1])/2,phi:(director.phi[i]+director.phi[i+1])/2,thicknessUm:material.thicknessUm/director.segments}));
 return {...director,...propagateJones(layers,{wavelengthNm,analyzerDeg,no:material.no,ne:material.ne})};
}

export function settings(v){
 if(!v||v.wavelengthNm!==550||![0,90].includes(v.analyzerDeg))throw new RangeError('本台固定550 nm，检偏器仅支持平行或正交。');checkVoltage(v.voltageRms);
 return {voltageRms:v.voltageRms,analyzerDeg:v.analyzerDeg,wavelengthNm:550};
}
// Repeated archive validation should not re-solve identical immutable conditions.
const cache=new Map();
export function observe(v){const c=settings(v),key=`${c.voltageRms}/${c.analyzerDeg}`;if(cache.has(key))return cache.get(key);const result=simulate(c);for(const value of Object.values(result))if(Array.isArray(value))Object.freeze(value);Object.freeze(result);cache.set(key,result);if(cache.size>128)cache.delete(cache.keys().next().value);return result;}
export const fresh=()=>({voltageRms:0,analyzerDeg:90,wavelengthNm:550,readingVrms:null,readingIntensity:null,direction:'up',scanId:1,hints:false,assisted:false,records:[],prediction:'',conclusion:''});
const fail=m=>{throw new RangeError(m);};
const validTime=v=>typeof v==='string'&&v.length<=32&&Number.isFinite(Date.parse(v));
// Legacy v1 files contain diagnostics but no director. Iteration counts are not
// portable across JS math implementations. This is a compatibility tolerance,
// not a claim of material or discretization accuracy (see portability probe).
export const LEGACY_INTENSITY_TOLERANCE=2e-5;
function validateSolution(v,c){
 if(!v||v.version!==1||v.segments!==64||!Array.isArray(v.theta)||!Array.isArray(v.phi)||v.theta.length!==65||v.phi.length!==65||!v.theta.every(a=>finite(a,0,Math.PI/2))||!v.phi.every(a=>finite(a,0,Math.PI/2)))fail('收敛状态快照无效。');
 const theta=v.theta.slice(),phi=v.phi.slice();
 if(Math.abs(theta[0]-MATERIAL.pretiltDeg*RAD)>1e-12||Math.abs(theta[64]-MATERIAL.pretiltDeg*RAD)>1e-12||Math.abs(phi[0])>1e-12||Math.abs(phi[64]-Math.PI/2)>1e-12)fail('收敛状态边界不符。');
 const g=energyGradient([...theta.slice(1,-1),...phi.slice(1,-1)],c.voltageRms,64),residual=Math.max(...g.gradient.map(Math.abs));
 if(residual>=2e-6)fail('记录的指向矢状态未收敛。');
 const layers=Array.from({length:64},(_,i)=>({theta:(theta[i]+theta[i+1])/2,phi:(phi[i]+phi[i+1])/2,thicknessUm:MATERIAL.thicknessUm/64}));
 return {solution:{version:1,segments:64,theta,phi},residual,intensity:propagateJones(layers,{wavelengthNm:c.wavelengthNm,analyzerDeg:c.analyzerDeg}).intensity};
}
function measurement(v){
 const c=settings(v);
 if(!finite(v.readingVrms,0,5)||!finite(v.readingIntensity,0,1)||!['up','down'].includes(v.direction)||!Number.isInteger(v.scanId)||v.scanId<1||v.scanId>100||typeof v.assisted!=='boolean'||v.model!==MODEL||!validTime(v.at))fail('记录读数、扫描组、方向、版本或时间无效。');
 if(!finite(v.intensity,0,1+1e-9)||!finite(v.residual,0,2e-6)||v.residual>=2e-6||!Number.isInteger(v.iterations)||v.iterations<0||v.iterations>3000)fail('记录的求解诊断无效。');
 let solution;
 if(Object.hasOwn(v,'solution')){
  const verified=validateSolution(v.solution,c);solution=verified.solution;
  if(Math.abs(v.intensity-verified.intensity)>1e-10||Math.abs(v.residual-verified.residual)>1e-10)fail('记录计算值与收敛状态不符。');
 }else{
  const r=observe(c);if(!r.converged)fail('指向矢尚未收敛，不可复核旧记录：'+r.reason);
  if(Math.abs(v.intensity-r.intensity)>LEGACY_INTENSITY_TOLERANCE)fail('旧记录计算值与原始条件不符。');
 }
 // A restore validates but never replaces the recorded physical/diagnostic values.
 return {...c,readingVrms:v.readingVrms,readingIntensity:v.readingIntensity,direction:v.direction,scanId:v.scanId,assisted:v.assisted,model:MODEL,at:v.at,intensity:v.intensity,residual:v.residual,iterations:v.iterations,...(solution?{solution}:{})};
}
function validateScans(records){
 const groups=new Map();let lastId=0;
 for(const r of records){if(r.scanId<lastId)fail('扫描组顺序无效。');lastId=r.scanId;const previous=groups.get(r.scanId);if(previous){if(r.direction!==previous.direction||r.analyzerDeg!==previous.analyzerDeg)fail('同组扫描条件或方向不一致。');if((r.voltageRms-previous.voltageRms)*(r.direction==='up'?1:-1)<-1e-12)fail('电压与扫描方向不符，请开始新一组扫描。');}groups.set(r.scanId,r);}
 return groups;
}
export function normalize(v){
 const c=settings(v);if((v.readingVrms!==null&&!finite(v.readingVrms,0,5))||(v.readingIntensity!==null&&!finite(v.readingIntensity,0,1))||!['up','down'].includes(v.direction)||!Number.isInteger(v.scanId)||v.scanId<1||v.scanId>100||typeof v.hints!=='boolean'||typeof v.assisted!=='boolean'||!Array.isArray(v.records)||v.records.length>100)fail('实验状态无效。');
 for(const k of ['prediction','conclusion'])if(typeof v[k]!=='string'||v[k].length>4000)fail('文字无效或超过4000字。');
 const records=v.records.map(measurement),groups=validateScans(records),last=records.at(-1),current=groups.get(v.scanId);
 if(last&&last.scanId>v.scanId)fail('当前扫描组不能早于历史记录。');if(current&&(current.direction!==v.direction||current.analyzerDeg!==c.analyzerDeg))fail('改变方向或检偏器需要开始新组。');
 return {...c,readingVrms:v.readingVrms,readingIntensity:v.readingIntensity,direction:v.direction,scanId:v.scanId,hints:v.hints,assisted:v.assisted||v.hints||records.some(r=>r.assisted),records,prediction:v.prediction,conclusion:v.conclusion};
}
export function changeSettings(s,p){
 const changed=Object.keys(settings(s)).some(k=>Object.hasOwn(p,k)&&p[k]!==s[k]),newGroup=(Object.hasOwn(p,'direction')&&p.direction!==s.direction)||(Object.hasOwn(p,'analyzerDeg')&&p.analyzerDeg!==s.analyzerDeg);
 return normalize({...s,...p,scanId:newGroup?s.scanId+1:s.scanId,readingVrms:changed||newGroup?null:(Object.hasOwn(p,'readingVrms')?p.readingVrms:s.readingVrms),readingIntensity:changed||newGroup?null:(Object.hasOwn(p,'readingIntensity')?p.readingIntensity:s.readingIntensity),assisted:!!(s.assisted||p.assisted||p.hints)});
}
export function beginScan(s){return normalize({...s,scanId:s.scanId+1,readingVrms:null,readingIntensity:null});}
export function record(s,at=new Date().toISOString()){
 s=normalize(s);if(s.records.length>=100)fail('最多100条记录。');if(s.readingVrms===null||s.readingIntensity===null)fail('请先读取驱动电压有效值和探测器相对光强。');
 const r=observe(s);if(!r.converged)fail('指向矢尚未收敛，不可记录：'+r.reason);
 const entry=measurement({...s,intensity:r.intensity,residual:r.residual,iterations:r.iterations,solution:{version:1,segments:r.segments,theta:[...r.theta],phi:[...r.phi]},model:MODEL,at});return normalize({...s,records:[...s.records,entry]});
}
export function report(v){
 const s=normalize(v),groups=new Map();for(const r of s.records){const title=`第${r.scanId}组 / ${r.direction==='up'?'上扫':'下扫'} / 检偏${r.analyzerDeg}°`;if(!groups.has(title))groups.set(title,[]);groups.get(title).push({x:r.readingVrms,y:r.readingIntensity});}
 return {title:'液晶光阀实验',model:MODEL,columns:['序号/扫描组','方向/检偏角°','设定电压/V RMS','手读电压/V RMS','手读I/I₀','计算I/I₀','迭代数/残差','辅助/UTC'],rows:s.records.map((r,i)=>[`${i+1} / ${r.scanId}`,`${r.direction==='up'?'上扫':'下扫'} / ${r.analyzerDeg}`,r.voltageRms.toFixed(2),r.readingVrms.toFixed(2),r.readingIntensity.toFixed(5),r.intensity.toFixed(7),`${r.iterations} / ${r.residual.toExponential(2)}`,`${r.assisted?'辅助':'自主'} / ${r.at}`]),summaries:[`共${s.records.length}条静态记录；曲线使用手动读数，计算值另列。上/下扫采用同一静态模型，不生成方向相关迟滞。`,`验证方式：${s.records.filter(r=>r.solution).length}条含收敛状态快照，直接复核梯度与Jones结果；${s.records.filter(r=>!r.solution).length}条旧记录按光强绝对差≤2×10⁻⁵兼容复核。保留历史值；迭代数仅为当时诊断，非跨环境不变量。`,'预测：'+s.prediction,'结论：'+s.conclusion],series:[...groups].map(([title,points])=>({title,xLabel:'手读电压/V RMS',yLabel:'手读相对光强I/I₀',points})),formula:'三弹性常数Frank能与固定电压电能联合最小化；自洽E∝1/εzz；分层Jones传播后投影至检偏轴。',limitation:'固定550 nm、5 μm、强锚定90°TN盒，2°预倾。K11/K22/K33=10/6/15 pN、ε⊥=5、Δε=10、no/ne=1.5/1.7均为教学参数。电压为交流有效值。忽略界面反射、吸收、色散和动力学；I₀为起偏器后的强度。未收敛不得记录；不代表真实厂家器件曲线。'};
}
