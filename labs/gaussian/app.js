import {manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup,queueLabChange} from '../shared/lab-runtime.js';
import {installPartDrag} from '../shared/part-drag.js?v=20261117-scroll';
import {installProductPresentation} from '../shared/product-presentation.js';
import {frameExperimentTable} from '../shared/experiment-table.js';
let presentation;
document.querySelector('#toggle-controls').onclick=e=>{const hidden=document.body.classList.toggle('controls-hidden');e.currentTarget.textContent=hidden?'展开调节面板':'收起调节面板';e.currentTarget.setAttribute('aria-expanded',String(!hidden));};
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {createGaussianBench} from './model.mjs?v=2';
import {fresh} from './physics.mjs';
import {installExperiment} from './experiment.js?v=20261117-scroll';
const $=s=>document.querySelector(s),stage=$('#scene');
try {
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;stage.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#353B44');scene.fog=new T.Fog('#39484d',3,10);const camera=new T.PerspectiveCamera(38,1,.001,30);const orbit=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:orbit});orbit.enableDamping=true;orbit.minDistance=.07;orbit.maxDistance=3;
const pm=new T.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pm.fromScene(room,.04).texture;room.dispose();pm.dispose();scene.add(new T.HemisphereLight(0xffffff,0x546c66,.7));const sun=new T.DirectionalLight(0xfff1dd,2.5);sun.position.set(-.6,1,.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-.8,right:.8,top:.7,bottom:-.7,near:.01,far:4});sun.shadow.bias=-.00003;sun.shadow.normalBias=.0005;scene.add(sun);
const floor=new T.Mesh(new T.PlaneGeometry(15,15),new T.MeshStandardMaterial({color:0x354044,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.76;floor.receiveShadow=true;scene.add(floor);
const fill=new T.DirectionalLight(0xc9e5ff,1.3);fill.position.set(.6,.6,-.5);scene.add(fill);
const rim=new T.DirectionalLight(0xffffff,.8);rim.position.set(.2,.4,.8);scene.add(rim);
const font=await new FontLoader().loadAsync('../polarimeter/assets/lettering.json');if(!isLabDisposed()){const model=createGaussianBench(font);scene.add(model.root);presentation=installProductPresentation({scene,camera,renderer,model:model.root,controls:orbit,upAxis:'y',name:'gaussian',floor:floor,experimentTable:{top:0,minWidth:1.65}});
const grainData=new Uint8Array(128*128*4);let seed=917;for(let i=0;i<grainData.length;i+=4){seed=(1664525*seed+1013904223)>>>0;const c=120+(seed%17);grainData[i]=grainData[i+1]=grainData[i+2]=c;grainData[i+3]=255;}const grain=new T.DataTexture(grainData,128,128);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(6,6);grain.needsUpdate=true;model.root.traverse(n=>{if(n.isMesh&&n.material.metalness>.5){n.material.bumpMap=grain;n.material.bumpScale=.00006;}});
const state=fresh();let experiment;function apply(){model.setState(state);$('#iris').value=state.irisMm;$('#iris-value').value=state.irisMm;for(const [id,key]of [['lens','lensMm'],['detector','detectorMm']]){$('#'+id).value=state[key];$('#'+id+'-value').value=state[key];$('#'+id+'-number').value=state[key];}$('#beam').checked=state.beamOn;experiment?.update();(presentation?presentation.render():renderer.render(scene,camera));}
for(const [id,key]of [['lens','lensMm'],['detector','detectorMm']])$('#'+id).oninput=e=>{state[key]=Number(e.target.value);apply();};$('#laser').onchange=e=>{state.laserOn=e.target.checked;apply();};$('#beam').onchange=e=>{state.beamOn=e.target.checked;apply();};
for(const [id,key,min,max]of [['lens','lensMm',300,650],['detector','detectorMm',750,950]]){const input=$('#'+id+'-number');input.oninput=e=>{const v=Number(e.target.value);if(e.target.value!==''&&Number.isFinite(v)&&v>=min&&v<=max){state[key]=Math.round(v);apply();}};input.onblur=e=>{const v=Number(e.target.value);if(e.target.value!==''&&Number.isFinite(v))state[key]=Math.round(Math.max(min,Math.min(max,v)));apply();};}
$('#iris').oninput=e=>{state.irisMm=Number(e.target.value);apply();};
const views={overall:[[-.76,.57,1.05],[0,.12,0]],lens:[[.08,.29,.25],[-.08,.15,0]],laser:[[-.15,.34,.35],[-.34,.14,0]],screen:[[.10,.29,.28],[.32,.16,0]],top:[[0,1.2,.001],[0,0,0]]};let active='overall';function view(name){active=name;let [p,t]=views[name];camera.position.set(...p);orbit.target.set(...t);if(name==='overall')frameExperimentTable(scene,camera,orbit);else if(name!=='top')camera.position.sub(orbit.target).multiplyScalar(Math.max(1,1.15/camera.aspect)).add(orbit.target);orbit.update();(presentation?presentation.render():renderer.render(scene,camera));}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));$('#reset').onclick=()=>{Object.assign(state,{lensMm:600,detectorMm:820,irisMm:12,beamOn:false,laserOn:true});apply();view('overall');};
const descriptions={Laser:'激光器固定于立杆夹具，出光口与透镜中心同轴。电源线、散热槽与端盖独立建形。',Iris:'十二片叶片随孔径控制开合；为机械示意，不模拟截光及衍射。',Lens:'透镜具有双凸表面、金属压圈和独立滑座。拖动位置滑条可沿导轨移动。',Detector:'带10 mm间隔参考网格的探测屏，背板、紧固件和滑座独立建形。',PowerSupply:'光源电源盒与供电线。'};
const ray=new T.Raycaster(),mouse=new T.Vector2();let down;renderer.domElement.onpointerdown=e=>down=[e.clientX,e.clientY];renderer.domElement.onpointerup=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);ray.setFromCamera(mouse,camera);let n=ray.intersectObject(model.root,true)[0]?.object;while(n&&!descriptions[n.name])n=n.parent;if(n){$('#part').textContent={Laser:'激光光源',Iris:'光阑',Lens:'透镜滑座',Detector:'探测屏',PowerSupply:'电源'}[n.name];$('#description').textContent=descriptions[n.name];}};
// Capture only draggable instrument hits; other gestures retain orbit controls.
let drag=null;const dragPlane=new T.Plane(new T.Vector3(0,1,0),-.06),hitPoint=new T.Vector3();
function pointerRay(e){const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);ray.setFromCamera(mouse,camera);}
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;pointerRay(e);let n=ray.intersectObject(model.root,true).filter(h=>h.object.visible&&h.object.name!=='BeamGuide')[0]?.object;while(n&&!['Lens','Detector'].includes(n.name))n=n.parent;if(!n||!ray.ray.intersectPlane(dragPlane,hitPoint))return;drag={key:n.name==='Lens'?'lensMm':'detectorMm',offset:hitPoint.x-n.position.x};orbit.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);e.stopImmediatePropagation();},true);
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;pointerRay(e);if(ray.ray.intersectPlane(dragPlane,hitPoint)){const min=drag.key==='lensMm'?300:750,max=drag.key==='lensMm'?650:950;state[drag.key]=Math.round(Math.max(min,Math.min(max,(hitPoint.x-drag.offset+.5)*1000)));apply();}e.stopImmediatePropagation();},true);
for(const event of ['pointerup','pointercancel'])renderer.domElement.addEventListener(event,e=>{if(!drag)return;drag=null;orbit.enabled=true;if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);e.stopImmediatePropagation();},true);
function applyIris(value){state.irisMm=Math.round(Math.max(4,Math.min(24,value)));apply();}
installPartDrag({renderer,camera,controls:orbit,model:model.root,resolvePart(object){
 let node=object;while(node&&node.name!=='Iris')node=node.parent;if(!node)return null;
 return {start(event){
  const y=event.clientY,value=state.irisMm;$('#part').textContent='光阑';$('#description').textContent='上下拖动光阑调孔径；保持原有机械开合示意。';
  return event=>queueLabChange(applyIris,value+(y-event.clientY)*.1);
 },wheel:event=>applyIris(state.irisMm-Math.sign(event.deltaY))};
}});
renderer.domElement.title='拖动透镜/探测屏沿导轨移动；上下拖动光阑调孔径。';
stage.parentElement.querySelector('footer').textContent='拖动透镜/探测屏沿导轨移动 · 上下拖动光阑调孔径 · 空白处旋转视角';
experiment=installExperiment(state,model,apply,()=>presentation.renderSnapshot());
const resize=new LabResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();});resize.observe(stage);view('overall');apply();$('#loading').hidden=true;setLabAnimationLoop(renderer,()=>{if(document.hidden)return;orbit.update();(presentation?presentation.render():renderer.render(scene,camera));});window.addEventListener('pagehide',()=>{resize.disconnect();setLabAnimationLoop(renderer,null);orbit.dispose();scene.traverse(n=>{n.geometry?.dispose();if(n.material)n.material.dispose();});scene.environment.dispose();grain.dispose();experiment?.dispose();renderer.dispose();});
}
}catch(e){$('#loading').textContent='模型加载失败：'+e.message;console.error(e);}
