(() => {
 const button=document.querySelector('[data-pwa-retry]'),status=document.querySelector('[data-pwa-status]');
 button.onclick=async()=>{
  button.disabled=true;status.textContent='Проверяем подключение…';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const response=await fetch('/health/live',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();location.replace(location.pathname==='/admin/offline'?'/admin/login':location.pathname==='/pwa/offline'?'/':location.href);}
  catch{status.textContent='Связь пока недоступна. Попробуйте ещё раз.';button.disabled=false;}finally{clearTimeout(timer);}
 };
})();
