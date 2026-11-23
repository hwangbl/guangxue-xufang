import {validateConditions,evaluateConditions,modeNames,describeConditions} from './conditions.mjs?v=jones-20260929';
import {linearPolarizer,wavePlate,jonesMatVec,stokesFromJones,analyzePolarization,polarizationEllipsePoints} from './engine.mjs?v=jones-20260929';
export const fresh=()=>({p:0,r:45,a:0,wavelength:560,inserted:false,sourceOn:true,assisted:false,extension:null,records:[],prediction:'',conclusion:''});
// Angles from horizontal in the transverse plane; normalized intensity after polarizer.
export function simulate(s){
 if(s.extension){const q=evaluateConditions(s.extension);return {...q,intensity:s.sourceOn?q.intensity:0,delta:0};}
 const theta=s.p*Math.PI/180,input=[[Math.cos(theta),0],[Math.sin(theta),0]];
 const delta=360*140/s.wavelength;
 const before=s.inserted?jonesMatVec(wavePlate(s.r,delta),input):input;
 const after=jonesMatVec(linearPolarizer(s.a),before),stokes=stokesFromJones(before);
 const intensity=s.sourceOn?Math.max(0,Math.min(1,stokesFromJones(after)[0])):0;
 return {delta,intensity,stokes,ellipse:polarizationEllipsePoints(analyzePolarization(before),120),kind:Math.abs(stokes[3])>1-1e-8?'圆偏振':Math.abs(stokes[3])<1e-8?'线偏振':'椭圆偏振'};
}
function settings(s){
 if(!s||typeof s!=='object')throw Error('缺少偏振状态。');
 for(const k of ['p','r','a','wavelength'])if(typeof s[k]!=='number'||!Number.isFinite(s[k])||s[k]<(k==='wavelength'?400:0)||s[k]>(k==='wavelength'?700:360))throw Error('角度或波长超出范围。');
 for(const k of ['inserted','sourceOn','assisted'])if(typeof s[k]!=='boolean')throw Error('开关状态无效。');
 return {...Object.fromEntries(['p','r','a','wavelength','inserted','sourceOn','assisted'].map(k=>[k,s[k]])),extension:s.extension==null?null:validateConditions(s.extension)};
}
export function normalize(s){const c=settings(s);if(!Array.isArray(s.records)||s.records.length>200)throw Error('最多保留200条记录。');for(const k of ['prediction','conclusion'])if(typeof s[k]!=='string'||s[k].length>4000)throw Error('文字记录无效。');return {...c,prediction:s.prediction,conclusion:s.conclusion,records:s.records.map(r=>{const v=settings(r);if(!v.sourceOn)throw Error('记录中包含关闭光源的数据。');return v;})};}
export function record(s){const c=normalize(s);if(!c.sourceOn)throw Error('请先开启光源。');if(c.extension?.mode==='measurement'&&!c.extension.targetGenerated)throw Error('请先启用目标偏振光。');if(c.records.length>=200)throw Error('已达到200条记录上限。');const row=settings(c);if(c.records.some(r=>JSON.stringify(r.extension)===JSON.stringify(row.extension)&&(row.extension||['p','r','a','wavelength','inserted'].every(k=>r[k]===row[k]))))throw Error('该条件已记录。');return {...c,records:[...c.records,row]};}
export function report(s){
 if(s.records.some(r=>r.extension))return {title:'琼斯偏振 · 扩展模式记录',model:'jones-retarder140-v1',columns:['序号','模式','条件索引','I/I₀','DOP','方式'],rows:s.records.map((r,i)=>{const q=simulate(r);return [String(i+1),r.extension?modeNames[r.extension.mode]:'基础仪器',`条件${i+1}`,q.intensity.toFixed(6),(q.dop??1).toFixed(6),r.assisted?'辅助':'手动']}),summaries:['预测：'+s.prediction,'结论：'+s.conclusion,...s.records.map((r,i)=>`条件${i+1}：${r.extension?describeConditions(r.extension):`起偏${r.p}°，波片${r.r}°，检偏${r.a}°，波长${r.wavelength}nm，波片${r.inserted?'插入':'移出'}`}`)],series:[],formula:'自由元件链以Mueller–Stokes传播；理想Jones元件转换为Mueller矩阵；退偏后仍保留非偏振光强。显微镜记录为视场边缘45°采样。',limitation:'扩展光路为计算示意，非新增实物模型。各模式入射强度归一化为1；基础仪器以起偏器后强度为1。显微镜沿用二维近似锥光模型，不代表真实干涉色或完整物镜系统。不同模式的记录不连接成同一测量曲线。'};

 const groups=new Map();for(const r of s.records){const key=`P=${r.p}° / ${r.inserted?'R='+r.r+'°':'无波片'} / ${r.wavelength} nm`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push({x:r.a,y:simulate(r).intensity});}
 return {title:'琼斯偏振实验',model:'jones-retarder140-v1',columns:['组次','起偏器/°','波片/°','检偏器/°','波长/nm','波片状态','I/I₀','方式'],rows:s.records.map((r,i)=>[String(i+1),String(r.p),String(r.r),String(r.a),String(r.wavelength),r.inserted?'插入':'移出',simulate(r).intensity.toFixed(6),r.assisted?'辅助':'手动']),summaries:['预测：'+s.prediction,'结论：'+s.conclusion,...[...groups].map(([k,p])=>`${k}：${p.length}个检偏角，强度范围${Math.min(...p.map(v=>v.y)).toFixed(4)}–${Math.max(...p.map(v=>v.y)).toFixed(4)}。`)],series:[...groups].map(([title,points])=>({title,xLabel:'检偏器角度 / °',yLabel:'I/I₀',points:points.sort((a,b)=>a.x-b.x)})),formula:'E出 = P(a) W(r,δ) E入；δ = 360° × 140 nm / λ。无波片时 I/I₀ = cos²(a−p)。',limitation:'I₀定义为起偏器后的强度，理想元件；140 nm固定光程延迟近似，忽略色散、损耗和探测器响应，不输出真实lux。偏振椭圆显示检偏器前状态。机械部分尺寸为估算；不包含二维补偿器、退偏器等扩展模式。'};
}
