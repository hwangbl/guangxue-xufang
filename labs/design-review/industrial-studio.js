import * as T from 'three';
import {RectAreaLightUniformsLib} from './vendor/RectAreaLightUniformsLib.js';
import {createIndustrialBackgroundCanvas} from '../shared/industrial-background.js';

export function addIndustrialStudio(scene,renderer){
 RectAreaLightUniformsLib.init();
 const canvas=createIndustrialBackgroundCanvas();
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;scene.background=texture;scene.backgroundIntensity=1;
 scene.userData.backgroundTheme='E';
 renderer.toneMappingExposure=1.03;renderer.shadowMap.type=T.VSMShadowMap;scene.environmentIntensity=.75;
 const lights=new T.Group();lights.name='IndustrialStudio';lights.add(new T.HemisphereLight('#e4e7ec','#171b21',.35));
 const key=new T.DirectionalLight('#fffaf3',3.8);key.position.set(-3,5,3);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.radius=6;key.shadow.blurSamples=12;
 Object.assign(key.shadow.camera,{left:-1.8,right:1.8,top:1.8,bottom:-1.8,near:.1,far:15});key.shadow.bias=-.00008;key.shadow.normalBias=.001;lights.add(key);
 const softbox=new T.RectAreaLight('#ffffff',4,4,3);softbox.position.set(0,4,.5);softbox.lookAt(0,0,0);lights.add(softbox);
 const rim=new T.RectAreaLight('#c4d8f0',3.8,2,3);rim.position.set(3,2,-2);rim.lookAt(0,.3,0);lights.add(rim);
 const front=new T.RectAreaLight('#e6edfa',1.0,3,2);front.position.set(2,1,4);front.lookAt(0,.25,0);lights.add(front);
 scene.add(lights);return {lights,texture};
}

// A matte graphite surface with a feathered edge: no hard horizon or floating drop shadow.
export function createIndustrialFloor(){
 const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
 const g=x.createRadialGradient(128,128,32,128,128,125);g.addColorStop(0,'white');g.addColorStop(.45,'#ffffff');g.addColorStop(1,'black');x.fillStyle=g;x.fillRect(0,0,256,256);
 const alpha=new T.CanvasTexture(c);
 const data=new Uint8Array(128*128*4);let seed=417;for(let i=0;i<data.length;i+=4){seed=(1664525*seed+1013904223)>>>0;const n=110+seed%35;data[i]=data[i+1]=data[i+2]=n;data[i+3]=255;}
 const grain=new T.DataTexture(data,128,128);grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.repeat.set(24,24);grain.needsUpdate=true;
 const material=new T.MeshStandardMaterial({color:'#101318',metalness:.16,roughness:.66,transparent:true,alphaMap:alpha,bumpMap:grain,bumpScale:.00018,depthWrite:false});
 const floor=new T.Mesh(new T.PlaneGeometry(14,14),material);floor.rotation.x=-Math.PI/2;floor.position.y=-.005;floor.receiveShadow=true;return floor;
}
