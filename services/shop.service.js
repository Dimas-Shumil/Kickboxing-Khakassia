import {createHash, randomBytes} from 'node:crypto';
import {HttpError, text, version} from '../lib/validation.js';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const imageId = /^[a-f0-9]{48}$/;
export const requestStatuses = ['new', 'review', 'agreed', 'closed'];
export const shopNotice = 'Каталог носит информационный характер и не является публичной офертой. Отправка заявки не заключает договор. Наличие, итоговую стоимость и способ получения согласуем отдельно.';
const fail = (status, message) => { throw new HttpError(status, message); };
const quantity = value => Number.isInteger(value) && value >= 1 && value <= 20;
const price = value => Number.isInteger(value) && value >= 1 && value <= 100000000;
const variantCode = /^[a-z0-9-]{1,32}$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function getShopSettings(db) {
 return await db.shopSettings.findUnique({where:{id:1}}) ||
  {operator:'',address:'',inn:'',contact:'',policy:'',consent:'',enabled:false,version:0};
}

export function consentVersion(settings) {
 return digest([shopNotice, settings.operator, settings.address, settings.inn, settings.contact, settings.policy, settings.consent]);
}

export async function saveSettings(db, body) {
 const data = Object.fromEntries(Object.entries({operator:240,address:400,inn:12,contact:240,policy:20000,consent:12000})
  .map(([key,max]) => [key,text(body[key],key,max)]));
 data.enabled = body.enabled === true;
 if (data.inn && !/^(?:\d{10}|\d{12})$/.test(data.inn)) fail(422,'ИНН должен содержать 10 или 12 цифр.');
 if (data.enabled && Object.values(data).some(value => value === '')) fail(422,'Заполните реквизиты, политику и текст согласия.');
 try {
  if (body.version === 0) return await db.shopSettings.create({data:{id:1,...data}});
  const result = await db.shopSettings.updateMany({where:{id:1,version:version(body.version)},data:{...data,version:{increment:1}}});
  if (!result.count) fail(409,'Настройки изменились. Обновите страницу.');
  return await getShopSettings(db);
 } catch (error) {
  if (error.code === 'P2002') fail(409,'Настройки изменились. Обновите страницу.');
  throw error;
 }
}

export function shopProduct(row) {
 const {image,...product} = row;
 return {...product,image:image ? '/media/shop/'+image+'.webp' : '',variants:JSON.parse(row.variants)};
}

export async function catalog(db) {
 const rows = await db.shopProduct.findMany({where:{published:true},orderBy:[{category:'asc'},{title:'asc'}]});
 return rows.map(shopProduct);
}

export async function saveProduct(db, body, id, imageExists) {
 const slug = text(body.slug,'Адрес товара',100,true);
 const image = text(body.image,'Фото',100);
 if (!slugPattern.test(slug)) fail(422,'Адрес товара должен состоять из латинских букв, цифр и дефисов.');
 if (image && (!imageId.test(image) || !await imageExists(image))) fail(422,'Загрузите фотографию товара.');
 if (!Array.isArray(body.variants) || !body.variants.length || body.variants.length > 30) fail(422,'Добавьте от 1 до 30 вариантов.');
 const variants = body.variants.map(item => {
  if (typeof item?.code !== 'string' || !variantCode.test(item.code) || !price(item.price)) fail(422,'Проверьте код и цену варианта.');
  return {code:item.code,label:text(item.label,'Размер / цвет',100,true),price:item.price,available:item.available===true};
 });
 if (new Set(variants.map(item => item.code)).size !== variants.length) fail(422,'Коды вариантов должны различаться.');
 const data = {slug,image:image||null,variants:JSON.stringify(variants),published:body.published===true,
  title:text(body.title,'Название',160,true),category:text(body.category,'Категория',80,true),
  description:text(body.description,'Описание',6000)};
 try {
  if (!id) return await db.shopProduct.create({data});
  const result = await db.shopProduct.updateMany({where:{id,version:version(body.version)},data:{...data,version:{increment:1}}});
  if (!result.count) fail(409,'Товар изменился. Обновите страницу.');
  return await db.shopProduct.findUnique({where:{id}});
 } catch (error) {
  if (error.code === 'P2002') fail(409,'Этот адрес уже занят другим товаром.');
  throw error;
 }
}

export async function createShopRequest(db, body) {
 const key = text(body.key,'Номер попытки',64,true);
 if (!/^[a-f0-9-]{36}$/.test(key)) fail(422,'Откройте корзину заново.');
 const name = text(body.name,'Имя',100,true);
 const rawPhone = text(body.phone,'Телефон',32,true);
 const digits = rawPhone.replace(/\D/g,'');
 if (!/^[+\d ()-]+$/.test(rawPhone) || digits.length < 10 || digits.length > 15) fail(422,'Проверьте номер телефона.');
 const phone = digits.length === 11 && digits.startsWith('8') ? '+7'+digits.slice(1) : (rawPhone.startsWith('+') ? '+' : '')+digits;
 if (!Array.isArray(body.items) || !body.items.length || body.items.length > 30) fail(422,'В корзине должно быть от 1 до 30 позиций.');
 const lines = body.items.map(line => {
  if (!line || !quantity(line.quantity) || !price(line.price) || typeof line.code !== 'string' || !variantCode.test(line.code)) fail(422,'Проверьте позиции корзины.');
  return {id:text(line.id,'Товар',64,true),code:line.code,quantity:line.quantity,price:line.price};
 });
 if (new Set(lines.map(line => line.id+':'+line.code)).size !== lines.length) fail(422,'В корзине есть повторяющиеся позиции.');
 if (body.consent !== true || typeof body.consentVersion !== 'string') fail(422,'Подтвердите отдельное согласие на обработку данных.');
 const fingerprint = digest([name,phone,lines,body.consentVersion]);
 const existingNumber = existing => {
  if (existing.fingerprint !== fingerprint) fail(409,'Данные заявки изменились. Обновите корзину.');
  return {number:existing.number};
 };
 try {
  return await db.$transaction(async tx => {
   const existing = await tx.shopRequest.findUnique({where:{key}});
   if (existing) return existingNumber(existing);
   const settings = await getShopSettings(tx);
   if (!settings.enabled) fail(503,'Приём заявок пока закрыт.');
   if (consentVersion(settings) !== body.consentVersion) fail(409,'Условия изменились. Обновите страницу и проверьте согласие.');
   const rows = await tx.shopProduct.findMany({where:{published:true,id:{in:lines.map(line=>line.id)}}});
   const products = new Map(rows.map(row=>[row.id,shopProduct(row)]));
   const items = lines.map(line => {
    const product = products.get(line.id);
    const variant = product?.variants.find(item=>item.code===line.code);
    if (!variant?.available || variant.price!==line.price) fail(409,'Наличие или цена изменились. Обновите корзину.');
    return {...line,title:product.title,label:variant.label};
   });
   const total = items.reduce((sum,line)=>sum+line.price*line.quantity,0);
   if (total > 2147483647) fail(422,'Слишком большая сумма заявки.');
   return tx.shopRequest.create({data:{key,fingerprint,name,phone,total,number:randomBytes(8).toString('hex').toUpperCase(),
    items:JSON.stringify(items),consent:JSON.stringify({version:body.consentVersion,operator:settings.operator,text:settings.consent})},select:{number:true}});
  });
 } catch (error) {
  if (['P2002','P1008','P2034'].includes(error.code)) {
   const existing = await db.shopRequest.findUnique({where:{key}});
   if (existing) return existingNumber(existing);
   fail(503,'Повторите отправку, чтобы проверить сохранение заявки.');
  }
  throw error;
 }
}
