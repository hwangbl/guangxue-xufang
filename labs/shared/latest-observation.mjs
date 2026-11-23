/** Keep one calculation in flight and one latest request, never a backlog of stale frames. */
export function createLatestObservation({createWorker,apply,onStatus=()=>{}}){
 let worker=null,busy=false,paused=false,disposed=false,sequence=0,wanted=null,appliedKey=null,error='';
 const pending=()=>!!wanted&&wanted.key!==appliedKey;
 const status=()=>onStatus({pending:pending(),error});
 function pump(){
  if(disposed||paused||busy||!pending()||error)return;
  if(!worker){try{worker=createWorker();worker.onmessage=receive;worker.onerror=()=>{worker?.terminate();worker=null;busy=false;sequence++;error='图样计算失败，请重新进入实验。';status();};}catch(e){error=e.message||'无法启动图样计算。';status();return;}}
  busy=true;const id=++sequence;worker.postMessage({id,key:wanted.key,state:wanted.state});
 }
 function receive({data}){
  if(disposed||paused||data.id!==sequence)return;busy=false;
  if(data.key===wanted?.key){
   if(data.error)error=data.error;
   else{try{apply(data.value);appliedKey=data.key;}catch(e){error=e.message;}}
   status();
  }
  pump();
 }
 function update(key,state){if(disposed)return;wanted={key,state};error='';status();pump();}
 function pause(){paused=true;worker?.terminate();worker=null;busy=false;sequence++;}
 function resume(){if(disposed)return;paused=false;pump();}
 function dispose(){if(disposed)return;pause();disposed=true;wanted=null;}
 async function waitForCurrent(){
  const deadline=Date.now()+20000;
  while(pending()){
   if(disposed)throw Error('实验已关闭。');
   if(paused)throw Error('实验视图已暂停，请切回后重试。');
   if(error)throw Error(error);
   if(Date.now()>deadline)throw Error('图样计算超时，请稍后重试。');
   await new Promise(resolve=>setTimeout(resolve,10));
  }
  if(disposed)throw Error('实验已关闭。');
 }
 return {update,pause,resume,dispose,waitForCurrent,get pending(){return pending();}};
}
