// Distances in mm; real objects have positive distance, real images positive v.
export function computeThinLensImage(objDist,focalLength,objHeight) {
  const invV=1/focalLength-1/Math.abs(objDist);
  if(Math.abs(focalLength)<.5||Math.abs(invV)<1e-10)return {v:Infinity,magnification:Infinity,isReal:false,isUpright:true,isMagnified:true,imageHeight:objHeight,atInfinity:true};
  const v=1/invV,m=-v/Math.abs(objDist);
  return {v,magnification:m,isReal:v>0,isUpright:m>0,isMagnified:Math.abs(m)>1,imageHeight:m*objHeight,atInfinity:false};
}
export const fresh=()=>({objectMm:150,lensMm:450,screenMm:620,focalMm:100,sourceOn:true,rays:false,assisted:false,records:[],prediction:'',conclusion:''});
export function simulate(s) {
  const u=s.lensMm-s.objectMm,v=s.screenMm-s.lensMm,image=computeThinLensImage(u,s.focalMm,20);
  const blur=50*Math.abs(1+v/u-v/s.focalMm);
  return {u,v,image,blur,measuredF:u*v/(u+v),recordable:s.sourceOn&&image.isReal&&blur<=1+1e-9};
}
function settings(s) {
  if(!s||typeof s!=='object')throw Error('缺少仪器状态。');
  for(const [key,min,max] of [['objectMm',110,900],['lensMm',170,1060],['screenMm',230,1190]])if(typeof s[key]!=='number'||!Number.isFinite(s[key])||s[key]<min||s[key]>max)throw Error('位置超出导轨范围。');
  if(s.lensMm-s.objectMm<60||s.screenMm-s.lensMm<60)throw Error('相邻仪器至少间隔 60 mm。');
  if(![100,200].includes(s.focalMm))throw Error('请选择 100 或 200 mm 透镜。');
  if(typeof s.sourceOn!=='boolean'||typeof s.assisted!=='boolean')throw Error('仪器状态无效。');
  return Object.fromEntries(['objectMm','lensMm','screenMm','focalMm','sourceOn','assisted'].map(k=>[k,s[k]]));
}
export function normalize(s) {
  const clean=settings(s);
  if(typeof s.rays!=='boolean'||!Array.isArray(s.records)||s.records.length>200)throw Error('记录格式无效（最多 200 组）。');
  for(const k of ['prediction','conclusion'])if(typeof s[k]!=='string'||s[k].length>4000)throw Error('文字记录过长或无效。');
  return {...clean,rays:s.rays,prediction:s.prediction,conclusion:s.conclusion,records:s.records.map(r=>{const c=settings(r);if(!simulate(c).recordable)throw Error('记录包含未调焦或未开灯的数据。');return c;})};
}
export function record(s) {
  const clean=normalize(s),q=simulate(clean);
  if(!q.recordable)throw Error('请开灯并调焦至弥散斑直径不大于 1 mm 后记录。');
  if(clean.records.length>=200)throw Error('已达到 200 组记录上限。');
  const row=settings(clean);
  if(clean.records.some(r=>['objectMm','lensMm','screenMm','focalMm'].every(k=>r[k]===row[k])))throw Error('该位置组合已记录，请更换物距后重复测量。');
  return {...clean,records:[...clean.records,row]};
}
export function report(s) {
  const rows=s.records.map((r,i)=>{const q=simulate(r);return [String(i+1),String(r.focalMm),String(r.objectMm),String(r.lensMm),String(r.screenMm),q.u.toFixed(1),q.v.toFixed(1),q.measuredF.toFixed(3),r.assisted?'辅助':'手动'];});
  return {title:'透镜成像实验',model:'lens-paraxial-v1',columns:['组次','标称焦距/mm','物面/mm','透镜/mm','屏面/mm','物距/mm','像距/mm','测得焦距/mm','调焦'],rows,summaries:[...[100,200].map(f=>{const a=s.records.filter(r=>r.focalMm===f).map(r=>simulate(r).measuredF);return a.length?`${f} mm 透镜：${a.length}组，焦距均值 ${(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3)} mm。`:`${f} mm 透镜：尚无记录。`;}),'预测：'+s.prediction,'结论：'+s.conclusion],series:[100,200].map(f=>({title:`标称 ${f} mm`,xLabel:'1/u / mm⁻¹',yLabel:'1/v / mm⁻¹',points:s.records.filter(r=>r.focalMm===f).map(r=>{const q=simulate(r);return {x:1/q.u,y:1/q.v};})})).filter(s=>s.points.length),formula:'1/f = 1/u + 1/v；f = uv/(u+v)，m = −v/u。',limitation:'理想近轴薄透镜，口径50 mm，物高20 mm；屏上失焦为几何弥散近似，不含像差、衍射或测量噪声。记录阈值：弥散斑直径≤1 mm。名义焦距未模拟厂家±10%公差；外观未公开尺寸按比例估计。'};
}
