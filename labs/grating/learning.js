import {vernier,alignment} from './reading.mjs';
import {readouts,dms,setupIssue} from './physics.mjs';
export function installLearning({getState,ready,change,select}){
 const $=id=>document.getElementById(id);let which=0;
 const dialog=$('vernier-dialog');
 $('open-vernier').onclick=()=>{dialog.showModal();render();};$('close-vernier').onclick=()=>dialog.close();
 $('vernier-side').onchange=()=>{which=Number($('vernier-side').value);render();};
 $('vernier-hints').onchange=render;
 $('vernier-zoom').onchange=()=>{$('vernier-canvas').style.width=$('vernier-zoom').value==='2'?'1800px':'900px';};
 for(const b of document.querySelectorAll('[data-reading-step]'))b.onclick=()=>{const s=getState();change('telescope',s.telescope+Number(b.dataset.readingStep)/60,true);};
 $('guide-select').onclick=()=>{select('table');$('table-input').focus();$('table-input').scrollIntoView({block:'nearest'});};
 for(const b of document.querySelectorAll('[data-align-step]'))b.onclick=()=>{const s=getState();change('table',s.table+Number(b.dataset.alignStep),Math.abs(Number(b.dataset.alignStep))<.1);};
 function drawScale(s){
  const v=vernier(readouts(s.telescope)[which]),c=$('vernier-canvas').getContext('2d'),hints=$('vernier-hints').checked;
  c.clearRect(0,0,1800,400);c.save();c.scale(2,2);c.fillStyle='#f4f8f5';c.fillRect(0,0,900,200);c.font='14px sans-serif';c.fillStyle='#3d5c4c';c.fillText('主尺 / ° · 每格 0.5°',14,25);c.fillText('游标 / ′ · 30格对应主尺29格',14,188);
  const pitch=25,origin=80,zero=origin+v.index*pitch/30;
  const tick=(x,y1,y2,color,width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y1);c.lineTo(x,y2);c.stroke();};
  for(let i=-2;i<=31;i++){const x=origin+i*pitch,deg=((v.base+i*.5)%360+360)%360;tick(x,60,100,'#395646');if(Number.isInteger(deg)){c.fillStyle='#395646';c.fillText(String(deg),x-10,51);}}
  for(let i=0;i<=30;i++){const x=zero+i*pitch*29/30;tick(x,103,i%5===0?144:131,'#395646');if(i%5===0){c.fillStyle='#395646';c.fillText(String(i),x-5,161);}}
  if(hints){tick(origin,57,101,'#ad6a26',3);tick(zero,100,146,'#ad6a26',3);tick(zero+v.index*pitch*29/30,59,145,'#087c65',3);}
  c.restore();$('vernier-canvas').setAttribute('aria-label',hints?`游标${which+1}，主尺${dms(v.base)}，游标第${v.index}格重合，读数${dms(v.value)}`:'主尺与游标刻度展开图，可开启读数提示');
  $('vernier-answer').hidden=!hints;$('vernier-answer').textContent=`主尺 ${dms(v.base)} ＋ 第 ${v.index} 格 × 1′ ＝ ${dms(v.value)}`;
  $('reading-lock').textContent=s.telescopeLocked?'望远镜已锁紧，可微动观察刻线变化。':'请先在调节区锁紧望远镜，再使用微动。';
  for(const b of document.querySelectorAll('[data-reading-step]'))b.disabled=!ready()||!s.telescopeLocked;
 }
 function render(){const s=getState(),a=alignment(s,ready());if(dialog.open)drawScale(s);
  const hints=[!ready()?'等待模型就绪。':setupIssue(s),'将光栅装上载物台，刻线保持竖直。',`法线偏角 ${s.table.toFixed(3)}°。先松开载物台，向${s.table>0?'减小':'增大'}角度方向粗调至0°附近；锁紧后以1′微动。`,'已接近正入射，请锁紧载物台，测量期间保持方位不变。','调正完成。先对准并记录零级，再测左右同级谱线。'];
  $('alignment-hint').textContent=hints[a.stage];
  for(const [i,li]of [...$('alignment-steps').children].entries()){li.classList.toggle('done',a.stage>i);li.classList.toggle('current',a.stage===i);li.setAttribute('aria-current',a.stage===i?'step':'false');}
  for(const b of document.querySelectorAll('[data-align-step]'))b.disabled=!ready()||!s.mounted||(Math.abs(Number(b.dataset.alignStep))<.1?!s.tableLocked:s.tableLocked);
  const active=s.lamp&&s.mounted&&a.available;
  $('symmetry-values').textContent=active?`左 ${Math.abs(a.left).toFixed(3)}° · 右 ${a.right.toFixed(3)}° · 右−左 ${a.delta.toFixed(2)}′`:'开灯并装入光栅后显示左右同级谱线。';
  const c=$('alignment-canvas').getContext('2d');c.clearRect(0,0,600,150);c.fillStyle='#edf3ef';c.fillRect(0,0,600,150);c.font='15px sans-serif';c.fillStyle='#536d60';c.fillText('左右偏角差 / ′（模型预测）',15,24);const extent=active?Math.max(1,Math.ceil(Math.abs(a.delta)*1.2)):1;
  c.strokeStyle='#99aca0';c.beginPath();c.moveTo(45,84);c.lineTo(555,84);c.moveTo(300,45);c.lineTo(300,104);c.stroke();c.fillText('−'+extent,35,128);c.fillText('0',295,128);c.fillText('+'+extent,535,128);
  if(active){const x=300+a.delta/extent*240;c.fillStyle=Math.abs(s.table)<=.05?'#285f4e':'#ad6a26';c.beginPath();c.arc(x,84,7,0,Math.PI*2);c.fill();}else c.fillText('暂无谱线比较',235,62);
 }
 return render;
}
