// Ideal thin lenses in air. Lengths mm, paraxial slopes radians.
// Both the principle view and the movable bench must use this model.
export const MODEL = 'telescope-paraxial-v1';
export const EYEPIECES = Object.freeze({
  positive50: Object.freeze({label:'凸目镜 +50 mm',focal:50}),
  positive40: Object.freeze({label:'凸目镜 +40 mm',focal:40}),
  negative50: Object.freeze({label:'凹目镜 −50 mm',focal:-50}),
});
const finite = (v,lo,hi) => typeof v==='number' && Number.isFinite(v) && v>=lo && v<=hi;
const fail = message => { throw new RangeError(message); };
export function settings(s) {
  if(!s || typeof s.eyepiece!=='string' || !Object.hasOwn(EYEPIECES,s.eyepiece)) fail('请选择教学台提供的目镜。');
  if(!finite(s.lengthMm,100,300) || !finite(s.apertureMm,5,20) || !finite(s.targetMrad,-5,5)) fail('镜间距100–300 mm，物镜孔径5–20 mm，目标角−5至5 mrad。');
  return {eyepiece:s.eyepiece,lengthMm:s.lengthMm,apertureMm:s.apertureMm,targetMrad:s.targetMrad};
}

/** L(f2) P(length) L(f1), for column vector [height, slope]. */
export function matrix(f1,f2,length) {
  if(!finite(f1,1,1e6) || typeof f2!=='number' || !finite(Math.abs(f2),1,1e6) || !finite(length,0,1e6)) fail('焦距或镜间距无效。');
  const a=1-length/f1,b=length,c=(length-f1-f2)/(f1*f2),d=1-length/f2;
  return {a,b,c,d};
}
export function trace(f1,f2,length,height,angle) {
  const m=matrix(f1,f2,length);
  if(!finite(height,-1e6,1e6)||!finite(angle,-.2,.2)) fail('光线高度或近轴角超出范围。');
  return {height,angle,slopeAfterObjective:angle-height/f1,heightAtEye:m.a*height+m.b*angle,slopeOut:m.c*height+m.d*angle};
}

export function simulate(s) {
  const c=settings(s),f1=200,f2=EYEPIECES[c.eyepiece].focal,m=matrix(f1,f2,c.lengthMm);
  const afocalLength=f1+f2,defocusMm=c.lengthMm-afocalLength,afocal=Math.abs(defocusMm)<1e-9;
  // Objective is the axial aperture stop throughout this catalogue and travel.
  // The eyepiece clear radius is 12 mm; at largest |A| it intercepts <= 5 mm.
  const pupilDistance=f2*c.lengthMm/(c.lengthMm-f2);
  const pupilDiameter=Math.abs(f2/(c.lengthMm-f2))*c.apertureMm;
  const angle=c.targetMrad/1000,eyeRadius=12;
  const rays=Array.from({length:17},(_,i)=>{
    const r=trace(f1,f2,c.lengthMm,c.apertureMm*(i/16-.5),angle);
    return {...r,blocked:Math.abs(r.heightAtEye)>eyeRadius};
  });
  const admitted=rays.filter(r=>!r.blocked);
  // Angular distribution at the eyepiece, not a retina or accommodation model.
  const slopes=admitted.map(r=>r.slopeOut);
  return {...c,f1,f2,matrix:m,afocalLength,defocusMm,afocal,
    theoreticalMagnification:-f1/f2,magnification:afocal?-f1/f2:null,
    pupilDistance,pupilDiameter,pupilType:pupilDistance<0?'virtual':'real',
    intermediateImage:f2>0&&c.lengthMm>f1,
    orientation:afocal?(f2>0?'inverted':'upright'):null,
    angularCenterMrad:slopes.length?1000*slopes.reduce((a,b)=>a+b,0)/slopes.length:null,
    angularSpreadMrad:slopes.length?1000*(Math.max(...slopes)-Math.min(...slopes)):null,
    rays,eyeRadius,wavelengthNm:550};
}

export const fresh = () => ({eyepiece:'positive50',lengthMm:230,apertureMm:20,targetMrad:2,
  readingMrad:0,task:'focus',hints:false,assisted:false,records:[],prediction:'',conclusion:''});
const TASKS = Object.freeze({focus:'调焦与角倍率',compare:'正负目镜对照',aperture:'孔径与离焦'});
function measurement(r) {
  const c=settings(r),v=simulate(c);
  if(typeof r.task!=='string'||!Object.hasOwn(TASKS,r.task)||r.model!==MODEL||typeof r.assisted!=='boolean'||typeof r.at!=='string'||r.at.length>32||!Number.isFinite(Date.parse(r.at))) fail('记录身份、时间或版本无效。');
  if(!finite(r.readingMrad,-40,40)) fail('角度读数须在−40至40 mrad内。');
  // Recompute all derived fields; reject edited or stale records.
  for(const key of ['afocal','magnification','pupilDistance','pupilDiameter','angularSpreadMrad']) {
    if(r[key]!==v[key] && !(typeof r[key]==='number'&&typeof v[key]==='number'&&Math.abs(r[key]-v[key])<1e-9)) fail('记录结果与原始条件不符。');
  }
  return {...c,task:r.task,model:MODEL,at:r.at,assisted:r.assisted,readingMrad:r.readingMrad,
    afocal:v.afocal,magnification:v.magnification,pupilDistance:v.pupilDistance,pupilDiameter:v.pupilDiameter,angularSpreadMrad:v.angularSpreadMrad};
}
export function normalize(s) {
  const c=settings(s);
  if(typeof s.task!=='string'||!Object.hasOwn(TASKS,s.task)||!finite(s.readingMrad,-40,40)||!Array.isArray(s.records)||s.records.length>200) fail('任务、读数或记录数量无效。');
  for(const key of ['hints','assisted']) if(typeof s[key]!=='boolean') fail('辅助状态无效。');
  for(const key of ['prediction','conclusion']) if(typeof s[key]!=='string'||s[key].length>4000) fail('实验文字无效或超过4000字。');
  const records=s.records.map(measurement);
  return {...c,readingMrad:s.readingMrad,task:s.task,hints:s.hints,assisted:s.assisted||s.hints||records.some(r=>r.assisted),records,prediction:s.prediction,conclusion:s.conclusion};
}
export const changeSettings = (s,p) => normalize({...s,...p,assisted:!!(s.assisted||p.assisted||p.hints)});
export function record(s,at=new Date().toISOString()) {
  s=normalize(s);
  if(s.records.length>=200) fail('已达到200条记录上限。');
  const r=measurement({...s,...simulate(s),model:MODEL,at});
  return {...s,records:[...s.records,r]};
}
const format = n => n===null?'—':n.toFixed(3);
export function report(s) {
  s=normalize(s);
  return {title:'望远镜实验',model:MODEL,
    columns:['组次/任务','目镜f/mm','间距L/mm','孔径D/mm','目标角/mrad','手动读数/mrad','实测/理论倍率','出瞳位置/直径mm','调焦/辅助/时间UTC'],
    rows:s.records.map((r,i)=>[`${i+1} ${TASKS[r.task]}`,String(EYEPIECES[r.eyepiece].focal),format(r.lengthMm),format(r.apertureMm),format(r.targetMrad),format(r.readingMrad),
      `${format(r.afocal&&r.targetMrad!==0?r.readingMrad/r.targetMrad:null)} / ${format(r.magnification)}`,
      `${format(r.pupilDistance)} / ${format(r.pupilDiameter)}`,`${r.afocal?'无焦':'离焦'} / ${r.assisted?'辅助':'自主'}\n${r.at}`]),
    summaries:[`共${s.records.length}条记录。手动角度读数独立保存；离焦与零目标角不计算实测倍率。`,'预测：'+s.prediction,'结论：'+s.conclusion],
    series:Object.keys(EYEPIECES).map(key=>({title:EYEPIECES[key].label,xLabel:'镜间距 / mm',yLabel:'出射角展宽 / mrad',points:s.records.filter(r=>r.eyepiece===key).map(r=>({x:r.lengthMm,y:r.angularSpreadMrad}))})).filter(g=>g.points.length),
    formula:'L₀=f₁+f₂；无焦时 M=−f₁/f₂。出瞳 z=f₂L/(L−f₂)，负号表示虚出瞳。',
    limitation:'550 nm理想薄透镜近轴教学模型，物镜200 mm。观察窗表示出射光线角分布，不模拟人眼调节、像差或衍射成像；虚出瞳不是可放眼的位置。'};
}
