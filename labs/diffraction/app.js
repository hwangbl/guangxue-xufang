import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {queueLabChange,manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup} from '../shared/lab-runtime.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';
import {installProductPresentation} from '../shared/product-presentation.js';
import {addExperimentTable,frameExperimentTable} from '../shared/experiment-table.js';
import {installPlatformBridge} from '../shared/platform-bridge.js';
import {fresh,normalize,changeSettings,APERTURES,taskName,intensity,fresnelNumber,characteristic,record,report,result} from './physics.mjs';
import {applyConditions} from './conditions.mjs';
import {createLatestObservation} from '../shared/latest-observation.mjs';
const $=id=>document.getElementById(id),eye=$('eye'),plot=$('profile');
let state=fresh(),loaded=false,model,presentation,drag=null,drawTimer=0,patternKey='',samples=new Float64Array(2801),pending=0,lastView='overall';
const SESSION='wx-diffraction-session-v1';
try{const raw=sessionStorage.getItem(SESSION);if(raw){const v=JSON.parse(raw);if(v.version!==1)throw Error('版本不支持');state=normalize(v.state);state.leftMm=null;state.rightMm=null;}}catch{ $('message').textContent='上次临时状态无法恢复，请打开已保存的实验档案。'; }
const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;$('scene').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(35,1,.005,20),controls=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:controls});controls.minDistance=.13;controls.maxDistance=3;controls.maxPolarAngle=Math.PI*.49;
const screenCanvas=document.createElement('canvas');screenCanvas.width=660;screenCanvas.height=800;
const texture=new THREE.CanvasTexture(screenCanvas);texture.colorSpace=THREE.SRGBColorSpace;
const projected=new THREE.Mesh(new THREE.PlaneGeometry(.165,.2),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));projected.rotation.y=-Math.PI/2;projected.position.set(1.0495,.14,0);scene.add(projected);
const beam=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xef3a35,transparent:true,opacity:.5}));scene.add(beam);
function render(){if(!loaded)return;clearTimeout(drawTimer);if(presentation)presentation.render();else renderer.render(scene,camera);drawTimer=setTimeout(()=>presentation?.render(),40);}
function resize(){const r=$('scene').getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render();}
new LabResizeObserver(resize).observe($('scene'));controls.addEventListener('change',render);
function view(which){lastView=which;const x=which==='wheel'?state.apertureMm/1000:state.screenMm/1000;controls.target.set(...(which==='overall'?[.6,.09,0]:[x,.13,0]));if(which==='overall'){const fov=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(camera.aspect,1)),distance=.64/Math.sin(fov)*1.05;camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(.8,.75,1.38).normalize(),distance);}else camera.position.set(...(which==='wheel'?[x+.24,.23,.25]:[x-.36,.21,.28]));if(which==='overall')frameExperimentTable(scene,camera,controls);controls.update();render();}
$('overall').onclick=()=>view('overall');$('wheel-view').onclick=()=>view('wheel');$('screen-view').onclick=()=>view('screen');view('overall');
function sampled(x){const t=Math.min(samples.length-1,Math.abs(x)/.05),i=Math.floor(t);return samples[i]+(samples[Math.min(i+1,samples.length-1)]-samples[i])*(t-i);}
function drawObservation(){
 if(observationBase)eye.getContext('2d').putImageData(observationBase,0,0);
 const c=plot.getContext('2d'),w=plot.width,h=plot.height;c.clearRect(0,0,w,h);c.fillStyle='#f5f8f6';c.fillRect(0,0,w,h);
 const px=x=>(x+40)/80*w,py=y=>h-48-y*(h-88);c.strokeStyle='#dce7e0';c.lineWidth=1;c.font='30px sans-serif';c.fillStyle='#58766a';
 for(let x=-30;x<=30;x+=10){c.beginPath();c.moveTo(px(x),15);c.lineTo(px(x),h-42);c.stroke();c.fillText(String(x),px(x)-20,h-7);}
 for(const y of [0,.5,1]){c.beginPath();c.moveTo(0,py(y));c.lineTo(w,py(y));c.stroke();c.fillText(String(y),6,py(y)-4);}
 c.strokeStyle='#bd5448';c.lineWidth=2;c.beginPath();for(let i=0;i<w;i++){const y=py(sampled((i/w-.5)*80));if(i===0)c.moveTo(i,y);else c.lineTo(i,y);}c.stroke();
 const ec=eye.getContext('2d');
 function marker(x,color,dashed){if(x===null||Math.abs(x)>40)return;for(const [ctx,hh] of [[ec,eye.height],[c,h-30]]){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dashed?[6,5]:[]);ctx.beginPath();ctx.moveTo(px(x),0);ctx.lineTo(px(x),hh);ctx.stroke();ctx.restore();}}
 if(state.hints){const x=characteristic(state)*state.order;marker(-x,'#8ac4df',true);marker(x,'#8ac4df',true);}
 marker(state.leftMm,'#f6bd59');marker(state.rightMm,'#f6bd59');marker(state.cursorMm,'#a9d1bf',true);
}
let observationBase=null;
const patternStatus=document.createElement('p');patternStatus.className='fine';patternStatus.setAttribute('role','status');patternStatus.id='pattern-status';eye.before(patternStatus);
const observation=createLatestObservation({
 createWorker:()=>new Worker(new URL('./observation-worker.mjs',import.meta.url),{type:'module'}),
 apply:value=>{samples=value.samples;observationBase=new ImageData(value.eye,1000,400);screenCanvas.getContext('2d').putImageData(new ImageData(value.screen,660,800),0,0);texture.needsUpdate=true;drawObservation();render();},
 onStatus:({pending,error})=>{patternStatus.hidden=!pending&&!error;patternStatus.textContent=error||(pending?'正在更新衍射图样…':'');eye.style.opacity=pending?'.45':'1';eye.setAttribute('aria-busy',String(pending));$('pick-left').disabled=pending;$('pick-right').disabled=pending;$('record').disabled=pending||!loaded||!state.sourceOn||fresnelNumber(state)>.1||state.leftMm===null||state.rightMm===null;}
});
const suspendObservation=()=>observation.pause(),resumeObservation=()=>observation.resume();window.addEventListener('wx-lab-suspend',suspendObservation);window.addEventListener('wx-lab-resume',resumeObservation);addLabCleanup(()=>{observation.dispose();window.removeEventListener('wx-lab-suspend',suspendObservation);window.removeEventListener('wx-lab-resume',resumeObservation);});
function update(){
 const a=APERTURES[state.aperture],F=fresnelNumber(state),key=[state.aperture,state.apertureMm,state.screenMm,state.sourceOn].join(':');
 if(key!==patternKey){patternKey=key;observation.update(key,{aperture:state.aperture,apertureMm:state.apertureMm,screenMm:state.screenMm,sourceOn:state.sourceOn});}drawObservation();
 $('aperture').value=state.aperture;$('aperture-position').value=state.apertureMm;$('screen').value=state.screenMm;$('source').checked=state.sourceOn;$('order').value=state.order;$('order').disabled=a.kind==='circular';$('cursor').value=state.cursorMm.toFixed(2);$('hints').checked=state.hints;
 $('distance').textContent=(state.screenMm-state.apertureMm).toFixed(0)+' mm';$('fresnel').textContent=F.toFixed(3);$('task').textContent=taskName[a.kind];
 $('regime').textContent=F<=.1?'远场反演可用 · 移动光屏后重新选点。':'过渡区 · 可以观察传播；请增大屏距或减小孔径/双缝间距后测量。';
 $('instruction').textContent=a.kind==='circular'?'选择第一暗环在水平轴上的左右交点，测定圆孔直径。':a.kind==='single'?'从中心亮纹向两侧数暗纹，选取同一级暗纹的左右位置。':'中心亮纹记作0级，选左右同级亮纹；避开单缝包络的缺级位置。';
 $('picks').textContent=`左 ${state.leftMm?.toFixed(2)??'—'} / 右 ${state.rightMm?.toFixed(2)??'—'} mm`;
 $('record').disabled=observation.pending||!loaded||!state.sourceOn||F>.1||state.leftMm===null||state.rightMm===null;
 $('count').textContent=state.records.length;$('undo').disabled=!state.records.length;$('empty').hidden=!!state.records.length;
 $('rows').replaceChildren(...state.records.map((r,i)=>{const tr=document.createElement('tr');for(const v of [i+1,APERTURES[r.aperture].label,r.screenMm-r.apertureMm,r.leftMm.toFixed(2),r.rightMm.toFixed(2),r.order,result(r).estimate.toFixed(5),r.assisted?'使用提示':'手动选点']){const td=document.createElement('td');td.textContent=v;tr.append(td);}return tr;}));
 $('statistics').textContent=report(state).summaries.filter(v=>!v.startsWith('预测：')&&!v.startsWith('结论：')).join(' ');
 for(const k of ['prediction','conclusion'])if(document.activeElement!==$(k))$(k).value=state[k];
 if(model){model.getObjectByName('ApertureCarrier').position.x=state.apertureMm/1000;model.getObjectByName('ScreenCarrier').position.x=state.screenMm/1000;for(const [i,name] of ['SingleWheel','DoubleWheel'].entries()){const wheel=model.getObjectByName(name);wheel.visible=i===a.wheel;wheel.rotation.x=-a.slot*Math.PI/6;}}
 projected.position.x=state.screenMm/1000-.0007;beam.visible=state.sourceOn;beam.geometry.dispose();beam.geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.112,.13,0),new THREE.Vector3(state.apertureMm/1000,.13,0)]);
 render();try{sessionStorage.setItem(SESSION,JSON.stringify({version:1,state}));}catch{$('message').textContent='临时状态保存失败；请使用平台实验档案导出文件。';}
}
function change(patch,message='已更新。未完成选点在实验条件变化后重置。'){try{state=changeSettings(state,patch);update();$('message').textContent=message;}catch(e){$('message').textContent=e.message;update();}}
for(const [key,a] of Object.entries(APERTURES)){const o=document.createElement('option');o.value=key;o.textContent=a.label;$('aperture').append(o);}
$('aperture').onchange=()=>change({aperture:$('aperture').value});
function nextAperture(){const keys=Object.keys(APERTURES);change({aperture:keys[(keys.indexOf(state.aperture)+1)%keys.length]});}
$('next-aperture').onclick=nextAperture;
for(const [id,key] of [['aperture-position','apertureMm'],['screen','screenMm'],['order','order'],['cursor','cursorMm']]){
 const commit=()=>{if($(id).value.trim()===''){update();$('message').textContent='请输入有效数值。';return;}change({[key]:Number($(id).value)});};$(id).onchange=commit;$(id).onkeydown=e=>{if(e.key==='Enter')commit();};
}
$('source').onchange=()=>change({sourceOn:$('source').checked});$('hints').onchange=()=>change({hints:$('hints').checked},'理论位置仅作对照；本组保留辅助标记。');
for(const canvas of [eye,plot]){canvas.onclick=e=>{const r=canvas.getBoundingClientRect();change({cursorMm:Math.round(Math.max(-40,Math.min(40,(e.clientX-r.left)/r.width*80-40))*100)/100},'已选择屏幕坐标；请取左或右读数。');};canvas.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();change({cursorMm:Math.round(Math.max(-40,Math.min(40,state.cursorMm+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.1:.01)))*100)/100},'已微调坐标。');}};}
for(const side of ['left','right'])$('pick-'+side).onclick=()=>{if(side==='left'?state.cursorMm>=0:state.cursorMm<=0){$('message').textContent='左读数请选择负坐标，右读数请选择正坐标。';return;}change({[side+'Mm']:state.cursorMm},'读数已选取。凑齐左右同级位置后记录。');};
$('record').onclick=()=>{try{state=record(state);update();$('message').textContent='已保存原始读数与当时条件。可改变屏距或级次再测一组。';}catch(e){$('message').textContent=e.message;}};
$('undo').onclick=()=>change({records:state.records.slice(0,-1)},'已撤销末条记录。');
for(const k of ['prediction','conclusion'])$(k).onchange=()=>change({[k]:$(k).value},'实验文字已更新。');
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.05),hit=new THREE.Vector3();
function cast(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);camera.updateMatrixWorld();model?.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);}
renderer.domElement.addEventListener('pointerdown',e=>{if(!loaded||e.button!==0)return;cast(e);let node=raycaster.intersectObject(model,true).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;})?.object;while(node&&!node.userData.control)node=node.parent;if(!node)return;if(node.userData.control==='wheel'){nextAperture();e.stopImmediatePropagation();return;}if(raycaster.ray.intersectPlane(plane,hit)){drag={key:node.userData.control,offset:hit.x-node.position.x,pointer:e.pointerId};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);e.stopImmediatePropagation();}},true);
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;cast(e);if(!raycaster.ray.intersectPlane(plane,hit))return;const key=drag.key,value=Math.round((hit.x-drag.offset)*1000);const min=key==='apertureMm'?180:Math.max(550,state.apertureMm+300),max=key==='apertureMm'?Math.min(400,state.screenMm-300):1190;queueLabChange(change,{[key]:Math.max(min,Math.min(max,value))});});
function stop(){cancelAnimationFrame(pending);if(drag&&renderer.domElement.hasPointerCapture(drag.pointer))renderer.domElement.releasePointerCapture(drag.pointer);drag=null;controls.enabled=true;}
renderer.domElement.addEventListener('pointerup',()=>{drag=null;controls.enabled=true;});renderer.domElement.addEventListener('pointercancel',stop);
installPlatformBridge({lab:'diffraction',ready:()=>loaded,read:()=>({state}),restore:p=>{state=normalize(p.state);state.leftMm=null;state.rightMm=null;update();},render:()=>{update();renderer.render(scene,camera);},beforeCapture:()=>observation.waitForCurrent(),eye:'#eye',stop,applyConditions:c=>{state=applyConditions(state,c);update();}});
new GLTFLoader().load('./assets/diffraction-bench.glb',g=>{if(isLabDisposed()){disposeLabTree(g.scene);return;}model=g.scene;scene.add(model);for(const [name,key] of [['ApertureCarrier','apertureMm'],['ScreenCarrier','screenMm'],['SingleWheel','wheel'],['DoubleWheel','wheel']])model.getObjectByName(name).userData.control=key;addExperimentTable(scene,model);presentation=installProductPresentation({scene,camera,renderer,model,controls,name:'diffraction'});loaded=true;$('loading').hidden=true;resize();update();parent.postMessage({type:'diffraction-ready',version:1,lab:'diffraction'},location.origin);},undefined,()=>{$('loading').textContent='模型加载失败，请使用平台重试。';parent.postMessage({type:'diffraction-failed',version:1,lab:'diffraction'},location.origin);});
window.addEventListener('pagehide',()=>{stop();clearTimeout(drawTimer);controls.dispose();texture.dispose();renderer.dispose();});
update();
