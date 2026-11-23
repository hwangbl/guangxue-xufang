import {fft2d,fftshift2d} from './fft.mjs';
export const N=128,FIELD=4,LAMBDA=.0006328,F=150;
export const PATTERNS={letter:'不对称 F 物片',grid:'交叉光栅',slits:'双缝',circle:'圆孔'};
export const FILTERS={none:'无滤波',lowpass:'圆孔低通',directional:'方向狭缝'};
export const fresh=()=>({pattern:'letter',filter:'none',aperture:.6,angle:0,offsetX:0,offsetY:0,records:[],prediction:'',conclusion:''});
export function settings(s){return {pattern:s.pattern,filter:s.filter,aperture:s.aperture,angle:s.angle,offsetX:s.offsetX,offsetY:s.offsetY};}
export function cutoff(s){return s.aperture/2/(LAMBDA*F);}
export function comparisonFeedback(s){
 const rows=s.records.filter(r=>r.pattern===s.pattern),centered=r=>Math.abs(r.offsetX)<1e-9&&Math.abs(r.offsetY)<1e-9;
 const missing=[];
 if(!rows.some(r=>r.filter==='none'))missing.push('无滤波基准');
 if(!rows.some(r=>r.filter==='lowpass'&&centered(r)))missing.push('居中圆孔低通');
 if(!rows.some(r=>r.filter==='directional'&&centered(r)))missing.push('居中方向狭缝');
 const messages=[missing.length?'当前物片还需记录：'+missing.join('、')+'。':'当前物片的三组基础对照已齐全。'];
 if(rows.some(r=>r.filter==='lowpass'&&!centered(r)))messages.push('偏心圆孔属于偏移通带，不计作中心低通基准。');
 if(!s.prediction.trim())messages.push('请先填写实验预测。');
 if(!s.conclusion.trim())messages.push('请结合图像和透过能量填写结论。');
 if(!missing.length)messages.push('可保持狭缝宽度与位置不变，再旋转90°记录，比较方向选择。');
 return {missing,complete:!missing.length&&!!s.prediction.trim()&&!!s.conclusion.trim(),messages};
}
export function object(pattern){const a=new Float64Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const X=x-N/2,Y=y-N/2;let v=false;if(pattern==='letter')v=(X>=-26&&X<-16&&Y>=-35&&Y<35)||(X>=-26&&X<26&&Y>=-35&&Y<-25)||(X>=-26&&X<14&&Y>=-6&&Y<4);if(pattern==='grid')v=(Math.abs(X)<46&&Math.abs(Y)<46)&&(Math.cos(2*Math.PI*X/16)>.35||Math.cos(2*Math.PI*Y/16)>.35);if(pattern==='slits')v=Math.abs(Y)<36&&(Math.abs(X-12)<3||Math.abs(X+12)<3);if(pattern==='circle')v=X*X+Y*Y<24*24;a[y*N+x]=v?1:0;}return a;}
export function simulate(s){
 const input=object(s.pattern),re=input.slice(),im=new Float64Array(N*N);fft2d(re,im,N,false);
 const spectrum=new Float64Array(N*N),mask=new Float64Array(N*N),theta=s.angle*Math.PI/180;let total=0,passed=0;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,fx=(x<N/2?x:x-N)/FIELD,fy=-(y<N/2?y:y-N)/FIELD;
  const X=LAMBDA*F*fx-s.offsetX,Y=LAMBDA*F*fy-s.offsetY;
  const pass=s.filter==='none'||(s.filter==='lowpass'?Math.hypot(X,Y)<s.aperture/2:Math.abs(-X*Math.sin(theta)+Y*Math.cos(theta))<s.aperture/2);
  const power=re[i]**2+im[i]**2;total+=power;if(pass)passed+=power;spectrum[i]=Math.log1p(power);mask[i]=pass?1:0;re[i]*=mask[i];im[i]*=mask[i];
 }
 fftshift2d(spectrum,N);fftshift2d(mask,N);fft2d(re,im,N,true);
 // Two physical forward transforms invert both coordinates. FFT/IFFT filtering
 // computes the upright field first; discrete parity maps index x to (-x) mod N.
 const output=new Float64Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const j=((N-y)%N)*N+(N-x)%N;output[y*N+x]=re[j]**2+im[j]**2;}
 return {input,spectrum,mask,output,transmission:total?passed/total:0};
}
export function normalize(input){
 const fail=()=>{throw Error('4f 档案无效，当前实验未改变。');};
 const clean=s=>{if(!s||!Object.hasOwn(PATTERNS,s.pattern)||!Object.hasOwn(FILTERS,s.filter))fail();for(const [k,a,b] of [['aperture',.05,2.5],['angle',0,180],['offsetX',-1,1],['offsetY',-1,1]])if(typeof s[k]!=='number'||!Number.isFinite(s[k])||s[k]<a||s[k]>b)fail();return settings(s);};
 const state=clean(input);if(!Array.isArray(input.records)||input.records.length>30)fail();
 for(const key of ['prediction','conclusion'])if(typeof input[key]!=='string'||input[key].length>4000)fail();
 return {...state,records:input.records.map(clean),prediction:input.prediction,conclusion:input.conclusion};
}
