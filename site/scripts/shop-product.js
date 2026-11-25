// Keep the current photo visible until the next one has loaded and decoded.
const productGallery=document.querySelector('[data-shop-gallery]');
if(productGallery){
 const buttons=[...productGallery.querySelectorAll('[data-shop-gallery-src]')];
 const main=productGallery.querySelector('.shop-product__image img');
 const counter=productGallery.querySelector('[data-shop-image-count]');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let index=0,requested=0,revision=0,startX=0,startY=0,previous=null;
 function revealThumb(thumb){
  const list=thumb.parentElement,rect=list.getBoundingClientRect(),item=thumb.getBoundingClientRect();
  const left=item.left<rect.left?item.left-rect.left:item.right>rect.right?item.right-rect.right:0;
  const top=item.top<rect.top?item.top-rect.top:item.bottom>rect.bottom?item.bottom-rect.bottom:0;
  if(left||top)list.scrollBy({left,top,behavior:reduced.matches?'instant':'smooth'});
 }
 async function select(indexToShow){
  if(!main||!buttons.length)return;
  requested=(indexToShow+buttons.length)%buttons.length;
  const target=requested,token=++revision;
  if(target===index)return;
  const candidate=new Image();
  candidate.src=buttons[target].dataset.shopGallerySrc;
  try{await candidate.decode();}catch{if(token===revision)requested=index;return;}
  if(token!==revision)return;
  previous?.remove();previous=null;
  if(!reduced.matches&&typeof main.animate==='function'){
   const layer=main.cloneNode();layer.classList.add('shop-gallery-previous');layer.alt='';layer.setAttribute('aria-hidden','true');
   main.after(layer);previous=layer;
   const fade=layer.animate([{opacity:1},{opacity:0}],{duration:240,easing:'cubic-bezier(.22,.61,.36,1)',fill:'forwards'});
   fade.onfinish=()=>{layer.remove();if(previous===layer)previous=null;};
  }
  main.src=candidate.src;index=target;
  buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  if(counter)counter.textContent=`${index+1} / ${buttons.length}`;
  revealThumb(buttons[index]);
 }
 buttons.forEach((button,i)=>button.addEventListener('click',()=>select(i)));
 main?.addEventListener('touchstart',event=>{startX=event.touches[0].clientX;startY=event.touches[0].clientY;},{passive:true});
 main?.addEventListener('touchend',event=>{const touch=event.changedTouches[0],dx=touch.clientX-startX,dy=touch.clientY-startY;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))select(requested+(dx<0?1:-1));},{passive:true});
}
