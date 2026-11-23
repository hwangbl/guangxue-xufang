// Metres. These transforms move housings only; physics remains in each lab's solver.
export const TELESCOPE_MECHANICS=Object.freeze({objectiveX:.08,axisHeight:.105,minMm:100,maxMm:300});
export function telescopeMechanics(lengthMm){
 if(!Number.isFinite(lengthMm)||lengthMm<100||lengthMm>300)throw new RangeError('镜间距须在100–300 mm内');
 const length=lengthMm/1000,extension=length-.1;
 return {eyeX:.08+length,sleeve1X:.08+.01+extension/3,sleeve2X:.08+.015+extension*2/3,
  // Relative to objective plane; used to check overlap and radial clearance.
  tubes:[{start:-.03,end:.10,outer:.026,inner:.0244},
   {start:.01+extension/3,end:.11+extension/3,outer:.024,inner:.0224},
   {start:.015+extension*2/3,end:.115+extension*2/3,outer:.022,inner:.0204},
   {start:length-.08,end:length+.027,outer:.020,inner:.0184}]};
}

// A curved annular leaf tessellation: the aperture stays circular at the solver's
// diameter. The seams illustrate a ten-leaf iris, not a manufacturer's cam law.
export function irisLeafVertices(index,radius,outer,x){
 if(index<0||index>9||!Number.isFinite(radius)||radius<=0||radius>=outer)throw new RangeError('Invalid iris geometry');
 const points=[],indices=[],angular=16,radial=4;
 for(let j=0;j<=radial;j++)for(let i=0;i<=angular;i++){
  const u=j/radial,r=radius+(outer-radius)*u;
  const a=(index+i/angular)*Math.PI/5+.32*u*u;
  points.push(x,r*Math.sin(a),-r*Math.cos(a));
 }
 for(let j=0;j<radial;j++)for(let i=0;i<angular;i++){
  const a=j*(angular+1)+i,b=a+1,c=a+angular+1,d=c+1;
  indices.push(a,b,c,b,d,c);
 }
 return {points,indices};
}
