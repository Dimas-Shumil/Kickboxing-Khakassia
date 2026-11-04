const form=document.querySelector('[data-admin-login-form]'),login=form.elements.login,password=form.elements.password,message=document.querySelector('[data-admin-login-message]'),submit=form.querySelector('[type="submit"]');
const show=text=>{message.textContent=text;message.hidden=false;};
form.addEventListener('submit',async event=>{
 event.preventDefault();message.hidden=true;const body={login:login.value.trim(),password:password.value};if(body.login.length<3||!body.password){show('Введите логин и пароль.');return;}
 submit.disabled=true;login.disabled=true;password.disabled=true;
 try{const response=await fetch('/api/admin/auth/login',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(!response.ok||!data.success)throw Error(data.message||'Не удалось войти.');location.replace('/admin/dashboard');}
 catch(err){password.value='';show(err.message||'Ошибка соединения.');submit.disabled=false;login.disabled=false;password.disabled=false;password.focus();}
});
document.querySelector('[data-password-toggle]').addEventListener('click',event=>{const visible=password.type==='password';password.type=visible?'text':'password';event.currentTarget.textContent=visible?'Скрыть':'Показать';event.currentTarget.setAttribute('aria-pressed',String(visible));});
fetch('/api/admin/auth/session',{credentials:'same-origin',cache:'no-store'}).then(res=>{if(res.ok)location.replace('/admin/dashboard');}).catch(()=>{});
