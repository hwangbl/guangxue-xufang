import * as scan from '../polarization-scan/physics.mjs';
import * as lc from '../liquid-crystal/physics.mjs';
import * as aberration from '../aberration/physics.mjs';
import * as microscope from '../microscope/physics.mjs';
import * as telescope from '../telescope/physics.mjs';
import * as resonator from '../resonator/physics.mjs';
import * as fiber from '../fiber/physics.mjs';
import * as diffraction from '../diffraction/physics.mjs';
import * as jones from '../jones/physics.mjs?v=jones-20260929';
import * as lens from '../lens/physics.mjs';
import * as fourier from '../fourier/physics.mjs';
import * as gaussian from '../gaussian/physics.mjs';
import * as polarimeter from '../polarimeter/physics.mjs';
import {decodeSession} from '../jcd3/session.js';
import {radiusFromDiameters} from '../jcd3/physics.js';
import {restoreMeasurement} from '../michelson/measurement.mjs';
import * as prism from '../spectrometer/physics.mjs';
import * as grating from '../grating/physics.mjs';

export const LABS = {
 'liquid-crystal':{title:'液晶光阀实验',model:'tn-static-frank-v1',steps:['从0 V开始上扫，记录电压有效值与探测相对光强。','反向下扫并比较静态结果，查看分子剖面。','切换检偏器，对照互补透过率，保存预测与结论。']},
 'polarization-scan':{title:'偏振扫描实验',model:'senarmont-scan-v1',steps:['移出样品，寻找空白消光并记录实际零位。','插入样品，在至少三个位置逐点寻找消光并记录。','比较不同厚度或波长，换波长后重新校零，保存预测与结论。']},
  aberration:{title:'像差实验',model:'aberration-primary-wave-v1',steps:['预测孔径对球差光斑的影响，记录至少三种孔径。','对照正负视场，手动读取同一光斑特征的横向位置。','移动观察屏，比较光斑与光扇，保存预测和结论。']},
  microscope:{title:'显微镜实验',model:'microscope-finite-scalar-v1',steps:['预测调焦两侧的清晰程度，转动旋钮并记录至少三种位置。','移动刻线样品，手动选择两点并换算物方距离。','换用高倍物镜，对照双点分辨，保存预测与结论。']},
  telescope:{title:'望远镜实验',model:'telescope-paraxial-v1',steps:['预测正负目镜的成像方向，移动目镜寻找无焦条件。','用同一角度标尺记录目标角与出射角读数，比较倍率。','更换目镜或孔径，记录调焦两侧和出瞳，保存结论。']},
  resonator:{title:'谐振腔实验',model:resonator.MODEL,steps:['选择镜组，先预测稳定腔长区间。','移动镜2，逐点记录稳定、临界或退化状态及有效模式尺寸。','比较平凹、双凹与平平条件，保存结论和报告。']},
  fiber:{title:'光纤耦合实验',model:fiber.MODEL,steps:['记录初始五轴条件和功率，通过位移与角度微调提高耦合效率。','进入扫描任务锁定Y、Z和两轴倾角，逐点记录至少9个X位置，覆盖采样峰两侧。','根据记录比较对称性与峰值位置，保存结论并导出报告。']},
  diffraction:{title:'基础衍射实验',model:'diffraction-fresnel-v1',steps:['选择单缝、圆孔或双缝，预测图样随孔径和屏距的变化。','在光屏或强度曲线上手动选择左右同级位置；单缝和圆孔选暗纹，双缝选亮纹。','在远场条件下记录至少三组，改变屏距或级次比较测得尺寸，保存结论。']},
  jones:{title:'琼斯偏振实验',model:'jones-retarder140-v1',steps:['移出波片，预测检偏器角度与光强关系。','记录0至180度多个角度的归一化强度，验证马吕斯定律。','在560 nm插入140 nm延迟片，设与起偏器相差45度，比较不同检偏角的强度。']},
  lens:{title:'透镜成像实验',model:'lens-paraxial-v1',steps:['选择透镜，打开光源，预测成像位置。','移动光屏调焦，记录至少三种物距下的物面、透镜和屏面位置。','按标称焦距分组，比较 uv/(u+v) 的结果，保存预测与结论。']},
  fourier:{title:'4f 空间滤波实验',model:'fourier-coherent-v1',steps:['观察固定的 f–f–f–f 布局，预测滤波结果。','同一物片记录无滤波、圆孔低通和方向狭缝，比较三面。','核对截止频率与倒像，保存对照并解释方向选择。']},
  gaussian:{title:'高斯光束实验',model:'gaussian-ideal-v1',steps:['预测移动透镜对束腰位置的影响。','固定透镜，记录至少七个不同探测屏位置的半径。','检查采样是否覆盖束腰两侧，比较拟合与预测并保存结论。']},
  polarimeter:{title:'旋光仪实验',model:'wxg4-halfshadow-v1',steps:['开灯，装入空白管，关闭仓盖并调清视场。','调节至三分视场暗且等亮，空白和样品各记录至少五次。','用样品均值减去空白均值，计算蔗糖浓度。']},
  jcd3: {title:'牛顿环实验', model:'jcd3-ideal-v1', steps:['调节照明与焦距，使叉丝和暗环清晰。','沿同一方向测量两级暗环的左右位置。','选择 m > n，计算曲率半径并复核测量条件。']},
  michelson: {title:'迈克尔逊干涉实验', model:'michelson-ideal-v1', steps:['开启光源，调镜使光斑重合，再移入扩束镜。','记录起点，沿同一方向微调并手动计数。','记录终点、计算波长，至少重复三组并比较。']},
  spectrometer: {title:'分光计实验', model:'prism-ideal-v1', steps:['先调叉丝，再调两镜筒焦距、狭缝及载物台。','固定载物台，锁紧微动，对准两个反射像并记录。','记录直射位置，观察折返后测最小偏向，计算折射率。']},
  grating: {title:'光栅衍射实验', model:'grating-ideal-v1', steps:['开灯、调平调焦，装入光栅并调正、锁紧。','先记录零级，再记录左右同级谱线的双游标。','计算波长，按谱线和级次分别重复测量。']}
};
const fail = () => {throw Error('档案数据无效或版本不受支持，当前实验未改变。');};
const finite = (x,a,b) => typeof x==='number' && Number.isFinite(x) && x>=a && x<=b;
const limits = {telescope:[-180,180],table:[-50,105],focus:[-8,8],collimator:[-8,8],diopter:[-2,2],slit:[.02,2],tiltX:[-.5,.5],tiltZ:[-.5,.5],telescopeAnchor:[-180,180],tableAnchor:[-50,105]};

// Restore only completed measurements; in-progress counts, scans and slots are deliberately reset.
export function normalizePayload(lab, input) {
  if(!Object.hasOwn(LABS,lab)||!input||JSON.stringify(input).length>1500000)fail();
  if(lab==='diffraction')return {state:diffraction.normalize(input.state)};
  if(lab==='polarization-scan')return {state:scan.normalize(input.state)};
  if(lab==='liquid-crystal')return {state:lc.normalize(input.state)};
  if(lab==='aberration')return {state:aberration.normalize(input.state)};
  if(lab==='microscope')return {state:microscope.normalize(input.state)};
  if(lab==='telescope')return {state:telescope.normalize(input.state)};
  if(lab==='resonator')return {state:resonator.normalize(input.state)};
  if(lab==='fiber')return {state:fiber.normalize(input.state)};
  if(lab==='jones')return {state:jones.normalize(input.state)};
  if(lab==='lens')return {state:lens.normalize(input.state)};
  if(lab==='fourier')return {state:fourier.normalize(input.state)};
  if(lab==='gaussian')return {state:gaussian.normalize({version:1,lab:'gaussian',state:input.state})};
  if(lab==='polarimeter')return polarimeter.normalize(input);
  if(lab==='jcd3') {
    const value=decodeSession(JSON.stringify({version:1,state:input.state,records:input.records}));
    if(!value)fail();
    const selection=input.selection??{m:15,n:5};
    if(![5,10,15,20].includes(selection.m)||![5,10,15,20].includes(selection.n)||selection.m<=selection.n)fail();
    return {...value,selection:{m:selection.m,n:selection.n}};
  }
  const state=input.state;
  if(!state||!Array.isArray(state.records))fail();
  if(lab==='michelson') {
    const restored=restoreMeasurement(JSON.stringify(state));
    if(!restored||restored.dropped||state.records.length>500)fail();
    const {dropped,...clean}=restored; void dropped;
    clean.records=clean.records.map((r,i)=>({...r,assisted:state.records[i].assisted===true}));
    return {state:{...clean,assisted:state.assisted===true,start:null,direction:0,reversed:false}};
  }
  const physics=lab==='grating'?grating:prism, clean=physics.fresh();
  for(const key of Object.keys(clean)) {
    if(['records','slots','samples'].includes(key))continue;
    const v=state[key];
    if(typeof clean[key]==='boolean') {if(typeof v!=='boolean')fail();}
    else if(limits[key]) {
      const range=lab==='grating'?({telescope:[-100,100],table:[-20,20],focus:[-3,3],collimator:[-3,3],slit:[.05,1]}[key]||limits[key]):limits[key];
      if(!finite(v,...range))fail();
    } else if(typeof clean[key]==='string') {
      if(!(key==='mode'?['direct','reflect','refract']:key==='source'?['sodium','mercury']:Object.keys(grating.LINES)).includes(v))fail();
    } else if(key==='order'&&![1,2].includes(v))fail();
    clean[key]=v;
  }
  if(lab==='grating'&&grating.LINES[clean.line].source!==clean.source)fail();
  if(state.records.length>200)fail();
  clean.records=state.records.map(row=>{
    if(!row?.slots)fail();
    const expected=lab==='grating'?['zero','left','right']:['left','right','direct','minimum'];
    if(Object.keys(row.slots).length!==expected.length||expected.some(k=>!Object.hasOwn(row.slots,k)))fail();
    for(const slot of Object.values(row.slots))if(!slot||!finite(slot.table,-180,180))fail();
    return {...physics.calculate(row.slots),slots:structuredClone(row.slots),assisted:row.assisted===true};
  });
  return {state:clean};
}

export function reportData(lab,input) {
  const data=normalizePayload(lab,input), rows=[], summaries=[],series=[];
  let columns,formula;
  if(lab==='diffraction')return diffraction.report(data.state);
  if(lab==='polarization-scan')return scan.report(data.state);
  if(lab==='liquid-crystal')return lc.report(data.state);
  if(lab==='aberration')return aberration.report(data.state);
  if(lab==='microscope')return microscope.report(data.state);
  if(lab==='telescope')return telescope.report(data.state);
  if(lab==='resonator')return resonator.report(data.state);
  if(lab==='fiber')return fiber.report(data.state);
  if(lab==='jones')return jones.report(data.state);
  if(lab==='lens')return lens.report(data.state);
  if(lab==='fourier') {
    const s=data.state,results=s.records.map(fourier.simulate);
    return {title:LABS[lab].title,model:LABS[lab].model,columns:['物片','滤片','孔径/mm','方向/°','偏移 x,y/mm','能量/%'],rows:s.records.map((r,i)=>[fourier.PATTERNS[r.pattern],fourier.FILTERS[r.filter],String(r.aperture),String(r.angle),`${r.offsetX}, ${r.offsetY}`,(results[i].transmission*100).toFixed(2)]),summaries:['预测：'+s.prediction,'结论：'+s.conclusion,'当前物片学习检查：'+fourier.comparisonFeedback(s).messages.join(' '),...s.records.map((r,i)=>`${i+1}：${r.filter==='none'?'全频谱通过':`孔径半宽对应频带 ${fourier.cutoff(r).toFixed(3)} mm⁻¹${r.filter==='lowpass'&&(r.offsetX||r.offsetY)?'；偏心圆孔不是中心低通':''}`}；像面 M = −1。`)],series:[],images:s.records.map((r,i)=>({title:`${i+1}. ${fourier.PATTERNS[r.pattern]} · ${fourier.FILTERS[r.filter]}`,size:fourier.N,pixels:Array.from(results[i].output,v=>Math.round(Math.min(1,Math.max(0,v))*255))})),formula:'νx = xF/(λf₁)，中心圆孔截止频率 νc = D/(2λf₁)；狭缝法向半带宽采用相同换算。M = −f₂/f₁ = −1；I = |U|²。',limitation:'λ=632.8 nm，f₁=f₂=150 mm，固定4f轴向布局。相干理想薄透镜；4 mm视野、128²采样。FFT周期边界，不模拟像差、噪声和失调。图像固定强度显示，峰值超过1截白。'};
  }
  if(lab==='gaussian') {
    const s=data.state,groups=[...new Set(s.records.map(r=>r.lensMm))],fits=new Map(groups.map(l=>[l,gaussian.fit(s.records.filter(r=>r.lensMm===l))]));
    const residual=r=>{const f=fits.get(r.lensMm);if(!f)return '—';const x=(r.z-850)/100,c=f.coefficients;return gaussian.formatResidual(r.w-Math.sqrt(Math.max(0,c.c+c.b*x+c.a*x*x)))};
    return {title:LABS[lab].title,model:LABS[lab].model,columns:['组次','透镜 / mm','探测屏 / mm','半径 / mm','拟合残差 / mm'],rows:s.records.map((r,i)=>[String(i+1),String(r.lensMm),String(r.z),r.w.toFixed(4),residual(r)]),summaries:[...groups.map(l=>{const a=gaussian.samplingFeedback(s.records.filter(r=>r.lensMm===l),s.prediction,s.conclusion),f=a.fit;return f?`透镜 ${l} mm：束腰 ${f.z.toFixed(2)} mm，半径 ${f.w.toFixed(4)} mm；残差均方根 ${f.rmse.toFixed(5)} mm；${a.messages.join(' ')}`:`透镜 ${l} mm：${a.messages.join(' ')}`;}),'预测：'+s.prediction,'结论：'+s.conclusion],series:groups.map(l=>({title:`透镜 ${l} mm`,xLabel:'导轨位置 / mm',yLabel:'半径平方 / mm²',points:s.records.filter(r=>r.lensMm===l).map(r=>({x:r.z,y:r.w*r.w})).sort((a,b)=>a.x-b.x)})),formula:'w²(z) = a z² + b z + c；束腰位置 = −b/(2a)，束腰半径 = √(c−b²/(4a))。残差为测得半径减拟合半径，均方根按不同探测位置计算。',limitation:'632.8 nm，输入束腰0.5 mm，焦距150 mm，M²=1；理想同轴薄透镜，无噪声及光阑衍射。探测读数取至0.0001 mm。光阑调节仅演示机械结构。'};
  }

  if(lab==='polarimeter') {
    const records=data.state.records;
    const summaries=['按样品管长度分别做空白校正；空白和样品各至少五次。'];
    const series=[];
    for(const length of ['200','100']) {
      const result=polarimeter.result(records,length);
      summaries.push(result?`${length} mm：空白均值 ${result.blank.toFixed(4)}°，样品均值 ${result.sample.toFixed(4)}°，旋光角 ${result.rotation.toFixed(4)}°；浓度 ${result.concentration.toFixed(5)} g/mL。`:`${length} mm：记录不足，尚未计算浓度。`);
      for(const solution of ['blank','sample']) {
        const points=records.filter(r=>r.length===length&&r.solution===solution).map((r,i)=>({x:i+1,y:r.angle}));
        if(points.length)series.push({title:`${length} mm · ${solution==='blank'?'空白':'样品'}`,xLabel:'组次',yLabel:'检偏角 / °',points});
      }
    }
    return {title:LABS[lab].title,model:LABS[lab].model,columns:['组次','样品管 / mm','溶液','检偏角 / °'],rows:records.map((r,i)=>[String(i+1),r.length,r.solution==='blank'?'空白':'样品',r.angle.toFixed(4)]),summaries,series,formula:'α = 样品角度均值 − 空白角度均值；c = α / ([α] l)，l 以 dm 计。',limitation:'589.3 nm 教学模型，比旋光度 66.5；按管长分组，不模拟温度与色散误差。'};
  }
  if(lab==='jcd3') {
    columns=['环级次','左位置 / mm','右位置 / mm','直径 / mm','波长 / nm','状态'];
    const records=new Map(data.records);
    const points=[...records].filter(([,r])=>r.left&&r.right).map(([n,r])=>({x:n,y:(r.left.value-r.right.value)**2})).sort((a,b)=>a.x-b.x);
    if(points.length)series.push({title:'环径平方与级次',xLabel:'暗环级次',yLabel:'D² / mm²',points});
    for(const [order,row] of records)rows.push([String(order),row.left?.value.toFixed(3)??'—',row.right?.value.toFixed(3)??'—',row.left&&row.right?Math.abs(row.left.value-row.right.value).toFixed(3):'—',String((row.left||row.right).conditions.wavelength_nm),[...new Set([...(row.left?.issues??[]),...(row.right?.issues??[])])].join('；')||'已记录']);
    const {m,n}=data.selection, a=records.get(m),b=records.get(n);
    formula='R = (Dm² - Dn²) / [4(m-n)λ]；直径与波长使用一致单位。';
    if(a?.left&&a?.right&&b?.left&&b?.right) {
      const shots=[a.left,a.right,b.left,b.right],keys=Object.keys(shots[0].conditions);
      if(keys.some(k=>shots.some(s=>Math.abs(s.conditions[k]-shots[0].conditions[k])>1e-6)))summaries.push('测量条件不一致，请重新测量，未生成曲率结果。');
      else {
        const r=radiusFromDiameters(Math.abs(a.left.value-a.right.value),Math.abs(b.left.value-b.right.value),m,n,shots[0].conditions.wavelength_nm);
        summaries.push(r===null?'环径无效，请复核。':`m=${m}，n=${n}；曲率半径 ${(r/1000).toFixed(6)} m`);
      }
    } else summaries.push('尚未完成所选两级的左右测量。');
  } else {
    const records=data.state.records;
    if(lab==='michelson') {
      columns=['组次','起点 / mm','终点 / mm','条纹数','波长 / nm','辅助'];
      records.forEach((r,i)=>rows.push([String(i+1),r.a.toFixed(4),r.b.toFixed(4),String(r.n),r.wave.toFixed(4),r.assisted?'是':'否']));
      formula='λ = 2|终点 - 起点| / 条纹数；位移以 mm 记录，结果换算为 nm。';
    } else if(lab==='spectrometer') {
      columns=['组次/位置','游标 I / °','游标 II / °','载物台 / °','结果','辅助'];
      records.forEach((r,i)=>Object.entries(r.slots).forEach(([k,v])=>rows.push([`${i+1} / ${{left:'左反射',right:'右反射',direct:'直射',minimum:'最小偏向'}[k]}`,v.values[0].toFixed(6),v.values[1].toFixed(6),v.table.toFixed(4),`A=${r.a.toFixed(4)}°；δ=${r.d.toFixed(4)}°；n=${r.n.toFixed(5)}`,r.assisted?'是':'否'])));
      formula='A = 两反射像夹角 / 2；n = sin[(A + δmin)/2] / sin(A/2)。双游标分度 1′。';
    } else {
      columns=['组次/位置','谱线/级次','游标 I / °','游标 II / °','波长 / nm','辅助'];
      records.forEach((r,i)=>Object.entries(r.slots).forEach(([k,v])=>rows.push([`${i+1} / ${{zero:'零级',left:'左',right:'右'}[k]}`,`${grating.LINES[r.line].name} / ${r.order}`,v.values[0].toFixed(6),v.values[1].toFixed(6),r.wave.toFixed(4),r.assisted?'是':'否'])));
      formula='λ = d sinθ / |m|，d = 1/600 mm；左右各自相对零级求有向角差后平均。双游标分度 1′。';
    }
    const groups=new Map();
    for(const r of records){const key=lab==='grating'?`${grating.LINES[r.line].name} / ${r.order}级`:LABS[lab].title;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(lab==='spectrometer'?r.n:r.wave);}
    for(const [key,values] of groups){const mean=values.reduce((a,b)=>a+b,0)/values.length,sd=values.length>1?Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/(values.length-1)):null;summaries.push(`${key}：${values.length}组，均值 ${mean.toFixed(5)}${lab==='spectrometer'?'':' nm'}${sd===null?'；不足两组，不计算标准差':`；样本标准差 ${sd.toFixed(5)}${lab==='spectrometer'?'':' nm'}`}。`);series.push({title:key,xLabel:'组次（组内顺序）',yLabel:lab==='spectrometer'?'折射率 n':'波长 / nm',points:values.map((y,i)=>({x:i+1,y}))});}
  }
  return {title:LABS[lab].title,columns,rows,summaries,series,formula,model:LABS[lab].model,limitation:'仪器外观、调焦和照明采用教学近似，未全面模拟机械回差与像差。统计为重复测量描述，不等于完整不确定度评定。'};
}

export function validateArchive(value) {
  if(!value||value.format!=='wanxiang-3d'||value.version!==1||!Object.hasOwn(LABS,value.lab)||!(value.model===LABS[value.lab].model||(value.lab==='resonator'&&value.model===resonator.LEGACY_MODEL)||(value.lab==='fiber'&&value.model===fiber.LEGACY_MODEL)))fail();
  if(typeof value.id!=='string'||!/^[-\w]{1,80}$/.test(value.id)||typeof value.name!=='string'||!value.name.trim()||value.name.length>80||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt)))fail();
  if(typeof value.notes!=='string'||value.notes.length>5000)fail();
  const payload=normalizePayload(value.lab,value.payload);
  if(value.lab==='resonator'&&value.model===resonator.LEGACY_MODEL&&[payload.state,...payload.state.records].some(s=>s.m!==0||s.n!==0))fail();
  if(value.lab==='fiber'&&value.model===fiber.LEGACY_MODEL&&[payload.state,...payload.state.records].some(s=>s.axialUm!==0||s.pitchMrad!==0||s.yawMrad!==0))fail();
  const image=value.image??null;
  if(image!==null&&(typeof image!=='string'||image.length>1800000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)))fail();
  const mode=value.mode??'guided';if(!['guided','independent'].includes(mode))fail();
  return {format:'wanxiang-3d',version:1,id:value.id,name:value.name.trim(),lab:value.lab,model:LABS[value.lab].model,createdAt:value.createdAt,notes:value.notes,payload,image,mode};
}

export function toCsv(report) {
  const cell=v=>'"'+String(v).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
  return '\ufeff'+[report.columns,...report.rows,[],['计算方法',report.formula],...report.summaries.map(s=>['统计',s]),['模型',report.model],['范围',report.limitation]].map(r=>r.map(cell).join(',')).join('\r\n');
}
