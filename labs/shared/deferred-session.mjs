/** Storage-compatible automatic session buffer. Explicit archive/file storage is separate. */
export function createDeferredSessionStore(storage,{schedule=setTimeout,cancel=clearTimeout,reportError=()=>{}}={}){
 const pending=new Map(),written=new Map();let timer=null,closed=false;
 function stopTimer(){if(timer!==null)cancel(timer);timer=null;}
 function flush(){
  stopTimer();let success=true;
  for(const [key,value] of pending){
   try{if(written.get(key)!==value)storage.setItem(key,value);written.set(key,value);pending.delete(key);}
   catch(error){success=false;reportError(error,key);}
  }
  return success;
 }
 function getItem(key){key=String(key);if(pending.has(key))return pending.get(key);const value=storage.getItem(key);written.set(key,value);return value;}
 function setItem(key,value){
  key=String(key);value=String(value);
  if(pending.get(key)===value||(!pending.has(key)&&written.get(key)===value))return;
  pending.set(key,value);if(closed){flush();return;}stopTimer();timer=schedule(flush,500);
 }
 function removeItem(key){key=String(key);pending.delete(key);written.delete(key);if(!pending.size)stopTimer();storage.removeItem(key);}
 function clear(){stopTimer();pending.clear();written.clear();storage.clear();}
 function dispose(){if(closed)return !pending.size;const result=flush();closed=true;return result;}
 return {getItem,setItem,removeItem,clear,flush,dispose,get pendingCount(){return pending.size;}};
}
