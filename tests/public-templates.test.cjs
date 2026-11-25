const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const config={ROOT};

test('Все семь рабочих SSR-шаблонов находятся в public, без отдельной папки views',()=>{
 assert.equal(fs.existsSync(path.join(ROOT,'views')),false,'Удалите старую папку views после переноса');
 for(const name of ['athlete','athlete-profile','coach-legend','coach-profile','hall-of-fame','coaches','history-item']){
  const html=fs.readFileSync(path.join(ROOT,'public',name+'.html'),'utf8');
  assert.match(html,/\{\{[A-Z_]+\}\}/,name);
  assert.match(html,/class="site-call"/,name);
 }
});

test('Четыре профиля, два каталога и закрытый предпросмотр рендерятся из public',async()=>{
 const {validatePerson,profileType}=await import('../services/people.service.js');
 const {renderPerson,renderPeopleCatalog}=await import('../services/people-render.service.js');
 const person={...validatePerson({name:'Тестовый спортсмен <script>',isAthlete:true,isCoach:true,primaryRole:'athlete',athleteLegend:false,coachLegend:false,athleteAwards:[],coachAwards:[],timeline:[],methods:[],publicPupils:[],gallery:[]}),id:'test',slug:'test-person'};
 for(const role of ['athlete','coach'])for(const legend of [false,true]){
  const data={...person,athleteLegend:legend,coachLegend:legend};
  for(const preview of [false,true]){
   const html=await renderPerson(config,data,role,[data],preview);
   assert.match(html,/Тестовый спортсмен|Тестовый<\/span>/,profileType(data,role));
   assert.doesNotMatch(html,/\{\{[A-Z_]+\}\}/);
   assert.doesNotMatch(html,/Тестовый спортсмен <script>/);
   assert.equal(html.includes('Закрытый предпросмотр'),preview);
  }
 }
 for(const name of ['hall-of-fame','coaches']){
  const html=await renderPeopleCatalog(config,name,[person]);
  assert.match(html,/Тестовый спортсмен/);assert.doesNotMatch(html,/\{\{[A-Z_]+\}\}/);
 }
});

test('Историческая публикация и предпросмотр используют public/history-item.html',async()=>{
 const {renderHistoryDetail}=await import('../services/history-render.service.js');
 const p={id:'test',slug:'test-history',title:'Тестовая история',lead:'Анонс',section:'story',dateType:'unknown',body:'Текст <script>',gallery:[],sources:[],people:[],competitions:[]};
 for(const preview of [false,true]){
  const html=await renderHistoryDetail(config,p,{people:[],competitions:[]},preview);
  assert.match(html,/Тестовая история/);assert.match(html,/Текст &lt;script&gt;/);assert.doesNotMatch(html,/\{\{[A-Z_]+\}\}/);assert.equal(html.includes('Закрытый предпросмотр'),preview);
 }
});

test('Защита сырых SSR-шаблонов распознаёт прямые и закодированные URL',async()=>{
 const {isServerTemplatePath}=await import('../lib/public-templates.js');
 for(const url of ['/history-item.html','/public/history-item.html','/athlete%2ehtml','/%61thlete.html','/coach-profile.html','/COACHES.HTML','/product%2ehtml','/other/../athlete.html','/public%2fathlete.html'])assert.equal(isServerTemplatePath(url),true,url);
 for(const url of ['/','/history/test','/shop/test','/athlete/test','/site/img/photo.webp','/history.html'])assert.equal(isServerTemplatePath(url),false,url);
});
