import * as T from 'three';

export function createJcd3BackgroundCanvas() {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(150,160,0,300,300,1000);
  gradient.addColorStop(0,'#454649');gradient.addColorStop(.55,'#303135');gradient.addColorStop(1,'#1c1e21');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,768);
  return canvas;
}

// JCD3's graphite soft-light study. Everything here is presentation-only and in metres / Z-up.
export function configureJcd3Studio({scene,renderer,model,ground,lights,table}) {
  const lampScale=.62;
  renderer.toneMappingExposure=.78;
  renderer.shadowMap.type=T.VSMShadowMap;
  scene.environmentIntensity=.55;
  scene.userData.lightingStyle='JCD3 graphite softbox 2026-11-08';

  // A dark room gives metal a shadow side; the softboxes supply the highlights.
  const room=new T.Scene();room.background=new T.Color('#303133');
  for(const [position,size,power] of [
    [[-3,-4,6],[4,5],4.0], [[4,2,3],[2,4],1.8], [[1,-5,2],[3,3],.65],
  ]) {
    const panel=new T.Mesh(new T.PlaneGeometry(...size),new T.MeshBasicMaterial({color:new T.Color().setScalar(power),side:T.DoubleSide}));
    panel.position.set(...position);panel.up.set(0,0,1);panel.lookAt(0,0,0);room.add(panel);
  }
  const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.06);
  scene.environment?.dispose();scene.environment=environment.texture;pmrem.dispose();
  room.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});

  const background=createJcd3BackgroundCanvas();
  scene.background?.dispose();scene.background=new T.CanvasTexture(background);scene.background.colorSpace=T.SRGBColorSpace;
  // E family retained; the brighter shared upper-left hotspot is softened only in this lab.
  scene.userData.backgroundTheme='E';
  // The shared large floor crossed the close-up background as a hard dark band.
  // A seamless backdrop plus localized leveling-foot contacts works at both camera distances.
  ground.visible=false;

  for(const light of [...lights.children]) {
    if(light.target?.parent===scene)scene.remove(light.target);
    light.shadow?.dispose();lights.remove(light);
  }
  lights.position.set(0,0,0);lights.rotation.set(0,0,0);lights.scale.setScalar(1);
  const target=new T.Vector3(0,-.015,.16);
  const key=new T.DirectionalLight('#fffaf4',3.5*lampScale);key.name='JCD3 soft key';
  key.position.set(-.45,-.55,.85);key.target.position.copy(target);scene.add(key.target);
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);
  Object.assign(key.shadow.camera,{left:-.32,right:.32,top:.34,bottom:-.30,near:.1,far:2.2});
  key.shadow.camera.updateProjectionMatrix();key.shadow.bias=-.00015;key.shadow.normalBias=.0006;
  key.shadow.radius=4;key.shadow.blurSamples=12;
  lights.add(key);
  for(const [name,color,power,size,position] of [
    ['JCD3 key softbox','#fffaf7',5.0,[.65,.8],[-.38,-.45,.70]],
    ['JCD3 frontal fill','#f1f3f5',1.3,[.55,.55],[.35,-.50,.35]],
    ['JCD3 edge softbox','#eff2f6',2.1,[.3,.6],[.32,.28,.53]],
  ]) {
    const light=new T.RectAreaLight(color,power*lampScale,...size);
    light.name=name;light.position.set(...position);light.up.set(0,0,1);light.lookAt(target);lights.add(light);
  }
  const fill=new T.HemisphereLight('#dee0e2','#141519',.10);fill.up.set(0,0,1);fill.position.set(0,0,1);lights.add(fill);

  const materials=new Set();
  model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
  const finishes={
    '银灰 · 细砂铸件':['#a9adae',.48,.43],
    '镀铬钢 · 车削边':['#aab0b3',.88,.30],
    '钢制导轨':['#41464a',.75,.38],
    '黑色电木':['#202225',.10,.48],
    '哑黑橡胶':['#111315',0,.76],
    '刻度尺 · 缎面银':['#c2c5c5',.48,.42],
    '刻度 · 黑色':['#08090a',0,.85],
  };
  for(const material of materials) {
    const f=finishes[material.name];
    if(f){material.color.set(f[0]);material.metalness=f[1];material.roughness=f[2];}
    material.envMapIntensity=1.0;
    if(material.transmission>.1) {
      material.color.set('#eef8f4');material.roughness=.10;material.ior=1.46;
      material.thickness=.002;material.attenuationColor?.set('#a9c9bf');material.attenuationDistance=.12;
    }
    material.needsUpdate=true;
  }

  const skin=table.getObjectByName('Perforated stainless skin');
  skin.material.color.set('#696d70');skin.material.metalness=.55;skin.material.roughness=.62;
  skin.material.envMapIntensity=.65;
  // The top is flat: averaging its normals with the hole bevels caused a pillowed shine.
  const oldGeometry=skin.geometry;skin.geometry=oldGeometry.toNonIndexed();skin.geometry.computeVertexNormals();oldGeometry.dispose();

  // A small fixed contact term keeps the base seated even in the fast renderer without shadows.
  // It follows the stationary casting only; movable parts use actual light shadows in high quality.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const c=canvas.getContext('2d');c.filter='blur(10px)';c.fillStyle='rgba(0,0,0,.34)';
  c.beginPath();c.roundRect(26,22,204,212,18);c.fill();
  const texture=new T.CanvasTexture(canvas);
  const contact=new T.Mesh(new T.PlaneGeometry(.205,.235),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
  contact.name='JCD3 base contact shadow';contact.position.set(0,0,table.position.z+.00006);contact.renderOrder=1;scene.add(contact);
  const footCanvas=document.createElement('canvas');footCanvas.width=footCanvas.height=128;
  const fc=footCanvas.getContext('2d'),fade=fc.createRadialGradient(64,64,12,64,64,62);
  fade.addColorStop(0,'rgba(0,0,0,.32)');fade.addColorStop(1,'rgba(0,0,0,0)');
  fc.fillStyle=fade;fc.fillRect(0,0,128,128);
  const footTexture=new T.CanvasTexture(footCanvas),footGeometry=new T.PlaneGeometry(.14,.14);
  const footMaterial=new T.MeshBasicMaterial({map:footTexture,transparent:true,depthWrite:false,toneMapped:false});
  const feet=new T.Group();feet.name='JCD3 table foot contacts';
  table.updateMatrixWorld(true);
  for(const part of table.children)if(part.geometry?.parameters?.radiusTop===.035) {
    const foot=new T.Mesh(footGeometry,footMaterial);part.getWorldPosition(foot.position);
    foot.position.z-=.00094;feet.add(foot);
  }
  scene.add(feet);
  return ()=>{
    scene.remove(contact,key.target);contact.geometry.dispose();contact.material.dispose();texture.dispose();
    scene.remove(feet);footTexture.dispose();footGeometry.dispose();footMaterial.dispose();
    if(scene.environment===environment.texture)scene.environment=null;
    environment.dispose();
  };
}
