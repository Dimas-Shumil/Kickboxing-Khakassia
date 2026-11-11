import {AsyncLocalStorage} from 'node:async_hooks';
import {HttpError} from './validation.js';
export const gymContext=new AsyncLocalStorage();
const direct=new Set(['student','trainingGroup','gymSession','financeEntry']);
const privateModels=new Set([...direct,'payment','paymentRevision','attendanceRecord']);
const gymScopes=['students','payments','gym-groups','gym-sessions','gym-attendance','gym-finances'];
const contentScopes=['news','people','competitions','history','site-page','site-document','site-media'];
const readMethods=new Set(['findMany','findFirst','findFirstOrThrow','findUnique','findUniqueOrThrow','count','aggregate','groupBy']);
const writes=new Set(['create','update','updateMany','delete','deleteMany','upsert']);
const denied=()=>{throw new HttpError(404,'Запись зала не найдена.');};
function predicate(model,gymId){
 if(direct.has(model))return {gymId};
 if(model==='payment')return {pupil:{gymId}};
 if(model==='paymentRevision')return {payment:{pupil:{gymId}}};
 if(model==='attendanceRecord')return {session:{gymId},student:{gymId}};
 return {OR:[{scope:{in:contentScopes}},{scope:{in:gymScopes},gymId}]};
}
// Applied centrally to every private delegate, including transaction delegates.
// No client-supplied gymId is used; authentication establishes the context.
export function scopedDatabase(raw){
 return new Proxy(raw,{get(target,model){
  if(model==='$transaction')return async (work,options)=>{
   if(typeof work!=='function')throw new Error('Use callback transactions with scopedDatabase.');
   return target.$transaction(tx=>work(scopedDatabase(tx)),options);
  };
  const delegate=target[model];
  if(!privateModels.has(model)&&model!=='auditLog')return typeof delegate==='function'?delegate.bind(target):delegate;
  return new Proxy(delegate,{get(d,method){return async (args={})=>{
   const ctx=gymContext.getStore();if(!ctx)return d[method](args);
   if(privateModels.has(model)&&!['OWNER','TRAINER'].includes(ctx.role))throw new HttpError(403,'Учёт зала недоступен.');
   const filter=model==='auditLog'&&!['OWNER','TRAINER'].includes(ctx.role)?{scope:{in:contentScopes}}:predicate(model,ctx.gymId);
   if(readMethods.has(method)){
    // findUnique requires its unique key at top level (extended unique filters).
    return d[method]({...args,where:{...args.where,AND:[...(args.where?.AND?[args.where.AND]:[]),filter]}});
   }
   if(!writes.has(method))throw new Error('Unsupported scoped mutation: '+String(method));
   if(model==='auditLog'){
    if(method!=='create')throw new Error('Audit log is append-only.');
    return d.create({...args,data:{...args.data,gymId:gymScopes.includes(args.data.scope)?ctx.gymId:null}});
   }
   let data=args.data||args.create;
   // Disallow nested writes/connects and explicit tenant reassignment.
   if(data){
    const scalar=Object.values(data).every(v=>v===null||typeof v!=='object'||Object.keys(v).every(k=>k==='increment'));
    if(!scalar)throw new HttpError(422,'Вложенные изменения учёта запрещены.');
    if(Object.hasOwn(data,'gymId')&&data.gymId!==ctx.gymId)denied();
    for(const [key,relation] of [['student','student'],['studentId','student'],['sessionId','gymSession'],['groupId','trainingGroup'],['paymentId','payment']]){
     if(data[key]&&typeof data[key]==='string'){
      const found=await scopedDatabase(target)[relation].findUnique({where:{id:data[key]},select:{id:true}});
      if(!found)denied();
     }
    }
   }
   if(method==='upsert'){
    const old=await d.findUnique({where:args.where});
    if(old&&!await d.findFirst({where:{AND:[{id:old.id},filter]}}))denied();
    // Attendance upsert only; update contains status/note, relations remain immutable.
    if(model!=='attendanceRecord')throw new Error('Unsupported scoped upsert');
    if(Object.keys(args.update).some(k=>!['status','note'].includes(k)))denied();
    return d.upsert(args);
   }
   if(method==='create')return d.create({...args,data:direct.has(model)?{...data,gymId:ctx.gymId}:data});
   const where={...args.where,AND:[...(args.where?.AND?[args.where.AND]:[]),filter]};
   // Unknown or foreign identifiers have identical behavior.
   if(['update','delete'].includes(method)&&!await d.findFirst({where,select:{id:true}}))denied();
   return d[method]({...args,where});
  };}});
 }});
}
