const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const settings={enabled:true,policy:'Политика тест',consent:'Согласие тест'};
const product={id:'p',slug:'kimono',title:'Кимоно <script>',category:'Кимоно',description:'Описание {{PRODUCT_NAME}}',image:'/media/shop/cover.webp',photos:Array.from({length:11},(_,i)=>'/media/shop/'+i+'.webp'),variants:[{code:'a1',label:'A1',price:10000,available:true},{code:'a2',label:'A2',price:20000,available:false}]};
async function render(file,url,entity=undefined){
 const {renderShop}=await import('../services/shop-render.service.js');
 const template=readFileSync(path.join(root,'public',file+'.html'),'utf8').replace('{{HEADER}}','').replace('{{FOOTER}}','');
 return renderShop(template,{path:url,query:{},settings,products:[product],product:entity});
}
test('Отдельный шаблон товара: 12 фото, выбранный вариант, экранирование, недоступный вариант',async()=>{
 const html=await render('product','/shop/kimono',product);
 assert.equal((html.match(/data-shop-gallery-src=/g)||[]).length,12);
 assert.match(html,/data-shop-variant value="a1"[^>]*checked/);
 assert.match(html,/data-shop-variant value="a2"[^>]*disabled/);
 assert.match(html,/data-shop-buy/);assert.match(html,/shop-product\.js/);
 assert.match(html,/Кимоно &lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
 assert.match(html,/Описание \{\{PRODUCT_NAME\}\}/); // user text is never reinterpreted
});
test('Каталог: отдельные ссылки и отсутствие быстрого просмотра',async()=>{
 const html=await render('shop','/shop');assert.match(html,/href="\/shop\/kimono"/);assert.doesNotMatch(html,/data-quick/);
});
test('Корзина и юридические документы имеют самостоятельные шаблоны',async()=>{
 const cart=await render('cart','/cart');assert.match(cart,/data-shop-request/);assert.match(cart,/data-shop-receipt/);
 assert.match(await render('shop-policy','/shop-policy'),/Политика тест/);
 assert.match(await render('shop-consent','/shop-consent'),/Согласие тест/);
});
test('Недоступный товар не предлагает добавление в корзину',async()=>{
 const html=await render('product','/shop/kimono',{...product,variants:product.variants.map(v=>({...v,available:false}))});
 assert.match(html,/Товар временно недоступен/);assert.doesNotMatch(html,/data-shop-buy/);
});

test('Каталог: кнопка + отдельна от ссылки, доступные варианты имеют свой код и цену',async()=>{
 const {renderShop}=await import('../services/shop-render.service.js');
 const template=readFileSync(path.join(root,'public','shop.html'),'utf8');
 const entity={...product,variants:[...product.variants,{code:'a3',label:'A3',price:30000,available:true}]};
 const html=renderShop(template,{path:'/shop',query:{},settings,products:[entity]});
 assert.match(html,/data-shop-href="\/shop\/kimono"/);
 assert.match(html,/<button type="button" class="shop-quick-trigger" data-shop-choose="1"/);
 assert.match(html,/data-shop-picker hidden/);
 assert.match(html,/data-shop-pick="a1"/);assert.match(html,/data-shop-pick="a3"/);
 assert.doesNotMatch(html,/data-shop-pick="a2"/);
});

test('Фильтрация: постоянные контейнеры, корректный выбор категории и пустой результат',async()=>{
 const {renderShop}=await import('../services/shop-render.service.js');
 const template=readFileSync(path.join(root,'public','shop.html'),'utf8');
 const other={...product,id:'p2',slug:'gloves',title:'Перчатки',category:'Перчатки'};
 const html=renderShop(template,{path:'/shop',query:{category:'Перчатки',sort:'name'},settings,products:[product,other]});
 assert.match(html,/data-shop-result-count aria-live="polite">Товаров: 1/);
 assert.match(html,/name="category" value="Перчатки"[^>]*checked/);
 assert.match(html,/data-shop-results aria-busy="false"/);
 assert.match(html,/data-shop-href="\/shop\/gloves"/);
 assert.doesNotMatch(html,/data-shop-href="\/shop\/kimono"/);
 const empty=renderShop(template,{path:'/shop',query:{q:'zzz'},settings,products:[product]});
 assert.match(empty,/data-shop-results aria-busy="false"><p class="shop-empty">По выбранным условиям ничего не найдено/);
 const noProducts=renderShop(template,{path:'/shop',query:{},settings,products:[]});
 assert.match(noProducts,/id="shop-catalog-form"/);
 assert.match(noProducts,/data-shop-results aria-busy="false"><p class="shop-empty">Товары пока не опубликованы/);
 assert.match(noProducts,/class="shop-filter__reset" href="\/shop" hidden/);
});
