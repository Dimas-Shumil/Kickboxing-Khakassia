const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.join(__dirname,'..');
const script=fs.readFileSync(path.join(root,'site/scripts/photo-gallery.js'),'utf8');

const pages=[
 'public/athlete.html','public/athlete-profile.html','public/coach-profile.html','public/coach-legend.html',
 'public/history.html','views/history/detail.html','public/news-item.html','public/competition.html',
];

for(const file of pages)test(file+' · единый просмотр галереи',()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(root,file),'utf8'),{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
 const {window:w}=dom, {document:d}=w;
 try{
  assert.ok(d.querySelector('script[src^="/site/scripts/photo-gallery.js"]'));
  const modal=d.querySelector('[data-lightbox], [data-coach-lightbox]');
  const coach=modal.hasAttribute('data-coach-lightbox');
  let grid=d.querySelector('[data-gallery-grid], [data-coach-gallery]');
  // News, competitions and history details receive their grid from server-rendered content.
  if(!grid){grid=d.createElement('div');grid.setAttribute('data-gallery-grid','');d.body.append(grid);}
  const more=d.querySelector('[data-coach-more], [data-gallery-more]');
  const thumbnailCount=more?6:10;
  grid.replaceChildren();
  const cards=Array.from({length:10},(_,i)=>{
   const card=d.createElement('button');
   card.dataset.full='/photo-'+i+'.webp';
   if(coach){card.dataset.coachMedia='';card.dataset.category=i%2?'archive':'training';}
   else {card.dataset.mediaType='image';card.dataset.galleryCategory=i%2?'archive':'training';}
   grid.append(card);
   return card;
  });
  w.eval(script);
  d.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.equal(cards.filter(x=>!x.hidden).length,thumbnailCount);
  cards[4].click();
  const counter=modal.querySelector('[data-coach-count], [data-lightbox-counter]');
  const stage=modal.querySelector('[data-coach-stage], [data-lightbox-stage]');
  const next=modal.querySelector('[data-coach-next], [data-lightbox-next]');
  assert.equal(counter.textContent,'05 / 10');
  assert.equal(next.textContent,'›');
  function pointer(type,x,y){
   const event=new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y});
   Object.defineProperties(event,{isPrimary:{value:true},pointerId:{value:7}});
   stage.dispatchEvent(event);
  }
  pointer('pointerdown',180,100);pointer('pointerup',120,100);
  assert.equal(counter.textContent,'06 / 10');
  pointer('pointerdown',180,100);pointer('pointerup',120,100);
  assert.equal(counter.textContent,'07 / 10');
  assert.ok(modal.querySelector('img').src.endsWith('/photo-6.webp'));
  pointer('pointerdown',180,100);pointer('pointerup',176,180);
  assert.equal(counter.textContent,'07 / 10');
  next.click();
  assert.equal(counter.textContent,'08 / 10');
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));
  assert.equal(modal.hidden,true);
  assert.equal(d.activeElement,cards[4]);
  assert.equal(cards.filter(x=>!x.hidden).length,thumbnailCount);
 }finally{w.close();}
});

test('Быстрое листание сохраняет показанный кадр до загрузки и игнорирует запоздавший кадр',async()=>{
 const dom=new JSDOM(fs.readFileSync(path.join(root,pages[0]),'utf8'),{url:'http://localhost/',runScripts:'outside-only'});
 const {window:w}=dom, {document:d}=w;
 try{
  const finish=new Map();
  w.HTMLImageElement.prototype.decode=function(){return new Promise(resolve=>finish.set(this.src,resolve));};
  w.eval(script);
  d.dispatchEvent(new w.Event('DOMContentLoaded'));
  const items=[...d.querySelectorAll('[data-gallery-grid] [data-media-type="image"]')];
  items[0].click();
  const next=d.querySelector('[data-lightbox-next]');
  const media=d.querySelector('[data-lightbox-media]');
  const complete=async i=>{finish.get(new URL(items[i].dataset.full,w.location).href)();await new Promise(resolve=>setImmediate(resolve));};
  await complete(0);
  const original=media.firstChild;
  next.click();next.click();
  assert.equal(media.firstChild,original);
  await complete(2);
  assert.equal(media.firstChild.src,new URL(items[2].dataset.full,w.location).href);
  await complete(1);
  assert.equal(media.firstChild.src,new URL(items[2].dataset.full,w.location).href);
 }finally{w.close();}
});
