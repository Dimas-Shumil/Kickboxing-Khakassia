import {mount} from './common.js';
function createPage(ctx){
 const {KEY,uid,params,now,month,e,money,date,period,icon,btn,api,state,bufferKey,canPublish,statuses,newsStatuses,studentName,sortedPayments,receiptTotal,withoutPayment,countBadge,table,paymentRows,stats,tabs,monthInput,gymToolbar,field,area,select,formMessage,saveActions,notFound,feedback,persist,clone,addChange,cents,readForm}=ctx;
 const page="news-preview";
 const setDirty=ctx.setDirty;
 function preview(){const n=params.get('id')==='working'?state.preview:state.news.find(n=>n.id===params.get('id'));if(!n)return notFound();const safeImage=src=>/^(?:\/site\/img\/[a-zA-Z0-9_.-]+|\/media\/news\/[a-f0-9]{48}\.webp)$/.test(src||'');return `<div class="toolbar">${btn('Вернуться к редактированию',params.get('id')==='working'?(state.previewReturn||'/admin/news-edit'):'/admin/news-edit?id='+encodeURIComponent(n.id))}<span class="badge">Закрытый предпросмотр · рабочая версия</span></div><article class="panel article"><p class="muted small">${e(n.category)} · ${date(n.publishedAt)} · Рабочая версия</p><h2>${e(n.title)}</h2>${safeImage(n.cover)?`<figure><img class="cover" src="${e(n.cover?.replace('/media/news/','/api/admin/news/media/'))}" alt="${e(n.alt)}"><figcaption>${e(n.coverCaption)} ${e(n.coverCredit)}</figcaption></figure>`:''}<p><strong>${e(n.lead)}</strong></p><p class="news-preview-text">${e(n.text)}</p>${(n.gallery||[]).filter(g=>safeImage(g.src)).map(g=>`<figure><img class="cover" src="${e(g.src?.replace('/media/news/','/api/admin/news/media/'))}" alt="${e(g.alt)}"><figcaption>${e(g.caption)} ${e(g.source)}</figcaption></figure>`).join('')}<p class="small muted">${n.author?'Автор: '+e(n.author):'Автор не указан'}${n.source?.title?' · Источник: '+e(n.source.title):''}${n.source?.url?' · '+e(n.source.url):''}</p></article>`;}
 return {render:preview,bind(){const form=ctx.form;

}};
}
mount("news-preview",createPage);
