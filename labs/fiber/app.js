import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {queueLabChange,manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup} from '../shared/lab-runtime.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';
import {finishPrecisionHardware} from '../shared/precision-materials.js';
import {installProductPresentation} from '../shared/product-presentation.js';

import {installPlatformBridge} from '../shared/platform-bridge.js';
import {fresh,normalize,changeSettings,power,record,report,AXES,beamAt,sameScan} from './physics.mjs';
import {applyConditions} from './conditions.mjs';
import {updateAngularSpindles} from './mechanics.mjs';
const $=id=>document.getElementById(id),SESSION='wx-fiber-session-v1';
for(const [key,a] of Object.entries(AXES)){
 const o=document.createElement('option');o.value=key;o.textContent=a.label;$('axis-select').append(o);
 if(['xUm','yUm'].includes(key))continue;
 const row=document.createElement('div');row.className='position';
 const label=document.createElement('label');label.htmlFor=a.id;label.textContent=a.label;
 const input=document.createElement('input');Object.assign(input,{id:a.id,type:'number',min:a.min,max:a.max,step:a.step,value:0});
 const unit=document.createElement('span');unit.textContent=a.unit;row.append(label,input,unit);
 const nudge=document.createElement('div');nudge.className='nudge';
 for(const sign of [-1,1]){const b=document.createElement('button');b.dataset.axis=key;b.dataset.step=sign*a.nudge;b.textContent=(sign<0?'−':'+')+a.nudge+' '+a.unit;nudge.append(b);}
 $('extra-axes').append(row,nudge);
}
const displayPower=v=>v>0&&v<1e-5?v.toExponential(3):v.toFixed(6);
let state=fresh(),loaded=false,disposed=false,model,presentation,fiberLead,fiberLeadKey='',drag=null,selected='xUm',drawTimer=0,lastView='overall';
try{const raw=sessionStorage.getItem(SESSION);if(raw){const v=JSON.parse(raw);if(v.version!==1)throw Error();state=normalize(v.state);}}catch{$('message').textContent='临时状态无法恢复，请打开保存的实验档案。';}
const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;$('scene').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(35,1,.002,10),controls=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:controls,release:false});controls.minDistance=.08;controls.maxDistance=5;controls.maxPolarAngle=Math.PI*.49;
const beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.231,.115,0),new THREE.Vector3(.38,.115,0)]),new THREE.LineBasicMaterial({color:0xf34b36,transparent:true,opacity:.75}));scene.add(beam);
const display=document.createElement('canvas');display.width=512;display.height=320;const displayTexture=new THREE.CanvasTexture(display);displayTexture.colorSpace=THREE.SRGBColorSpace;
const meter=new THREE.Mesh(new THREE.PlaneGeometry(.096,.070),new THREE.MeshBasicMaterial({map:displayTexture}));meter.position.set(.62,.124,.0237);scene.add(meter);
function render(){if(!loaded||document.hidden)return;clearTimeout(drawTimer);presentation?.render();drawTimer=setTimeout(()=>presentation?.render(),40);}
function view(which){lastView=which;
 if(which==='table'){controls.target.set(.375,-.30,0);const fov=Math.atan(Math.tan(THREE.MathUtils.degToRad(17.5))*Math.min(camera.aspect,1));camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(.8,.8,1.4).normalize(),.74/Math.sin(fov)*1.08);}
 else if(which==='overall'){controls.target.set(.35,.075,0);const fov=Math.atan(Math.tan(THREE.MathUtils.degToRad(17.5))*Math.min(camera.aspect,1));camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(.4,.75,1.6).normalize(),.53/Math.sin(fov)*1.02);}
 else if(which==='coupler'){controls.target.set(.442,.090,0);camera.position.set(.61,.25,.28);}
 else if(which==='tip'){controls.target.set(.416,.116,0);camera.position.set(.335,.17,.14);}
 else{controls.target.set(.725,.095,-.025);camera.position.set(.83,.24,.29);}
 controls.update();render();}
for(const [id,v] of [['overall','overall'],['coupler-view','coupler'],['detector-view','detector'],['tip-view','tip']])$(id).onclick=()=>view(v);
function resize(){const r=$('scene').getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render();}
$('table-view').onclick=()=>view('table');
const observer=new LabResizeObserver(resize);observer.observe($('scene'));controls.addEventListener('change',render);view('overall');
function observation(){
 const c=$('eye').getContext('2d'),w=600;c.fillStyle='#132326';c.fillRect(0,0,w,w);
 const px=x=>300+x*22,py=y=>300-y*22,b=beamAt(state.axialUm);
 c.strokeStyle='#294144';c.fillStyle='#9bb4b5';c.font='19px sans-serif';c.lineWidth=1;
 for(let t=-10;t<=10;t+=5){c.beginPath();c.moveTo(px(t),36);c.lineTo(px(t),564);c.moveTo(36,py(t));c.lineTo(564,py(t));c.stroke();c.fillText(String(t),px(t)-10,586);c.fillText(String(t),6,py(t)+5);}
 if(state.sourceOn){const g=c.createRadialGradient(300,300,0,300,300,b.radiusUm*22*2.6);for(const t of [0,.15,.3,.5,.7,1])g.addColorStop(t,`rgba(247,85,51,${(2.15/b.radiusUm)**2*Math.exp(-2*(t*2.6)**2)})`);c.fillStyle=g;c.fillRect(36,36,528,528);}
 const x=px(state.xUm),y=py(state.yUm);c.strokeStyle='#9ce3d9';c.lineWidth=2;c.beginPath();c.moveTo(x-8,y);c.lineTo(x+8,y);c.moveTo(x,y-8);c.lineTo(x,y+8);c.stroke();
 if(state.hints){c.setLineDash([8,6]);c.beginPath();c.arc(x,y,2.15*22,0,Math.PI*2);c.stroke();c.setLineDash([]);}
 c.fillStyle='#d1e8e3';c.fillText(`X ${state.xUm.toFixed(2)} / Y ${state.yUm.toFixed(2)} μm`,38,28);
 $('beam-note').textContent='端面处入射半径 '+b.radiusUm.toFixed(3)+' μm；Z='+state.axialUm.toFixed(1)+' μm；俯仰/偏转='+state.pitchMrad.toFixed(1)+' / '+state.yawMrad.toFixed(1)+' mrad。倾角改变相位重叠，不等同于强度光斑平移。';
 c.strokeStyle='#f8d291';c.beginPath();c.moveTo(490,85);c.lineTo(490+state.yawMrad,85-state.pitchMrad);c.stroke();c.fillStyle='#f8d291';c.fillText('倾角',465,58);
 const p=$('profile').getContext('2d'),pw=800,ph=330;p.fillStyle='#f4f7f5';p.fillRect(0,0,pw,ph);const xx=x=>60+(x+10)*34,yy=y=>280-y*235;
 p.font='20px sans-serif';p.fillStyle='#617c70';p.strokeStyle='#d7e2da';
 for(const x of [-10,-5,0,5,10]){p.beginPath();p.moveTo(xx(x),30);p.lineTo(xx(x),280);p.stroke();p.fillText(String(x),xx(x)-12,308);}
 for(const y of [0,.5,1]){p.beginPath();p.moveTo(60,yy(y));p.lineTo(740,yy(y));p.stroke();p.fillText(String(y),12,yy(y)+6);}p.fillText('X / μm',675,329);p.fillText('P / P入射',62,22);
 if(state.hints){p.strokeStyle='#9caaa2';p.setLineDash([6,5]);p.beginPath();for(let i=0;i<=200;i++){const x=-10+i/10,y=power({...state,xUm:x,sourceOn:true});if(i===0)p.moveTo(xx(x),yy(y));else p.lineTo(xx(x),yy(y));}p.stroke();p.setLineDash([]);}
 const rows=state.records.filter(r=>r.task==='scan'&&sameScan(r,state));p.fillStyle='#b15342';for(const r of rows){p.beginPath();p.arc(xx(r.xUm),yy(r.power),5,0,Math.PI*2);p.fill();}
 $('plot-note').textContent=`Y=${state.yUm.toFixed(2)} μm / Z=${state.axialUm.toFixed(1)} μm / 俯仰${state.pitchMrad.toFixed(1)}、偏转${state.yawMrad.toFixed(1)} mrad，${rows.length}个已记录扫描点。${state.hints?'虚线为理想理论参照（光源开启时）。':'未记录位置不生成数据。'}`;
}
function updateFiberLead(){
 const key=[state.xUm,state.yUm,state.axialUm,state.pitchMrad,state.yawMrad].join('/');
 if(key===fiberLeadKey)return;
 const original=model.getObjectByName('OutputFiber');
 if(!fiberLead){
  original.visible=false;
  fiberLead=new THREE.Mesh(new THREE.BufferGeometry(),original.material.clone());
  fiberLead.name='Flexible output lead';scene.add(fiberLead);
 }
 const holder=model.getObjectByName('FiberStage');holder.updateWorldMatrix(true,false);
 // The first two points follow the strain relief; the detector end stays fixed.
 const exit=model.getObjectByName('FiberExit').getWorldPosition(new THREE.Vector3()),port=model.getObjectByName('DetectorFiberPort').getWorldPosition(new THREE.Vector3());
 const points=[exit,holder.localToWorld(new THREE.Vector3(.112,0,0)),new THREE.Vector3(.53,.072,.035),new THREE.Vector3(.56,.065,.025),port.clone().add(new THREE.Vector3(-.019,0,0)),port];
 fiberLead.geometry.dispose();
 fiberLead.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,.0014,8,false);
 fiberLeadKey=key;
}
function update(){
 const v=power(state);$('power').textContent=displayPower(v);$('live-power').textContent=displayPower(v);$('loss').textContent=!state.sourceOn?'光源关闭':v>0?(-10*Math.log10(v)).toFixed(2)+' dB':'∞ dB';$('axis').textContent=AXES[selected].label;$('axis-select').value=selected;
 for(const [key,a] of Object.entries(AXES)){$(a.id).value=state[key].toFixed(a.step===.01?2:1);$(a.id).disabled=state.task==='scan'&&key!=='xUm';}
 $('source').checked=state.sourceOn;$('task').value=state.task;$('hints').checked=state.hints;
 document.querySelectorAll('[data-axis]').forEach(b=>b.disabled=state.task==='scan'&&b.dataset.axis!=='xUm');$('record').disabled=!loaded||!state.sourceOn;
 $('instruction').textContent=state.task==='scan'?'Y、Z及两轴倾角已锁定。逐点改变X并记录，建议至少9点；改变其他轴请先返回对准任务。':'先记录初始条件，再调节XYZ与俯仰、偏转提高功率。进入扫描后其余四轴锁定。';
 const data=report(state);$('rows').replaceChildren(...data.rows.map(row=>{const tr=document.createElement('tr');for(const v of row){const td=document.createElement('td');td.textContent=v;tr.append(td);}return tr;}));$('count').textContent=state.records.length;$('undo').disabled=!state.records.length;$('empty').hidden=!!state.records.length;$('statistics').textContent=data.summaries.slice(0,-2).join('\n');
 for(const k of ['prediction','conclusion'])if(document.activeElement!==$(k))$(k).value=state[k];observation();
 const dc=display.getContext('2d');dc.fillStyle='#152d2a';dc.fillRect(0,0,512,320);dc.fillStyle='#bdebd0';dc.font='36px monospace';dc.fillText('P / Pin',40,80);dc.font='58px monospace';dc.fillText(displayPower(v),40,174);dc.font='24px monospace';dc.fillText('IDEAL / 633 nm',40,255);displayTexture.needsUpdate=true;
 if(model){
 model.getObjectByName('StageZ').position.x=state.axialUm*1e-6;
 model.getObjectByName('StageX').position.z=state.xUm*1e-6;
 model.getObjectByName('StageY').position.y=state.yUm*1e-6;
 model.getObjectByName('FiberStage').rotation.set(0,-state.yawMrad/1000,state.pitchMrad/1000,'YZX');
 for(const [key,a] of Object.entries(AXES)){const knob=model.getObjectByName(a.knob);knob.quaternion.copy(knob.userData.restQuaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),state[key]*.2));}
 updateAngularSpindles(model);updateFiberLead();
 }beam.visible=state.sourceOn;render();
 try{sessionStorage.setItem(SESSION,JSON.stringify({version:1,state}));}catch{$('message').textContent='临时保存失败，请导出实验档案。';}
}
function change(patch,message='读数已更新，已有记录保持不变。'){try{state=changeSettings(state,patch);update();$('message').textContent=message;}catch(e){$('message').textContent=e.message;update();}}
for(const [key,{id}] of Object.entries(AXES)){const commit=()=>{if($(id).value.trim()===''){update();$('message').textContent='请输入有效位移。';return;}selected=key;change({[key]:Math.round(Number($(id).value)*100)/100});};$(id).onchange=commit;$(id).onkeydown=e=>{if(e.key==='Enter')commit();};}
function nudge(key,step){selected=key;const a=AXES[key];change({[key]:Math.round(Math.max(a.min,Math.min(a.max,state[key]+step))*100)/100});}
$('axis-select').onchange=()=>{selected=$('axis-select').value;update();};
 $('reset-settings').onclick=()=>{stop();selected='xUm';change({...fresh(),records:state.records,prediction:state.prediction,conclusion:state.conclusion,assisted:state.assisted},'五轴参数已复位，记录保留。');view('overall');};
 document.querySelectorAll('[data-axis]').forEach(b=>b.onclick=()=>nudge(b.dataset.axis,Number(b.dataset.step)));
$('source').onchange=()=>change({sourceOn:$('source').checked});$('task').onchange=()=>change({task:$('task').value});$('hints').onchange=()=>change({hints:$('hints').checked},'提示状态已更新；已使用辅助的记录继续保留标记。');
$('record').onclick=()=>{try{state=record(state);update();$('message').textContent='已保存当前位置、功率和条件。';}catch(e){$('message').textContent=e.message;}};
$('undo').onclick=()=>change({records:state.records.slice(0,-1)},'已撤销末条记录。');for(const k of ['prediction','conclusion'])$(k).onchange=()=>change({[k]:$(k).value},'实验文字已保存。');
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{if(!loaded||e.button!==0)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);camera.updateMatrixWorld();model.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);let node=raycaster.intersectObject(model,true)[0]?.object;while(node&&!node.userData.control)node=node.parent;if(!node)return;selected=node.userData.control;$('scene').focus();if(selected!=='xUm'&&state.task==='scan'){$('message').textContent='扫描时其余四轴已锁定，请先返回对准任务。';e.stopImmediatePropagation();return;}drag={key:selected,start:e.clientY,value:state[selected],id:e.pointerId};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);e.stopImmediatePropagation();update();},true);
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;const a=AXES[drag.key],value=Math.round(Math.max(a.min,Math.min(a.max,drag.value+(drag.start-e.clientY)*a.step*2))*100)/100;queueLabChange(change,{[drag.key]:value},'正在微调：向上增加，向下减小。');});
function stop(){if(drag&&renderer.domElement.hasPointerCapture(drag.id))renderer.domElement.releasePointerCapture(drag.id);drag=null;controls.enabled=true;clearTimeout(drawTimer);}
renderer.domElement.addEventListener('pointerup',stop);renderer.domElement.addEventListener('pointercancel',stop);renderer.domElement.addEventListener('lostpointercapture',stop);
$('scene').onkeydown=e=>{if(['ArrowLeft','ArrowDown','ArrowRight','ArrowUp'].includes(e.key)){e.preventDefault();nudge(selected,(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*(e.shiftKey?AXES[selected].nudge:AXES[selected].step));}};
installPlatformBridge({lab:'fiber',ready:()=>loaded,read:()=>({state}),restore:p=>{state=normalize(p.state);update();},render:()=>{update();renderer.render(scene,camera);},eye:'#eye',stop,applyConditions:c=>{state=applyConditions(state,c);update();}});
function disposeTree(root){const textures=new Set();root.traverse(o=>{o.geometry?.dispose();o.shadow?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}});for(const texture of textures)texture.dispose();}
new GLTFLoader().load('./assets/fiber-bench.glb',g=>{if(isLabDisposed()){disposeLabTree(g.scene);return;}if(disposed){disposeTree(g.scene);return;}model=g.scene;scene.add(model);finishPrecisionHardware(model);for(const [key,a] of Object.entries(AXES)){const knob=model.getObjectByName(a.knob);knob.userData.control=key;knob.userData.restQuaternion=knob.quaternion.clone();}
 const screen=model.getObjectByName('MeterDisplay');screen.updateWorldMatrix(true,false);screen.getWorldPosition(meter.position);screen.getWorldQuaternion(meter.quaternion);meter.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));const floor=new THREE.Object3D();floor.position.y=-.8;presentation=installProductPresentation({scene,camera,renderer,model,focusModel:model.getObjectByName('Instrument'),controls,floor,name:'fiber'});loaded=true;$('loading').hidden=true;resize();update();parent.postMessage({type:'fiber-ready',version:1,lab:'fiber'},location.origin);},undefined,()=>{if(disposed)return;$('loading').textContent='模型加载失败，请使用平台重试。';parent.postMessage({type:'fiber-failed',version:1,lab:'fiber'},location.origin);});
function dispose(){if(disposed)return;disposed=true;loaded=false;stop();observer.disconnect();controls.dispose();presentation?.dispose();disposeTree(scene);scene.environment?.dispose();scene.background?.dispose?.();renderer.dispose();renderer.forceContextLoss();window.removeEventListener('pagehide',dispose);window.removeEventListener('wx-3d-dispose',dispose);}
window.addEventListener('pagehide',dispose,{once:true});window.addEventListener('wx-3d-dispose',dispose,{once:true});
update();

