import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {queueLabChange,manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup} from '../shared/lab-runtime.js';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';
import {installProductPresentation} from '../shared/product-presentation.js';
import {installPrecisionRig,visibleHit} from '../shared/precision-rig.js';
import {frameExperimentTable} from '../shared/experiment-table.js';
import {installPlatformBridge} from '../shared/platform-bridge.js';
import {installPartDrag} from '../shared/part-drag.js?v=20261117-scroll';
import {applyConditions} from './conditions.mjs';
import {MODEL,EYEPIECES,fresh,normalize,changeSettings,simulate,record,report} from './physics.mjs';
const $=id=>document.getElementById(id),SESSION='wx-telescope-session-v1';
let state=fresh(),loaded=false,disposed=false,model,presentation,rig,drag,lastView='overall',drawTimer=0;
let initialMessage='先预测成像方向，再调节目镜。';
try{const raw=sessionStorage.getItem(SESSION);if(raw){const saved=JSON.parse(raw);if(saved.version!==1)throw Error();state=normalize(saved.state);}}catch{initialMessage='临时状态无法恢复，请导入实验JSON；原临时数据尚未被改写。';}
for(const [key,value] of Object.entries(EYEPIECES)){const option=document.createElement('option');option.value=key;option.textContent=value.label;$('eyepiece').append(option);}
const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.outputColorSpace=T.SRGBColorSpace;$('scene').append(renderer.domElement);
const camera=new T.PerspectiveCamera(35,1,.002,10),controls=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:controls,release:false});
controls.minDistance=.08;controls.maxDistance=3;controls.maxPolarAngle=Math.PI*.49;
const rays=new T.Group(),pupil=new T.Group();scene.add(rays,pupil);
function disposeTree(root){const textures=new Set();root.traverse(o=>{o.geometry?.dispose();o.shadow?.dispose();for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}});for(const t of textures)t.dispose();}
function clear(group){disposeTree(group);group.clear();}
function render(){if(disposed||!loaded||document.hidden||!$('scene').clientWidth)return;clearTimeout(drawTimer);presentation?.render();drawTimer=setTimeout(()=>{if(!disposed&&!document.hidden&&$('scene').clientWidth)presentation?.render();},45);}
function view(which){lastView=which;const x=.08+state.lengthMm/1000;
 if(which==='overall'){controls.target.set(.22,.075,0);const half=Math.atan(Math.tan(T.MathUtils.degToRad(17.5))*Math.min(camera.aspect,1));camera.position.copy(controls.target).addScaledVector(new T.Vector3(-.5,.65,1.4).normalize(),.235/Math.sin(half));}
 else if(which==='eye'){controls.target.set(x,.085,0);camera.position.copy(controls.target).add(new T.Vector3(.13,.15,.24));}
 else{controls.target.set(.24,.105,0);camera.position.set(.24,.15,.69);cutaway(true);}if(which==='overall'&&model)frameExperimentTable(scene,camera,controls);controls.update();render();}
function cutaway(value){$('cutaway').setAttribute('aria-pressed',String(value));$('cutaway').textContent=value?'教学剖切':'完整外观';rig?.setCutaway(value);update();}
$('cutaway').onclick=()=>cutaway($('cutaway').getAttribute('aria-pressed')!=='true');
function resize(){const r=$('scene').getBoundingClientRect();if(!r.width||!r.height||disposed)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();render();}
const observer=new LabResizeObserver(resize);observer.observe($('scene'));controls.addEventListener('change',render);
for(const [id,which] of [['overall','overall'],['eye-view','eye'],['side-view','side']])$(id).onclick=()=>view(which);
function line(group,points,color,dashed=false){const material=dashed?new T.LineDashedMaterial({color,dashSize:.003,gapSize:.002}):new T.LineBasicMaterial({color});const o=new T.Line(new T.BufferGeometry().setFromPoints(points.map(p=>new T.Vector3(...p))),material);if(dashed)o.computeLineDistances();group.add(o);}
function optics(v){clear(rays);clear(pupil);const x=.08+state.lengthMm/1000;
 for(const r of v.rays.filter((_,i)=>i%4===0)){const y=.105+r.height/1000,ey=.105+r.heightAtEye/1000;line(rays,[[.023,y-r.angle*.057,0],[.08,y,0],[x,ey,0],...(!r.blocked?[[x+.06,ey+r.slopeOut*.06,0]]:[])],0xc97738);}
 if(state.hints){const z=v.pupilDistance/1000,r=v.pupilDiameter/2000;const points=Array.from({length:65},(_,i)=>[x+z,.105+r*Math.cos(i*Math.PI/32),r*Math.sin(i*Math.PI/32)]);line(pupil,points,0x347fb1,v.pupilType==='virtual');
  for(const sign of [-1,1]){const slope=-sign*state.apertureMm/2/state.lengthMm;line(pupil,[[.08,.105+sign*state.apertureMm/2000,0],[x,.105,0],[x+.08,.105+slope*.08,0]],0x347fb1);if(v.pupilType==='virtual')line(pupil,[[x,.105,0],[x+z,.105+slope*z,0]],0x347fb1,true);}
 }
 rig?.update(state);rays.visible=$('cutaway').getAttribute('aria-pressed')==='true';pupil.visible=rays.visible;
}
function observation(v){const c=$('eye').getContext('2d'),fontScale=Math.min(2.3,Math.max(1,800/Math.max(320,$('eye').clientWidth)));c.fillStyle='#f8faf7';c.fillRect(0,0,800,340);const px=m=>50+(m+40)*700/80;
 c.font=17*fontScale+'px sans-serif';c.fillStyle='#33584b';c.fillText('裸眼目标',16,40);c.fillText('目镜后角分布',16,145);
 for(const [y,center,spread,color] of [[72,state.targetMrad,.12,'#547a60'],[190,v.angularCenterMrad,v.angularSpreadMrad,'#c97738']]){
  c.strokeStyle='#b6c9be';c.beginPath();c.moveTo(50,y);c.lineTo(750,y);c.stroke();if(center!==null){const half=Math.max(.08,spread/2),a=Math.max(50,px(center-half)),b=Math.min(750,px(center+half));if(b>=a){c.fillStyle=color;c.fillRect(a,y-20,Math.max(2,b-a),40);}}
 }
 c.fillStyle='#405b50';c.font=14*fontScale+'px sans-serif';c.textAlign='center';for(let m=-40;m<=40;m+=5){const x=px(m);c.fillRect(x,250,1,m%10===0?14:7);if(m%(fontScale>2?20:10)===0)c.fillText(String(m),x,284);}c.fillText('角度 / mrad（同一固定刻度）',400,327);c.textAlign='start';
 const x=px(state.readingMrad);c.strokeStyle='#bb334f';c.beginPath();c.moveTo(x,153);c.lineTo(x,272);c.stroke();c.fillStyle='#bb334f';c.fillText(state.readingMrad.toFixed(1),Math.min(710,Math.max(50,x+5)),239);
}
function update(persist=false){const v=simulate(state);
 for(const key of ['eyepiece','lengthMm','apertureMm','targetMrad','readingMrad','task','prediction','conclusion'])if(document.activeElement!==$(key))$(key).value=state[key];$('length-slider').value=state.lengthMm;$('hints').checked=state.hints;
 $('distance').textContent=state.lengthMm.toFixed(1);$('status').textContent=v.afocal?'无焦 / 已调焦':'离焦';$('magnification').textContent=v.magnification===null?'—':v.magnification.toFixed(2)+'×';
 $('reason').textContent=v.afocal?(v.orientation==='upright'?'凹目镜：正立观察像，虚出瞳位于目镜内侧。':'凸目镜：倒立观察像，具有中间实像。'):'出射光束未平行，请继续调节目镜。离焦时不把设计倍率当作实际倍率。';
 $('hint-text').textContent=state.hints?`理论无焦间距 ${v.afocalLength} mm；出瞳 ${v.pupilDistance.toFixed(2)} mm，直径 ${v.pupilDiameter.toFixed(2)} mm。`:'提示关闭；原始读数由你在观察窗选择。';
 $('instruction').textContent={focus:'先预测方向，再记录调焦点和两侧。点击观察窗选取角度，比较读数与目标角。',compare:'分别换用凸、凹目镜并重新调焦，比较角倍率的正负及出瞳位置。',aperture:'保持同一离焦间距，改变孔径，比较角分布展宽；调焦后再次比较。'}[state.task];
 const data=report(state);$('columns').replaceChildren(...data.columns.map(value=>{const th=document.createElement('th');th.textContent=value;return th;}));$('rows').replaceChildren(...data.rows.map(row=>{const tr=document.createElement('tr');for(const value of row){const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;}));$('count').textContent=state.records.length;$('empty').hidden=!!state.records.length;$('undo').disabled=!state.records.length;$('record').disabled=!loaded;$('statistics').textContent=data.summaries[0];
 optics(v);observation(v);render();if(persist)try{sessionStorage.setItem(SESSION,JSON.stringify({version:1,state}));}catch{$('message').textContent='临时保存失败，请导出实验JSON。';}
}
function change(patch,message='当前条件已更新，已有记录保持不变。'){try{state=changeSettings(state,patch);update(true);$('message').textContent=message;}catch(e){$('message').textContent=e.message;for(const key of Object.keys(patch))if($(key))$(key).value=state[key];}}
for(const key of ['lengthMm','apertureMm','targetMrad','readingMrad']){$(key).onchange=()=>{if(!$(key).value.trim()){$('message').textContent='请输入有效数值。';$(key).value=state[key];return;}change({[key]:Number($(key).value)});};$(key).onkeydown=e=>{if(e.key==='Enter')$(key).blur();};}
$('length-slider').oninput=()=>change({lengthMm:Number($('length-slider').value)});
for(const key of ['task','eyepiece','prediction','conclusion'])$(key).onchange=()=>change({[key]:$(key).value});$('hints').onchange=()=>change({hints:$('hints').checked});
const nudge=step=>change({lengthMm:Math.round(Math.max(100,Math.min(300,state.lengthMm+step))*10)/10});
document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>nudge(Number(b.dataset.step)));
$('eye').onclick=e=>{const r=$('eye').getBoundingClientRect(),x=(e.clientX-r.left)/r.width*800;change({readingMrad:Math.round(Math.max(-40,Math.min(40,(x-50)/700*80-40))*10)/10},'已选取角度读数，点击记录保存。');};
$('record').onclick=()=>{try{state=record(state);update(true);$('message').textContent='已保存手动角读数与完整条件。';}catch(e){$('message').textContent=e.message;}};$('undo').onclick=()=>change({records:state.records.slice(0,-1)});
function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save').onclick=()=>download(JSON.stringify({version:1,lab:'telescope',model:MODEL,state:normalize(state)},null,2),'application/json','望远镜实验.json');
$('csv').onclick=()=>{const data=report(state),quote=v=>'"'+String(v).replaceAll('"','""')+'"';download('\ufeff'+[data.columns,...data.rows].map(row=>row.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8','望远镜读数.csv');};
$('restore').onclick=()=>$('file').click();$('file').onchange=async()=>{const file=$('file').files[0];if(!file)return;try{if(file.size>2e6)throw Error('档案超过2 MB。');const v=JSON.parse(await file.text());if(v.version!==1||v.lab!=='telescope'||v.model!==MODEL)throw Error('档案身份或版本不支持。');const clean=normalize(v.state);state=clean;update(true);$('message').textContent='实验已恢复。';}catch(e){$('message').textContent='导入失败：'+e.message;}finally{$('file').value='';}};
const caster=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),-.05);
function ray(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);camera.updateMatrixWorld();caster.setFromCamera(pointer,camera);}
renderer.domElement.addEventListener('pointerdown',e=>{if(!loaded||e.button!==0)return;ray(e);model.updateMatrixWorld(true);let node=visibleHit(caster.intersectObject(model,true))?.object;while(node&&node.name!=='Eyepiece')node=node.parent;if(!node)return;const hit=caster.ray.intersectPlane(plane,new T.Vector3());if(!hit)return;drag={id:e.pointerId,x:hit.x,value:state.lengthMm};controls.enabled=false;renderer.domElement.setPointerCapture(e.pointerId);e.stopImmediatePropagation();$('scene').focus();},true);
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;ray(e);const hit=caster.ray.intersectPlane(plane,new T.Vector3());if(hit)queueLabChange(change,{lengthMm:Math.round(Math.max(100,Math.min(300,drag.value+(hit.x-drag.x)*1000))*10)/10});});
function stop(){if(drag&&renderer.domElement.hasPointerCapture(drag.id))renderer.domElement.releasePointerCapture(drag.id);drag=null;controls.enabled=true;if(disposed||document.hidden)clearTimeout(drawTimer);}
function changeAperture(value){change({apertureMm:Math.round(Math.max(5,Math.min(20,value)))},'孔径已更新，观察窗与侧栏已同步。');}
installPartDrag({renderer,camera,controls,model:()=>model,resolvePart(object){
 let node=object;while(node&&node.name!=='Aperture'&&!node.name.startsWith('IrisLeaf_'))node=node.parent;
 if(!node)return null;
 return {start(event){const y=event.clientY,value=state.apertureMm;return event=>queueLabChange(changeAperture,value+(y-event.clientY)*.1);},wheel:event=>changeAperture(state.apertureMm-Math.sign(event.deltaY))};
}});
renderer.domElement.title='拖动目镜沿光轴调焦；上下拖动物镜孔径边缘调孔径。';
const apertureHint=document.createElement('p');apertureHint.className='fine';apertureHint.textContent=renderer.domElement.title;$('scene').after(apertureHint);
for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,stop);
$('scene').onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();nudge((e.key==='ArrowLeft'?-1:1)*(e.shiftKey?10:1));}};
installPlatformBridge({lab:'telescope',ready:()=>loaded,read:()=>({state}),restore:p=>{state=normalize(p.state);update(true);},render:()=>{update();renderer.render(scene,camera);},eye:'#eye',stop,applyConditions:c=>{state=applyConditions(state,c);update(true);}});
new GLTFLoader().load('./assets/telescope-bench.glb',g=>{if(isLabDisposed()){disposeLabTree(g.scene);return;}if(disposed){disposeTree(g.scene);return;}model=g.scene;scene.add(model);rig=installPrecisionRig(model,{lab:'telescope'});presentation=installProductPresentation({scene,camera,renderer,model,controls,name:'telescope',backdrop:'industrial',experimentTable:true});loaded=true;$('loading').hidden=true;resize();update();parent.postMessage({type:'telescope-ready',version:1,lab:'telescope'},location.origin);},undefined,()=>{if(!disposed){$('loading').textContent='模型加载失败，请重新打开实验。';parent.postMessage({type:'telescope-failed',version:1,lab:'telescope'},location.origin);}});
function dispose(){if(disposed)return;disposed=true;loaded=false;stop();observer.disconnect();controls.dispose();presentation?.dispose();disposeTree(scene);scene.environment?.dispose();scene.background?.dispose?.();renderer.dispose();renderer.forceContextLoss();window.removeEventListener('pagehide',dispose);window.removeEventListener('wx-3d-dispose',dispose);}
window.addEventListener('pagehide',dispose,{once:true});window.addEventListener('wx-3d-dispose',dispose,{once:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else render();});
const eyeObserver=new LabResizeObserver(()=>{if(!disposed)observation(simulate(state));});eyeObserver.observe($('eye'));window.addEventListener('wx-3d-dispose',()=>eyeObserver.disconnect(),{once:true});window.addEventListener('pagehide',()=>eyeObserver.disconnect(),{once:true});
view('overall');update();$('message').textContent=initialMessage;
