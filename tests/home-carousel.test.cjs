const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../site/scripts/main.js'),'utf8');
function setup(){
 const events={},classes=new Set(),captures=new Set();
 const cards=Array.from({length:5},(_,i)=>({offsetLeft:i*180,getBoundingClientRect:()=>({width:165})}));
 const track={clientWidth:345,scrollWidth:885,_left:0,querySelectorAll:()=>cards,
  get scrollLeft(){return this._left;},set scrollLeft(v){this._left=Math.max(0,Math.min(v,540));},
  addEventListener(n,fn){(events[n]??=[]).push(fn);},
  classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},
  setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),
  scrollTo({left}){this.scrollLeft=left;}};
 const controls={};for(const key of ['prev','next'])controls[key]={addEventListener(n,fn){this[n]=fn;}};
 const counter={textContent:''};
 const document={querySelector:s=>s==='[data-athletes-track]'?track:s==='[data-athletes-counter]'?counter:controls[s.includes('prev')?'prev':'next']};
 const start=source.indexOf('  function initAthletesCarousel()'),end=source.indexOf('  function initCompetitionsCoverflow()',start);
 vm.runInNewContext(source.slice(start,end)+'\ninitAthletesCarousel();',{document,window:{matchMedia:()=>({matches:true}),addEventListener(){}},requestAnimationFrame:fn=>{fn();return 0;},setTimeout,clearTimeout});
 const photo={closest:s=>s==='a, button'?photo:null};
 const emit=(type,args={})=>{const e={pointerId:1,pointerType:'touch',button:0,isPrimary:true,clientX:200,clientY:100,target:photo,cancelable:true,preventDefault(){this.prevented=true;},stopPropagation(){},...args};for(const fn of events[type]||[])fn(e);return e;};
 return {track,controls,counter,emit,classes,captures};
}
test('Главная: свайп по фото двигает ленту и блокирует случайное открытие профиля',()=>{
 const s=setup();s.emit('pointerdown');s.emit('pointermove',{clientX:70});assert.equal(s.track.scrollLeft,130);s.emit('pointerup',{clientX:70});assert.equal(s.track.scrollLeft,180);assert.equal(s.captures.size,0);assert.equal(s.emit('click').prevented,true);
});
test('Главная: нажатие на фото сохраняет переход в профиль',()=>{
 const s=setup();s.emit('pointerdown');s.emit('pointermove',{clientX:197});s.emit('pointerup',{clientX:197});assert.equal(s.track.scrollLeft,0);assert.equal(s.emit('click').prevented,undefined);
});
test('Главная: вертикальный жест оставляет прокрутку страницы',()=>{
 const s=setup();s.emit('pointerdown');const e=s.emit('pointermove',{clientX:197,clientY:155});s.emit('pointerup');assert.equal(e.prevented,undefined);assert.equal(s.track.scrollLeft,0);assert.equal(s.captures.size,0);
});
test('Главная: перетаскивание мышью за фото и короткий свайп',()=>{
 const s=setup();s.emit('pointerdown',{pointerType:'mouse'});s.emit('pointermove',{pointerType:'mouse',clientX:155});s.emit('pointerup',{pointerType:'mouse',clientX:155});assert.equal(s.track.scrollLeft,180);
});
test('Главная: обратный свайп, кнопки и границы ленты',()=>{
 const s=setup();s.controls.next.click();assert.equal(s.track.scrollLeft,180);s.emit('scroll');assert.equal(s.counter.textContent,'02 / 05');s.emit('pointerdown');s.emit('pointermove',{clientX:330});s.emit('pointerup',{clientX:330});assert.equal(s.track.scrollLeft,0);s.controls.prev.click();assert.equal(s.track.scrollLeft,0);for(let i=0;i<10;i++)s.controls.next.click();assert.equal(s.track.scrollLeft,540);s.emit('scroll');assert.equal(s.controls.next.disabled,true);
});
test('Главная: отмена освобождает захват и допускает следующий свайп',()=>{
 const s=setup();s.emit('pointerdown');s.emit('pointermove',{clientX:170});s.emit('pointercancel',{clientX:170});assert.equal(s.classes.size,0);assert.equal(s.captures.size,0);s.emit('pointerdown');s.emit('pointermove',{clientX:80});s.emit('pointerup',{clientX:80});assert.equal(s.track.scrollLeft,180);
});
