const {test}=require('node:test');const assert=require('node:assert/strict');const {JSDOM}=require('jsdom');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..'),script=fs.readFileSync(path.join(root,'site/scripts/contact-button.js'),'utf8');

test('Кнопка: порог 120 px, динамический футер, возврат вверх и повторная инициализация',async t=>{
 const dom=new JSDOM('<!doctype html><html><body><a class="site-call" href="tel:+79233595555">Позвонить</a><div id="site-footer"></div></body></html>',{runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,b=w.document.querySelector('.site-call');let y=0,top=2000,bottom=2300,raf=[];
 Object.defineProperty(w,'scrollY',{get:()=>y});Object.defineProperty(w,'innerHeight',{value:800,writable:true});w.requestAnimationFrame=cb=>{raf.push(cb);return raf.length;};
 const flush=async()=>{await Promise.resolve();const queued=raf;raf=[];queued.forEach(cb=>cb());};
 const scroll=async value=>{y=value;w.dispatchEvent(new w.Event('scroll'));await flush();};
 w.eval(script);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));assert.ok(!b.classList.contains('is-visible'));
 await scroll(119);assert.ok(!b.classList.contains('is-visible'));await scroll(120);assert.ok(b.classList.contains('is-visible'));await scroll(400);assert.ok(b.classList.contains('is-visible'));
 const footer=w.document.createElement('footer');footer.className='footer';footer.getBoundingClientRect=()=>({top,bottom});w.document.querySelector('#site-footer').replaceWith(footer);await flush();assert.ok(b.classList.contains('is-visible'));
 top=799;bottom=1100;w.dispatchEvent(new w.Event('scroll'));await flush();assert.ok(!b.classList.contains('is-visible'));
 top=900;bottom=1200;w.dispatchEvent(new w.Event('scroll'));await flush();assert.ok(b.classList.contains('is-visible'));
 await scroll(0);assert.ok(!b.classList.contains('is-visible'));
 y=300;w.dispatchEvent(new w.Event('pageshow'));await flush();assert.ok(b.classList.contains('is-visible'));
 top=700;w.dispatchEvent(new w.Event('resize'));await flush();assert.ok(!b.classList.contains('is-visible'));
 w.eval(script);assert.equal(w.document.querySelectorAll('.site-call').length,1);assert.equal(b.getAttribute('href'),'tel:+79233595555');
});

test('Все публичные шаблоны с кнопкой подключают ровно один контроллер',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
 for(const file of [...walk(path.join(root,'public')),...walk(path.join(root,'views'))].filter(p=>p.endsWith('.html'))){const text=fs.readFileSync(file,'utf8');if(!text.includes('class="site-call"'))continue;const dom=new JSDOM(text);assert.equal(dom.window.document.querySelectorAll('script[src^="/site/scripts/contact-button.js"]').length,1,file);dom.window.close();}
});
