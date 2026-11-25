const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const origin='https://kickboxing19.ru';
const id='a'.repeat(48), second='b'.repeat(48);
const row={id:'p',slug:'gloves',published:true,title:'Перчатки </script><script>alert(1)</script>',category:'Экипировка',description:'Описание экипировки',image:id,photos:JSON.stringify([id,second]),variants:JSON.stringify([{code:'old',label:'Недоступен',price:100,available:false},{code:'m',label:'M',price:450050,available:true},{code:'l',label:'L',price:550000,available:true}]),updatedAt:new Date('2026-11-25T00:00:00Z')};
const fakeDb=()=>({shopProduct:{findFirst:async({where})=>where.published&&where.slug===row.slug?row:null,findMany:async({where})=>where.published?[row]:[]},shopSettings:{findUnique:async()=>({enabled:true})},sitePage:{findUnique:async()=>null},...Object.fromEntries(['news','person','competition','historyMaterial','federationDocument'].map(key=>[key,{findMany:async()=>[]}]))});
const get=(g,type)=>g['@graph'].find(n=>n['@type']===type);
const extract=html=>JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

test('Product, Offer, SSR: серверная цена выбранного варианта, галерея и безопасный JSON-LD',async()=>{
 const {pageSeo,injectSeo}=await import('../services/seo.service.js');
 const {shopProduct}=await import('../services/shop.service.js');
 const {renderShop}=await import('../services/shop-render.service.js');
 const meta=await pageSeo(fakeDb(),'/shop/gloves');
 const source=fs.readFileSync(path.join(__dirname,'../public/product.html'),'utf8');
 const html=injectSeo(renderShop(source,{path:'/shop/gloves',query:{},settings:{enabled:true},product:shopProduct(row)}),meta,{indexable:true});
 const graph=extract(html), product=get(graph,'Product');
 assert.equal(product.name,row.title);assert.equal(product.category,row.category);assert.equal(product.description,row.description);
 assert.deepEqual(product.image,[origin+'/media/shop/'+id+'.webp',origin+'/media/shop/'+second+'.webp']);
 assert.deepEqual(product.offers,{'@type':'Offer',priceCurrency:'RUB',price:'4500.50',url:origin+'/shop/gloves'});
 assert.match(html,/data-shop-price[^>]*>4\s500,5\s₽/);
 assert.equal(get(graph,'ItemPage').mainEntity['@id'],product['@id']);
 assert.deepEqual(get(graph,'BreadcrumbList').itemListElement.map(x=>x.item),[origin+'/',origin+'/shop',origin+'/shop/gloves']);
 assert.match(html,/<link rel="canonical" href="https:\/\/kickboxing19\.ru\/shop\/gloves">/);
 assert.match(html,/<meta property="og:type" content="product">/);
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.doesNotMatch(JSON.stringify(product),/InStock|aggregateRating|review|AggregateOffer/);
});
test('Недоступные товары и закрытый приём заявок не обещают продажу; пустая галерея без выдуманных фото',async()=>{
 const {shopSeoMeta,graphFor}=await import('../services/seo.service.js');const {shopProduct}=await import('../services/shop.service.js');
 for(const [product,settings] of [[shopProduct(row),{enabled:false}],[shopProduct({...row,variants:JSON.stringify([{code:'m',label:'M',price:1,available:false}])}),{enabled:true}],[shopProduct({...row,variants:JSON.stringify([{code:'m',label:'M',price:-1,available:true}])}),{enabled:true}]]){
  const meta=shopSeoMeta({path:'/shop/gloves',product,settings});assert.equal(meta.eligible,true);assert.equal(get(graphFor(meta),'Product').offers,undefined);
 }
 const product=shopProduct({...row,image:null,photos:'[]'});
 const meta=shopSeoMeta({path:'/shop/gloves',product,settings:{enabled:true}});
 assert.equal(get(graphFor(meta),'Product').image,undefined);
 assert.equal(shopSeoMeta({path:'/shop/gloves',product:{...product,published:false},settings:{enabled:true}}),null);
});
test('Каталог: ItemList, canonical и noindex фильтров, UTM не создаёт другой canonical',async()=>{
 const {pageSeo,graphFor,injectSeo}=await import('../services/seo.service.js');
 const db=fakeDb(), meta=await pageSeo(db,'/shop');assert.equal(meta.eligible,true);
 assert.equal(get(graphFor(meta),'ItemList').itemListElement[0].url,origin+'/shop/gloves');
 for(const query of [{category:'Экипировка'},{q:'перчатки'},{min:'10'},{max:'100'},{sort:'price-asc'},{category:['one','two']}]){
  const filtered=await pageSeo(db,'/shop',query);assert.equal(filtered.eligible,false);assert.equal(get(graphFor(filtered),'ItemList'),undefined);
  const html=injectSeo('<!doctype html><head><title>Каталог</title></head>',filtered,{indexable:filtered.eligible});
  assert.match(html,/name="robots" content="noindex,follow"/);assert.match(html,/rel="canonical" href="https:\/\/kickboxing19\.ru\/shop"/);
 }
 assert.equal((await pageSeo(db,'/shop',{utm_source:'test'})).eligible,true);
 assert.equal(await pageSeo(db,'/shop/missing'),null);assert.equal(await pageSeo(db,'/cart'),null);
});
test('Sitemap: опубликованный товар с lastmod, без корзины и фильтров; условия production-индексации',async()=>{
 const {publicEntries,indexAllowed}=await import('../services/seo.service.js');const entries=await publicEntries(fakeDb());
 assert.equal(entries.find(x=>x.path==='/shop/gloves').lastmod,row.updatedAt);assert.equal(entries.find(x=>x.path==='/shop/gloves').kind,'product');
 assert.ok(!entries.some(x=>x.path==='/cart'||x.path.includes('?')));
 const config={production:true,seoIndexable:true,origin};const request={get:()=> 'kickboxing19.ru'};
 assert.equal(indexAllowed(config,request),true);assert.equal(indexAllowed({...config,seoIndexable:false},request),false);assert.equal(indexAllowed(config,{get:()=> 'localhost'}),false);
});
test('Middleware использует именно снимок SSR, включая noindex фильтров и корзины',async()=>{
 const {publicSeo}=await import('../middleware/public-seo.js');const {shopSeoMeta}=await import('../services/seo.service.js');
 const {shopProduct}=await import('../services/shop.service.js');
 const config={ROOT:path.resolve(__dirname,'..'),production:true,seoIndexable:true,origin};
 for(const [url,meta,tag] of [['/shop',shopSeoMeta({path:'/shop',query:{sort:'name'},products:[shopProduct(row)]}),'noindex, follow'],['/shop/gloves',shopSeoMeta({path:'/shop/gloves',product:shopProduct(row),settings:{enabled:true}}),'index, follow'],['/cart',null,'noindex, follow']]){
  const headers={};const req={method:'GET',path:url,query:{},get:()=> 'kickboxing19.ru'};
  const result=await new Promise((resolve,reject)=>{
   const res={locals:{publicSeoMeta:meta},statusCode:200,get:()=> 'text/html',set:(k,v)=>{headers[k]=v;},send:resolve};
   publicSeo({db:{sitePage:{findUnique:async()=>null}},config})(req,res,err=>err?reject(err):res.send('<!doctype html><head><title>Page</title></head>'));
  });assert.equal(headers['X-Robots-Tag'],tag);assert.match(result,/name="robots"/);
 }
});
