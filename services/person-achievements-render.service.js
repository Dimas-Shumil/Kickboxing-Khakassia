import {e} from './news-render.service.js';

const levelsByTitle = [
 ['Мир', /(?<!\p{L})(?:мира|миров(?:ой|ого|ом|ая))(?!\p{L})/iu],
 ['Европа', /(?<!\p{L})(?:европы|европейск(?:ий|ого|ом|ая))(?!\p{L})/iu],
 ['Россия', /(?<!\p{L})(?:россии|всероссийск(?:ий|ого|ом|ая))(?!\p{L})/iu],
 ['СФО', /(?<!\p{L})(?:сфо|сибирского федерального округа)(?!\p{L})/iu],
 ['Регион', /(?<!\p{L})(?:хакасии|региональн(?:ый|ого|ом|ая))(?!\p{L})/iu],
 ['Международный', /(?<!\p{L})международн(?:ый|ого|ом|ая)(?!\p{L})/iu],
];

const medalByPlace = {'1':'🥇','2':'🥈','3':'🥉'};
const medalsByTitle = [
 ['🥉', /(?<!\p{L})бронзов(?:ый|ая|ой)(?!\p{L})/iu],
 ['🥈', /(?<!\p{L})серебрян(?:ый|ая|ой)(?!\p{L})/iu],
 ['🥇', /(?<!\p{L})(?:золот(?:ой|ая|ую)|чемпион(?:ка)?)(?!\p{L})/iu],
];

export function renderAchievements(awards, titleId, caption = '') {
 const rows = awards.map(({date, title, text, place, level}) => {
  const awardLevel = level || levelsByTitle.find(([,pattern]) => pattern.test(title))?.[0];
  const medal = medalByPlace[place] || (!place && medalsByTitle.find(([,pattern]) => pattern.test(title))?.[0]);
  const years = [...new Set(date?.match(/(?<!\d)(?:18|19|20|21)\d{2}(?!\d)/g))].join('–');
  const notes = [
   years && date !== years ? date : '',
   text,
   place && (/^\d+$/.test(place) ? place + ' место' : place),
  ].filter(Boolean).join(' · ');

  return `<tr${awardLevel === 'Мир' ? ' class="person-achievements__world"' : ''}>
   <td>${e(years || date || '—')}</td>
   <th scope="row"><div class="person-achievements__result">
    <span class="person-achievements__medal" aria-hidden="true">${medal || ''}</span>
    <div><span class="person-achievements__name">${e(title)}</span>${notes ? `<small class="person-achievements__notes">${e(notes)}</small>` : ''}</div>
   </div></th>
   <td>${e(awardLevel || '—')}</td>
  </tr>`;
 }).join('');

 return `<div class="container person-achievements__layout">
  <div class="person-achievements__heading">
   <span class="person-achievements__eyebrow">Путь к вершинам</span>
   <h2 id="${e(titleId)}">Главные<br>достижения</h2>
   ${caption ? `<p>${e(caption)}</p>` : ''}
  </div>
  ${rows ? `<table class="person-achievements__table" aria-labelledby="${e(titleId)}">
   <thead><tr><th scope="col">Год</th><th scope="col">Достижение</th><th scope="col">Уровень</th></tr></thead>
   <tbody>${rows}</tbody>
  </table>` : '<p class="person-empty">Достижения пока не добавлены.</p>'}
 </div>`;
}
