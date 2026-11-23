// Ideal monochromatic Senarmont bench. Angles viewed along propagation, degrees.
export const MODEL='senarmont-scan-v1';
export const WAVELENGTHS=Object.freeze([500,550,600]);
export const SAMPLES=Object.freeze({uniform:'均匀延迟片',ramp:'渐变延迟片'});
export const DIAL_OFFSET_DEG=2;
export const EXTINCTION_LIMIT=1e-4;
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
const fail=m=>{throw new RangeError(m);};
export function settings(v){
 if(!v||!WAVELENGTHS.includes(v.wavelengthNm)||typeof v.sample!=='string'||!Object.hasOwn(SAMPLES,v.sample)||!finite(v.positionMm,-10,10)||!finite(v.thicknessMm,.2,1)||!finite(v.analyzerDeg,0,180)||typeof v.inserted!=='boolean')fail('请选择支持的波长/样品，扫描位置±10 mm、厚度0.2–1 mm、检偏刻度0–180°。');
 return {wavelengthNm:v.wavelengthNm,sample:v.sample,positionMm:v.positionMm,thicknessMm:v.thicknessMm,analyzerDeg:v.analyzerDeg,inserted:v.inserted};
}
export const wrap180=a=>{if(!Number.isFinite(a))fail('角度无效。');return ((a+90)%180+180)%180-90;};
export function retardation(v){const c=settings(v),deltaN=c.sample==='uniform'?.0001:.00008+.00012*(c.positionMm+10)/20;return c.inserted?deltaN*c.thicknessMm*1e6:0;}
/** P(0), specimen fast axis45°, phase on slow axis +delta, Q fast axis0°, slow +pi/2. */
export function jonesIntensity(delayNm,wavelengthNm,analyzerPhysicalDeg){
 if(!finite(delayNm,-2000,2000)||!finite(wavelengthNm,400,700)||!finite(analyzerPhysicalDeg,-360,360))fail('Jones输入无效。');
 const d=2*Math.PI*delayNm/wavelengthNm,c=Math.cos(d),s=Math.sin(d),a=analyzerPhysicalDeg*Math.PI/180;
 // Specimen: ((1+exp(i*d))/2, (1-exp(i*d))/2). Q multiplies y by i.
 const exRe=(1+c)/2,exIm=s/2,eyRe=s/2,eyIm=(1-c)/2;
 const re=Math.cos(a)*exRe+Math.sin(a)*eyRe,im=Math.cos(a)*exIm+Math.sin(a)*eyIm;
 return re*re+im*im;
}
export function simulate(v){const c=settings(v),retardationNm=retardation(c),phaseDeg=360*retardationNm/c.wavelengthNm,physicalAngleDeg=c.analyzerDeg-DIAL_OFFSET_DEG;
 return {...c,retardationNm,phaseDeg,physicalAngleDeg,intensity:jonesIntensity(retardationNm,c.wavelengthNm,physicalAngleDeg),blankDialDeg:90+DIAL_OFFSET_DEG,extinctionDialDeg:(90+DIAL_OFFSET_DEG+phaseDeg/2)%180,unambiguous:retardationNm<c.wavelengthNm/2};
}
const time=t=>typeof t==='string'&&t.length<=32&&Number.isFinite(Date.parse(t));
function calibration(v){
 if(!v||v.model!==MODEL||!time(v.at)||!WAVELENGTHS.includes(v.wavelengthNm)||!finite(v.zeroDeg,0,180)||typeof v.assisted!=='boolean')fail('空白校准无效。');
 const intensity=jonesIntensity(0,v.wavelengthNm,v.zeroDeg-DIAL_OFFSET_DEG);
 if(intensity>EXTINCTION_LIMIT||!finite(v.intensity,0,1)||Math.abs(v.intensity-intensity)>1e-10)fail('空白未消光或校准强度被修改。');
 return {model:MODEL,at:v.at,wavelengthNm:v.wavelengthNm,zeroDeg:v.zeroDeg,intensity,assisted:v.assisted};
}
export function invert(zeroDeg,readingDeg,wavelengthNm){
 if(!finite(zeroDeg,0,180)||!finite(readingDeg,0,180)||!WAVELENGTHS.includes(wavelengthNm))fail('消光读数无效。');
 const rotationDeg=wrap180(readingDeg-zeroDeg);
 // Known fast-axis orientation and range 0 <= delay < lambda/2 select this branch.
 if(rotationDeg<0||rotationDeg>=90)fail('读数不在已知正延迟量程；请检查零位和消光方向。');
 return {rotationDeg,measuredNm:wavelengthNm*rotationDeg/180};
}
function measurement(v){
 const c=settings(v),cal=calibration(v.calibration),r=simulate(c);
 if(!c.inserted||!r.unambiguous||cal.wavelengthNm!==c.wavelengthNm||v.model!==MODEL||!time(v.at)||typeof v.assisted!=='boolean'||r.intensity>EXTINCTION_LIMIT)fail('样品记录需要同波长空白校准、插入样品并调至消光。');
 const result=invert(cal.zeroDeg,c.analyzerDeg,c.wavelengthNm);
 for(const [k,value] of Object.entries({...result,intensity:r.intensity,theoryNm:r.retardationNm}))if(!finite(v[k],-1000,1000)||Math.abs(v[k]-value)>1e-8)fail('记录派生结果与原始读数不符。');
 return {...c,calibration:cal,...result,intensity:r.intensity,theoryNm:r.retardationNm,model:MODEL,at:v.at,assisted:v.assisted||cal.assisted};
}
export const fresh=()=>({wavelengthNm:550,sample:'ramp',positionMm:0,thicknessMm:1,analyzerDeg:90,inserted:false,calibration:null,hints:false,assisted:false,records:[],prediction:'',conclusion:''});
export function normalize(v){
 const c=settings(v);if(typeof v.hints!=='boolean'||typeof v.assisted!=='boolean'||!Array.isArray(v.records)||v.records.length>150)fail('实验状态无效。');
 for(const k of ['prediction','conclusion'])if(typeof v[k]!=='string'||v[k].length>4000)fail('文字无效或超过4000字。');
 const cal=v.calibration===null?null:calibration(v.calibration);if(cal&&cal.wavelengthNm!==c.wavelengthNm)fail('校准波长与当前波长不一致。');
 const records=v.records.map(measurement);return {...c,calibration:cal,hints:v.hints,assisted:v.assisted||v.hints||!!cal?.assisted||records.some(r=>r.assisted),records,prediction:v.prediction,conclusion:v.conclusion};
}
export function changeSettings(s,p){return normalize({...s,...p,calibration:Object.hasOwn(p,'wavelengthNm')&&p.wavelengthNm!==s.wavelengthNm?null:s.calibration,assisted:!!(s.assisted||p.assisted||p.hints)});}
export function calibrate(s,at=new Date().toISOString()){
 s=normalize(s);if(s.inserted)fail('请移出样品后记录空白零位。');
 const r=simulate(s),cal=calibration({model:MODEL,at,wavelengthNm:s.wavelengthNm,zeroDeg:s.analyzerDeg,intensity:r.intensity,assisted:s.assisted});return {...s,calibration:cal};
}
export function record(s,at=new Date().toISOString()){
 s=normalize(s);if(!s.calibration)fail('请先完成当前波长的空白校准。');if(s.records.length>=150)fail('最多150条记录。');
 const r=simulate(s),result=invert(s.calibration.zeroDeg,s.analyzerDeg,s.wavelengthNm),m=measurement({...s,...result,intensity:r.intensity,theoryNm:r.retardationNm,model:MODEL,at});return {...s,records:[...s.records,m]};
}
export function report(v){const s=normalize(v),groups=new Map();for(const r of s.records){const key=`${SAMPLES[r.sample]} / ${r.wavelengthNm} nm / ${r.thicknessMm} mm / 零位${r.calibration.zeroDeg}° @ ${r.calibration.at}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({x:r.positionMm,y:r.measuredNm});}
 return {title:'偏振扫描实验',model:MODEL,columns:['组次/位置mm','样品/厚度mm','波长/nm','空白零位/°','消光读数/°','转角/°','测得延迟/nm','强度/辅助'],rows:s.records.map((r,i)=>[`${i+1} / ${r.positionMm}`,`${SAMPLES[r.sample]} / ${r.thicknessMm}`,String(r.wavelengthNm),r.calibration.zeroDeg.toFixed(2),r.analyzerDeg.toFixed(2),r.rotationDeg.toFixed(3),r.measuredNm.toFixed(3),`${r.intensity.toExponential(2)} / ${r.assisted?'辅助':'自主'}`]),summaries:[`共${s.records.length}条记录；每条记录保留空白校准角、校准时间和消光刻度。`,'预测：'+s.prediction,'结论：'+s.conclusion],series:[...groups].map(([title,points])=>({title,xLabel:'扫描位置/mm',yLabel:'测得光程延迟/nm',points:points.sort((a,b)=>a.x-b.x)})),formula:'Δa=wrap180(a消光−a空白)；光程延迟Γ=λΔa/180。当前已知样品快轴和正延迟量程0≤Γ<λ/2。',limitation:'理想单色起偏器、快轴45°教学样品、快轴0°的匹配四分之一波片及检偏器。I₀为起偏器后的强度；消光阈值1e−4。样品延迟分布为自定教学参数，不反演应力或宣称材料标定。每次换波长需重校零位；不同厚度、样品和校准分开作图。'};
}
