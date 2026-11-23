import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {queueLabChange,manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup} from '../shared/lab-runtime.js';
import {installProductPresentation} from '../shared/product-presentation.js';
let presentation;
import {addExperimentTable,frameExperimentTable} from '../shared/experiment-table.js';
import {installPlatformBridge} from '../shared/platform-bridge.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {motionIssue,APEX,INDEX,clamp,signed,separation,dms,readouts,deviation,minimumTable,beams,alignmentIssue,minimumBracketed,recordIssue,calculate,fresh,restore,csv} from './physics.mjs';

const $=id=>document.getElementById(id),key='wanxiang-spectrometer-v1',rad=Math.PI/180;
let s=fresh(),loaded=false,model,renderer,camera,orbit,scene,path,selected='telescope',showPath=false,demo=null;
let savedDraft=null,prismMount=null,lastPrismMode="reflect";
const nodes={},initial={},labels={left:'左反射',right:'右反射',direct:'直射',minimum:'最小偏向'};
const specs={
 telescope:['望远镜转角',-180,180,1/60,'°','转动望远镜，追踪狭缝像。对准纵丝后读取两个游标。'],
 table:['载物台转角',-50,105,.05,'°','反射测顶角期间保持载物台不动；折射测量时缓慢转动，寻找像的折返。'],
 focus:['望远镜调焦',-8,8,.05,'mm','使平行入射光形成清晰的狭缝像。调焦基准为 0 mm。'],
 collimator:['平行光管调焦',-8,8,.05,'mm','移动狭缝至物镜焦平面。默认焦距170 mm，基准为 0 mm。'],
 slit:['狭缝宽度',.02,2,.01,'mm','宽缝容易寻找，测量前收窄至0.30 mm以内，避免对准误差。'],
 tiltX:['载物台倾斜 X',-.5,.5,.01,'°','观察反射像是否在横丝上；此控件合成三点调平的一方向倾斜。'],
 tiltZ:['载物台倾斜 Z',-.5,.5,.01,'°','与另一方向交替调整，使两个反射像都落在横丝上。'],
 diopter:['目镜视度',-2,2,.05,'D','先让十字叉丝清晰，再调焦狭缝像；基准视度为0。'],
};
try{const raw=sessionStorage.getItem(key);if(raw){const r=restore(raw);s=r.s;$('session-status').textContent=r.dropped?'部分保存记录无效，已跳过；请重新调整仪器。':'已恢复完成的测量组；本组重新调节与测量。';}}catch{$('session-status').textContent='无法读取进度，请及时导出 CSV。';}
function save(){try{sessionStorage.setItem(key,JSON.stringify({version:1,records:s.records}));}catch{$('session-status').textContent='无法保存进度，请立即导出 CSV。';}}
function notify(text,warn=false){$('record-message').textContent=text;$('record-message').classList.toggle('warn',warn);}
function selectPart(id){selected=id;$('part-select').value=id;$('part-name').textContent=specs[id][0];$('part-hint').textContent=specs[id][5];$('selection-label').textContent=`已选中${specs[id][0]} · 上下拖动调节 · Shift 慢调` ;}
function invalidate(text){s.slots={};s.samples=[];$('result-output').textContent='—';$('result-hint').textContent='本组已重新开始，完整历史记录保留。';notify(text,true);}
function change(id,value,assisted=false,fine=false){
 const blocked=motionIssue(s,id,value,fine);if(blocked){notify(blocked,true);draw();return;}
 const cfg=specs[id];if(!cfg||!Number.isFinite(value)){notify('请输入有效数值。',true);return;}
 value=id==='telescope'?signed(value):clamp(value,cfg[1],cfg[2]);
 if(Math.abs(s[id]-value)<1e-9)return;
 if(id==='table'){
  if(s.mode==='reflect'&&(s.slots.left||s.slots.right)){delete s.slots.left;delete s.slots.right;notify('载物台已转动，请重新记录两面反射像。',true);}
  if(s.mode==='refract'){delete s.slots.minimum;const d=deviation(value);if(d!==null)s.samples.push({table:value,d});s.samples=s.samples.slice(-160);}
 }else if(id!=='telescope')invalidate('光学设置已改变，请重新记录本组四个位置。');
 s[id]=value;s.assisted ||= assisted;draw();
}
for(const id of Object.keys(specs).filter(k=>k!=='telescope')){
 const [label,min,max,step,unit]=specs[id],box=document.createElement('div');box.className='control';
 const lab=document.createElement('label');lab.htmlFor=id;lab.append(label+' / '+unit);
 const number=document.createElement('input');number.type='number';number.id=id+'-input';number.min=min;number.max=max;number.step=step;number.setAttribute('aria-label',label+'数值');
 const range=document.createElement('input');range.id=id;range.type='range';range.min=min;range.max=max;range.step=step;range.setAttribute('aria-label',label);
 number.onchange=()=>{demo=null;if(number.value===''||!number.checkValidity()){notify('数值超出范围或格式无效。',true);draw();return;}change(id,Number(number.value));};
 range.oninput=()=>{demo=null;change(id,Number(range.value));};lab.append(number);box.append(lab,range);$('optical-controls').append(box);
}
function drawEye(){
 const c=$('eyepiece').getContext('2d');c.clearRect(0,0,480,480);c.fillStyle='#080d0b';c.fillRect(0,0,480,480);
 c.save();c.beginPath();c.arc(240,240,230,0,Math.PI*2);c.clip();
 if(s.lamp){
  const blur=Math.abs(s.focus)*3+Math.abs(s.collimator)*3;
  for(const b of beams(s)){
   const x=240+signed(b.angle-s.telescope)*110;
   const y=240+(s.tiltX*Math.cos(b.angle*rad)+s.tiltZ*Math.sin(b.angle*rad))*200;
   const w=Math.max(2,s.slit/170/rad*110);
   c.save();c.filter=`blur(${blur}px)`;c.fillStyle='#ffdb63';c.shadowColor='#ffd763';c.shadowBlur=10;c.fillRect(x-w/2,y-110,w,220);c.restore();
  }
 }
 c.filter=`blur(${Math.abs(s.diopter)*2.5}px)`;c.strokeStyle='#c9e3d2';c.lineWidth=1.3;c.beginPath();c.moveTo(20,240);c.lineTo(460,240);c.moveTo(240,20);c.lineTo(240,460);c.stroke();c.restore();
}
function drawScale(){
 const c=$('scale').getContext('2d'),v=readouts(s.telescope)[0],base=Math.floor((v+1e-8)*2)/2,minutes=Math.round((v-base)*60);
 c.fillStyle='#edf3ef';c.fillRect(0,0,600,130);c.strokeStyle='#526c60';c.fillStyle='#284d3e';c.font='16px system-ui';
 // Magnified linear projection: main interval 0.5°, 30 vernier divisions span 14.5°.
 for(let j=0;j<=31;j++){const x=32+j*17;c.beginPath();c.moveTo(x,25);c.lineTo(x,j%2===0?58:48);c.stroke();if(j%4===0)c.fillText(dms(base+j*.5),x-15,20);}
 const offset=minutes/30*17;
 for(let j=0;j<=30;j++){const x=32+offset+j*17*29/30;c.strokeStyle=j===minutes?'#bd6a20':'#285f4e';c.lineWidth=j===minutes?2.5:1;c.beginPath();c.moveTo(x,61);c.lineTo(x,j%10===0?98:85);c.stroke();if(j%10===0)c.fillText(String(j),x-6,118);}
 $('scale-breakdown').textContent=`主尺 ${dms(base)} + 游标 ${minutes}′`;
}
function drawScan(){
 const canvas=$('scan'),c=canvas.getContext('2d'),points=s.samples;
 c.fillStyle='#edf3ef';c.fillRect(0,0,600,150);c.fillStyle='#61796b';c.font='13px system-ui';c.fillText('偏向角 δ / °',12,18);
 const active=s.mode==='refract';
 let message='';
 if(!active)message='切换到“折射 · 最小偏向角”后开始采样';
 else if(!points.length)message=deviation(s.table)===null?'当前方位无透射光，请将载物台粗调至约 −29°':'尚未采样，请转动载物台或点击“演示寻找折返”';
 if(message){c.textAlign='center';c.fillStyle='#466454';c.font='15px system-ui';c.fillText(message,300,78);c.textAlign='left';canvas.setAttribute('aria-label',message);}
 else {
  const lo=Math.min(...points.map(p=>p.table))-.3,hi=Math.max(...points.map(p=>p.table))+.3,min=Math.min(...points.map(p=>p.d))-.02,max=Math.max(...points.map(p=>p.d))+.02;
  const x=v=>64+(v-lo)/(hi-lo)*510,y=v=>110-(v-min)/(max-min)*76;
  c.font='11px system-ui';c.lineWidth=1;
  for(let i=0;i<=2;i++){const yy=110-i*38;c.strokeStyle='#d0ded5';c.beginPath();c.moveTo(64,yy);c.lineTo(574,yy);c.stroke();c.fillStyle='#61796b';c.fillText((min+(max-min)*i/2).toFixed(2),10,yy+4);const xx=64+i*255;c.textAlign='center';c.fillText((lo+(hi-lo)*i/2).toFixed(1)+'°',xx,126);}
  c.textAlign='left';c.strokeStyle='#35795a';c.lineWidth=2;c.beginPath();points.forEach((p,i)=>{if(i)c.lineTo(x(p.table),y(p.d));else c.moveTo(x(p.table),y(p.d));});c.stroke();
  const last=points[points.length-1];c.fillStyle='#b06a25';c.beginPath();c.arc(x(last.table),y(last.d),4,0,Math.PI*2);c.fill();
  c.fillStyle='#466454';c.fillText('采样 '+points.length+' 点 · 当前 '+last.d.toFixed(3)+'°',240,18);
  canvas.setAttribute('aria-label','已采样'+points.length+'点；最后偏向角'+last.d.toFixed(3)+'度');
 }
 c.fillStyle='#61796b';c.font='12px system-ui';c.fillText('载物台方位 / ° →',450,145);
 $('scan-status').textContent=!active?'此图用于折射观察；反射测顶角与直射测量时不采样。':demo?'正在演示扫描，橙点表示最新采样位置。':!points.length?(s.tableLocked?'载物台已锁紧。请松开后粗定位，再锁紧微动；也可使用折返演示。':'将载物台调至约 −29°，逐渐转至 −22°，观察偏向角先减小后增大。'):points.length===1?'已记录第一个采样点。继续转动载物台后形成轨迹。':minimumBracketed(points)?'已采到最低点两侧。回到折返附近，锁紧后微调望远镜对准。':'已绘出采样轨迹，请继续扫描最低点另一侧。';
}
function installPrismTray(){
 prismMount=nodes.PRISM_REMOVABLE.parent;
 const tray=new THREE.Group();tray.name='PRISM_STORAGE_TRAY';nodes.SPECTROMETER_CTRL.add(tray);tray.position.set(-120,0,160);
 const body=new THREE.MeshStandardMaterial({color:0x486353,roughness:.8});
 const pad=new THREE.Mesh(new THREE.BoxGeometry(70,6,62),body);pad.position.y=8;tray.add(pad);
 const liner=new THREE.Mesh(new THREE.BoxGeometry(60,3,52),new THREE.MeshStandardMaterial({color:0xb6cbbc,roughness:1}));liner.position.y=12.5;tray.add(liner);
 for(const [x,z,w,d] of [[-34,0,2,62],[34,0,2,62],[0,-30,66,2],[0,30,66,2]]){const rim=new THREE.Mesh(new THREE.BoxGeometry(w,8,d),body);rim.position.set(x,13,z);tray.add(rim);}
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#edf3ef';c.fillRect(0,0,512,96);c.fillStyle='#285f4e';c.font='bold 42px sans-serif';c.textAlign='center';c.fillText('三棱镜托盘',256,63);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const tag=new THREE.Mesh(new THREE.PlaneGeometry(65,12),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));tag.rotation.x=-Math.PI/2;tag.position.set(0,1,44);tray.add(tag);
 nodes.PRISM_REMOVABLE.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.color.set('#c3e7de');o.material.roughness=.12;if('transmission' in o.material)o.material.transmission=.75;const edges=new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry,25),new THREE.LineBasicMaterial({color:0x34796c,transparent:true,opacity:.7}));edges.name='PRISM_EDGE_GUIDE';o.add(edges);});
}
function syncModel(){
 if(!model)return;
 nodes.TELESCOPE_ROTATION.rotation.y=s.telescope*rad;
 nodes.TABLE_ROTATION_LIFT.rotation.set(s.tiltX*rad,s.table*rad,s.tiltZ*rad);
 nodes.TELESCOPE_FOCUS.position.x=s.focus;nodes.COLLIMATOR_FOCUS.position.x=s.collimator;
 nodes.SLIT_BLADE_1.position.z=-(4+s.slit/2);nodes['SLIT_BLADE_-1'].position.z=4+s.slit/2;
 const prism=nodes.PRISM_REMOVABLE;
 const desired=s.mode==='direct'?nodes.SPECTROMETER_CTRL:prismMount;
 if(prism.parent!==desired)desired.add(prism);
 prism.visible=true;
 prism.position.set(...(s.mode==='direct'?[-120,-140,160]:[0,0,0]));
 prism.rotation.set(0,0,0);
 if(nodes.EYEPIECE_DIOPTER)nodes.EYEPIECE_DIOPTER.position.x=initial.EYEPIECE_DIOPTER.x+s.diopter;
 if(path){scene.remove(path);path.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 path=new THREE.Group();scene.add(path);path.visible=showPath&&s.lamp;
 const directions=beams(s);
 for(const b of directions){const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.26,.175,0),new THREE.Vector3(0,.175,0),new THREE.Vector3(.28*Math.cos(b.angle*rad),.175,-.28*Math.sin(b.angle*rad))]);path.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0xdb9a25,depthTest:false,transparent:true,opacity:.8})));}
}
function drafts(){
 $('draft-rows').replaceChildren();for(const [k,label] of Object.entries(labels)){const tr=document.createElement('tr');for(const v of [label,...(s.slots[k]?s.slots[k].values.map(dms):['—','—']),s.slots[k]?'已记录':'待记录']){const td=document.createElement('td');td.textContent=v;tr.append(td);}$('draft-rows').append(tr);}
 for(const b of document.querySelectorAll('[data-record]')){const issue=recordIssue(s,b.dataset.record,loaded);b.disabled=!!issue||!!demo;b.title=issue||'记录当前两个游标读数';}
 try{calculate(s.slots);$('calculate-btn').disabled=JSON.stringify(s.slots)===savedDraft;}catch{$('calculate-btn').disabled=true;}
}
function history(){
 $('record-rows').replaceChildren();s.records.forEach((r,i)=>{const tr=document.createElement('tr');for(const v of[i+1,dms(r.a),dms(r.d),r.n.toFixed(5),r.assisted?'含辅助':'手动']){const td=document.createElement('td');td.textContent=v;tr.append(td);}const td=document.createElement('td'),b=document.createElement('button');b.textContent='删除';b.setAttribute('aria-label',`删除第${i+1}组`);b.onclick=()=>{s.records.splice(i,1);history();save();};td.append(b);tr.append(td);$('record-rows').append(tr);});
 if(!s.records.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=6;td.textContent='尚无完成的测量组。';tr.append(td);$('record-rows').append(tr);}
 $('export-btn').disabled=!s.records.length;
 $('mean').textContent=s.records.length?`${s.records.length} 组 · 平均 n = ${(s.records.reduce((sum,r)=>sum+r.n,0)/s.records.length).toFixed(5)}`:'尚无记录';
}
function setLock(id,locked){demo=null;s[id+'Locked']=locked;if(locked)s[id+'Anchor']=s[id];notify(locked?'已锁紧，可使用微动精确对准。':'已松开，可拖动或输入角度进行粗定位。');draw();}
for(const id of ['telescope','table'])$(id+'-lock').onclick=()=>setLock(id,!s[id+'Locked']);
for(const b of document.querySelectorAll('[data-table-fine]'))b.onclick=()=>change('table',s.table+Number(b.dataset.tableFine),false,true);
function draw(){
 $('prism-status').textContent=s.mode==='direct'?'三棱镜在器件托盘上 · 载物台空置':'三棱镜已放上载物台 · '+(s.mode==='reflect'?'反射测顶角':'折射测偏向');
 $('prism-toggle').textContent=s.mode==='direct'?'放上载物台':'移至托盘';$('prism-toggle').disabled=!loaded;
 for(const id of ['telescope','table']){const locked=s[id+'Locked'];$(id+'-lock').textContent=(locked?'松开':'锁紧')+(id==='table'?'载物台':'望远镜');$(id+'-lock').setAttribute('aria-pressed',String(locked));$(id).disabled=locked;if($(id+'-input'))$(id+'-input').disabled=locked;}
 $('angle-input').disabled=s.telescopeLocked;
 for(const b of document.querySelectorAll('[data-move]'))b.disabled=Math.abs(Number(b.dataset.move))<1?!s.telescopeLocked:s.telescopeLocked;
 for(const b of document.querySelectorAll('[data-table-fine]'))b.disabled=!s.tableLocked;
 $('lock-status').textContent='望远镜：'+(s.telescopeLocked?'已锁紧 · 微动偏移 '+signed(s.telescope-s.telescopeAnchor).toFixed(3)+'°':'已松开')+'；载物台：'+(s.tableLocked?'已锁紧 · 微动偏移 '+signed(s.table-s.tableAnchor).toFixed(3)+'°':'已松开');
 $('lamp').checked=s.lamp;$('mode').value=s.mode;
 for(const id of Object.keys(specs)){const places=id==='telescope'?5:2;$(id).value=s[id];if($(id+'-input'))$(id+'-input').value=Number(s[id].toFixed(places));}
 $('angle-input').value=Number(s.telescope.toFixed(6));$('telescope-value').textContent=s.telescope.toFixed(3)+'°';
 const [a,b]=readouts(s.telescope);$('reading-output').textContent='Ⅰ '+dms(a);$('reading-second').textContent='Ⅱ '+dms(b);
 const issue=alignmentIssue(s),bb=beams(s),nearest=bb.length?Math.min(...bb.map(b=>separation(s.telescope,b.angle))):null;
 $('optical-status').textContent=issue||(nearest===null?'当前方位无透射光束':nearest<=1.1/60?'狭缝像已对准纵丝':`请转动望远镜对准狭缝像 · 偏差 ${(nearest*60).toFixed(1)}′`);
 $('optical-status').classList.toggle('warn',!!issue||nearest===null||nearest>1.1/60);
 $('mode-hint').textContent={direct:'棱镜已移出光路；直射像约在望远镜 0°。',reflect:'将载物台保持在90°附近；两个反射像约在望远镜 ±60°。',refract:'转动载物台寻找折返，同时跟随像调节望远镜。无透射光时可能已超出出射条件。'}[s.mode];
 const step=issue?1:!(s.slots.left&&s.slots.right)?2:!(s.slots.direct&&s.slots.minimum)?3:4;
 for(let i=1;i<=4;i++){$('step'+i).classList.toggle('current',i===step);$('step'+i).classList.toggle('done',i<step);}
 $('find-minimum').disabled=s.mode!=='refract'||!loaded||!!demo;$('find-image').disabled=!loaded||!!demo;
 drafts();drawEye();drawScale();drawScan();syncModel();
}
function setMode(mode){demo=null;if(mode!=='direct')lastPrismMode=mode;s.mode=mode;draw();notify('已切换观察方式。'+$('mode-hint').textContent);}
$('prism-toggle').onclick=()=>setMode(s.mode==='direct'?lastPrismMode:'direct');
function record(target){const issue=recordIssue(s,target,loaded);if(issue){notify(issue,true);return;}s.slots[target]={values:readouts(s.telescope),table:s.table};notify(`已记录${labels[target]}双游标读数。`);draw();}
function moveSelected(delta){demo=null;change(selected,s[selected]+delta,false,!!s[selected+'Locked']);}
$('part-select').onchange=()=>selectPart($('part-select').value);
$('telescope').oninput=()=>{demo=null;change('telescope',Number($('telescope').value));};
$('angle-input').onchange=()=>{demo=null;const value=Number($('angle-input').value);if($('angle-input').value===''||!Number.isFinite(value)||value< -180||value>180){notify('方位请输入 −180° 至 180°。',true);draw();return;}change('telescope',value);};
for(const b of document.querySelectorAll('[data-move]'))b.onclick=()=>{demo=null;change('telescope',s.telescope+Number(b.dataset.move),false,Math.abs(Number(b.dataset.move))<1);};
$('lamp').onchange=()=>{demo=null;s.lamp=$('lamp').checked;draw();};$('mode').onchange=()=>setMode($('mode').value);
$('align').onclick=()=>{demo=null;invalidate('已辅助调平调焦。请继续对准狭缝像并记录，本组将标记含辅助。');Object.assign(s,{lamp:true,focus:0,collimator:0,diopter:0,tiltX:0,tiltZ:0,slit:.12,assisted:true});draw();};
$('find-image').onclick=()=>{const list=beams(s);if(!list.length){notify('当前载物台方位无可见像，请先调整载物台。',true);return;}const b=s.mode==='reflect'&&s.slots.left?list[1]:list[0];s.telescopeLocked=false;change('telescope',b.angle,true);s.telescopeLocked=true;s.telescopeAnchor=s.telescope;s.assisted=true;notify(`辅助对准${b.label}。请记录读数。`);draw();};
$('find-minimum').onclick=()=>{s.tableLocked=false;s.telescopeLocked=false;s.assisted=true;s.samples=[];delete s.slots.minimum;demo={start:performance.now()};notify('演示扫描最低偏向位置两侧，并回到折返点。');draw();};
for(const b of document.querySelectorAll('[data-record]'))b.onclick=()=>record(b.dataset.record);
$('new-group').onclick=()=>{demo=null;s.assisted=false;invalidate('本组已清空，已完成记录保留。');draw();};
$('reset-btn').onclick=()=>{demo=null;const rows=s.records;s=fresh();s.records=rows;notify('仪器已复位，已完成记录保留。');$('result-output').textContent='—';$('result-hint').textContent='重新调平调焦并记录。';draw();};
$('calculate-btn').onclick=()=>{try{const result=calculate(s.slots);const r={...result,slots:structuredClone(s.slots),assisted:s.assisted};s.records.push(r);$('result-output').textContent=result.n.toFixed(5);$('result-hint').textContent=`A = ${dms(result.a)}，δmin = ${dms(result.d)}。已保存第 ${s.records.length} 组。`;notify('本组已保存；点击“清空本组重测”开始下一组。');savedDraft=JSON.stringify(s.slots);history();draw();save();}catch(e){notify(e.message,true);}};
$('export-btn').onclick=()=>{if(!s.records.length)return;const url=URL.createObjectURL(new Blob([csv(s.records)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='分光计-双游标测量记录.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('help-btn').onclick=()=>{demo=null;draw();$('help-dialog').showModal();};$('help-close').onclick=()=>$('help-dialog').close();
$('lightpath-btn').onclick=()=>{showPath=!showPath;$('lightpath-btn').textContent=showPath?'隐藏光路':'显示光路';$('lightpath-btn').setAttribute('aria-pressed',String(showPath));syncModel();};
$('retry').onclick=()=>location.reload();document.addEventListener('visibilitychange',()=>{if(document.hidden){demo=null;draw();}});window.addEventListener('blur',()=>{demo=null;});
$('scene').onkeydown=e=>{if(!loaded||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();moveSelected((['ArrowRight','ArrowUp'].includes(e.key)?1:-1)*specs[selected][3]*(e.shiftKey?10:1));};
function view(name){
 if(!camera)return;const presets={hero:[[.50,.40,.60],[0,.11,0]],top:[[0,.85,.001],[0,.08,0]],slit:[[-.43,.24,.20],[-.23,.175,0]]};
 let p=presets[name];if(name==='prism'){p=s.mode==='direct'?[[.02,.19,.38],[-.12,.028,.16]]:[[.18,.29,.25],[0,.17,0]];}if(name==='vernier'){const a=(s.telescope+90)*rad;p=[[.17*Math.cos(a),.30,-.17*Math.sin(a)],[.084*Math.cos(a),.10,-.084*Math.sin(a)]];}
 camera.position.set(...p[0]);orbit.target.set(...p[1]);if(name==='hero')camera.position.sub(orbit.target).multiplyScalar(Math.max(1,1.35/camera.aspect)).add(orbit.target);if(name==='hero')frameExperimentTable(scene,camera,orbit);orbit.update();for(const b of document.querySelectorAll('[data-view]')){b.classList.toggle('active',b.dataset.view===name);b.setAttribute('aria-pressed',String(b.dataset.view===name));}
}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>view(b.dataset.view);
function partOf(obj){for(let o=obj;o&&o!==model;o=o.parent){const n=o.name;if(n==='PRISM_60_DEG'&&s.mode==='direct')return null;if(/SLIT/.test(n))return 'slit';if(/LEVEL.*_0/.test(n))return 'tiltX';if(/LEVEL.*_[12]/.test(n))return 'tiltZ';if(/DIOPTER/.test(n))return 'diopter';if(/TELESCOPE_FOCUS/.test(n))return 'focus';if(/COLLIMATOR_FOCUS/.test(n))return 'collimator';if(/TABLE|PRISM/.test(n))return 'table';if(/TELESCOPE/.test(n))return 'telescope';if(/COLLIMATOR/.test(n))return 'collimator';}return null;}
function mechanismOf(obj){for(let o=obj;o&&o!==model;o=o.parent){if(o.name.startsWith('TELESCOPE_LOCK'))return 'lock';if(o.name.startsWith('TELESCOPE_FINE'))return 'fine';}return null;}
function directControls(){
 const canvas=renderer.domElement,ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let drag=null;
 function hit(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObject(model,true).filter(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;})[0];}
 canvas.addEventListener('pointerdown',e=>{if(!loaded||e.button!==0)return;const h=hit(e),mechanism=h&&mechanismOf(h.object),id=mechanism?'telescope':h&&partOf(h.object);$('scene').focus({preventScroll:true});if(!id)return;selectPart(id);demo=null;if(mechanism==='lock'){setLock(id,!s[id+'Locked']);e.stopImmediatePropagation();return;}drag={id,y:e.clientY,value:s[id],fine:mechanism==='fine'};orbit.enabled=false;canvas.setPointerCapture(e.pointerId);e.stopImmediatePropagation();},{capture:true});
 canvas.addEventListener('pointermove',e=>{if(!loaded)return;if(drag){const speed={telescope:.12,table:.10,focus:.03,collimator:.03,slit:.005,tiltX:.003,tiltZ:.003,diopter:.01}[drag.id];queueLabChange(change,drag.id,drag.value+(drag.y-e.clientY)*(drag.fine?.003:speed)*(e.shiftKey?.1:1),false,drag.fine);return;}const h=hit(e),id=h&&partOf(h.object),label=$('hover-label');label.hidden=!id;if(id){const mechanism=h&&mechanismOf(h.object);label.textContent=mechanism==='lock'?'望远镜锁紧螺钉 · 点击切换':mechanism==='fine'?'望远镜微动螺钉 · 锁紧后拖动':specs[id][0];label.style.left=Math.min(e.offsetX+12,canvas.clientWidth-180)+'px';label.style.top=Math.max(5,e.offsetY-30)+'px';}canvas.style.cursor=id?'ns-resize':'grab';});
 const end=()=>{drag=null;orbit.enabled=true;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);canvas.addEventListener('pointerleave',()=>{$('hover-label').hidden=true;});
}
history();draw();notify('开启钠灯并调平调焦，或查看“实验说明”开始操作。');
try{
 scene=new THREE.Scene();scene.background=new THREE.Color('#353B44');scene.fog=new THREE.Fog('#e2e9e3',.8,1.8);camera=new THREE.PerspectiveCamera(38,1,.005,10);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;$('scene').append(renderer.domElement);
 orbit=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:orbit});orbit.enableDamping=true;orbit.minDistance=.08;orbit.maxDistance=1.5;view('hero');
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();scene.add(new THREE.HemisphereLight(0xffffff,0x658372,2));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(.5,1,.7);scene.add(sun);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshStandardMaterial({color:'#dbe3dc',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.001;scene.add(floor);
 const resize=()=>{const host=$('scene');renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();};new LabResizeObserver(resize).observe($('scene'));resize();
 function fail(text){loaded=false;$('loading-text').textContent=text;$('retry').hidden=false;parent.postMessage({type:'spectrometer-failed'},location.origin);}
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('model-loading').hidden=false;fail('三维视图暂时失去连接，请重新加载。');});
 new GLTFLoader().load('./assets/spectrometer-product.glb',g=>{if(isLabDisposed()){disposeLabTree(g.scene);return;}
  model=g.scene;model.traverse(o=>{nodes[o.name]=o;initial[o.name]=o.position.clone();});
  const required=['TELESCOPE_ROTATION','TABLE_ROTATION_LIFT','TELESCOPE_FOCUS','COLLIMATOR_FOCUS','SLIT_BLADE_1','SLIT_BLADE_-1','PRISM_REMOVABLE'];if(required.some(n=>!nodes[n])){fail('模型部件不完整，请重新加载。');return;}
  scene.add(model);installPrismTray();addExperimentTable(scene,model,{floor});presentation=installProductPresentation({scene,camera,renderer,model:model,controls:orbit,upAxis:'y',name:'spectrometer',floor:floor});view('hero');loaded=true;$('model-loading').hidden=true;directControls();draw();parent.postMessage({type:'spectrometer-ready'},location.origin);
 },p=>{if(p.total)$('loading-text').textContent=`正在加载分光计 ${Math.round(p.loaded/p.total*100)}%`;},()=>fail('模型加载失败，请检查连接并重新加载。'));
 let lastDemo=0;function animate(t){scheduleLabFrame(animate,()=>!!demo);if(document.hidden)return;if(demo&&t-lastDemo>70){lastDemo=t;const progress=(t-demo.start)/5000;if(progress>=1){demo=null;change('table',minimumTable,true);change('telescope',-deviation(minimumTable),true);s.tableLocked=true;s.telescopeLocked=true;s.tableAnchor=s.table;s.telescopeAnchor=s.telescope;notify('已演示折返并回到最低点，自动锁紧两轴；请记录最小偏向。');draw();}else{const phase=progress<.75?progress/.75:1-(progress-.75)/.25*.5;const table=minimumTable-3+6*phase;change('table',table,true);change('telescope',-deviation(table),true);}}orbit.update();(presentation?presentation.render():renderer.render(scene,camera));}scheduleLabFrame(animate,()=>!!demo);
}catch(e){$('loading-text').textContent='无法启动三维视图，请使用支持 WebGL 的浏览器。';$('retry').hidden=false;parent.postMessage({type:'spectrometer-failed'},location.origin);console.error(e);}

installPlatformBridge({lab:'spectrometer',ready:()=>loaded,read:()=>({state:s}),
 stop:()=>{demo=null;},restore:data=>{s=data.state;savedDraft=null;lastPrismMode=s.mode==='direct'?'reflect':s.mode;$('result-output').textContent='—';$('result-hint').textContent='已恢复完整测量组，本组请重新测量。';history();draw();save();notify('已恢复仪器和完整记录；未完成组和折返扫描需重测。');},
 render:()=>{draw();(presentation?presentation.renderSnapshot():renderer.render(scene,camera));},eye:'#eyepiece'});
