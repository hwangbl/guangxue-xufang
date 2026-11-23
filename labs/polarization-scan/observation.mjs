import {simulate,report} from './physics.mjs';
export const SERIES_COLORS=['#287d74','#b55b34','#606caa','#8c5084'];
export function paintDetector(canvas,state){
 const r=simulate(state);canvas.width=canvas.height=400;const c=canvas.getContext('2d');c.fillStyle='#090f0c';c.fillRect(0,0,400,400);
 // Display brightness fixed across settings. Numeric readout remains linear intensity.
 const color=r.wavelengthNm===500?'80,190,150':r.wavelengthNm===550?'155,210,60':'230,155,50';
 const g=c.createRadialGradient(200,200,0,200,200,135);g.addColorStop(0,`rgba(${color},${r.intensity})`);g.addColorStop(.6,`rgba(${color},${r.intensity*.85})`);g.addColorStop(1,`rgba(${color},0)`);c.fillStyle=g;c.fillRect(0,0,400,400);
 c.strokeStyle='#5b7065';c.strokeRect(35,35,330,330);c.fillStyle='#becdc4';c.font='14px system-ui';c.fillText('固定曝光 · 颜色仅标记所选波长',55,385);
}
export function paintCurve(canvas,state){
 const d=report(state);canvas.width=600;canvas.height=350;const c=canvas.getContext('2d');c.fillStyle='#f9fbfa';c.fillRect(0,0,600,350);c.font='14px system-ui';c.fillStyle='#23453f';c.fillText('测得延迟 / nm（固定0–300 nm）',50,25);
 const x=v=>55+(v+10)*24,y=v=>270-v*.75;
 for(const v of [0,100,200,300]){c.strokeStyle='#dce5e1';c.beginPath();c.moveTo(55,y(v));c.lineTo(535,y(v));c.stroke();c.fillStyle='#456057';c.fillText(String(v),15,y(v)+5);}
 for(const v of [-10,-5,0,5,10])c.fillText(String(v),x(v)-8,292);
 const colors=SERIES_COLORS;
 d.series.forEach((s,i)=>{c.strokeStyle=c.fillStyle=colors[i%colors.length];c.beginPath();s.points.forEach((p,j)=>{if(j)c.lineTo(x(p.x),y(p.y));else c.moveTo(x(p.x),y(p.y));});c.stroke();for(const p of s.points){c.beginPath();c.arc(x(p.x),y(p.y),3,0,Math.PI*2);c.fill();}});
 c.fillStyle='#456057';c.fillText(`位置/mm；${d.series.length}组，${state.records.length}个已记录点`,55,326);
}
