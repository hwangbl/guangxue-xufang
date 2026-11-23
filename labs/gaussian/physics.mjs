import {calculateGaussianBeam} from './optics.mjs';
export const fresh=()=>({lensMm:600,detectorMm:820,irisMm:12,beamOn:false,laserOn:true,records:[],prediction:'',conclusion:''});
export function beam(s){return calculateGaussianBeam({w0:.0005,wavelength:632.8e-9,propagationDistance:.756,lensFocalLength:.15,lensPosition:(s.lensMm-194)/1000,observationZ:(s.detectorMm-194)/1000});}
export function normalize(v){if(v?.version!==1||v?.lab!=='gaussian')throw Error('不是兼容的高斯光束档案');const s=v.state;if(!s||!Array.isArray(s.records)||s.records.length>200)throw Error('记录格式无效');for(const [k,a,b]of [['lensMm',300,650],['detectorMm',750,950]])if(!Number.isFinite(s[k])||s[k]<a||s[k]>b)throw Error('位置超出行程');for(const k of ['beamOn','laserOn'])if(typeof s[k]!=='boolean')throw Error('开关状态无效');for(const k of ['prediction','conclusion'])if(typeof s[k]!=='string'||s[k].length>4000)throw Error('文字过长或格式错误');const records=s.records.map(r=>{if(!Number.isFinite(r.lensMm)||r.lensMm<300||r.lensMm>650||!Number.isFinite(r.z)||r.z<750||r.z>950||!Number.isFinite(r.w)||r.w<=0||r.w>10)throw Error('测量记录无效');return {lensMm:r.lensMm,z:r.z,w:r.w};});const irisMm=s.irisMm??12;if(!Number.isFinite(irisMm)||irisMm<4||irisMm>24)throw Error('光阑孔径超出范围');return {lensMm:s.lensMm,detectorMm:s.detectorMm,irisMm,laserOn:s.laserOn,beamOn:s.beamOn,prediction:s.prediction,conclusion:s.conclusion,records};}
export function fit(records){
  // Repeated readings at one detector position do not count as new sample positions.
  const rows=[...new Map(records.map(r=>[r.z,r])).values()];
  if(rows.length<7)return null;
  const m=Array.from({length:3},()=>[0,0,0,0]);
  for(const r of rows){const x=(r.z-850)/100,p=[1,x,x*x],y=r.w*r.w;for(let i=0;i<3;i++){for(let j=0;j<3;j++)m[i][j]+=p[i]*p[j];m[i][3]+=p[i]*y;}}
  for(let i=0;i<3;i++){let k=i;for(let j=i+1;j<3;j++)if(Math.abs(m[j][i])>Math.abs(m[k][i]))k=j;[m[i],m[k]]=[m[k],m[i]];const d=m[i][i];if(Math.abs(d)<1e-12)return null;for(let j=i;j<4;j++)m[i][j]/=d;for(let k=0;k<3;k++)if(k!==i){const f=m[k][i];for(let j=i;j<4;j++)m[k][j]-=f*m[i][j];}}
  const [c,b,a]=m.map(r=>r[3]),x=-b/(2*a),w2=c-b*b/(4*a);
  if(a<=0||w2<=0)return null;
  const z=850+100*x, radiusAt=position=>Math.sqrt(Math.max(0,c+b*((position-850)/100)+a*((position-850)/100)**2));
  const residuals=rows.map(r=>({z:r.z,measured:r.w,fitted:radiusAt(r.z),difference:r.w-radiusAt(r.z)}));
  const rmse=Math.sqrt(residuals.reduce((sum,r)=>sum+r.difference**2,0)/rows.length);
  return {z,w:Math.sqrt(w2),bracketed:Math.min(...rows.map(r=>r.z))<z&&Math.max(...rows.map(r=>r.z))>z,rmse,residuals,coefficients:{a,b,c}};
}

export function samplingFeedback(records,prediction='',conclusion=''){
  const positions=[...new Set(records.map(r=>r.z))].sort((a,b)=>a-b),result=fit(records),messages=[];
  if(positions.length<7)messages.push(`还需 ${7-positions.length} 个不同探测位置；同一位置重复记录不计入七点要求。`);
  else if(!result)messages.push('七个位置无法形成有效的束腰拟合，请扩大采样范围。');
  else if(!result.bracketed){
    if(result.z<=positions[0])messages.push(result.z<750?'拟合束腰在探测屏行程外；请移动透镜再测。':'束腰位于测点左侧；向更小的探测屏位置补点。');
    else messages.push(result.z>950?'拟合束腰在探测屏行程外；请移动透镜再测。':'束腰位于测点右侧；向更大的探测屏位置补点。');
  }else messages.push('七点以上且测点覆盖拟合束腰两侧。');
  if(!prediction.trim())messages.push('请先写下对束腰变化的预测。');
  if(!conclusion.trim())messages.push('请结合记录和残差填写结论。');
  return {positions:positions.length,fit:result,complete:!!result?.bracketed&&!!prediction.trim()&&!!conclusion.trim(),messages};
}

export function formatResidual(value){return Math.abs(value)<0.000005?'0.00000':value.toFixed(5);}
