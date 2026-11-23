export const SPECIFIC_ROTATION=66.5;
export function fresh(){return {lampOn:false,lidOpen:true,inserted:true,tubeLength:'200',angle:0,focus:0,solution:'blank',concentration:.1,records:[]};}
function angleFromEqualDark(state) {
  const rotation = state.solution === 'sample'
    ? SPECIFIC_ROTATION * state.concentration * Number(state.tubeLength) / 100
    : 0;
  return state.angle - rotation;
}

export function isEqualDark(state) {
  // Accept the nearest division of the 0.05° vernier, including ties.
  return Math.abs(angleFromEqualDark(state)) <= 0.025 + 1e-9;
}

export function fields(state) {
  const offset = angleFromEqualDark(state) * Math.PI / 180;
  const halfShadowAngle = 1.75 * Math.PI / 180;
  return {
    left: Math.sin(offset - halfShadowAngle) ** 2,
    center: Math.sin(offset + halfShadowAngle) ** 2,
  };
}
export function issues(s){return [!s.lampOn&&'请开启钠灯',s.lidOpen&&'请关闭样品室',!s.inserted&&'请装入样品管',s.focus>.25&&'请调清视场'].filter(Boolean);}
export function result(records,length){const rows=records.filter(r=>r.length===length),a=rows.filter(r=>r.solution==='blank'),b=rows.filter(r=>r.solution==='sample');if(a.length<5||b.length<5)return null;const mean=v=>v.reduce((s,r)=>s+r.angle,0)/v.length;const rotation=mean(b)-mean(a);return {blank:mean(a),sample:mean(b),rotation,concentration:rotation/(SPECIFIC_ROTATION*Number(length)/100),blankCount:a.length,sampleCount:b.length};}
export function normalize(input){const s=input?.state;if(!s||!Array.isArray(s.records)||s.records.length>200)throw Error('旋光仪档案格式无效');const out=fresh();for(const k of ['lampOn','lidOpen','inserted']){if(typeof s[k]!=='boolean')throw Error('开关状态无效');out[k]=s[k];}for(const [k,a,b]of [['angle',-30,30],['focus',0,1],['concentration',.01,.2]]){if(typeof s[k]!=='number'||!Number.isFinite(s[k])||s[k]<a||s[k]>b)throw Error('旋光仪参数超出范围');out[k]=s[k];}if(!['100','200'].includes(s.tubeLength)||!['blank','sample'].includes(s.solution))throw Error('样品类型无效');out.tubeLength=s.tubeLength;out.solution=s.solution;out.records=s.records.map(r=>{if(!r||!['100','200'].includes(r.length)||!['blank','sample'].includes(r.solution)||!Number.isFinite(r.angle)||Math.abs(r.angle)>30)throw Error('旋光仪读数无效');return {length:r.length,solution:r.solution,angle:r.angle};});return {state:out};}
