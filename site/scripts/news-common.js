(() => {
 'use strict';
 const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const url = value => typeof value === 'string' && (/^\/(?!\/)/.test(value) || /^https:\/\//.test(value)) ? escape(value) : '';
 const date = value => new Date(value+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
 const sorted = () => [...(window.FED_NEWS || [])].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));
 const href = record => '/public/news-item.html?id='+encodeURIComponent(record.id);
 const meta = record => `<span>${escape(record.category)}</span><time datetime="${escape(record.publishedAt)}">${date(record.publishedAt)}${record.isDemo?' · условная дата':''}</time>`;
 const card = record => `<article class="publication-card"><a class="publication-card__link" href="${href(record)}"><div class="publication-card__visual"><img src="${url(record.cover)}" alt="${escape(record.coverCaption)}" loading="lazy" width="1000" height="650">${record.isDemo?'<span class="publication-card__badge">Демоматериал</span>':''}</div><div class="publication-card__body"><div class="publication-meta">${meta(record)}</div><h3>${escape(record.title)}</h3><p>${escape(record.lead)}</p><span class="publication-card__read">Читать материал</span></div></a></article>`;
 window.FED_NEWS_VIEW = Object.freeze({escape,url,date,sorted,href,meta,card});
})();
