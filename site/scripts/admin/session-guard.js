/* Та же схема, что в RioCar: API-сессия, CSRF и heartbeat открытой панели. */
(() => {
 let csrfToken='',heartbeatTimer=null,ending=false,expired=false,heartbeatBusy=false;
 const redirect=()=>location.replace('/admin/login');
 function showError(message){let el=document.querySelector('[data-session-message]');if(!el){el=document.createElement('div');el.className='notice notice--error';el.setAttribute('role','alert');el.dataset.sessionMessage='';el.style.margin='16px';document.body.prepend(el);}el.textContent=message;}
 function expire(){if(expired)return;expired=true;clearInterval(heartbeatTimer);showError('Сессия завершилась. Войдите заново в другой вкладке, затем обновите эту страницу. Несохранённые поля пока остаются в форме.');document.dispatchEvent(new CustomEvent('admin:session-expired'));}
 async function requestJson(url,options={}){
  let response;try{response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.method&&options.method!=='GET'?{'X-CSRF-Token':csrfToken}:{}),...options.headers}});}catch{throw new Error('Ошибка соединения. Не удалось подтвердить сохранение; проверьте запись перед повторной отправкой.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){if(response.status===401)expire();const err=new Error(data.message||data.error||'Сервер отклонил запрос.');err.status=response.status;throw err;}
  return data;
 }
 async function sendHeartbeat(){if(ending||expired||heartbeatBusy)return;heartbeatBusy=true;try{const response=await fetch('/api/admin/session/heartbeat',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'X-CSRF-Token':csrfToken}});if(response.status===401)expire();else if(response.status===403)showError('Токен сессии изменился. Обновите страницу перед сохранением.');}catch{/* Не объявляем сетевой сбой выходом из аккаунта. */}finally{heartbeatBusy=false;}}
 async function endSession(){if(ending)return;ending=true;try{await requestJson('/api/admin/auth/logout',{method:'POST'});clearInterval(heartbeatTimer);csrfToken='';redirect();}catch(err){ending=false;showError(err.message);}}
 const ready=(async()=>{try{const response=await fetch('/api/admin/auth/session',{credentials:'same-origin',cache:'no-store'});if(response.status===401){redirect();return false;}if(!response.ok)throw Error('Не удалось проверить сессию.');const data=await response.json();if(!data.authenticated){redirect();return false;}const csrf=await requestJson('/api/admin/auth/csrf',{method:'POST'});csrfToken=csrf.csrfToken;if(typeof csrfToken!=='string'||!csrfToken)throw Error('Не удалось получить CSRF-токен.');heartbeatTimer=setInterval(sendHeartbeat,30000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void sendHeartbeat();});window.addEventListener('online',()=>void sendHeartbeat());return true;}catch(err){showError(err.message);return false;}})();
 window.FederationAdminSession={ready,requestJson,sendHeartbeat,endSession,getCsrfToken:()=>csrfToken};
})();
