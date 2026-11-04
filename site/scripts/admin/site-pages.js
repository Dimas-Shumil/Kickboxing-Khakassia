import {mount} from './common.js';
mount('site-pages',ctx=>{
 const {e,api,btn,feedback}=ctx;
 const names={home:'Главная страница',federation:'О Федерации',contacts:'Контакты'};
 return {render:()=>`<div class="panel"><p class="form-note">Редактор меняет рабочий вариант. Только владелец подтверждает обновление публичной страницы. Автоматические новости, спортсмены и соревнования на главной остаются подключёнными к своим разделам.</p><div id="site-page-list" role="status">Загружаем страницы…</div></div>`,bind:async()=>{try{const data=await api('/api/admin/site/pages');document.querySelector('#site-page-list').innerHTML=ctx.table(['Страница','Состояние','Версия','Действие'],data.pages.map(p=>[e(names[p.key]),p.hasPublished?(p.hasChanges?'Опубликована · есть правки':'Опубликована'):'Не опубликована',String(p.version),btn('Редактировать','/admin/site-page-edit?key='+p.key)]));}catch(err){feedback('Не удалось загрузить страницы: '+err.message,true);}}};
});
