import {HLP,LP45,stokesFromJones,polarizedJonesFromStokes,propagateThroughChainStepByStep,linearPolarizer,wavePlate,muellerFromJones,applyMuellerToStokes,depolarizerMueller,degreeOfPolarization,analyzePolarization,polarizationEllipsePoints} from './engine.mjs?v=jones-20260929';

export const modeNames={basic:'自由元件链',babinet_soleil:'Babinet–Soleil补偿',measurement:'偏振态测量',depolarization:'消偏振模拟',microscope:'偏光显微镜'};
export const elementNames={polarizer:'偏振片',halfwave:'半波片',quarterwave:'四分之一波片',waveplate:'可变波片',rotator:'旋光器',faraday:'法拉第旋转器',crystal:'双折射晶体',babinet_soleil:'BS补偿器',depolarizer:'退偏器'};
export function describeConditions(c){
 const input=`入射Jones分量 Ex=${c.inputJones[0].map(v=>Number(v.toFixed(6))).join(',')}，Ey=${c.inputJones[1].map(v=>Number(v.toFixed(6))).join(',')}（实部,虚部）`;
 if(c.mode==='basic')return input+'；'+(c.elements.map((e,i)=>`${i+1}.${elementNames[e.type]} 轴角${e.angle}°`+(e.retardation!==undefined?`，延迟${e.retardation}°`:'')+(e.type==='depolarizer'?`，退偏因子${e.depolFactor??0}`:'')+(e.type==='crystal'?`，厚度${e.thickness??1}mm，nₒ=${e.no??1.544}，nₑ=${e.ne??1.553}，λ=${e.wavelength??632.8}nm`:'')).join('；')||'无光学元件');
 if(c.mode==='babinet_soleil')return `${input}；快轴${c.bsAngle}°，补偿延迟${c.bsRetardation}°；${c.measuring?`样品延迟${c.mysteryRetardation}°，检偏器135°`:'未放置待测波片'}`;
 if(c.mode==='measurement')return `入射Stokes [${c.targetStokes.join(', ')}]；目标光${c.targetGenerated?'启用':'关闭'}；检偏器${c.polarizerAngle}°；${c.useQWP?`理想90°波片，轴角${c.qwpAngle}°`:'移出波片'}`;
 if(c.mode==='depolarization')return `${input}；退偏程度${c.concentration}%`;
 return `厚度${c.thickness}mm；双折射Δn=${c.birefringence}；会聚半角${c.convergenceAngle}°；波长${c.wavelength}nm；视场边缘45°方位采样`;
}
export function defaults(mode='basic'){return {version:1,lab:'jones',model:'jones-extensions-v1',mode,inputJones:structuredClone(mode==='basic'||mode==='depolarization'?LP45:HLP),elements:[],bsAngle:0,bsRetardation:0,measuring:false,mysteryRetardation:0,targetStokes:[1,0,0,0],targetGenerated:false,polarizerAngle:0,qwpAngle:0,useQWP:false,concentration:0,thickness:.03,birefringence:.009,convergenceAngle:15,wavelength:550};}
function number(v,min,max){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('偏振条件包含无效数值或超出范围。');return v;}
export function validateConditions(v){
 if(!v||v.version!==1||v.lab!=='jones'||v.model!=='jones-extensions-v1'||!Object.hasOwn(modeNames,v.mode))throw Error('偏振条件版本或模式不兼容。');
 const c=defaults(v.mode);
 if(!Array.isArray(v.inputJones)||v.inputJones.length!==2||v.inputJones.some(x=>!Array.isArray(x)||x.length!==2))throw Error('Jones矢量无效。');
 c.inputJones=v.inputJones.map(x=>x.map(n=>number(n,-1,1)));
 if(Math.abs(stokesFromJones(c.inputJones)[0]-1)>1e-8)throw Error('入射Jones矢量必须归一化。');
 if(!Array.isArray(v.targetStokes)||v.targetStokes.length!==4)throw Error('Stokes矢量无效。');
 c.targetStokes=v.targetStokes.map(n=>number(n,-1,1));
 if(c.targetStokes[0]!==1||Math.hypot(...c.targetStokes.slice(1))>1+1e-8)throw Error('Stokes矢量不满足物理约束。');
 for(const [k,lo,hi] of [['bsAngle',-90,90],['bsRetardation',0,360],['mysteryRetardation',0,360],['polarizerAngle',0,180],['qwpAngle',-90,90],['concentration',0,100],['thickness',.005,.1],['birefringence',.0001,.03],['convergenceAngle',5,40],['wavelength',400,700]])c[k]=number(v[k],lo,hi);
 for(const k of ['measuring','targetGenerated','useQWP']){if(typeof v[k]!=='boolean')throw Error('偏振开关无效。');c[k]=v[k];}
 if(!Array.isArray(v.elements)||v.elements.length>32)throw Error('元件链最多32个元件。');
 const types=['polarizer','halfwave','quarterwave','waveplate','rotator','faraday','crystal','babinet_soleil','depolarizer'];
 c.elements=v.elements.map((e,i)=>{if(!types.includes(e.type))throw Error('未知元件类型。');const r={id:'transfer-'+i,type:e.type,angle:number(e.angle,-180,180),label:e.type};for(const [k,lo,hi] of [['retardation',0,360],['thickness',0,100],['no',1,5],['ne',1,5],['wavelength',100,2000],['depolFactor',0,1]])if(e[k]!==undefined)r[k]=number(e[k],lo,hi);if(['waveplate','babinet_soleil'].includes(r.type))r.retardation??=0;if(r.type==='crystal'){r.thickness??=1;r.no??=1.544;r.ne??=1.553;r.wavelength??=632.8;}if(r.type==='depolarizer')r.depolFactor??=0;return r;});return c;
}
export function fromInstrument(s){if(s.extension)return validateConditions(s.extension);const c=defaults();const t=s.p*Math.PI/180;c.inputJones=[[Math.cos(t),0],[Math.sin(t),0]];if(s.inserted)c.elements.push({id:'retarder',type:'waveplate',angle:((s.r+180)%360)-180,retardation:360*140/s.wavelength});c.elements.push({id:'analyzer',type:'polarizer',angle:((s.a+180)%360)-180});c.wavelength=s.wavelength;return validateConditions(c);}
export function applyConditions(s,c){return {...s,extension:validateConditions(c)};}
export function microscopeIntensity(c,r,azimuth){const theta=r*c.convergenceAngle*Math.PI/180;const ct=Math.sqrt(Math.max(0,1-(1.544*Math.sin(theta)/(1.544+c.birefringence))**2));const opd=c.birefringence*c.thickness*1e6*ct;return Math.sin(2*azimuth)**2*Math.sin(Math.PI*opd/c.wavelength)**2;}
export function evaluateConditions(value){
 const c=validateConditions(value);let s=stokesFromJones(c.inputJones);const apply=m=>{s=applyMuellerToStokes(muellerFromJones(m),s);};
 if(c.mode==='basic'){const steps=propagateThroughChainStepByStep(c.inputJones,c.elements);s=steps.at(-1).stokes;}
 if(c.mode==='babinet_soleil'){if(c.measuring)apply(wavePlate(0,c.mysteryRetardation));apply(wavePlate(c.bsAngle,c.bsRetardation));if(c.measuring){apply(linearPolarizer(135));}}
 if(c.mode==='measurement'){s=c.targetGenerated?[...c.targetStokes]:[0,0,0,0];if(c.useQWP)apply(wavePlate(c.qwpAngle,90));apply(linearPolarizer(c.polarizerAngle));}
 if(c.mode==='depolarization')s=applyMuellerToStokes(depolarizerMueller(c.concentration/100),s);
 if(c.mode==='microscope'){const intensity=microscopeIntensity(c,1,Math.PI/4);s=[intensity,-intensity,0,0];}
 const dop=degreeOfPolarization(s),j=polarizedJonesFromStokes(s);
 return {intensity:s[0],stokes:s,dop,ellipse:polarizationEllipsePoints(analyzePolarization(j),120),kind:c.mode==='microscope'?'锥光视场（边缘45°采样）':s[0]<1e-12?'消光':dop<1e-8?'非偏振':dop<1-1e-8?'部分偏振':Math.abs(s[3]/s[0])>1-1e-8?'圆偏振':Math.abs(s[3])<1e-8?'线偏振':'椭圆偏振'};
}
