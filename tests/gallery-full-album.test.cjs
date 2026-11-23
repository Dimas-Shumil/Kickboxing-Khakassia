const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {JSDOM}=require('jsdom');
for(const name of ['athlete','athlete-profile','coach-profile','coach-legend'])test(name+': просмотр всех фото без раскрытия миниатюр',()=>{
 const root=path.join(__dirname,'..'),dom=new JSDOM(fs.readFileSync(path.join(root,'public',name+'.html'),'utf8'),{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;try{
 const coach=name.startsWith('coach'),grid=w.document.querySelector(coach?'[data-coach-gallery]':'[data-gallery-grid]');assert.ok(grid);
 const selector=coach?'button[data-coach-media]':'[data-media-type]';const source=grid.querySelector(selector);assert.ok(source);grid.replaceChildren();
 for(let i=0;i<10;i++){const card=source.cloneNode(true);card.hidden=false;card.dataset.full='/photo-'+i+'.webp';if(coach){card.dataset.category=i%2?'archive':'training';card.dataset.type='image';}else{card.dataset.galleryCategory=i%2?'archive':'training';card.dataset.mediaType='image';}grid.append(card);}
 w.eval(fs.readFileSync(path.join(root,'site/scripts',name+'.js'),'utf8'));w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const cards=[...grid.querySelectorAll(selector)];assert.equal(cards.filter(x=>!x.hidden).length,6);
 cards[0].click();const modal=w.document.querySelector(coach?'[data-coach-lightbox]':'[data-lightbox]'),count=modal.querySelector(coach?'[data-coach-count]':'[data-lightbox-counter]');assert.equal(modal.hidden,false);assert.match(count.textContent,/\/\s*10/);
 const next=modal.querySelector(coach?'[data-coach-next]':'[data-lightbox-next]');for(let i=0;i<9;i++)next.click();assert.match(count.textContent,/10\s*\/\s*10/);assert.ok(modal.querySelector('img').src.endsWith('/photo-9.webp'));
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(modal.hidden,true);assert.equal(cards.filter(x=>!x.hidden).length,6);
 const filter=w.document.querySelector(coach?'[data-coach-filter=training]':'[data-gallery-filter=training]');if(filter){filter.click();cards[0].click();assert.match(count.textContent,/\/\s*0?5/);}
 }finally{w.close();}
});
