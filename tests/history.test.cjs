const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {pathToFileURL}=require('node:url');
test('08.7: история — валидация, роли, снимки публикации, версии, файлы, связи и шаблоны (isolated mock)',async t=>{
 const {createHistoryWriter,validateHistory,historyDTO,publicHistory,publishedHistory}=await import('../services/history.service.js');
 const {listHistoryMedia,deleteHistoryMedia}=await import('../services/history-media.service.js');
 const {renderHistoryIndex,renderHistoryDetail,historyConnections}=await import('../services/history-render.service.js');
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'fed-history-unit-'));t.after(()=>fs.rm(tmp,{recursive:true,force:true}));
 const rows=new Map(),assets=new Map(),logs=[];
 const db={
  $transaction:async fn=>fn(db),
  historyMaterial:{
   findUnique:async({where})=>rows.get(where.id)||null,
   findMany:async({where}={})=>[...rows.values()].filter(r=>!where||(r.status===where.status&&r.publishedPayload!==null)),
   findFirst:async({where})=>[...rows.values()].find(r=>r.slug===where.slug&&r.status===where.status&&r.publishedPayload!==null)||null,
   create:async({data})=>{const r={id:'mat'+(rows.size+1),status:'draft',version:1,slug:null,publishedPayload:null,createdAt:new Date(),updatedAt:new Date(),...data};rows.set(r.id,r);return {...r};},
   updateMany:async({where,data})=>{const r=rows.get(where.id);if(!r||r.version!==where.version)return {count:0};Object.assign(r,data,{version:r.version+1,updatedAt:new Date()});return {count:1};}
  },
  historyAsset:{
   findFirst:async({where})=>assets.get(where.id)?.materialId===where.materialId?assets.get(where.id):null,
   findUnique:async({where})=>assets.get(where.id)||null,
   findMany:async({where})=>[...assets.values()].filter(x=>x.materialId===where.materialId),
   delete:async({where})=>assets.delete(where.id),
   count:async({where})=>[...assets.values()].filter(x=>x.materialId===where.materialId).length
  },
  person:{findUnique:async({where})=>where.id==='person1'?{id:'person1'}:null,findMany:async({where})=>where.id.in.includes('person1')&&db.testPublishedPeople?[{id:'person1',slug:'athlete1',status:'published',publishedPayload:JSON.stringify({name:'ПУБЛИЧНЫЙПРОФИЛЬ',primaryRole:'athlete',isAthlete:true,isCoach:false,athleteLegend:false,coachLegend:false})}]:[]},
  competition:{findUnique:async({where})=>where.id==='event1'?{id:'event1'}:null,findMany:async({where})=>where.id.in.includes('event1')&&db.testPublishedEvents?[{id:'event1',slug:'event1',status:'published',publishedPayload:JSON.stringify({title:'ПУБЛИЧНЫЙТУРНИР'})}]:[]},
  auditLog:{create:async({data})=>logs.push(data)}
 };
 const config={ROOT:path.resolve(__dirname,'..'),historyUploadDir:path.join(tmp,'media')};await fs.mkdir(config.historyUploadDir);
 const draft={title:'ИСТОРИЯТЕСТ <script>alert(1)</script>',section:'chronology',dateType:'period',period:'1990-е годы',date:'',lead:'Свидетельство Федерации',body:'ПОСТОЯННЫЙТЕКСТ <script>unsafe()</script>',author:'Автор',cover:'',coverAlt:'',coverCaption:'',coverCredit:'',gallery:[],sources:[{title:'Книга',url:'https://example.org/record',note:'Издание'}],people:[],competitions:[],detail:true};
 const owner={user:{id:'owner',role:'OWNER'},params:{},body:draft},editor={user:{id:'editor',role:'EDITOR'},params:{},body:draft};
 const write=createHistoryWriter(db,config);
 await t.test('Пустая база, даты и строгие форматы',async()=>{
  assert.deepEqual(await publishedHistory(db),[]);
  for(const b of [{...draft,title:''},{...draft,section:'private'},{...draft,dateType:'exact',date:'2026-02-30'},{...draft,dateType:'period',period:''},{...draft,sources:[{title:'bad',url:'javascript:alert(1)'}]},{...draft,people:['unknown']},{...draft,gallery:Array(51).fill({src:'/media/history/'+'a'.repeat(48)+'.webp'})}])await assert.rejects(()=>write({...editor,body:b},'save'),{status:422});
  assert.equal(validateHistory({...draft,dateType:'unknown',period:'',date:''}).dateType,'unknown');
 });
 const row=await write(editor,'save');let v=row.version;
 await t.test('Редактор может сохранить, но не опубликовать',async()=>{
  assert.equal(row.status,'draft');assert.equal(logs.length,1);
  await assert.rejects(()=>write({...editor,params:{id:row.id},body:{version:v}},'publish'),{status:403});
 });
 await t.test('50 фото и запрет 51-го, принадлежность, версия',async()=>{
  const src='/media/history/'+'f'.repeat(48)+'.webp';assets.set(path.basename(src),{id:path.basename(src),materialId:row.id,size:5});await fs.writeFile(path.join(config.historyUploadDir,path.basename(src)),'bytes');
  const gallery=Array.from({length:50},(_,i)=>({src,alt:'Фото '+i,caption:'Подпись '+i,credit:'Автор'}));
  assert.equal(validateHistory({...draft,gallery}).gallery.length,50);
  assert.throws(()=>validateHistory({...draft,gallery:[...gallery,gallery[0]]}),{status:422});
  await assert.rejects(()=>write({...editor,params:{id:row.id},body:{...draft,cover:'/media/history/'+'b'.repeat(48)+'.webp',version:v}},'save'),{status:422});
  await assert.rejects(()=>write({...editor,params:{id:row.id},body:{...draft,gallery:[...gallery,gallery[0]],version:v}},'save'),{status:422});
  const updated=await write({...editor,params:{id:row.id},body:{...draft,cover:src,gallery,version:v}},'save');assert.equal(updated.version,2);v=updated.version;
  const media=await listHistoryMedia(db,row.id);assert.deepEqual(media.assets[0].working[0],'Обложка раздела и материала');assert.equal(media.assets[0].canDelete,false);
  await assert.rejects(()=>deleteHistoryMedia(db,config,{params:{id:row.id,file:path.basename(src)},body:{version:v},user:editor.user}),{status:409});
 });
 let slug;
 await t.test('Владелец публикует отдельный снимок; редактор сохраняет независимо',async()=>{
  const published=await write({...owner,params:{id:row.id},body:{version:v}},'publish');v=published.version;slug=published.slug;
  assert.equal(published.status,'published');assert.equal((await publishedHistory(db)).length,1);
  assert.equal(publicHistory(published).body,draft.body);
  const edit=await write({...editor,params:{id:row.id},body:{...draft,title:'СЕКРЕТНОЕИЗМЕНЕНИЕ',body:'НОВЫЙЧЕРНОВИК',cover:'',gallery:[],version:v}},'save');v=edit.version;
  assert.equal(historyDTO(edit).hasChanges,true);assert.equal(publicHistory(edit).body,draft.body);
  await assert.rejects(()=>write({...owner,params:{id:row.id},body:{version:v-1}},'publish'),{status:409});
  assert.equal((await publishedHistory(db))[0].title,draft.title);
  const media=await listHistoryMedia(db,row.id);assert.equal(media.assets[0].working.length,0);assert.equal(media.assets[0].published.length,51);
  await assert.rejects(()=>deleteHistoryMedia(db,config,{params:{id:row.id,file:[...assets.keys()][0]},body:{version:v},user:editor.user}),{status:409});
 });
 await t.test('Связанные записи с неопубликованным статусом исключены; HTML безопасный',async()=>{
  const payload={...draft,people:['person1'],competitions:['event1']};
  let result=await historyConnections(db,payload);assert.deepEqual(result.people,[]);assert.deepEqual(result.competitions,[]);
  db.testPublishedEvents=true;db.testPublishedPeople=true;result=await historyConnections(db,payload);assert.equal(result.people[0].name,'ПУБЛИЧНЫЙПРОФИЛЬ');
  const html=await renderHistoryDetail(config,{...draft,id:row.id,slug,cover:''},result,true);
  assert.ok(html.includes('ИСТОРИЯТЕСТ &lt;script&gt;alert(1)&lt;/script&gt;'));assert.ok(!html.includes('<script>unsafe()</script>'));assert.ok(html.includes('/api/admin/history/media/')===false);
  assert.ok(html.includes('/athlete-profile/athlete1'));assert.ok(html.includes('/competitions/event1'));
  const index=await renderHistoryIndex(config,[{...draft,slug}]);assert.ok(index.includes('ИСТОРИЯТЕСТ &lt;script&gt;'));assert.ok(!index.includes('{{HISTORY_'));assert.ok(!index.includes('Демонстрационная глава'));
 });
 await t.test('Повторная публикация, архивация и восстановление не публикуют автоматически',async()=>{
  const newPublished=await write({...owner,params:{id:row.id},body:{version:v}},'publish');v=newPublished.version;assert.equal(newPublished.slug,slug);assert.equal(publicHistory(newPublished).body,'НОВЫЙЧЕРНОВИК');
  await assert.rejects(()=>write({...editor,params:{id:row.id},body:{version:v}},'archive'),{status:403});
  const archive=await write({...owner,params:{id:row.id},body:{version:v}},'archive');v=archive.version;assert.equal(archive.status,'archived');assert.deepEqual(await publishedHistory(db),[]);
  await assert.rejects(()=>write({...editor,params:{id:row.id},body:{...draft,version:v}},'save'),{status:422});
  const restore=await write({...editor,params:{id:row.id},body:{version:v}},'restore');v=restore.version;assert.equal(restore.status,'draft');assert.equal(restore.publishedPayload,null);assert.deepEqual(await publishedHistory(db),[]);
 });
 await t.test('Неиспользуемый файл удаляется, версии старой формы больше не действуют',async()=>{
  const file=[...assets.keys()][0];const result=await deleteHistoryMedia(db,config,{params:{id:row.id,file},body:{version:v},user:editor.user});assert.equal(result.version,v+1);assert.equal(assets.size,0);await assert.rejects(fs.access(path.join(config.historyUploadDir,file)));await assert.rejects(()=>write({...editor,params:{id:row.id},body:{...draft,version:v}},'save'),{status:409});
 });
});
