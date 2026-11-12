/* Та же схема, что в RioCar: API-сессия, CSRF и heartbeat открытой панели. */
(() => {
 let csrfToken='',heartbeatTimer=null,ending=false,expired=false,heartbeatBusy=false;
 let accountId=null,rechecking=false;
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('fkh19-admin-session'):null;
 const lock=()=>{document.documentElement.classList.add('admin-locked');};
 const unlock=()=>document.documentElement.classList.remove('admin-locked');
 const redirect=()=>{lock();document.querySelector('#admin-root')?.replaceChildren();location.replace('/admin/login');};
 async function recheck(){
  if(rechecking||expired||ending)return;rechecking=true;lock();
  try{const response=await fetch('/api/admin/auth/session',{credentials:'same-origin',cache:'no-store'});
   if(response.status===401){expire();return;}
   if(!response.ok)throw Error();const data=await response.json();
   if(!data.authenticated||data.admin?.id!==accountId){expire();return;}unlock();
  }catch{showError('Для работы нужно подключение. Подключитесь к интернету и вернитесь в окно приложения.');}
  finally{rechecking=false;}
 }
 window.addEventListener('pagehide',lock);
 window.addEventListener('pageshow',event=>{if(event.persisted)void recheck();});
 window.addEventListener('offline',()=>{lock();showError('Нет сети. Для работы панели нужно подключение.');});
 window.addEventListener('online',()=>void recheck());
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')lock();else if(accountId)void recheck();});
 if(channel)channel.onmessage=()=>expire();
 function showError(message){let el=document.querySelector('[data-session-message]');if(!el){el=document.createElement('div');el.className='notice notice--error';el.setAttribute('role','alert');el.dataset.sessionMessage='';el.dataset.sessionLock='';el.style.margin='16px';document.body.prepend(el);}el.textContent=message;}
 function expire(){if(expired)return;expired=true;clearInterval(heartbeatTimer);csrfToken='';document.dispatchEvent(new CustomEvent('admin:session-expired'));redirect();}
 async function requestJson(url,options={}){
  let response;try{response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json',...(options.method&&options.method!=='GET'?{'X-CSRF-Token':csrfToken}:{}),...options.headers}});}catch{throw new Error('Ошибка соединения. Не удалось подтвердить сохранение; проверьте запись перед повторной отправкой.');}
  const data=await response.json().catch(()=>({}));
  if(!response.ok){if(response.status===401)expire();const err=new Error(data.message||data.error||'Сервер отклонил запрос.');err.status=response.status;throw err;}
  return data;
 }
 async function sendHeartbeat(){if(ending||expired||heartbeatBusy)return;heartbeatBusy=true;try{const response=await fetch('/api/admin/session/heartbeat',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'X-CSRF-Token':csrfToken}});if(response.status===401)expire();else if(response.status===403)showError('Токен сессии изменился. Обновите страницу перед сохранением.');}catch{/* Не объявляем сетевой сбой выходом из аккаунта. */}finally{heartbeatBusy=false;}}
 async function endSession(){if(ending)return;ending=true;try{await requestJson('/api/admin/auth/logout',{method:'POST'});clearInterval(heartbeatTimer);csrfToken='';channel?.postMessage('logout');redirect();}catch(err){ending=false;showError(err.message);}}
 const ready=(async()=>{try{const response=await fetch('/api/admin/auth/session',{credentials:'same-origin',cache:'no-store'});if(response.status===401){redirect();return false;}if(!response.ok)throw Error('Не удалось проверить сессию.');const data=await response.json();if(!data.authenticated){redirect();return false;}accountId=data.admin?.id;const csrf=await requestJson('/api/admin/auth/csrf',{method:'POST'});csrfToken=csrf.csrfToken;if(typeof csrfToken!=='string'||!csrfToken)throw Error('Не удалось получить CSRF-токен.');heartbeatTimer=setInterval(sendHeartbeat,30000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void sendHeartbeat();});window.addEventListener('online',()=>void sendHeartbeat());return true;}catch(err){showError(err.message);return false;}})();
 window.FederationAdminSession={ready,requestJson,sendHeartbeat,endSession,getCsrfToken:()=>csrfToken};
})();
