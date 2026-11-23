import {simulate,psf} from './physics.mjs';
const sinc=x=>Math.abs(x)<1e-10?1:Math.sin(x)/x;
/** Incoherent transfer of a uniform circular pupil with quadratic defocus.
 * Integral over the overlap of two shifted unit pupils, divided by pupil area.
 * Keeps the SIGN of the OTF: defocus can reverse contrast.
 */
export function opticalTransfer(frequencyPerUm,focusUm,na,steps=512){
 if(![frequencyPerUm,focusUm,na].every(v=>typeof v==='number'&&Number.isFinite(v))||frequencyPerUm<0||Math.abs(focusUm)>20||na<.1||na>.65||!Number.isInteger(steps)||steps<64||steps>4096||steps%2)throw new RangeError('传递函数参数无效。');
 if(frequencyPerUm===0)return 1;
 const shift=.55*frequencyPerUm/na;if(shift>=2)return 0;
 const phase=Math.PI*na*na*focusUm/.55,limit=1-shift/2;
 // x=limit*sin(t) resolves the square-root edge of the overlap.
 let sum=0;
 for(let i=0;i<=steps;i++){
  const t=Math.PI/2*i/steps,x=limit*Math.sin(t),height=2*Math.sqrt(Math.max(0,1-(x+shift/2)**2));
  sum+=(i===0||i===steps?1:i%2?4:2)*height*Math.cos(2*phase*shift*x)*limit*Math.cos(t);
 }
 return 2*sum*(Math.PI/2)/(3*steps)/Math.PI;
}
export function rulerProfile(s,pixels=600){
 if(!Number.isInteger(pixels)||pixels<64||pixels>2048)throw new RangeError('观察窗采样宽度无效。');
 const r=simulate(s),period=10,duty=.08,terms=Math.floor(2*r.na/.55*period),coefficients=[];
 for(let n=1;n<=terms;n++)coefficients.push({n,value:2*Math.sin(Math.PI*n*duty)/(Math.PI*n)*opticalTransfer(n/period,s.focusUm,r.na)*sinc(Math.PI*n*r.fieldUm/(pixels*period))});
 const values=Float32Array.from({length:pixels},(_,i)=>{
  const x=-((i+.5)/pixels-.5)*r.fieldUm-s.stageXUm;
  return 1-duty-coefficients.reduce((sum,c)=>sum+c.value*Math.cos(2*Math.PI*c.n*x/period),0);
 });
 return {values,fieldUm:r.fieldUm,periodUm:period,model:'incoherent-periodic-ruler',pixelWidthUm:r.fieldUm/pixels};
}
/** Fixed 4µm square enlarged detail, centered on the two-point specimen.
 * It is a separate analytical magnifier, not the full eyepiece field.
 */
export function pointDetail(s,pixels=240){
 if(!Number.isInteger(pixels)||pixels<64||pixels>800)throw new RangeError('细节窗采样宽度无效。');
 const r=simulate(s),fieldUm=4,step=.002,maxRadius=3.3;
 const lookup=Float64Array.from({length:Math.ceil(maxRadius/step)+1},(_,i)=>psf(i*step,s.focusUm,r.na));
 const sample=radius=>{const p=radius/step,k=Math.floor(p);return lookup[k]+(lookup[k+1]-lookup[k])*(p-k);};
 const values=new Float32Array(pixels*pixels);
 for(let y=0;y<pixels;y++)for(let x=0;x<pixels;x++){
  const sx=((x+.5)/pixels-.5)*fieldUm,sy=((y+.5)/pixels-.5)*fieldUm;
  values[y*pixels+x]=(sample(Math.hypot(sx-.4,sy))+sample(Math.hypot(sx+.4,sy)))/2;
 }
 return {values,fieldUm,pixels,separationUm:.8,exposure:'fixed-half-focused-single-point-peak'};
}
export function paintRuler(canvas,s){
 const width=600,height=600,profile=rulerProfile(s,width),ctx=canvas.getContext('2d');canvas.width=width;canvas.height=height;
 const image=ctx.createImageData(width,height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,I=Math.max(0,Math.min(1,profile.values[x]));image.data[i]=18+209*I;image.data[i+1]=28+218*I;image.data[i+2]=23+209*I;image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);
 // Fixed specimen origin guide is an annotation; never used as a measured result.
 const r=simulate(s),originX=300-s.stageXUm/r.fieldUm*600,originY=300+s.stageYUm/r.fieldUm*600;
 ctx.strokeStyle='#267291';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(originX,0);ctx.lineTo(originX,600);ctx.moveTo(0,originY);ctx.lineTo(600,originY);ctx.stroke();ctx.setLineDash([]);
 for(const p of s.picks??[]){ctx.strokeStyle='#c4355c';ctx.beginPath();ctx.arc((p.nx+.5)*600,(p.ny+.5)*600,6,0,Math.PI*2);ctx.stroke();}
 return profile;
}
export function paintPoints(canvas,s){
 const data=pointDetail(s,240),ctx=canvas.getContext('2d');canvas.width=240;canvas.height=240;const image=ctx.createImageData(240,240);
 for(let i=0;i<data.values.length;i++){const I=data.values[i],k=i*4;image.data[k]=10+100*I;image.data[k+1]=15+220*I;image.data[k+2]=12+130*I;image.data[k+3]=255;}
 ctx.putImageData(image,0,0);return data;
}
