import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {queueLabChange,manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup} from '../shared/lab-runtime.js';
import {installProductPresentation} from '../shared/product-presentation.js';
let presentation;
import {addExperimentTable,frameExperimentTable} from '../shared/experiment-table.js';
import {installPlatformBridge} from '../shared/platform-bridge.js';
import * as THREE from 'three';
import {installLearning} from './learning.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {fresh,restore,LINES,beams,target,setupIssue,recordIssue,snapshot,calculate,csv,readouts,dms,signed,motionIssue} from './physics.mjs';
const $=id=>document.getElementById(id),rad=Math.PI/180,key='wanxiang-grating-v1';
let s=fresh(),loaded=false,saved='',selected='telescope',showPath=false,scene,camera,renderer,orbit,model,grating,path;
const nodes={},initial={},labels={zero:'零级',left:'左侧谱线',right:'右侧谱线'};
const specs={telescope:['望远镜转角',-100,100,1/60,'°'],table:['光栅法线偏角',-20,20,1/60,'°'],focus:['望远镜调焦',-3,3,.01,'mm'],collimator:['平行光管调焦',-3,3,.01,'mm'],diopter:['目镜视度',-2,2,.01,''],slit:['狭缝宽度',.05,1,.01,'mm'],tiltX:['调平 X',-.5,.5,.01,'°'],tiltZ:['调平 Z',-.5,.5,.01,'°']};
try{const raw=sessionStorage.getItem(key);if(raw)s=restore(raw).s;}catch{$('session-status').textContent='浏览器不支持暂存，请及时导出CSV。';}
function notify(t){$('message').textContent=t;}
function save(){try{sessionStorage.setItem(key,JSON.stringify({version:1,records:s.records}));}catch{$('session-status').textContent='暂存失败，请导出CSV保存记录。';}}
function clear(t){s.slots={};saved='';$('result').textContent='— nm';notify(t);}
function change(id,value,fine=false){const sp=specs[id];if(!Number.isFinite(value)||value<sp[1]||value>sp[2]){notify('输入超出部件调节范围。');draw();return;}const issue=motionIssue(s,id,value,fine);if(issue){notify(issue);draw();return;}if(s[id]!==value&&id!=='telescope')clear('光学设置已改变，请重新记录本组。');s[id]=value;draw();}
for(const [id,[label,min,max,step,unit]]of Object.entries(specs)){$('optical-controls').insertAdjacentHTML('beforeend',`<div class="control"><label for="${id}">${label} / ${unit}<input id="${id}-input" type="number" min="${min}" max="${max}" step="${step}" aria-label="${label}数值"></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}"></div>`);$(id).oninput=()=>change(id,Number($(id).value));$(id+'-input').onchange=()=>change(id,$(id+'-input').value===''?NaN:Number($(id+'-input').value));}
function lines(){ $('line').replaceChildren();for(const [id,l]of Object.entries(LINES))if(l.source===s.source)$('line').add(new Option(l.name,id));$('line').value=s.line;}
function history(){ $('rows').replaceChildren();s.records.forEach((r,i)=>{const tr=document.createElement('tr');for(const v of[i+1,LINES[r.line].name,r.order,dms(r.thetaL),dms(r.thetaR),r.wave.toFixed(2),r.assisted?'含辅助':'手动']){const td=document.createElement('td');td.textContent=v;tr.append(td);}const td=document.createElement('td'),b=document.createElement('button');b.textContent='删除';b.setAttribute('aria-label',`删除第${i+1}组`);b.onclick=()=>{s.records.splice(i,1);history();save();};td.append(b);tr.append(td);$('rows').append(tr);});$('export').disabled=!s.records.length;$('mean').textContent=Object.keys(LINES).map(id=>{const list=s.records.filter(r=>r.line===id);return list.length?`${LINES[id].name}：${list.length}组，平均 ${(list.reduce((a,r)=>a+r.wave,0)/list.length).toFixed(2)} nm`:'';}).filter(Boolean).join('；')||'尚无完整测量组。';}
function drawEye(){const c=$('eyepiece').getContext('2d');c.fillStyle='#101b18';c.fillRect(0,0,480,480);if(s.lamp){c.save();c.filter=`blur(${Math.abs(s.focus)*7+Math.abs(s.collimator)*7}px)`;for(const b of beams(s)){const x=240+signed(b.angle-s.telescope)*120;if(x< -50||x>530)continue;c.fillStyle=b.color;c.globalAlpha=b.order===0?.95:.75;const w=Math.max(2,s.slit*65);c.fillRect(x-w/2,110+(s.tiltX+s.tiltZ)*300,w,260);}c.restore();}c.save();c.filter=`blur(${Math.abs(s.diopter)*4}px)`;c.strokeStyle='#a4b7ac';c.lineWidth=1;c.beginPath();c.moveTo(0,240);c.lineTo(480,240);c.moveTo(240,0);c.lineTo(240,480);c.stroke();c.restore();const sc=$('spectrum').getContext('2d');sc.fillStyle='#edf3ef';sc.fillRect(0,0,600,150);sc.font='16px sans-serif';sc.fillStyle='#536d60';sc.fillText(s.lamp?'各级谱线方向 / °':'请开启光源',12,24);sc.strokeStyle='#99aca0';sc.beginPath();sc.moveTo(25,110);sc.lineTo(575,110);sc.stroke();for(const a of[-90,-45,0,45,90])sc.fillText(String(a),300+a*3-10,139);if(s.lamp)for(const b of beams(s)){const x=300+b.angle*3;sc.strokeStyle=b.color;sc.lineWidth=4;sc.beginPath();sc.moveTo(x,45);sc.lineTo(x,105);sc.stroke();sc.fillStyle='#345343';sc.fillText(String(b.order),x-5,41);}sc.fillStyle='#b06d28';sc.beginPath();sc.moveTo(300+s.telescope*3,108);sc.lineTo(294+s.telescope*3,118);sc.lineTo(306+s.telescope*3,118);sc.fill();}
const renderLearning=installLearning({getState:()=>s,ready:()=>loaded,change,select});
function draw(){for(const id of Object.keys(specs)){$(id).value=s[id];$(id+'-input').value=Number(s[id].toFixed(5));if(id==='table'||id==='telescope'){$(id).disabled=s[id+'Locked'];$(id+'-input').disabled=s[id+'Locked'];$(id+'-lock').textContent=(s[id+'Locked']?'松开':'锁紧')+(id==='table'?'载物台':'望远镜');$(id+'-lock').setAttribute('aria-pressed',String(s[id+'Locked']));}}for(const b of document.querySelectorAll('[data-fine]'))b.disabled=!s[b.dataset.fine+'Locked'];$('lamp').checked=s.lamp;$('source').value=s.source;$('order').value=s.order;$('mount').disabled=!loaded;$('mount').textContent=s.mounted?'移回托盘':'装上光栅';$('mount-state').textContent=s.mounted?'光栅已装入载物台':'光栅在器件托盘上';$('lock-status').textContent='两轴锁紧后使用微动，范围为锁紧位置±2°。';const [a,b]=readouts(s.telescope);$('reading-output').textContent='Ⅰ '+dms(a);$('reading-second').textContent='Ⅱ '+dms(b);$('scale-breakdown').textContent=`主尺 ${Math.floor(a*2)/2}° + 游标 ${Math.round((a-Math.floor(a*2)/2)*60)}′`;
 const issue=recordIssue(s,$('target').value,loaded);$('validation').textContent=issue||'已对准，可记录双游标。';$('record').disabled=!!issue;$('optical-status').textContent=setupIssue(s)||'叉丝与狭缝像清晰，转动望远镜观察谱线。';$('grating-state').textContent=s.mounted?`光栅法线偏角 ${s.table.toFixed(3)}° · 橙色标记为望远镜方向`:'载物台空置，只有直射像。';$('draft').innerHTML=Object.entries(labels).map(([k,l])=>`<tr><td>${l}</td><td>${s.slots[k]?dms(s.slots[k].values[0]):'—'}</td><td>${s.slots[k]?dms(s.slots[k].values[1]):'—'}</td><td>${s.slots[k]?'已记录':'待记录'}</td></tr>`).join('');try{calculate(s.slots);$('calculate').disabled=saved===JSON.stringify(s.slots);}catch{$('calculate').disabled=true;}const step=setupIssue(s)?1:!s.mounted||Math.abs(s.table)>.05?2:!s.slots.right||!s.slots.left?3:4;for(let i=1;i<=4;i++)$('step'+i).classList.toggle('current',i===step);drawEye();syncModel();renderLearning();}
function lock(id){s[id+'Locked']=!s[id+'Locked'];if(s[id+'Locked'])s[id+'Anchor']=s[id];draw();}
for(const id of['table','telescope'])$(id+'-lock').onclick=()=>lock(id);
for(const b of document.querySelectorAll('[data-fine]'))b.onclick=()=>change(b.dataset.fine,s[b.dataset.fine]+Number(b.dataset.sign)/60,true);
$('lamp').onchange=()=>{s.lamp=$('lamp').checked;draw();};$('target').onchange=draw;
$('source').onchange=()=>{s.source=$('source').value;s.line=s.source==='sodium'?'sodium':'green';clear('光源已更换，请重新记录。');lines();draw();};
for(const id of['line','order'])$(id).onchange=()=>{s[id]=id==='order'?Number($(id).value):$(id).value;clear('谱线或级次已更换，请重新记录。');draw();};
$('mount').onclick=()=>{s.mounted=!s.mounted;clear('光栅位置已改变，请重新记录。');draw();};
$('normal').onclick=()=>{clear('已辅助将光栅法线对准入射方向并锁紧载物台。');Object.assign(s,{table:0,tableLocked:true,tableAnchor:0,assisted:true});draw();};
$('align').onclick=()=>{clear('已辅助调平调焦，本组标记含辅助。');Object.assign(s,{lamp:true,focus:0,collimator:0,diopter:0,tiltX:0,tiltZ:0,slit:.12,assisted:true});draw();};
$('find').onclick=()=>{if(!loaded)return;const b=target(s,$('target').value);if(!b){notify('请先装上光栅，并选择有效谱线。');return;}Object.assign(s,{telescope:b.angle,telescopeAnchor:b.angle,telescopeLocked:true,assisted:true});notify('已辅助对准所选谱线，请自行记录。');draw();};
$('record').onclick=()=>{const side=$('target').value,issue=recordIssue(s,side,loaded);if(issue){notify(issue);return;}s.slots[side]=snapshot(s);saved='';$('result').textContent='— nm';$('result-hint').textContent='读数已更新，请重新计算。';notify(`已记录${labels[side]}双游标。`);draw();};
$('calculate').onclick=()=>{try{if(saved===JSON.stringify(s.slots))return;const r={...calculate(s.slots),slots:structuredClone(s.slots),assisted:s.assisted};if(s.records.length>=200){notify('已达200组，请导出并删除旧记录后保存。');return;}s.records.push(r);saved=JSON.stringify(s.slots);$('result').textContent=r.wave.toFixed(2)+' nm';$('result-hint').textContent=`平均衍射角 ${dms(r.theta)}，本组已保存。`;history();save();draw();}catch(e){notify(e.message);}};
$('new-group').onclick=()=>{s.assisted=false;clear('已清空本组，完整记录保留。');$('target').value='zero';draw();};$('reset').onclick=()=>{const records=s.records;s=fresh();s.records=records;$('target').value='zero';clear('仪器已复位，完整记录保留。');lines();draw();};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([csv(s.records)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='光栅-双游标波长测量.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};$('help').onclick=()=>$('help-dialog').showModal();$('help-close').onclick=()=>$('help-dialog').close();$('retry').onclick=()=>location.reload();
$('part').onchange=()=>select($('part').value);function select(id){selected=id;$('part').value=id;$('selected').textContent=specs[id][0]+' · 上下拖动调节';$('part-hint').textContent=(id==='table'?'转动光栅改变入射角，测量需接近0°并锁紧。':id==='telescope'?'松开粗调寻找谱线，锁紧后微动对准纵丝。':'调节'+specs[id][0]+'，观察目镜反馈。')+' 修改光学设置后本组读数需重测。';}
$('scene').onkeydown=e=>{if(!loaded||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();change(selected,s[selected]+(e.key==='ArrowRight'?1:-1)*specs[selected][3]*(e.shiftKey?10:1),!!s[selected+'Locked']);};
$('path').onclick=()=>{showPath=!showPath;$('path').textContent=showPath?'隐藏光路':'显示光路';$('path').setAttribute('aria-pressed',String(showPath));syncModel();};
function syncModel(){if(!loaded)return;nodes.TELESCOPE_ROTATION.rotation.y=s.telescope*rad;nodes.TABLE_ROTATION_LIFT.rotation.set(s.tiltX*rad,s.table*rad,s.tiltZ*rad);for(const [n,id]of[['TELESCOPE_FOCUS','focus'],['COLLIMATOR_FOCUS','collimator']])nodes[n].position.x=initial[n].x+s[id];if(nodes.EYEPIECE_DIOPTER)nodes.EYEPIECE_DIOPTER.position.x=initial.EYEPIECE_DIOPTER.x+s.diopter;nodes.SLIT_BLADE_1.position.z=-(4+s.slit/2);nodes['SLIT_BLADE_-1'].position.z=4+s.slit/2;const holder=s.mounted?nodes.TABLE_ROTATION_LIFT:nodes.SPECTROMETER_CTRL;if(grating.parent!==holder)holder.add(grating);grating.position.set(...(s.mounted?[0,153.5,0]:[-120,14,160]));if(path){scene.remove(path);path.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});path=null;}if(showPath&&s.lamp){path=new THREE.Group();const add=(points,color)=>path.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color})));add([[-.30,.175,0],[0,.175,0]],'#e9b93f');for(const b of beams(s))add([[0,.175,0],[.30*Math.cos(b.angle*rad),.175,-.30*Math.sin(b.angle*rad)]],b.color);scene.add(path);}}
function view(name){if(!camera)return;const p=name==='top'?[[0,.85,.001],[0,.10,0]]:name==='grating'?(s.mounted?[[.14,.25,.16],[0,.175,0]]:[[-.02,.13,.28],[-.12,.03,.16]]):[[.50,.40,.60],[0,.11,0]];camera.position.set(...p[0]);orbit.target.set(...p[1]);if(name==='hero')camera.position.sub(orbit.target).multiplyScalar(Math.max(1,1.35/camera.aspect)).add(orbit.target);if(name==='hero')frameExperimentTable(scene,camera,orbit);orbit.update();for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===name);}
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>view(b.dataset.view);
function direct(){
 const canvas=renderer.domElement,ray=new THREE.Raycaster();let drag=null;
 function hit(e){
  const r=canvas.getBoundingClientRect();camera.updateMatrixWorld();model.updateMatrixWorld(true);
  ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
  const h=ray.intersectObject(model,true).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});
  for(let o=h?.object;o&&o!==model;o=o.parent){
   const n=o.name;
   if(/TELESCOPE_LOCK/.test(n))return {id:'telescope',mechanism:'lock'};
   if(/CIRCLE_LOCK/.test(n))return {id:'table',mechanism:'lock'};
   if(/TELESCOPE_FINE/.test(n))return {id:'telescope',mechanism:'fine'};
   if(/CIRCLE_FINE/.test(n))return {id:'table',mechanism:'fine'};
   if(/LEVEL.*_0/.test(n))return {id:'tiltX'};
   if(/LEVEL.*_[12]/.test(n))return {id:'tiltZ'};
   if(/DIOPTER/.test(n))return {id:'diopter'};
   if(/GRATING|GROOVE/.test(n))return s.mounted?{id:'table'}:null;
   if(/SLIT/.test(n))return {id:'slit'};
   if(/TELESCOPE_FOCUS/.test(n))return {id:'focus'};
   if(/COLLIMATOR/.test(n))return {id:'collimator'};
   if(/TABLE/.test(n))return {id:'table'};
   if(/TELESCOPE/.test(n))return {id:'telescope'};
  }
  return null;
 }
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==0||!loaded)return;const part=hit(e);if(!part)return;
  const {id,mechanism}=part;select(id);$('scene').focus({preventScroll:true});e.stopImmediatePropagation();
  if(mechanism==='lock'){lock(id);return;}
  if(mechanism==='fine'&&!s[id+'Locked']){notify('请先锁紧，再使用微动螺钉。');return;}
  drag={id,y:e.clientY,value:s[id],pointer:e.pointerId,fine:mechanism==='fine'||!!s[id+'Locked']};orbit.enabled=false;canvas.setPointerCapture(e.pointerId);
 },true);
 canvas.addEventListener('pointermove',e=>{
  if(drag){
   if(e.pointerId!==drag.pointer)return;
   const speed=drag.id==='table'||drag.id==='telescope'?(drag.fine?.003:.12):drag.id.startsWith('tilt')?.003:drag.id==='slit'?.005:.01;
   const range=specs[drag.id],value=Math.max(range[1],Math.min(range[2],drag.value+(drag.y-e.clientY)*speed*(e.shiftKey?.1:1)));
   queueLabChange(change,drag.id,value,drag.fine);
  }else{
   const part=hit(e);$('hover-label').hidden=!part;
   if(part){$('hover-label').textContent=part.mechanism==='lock'?'锁紧螺钉 · 点击切换':part.mechanism==='fine'?'微动螺钉 · 锁紧后拖动':specs[part.id][0];$('hover-label').style.left='12px';$('hover-label').style.top='12px';}
  }
 });
 const end=()=>{const d=drag;drag=null;orbit.enabled=true;if(d&&canvas.hasPointerCapture(d.pointer))canvas.releasePointerCapture(d.pointer);};
 for(const event of['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,end);
 canvas.addEventListener('pointerleave',()=>{$('hover-label').hidden=true;});addLabCleanup(end);window.addEventListener('wx-lab-suspend',end);addLabCleanup(()=>window.removeEventListener('wx-lab-suspend',end));
}
lines();history();draw();
function fail(message){loaded=false;$('model-loading').hidden=false;$('loading-text').textContent=message;$('retry').hidden=false;draw();parent.postMessage({type:'grating-failed'},location.origin);}
try{scene=new THREE.Scene();scene.background=new THREE.Color('#353B44');camera=new THREE.PerspectiveCamera(38,1,.005,10);renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.toneMapping=THREE.ACESFilmicToneMapping;$('scene').append(renderer.domElement);orbit=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:orbit});orbit.enableDamping=true;orbit.minDistance=.08;orbit.maxDistance=1.5;const pm=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pm.fromScene(room,.04).texture;room.dispose();pm.dispose();scene.add(new THREE.HemisphereLight(0xffffff,0x658372,2));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(.5,1,.7);scene.add(light);const floor=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshStandardMaterial({color:'#dbe3dc'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.001;scene.add(floor);const resize=()=>{renderer.setSize($('scene').clientWidth,$('scene').clientHeight);camera.aspect=$('scene').clientWidth/$('scene').clientHeight;camera.updateProjectionMatrix();};new LabResizeObserver(resize).observe($('scene'));resize();renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('三维视图连接中断，请重新加载。');});const loader=new GLTFLoader();const [instrument,optic]=await Promise.all([loader.loadAsync('../spectrometer/assets/spectrometer-product.glb'),loader.loadAsync('./assets/grating-product.glb')]);if(isLabDisposed()){disposeLabTree(instrument.scene);disposeLabTree(optic.scene);}else{model=instrument.scene;model.traverse(o=>{nodes[o.name]=o;initial[o.name]=o.position.clone();});for(const n of['SPECTROMETER_CTRL','TELESCOPE_ROTATION','TABLE_ROTATION_LIFT','TELESCOPE_FOCUS','COLLIMATOR_FOCUS','SLIT_BLADE_1','SLIT_BLADE_-1','PRISM_REMOVABLE'])if(!nodes[n])throw Error('模型缺少部件 '+n);nodes.PRISM_REMOVABLE.visible=false;scene.add(model);addExperimentTable(scene,model,{floor});view('hero');grating=optic.scene;grating.scale.setScalar(1000);const tray=new THREE.Mesh(new THREE.BoxGeometry(70,6,62),new THREE.MeshStandardMaterial({color:'#607568',roughness:.8}));tray.position.set(-120,8,160);nodes.SPECTROMETER_CTRL.add(tray);loaded=true;$('model-loading').hidden=true;presentation=installProductPresentation({scene,camera,renderer,model:model,controls:orbit,upAxis:'y',name:'grating',floor:floor});direct();draw();parent.postMessage({type:'grating-ready'},location.origin);setLabAnimationLoop(renderer,()=>{orbit.update();(presentation?presentation.render():renderer.render(scene,camera));});}}catch(e){console.error(e);fail('模型加载失败，请检查连接或WebGL支持后重试。');}

installPlatformBridge({lab:'grating',ready:()=>loaded,read:()=>({state:s}),
 restore:data=>{s=data.state;saved='';$('target').value='zero';$('result').textContent='— nm';$('result-hint').textContent='已恢复完整测量组，本组请重新测量。';lines();history();draw();save();notify('已恢复仪器和完整记录；本组请从零级重新记录。');},
 render:()=>{draw();(presentation?presentation.renderSnapshot():renderer.render(scene,camera));},eye:'#eyepiece'});
