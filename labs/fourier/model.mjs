import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from 'three';
import {createGaussianBench} from '../gaussian/model.mjs';
export function createFourierBench(){
 const bench=createGaussianBench(),{root,nodes}=bench;root.name='Fourier4fBench';
 nodes.Iris.visible=false;nodes.BeamGuide.visible=false;
 nodes.Lens.position.x=-.1;nodes.Detector.position.x=.35;
 const second=nodes.Lens.clone();second.name='L2';second.position.x=.2;root.add(second);
 // Fixed positions in metres: object -.25, L1 -.10, Fourier .05, L2 .20, image .35.
 const dark=new T.MeshStandardMaterial({color:0x152328,metalness:.65,roughness:.34});
 const silver=new T.MeshStandardMaterial({color:0xbbc7ce,metalness:.8,roughness:.3});
 function box(w,h,d,x,y,z,m,parent=root){const a=new T.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(w,h,d)*.025),m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;}
 function holder(name,x){const g=new T.Group();g.name=name;g.position.x=x;root.add(g);box(.065,.015,.085,0,.063,0,silver,g);box(.026,.085,.022,0,.111,0,dark,g);box(.008,.085,.085,0,.18,0,dark,g);for(const z of [-.03,.03])for(const y of [.15,.21]){const b=new T.Mesh(new T.CylinderGeometry(.0025,.0025,.009,6),silver);b.rotation.z=Math.PI/2;b.position.set(-.006,y,z);g.add(b);}return g;}
 const object=holder('Object',-.25),filter=holder('FourierFilter',.05);
 // Permanent filter carrier remains visible when the mask is removed.
 for(const z of [-.043,.043])box(.008,.094,.008,0,.18,z,dark,filter);
 for(const y of [.137,.223])box(.008,.008,.094,0,y,0,dark,filter);
 for(const n of filter.children)if(n.geometry?.type==='CylinderGeometry'&&Math.abs(n.position.z)===.03){n.position.z=Math.sign(n.position.z)*.043;n.position.y=n.position.y<.18?.137:.223;}
 const moving=new T.Group();filter.add(moving);filter.children.filter(n=>n.isMesh&&n.position.y===.18&&n.position.z===0).forEach(n=>n.visible=false);
 const plate=box(.003,.075,.075,0,.18,0,dark,moving);
 const handles=[];for(const z of [-.05,.05]){const knob=new T.Mesh(new T.CylinderGeometry(.008,.008,.018,40),dark);knob.rotation.x=Math.PI/2;knob.position.set(0,.14,z);filter.add(knob);handles.push(knob);for(let i=0;i<20;i++){const a=i*Math.PI/10;box(.001,.002,.016,.008*Math.sin(a),.14+.008*Math.cos(a),z,silver,filter);}}
 function plane(canvas,x,y,size,parent=root){const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const p=new T.Mesh(new T.PlaneGeometry(size,size),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));p.rotation.y=-Math.PI/2;p.position.set(x,y,0);parent.add(p);return tex;}
 function tag(text,x){const c=document.createElement('canvas');c.width=512;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#e6eeeb';ctx.fillRect(0,0,512,64);ctx.fillStyle='#203a34';ctx.font='32px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,44);const t=new T.CanvasTexture(c),m=new T.Mesh(new T.PlaneGeometry(.12,.015),new T.MeshBasicMaterial({map:t,side:T.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,.052,.06);root.add(m);}
 for(const [text,x] of [['OBJECT',-.25],['L1 f150',-.1],['FOURIER',.05],['L2 f150',.2],['IMAGE',.35]])tag(text,x);
 const filterCanvas=document.createElement('canvas');filterCanvas.width=filterCanvas.height=256;const filterTex=plane(filterCanvas,-.002,.18,.075,moving);plate.visible=false;
 // A real alpha cutout makes the plate opening visible through the model.
 moving.children.at(-1).material.transparent=true;moving.children.at(-1).material.alphaTest=.5;
 return {root,attach:(a,b)=>[plane(a,-.0045,.18,.067,object),plane(b,-.0065,.18,.109,nodes.Detector)],update(s){const c=filterCanvas.getContext('2d');c.clearRect(0,0,256,256);if(s.filter!=='none'){c.fillStyle='#25333a';c.fillRect(0,0,256,256);c.save();c.translate(128,128);c.rotate(-s.angle*Math.PI/180);c.globalCompositeOperation='destination-out';const width=s.aperture*.02/.075*256;if(s.filter==='lowpass'){c.beginPath();c.arc(0,0,width/2,0,Math.PI*2);c.fill();}else c.fillRect(-180,-width/2,360,width);c.restore();}filterTex.needsUpdate=true;moving.position.set(0,s.offsetY*.02,s.offsetX*.02);handles.forEach(n=>n.rotation.z=s.offsetX*2);},dispose(){root.traverse(n=>{n.geometry?.dispose();if(n.material){n.material.map?.dispose();n.material.dispose();}});}};
}
