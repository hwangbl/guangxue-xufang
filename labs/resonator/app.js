import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {queueLabChange,manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup} from '../shared/lab-runtime.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';
import {finishPrecisionHardware} from '../shared/precision-materials.js';
import {installProductPresentation} from '../shared/product-presentation.js';

import {installPlatformBridge} from '../shared/platform-bridge.js';
import {fresh,normalize,changeSettings,simulate,solve,MIRRORS,LABELS,format,record,report,modeIntensity1D} from './physics.mjs';
import {applyConditions} from './conditions.mjs';
import {createCavityView} from './cavity-view.mjs';
const $=id=>document.getElementById(id),SESSION='wx-resonator-session-v1';
let state=fresh(),loaded=false,disposed=false,model,presentation,drag=null,drawTimer=0,lastView='overall';
try{const raw=sessionStorage.getItem(SESSION);if(raw){const v=JSON.parse(raw);if(v.version!==1)throw Error();state=normalize(v.state);}}catch{$('message').textContent='临时状态无法恢复，请打开保存的实验档案。';}
for(const id of ['mirror1','mirror2'])for(const [key,value] of Object.entries(MIRRORS)){const o=document.createElement('option');o.value=key;o.textContent=value.label;$(id).append(o);}
const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;$('scene').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(35,1,.002,10),controls=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:controls,release:false});controls.minDistance=.08;controls.maxDistance=3;controls.maxPolarAngle=Math.PI*.49;
const cavityView=createCavityView();scene.add(cavityView.root);let sideFraming='';
function render(){if(disposed||!loaded||document.hidden||!$('scene').clientWidth)return;clearTimeout(drawTimer);presentation?.render();drawTimer=setTimeout(()=>{if(!disposed&&$('scene').clientWidth)presentation?.render();},40);}
function view(which){lastView=which;
 cavityView.setDetailed(which==='side');$('cavity-summary').hidden=which!=='side';
 for(const [id,key] of [['table-view','table'],['overall','overall'],['mirror-view','mirror'],['side-view','side']])$(id).setAttribute('aria-pressed',String(which===key));
 if(which==='table'){controls.target.set(.375,-.30,0);const fov=Math.atan(Math.tan(THREE.MathUtils.degToRad(17.5))*Math.min(camera.aspect,1));camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(.8,.8,1.4).normalize(),.74/Math.sin(fov)*1.08);}
 else if(which==='overall'){controls.target.set(.39,.065,.02);const fov=Math.atan(Math.tan(THREE.MathUtils.degToRad(17.5))*Math.min(camera.aspect,1));camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(.35,.8,1.5).normalize(),.43/Math.sin(fov)*1.05);}
 else if(which==='mirror'){controls.target.set(.115+state.lengthMm/1000,.091,0);camera.position.copy(controls.target).add(new THREE.Vector3(-.12,.105,.18));}
 else{controls.target.set(.1+state.lengthMm/2000,.105,0);const span=Math.max((state.lengthMm/1000+.13)/camera.aspect,.18,cavityView.radius*3.2+.07);const distance=span/2/Math.tan(THREE.MathUtils.degToRad(17.5))*1.18;camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(.08,.12,1).normalize(),distance);}
 controls.update();render();}
$('overall').onclick=()=>view('overall');$('mirror-view').onclick=()=>view('mirror');$('side-view').onclick=()=>view('side');
function resize(){const r=$('scene').getBoundingClientRect();if(!r.width||!r.height||disposed)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render();}
$('table-view').onclick=()=>view('table');
const observer=new LabResizeObserver(resize);observer.observe($('scene'));controls.addEventListener('change',render);view('overall');
function observation(v){
 const c=$('eye').getContext('2d'),w=v.widthAt(state.probe*state.lengthMm),size=480,img=c.createImageData(size,size);
 const ix=Array.from({length:size},(_,x)=>w===null?0:modeIntensity1D(state.m,(x-240)/200,w));
 const iy=Array.from({length:size},(_,y)=>w===null?0:modeIntensity1D(state.n,(y-240)/200,w));
 const peak=Math.max(...ix)*Math.max(...iy)||1;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const I=ix[x]*iy[y]/peak,i=(y*size+x)*4;img.data[i]=19+220*I;img.data[i+1]=35+55*I;img.data[i+2]=38+10*I;img.data[i+3]=255;}c.putImageData(img,0,0);
 c.font='16px sans-serif';c.strokeStyle='#547273';c.fillStyle='#b3ceca';c.lineWidth=1;
 for(const t of [-1,-.5,0,.5,1]){const p=240+t*200;c.beginPath();c.moveTo(p,40);c.lineTo(p,440);c.moveTo(40,p);c.lineTo(440,p);c.stroke();c.fillText(String(t),p-8,465);}
 c.fillText('mm',435,465);if(w!==null){c.strokeStyle='#f3c9a1';c.setLineDash([5,5]);c.beginPath();c.ellipse(240,240,Math.min(w*Math.sqrt(2*state.m+1)*200,400),Math.min(w*Math.sqrt(2*state.n+1)*200,400),0,0,Math.PI*2);c.stroke();c.setLineDash([]);}else{c.fillStyle='#e3ebe6';c.textAlign='center';c.fillText(LABELS[v.status]+' · 无有效截面',240,225);c.textAlign='start';}
 $('spot-note').textContent=w===null?v.reason:'z = '+(state.probe*state.lengthMm).toFixed(1)+' mm；w = '+format(w)+' mm。TEM'+state.m+state.n+'；虚线为2σ尺寸。'+(w*Math.sqrt(2*Math.max(state.m,state.n)+1)>1?'光斑超出±1 mm视场，已裁剪显示。':'固定毫米标尺；相对强度不表示功率。');
 const p=$('profile').getContext('2d');p.fillStyle='#f4f7f5';p.fillRect(0,0,800,270);const xx=x=>110+(x-50)*1.26,yy={stable:55,confocal:105,marginal:155,unstable:205,invalid:235},colors={stable:'#327f6c',confocal:'#b38a3c',marginal:'#c29852',unstable:'#b55746',invalid:'#777'};
 p.font='18px sans-serif';for(const key of ['stable','confocal','marginal','unstable']){p.fillStyle=colors[key];p.fillText(LABELS[key],8,yy[key]+5);p.strokeStyle='#d7e2da';p.beginPath();p.moveTo(110,yy[key]);p.lineTo(740,yy[key]);p.stroke();}
 if(state.hints)for(let L=50;L<=550;L++){const a=solve(MIRRORS[state.mirror1].radius,MIRRORS[state.mirror2].radius,L);p.fillStyle=colors[a.status];p.globalAlpha=.35;p.fillRect(xx(L),yy[a.status]-8,1.5,16);}p.globalAlpha=1;
 const rows=state.records.filter(r=>r.mirror1===state.mirror1&&r.mirror2===state.mirror2);for(const r of rows){p.fillStyle=colors[r.status];p.beginPath();p.arc(xx(r.lengthMm),yy[r.status],5,0,Math.PI*2);p.fill();}
 p.fillStyle='#50695f';for(const L of [50,150,250,350,450,550])p.fillText(String(L),xx(L)-13,248);p.fillText('L / mm',665,268);
 $('plot-note').textContent='当前镜组共'+rows.length+'个记录点。'+(state.hints?'浅色带为理论参照；共焦单独分类。':'未记录位置不生成数据。');
}
function update(){
 const v=simulate(state);$('length-readout').textContent=state.lengthMm;$('status').textContent=LABELS[v.status];$('status').dataset.state=v.status;$('waist').textContent=format(v.w0);$('reason').textContent=v.reason;
 $('mode-m').value=state.m;$('mode-n').value=state.n;
 $('mode-readout').textContent='TEM'+state.m+state.n+' · m 横向 / n 竖直'+(v.w0===null?' · 无有效腔模':' · 束腰2σ尺寸 '+format(v.w0*Math.sqrt(2*state.m+1))+' / '+format(v.w0*Math.sqrt(2*state.n+1))+' mm');
 $('length').value=state.lengthMm;$('length-slider').value=state.lengthMm;for(const k of ['mirror1','mirror2','task','probe'])$(k).value=state[k];$('hints').checked=state.hints;$('record').disabled=!loaded||v.status==='invalid';
 $('probe-label').textContent=(state.probe*state.lengthMm).toFixed(1)+' mm / 从镜1起';$('probe-waist').disabled=v.waistPos===null||v.waistPos<0||v.waistPos>state.lengthMm;
 $('instruction').textContent=state.task==='plano'?'平面镜与200 mm凹面镜：先预测，再记录至少7个腔长，覆盖状态变化的两侧。':state.task==='asymmetric'?'200 / 300 mm双凹腔：建议至少9点，寻找两个稳定区及其边界。':'比较对称双凹腔与平平腔，解释共焦退化与普通临界的区别。';
 const data=report(state);$('rows').replaceChildren(...data.rows.map(row=>{const tr=document.createElement('tr');for(const value of row){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));$('count').textContent=state.records.length;$('undo').disabled=!state.records.length;$('empty').hidden=!!state.records.length;$('statistics').textContent=data.summaries[0];
 for(const k of ['prediction','conclusion'])if(document.activeElement!==$(k))$(k).value=state[k];observation(v);
 if(model){model.getObjectByName('Mirror2').position.x=.1+state.lengthMm/1000;for(const i of [1,2])for(const key of Object.keys(MIRRORS))model.getObjectByName('Surface'+i+'_'+key).visible=state['mirror'+i]===key;}
 cavityView.update(state,v);
 $('side-length').textContent=state.lengthMm+' mm';$('side-waist').textContent=v.waistPos===null?'—':v.waistPos.toFixed(1)+' mm';$('side-probe').textContent=(state.probe*state.lengthMm).toFixed(1)+' mm';
 const framing=[state.lengthMm,state.m,state.n,state.mirror1,state.mirror2].join('/');if(lastView==='side'&&framing!==sideFraming)view('side');sideFraming=framing;render();
 try{sessionStorage.setItem(SESSION,JSON.stringify({version:1,state}));}catch{$('message').textContent='临时保存失败，请导出实验档案。';}
}
function change(patch,message='当前条件已更新，历史记录保持不变。'){try{state=changeSettings(state,patch);update();$('message').textContent=message;}catch(e){$('message').textContent=e.message;update();}}
function commit(){if($('length').value.trim()===''){$('message').textContent='请输入有效腔长。';update();return;}change({lengthMm:Number($('length').value)});}
for(const key of ['m','n']){const select=$('mode-'+key);for(let i=0;i<=5;i++){const o=document.createElement('option');o.value=i;o.textContent=i;select.append(o);}select.onchange=()=>change({[key]:Number(select.value)});}
 $('reset-settings').onclick=()=>{stop();change({...fresh(),records:state.records,prediction:state.prediction,conclusion:state.conclusion,assisted:state.assisted},'仪器参数已复位，记录保留。');view('overall');};
 $('length').onchange=commit;$('length').onkeydown=e=>{if(e.key==='Enter')commit();};$('length-slider').oninput=()=>change({lengthMm:Number($('length-slider').value)});
function nudge(step){change({lengthMm:Math.max(50,Math.min(550,state.lengthMm+step))});}
document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>nudge(Number(b.dataset.step)));
for(const k of ['mirror1','mirror2'])$(k).onchange=()=>change({[k]:$(k).value});
$('task').onchange=()=>{const task=$('task').value;change({task,...(task==='plano'?{mirror1:'plane',mirror2:'r200',lengthMm:100}:task==='asymmetric'?{mirror1:'r200',mirror2:'r300',lengthMm:100}:{mirror1:'r200',mirror2:'r200',lengthMm:200})});};
$('probe').oninput=()=>change({probe:Number($('probe').value)});document.querySelectorAll('[data-probe]').forEach(b=>b.onclick=()=>change({probe:Number(b.dataset.probe)}));$('probe-waist').onclick=()=>{const v=simulate(state);if(v.waistPos!==null)change({probe:v.waistPos/state.lengthMm});};
$('hints').onchange=()=>change({hints:$('hints').checked},'理论参照已更新；辅助标记会保留。');
$('record').onclick=()=>{try{state=record(state);update();$('message').textContent='已记录镜组、腔长、状态及有效模式尺寸。';}catch(e){$('message').textContent=e.message;}};
$('undo').onclick=()=>change({records:state.records.slice(0,-1)},'已撤销末条记录。');for(const k of ['prediction','conclusion'])$(k).onchange=()=>change({[k]:$(k).value},'实验文字已保存。');
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.065);
function ray(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);}
renderer.domElement.addEventListener('pointerdown',e=>{if(!loaded||e.button!==0)return;ray(e);model.updateMatrixWorld(true);let node=raycaster.intersectObject(model,true).find(hit=>hit.object.visible)?.object;while(node&&node.name!=='Mirror2')node=node.parent;if(!node)return;const hit=raycaster.ray.intersectPlane(plane,new THREE.Vector3());if(!hit)return;drag={id:e.pointerId,x:hit.x,value:state.lengthMm};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);e.stopImmediatePropagation();$('scene').focus();},true);
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;ray(e);const hit=raycaster.ray.intersectPlane(plane,new THREE.Vector3());if(hit)queueLabChange(change,{lengthMm:Math.round(Math.max(50,Math.min(550,drag.value+(hit.x-drag.x)*1000)))},'镜座移动中，腔长以镜面顶点为基准。');});
function stop(){if(drag&&renderer.domElement.hasPointerCapture(drag.id))renderer.domElement.releasePointerCapture(drag.id);drag=null;controls.enabled=true;clearTimeout(drawTimer);}
for(const ev of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(ev,stop);
$('scene').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();nudge((e.key==='ArrowLeft'?-1:1)*(e.shiftKey?10:1));}};
installPlatformBridge({lab:'resonator',ready:()=>loaded,read:()=>({state}),restore:p=>{state=normalize(p.state);update();},render:()=>{update();renderer.render(scene,camera);},eye:'#eye',stop,applyConditions:c=>{state=applyConditions(state,c);update();}});
function disposeTree(root){const textures=new Set();root.traverse(o=>{o.geometry?.dispose();o.shadow?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;for(const value of Object.values(m))if(value?.isTexture)textures.add(value);m.dispose();}});for(const texture of textures)texture.dispose();}
new GLTFLoader().load('./assets/resonator-bench.glb',g=>{if(isLabDisposed()){disposeLabTree(g.scene);return;}if(disposed){disposeTree(g.scene);return;}model=g.scene;scene.add(model);finishPrecisionHardware(model);const floor=new THREE.Object3D();floor.position.y=-.8;presentation=installProductPresentation({scene,camera,renderer,model,focusModel:model.getObjectByName('Instrument'),controls,floor,name:'resonator'});loaded=true;$('loading').hidden=true;resize();update();parent.postMessage({type:'resonator-ready',version:1,lab:'resonator'},location.origin);},undefined,()=>{if(disposed)return;$('loading').textContent='模型加载失败，请使用平台重试。';parent.postMessage({type:'resonator-failed',version:1,lab:'resonator'},location.origin);});
function dispose(){if(disposed)return;disposed=true;loaded=false;stop();observer.disconnect();controls.dispose();presentation?.dispose();disposeTree(scene);scene.environment?.dispose();scene.background?.dispose?.();renderer.dispose();renderer.forceContextLoss();window.removeEventListener('pagehide',dispose);window.removeEventListener('wx-3d-dispose',dispose);}
window.addEventListener('pagehide',dispose,{once:true});window.addEventListener('wx-3d-dispose',dispose,{once:true});update();
