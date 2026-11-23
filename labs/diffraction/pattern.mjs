/** Display mapping only. Retains the original 0.05 mm sampling and typed-array rounding. */
export function patternPixels(samples,width,height,physicalWidth,physicalHeight,centreYOffset=0,circular=false){
 const pixels=new Uint8ClampedArray(width*height*4);
 const sampled=x=>{const t=Math.min(samples.length-1,Math.abs(x)/.05),i=Math.floor(t);return samples[i]+(samples[Math.min(i+1,samples.length-1)]-samples[i])*(t-i);};
 const colors=(array,index,x)=>{const v=sampled(x),display=Math.pow(Math.max(0,Math.min(1,v)),.4);array[index]=12+display*235;array[index+1]=15+display*28;array[index+2]=20+display*22;array[index+3]=255;};
 // A slit is vertically invariant. Compute its identical row once, at full original precision.
 if(!circular){const row=new Uint8ClampedArray(width*4);for(let x=0;x<width;x++)colors(row,x*4,(x/(width-1)-.5)*physicalWidth);for(let y=0;y<height;y++)pixels.set(row,y*width*4);return pixels;}
 const xs=Float64Array.from({length:width},(_,x)=>(x/(width-1)-.5)*physicalWidth);
 for(let y=0;y<height;y++){const yy=(.5-y/(height-1))*physicalHeight+centreYOffset;for(let x=0;x<width;x++)colors(pixels,(y*width+x)*4,Math.hypot(xs[x],yy));}
 return pixels;
}
