import {simulate} from './physics.mjs';
export const HALF_RANGES=Object.freeze([100,300,600]);
const PLOT={left:60,top:44,width:480,height:480};
export function pointFromCanvas(x,y,halfRange=300){
 if(!HALF_RANGES.includes(halfRange)||!Number.isFinite(x)||!Number.isFinite(y))throw new RangeError('观察坐标或显示范围无效。');
 if(x<PLOT.left||x>PLOT.left+PLOT.width||y<PLOT.top||y>PLOT.top+PLOT.height)return null;
 return {xUm:((x-PLOT.left)/PLOT.width*2-1)*halfRange,yUm:(1-(y-PLOT.top)/PLOT.height*2)*halfRange};
}
/** Fixed user-selected coordinate ranges; never auto-fit to the current spot. */
export function paintSpot(canvas,s,halfRange=300,showReference=false){
 if(!HALF_RANGES.includes(halfRange))throw new RangeError('请选择固定观察范围。');
 const r=simulate(s),c=canvas.getContext('2d');canvas.width=canvas.height=600;
 c.fillStyle='#f9fbfa';c.fillRect(0,0,600,600);c.font='15px system-ui';c.fillStyle='#23453f';
 c.fillText('几何点列 · 相对主光线位置 / μm',60,25);
 const px=x=>300+x*240/halfRange,py=y=>284-y*240/halfRange;
 c.textAlign='center';for(let i=-2;i<=2;i++){const v=i*halfRange/2,x=px(v),y=py(v);c.strokeStyle=i?'#dce5e1':'#a4bcb2';c.beginPath();c.moveTo(x,44);c.lineTo(x,524);c.moveTo(60,y);c.lineTo(540,y);c.stroke();c.fillStyle='#456057';c.fillText(v.toString(),x,549);c.textAlign='right';c.fillText(v.toString(),52,y+5);c.textAlign='center';}
 let clipped=0;c.save();c.beginPath();c.rect(60,44,480,480);c.clip();c.fillStyle='#287d74';
 for(const p of r.rays){if(Math.abs(p.exUm)>halfRange||Math.abs(p.eyUm)>halfRange)clipped++;c.fillRect(px(p.exUm)-.75,py(p.eyUm)-.75,1.5,1.5);}
 if(showReference){c.strokeStyle='#b55b34';c.lineWidth=1.5;c.beginPath();c.arc(px(r.centroidXUm),py(r.centroidYUm),r.rmsUm*240/halfRange,0,2*Math.PI);c.stroke();c.beginPath();c.moveTo(px(r.centroidXUm)-5,py(r.centroidYUm));c.lineTo(px(r.centroidXUm)+5,py(r.centroidYUm));c.moveTo(px(r.centroidXUm),py(r.centroidYUm)-5);c.lineTo(px(r.centroidXUm),py(r.centroidYUm)+5);c.stroke();}
 c.restore();c.textAlign='left';c.fillStyle='#456057';c.fillText(`固定范围 ±${halfRange} μm；窗外光线 ${clipped}/${r.rays.length}`,60,579);
 return {clipped,total:r.rays.length};
}
export function paintFan(canvas,s,halfRange=300){
 if(!HALF_RANGES.includes(halfRange))throw new RangeError('请选择固定观察范围。');
 const r=simulate(s),c=canvas.getContext('2d');canvas.width=600;canvas.height=300;c.fillStyle='#f9fbfa';c.fillRect(0,0,600,300);c.font='14px system-ui';c.fillStyle='#23453f';c.fillText('光扇 · 蓝：子午X偏差；橙：弧矢Y偏差',60,25);
 const px=u=>300+u*240,py=v=>145-v*100/halfRange;
 for(const y of [-halfRange,0,halfRange]){c.strokeStyle='#dce5e1';c.beginPath();c.moveTo(60,py(y));c.lineTo(540,py(y));c.stroke();c.fillStyle='#456057';c.fillText(String(y),8,py(y)+5);}
 c.save();c.beginPath();c.rect(60,45,480,200);c.clip();
 for(const [key,axis,color] of [['tangential','exUm','#287d74'],['sagittal','eyUm','#b55b34']]){c.strokeStyle=color;c.lineWidth=2;c.beginPath();r.fan.forEach((p,i)=>{if(i)c.lineTo(px(p.u),py(p[key][axis]));else c.moveTo(px(p.u),py(p[key][axis]));});c.stroke();}
 c.restore();c.fillStyle='#456057';c.fillText('−1',52,267);c.fillText('0',296,267);c.fillText('1',536,267);c.fillText('固定参考瞳坐标；光阑缩小时仅显示通光部分',60,291);
}
