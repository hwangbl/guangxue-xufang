// All lengths are millimetres. Scalar, paraxial Fresnel integration;
// slit illumination is uniform across the width, invariant in the vertical direction.
export const MODEL='diffraction-fresnel-v1';
export const WAVELENGTH_MM=.000650;
export const APERTURES={
  s02:{kind:'single',width:.02,label:'单缝 · 0.02 mm',wheel:0,slot:0},
  s04:{kind:'single',width:.04,label:'单缝 · 0.04 mm',wheel:0,slot:1},
  s08:{kind:'single',width:.08,label:'单缝 · 0.08 mm',wheel:0,slot:2},
  s16:{kind:'single',width:.16,label:'单缝 · 0.16 mm',wheel:0,slot:3},
  c20:{kind:'circular',width:.2,label:'圆孔 · 直径 0.20 mm',wheel:0,slot:4},
  c40:{kind:'circular',width:.4,label:'圆孔 · 直径 0.40 mm',wheel:0,slot:5},
  d125:{kind:'double',width:.04,spacing:.125,label:'双缝 · 缝宽 0.04 / 间距 0.125 mm',wheel:1,slot:0},
  d250:{kind:'double',width:.04,spacing:.25,label:'双缝 · 缝宽 0.04 / 间距 0.25 mm',wheel:1,slot:1},
  d500:{kind:'double',width:.04,spacing:.5,label:'双缝 · 缝宽 0.04 / 间距 0.50 mm',wheel:1,slot:2},
};
export const taskName={single:'单缝测缝宽',circular:'圆孔中央斑',double:'双缝测间距'};
export const fresh=()=>({aperture:'s04',apertureMm:250,screenMm:1050,sourceOn:true,cursorMm:0,leftMm:null,rightMm:null,order:1,hints:false,assisted:false,records:[],prediction:'',conclusion:''});
function fail(message){throw Error(message)}
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
export function settings(s){
  if(!s||!Object.hasOwn(APERTURES,s.aperture))fail('请选择受支持的孔径。');
  if(!finite(s.apertureMm,180,400)||!finite(s.screenMm,550,1190)||s.screenMm-s.apertureMm<300)fail('孔径位置须为180–400 mm，屏面550–1190 mm，传播距离至少300 mm。');
  if(typeof s.sourceOn!=='boolean')fail('光源状态无效。');
  return {aperture:s.aperture,apertureMm:s.apertureMm,screenMm:s.screenMm,sourceOn:s.sourceOn};
}
export function fresnelNumber(s){const a=APERTURES[s.aperture],radius=(a.width+(a.spacing??0))/2;return radius*radius/(WAVELENGTH_MM*(s.screenMm-s.apertureMm));}
export function characteristic(s){const a=APERTURES[s.aperture],L=s.screenMm-s.apertureMm;return (a.kind==='circular'?1.219669891:1)*WAVELENGTH_MM*L/(a.spacing??a.width);}
export function sinc(x){return Math.abs(x)<1e-8?1:Math.sin(x)/x;}
// Rational Bessel approximations, absolute error ~1e-8 (independently checked in tests).
export function besselJ0(x){
  x=Math.abs(x);if(x<8){const y=x*x;return (57568490574+y*(-13362590354+y*(651619640.7+y*(-11214424.18+y*(77392.33017+y*-184.9052456)))))/(57568490411+y*(1029532985+y*(9494680.718+y*(59272.64853+y*(267.8532712+y)))));}
  const z=8/x,y=z*z,p=1+y*(-.001098628627+y*(.00002734510407+y*(-.000002073370639+y*.0000002093887211))),q=-.01562499995+y*(.0001430488765+y*(-.000006911147651+y*(.0000007621095161-y*.0000000934945152)));
  return Math.sqrt(.636619772/x)*(Math.cos(x-.785398164)*p-z*Math.sin(x-.785398164)*q);
}
export function besselJ1(x){
  const sign=x<0?-1:1;x=Math.abs(x);if(x<8){const y=x*x,num=[-30.16036606,15704.48260,-2972611.439,242396853.1,-7895059235,72362614232].reduce((v,c)=>v*y+c,0),den=[1,376.9991397,99447.43394,18583304.74,2300535178,144725228442].reduce((v,c)=>v*y+c,0);return sign*x*num/den;}
  const z=8/x,y=z*z,p=1+y*(.00183105+y*(-.00003516396496+y*(.000002457520174+y*-.000000240337019))),q=.04687499995+y*(-.0002002690873+y*(.000008449199096+y*(-.00000088228987+y*.000000105787412)));
  return sign*Math.sqrt(.636619772/x)*(Math.cos(x-2.356194491)*p-z*Math.sin(x-2.356194491)*q);
}
export function farFieldIntensity(s,x){const a=APERTURES[s.aperture],u=Math.PI*a.width*x/(WAVELENGTH_MM*(s.screenMm-s.apertureMm));return a.kind==='circular'?(Math.abs(u)<1e-8?1:(2*besselJ1(u)/u)**2):sinc(u)**2*(a.kind==='double'?Math.cos(Math.PI*a.spacing*x/(WAVELENGTH_MM*(s.screenMm-s.apertureMm)))**2:1);}
export function intensity(s,x,segments=160){
  if(!s.sourceOn)return 0;
  const a=APERTURES[s.aperture],L=s.screenMm-s.apertureMm,k=Math.PI/(WAVELENGTH_MM*L);
  // Resolve rapid phase oscillations in the outer screen, including widest slits.
  segments=Math.max(segments,2*Math.ceil(4*a.width*(Math.abs(x)+(a.spacing??0)/2+a.width/2)/(WAVELENGTH_MM*L)));
  let re=0,im=0;
  if(a.kind==='circular'){
    const r=a.width/2,h=1/segments;
    for(let i=0;i<=segments;i++){const t=i*h,w=i===0||i===segments?1:i%2?4:2,p=k*r*r*t*t,v=2*t*besselJ0(2*k*Math.abs(x)*r*t)*w;re+=v*Math.cos(p);im+=v*Math.sin(p);}
    return (re*re+im*im)*(h/3)**2;
  }
  const centres=a.kind==='double'?[-a.spacing/2,a.spacing/2]:[0],h=a.width/segments;
  for(const centre of centres)for(let i=0;i<=segments;i++){const u=centre-a.width/2+i*h,p=k*(u*u-2*x*u),w=i===0||i===segments?1:i%2?4:2;re+=w*Math.cos(p);im+=w*Math.sin(p);}
  return (re*re+im*im)/(3*segments*centres.length)**2;
}
export function profile(s,halfWidth=40,count=1001){settings(s);return Array.from({length:count},(_,i)=>{const x=-halfWidth+2*halfWidth*i/(count-1);return {x,y:intensity(s,x)};});}
function measurement(r){
  const c=settings(r),a=APERTURES[c.aperture];
  if(r.task!==a.kind||!c.sourceOn||!finite(r.leftMm,-40,40)||!finite(r.rightMm,-40,40)||r.leftMm>=0||r.rightMm<=0||r.rightMm-r.leftMm<.02)fail('请分别选择中心两侧的同级位置，左侧须为负、右侧须为正。');
  if(!Number.isInteger(r.order)||r.order<1||r.order>5||(a.kind==='circular'&&r.order!==1)||typeof r.assisted!=='boolean')fail('读数级次或辅助标记无效。');
  if(fresnelNumber(c)>.1+1e-12)fail('当前条件不满足本实验远场反演门槛（F≤0.1）；请增大屏距或选择更小的孔径/双缝间距。图样仍可观察。');
  return {...c,task:a.kind,leftMm:r.leftMm,rightMm:r.rightMm,order:r.order,assisted:r.assisted};
}
export function result(r){const a=APERTURES[r.aperture],L=r.screenMm-r.apertureMm,span=r.rightMm-r.leftMm;return {span,estimate:2*(a.kind==='circular'?1.219669891:r.order)*WAVELENGTH_MM*L/span,nominal:a.spacing??a.width};}
export function normalize(s){
  const c=settings(s);
  if(!Array.isArray(s.records)||s.records.length>200)fail('最多保存200组完整测量。');
  if(!finite(s.cursorMm,-40,40)||!Number.isInteger(s.order)||s.order<1||s.order>5)fail('坐标或级次无效。');
  for(const key of ['leftMm','rightMm'])if(s[key]!==null&&!finite(s[key],-40,40))fail('选点坐标无效。');
  for(const key of ['hints','assisted'])if(typeof s[key]!=='boolean')fail('显示状态无效。');
  for(const key of ['prediction','conclusion'])if(typeof s[key]!=='string'||s[key].length>4000)fail('实验文字无效或过长。');
  if(APERTURES[c.aperture].kind==='circular'&&s.order!==1)fail('圆孔首版只测第一暗环。');
  return {...c,cursorMm:s.cursorMm,leftMm:s.leftMm,rightMm:s.rightMm,order:s.order,hints:s.hints,assisted:s.assisted,records:s.records.map(measurement),prediction:s.prediction,conclusion:s.conclusion};
}
export function changeSettings(s,patch){
  const next={...s,...patch};
  if(['aperture','apertureMm','screenMm','sourceOn','order'].some(k=>next[k]!==s[k])){next.leftMm=null;next.rightMm=null;next.assisted=next.hints;}
  if(APERTURES[next.aperture]?.kind==='circular')next.order=1;
  if(next.hints)next.assisted=true;
  return normalize(next);
}
export function record(s){
  const c=normalize(s);if(c.records.length>=200)fail('已达到200组记录上限。');
  const r=measurement({...c,task:APERTURES[c.aperture].kind});
  if(c.records.some(old=>['aperture','apertureMm','screenMm','leftMm','rightMm','order'].every(k=>old[k]===r[k])))fail('这组读数已经记录，请改变级次、屏距或重新测量。');
  return {...c,records:[...c.records,r],leftMm:null,rightMm:null,assisted:c.hints};
}
export function report(s){
  s=normalize(s);
  const groups=[...new Set(s.records.map(r=>r.aperture))];
  return {
    title:'基础衍射实验',model:MODEL,
    columns:['组次','任务/规格mm','孔径/屏位mm','传播距离mm','左读数mm','右读数mm','级次','测得尺寸mm','辅助'],
    rows:s.records.map((r,i)=>{const a=APERTURES[r.aperture],spec=a.kind==='double'?`双缝 ${a.width}/${a.spacing}`:`${a.kind==='single'?'单缝':'圆孔'} ${a.width}`;return [String(i+1),spec,`${r.apertureMm}/${r.screenMm}`,String(r.screenMm-r.apertureMm),r.leftMm.toFixed(2),r.rightMm.toFixed(2),String(r.order),result(r).estimate.toFixed(5),r.assisted?'使用提示':'手动'];}),
    summaries:[...groups.map(key=>{const a=s.records.filter(r=>r.aperture===key),avg=a.reduce((sum,r)=>sum+result(r).estimate,0)/a.length;return `${APERTURES[key].label}：${a.length}组，${APERTURES[key].kind==='double'?'缝间距':APERTURES[key].kind==='circular'?'直径':'缝宽'}均值 ${avg.toFixed(5)} mm。`;}),'预测：'+s.prediction,'结论：'+s.conclusion],
    series:groups.map(key=>({title:APERTURES[key].label,xLabel:'传播距离/mm',yLabel:'测得尺寸/mm',points:s.records.filter(r=>r.aperture===key).map(r=>({x:r.screenMm-r.apertureMm,y:result(r).estimate}))})),
    formula:'单缝 a = 2mλL/(x右−x左)；双缝 d = 2mλL/(x右−x左)（选择对称同级亮纹）；圆孔 D = 2×1.21967λL/(x右−x左)（第一暗环）。λ = 0.000650 mm。表中双缝规格为缝宽/间距；孔径/屏位为两者导轨位置。',
    limitation:'图样采用标量近轴Fresnel积分，均匀相干照明；单/双缝仅计算水平方向，竖直无限长。强度按各孔径理想远场中心归一化，亮度经显示映射，不能跨孔径比较绝对功率。远场尺寸反演仅允许F≤0.1；双缝包络会使亮峰略偏移。坐标步进0.01 mm是模拟读数分度，非真实仪器精度；未模拟制造公差、噪声或激光发散。外观部分尺寸估算。'
  };
}
