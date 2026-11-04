class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
const bad = message => {throw new HttpError(422,message);};
function text(value, name, max=180, required=false) {if(typeof value !== 'string') {if(value==null&&!required)return '';bad('Проверьте поле «'+name+'».');}const v=value.trim();if(v.length>max || (required&&!v))bad('Проверьте поле «'+name+'».');return v;}
function choice(value,values,name){if(!values.includes(value))bad('Недопустимое значение «'+name+'».');return value;}
function cents(v,zero=false){if(!Number.isSafeInteger(v)||v<(zero?0:1)||v>100000000)bad('Сумма должна быть от '+(zero?'0':'0,01')+' до 1 000 000 ₽, с точностью до копейки.');return v;}
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v<'1900-01-01'||v>'2100-12-31'||(!Number.isFinite(new Date(v+'T00:00:00Z').getTime())||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v))bad('Некорректная дата.');return v;}
function period(v){if(typeof v!=='string'||!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(v)||v>'2100-12')bad('Некорректный оплачиваемый месяц.');return v;}
function version(v){if(!Number.isSafeInteger(v)||v<1)bad('Нет версии записи. Перезагрузите страницу.');return v;}
function student(b){return {name:text(b.name,'ФИО',180,true),phone:text(b.phone,'Телефон',50),parent:text(b.parent,'Родитель',180),start:date(b.start),group:text(b.group,'Группа',120),trainer:text(b.trainer,'Тренер',120),price:cents(b.price,true),status:choice(b.status,['active','paused','finished'],'Статус'),note:text(b.note,'Примечание',10000)};}
function payment(b){return {student:text(b.student,'Ученик',100,true),amount:cents(b.amount),received:date(b.received),period:period(b.period),comment:text(b.comment,'Комментарий',10000)};}
function image(v){v=text(v,'Изображение',300);if(v&&!/^\/site\/img\/[a-zA-Z0-9_.-]+\.(png|jpe?g|webp|gif)$/.test(v))bad('Недопустимый путь изображения.');return v;}
function news(b){const title=text(b.title,'Заголовок',240,true);const status=choice(b.status,['draft','archived'],'Состояние');const sourceUrl=text(b.source?.url,'URL источника',2000);if(sourceUrl){let u;try{u=new URL(sourceUrl);}catch{bad('Некорректный URL источника.');}if(!['http:','https:'].includes(u.protocol))bad('Источник должен использовать http или https.');}
 if(!Array.isArray(b.gallery)||b.gallery.length>30)bad('В галерее допустимо до 30 изображений.');
 const payload={title,status,category:choice(b.category,['Федерация','История','Соревнования'],'Категория'),publishedAt:date(b.publishedAt),author:text(b.author,'Автор',180),lead:text(b.lead,'Анонс',3000,true),text:text(b.text,'Текст',30000,true),cover:image(b.cover),alt:text(b.alt,'Alt',1000),coverCaption:text(b.coverCaption,'Подпись',2000),coverCredit:text(b.coverCredit,'Автор изображения',1000),source:sourceUrl||b.source?.title?{url:sourceUrl,title:text(b.source?.title,'Источник',300)}:null,gallery:b.gallery.map(g=>({src:image(g.src),alt:text(g.alt,'Alt',1000),caption:text(g.caption,'Подпись',2000),source:text(g.source,'Источник',1000)})),isDemo:false};
 return {title,status,payload:JSON.stringify(payload)};
}
export {HttpError,text,date,period,version,student,payment,news};
