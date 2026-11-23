import {labSessionStorage,queueLabChange,manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup} from '../shared/lab-runtime.js';
import {installProductPresentation} from '../shared/product-presentation.js';
let presentation;
import {addExperimentTable,frameExperimentTable} from '../shared/experiment-table.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';
import {fresh,normalize,simulate,record,report} from './physics.mjs';
import {installPlatformBridge} from '../shared/platform-bridge.js';
const $=id=>document.getElementById(id);let state=fresh(),loaded=false,model,drag=null;
const sessionKey='wx-lens-session-v1';
try{const raw=labSessionStorage.getItem(sessionKey);if(raw){const saved=JSON.parse(raw);if(saved.version!==1||saved.lab!=='lens')throw Error('不支持的暂存版本');state=normalize(saved.state);}}catch{$('message').textContent='暂存无法恢复，已使用初始条件；已导出档案保持不变。';}
function saveSession(){try{labSessionStorage.setItem(sessionKey,JSON.stringify({version:1,lab:'lens',state}));}catch{$('message').textContent='自动暂存不可用，请导出实验档案。';}}
const scene=new THREE.Scene();scene.background=new THREE.Color('#353B44');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;$('scene').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(35,1,.005,20),controls=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:controls});controls.enableDamping=false;controls.minDistance=.18;controls.maxDistance=3;controls.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight(0xffffff,0x6f8274,2));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(.1,1.5,.8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-1;sun.shadow.camera.right=1;sun.shadow.camera.top=1;sun.shadow.camera.bottom=-1;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0xcfdad5,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
const eye=$('eye'),ctx=eye.getContext('2d'),texture=new THREE.CanvasTexture(eye);texture.colorSpace=THREE.SRGBColorSpace;
const projected=new THREE.Mesh(new THREE.PlaneGeometry(.165,.2),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));projected.rotation.y=-Math.PI/2;projected.position.set(.6195,.14,0);scene.add(projected);
let rays=new THREE.Group();scene.add(rays);
function render(){if(loaded)(presentation?presentation.render():renderer.render(scene,camera));}
function resize(){const r=$('scene').getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render();}
new LabResizeObserver(resize).observe($('scene'));controls.addEventListener('change',render);
function view(which){const focus=which==='screen'?[state.screenMm/1000,.13,0]:[.6,.08,0];controls.target.set(...focus);camera.position.set(...(which==='side'?[.6,.32,1.65]:which==='screen'?[state.screenMm/1000-.36,.23,.3]:[1.25,.75,1.25]));if(which!=='side'&&which!=='screen')frameExperimentTable(scene,camera,controls);controls.update();render();}
$('overall').onclick=()=>view('overall');$('side').onclick=()=>view('side');$('screen-view').onclick=()=>view('screen');view('overall');
function drawImage(q){
  ctx.fillStyle=state.sourceOn?'#eceee5':'#626e69';ctx.fillRect(0,0,eye.width,eye.height);
  if(state.sourceOn){
    // Geometric point-spread approximation; blur stays nonzero for virtual/infinite images.
    const px=eye.width/165,m=-q.v/q.u;
    ctx.save();ctx.translate(eye.width/2,eye.height/2+10*px);ctx.filter=`blur(${Math.min(90,q.blur*px/3)}px)`;ctx.scale(m*px,-m*px);ctx.strokeStyle='#333f39';ctx.fillStyle='#333f39';ctx.lineWidth=1.8;
    ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(0,10);ctx.moveTo(-3,6);ctx.lineTo(0,10);ctx.lineTo(3,6);ctx.moveTo(-9,0);ctx.lineTo(9,0);ctx.moveTo(5,3);ctx.lineTo(9,0);ctx.lineTo(5,-3);ctx.stroke();ctx.fillRect(4,-7,3,3);ctx.restore();
  }
  texture.needsUpdate=true;
}
function drawRays(q){
  for(const c of [...rays.children]){rays.remove(c);c.geometry.dispose();c.material.dispose();}rays.visible=state.rays&&state.sourceOn;
  if(!rays.visible)return;
  const o=state.objectMm/1000,l=state.lensMm/1000,s=state.screenMm/1000;
  for(const h of [0,.01]){const slope=(h-.01)/(q.u/1000)-h/(state.focalMm/1000);const points=[new THREE.Vector3(o,.14,0),new THREE.Vector3(l,.13+h,0),new THREE.Vector3(s,.13+h+slope*(s-l),0)];rays.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:h?0xc69439:0x458f88,transparent:true,opacity:.75})));}
}
function update(){
  saveSession();
  const q=simulate(state);
  for(const name of ['object','lens','screen'])$(name).value=state[name+'Mm'];$('focal').value=state.focalMm;$('source').checked=state.sourceOn;$('rays').checked=state.rays;
  if(model)for(const [name,id] of [['ObjectCarrier','object'],['LensCarrier','lens'],['ScreenCarrier','screen']])model.getObjectByName(name).position.x=state[id+'Mm']/1000;
  if(model){const light=model.getObjectByName('Target_luminous_face')||model.getObjectByName('Target luminous face');if(light){light.material.color.set(state.sourceOn?0xebd999:0x59665e);light.material.emissiveIntensity=state.sourceOn?.5:0;}}
  projected.position.x=state.screenMm/1000-.0005;
  $('u').textContent=q.u.toFixed(1)+' mm';$('v').textContent=q.v.toFixed(1)+' mm';$('image-status').textContent=q.image.atInfinity?'像在无穷远':q.image.isReal?'倒立实像':'正立虚像';
  $('focus-status').textContent=!state.sourceOn?'光源关闭':q.recordable?'清晰 · 可记录':q.image.isReal?'未合焦':'光屏不能承接';$('record').disabled=!loaded||!q.recordable;
  $('count').textContent=state.records.length;$('undo').disabled=!state.records.length;$('empty').hidden=!!state.records.length;
  $('rows').replaceChildren(...state.records.map((r,i)=>{const q=simulate(r),tr=document.createElement('tr');for(const value of [i+1,r.focalMm,q.u.toFixed(1),q.v.toFixed(1),q.measuredF.toFixed(3),r.assisted?'辅助':'手动']){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));
  $('statistics').textContent=state.records.length?report(state).summaries.slice(0,2).join(' '):'';
  for(const k of ['prediction','conclusion'])if(document.activeElement!==$(k))$(k).value=state[k];drawImage(q);drawRays(q);render();
}
function change(patch){try{state=normalize({...state,...patch});update();$('message').textContent='已更新仪器位置。';}catch(e){$('message').textContent=e.message;update();}}
for(const id of ['object','lens','screen']){
  const commit=()=>{if($(id).value===''){$('message').textContent='请输入位置读数。';update();return;}if(Number($(id).value)!==state[id+'Mm'])change({[id+'Mm']:Number($(id).value)});};
  $(id).addEventListener('change',commit);$(id).addEventListener('blur',commit);
  $(id).addEventListener('keydown',e=>{if(e.key==='Enter')commit();});
}
$('focal').onchange=()=>change({focalMm:Number($('focal').value)});$('source').onchange=()=>change({sourceOn:$('source').checked});$('rays').onchange=()=>change({rays:$('rays').checked});
for(const k of ['prediction','conclusion'])$(k).oninput=()=>{state[k]=$(k).value;saveSession();};
$('focus').onclick=()=>{const q=simulate(state),position=state.lensMm+q.image.v;if(!q.image.isReal||!Number.isFinite(position)||position>1190||position-state.lensMm<60){$('message').textContent='当前像无法落在导轨有效屏面范围内，请调整物距或焦距。';return;}change({screenMm:Math.round(position*10)/10,assisted:true});$('message').textContent='辅助调焦已使用；本次实验后续记录保留辅助标记。';};
$('record').onclick=()=>{try{state=record(state);update();$('message').textContent='读数已记录。改变物距后再次调焦，可比较焦距结果。';}catch(e){$('message').textContent=e.message;}};
$('undo').onclick=()=>change({records:state.records.slice(0,-1)});
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.06),hit=new THREE.Vector3();
function cast(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);}
renderer.domElement.addEventListener('pointerdown',e=>{if(!loaded||e.button!==0)return;cast(e);const hits=raycaster.intersectObject(model,true);let node=hits[0]?.object;while(node&&!node.userData.control)node=node.parent;if(node&&raycaster.ray.intersectPlane(plane,hit)){drag={key:node.userData.control,offset:hit.x-node.position.x,pointer:e.pointerId};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);}},true);
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;cast(e);if(raycaster.ray.intersectPlane(plane,hit))queueLabChange(change,{[drag.key+'Mm']:Math.round((hit.x-drag.offset)*10000)/10});});
function stop(){drag=null;controls.enabled=true;}
renderer.domElement.addEventListener('pointerup',stop);renderer.domElement.addEventListener('pointercancel',stop);
installPlatformBridge({lab:'lens',ready:()=>loaded,read:()=>({state}),restore:p=>{state=normalize(p.state);update();},render:()=>{update();render();},eye:'#eye',stop});
new GLTFLoader().load('./assets/lens-bench-product.glb',g=>{if(isLabDisposed()){disposeLabTree(g.scene);return;}model=g.scene;scene.add(model);addExperimentTable(scene,model,{floor});presentation=installProductPresentation({scene,camera,renderer,model:model,controls:controls,upAxis:'y',name:'lens',floor:floor});view('overview');for(const [name,key] of [['ObjectCarrier','object'],['LensCarrier','lens'],['ScreenCarrier','screen']])model.getObjectByName(name).userData.control=key;model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});loaded=true;$('loading').hidden=true;resize();update();parent.postMessage({type:'lens-ready',version:1,lab:'lens'},location.origin);},undefined,()=>{$('loading').textContent='模型加载失败，请刷新重试。';parent.postMessage({type:'lens-failed',version:1,lab:'lens'},location.origin);});
update();
