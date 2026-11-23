import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {queueLabChange,manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup} from '../shared/lab-runtime.js';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';
import {installProductPresentation} from '../shared/product-presentation.js';
import {installPrecisionRig,visibleHit} from '../shared/precision-rig.js';
import {frameExperimentTable} from '../shared/experiment-table.js';
import {installPlatformBridge} from '../shared/platform-bridge.js';
import {applyConditions} from './conditions.mjs';
import {MODEL,fresh,normalize,settings,simulate,ray,changeSettings,record,report} from './physics.mjs';
import {paintSpot,paintFan,pointFromCanvas} from './observation.mjs';
const $=id=>document.getElementById(id),SESSION='wx-aberration-session-v1';
let state=fresh(),model,presentation,rig,loaded=false,disposed=false,drag=null,timer=0,lastView='overall',opticalKey='',plotKey='',initialMessage='先预测孔径改变会如何影响光斑，再记录。';
try{const raw=sessionStorage.getItem(SESSION);if(raw){const v=JSON.parse(raw);if(v.version!==1)throw Error();state=normalize(v.state);}}catch{initialMessage='临时状态无法恢复，请导入实验JSON。原临时数据尚未改写。';}
const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.outputColorSpace=T.SRGBColorSpace;$('scene').append(renderer.domElement);
const camera=new T.PerspectiveCamera(35,1,.001,10),controls=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:controls,release:false});controls.minDistance=.08;controls.maxDistance=2;controls.maxPolarAngle=Math.PI*.49;
const beams=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0x83a843,transparent:true,opacity:.65,depthTest:true}));scene.add(beams);
const spots=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:0x247962,size:.00015,sizeAttenuation:true}));scene.add(spots);
function disposeTree(root){const textures=new Set();root.traverse(o=>{o.geometry?.dispose();o.shadow?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}});for(const t of textures)t.dispose();}
function render(){if(disposed||!loaded||document.hidden||!$('scene').clientWidth)return;clearTimeout(timer);presentation?.render();timer=setTimeout(()=>{if(!disposed&&!document.hidden&&$('scene').clientWidth)presentation?.render();},45);}
function view(v){lastView=v;if(v==='overall'){controls.target.set(.17,.07,0);const half=Math.atan(Math.tan(T.MathUtils.degToRad(17.5))*Math.min(camera.aspect,1));camera.position.copy(controls.target).addScaledVector(new T.Vector3(-.75,.85,1.1).normalize(),.27/Math.sin(half));}else if(v==='iris'){controls.target.set(.14,.105,0);camera.position.set(.035,.17,.15);}else{controls.target.set(.34,.10,0);camera.position.set(.23,.18,.19);}if(v==='overall'&&model)frameExperimentTable(scene,camera,controls);controls.update();render();}
for(const [id,v] of [['overall','overall'],['iris-view','iris'],['screen-view','screen']])$(id).onclick=()=>view(v);
function resize(){const r=$('scene').getBoundingClientRect();if(!r.width||!r.height||disposed)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render();}
const observer=new LabResizeObserver(resize);observer.observe($('scene'));controls.addEventListener('change',render);
function geometry(object,positions){object.geometry.dispose();object.geometry=new T.BufferGeometry();object.geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));object.geometry.computeBoundingSphere();}
function updateOptics(){
 if(!model)return;const key=JSON.stringify(settings(state));if(key===opticalKey)return;opticalKey=key;
 rig.update(state);
 const lines=[],points=[],toWorld=(z,x,y)=>[.14+z/1000,.105+y/1000,-x/1000];
 // Sparse spatial rays show pupil sampling, NOT an exaggerated blur.
 for(const radius of [.35,.7,1])for(let i=0;i<12;i++){
  const a=state.apertureMm/20,t=i*Math.PI/6,p=ray(state,a*radius*Math.cos(t),a*radius*Math.sin(t));
  lines.push(...toWorld(-115,p.pupilX-115*state.field*.01,p.pupilY),...toWorld(0,p.pupilX,p.pupilY),...toWorld(0,p.pupilX,p.pupilY),...toWorld(p.screenZ,p.screenX,p.screenY));
 }
 for(const p of simulate(state).rays)points.push(...toWorld(p.screenZ-.15,p.screenX,p.screenY));
 geometry(beams,lines);geometry(spots,points);
}
function update(persist=false){
 for(const k of ['apertureMm','field','screenOffsetMm','spherical','coma','readingUm','task','prediction','conclusion'])if(document.activeElement!==$(k))$(k).value=state[k]??'';
 $('aperture-slider').value=state.apertureMm;$('hints').checked=state.hints;
 $('diameter').textContent=state.apertureMm.toFixed(1);$('distance').textContent=(200+state.screenOffsetMm).toFixed(1);$('field-value').textContent=state.field.toFixed(2);
 $('instruction').textContent={spherical:'纯球差：保持视场0，记录至少三种孔径；比较斑缘与RMS的变化。',coma:'纯彗差：保持孔径，比较负、零、正视场；用同一侧斑缘读数。',focus:'固定孔径和系数，在不同屏幕位置比较光斑；不要自动把最小斑认作衍射极限。'}[state.task];
 const r=simulate(state);$('hint-text').textContent=state.hints?`理论质心X ${r.centroidXUm.toFixed(2)} μm；质心RMS ${r.rmsUm.toFixed(2)} μm。`:'理论提示关闭；使用辅助的标记会保留。';
 updateOptics();const key=JSON.stringify([settings(state),state.hints,$('range').value]);if(key!==plotKey){plotKey=key;paintSpot($('eye'),state,Number($('range').value),state.hints);paintFan($('fan'),state,Number($('range').value));}
 const d=report(state);$('columns').replaceChildren(...d.columns.map(v=>{const e=document.createElement('th');e.textContent=v;return e;}));$('rows').replaceChildren(...d.rows.map(row=>{const tr=document.createElement('tr');for(const v of row){const td=document.createElement('td');td.textContent=v;tr.append(td);}return tr;}));$('statistics').textContent=d.summaries[0];$('count').textContent=state.records.length;$('empty').hidden=!!state.records.length;$('undo').disabled=!state.records.length;$('record').disabled=!loaded;render();
 if(persist)try{sessionStorage.setItem(SESSION,JSON.stringify({version:1,state}));}catch{$('message').textContent='临时保存失败，请导出实验JSON。';}
}
function change(p,message='当前条件已更新；历史记录保留。'){try{state=changeSettings(state,p);update(true);$('message').textContent=message;}catch(e){$('message').textContent=e.message;for(const k of Object.keys(p))if($(k))$(k).value=state[k]??'';}}
for(const k of ['apertureMm','field','screenOffsetMm','spherical','coma','readingUm']){$(k).onchange=()=>change({[k]:$(k).value.trim()?Number($(k).value):(k==='readingUm'?null:NaN)});$(k).onkeydown=e=>{if(e.key==='Enter')$(k).blur();};}
for(const k of ['task','prediction','conclusion'])$(k).onchange=()=>change({[k]:$(k).value});
$('preset').onchange=()=>{const p={ideal:{spherical:0,coma:0,field:0},spherical:{spherical:2,coma:0,field:0},coma:{spherical:0,coma:2,field:1}}[$('preset').value];if(p)change({...p,screenOffsetMm:0});$('preset').value='custom';};
$('hints').onchange=()=>change({hints:$('hints').checked});$('aperture-slider').oninput=()=>change({apertureMm:Number($('aperture-slider').value)});$('range').onchange=()=>change({readingUm:null});
const nudge=step=>change({screenOffsetMm:Math.round(Math.max(-3,Math.min(3,state.screenOffsetMm+step))*10)/10});document.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>nudge(Number(b.dataset.screen)));
$('eye').onclick=e=>{const b=$('eye').getBoundingClientRect(),p=pointFromCanvas((e.clientX-b.left)*600/b.width,(e.clientY-b.top)*600/b.height,Number($('range').value));if(p)change({readingUm:Math.round(p.xUm*10)/10},'已读取所选位置的横向坐标；请确认采用的光斑特征。');};
$('record').onclick=()=>{try{state=record(state);update(true);$('message').textContent='已记录实际手动读数和当前条件。';}catch(e){$('message').textContent=e.message;}};$('undo').onclick=()=>change({records:state.records.slice(0,-1)});
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save').onclick=()=>download(JSON.stringify({version:1,lab:'aberration',model:MODEL,state:normalize(state)},null,2),'application/json','像差实验.json');$('csv').onclick=()=>{const d=report(state),quote=v=>'"'+String(v).replaceAll('"','""')+'"';download('\ufeff'+[d.columns,...d.rows].map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','像差测量.csv');};
$('restore').onclick=()=>$('file').click();$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;try{if(f.size>2e6)throw Error('档案超过2 MB。');const v=JSON.parse(await f.text());if(v.version!==1||v.lab!=='aberration'||v.model!==MODEL)throw Error('身份或版本不支持。');state=normalize(v.state);update(true);$('message').textContent='实验已恢复。';}catch(e){$('message').textContent='导入失败：'+e.message;}finally{$('file').value='';}};
const caster=new T.Raycaster(),pointer=new T.Vector2();
renderer.domElement.addEventListener('pointerdown',e=>{if(!loaded||e.button!==0)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);camera.updateMatrixWorld();model.updateMatrixWorld(true);caster.setFromCamera(pointer,camera);let hit=visibleHit(caster.intersectObject(model,true))?.object;while(hit&&!['ApertureLever','ScreenCarrier','ScreenKnob','FieldKnob'].includes(hit.name))hit=hit.parent;if(!hit)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,kind:hit.name,aperture:state.apertureMm,field:state.field,offset:state.screenOffsetMm};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);e.stopImmediatePropagation();$('scene').focus();},true);
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y,limit=(v,a,b)=>Math.max(a,Math.min(b,v));if(drag.kind==='ApertureLever')queueLabChange(change,{apertureMm:Math.round(limit(drag.aperture-dy*.1,4,20)*10)/10});else if(drag.kind==='FieldKnob')queueLabChange(change,{field:Math.round(limit(drag.field-dy*.01,-1,1)*100)/100});else queueLabChange(change,{screenOffsetMm:Math.round(limit(drag.offset+dx*.02,-3,3)*100)/100});});
function stop(){const current=drag;drag=null;if(current&&renderer.domElement.hasPointerCapture(current.id))renderer.domElement.releasePointerCapture(current.id);controls.enabled=true;if(disposed||document.hidden)clearTimeout(timer);}
for(const ev of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(ev,stop);$('scene').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();nudge((e.key==='ArrowRight'?1:-1)*(e.shiftKey?1:.1));}};
installPlatformBridge({lab:'aberration',ready:()=>loaded,read:()=>({state}),restore:p=>{state=normalize(p.state);update(true);},render:()=>{update();renderer.render(scene,camera);},eye:'#eye',stop,applyConditions:c=>{state=applyConditions(state,c);update(true);}});
new GLTFLoader().load('./assets/aberration-bench.glb',g=>{if(isLabDisposed()){disposeLabTree(g.scene);return;}if(disposed){disposeTree(g.scene);return;}model=g.scene;scene.add(model);rig=installPrecisionRig(model,{lab:'aberration'});presentation=installProductPresentation({scene,camera,renderer,model,controls,name:'aberration',backdrop:'industrial',experimentTable:true});loaded=true;$('loading').hidden=true;resize();update();parent.postMessage({type:'aberration-ready',version:1,lab:'aberration'},location.origin);},undefined,()=>{if(!disposed){$('loading').textContent='模型加载失败，请重新打开实验。';parent.postMessage({type:'aberration-failed',version:1,lab:'aberration'},location.origin);}});
function dispose(){if(disposed)return;disposed=true;loaded=false;stop();observer.disconnect();controls.dispose();presentation?.dispose();disposeTree(scene);scene.environment?.dispose();scene.background?.dispose?.();renderer.dispose();renderer.forceContextLoss();window.removeEventListener('pagehide',dispose);window.removeEventListener('wx-3d-dispose',dispose);}
window.addEventListener('pagehide',dispose,{once:true});window.addEventListener('wx-3d-dispose',dispose,{once:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else render();});view('overall');update();$('message').textContent=initialMessage;
