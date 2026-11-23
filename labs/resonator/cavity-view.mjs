import * as T from 'three';

export const TRANSVERSE_SCALE=20;
const axisY=.115;
// Display dimensions only. Solver and archived measurements remain in mm.
export function sampleCavity(state,solution){
 if(solution.w0===null)return [];
 return Array.from({length:97},(_,i)=>{
  const z=state.lengthMm*i/96,w=solution.widthAt(z)*TRANSVERSE_SCALE/1000;
  return {x:.1+z/1000,horizontal:w*Math.sqrt(2*state.m+1),vertical:w*Math.sqrt(2*state.n+1)};
 });
}
function line(color,dashed=false){
 return new T.Line(new T.BufferGeometry(),dashed?new T.LineDashedMaterial({color,dashSize:.003,gapSize:.002,transparent:true,opacity:.7}):new T.LineBasicMaterial({color,transparent:true,opacity:.9}));
}
function points(object,values){object.geometry.dispose();object.geometry=new T.BufferGeometry().setFromPoints(values);if(object.material.isLineDashedMaterial)object.computeLineDistances();}
function shell(samples){
 const positions=[],indices=[],segments=40;
 samples.forEach((s,i)=>{for(let k=0;k<=segments;k++){
  const a=k/segments*Math.PI*2;positions.push(s.x,axisY+s.vertical*Math.cos(a),s.horizontal*Math.sin(a));
  if(i&&k){const b=i*(segments+1)+k;indices.push(b,b-1,b-segments-2,b,b-segments-2,b-segments-1);}
 }});
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createCavityView(){
 const root=new T.Group(),mode=new T.Group(),details=new T.Group();root.name='CavityTeachingDisplay';root.add(mode,details);
 const axis=line('#e9d9c1',true);root.add(axis);
 const skin=new T.Mesh(new T.BufferGeometry(),new T.ShaderMaterial({
  uniforms:{tint:{value:new T.Color('#ffb782')},alpha:{value:.10}},
  vertexShader:'varying vec3 surfaceNormal; varying vec3 viewDirection; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); surfaceNormal=normalMatrix*normal; viewDirection=-p.xyz; gl_Position=projectionMatrix*p; }',
  fragmentShader:'uniform vec3 tint; uniform float alpha; varying vec3 surfaceNormal; varying vec3 viewDirection; void main(){ float facing=abs(dot(normalize(surfaceNormal),normalize(viewDirection))); gl_FragColor=vec4(tint,alpha*pow(facing,1.25));\n#include <colorspace_fragment>\n}',
  transparent:true,side:T.DoubleSide,depthWrite:false,toneMapped:false
 }));mode.add(skin);
 const edges=Array.from({length:4},(_,i)=>line(i<2?'#f6b471':'#77cfd4'));mode.add(...edges);
 const section=new T.Group(),frame=line('#66f1d1'),waist=line('#f9d2a3',true);
 const plane=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:'#52d6bc',transparent:true,opacity:.13,side:T.DoubleSide,depthWrite:false}));plane.rotation.y=Math.PI/2;
 section.add(plane,frame);details.add(section,waist);
 const arrows=[new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(),.02,0xffd0a0,.004,.002),new T.ArrowHelper(new T.Vector3(-1,0,0),new T.Vector3(),.02,0xffd0a0,.004,.002)];details.add(...arrows);
 let showDetails=false,valid=false,maxRadius=.01;
 function setDetailed(value){showDetails=value;details.visible=value&&valid;axis.material.opacity=value?.8:.35;skin.material.uniforms.alpha.value=value?.17:.08;}
 function update(state,solution){
  const L=state.lengthMm/1000,end=.1+L,samples=sampleCavity(state,solution);valid=samples.length>0;mode.visible=valid;details.visible=showDetails&&valid;
  points(axis,[new T.Vector3(.1,axisY,0),new T.Vector3(end,axisY,0)]);
  if(!valid){maxRadius=.01;return;}
  maxRadius=Math.max(...samples.map(s=>Math.max(s.horizontal,s.vertical)));
  skin.geometry.dispose();skin.geometry=shell(samples);
  edges.forEach((edge,j)=>points(edge,samples.map(s=>new T.Vector3(s.x,axisY+(j>=2?(j%2?1:-1)*s.vertical:0),j<2?(j%2?1:-1)*s.horizontal:0))));
  const w=solution.widthAt(state.probe*state.lengthMm)*TRANSVERSE_SCALE/1000;
  const h=Math.max(.006,w*Math.sqrt(2*state.n+1)*1.35),r=Math.max(.006,w*Math.sqrt(2*state.m+1)*1.35);
  section.position.set(.1+state.probe*L,axisY,0);plane.scale.set(2*r,2*h,1);
  points(frame,[new T.Vector3(0,-h,-r),new T.Vector3(0,h,-r),new T.Vector3(0,h,r),new T.Vector3(0,-h,r),new T.Vector3(0,-h,-r)]);
  const z0=.1+solution.waistPos/1000,reach=Math.max(.009,solution.w0*TRANSVERSE_SCALE/1000*Math.sqrt(2*state.n+1)*1.7);
  points(waist,[new T.Vector3(z0,axisY-reach,0),new T.Vector3(z0,axisY+reach,0)]);
  waist.visible=solution.waistPos>=0&&solution.waistPos<=state.lengthMm;
  // Two opposite arrow glyphs describe reciprocity, not separate ray trajectories.
  arrows[0].position.set(.1+L*.20,axisY,0);arrows[1].position.set(.1+L*.80,axisY,0);
  arrows.forEach(a=>a.setLength(L*.16,Math.min(.004,L*.04),Math.min(.002,L*.025)));
 }
 return {root,update,setDetailed,get radius(){return maxRadius;}};
}
