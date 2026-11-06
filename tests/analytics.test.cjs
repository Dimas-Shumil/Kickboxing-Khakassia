const {test}=require('node:test');
const assert=require('node:assert/strict');
const service=import('../services/analytics.service.js');
const live=(payload,status='published',publishedPayload=payload)=>({status,payload,publishedPayload});
const stamp=value=>new Date(value);
function mock(){
 const audit=[
  {id:'a1',scope:'news',action:'publish',actorId:'admin1',entityId:'n1',createdAt:stamp('2026-11-05T11:00:00Z')},
  {id:'a2',scope:'payments',action:'update',actorId:'admin1',entityId:'p1',createdAt:stamp('2026-11-06T11:00:00Z')},
  {id:'a3',scope:'gym-sessions',action:'create',actorId:'admin1',entityId:'s1',createdAt:stamp('2026-11-06T12:00:00Z')},
  {id:'a4',scope:'news',action:'update',actorId:'admin2',entityId:'n1',createdAt:stamp('2026-10-12T12:00:00Z')}
 ];
 const rows={
  news:[live('published'),live('revised','published','old'),live('draft','draft',null),live('archive','archived',null)],
  person:[live('p1')],competition:[],historyMaterial:[live('h1','draft',null)],
  federationDocument:[live('d1')],sitePage:[{payload:'A',publishedPayload:'A'},{payload:'B',publishedPayload:null}]
 };
 let privateReads=0;
 const models=Object.fromEntries(Object.entries(rows).map(([key,val])=>[key,{async findMany(){return val;}}]));
 const scopeFilter=(row,where)=>{
  if(where?.scope?.in&&!where.scope.in.includes(row.scope))return false;
  if(where?.action&&where.action!==row.action)return false;
  if(where?.createdAt?.gte&&row.createdAt<where.createdAt.gte)return false;
  if(where?.createdAt?.lt&&row.createdAt>=where.createdAt.lt)return false;
  return true;
 };
 const db={...models,
  auditLog:{
   async count({where}){return audit.filter(x=>scopeFilter(x,where)).length;},
   async groupBy({where}){const groups=new Map();for(const item of audit.filter(x=>scopeFilter(x,where))){const key=item.scope+'|'+item.action;groups.set(key,(groups.get(key)||0)+1);}return [...groups].map(([name,count])=>({scope:name.split('|')[0],action:name.split('|')[1],_count:{_all:count}}));},
   async findMany({where,skip,take}){return audit.filter(x=>scopeFilter(x,where)).sort((a,b)=>b.createdAt-a.createdAt).slice(skip,skip+take);}
  },
  admin:{async findMany(){return [{id:'admin1',name:'Владелец'},{id:'admin2',name:'Редактор'}];}},
  student:{async count(){privateReads++;return 1;}},
  trainingGroup:{async count(){privateReads++;return 2;}},
  gymSession:{async findMany(){privateReads++;return [
   {heldOn:'2026-11-04',status:'held',attendance:[{status:'present'},{status:'excused'}]},
   {heldOn:'2026-11-12',status:'held',attendance:[{status:'present'},{status:'absent'}]},
   {heldOn:'2026-11-18',status:'planned',attendance:[]}
  ];}},
  payment:{async findMany(){privateReads++;return [{received:'2026-11-05',amount:30000},{received:'2026-11-12',amount:12000}];}}
 };
 return {db,get privateReads(){return privateReads;}};
}
test('08.10: месяцы рассчитываются по часовому поясу Хакасии, даты строгие',async()=>{
 const a=await service;const {from,to}=a.monthWindow('2026-11');
 assert.equal(from.toISOString(),'2026-10-31T17:00:00.000Z');
 assert.equal(to.toISOString(),'2026-11-30T17:00:00.000Z');
 assert.equal(a.monthWindow('2026-12').to.toISOString(),'2026-12-31T17:00:00.000Z');
 assert.throws(()=>a.monthWindow('2026-13'),x=>x.status===422);
});
test('08.10: контент считает опубликованные снимки, архивы и рабочие обновления отдельно',async()=>{
 const a=await service,m=mock(),data=await a.analyticsOverview(m.db,'EDITOR','2026-11');
 assert.equal(m.privateReads,0,'Редактор не должен даже запрашивать данные зала');
 assert.equal(Object.hasOwn(data,'gym'),false);
 assert.deepEqual(data.content[0],{key:'news',label:'Новости',href:'/admin/news',total:4,published:2,unpublished:1,archived:1,pendingUpdates:1});
 assert.equal(data.content.find(x=>x.key==='site-page').published,1);
 assert.equal(data.content.find(x=>x.key==='site-document').published,1);
 assert.equal(data.activity.total,1,'Приватный журнал и события за прошлый месяц исключены');
 assert.equal(data.activity.byAction.published,1);
 assert.equal(data.activity.byScope.payments,undefined);
});
test('08.10: владелец видит поступления по received и присутствия по конкретным неделям, без долгов',async()=>{
 const a=await service,m=mock(),data=await a.analyticsOverview(m.db,'OWNER','2026-11');
 assert.equal(m.privateReads,4);
 assert.equal(data.activity.total,3);
 assert.equal(data.gym.receivedCents,42000);
 assert.equal(data.gym.paymentsCount,2);
 assert.equal(data.gym.present,2);
 assert.equal(data.gym.marked,4);
 assert.equal(data.gym.absent,1);
 assert.equal(data.gym.weekly.length,5);
 assert.equal(data.gym.weekly[0].receivedCents,30000);
 assert.equal(data.gym.weekly[1].receivedCents,12000);
 assert.equal(data.gym.weekly[0].present,1);
 assert.equal(data.gym.weekly[1].present,1);
 assert.equal(data.gym.debt,undefined);
});
test('08.10: февраль не содержит фиктивной пятой недели',async()=>{
 const a=await service,m=mock(),data=await a.analyticsOverview(m.db,'OWNER','2027-02');
 assert.equal(data.gym.weekly.length,4);
 assert.equal(data.gym.weekly[3].label,'22–28');
});
test('08.10: приватные разделы журнала закрыты редактору, фильтры валидируются',async()=>{
 const a=await service;
 assert.throws(()=>a.parseActivityFilter({month:'2026-11',scope:'payments'},'EDITOR'),x=>x.status===403);
 assert.throws(()=>a.parseActivityFilter({month:'2026-11',scope:'students'},'EDITOR'),x=>x.status===403);
 assert.throws(()=>a.parseActivityFilter({month:'2026-11',scope:'invalid'},'OWNER'),x=>x.status===422);
 assert.throws(()=>a.parseActivityFilter({month:'2026-11',action:'UNKNOWN'},'OWNER'),x=>x.status===422);
 assert.throws(()=>a.parseActivityFilter({month:'2026-11',page:1000},'OWNER'),x=>x.status===422);
});
test('08.10: пагинация и журнал не раскрывают ID приватных записей редактору',async()=>{
 const a=await service,m=mock();
 const query=a.parseActivityFilter({month:'2026-11'},'EDITOR');
 const events=await a.analyticsActivity(m.db,'EDITOR',query);
 assert.equal(events.total,1);assert.equal(events.entries.length,1);assert.equal(events.entries[0].actor,'Владелец');
 assert.equal(events.entries[0].href,'/admin/news-edit?id=n1');
 assert.ok(!JSON.stringify(events).includes('p1'));
 const owner=await a.analyticsActivity(m.db,'OWNER',a.parseActivityFilter({month:'2026-11',scope:'payments'},'OWNER'));
 assert.equal(owner.total,1);assert.equal(owner.entries[0].href,'/admin/payment?id=p1');
});
