import * as THREE from 'three';
import {defaults,validateConditions,modeNames,elementNames,microscopeIntensity} from './conditions.mjs?v=jones-20260929';
import {HLP,VLP,LP45,LPn45,RCP,LCP} from './engine.mjs?v=jones-20260929';
const presets={HLP,VLP,LP45,LPn45,RCP,LCP};
const inputNames={HLP:'水平线偏振',VLP:'竖直线偏振',LP45:'45°线偏振',LPn45:'−45°线偏振',RCP:'圆偏振 S₃=+1',LCP:'圆偏振 S₃=−1'};
export function setupExtensions(scene,change){
 const group=new THREE.Group();scene.add(group);const root=document.getElementById('extension-controls'),select=document.getElementById('experiment-mode');
 let current=null,lastGeometry='';const cache=new Map();
 select.onchange=()=>{if(current)cache.set(current.mode,current);change({extension:select.value==='bench'?null:cache.get(select.value)||defaults(select.value)});};
 const patch=p=>change({extension:validateConditions({...current,...p})});
 function field(parent,label,value,onChange,min,max,step=.5){const wrap=document.createElement('label');wrap.textContent=label;const input=document.createElement('input');input.type='number';input.value=value;input.min=min;input.max=max;input.step=step;input.style.cssText='width:90px;float:right';input.onchange=()=>{try{onChange(Number(input.value));}catch(e){document.getElementById('message').textContent=e.message;input.value=value;}};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.onchange();}};wrap.append(input);parent.append(wrap);}
 function check(label,key){const wrap=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=current[key];input.onchange=()=>patch({[key]:input.checked});wrap.append(input,document.createTextNode(label));root.append(wrap);}
 function addField(label,key,min,max,step){field(root,label,current[key],value=>patch({[key]:value}),min,max,step);}
 function drawDiagram(c){
  const chain=c.mode==='basic'?c.elements:c.mode==='babinet_soleil'?[...(c.measuring?[{type:'未知波片',angle:0}]:[]),{type:'BS补偿器',angle:c.bsAngle},...(c.measuring?[{type:'检偏器',angle:135}]:[])]:c.mode==='measurement'?[...(c.useQWP?[{type:'QWP',angle:c.qwpAngle}]:[]),{type:'检偏器',angle:c.polarizerAngle}]:c.mode==='depolarization'?[{type:'统计退偏',angle:0}]:[{type:'聚光',angle:0},{type:'晶片',angle:0},{type:'正交检偏',angle:90}];
  const signature=JSON.stringify(chain);if(signature===lastGeometry)return;lastGeometry=signature;
  group.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});group.clear();
  const beam=new THREE.Mesh(new THREE.BoxGeometry(1.1,.003,.003),new THREE.MeshBasicMaterial({color:0xdca94d}));beam.position.set(.6,.13,0);group.add(beam);
  const shown=chain.length?chain:[{type:'无元件',angle:0}];shown.forEach((e,i)=>{const x=.15+(i+1)/(shown.length+1)*.9;const mesh=new THREE.Mesh(new THREE.BoxGeometry(.012,.09,.09),new THREE.MeshStandardMaterial({color:e.type==='polarizer'||e.type==='检偏器'?0x387567:0x7b90ac,transparent:true,opacity:.65,metalness:.1,roughness:.4}));mesh.position.set(x,.13,0);mesh.rotation.x=e.angle*Math.PI/180;group.add(mesh);const marker=new THREE.Mesh(new THREE.BoxGeometry(.015,.004,.08),new THREE.MeshBasicMaterial({color:0xffffff}));marker.rotation.x=mesh.rotation.x;marker.position.copy(mesh.position);group.add(marker);
   const label=document.createElement('canvas');label.width=256;label.height=64;const ctx=label.getContext('2d');ctx.fillStyle='#eef4ef';ctx.fillRect(0,0,256,64);ctx.fillStyle='#244e46';ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText(`${i+1}. ${elementNames[e.type]||e.type}`,128,25);ctx.fillText(`${e.angle}°`,128,53);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(label)}));sprite.position.set(x,.25+(i%2)*.04,0);sprite.scale.set(.16,.04,1);group.add(sprite);});
 }
 function update(c){current=c;select.value=c?.mode||'bench';group.visible=!!c;root.hidden=!c;root.replaceChildren();if(!c)return;drawDiagram(c);
  const note=document.createElement('p');note.textContent='扩展模式：三维计算光路示意，非新增实物仪器。强度以本模式入射光为1；退偏使用Mueller–Stokes统计模型。';root.append(note);
  if(['basic','babinet_soleil','depolarization'].includes(c.mode)){const label=document.createElement('label');label.textContent='入射偏振态 ';const input=document.createElement('select');input.add(new Option('带入的偏振态','custom'));Object.keys(presets).forEach(k=>input.add(new Option(inputNames[k],k)));input.value=Object.keys(presets).find(k=>JSON.stringify(presets[k])===JSON.stringify(c.inputJones))||'custom';input.onchange=()=>{if(input.value!=='custom')patch({inputJones:presets[input.value]});};label.append(input);root.append(label);}
  if(c.mode==='basic'){
   c.elements.forEach((e,i)=>{const box=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=`${i+1} · ${elementNames[e.type]||e.type}`;box.append(legend);const edit=(key,value)=>patch({elements:c.elements.map((v,j)=>i===j?{...v,[key]:value}:v)});field(box,'轴角 / °',e.angle,v=>edit('angle',v),-180,180);
    if(['waveplate','babinet_soleil'].includes(e.type))field(box,'延迟 / °',e.retardation??0,v=>edit('retardation',v),0,360);
    if(e.type==='depolarizer')field(box,'退偏因子',e.depolFactor??0,v=>edit('depolFactor',v),0,1,.01);
    if(e.type==='crystal')for(const [key,label,value,min,max,step] of [['thickness','厚度/mm',e.thickness??1,0,100,.01],['no','nₒ',e.no??1.544,1,5,.001],['ne','nₑ',e.ne??1.553,1,5,.001],['wavelength','波长/nm',e.wavelength??632.8,100,2000,1]])field(box,label,value,v=>edit(key,v),min,max,step);
    const remove=document.createElement('button');remove.textContent='移除元件';remove.onclick=()=>patch({elements:c.elements.filter((_,j)=>i!==j)});box.append(remove);root.append(box);});
   const type=document.createElement('select');['polarizer','halfwave','quarterwave','waveplate','rotator','faraday','crystal','babinet_soleil','depolarizer'].forEach(t=>type.add(new Option(elementNames[t],t)));type.setAttribute('aria-label','新增元件类型');const add=document.createElement('button');add.textContent='添加元件';add.disabled=c.elements.length>=32;add.onclick=()=>patch({elements:[...c.elements,{id:'new',type:type.value,angle:0,...(type.value==='waveplate'?{retardation:90}:{})}]});root.append(type,add);
  }
  if(c.mode==='babinet_soleil'){addField('快轴 / °','bsAngle',-90,90);addField('补偿延迟 / °','bsRetardation',0,360);check('测量未知波片（含正交检偏器）','measuring');if(c.measuring){addField('样品延迟 / °','mysteryRetardation',0,360);const p=document.createElement('p');p.textContent='检偏器固定135°。逆补偿读数要求45°入射线偏振、快轴0°，结果按360°取模。';root.append(p);}}
  if(c.mode==='measurement'){check('启用目标偏振光','targetGenerated');['S₁','S₂','S₃'].forEach((name,i)=>field(root,name,c.targetStokes[i+1],v=>{const targetStokes=[...c.targetStokes];targetStokes[i+1]=v;patch({targetStokes});},-1,1,.01));addField('检偏角 / °','polarizerAngle',0,180);check('插入理想90°波片','useQWP');if(c.useQWP)addField('波片角 / °','qwpAngle',-90,90);}
  if(c.mode==='depolarization')addField('退偏程度 / %','concentration',0,100,1);
  if(c.mode==='microscope'){addField('厚度 / mm','thickness',.005,.1,.001);addField('双折射 Δn','birefringence',.0001,.03,.0001);addField('会聚半角 / °','convergenceAngle',5,40,1);addField('波长 / nm','wavelength',400,700,1);const p=document.createElement('p');p.textContent='沿用二维近似锥光模型；灰度表示相对强度，不作真实干涉色或物镜成像标定。';root.append(p);}
 }
 return {update,model:group};
}
export function drawMicroscope(ctx,c){const size=220,im=ctx.createImageData(size,size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=(x-size/2)/(size/2),dy=(y-size/2)/(size/2),r=Math.hypot(dx,dy),v=r<=1?Math.round(255*microscopeIntensity(c,r,Math.atan2(dy,dx))):243;im.data.set([v,v,v,255],(y*size+x)*4);}ctx.putImageData(im,130,60);}
