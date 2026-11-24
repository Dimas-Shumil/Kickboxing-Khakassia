const {test} = require('node:test');
const assert = require('node:assert/strict');
const {mkdtempSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {randomUUID} = require('node:crypto');
const {PrismaClient} = require('@prisma/client');
const sharp = require('sharp');
const {JSDOM} = require('jsdom');

test('Магазин: публичная витрина, согласие, заявка и доступ владельца', async t => {
 const {createApp} = await import('../lib/app.js');
 const {hashPassword} = await import('../services/password.service.js');
 const root = path.resolve(__dirname,'..');
 const dir = mkdtempSync(path.join(tmpdir(),'federation-shop-'));
 const url = 'file:'+path.join(dir,'test.db').replaceAll('\\','/');
 execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{
  cwd:root,env:{...process.env,DATABASE_URL:url,RUST_LOG:'info'},stdio:'pipe'
 });
 const db = new PrismaClient({datasources:{db:{url}}});
 const password = randomUUID();
 const passwordHash = await hashPassword(password);
 await db.admin.createMany({data:[{login:'owner',name:'Владелец',role:'OWNER',passwordHash},{login:'editor',name:'Редактор',role:'EDITOR',passwordHash}]});
 const config = {ROOT:root,shopUploadDir:path.join(dir,'media')};
 const server = await new Promise(resolve=>{const s=createApp(db,config).listen(0,'127.0.0.1',()=>resolve(s));});
 const base = 'http://127.0.0.1:'+server.address().port;
 config.origin = base;
 t.after(async()=>{await new Promise(r=>server.close(r));await db.$disconnect();rmSync(dir,{recursive:true,force:true});});
 const admin = '/api/admin/shop';
 const makeClient = () => {
  let csrf = '', cookie = '';
  return {
   request(route,options={}) {
    const {headers,...rest}=options;
    return fetch(base+route,{redirect:'manual',...rest,headers:{origin:base,'x-csrf-token':csrf,cookie,...headers}});
   },
   json(route,method,body,headers={}) {
    return this.request(route,{method,headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
   },
   async login(login) {
    const response = await this.json('/api/admin/auth/login','POST',{login,password});
    assert.equal(response.status,200);
    cookie=response.headers.getSetCookie().find(value=>value.startsWith('fed_admin_session=')).split(';')[0];
    csrf=(await response.json()).csrfToken;
   }
  };
 };
 const guest=makeClient(),owner=makeClient(),editor=makeClient();
 await owner.login('owner');
 await editor.login('editor');
 let product, photo, settings, consentVersion, request;

 await t.test('Новая база: каталог пуст, заявки закрыты, управление только у владельца',async()=>{
  assert.match(await (await guest.request('/shop')).text(),/Товары пока не опубликованы/);
  assert.match(await (await guest.request('/cart')).text(),/Приём заявок пока закрыт/);
  assert.equal((await guest.request(admin+'/requests')).status,401);
  assert.equal((await editor.request(admin+'/requests')).status,403);
  assert.equal((await editor.request('/admin/shop')).status,403);
  assert.equal((await owner.request('/admin/shop')).status,200);
  assert.equal((await owner.json(admin+'/settings','PUT',{enabled:true,version:0})).status,422);
  assert.equal((await owner.json(admin+'/settings','PUT',{enabled:false,version:0},{'x-csrf-token':'bad'})).status,403);
 });

 await t.test('Загрузка фото, черновик, публикация, фильтрация и безопасная SSR-разметка',async()=>{
  const image=await sharp({create:{width:24,height:24,channels:3,background:'#313a75'}}).png().toBuffer();
  const upload=await owner.request(admin+'/images',{method:'POST',headers:{'Content-Type':'image/png'},body:image});
  assert.equal(upload.status,201);
  photo=(await upload.json()).id;
  const values={title:'Перчатки <b>Спорт</b>',slug:'gloves',category:'Экипировка',description:'Проверочное описание',image:photo,published:false,variants:[
   {code:'m',label:'Размер M',price:125000,available:true},{code:'l',label:'Размер L',price:142000,available:false}
  ]};
  const create=await owner.json(admin+'/products','POST',values);
  assert.equal(create.status,201);
  product=(await create.json()).entity;
  const imageUrl='/media/shop/'+photo+'.webp';
  assert.equal((await guest.request(imageUrl)).status,404);
  assert.equal((await guest.request('/shop/gloves')).status,404);
  const publish=await owner.json(admin+'/products/'+product.id,'PATCH',{...values,published:true,version:1});
  assert.equal(publish.status,200);
  product=(await publish.json()).entity;
  assert.equal((await guest.request(imageUrl)).headers.get('content-type'),'image/webp');
  const detail=await guest.request('/shop/gloves');
  const dom=new JSDOM(await detail.text()).window.document;
  assert.equal(dom.querySelector('h1').textContent,values.title);
  assert.equal(dom.querySelector('h1 b'),null);
  assert.equal(dom.querySelector('option[value=l]').disabled,true);
  assert.match(await (await guest.request('/shop?q=перчатки')).text(),/gloves/);
  assert.match(await (await guest.request('/shop?q=другое')).text(),/ничего не найдено/);
  const header=await (await guest.request('/components/header.html')).text();
  assert.match(header,/href="\/cart"/);
  assert.match(header,/href="\/shop"/);
 });

 await t.test('Отдельное согласие, сверка суммы на сервере, повтор запроса и приватный список',async()=>{
  const data={version:0,operator:'Данные тестового оператора',inn:'0000000000',address:'Тестовый адрес',contact:'contact@example.test',policy:'Проверка политики',consent:'Проверка согласия',enabled:true};
  settings=(await (await owner.json(admin+'/settings','PUT',data)).json()).settings;
  assert.equal(settings.enabled,true);
  const html=await (await guest.request('/cart')).text();
  const doc=new JSDOM(html).window.document;
  consentVersion=doc.querySelector('[data-shop-request]').dataset.consentVersion;
  assert.match(html,/не является публичной офертой/);
  assert.match(await (await guest.request('/shop-policy')).text(),/Проверка политики/);
  assert.match(await (await guest.request('/shop-consent')).text(),/Проверка согласия/);
  const checkout={key:randomUUID(),name:'Тестовый покупатель',phone:'+7 900 000-00-00',consent:true,consentVersion,items:[{id:product.id,code:'m',quantity:2,price:125000}]};
  assert.equal((await guest.json('/api/shop/requests','POST',checkout,{origin:'https://other.test'})).status,403);
  assert.equal((await guest.json('/api/shop/requests','POST',{...checkout,consent:false})).status,422);
  assert.equal((await guest.json('/api/shop/requests','POST',{...checkout,consentVersion:'old'})).status,409);
  assert.equal((await guest.json('/api/shop/requests','POST',{...checkout,items:[{...checkout.items[0],price:1}]})).status,409);
  const response=await guest.json('/api/shop/requests','POST',checkout);
  assert.equal(response.status,201);
  assert.equal(response.headers.get('cache-control'),'no-store');
  const {number}=await response.json();
  assert.equal((await (await guest.json('/api/shop/requests','POST',checkout)).json()).number,number);
  const privateList=await owner.request(admin+'/requests');
  assert.equal(privateList.headers.get('cache-control'),'no-store');
  const {requests}=await privateList.json();
  assert.equal(requests.length,1);
  request=requests[0];
  assert.equal(request.total,250000);
  assert.equal(JSON.parse(request.items)[0].label,'Размер M');
  assert.doesNotMatch(await (await guest.request('/api/shop/products')).text(),/9000000000|Тестовый покупатель/);
  assert.equal((await owner.json(admin+'/requests/'+request.id,'PATCH',{status:'closed',previous:'review'})).status,409);
  assert.equal((await owner.json(admin+'/requests/'+request.id,'PATCH',{status:'closed',previous:'new'})).status,200);
  const requestPath=admin+'/requests/'+request.id;
  const productPath=admin+'/products/'+product.id;
  assert.equal((await guest.json(requestPath,'DELETE',{previous:'closed'})).status,401);
  assert.equal((await editor.json(requestPath,'DELETE',{previous:'closed'})).status,403);
  assert.equal((await owner.json(requestPath,'DELETE',{previous:'closed'},{'x-csrf-token':'bad'})).status,403);
  assert.equal((await owner.json(requestPath,'DELETE',{previous:'new'})).status,409);
  assert.equal((await owner.json(requestPath,'DELETE',{})).status,422);
  assert.equal((await owner.json(requestPath,'DELETE',{previous:'closed'})).status,200);
  assert.equal((await owner.json(requestPath,'DELETE',{previous:'closed'})).status,409);
  for (const status of ['new','review','agreed']) {
   const created=await guest.json('/api/shop/requests','POST',{...checkout,key:randomUUID()});
   assert.equal(created.status,201);
   const active=(await (await owner.request(admin+'/requests')).json()).requests[0];
   if(status!=='new') assert.equal((await owner.json(admin+'/requests/'+active.id,'PATCH',{status,previous:'new'})).status,200);
   if(status==='agreed') {
    assert.equal((await editor.json(productPath,'DELETE',{version:product.version})).status,403);
    assert.equal((await owner.json(productPath,'DELETE',{version:product.version},{'x-csrf-token':'bad'})).status,403);
    assert.equal((await owner.json(productPath,'DELETE',{version:product.version+1})).status,409);
    assert.equal((await owner.json(productPath,'DELETE',{version:product.version})).status,200);
    assert.equal((await guest.request('/shop/gloves')).status,404);
    assert.equal((await guest.request('/media/shop/'+photo+'.webp')).status,404);
    const snapshot=(await (await owner.request(admin+'/requests')).json()).requests[0];
    assert.equal(snapshot.id,active.id);
    assert.equal(snapshot.items,active.items);
   }
   assert.equal((await owner.json(admin+'/requests/'+active.id,'DELETE',{previous:status})).status,200);
  }
  assert.deepEqual((await (await owner.request(admin+'/requests')).json()).requests,[]);
 });
});

test('Каталог фильтрует цены и быстрый просмотр добавляет выбранный вариант',async()=>{
 const {readFileSync}=require('node:fs');
 const {renderShop}=await import('../services/shop-render.service.js');
 const template=readFileSync(path.resolve(__dirname,'../views/shop.html'),'utf8');
 const script=readFileSync(path.resolve(__dirname,'../site/scripts/shop.js'),'utf8');
 const variants=[{code:'standard',label:'Стандарт',price:65000,available:true}];
 const gloves={id:'g',slug:'gloves',title:'Перчатки',category:'Экипировка',variants:[
  {code:'10oz',label:'10 oz',price:430000,available:true},{code:'12oz',label:'12 oz',price:480000,available:true}]};
 const wraps={id:'w',slug:'wraps',title:'Бинты',category:'Аксессуары',variants};
 const page=query=>renderShop(template,{path:'/shop',query,settings:{},products:[gloves,wraps]});
 const filtered=new JSDOM(page({min:'4000',max:'4500'})).window.document;
 assert.deepEqual([...filtered.querySelectorAll('.shop-card h2')].map(node=>node.textContent),['Перчатки']);
 assert.equal(filtered.querySelector('[name="min"]').form.id,'shop-catalog-form');
 const {window}=new JSDOM(page({sort:'price-asc'}),{url:'http://localhost:3000/shop',runScripts:'outside-only'});
 const {document}=window;
 window.matchMedia=()=>({matches:false,addEventListener(){}});
 window.eval(script);
 const cards=document.querySelectorAll('[data-shop-card]');
 assert.deepEqual([...cards].map(node=>node.querySelector('h2').textContent),['Бинты','Перчатки']);
 cards[1].querySelector('[data-quick-open]').click();
 const panel=document.querySelector('[data-quick-panel]');
 assert.equal(panel.querySelector('h2').textContent,'Перчатки');
 panel.querySelector('[value="12oz"]').click();
 assert.match(panel.querySelector('[data-quick-price]').textContent,/4\s*800/);
 panel.querySelector('[data-shop-add]').click();
 assert.deepEqual(JSON.parse(window.localStorage.getItem('fed-shop-cart-v1')),[{id:'g',code:'12oz',quantity:1}]);
 window.close();
});

test('Корзина сохраняется при ошибке и показывает номер после подтверждения',async()=>{
 const {readFileSync}=require('node:fs');
 const {renderShop}=await import('../services/shop-render.service.js');
 const template=readFileSync(path.resolve(__dirname,'../views/shop.html'),'utf8');
 const script=readFileSync(path.resolve(__dirname,'../site/scripts/shop.js'),'utf8');
 const product={id:'gloves',slug:'gloves',title:'Перчатки',variants:[{code:'m',label:'M',price:430000,available:true}]};
 const html=renderShop(template,{path:'/cart',settings:{enabled:true}});
 const {window}=new JSDOM(html,{url:'http://localhost:3000/cart',runScripts:'outside-only'});
 const {document}=window;
 const storage='fed-shop-cart-v1';
 window.matchMedia=()=>({matches:false,addEventListener(){}});
 window.localStorage.setItem(storage,JSON.stringify([{id:'gloves',code:'m',quantity:1}]));
 const keys=[];
 window.fetch=async(_url,options)=>{
  if(!options?.body)return {ok:true,json:async()=>({products:[product]})};
  keys.push(JSON.parse(options.body).key);
  if(keys.length===1)throw new window.TypeError('Offline');
  return {ok:true,status:201,json:async()=>({number:'AB12'})};
 };
 window.eval(script);
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 await tick();
 const form=document.querySelector('[data-shop-request]');
 form.elements.name.value='Тест';
 form.elements.phone.value='+7 000 000-00-00';
 form.elements.consent.checked=true;
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 await tick();
 assert.equal(document.querySelector('[data-shop-cart]').hidden,false);
 assert.match(document.querySelector('[data-shop-result]').textContent,/Не удалось проверить/);
 assert.equal(form.elements.name.value,'Тест');
 assert.equal(JSON.parse(window.localStorage.getItem(storage)).length,1);
 form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
 await tick();
 assert.equal(keys[0],keys[1]);
 assert.equal(document.querySelector('[data-shop-cart]').hidden,true);
 assert.equal(document.querySelector('[data-shop-receipt]').hidden,false);
 assert.equal(document.querySelector('[data-shop-request-number]').textContent,'AB12');
 assert.equal(document.activeElement.id,'shop-receipt-title');
 assert.deepEqual(JSON.parse(window.localStorage.getItem(storage)),[]);
 window.close();
});
