/* Статический контракт записи: массивы содержат только проверенные материалы.
 * isDemo обязателен; status задаётся редактором (upcoming/completed), не вычисляется по часам посетителя.
 * program: {time,title}[], documents: {title,url}[], results: {title,url}[],
 * photos: {src,caption,category}[], relatedHistory/participants: {title,url}[].
 * URL только локальные /... или HTTPS. Источник и разрешение проверяются перед публикацией.
 */
window.FED_COMPETITIONS = [
  {
    "id": "demo-upcoming",
    "title": "Предстоящий турнир · демо",
    "startDate": "2027-05-25",
    "endDate": "2027-05-27",
    "status": "upcoming",
    "isDemo": true,
    "location": "Условный город · площадка не назначена",
    "image": "/site/img/coach-profile-competition.webp",
    "imageCaption": "Демонстрационная иллюстрация из проекта. Не является фотографией этого события.",
    "description": "Пример анонса: здесь будут условия участия, дисциплины и возрастные категории после согласования положения.",
    "disciplines": [],
    "organizer": null,
    "program": [],
    "documents": [],
    "results": [],
    "photos": [],
    "relatedHistory": [],
    "participants": []
  },
  {
    "id": "demo-completed",
    "title": "Завершённый турнир · демо",
    "startDate": "2026-06-10",
    "endDate": "2026-06-12",
    "status": "completed",
    "isDemo": true,
    "location": "Условная площадка · адрес не указан",
    "image": "/site/img/athlete-demo-action.webp",
    "imageCaption": "Демонстрационная иллюстрация из проекта. Не является фотографией этого события.",
    "description": "Пример завершённого события: здесь будут итоги и сведения об участниках на основании официальных протоколов.",
    "disciplines": [],
    "organizer": null,
    "program": [],
    "documents": [],
    "results": [],
    "photos": [],
    "relatedHistory": [],
    "participants": []
  },
  {
    "id": "demo-archive",
    "title": "Архивный турнир · демо",
    "startDate": "2025-07-01",
    "endDate": "2025-07-05",
    "status": "completed",
    "isDemo": true,
    "location": "Место проведения не подтверждено",
    "image": "/site/img/coach-legend-gallery-02.webp",
    "imageCaption": "Демонстрационная иллюстрация из проекта. Не является фотографией этого события.",
    "description": "Пример архивной записи: карточка сохраняет сведения о событии прошлых лет. Исторические источники пока не предоставлены.",
    "disciplines": [],
    "organizer": null,
    "program": [],
    "documents": [],
    "results": [],
    "photos": [],
    "relatedHistory": [],
    "participants": []
  }
];
