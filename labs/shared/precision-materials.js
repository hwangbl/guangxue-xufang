import * as T from 'three';
// Subtle machining grain in metres. Geometry carries the structural details.
export function finishPrecisionHardware(model){
 const pixels=new Uint8Array(128*128*4);let seed=37;
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const n=116+(seed%22)+(y%4===0?6:0),i=(y*128+x)*4;pixels.set([n,n,n,255],i);
 }
 const grain=new T.DataTexture(pixels,128,128);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(4,24);grain.needsUpdate=true;
 const seen=new Set();
 model.traverse(o=>{
  if(!o.isMesh)return;
  if(!o.geometry.attributes.uv){
   const p=o.geometry.attributes.position,n=o.geometry.attributes.normal,uv=new Float32Array(p.count*2);
   for(let i=0;i<p.count;i++){const a=Math.abs(n.getX(i)),b=Math.abs(n.getY(i)),c=Math.abs(n.getZ(i));uv[i*2]=(a>b&&a>c?p.getZ(i):p.getX(i))*10;uv[i*2+1]=(b>a&&b>c?p.getZ(i):p.getY(i))*10;}
   o.geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
  }
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   if(seen.has(m))continue;seen.add(m);
   if(['Graphite','Aluminium'].includes(m.name)){m.bumpMap=grain;m.bumpScale=m.name==='Graphite'?.000018:.000009;}
  }
 });
}
