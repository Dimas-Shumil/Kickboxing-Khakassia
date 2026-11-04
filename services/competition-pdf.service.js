import {Worker} from 'node:worker_threads';
import {HttpError} from '../lib/validation.js';
export function validatePDF(bytes){return new Promise((resolve,reject)=>{
 const worker=new Worker(new URL('../lib/pdf-validation.worker.js',import.meta.url),{workerData:bytes,resourceLimits:{maxOldGenerationSizeMb:128}});
 let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate();ok?resolve():reject(new HttpError(422,'PDF повреждён, зашифрован, слишком сложен или содержит интерактивные действия / вложения. Загрузите обычный PDF без форм.'));};
 const timer=setTimeout(()=>finish(false),8000);
 worker.on('message',m=>finish(m.ok));worker.on('error',()=>finish(false));worker.on('exit',()=>finish(false));
});}
