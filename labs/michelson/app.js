import {labSessionStorage as sessionStorage} from '../shared/lab-runtime.js';
import {manageLabScene,LabResizeObserver,scheduleLabFrame,setLabAnimationLoop,isLabDisposed,disposeLabTree,addLabCleanup} from '../shared/lab-runtime.js';
import {installProductPresentation} from '../shared/product-presentation.js';
let presentation;
import {addExperimentTable,frameExperimentTable} from '../shared/experiment-table.js';
import {installPlatformBridge} from '../shared/platform-bridge.js';
import * as THREE from 'three';
import {attachDirectControls} from './direct-controls.js';
import {installAccessories} from './accessories.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from '../shared/optimized-gltf-loader.js';
import {advance,ready,result,intensity,clamp} from './physics.mjs';
import {measurementIssue,restoreMeasurement,reading,REFERENCE_NM} from './measurement.mjs';
const $=id=>document.getElementById(id),key='wanxiang-michelson-v1';
const fresh=()=>({x:50,lamp:false,expanded:false,yaw:.45,pitch:.32,start:null,direction:0,reversed:false,assisted:false,records:[]});
let s=fresh(),running=0,model,nodes={},renderer,scene,camera,orbit,loaded=false,accessories; 
let restorationNotice = '';
try {
 const raw = sessionStorage.getItem(key);
 const restored = restoreMeasurement(raw);
 if (restored) {
  const {dropped, ...state} = restored;
  s = {...fresh(), ...state};
  restorationNotice = dropped ? '已恢复有效记录，忽略'+dropped+'组无效记录；请重新记录起点。' : '已恢复仪器设置与完成的记录，请重新记录起点。';
 } else if (raw) restorationNotice = '保存的数据无效，已使用初始设置；请重新测量。';
} catch { restorationNotice = '无法读取进度，请及时导出CSV。'; }
function save(){try{sessionStorage.setItem(key,JSON.stringify(s));}catch{$('message').textContent='浏览器无法保存进度，请及时导出CSV。';}}
const ctx=$('eye').getContext('2d'),pic=ctx.createImageData(320,320);
function observe(){
 if(s.lamp&&s.expanded){for(let y=0;y<320;y++)for(let x=0;x<320;x++){const i=(y*320+x)*4;const r=(x-160)/160,t=(y-160)/160;const v=Math.hypot(r,t)<1?intensity(r,t,s)*230:0;pic.data[i]=v;pic.data[i+1]=v*.13;pic.data[i+2]=v*.08;pic.data[i+3]=255;}ctx.putImageData(pic,0,0);}
 else{ctx.fillStyle='#060907';ctx.fillRect(0,0,320,320);if(s.lamp){for(const [x,y]of[[160,160],[160+s.yaw*95,160+s.pitch*95]]){const g=ctx.createRadialGradient(x,y,0,x,y,18);g.addColorStop(0,'#ff8066');g.addColorStop(.25,'#ef2515');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.fillRect(x-20,y-20,40,40);}}}
 ctx.strokeStyle='#ffffff70';ctx.beginPath();ctx.moveTo(154,160);ctx.lineTo(166,160);ctx.moveTo(160,154);ctx.lineTo(160,166);ctx.stroke();
}
const patterns=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
function syncModel(){if(!model)return;
 if(nodes.MOVING_CARRIAGE)nodes.MOVING_CARRIAGE.position.x=75+s.x;
 if(nodes.COARSE_WHEEL)nodes.COARSE_WHEEL.rotation.y=(s.x-50)*Math.PI*2;
 if(nodes.FINE_DRUM)nodes.FINE_DRUM.rotation.y=(s.x-50)*Math.PI*200;
 if(nodes.M2_FIXED_MIRROR_TILT){nodes.M2_FIXED_MIRROR_TILT.rotation.x=s.pitch*Math.PI/180;nodes.M2_FIXED_MIRROR_TILT.rotation.y=s.yaw*Math.PI/180;}
 const n=Math.round(s.x*10000).toString().padStart(7,'0');
 for(let p=0;p<7;p++)for(const seg of 'abcdefg'){const o=nodes[`READOUT_${p}_${seg}`];if(o){const on=patterns[Number(n[p])].includes(seg);o.visible=on;o.scale.setScalar(on?1:0);}}
}
function invalidate(message) {
 s.start=null;s.direction=0;s.reversed=false;$('count').value='';
 $('message').textContent=message;
}
function feedback() {
 const issue=measurementIssue(s,$('count').value,loaded);
 $('finish').disabled=!!issue;
 $('validation').textContent=issue||'数据有效，可以记录终点并计算。';
 $('validation').classList.toggle('warn',!!issue);
 $('count').setAttribute('aria-invalid',String($('count').value!==''&&(!Number.isSafeInteger(Number($('count').value))||Number($('count').value)<=0)));
 $('displacement').textContent=s.start===null?'—':Math.abs(reading(s.x)-s.start).toFixed(4)+' mm';
 $('direction').textContent=s.start===null?'待记录起点':s.reversed?'已反向 · 本组失效':s.direction>0?'正向':s.direction<0?'负向':'尚未移动';
 $('motion-state').textContent=running?(running>0?'正在正向连续微调':'正在负向连续微调'):'微调已停止';
 $('yaw-reading').textContent=s.yaw.toFixed(2)+'°';$('pitch-reading').textContent=s.pitch.toFixed(2)+'°';
 $('state').classList.toggle('warn',!ready(s));
}
function draw(){
 if(/^光源已/.test($('selected').textContent))$('selected').textContent=s.lamp?'光源已开启':'光源已关闭';
 if(/^扩束镜已/.test($('selected').textContent))$('selected').textContent=s.expanded?'扩束镜已移入光路':'扩束镜已移出光路';
 $('lamp').checked=s.lamp;$('expanded').checked=s.expanded;$('yaw').value=s.yaw;$('pitch').value=s.pitch;$('position').value=s.x;
 $('reading').textContent=s.x.toFixed(4);$('start-reading').textContent=s.start===null?'尚未记录起点':`起点 ${s.start.toFixed(4)} mm`;
 $('state').textContent=!s.lamp?'光源关闭':Math.hypot(s.yaw,s.pitch)>=.15?'光斑未重合，请调节镜架':!s.expanded?'光斑已重合，可放入扩束镜':'已对准 · 可观察中心条纹';
 const step=!s.lamp?1:Math.hypot(s.yaw,s.pitch)>=.15?2:!s.expanded?3:4;
 for(let i=1;i<=4;i++)$('step'+i).classList.toggle('active',i===step);
 $('start').disabled=!ready(s)||!loaded;feedback();
 $('assist-count').textContent=$('assist').checked&&s.start!==null?`理论条纹变化：${(2*Math.abs(s.x-s.start)/.0006328).toFixed(2)}（辅助值）`:'';
 if(s.reversed)$('message').textContent='检测到方向反转，请停止并重新记录起点，保持同向移动。';
 observe();syncModel();if(accessories)accessories.update(s,document.getElementById('lightpath').checked);
}
function records(){
 $('export').disabled=!s.records.length;
 $('rows').replaceChildren();s.records.forEach((r,i)=>{const tr=document.createElement('tr');for(const v of[i+1,r.a.toFixed(4),r.b.toFixed(4),r.n,r.wave.toFixed(2)]){const td=document.createElement('td');td.textContent=v;tr.append(td);}const review=document.createElement('td');const unusual=Math.abs(r.wave-REFERENCE_NM)/REFERENCE_NM>.05;review.textContent=unusual?'偏差>5% · 请复核':'已记录';review.className=unusual?'review-warning':'';tr.append(review);const td=document.createElement('td'),b=document.createElement('button');b.textContent='删除';b.onclick=()=>{s.records.splice(i,1);records();feedback();save();};td.append(b);tr.append(td);$('rows').append(tr);});
 if(!s.records.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=7;cell.textContent='完成对准后记录起点，开始第一组测量。';cell.className='table-note';row.append(cell);$('rows').append(row);}
 $('mean').textContent=s.records.length?`${s.records.length} 组平均波长 ${(s.records.reduce((a,r)=>a+r.wave,0)/s.records.length).toFixed(2)} nm`:'尚无测量记录';
}
function move(dx){
 advance(s,dx);
 if(s.reversed)running=0;
 if(s.x===0||s.x===100){running=0;$('message').textContent='已到行程端点。若需反向测量，请重新记录起点。';}
 draw();save();
}
for(const b of document.querySelectorAll('[data-dx]'))b.onclick=()=>{running=0;move(Number(b.dataset.dx));};
for(const id of['lamp','expanded','pitch','yaw'])$(id).oninput=()=>{running=0;s[id]=['lamp','expanded'].includes(id)?$(id).checked:Number($(id).value);invalidate('光学设置已改变。完成对准与扩束后，请重新记录起点。');draw();save();};
function home(){camera.position.set(.50,.46,.85);orbit.target.set(-.10,.18,.02);frameExperimentTable(scene,camera,orbit);orbit.update();}
function align(){running=0;s.assisted=true;s.yaw=0;s.pitch=0;invalidate('镜架已辅助对准。移入扩束镜后，请重新记录起点。');draw();save();}
 $('align').onclick=align;$('home').onclick=()=>{if(camera)home();};
 $('position').oninput=()=>{running=0;move(Number($('position').value)-s.x);};
 $('forward').onclick=()=>{running=1;draw();};$('backward').onclick=()=>{running=-1;draw();};$('stop').onclick=()=>{running=0;draw();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden){running=0;feedback();}});
 window.addEventListener('blur',()=>{running=0;feedback();});
 $('assist').onchange=()=>{if($('assist').checked)s.assisted=true;draw();};
 $('lightpath').onchange=draw;
 $('screen-view').onclick=()=>{if(camera){camera.position.set(-.035,.303,.43);orbit.target.set(-.035,.293,.185);orbit.update();}};
 $('adjust-view').onclick=()=>{if(camera){camera.position.set(.18,.25,.28);orbit.target.set(-.05,.20,.065);orbit.update();}};
 $('mirror-view').onclick=()=>{if(camera){camera.position.set(-.20,.43,-.38);orbit.target.set(-.035,.293,-.088);orbit.update();}};
 $('source-view').onclick=()=>{if(camera){camera.position.set(-.50,.46,.45);orbit.target.set(-.27,.24,0);orbit.update();}};
 $('start').onclick=()=>{if(!loaded||!ready(s))return;running=0;s.start=Number(s.x.toFixed(4));s.reversed=false;s.direction=0;$('count').value='';$('message').textContent='起点已记录。沿同一方向微调，手动数过中心的条纹后停止。';draw();save();};
 $('finish').onclick=()=>{running=0;try{const issue=measurementIssue(s,$('count').value,loaded);if(issue)throw Error(issue);const a=s.start,b=Number(s.x.toFixed(4)),n=Number($('count').value),wave=result(a,b,n);s.records.push({a,b,n,wave,assisted:s.assisted});s.start=null;s.direction=0;s.reversed=false;$('count').value='';records();$('message').textContent=`本组波长 ${wave.toFixed(2)} nm；可重新记录起点开始下一组。`;if(Math.abs(wave-REFERENCE_NM)/REFERENCE_NM>.05)$('message').textContent+=' 与参考光源偏差超过5%，请复核计数和读数；已保留本组。';save();draw();}catch(e){$('message').textContent=e.message;feedback();}};
 $('reset').onclick=()=>{running=0;const rows=s.records;s=fresh();s.records=rows;$('count').value='';$('message').textContent='仪器已复位，已保存的测量组保留。';draw();save();};
 $('export').onclick=()=>{if(!s.records.length){$('message').textContent='请先完成至少一组测量。';return;}const lines=['组次,起点_mm,终点_mm,条纹数,波长_nm,辅助',...s.records.map((r,i)=>[i+1,r.a.toFixed(4),r.b.toFixed(4),r.n,r.wave.toFixed(4),r.assisted?'是':'否'].join(','))];const url=URL.createObjectURL(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='迈克尔逊-测量记录.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('count').oninput=feedback;
$('help').onclick=()=>{running=0;feedback();$('help-dialog').showModal();};
$('help-close').onclick=()=>$('help-dialog').close();
$('scene').addEventListener('pointerdown',()=>$('scene').focus({preventScroll:true}),{capture:true});
$('scene').addEventListener('keydown',event=>{
 if(!loaded||!['ArrowLeft','ArrowRight'].includes(event.key))return;
 event.preventDefault();running=0;move((event.key==='ArrowRight'?1:-1)*.0001*(event.shiftKey?.1:1));
});
for(const id of ['home','adjust-view','mirror-view','source-view','screen-view']){
 const original=$(id).onclick;
 $(id).onclick=()=>{original();for(const other of ['home','adjust-view','mirror-view','source-view','screen-view']){$(other).classList.toggle('active',other===id);$(other).setAttribute('aria-pressed',String(other===id));}};
}
$('home').classList.add('active');
records();draw();if(restorationNotice)$('message').textContent=restorationNotice;
try{
 const host=$('scene');scene=new THREE.Scene();scene.background=new THREE.Color('#353B44');camera=new THREE.PerspectiveCamera(38,1,.001,20);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 orbit=new OrbitControls(camera,renderer.domElement);manageLabScene({renderer,scene,controls:orbit});orbit.enableDamping=true;orbit.minDistance=.25;orbit.maxDistance=1.8;home();
 scene.add(new THREE.HemisphereLight(0xffffff,0x668177,3));for(const p of [[1,2,1],[-1,1,-1]]){const l=new THREE.DirectionalLight(0xffffff,2);l.position.set(...p);scene.add(l);}
 const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();};new LabResizeObserver(resize).observe(host);resize();
 new GLTFLoader().load('assets/michelson-product.glb',g=>{if(isLabDisposed()){disposeLabTree(g.scene);return;}model=g.scene;scene.add(model);model.traverse(o=>{nodes[o.name]=o;if(o.isMesh){o.castShadow=false;o.frustumCulled=false;}});installAccessories(scene,model,$('eye')).then(value=>{if(isLabDisposed()){disposeLabTree(value.group);return;}accessories=value;addExperimentTable(scene,[model,accessories.group]);presentation=installProductPresentation({scene,camera,renderer,model:[model,accessories.group],controls:orbit,upAxis:'y',name:'michelson'});home();loaded=true;$('loading').remove();draw();parent.postMessage({type:'michelson-ready'},location.origin);}).catch(error=>{$('loading').textContent='光源组件加载失败，请刷新重试。';parent.postMessage({type:'michelson-failed'},location.origin);console.error(error);});},undefined,()=>{loaded=false;$('loading').textContent='仪器加载失败，请刷新重试。';parent.postMessage({type:'michelson-failed'},location.origin);});
 attachDirectControls({canvas:renderer.domElement,camera,orbit,objects:()=>[...(model?[model]:[]),...(accessories?[accessories.group]:[])],
 onSelect:text=>{$('selected').textContent=text;},
 onMove:dx=>{running=0;move(dx);},
 onTilt:(dx,dy)=>{running=0;s.yaw=clamp(s.yaw+dx,-1,1);s.pitch=clamp(s.pitch+dy,-1,1);invalidate('镜架已调节，请完成对准后重新记录起点。');draw();save();},
 onToggle:key=>{running=0;s[key]=!s[key];invalidate('光学设置已改变，请重新记录起点。');draw();save();$('selected').textContent=key==='lamp'?(s.lamp?'光源已开启':'光源已关闭'):(s.expanded?'扩束镜已移入光路':'扩束镜已移出光路');}
 });
 let last=performance.now();function animate(t){scheduleLabFrame(animate,()=>!!running);if(document.hidden)return;const dt=Math.min((t-last)/1000,.05);last=t;if(running&&loaded)move(running*Number($('speed').value)*dt);orbit.update();(presentation?presentation.render():renderer.render(scene,camera));}scheduleLabFrame(animate,()=>!!running);
}catch(e){$('loading').textContent='无法启动三维视图，请使用支持 WebGL 的浏览器。';parent.postMessage({type:'michelson-failed'},location.origin);console.error(e);}

installPlatformBridge({lab:'michelson',ready:()=>loaded,read:()=>({state:s}),
 stop:()=>{running=0;},restore:data=>{s={...fresh(),...data.state};$('count').value='';records();draw();save();$('message').textContent='已恢复仪器和完成记录；进行中的计数请重新记录起点。';},
 render:()=>{draw();(presentation?presentation.renderSnapshot():renderer.render(scene,camera));},eye:'#eye'});
