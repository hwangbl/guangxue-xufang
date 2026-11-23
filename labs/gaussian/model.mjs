import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createGaussianBench(font){
 const root=new T.Group();root.name='GaussianBench';root.userData={units:'metres',reference:'Generic educational optical bench; nominal design dimensions, not vendor replica'};
 const nodes={};const metal=new T.MeshStandardMaterial({color:0xbac5ca,metalness:.8,roughness:.32}),black=new T.MeshStandardMaterial({color:0x172328,metalness:.65,roughness:.34}),rubber=new T.MeshStandardMaterial({color:0x141718,roughness:.86}),glass=new T.MeshPhysicalMaterial({color:0xe6f6f5,transmission:.92,thickness:.004,roughness:.06,ior:1.52}),white=new T.MeshStandardMaterial({color:0xe5ece8,roughness:.72});
 function mesh(g,m,p,parent=root){const n=new T.Mesh(g,m);n.position.set(...p);n.castShadow=true;n.receiveShadow=true;parent.add(n);return n;}
 const box=(a,p,m=black,parent=root)=>mesh((Math.min(...a)>.003?new RoundedBoxGeometry(...a,3,Math.min(.0012,Math.min(...a)*.12)):new T.BoxGeometry(...a)),m,p,parent);
 function cyl(r,h,p,m=metal,parent=root,axis='y'){const n=mesh(new T.CylinderGeometry(r,r,h,48),m,p,parent);if(axis==='x')n.rotation.z=Math.PI/2;if(axis==='z')n.rotation.x=Math.PI/2;return n;}
 function ring(r,t,p,parent=root,m=black){const n=mesh(new T.TorusGeometry(r,t,12,72),m,p,parent);n.rotation.y=Math.PI/2;return n;}
 function screw(p,parent=root){cyl(.0032,.0005,[p[0],p[1]-.0007,p[2]],black,parent);cyl(.0024,.002,p,metal,parent);const h=mesh(new T.CylinderGeometry(.0012,.0012,.0003,6),rubber,[p[0],p[1]+.0011,p[2]],parent);}
 function label(text,size,p,parent=root){if(!font)return;const g=new T.ShapeGeometry(font.generateShapes(text,size));const n=mesh(g,white,p,parent);n.rotation.x=-Math.PI/2;return n;}
 function knob(p,parent=root){cyl(.008,.012,p,black,parent,'z');for(let i=0;i<24;i++){const a=i*Math.PI/12;box([.0009,.0016,.010],[p[0]+.008*Math.cos(a),p[1]+.008*Math.sin(a),p[2]],metal,parent);} }
 // Extruded rail, paired guide lands, engraved ruler, end stops and vibration feet.
 box([1.04,.025,.12],[0,.035,0]);for(const z of [-.046,.046])box([1.03,.006,.008],[0,.050,z],metal);
 for(const x of [-.49,.49]){box([.018,.046,.132],[x,.035,0]);for(const z of [-.045,.045])cyl(.014,.015,[x,.009,z],rubber);}
 for(let i=0;i<=100;i++){const x=-.5+i*.01;box([.0005,.0004,i%10===0?.014:i%5===0?.010:.006],[x,.0503,.028],metal);if(i%10===0)label(String(i*10),.004,[x-.006,.0507,.042]);}
 function carriage(name,x){const g=new T.Group();g.name=name;g.position.x=x;root.add(g);nodes[name]=g;box([.066,.014,.086],[0,.061,0],metal,g);box([.058,.007,.062],[0,.071,0],black,g);for(const a of [-.024,.024])for(const b of [-.028,.028])screw([a,.069,b],g);knob([0,.060,.052],g);cyl(.012,.043,[0,.095,0],black,g);cyl(.006,.06,[0,.139,0],metal,g);knob([0,.107,.018],g);return g;}
 const laser=carriage('Laser',-.39);cyl(.027,.16,[0,.180,0],black,laser,'x');for(const x of [-.073,.073]){ring(.024,.003,[x,.180,0],laser,metal);cyl(.030,.007,[x,.180,0],black,laser,'x');}cyl(.009,.004,[.080,.180,0],metal,laser,'x');cyl(.005,.005,[.083,.180,0],rubber,laser,'x');box([.075,.001,.017],[0,.208,0],white,laser);const badge=label('LASER',.007,[-.022,.209,.006],laser);if(badge)badge.material=black;for(let i=0;i<7;i++)box([.002,.001,.018],[-.058+i*.004,.208,0],rubber,laser);
 const power=box([.11,.033,.072],[-.40,.033,-.14],black);power.name='PowerSupply';const cable=new T.CatmullRomCurve3([new T.Vector3(-.473,.18,0),new T.Vector3(-.51,.15,-.05),new T.Vector3(-.51,.053,-.14),new T.Vector3(-.45,.045,-.14)]);mesh(new T.TubeGeometry(cable,40,.002,8,false),rubber,[0,0,0]);
 const iris=carriage('Iris',-.24);ring(.025,.005,[0,.18,0],iris);nodes.IrisBlades=new T.Group();iris.add(nodes.IrisBlades);for(let i=0;i<12;i++){const a=i*Math.PI/6;const n=box([.001,.015,.010],[.001,.18+.014*Math.cos(a),.014*Math.sin(a)],metal,nodes.IrisBlades);n.rotation.x=a;}knob([0,.21,.014],iris);
 const lens=carriage('Lens',-.08);ring(.027,.004,[0,.18,0],lens);ring(.0248,.001,[.003,.18,0],lens,metal);const optic=mesh(new T.SphereGeometry(.024,64,32),glass,[0,.18,0],lens);optic.scale.x=.15;knob([0,.21,0],lens);label('f 150 mm',.004,[-.020,.075,.021],lens);
 const screen=carriage('Detector',.32);box([.009,.13,.13],[0,.18,0],black,screen);box([.001,.116,.116],[-.005,.18,0],white,screen);nodes.Screen=screen;for(const y of [.125,.235])for(const z of [-.055,.055]){cyl(.002,.001,[-.006,y,z],metal,screen,'x');}for(let i=-5;i<=5;i++){box([.0002,.0003,.110],[-.0057,.18+i*.01,0],metal,screen);box([.0002,.110,.0003],[-.0057,.18,i*.01],metal,screen);}label('DETECTOR',.004,[-.025,.075,.019],screen);
 // Mechanical connections, rail extrusion channels and separate clamping hardware.
 for(const z of [-.0605,.0605])for(const y of [.029,.039])box([.985,.0015,.001],[0,y,z],rubber);
 for(const x of [-.49,.49])for(const z of [-.046,.046])screw([x,.059,z]);
 for(const name of ['Laser','Iris','Lens','Detector']){
  const g=nodes[name];for(const z of [-.044,.044])box([.058,.008,.004],[0,.054,z],black,g);
  cyl(.003,.018,[0,.060,.043],metal,g,'z');cyl(.0027,.012,[0,.107,.012],metal,g,'z');
  cyl(.0077,.003,[0,.124,0],metal,g);for(let j=0;j<4;j++)box([.0004,.0003,.004],[.0063,.136+j*.006,0],black,g);
  box([.010,.001,.015],[0,.069,.033],black,g);box([.0006,.0005,.012],[0,.070,.033],white,g);
 }
 // Mounting saddles physically join the stems to the optical barrels.
 box([.070,.009,.032],[0,.152,0],black,laser);for(const x of [-.026,.026]){const n=ring(.0285,.002,[x,.18,0],laser,metal);box([.009,.011,.031],[x,.150,0],black,laser);}
 for(const g of [iris,lens])box([.012,.023,.015],[0,.148,0],black,g);
 box([.019,.052,.019],[.009,.145,0],metal,screen);for(const y of [.128,.158])cyl(.003,.002,[.020,y,0],black,screen,'x');
 // Power enclosure sits on four rubber feet, with seam, switch and connector.
 for(const x of [-.443,-.357])for(const z of [-.165,-.115])cyl(.005,.0165,[x,.00825,z],rubber);
 box([.106,.001,.068],[-.40,.032,-.14],rubber);for(let i=0;i<9;i++)box([.001,.0005,.025],[-.429+i*.006,.0498,-.145],rubber);
 box([.016,.003,.010],[-.365,.050,-.125],rubber);cyl(.002,.001,[-.381,.050,-.125],new T.MeshStandardMaterial({color:0x4d7351,roughness:.4}));
 for(const x of [-.443,-.357])for(const z of [-.165,-.115])screw([x,.049,z]);
 const glow=new T.MeshBasicMaterial({color:0xff3220,transparent:true,opacity:.17,depthWrite:false});const beam=cyl(.0012,.6,[0,.18,0],glow,root,'x');beam.name='BeamGuide';nodes.BeamGuide=beam;
 function setState({lensMm=420,detectorMm=820,beamOn=false,irisMm=12}={}){const radius=Math.max(4,Math.min(24,irisMm))/2000;nodes.IrisBlades.children.forEach((blade,i)=>{const a=i*Math.PI/6;blade.position.y=.18+(radius+.0075)*Math.cos(a);blade.position.z=(radius+.0075)*Math.sin(a);});lens.position.x=Math.max(300,Math.min(650,lensMm))/1000-.5;screen.position.x=Math.max(750,Math.min(950,detectorMm))/1000-.5;beam.visible=beamOn;const start=-.306,end=screen.position.x-.006;beam.position.x=(start+end)/2;beam.scale.y=(end-start)/.6;}
 setState();return {root,nodes,setState};
}
