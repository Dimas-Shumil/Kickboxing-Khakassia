import db from '../lib/prisma.js';
import {openConsole,verifyOwner} from './console.js';
import {assignLegacy} from '../services/legacy-gym.service.js';
let io;
try{
 io=openConsole();const owner=await verifyOwner(db,io);
 const counts={students:await db.student.count({where:{gymId:null}}),groups:await db.trainingGroup.count({where:{gymId:null}}),sessions:await db.gymSession.count({where:{gymId:null}}),finances:await db.financeEntry.count({where:{gymId:null}})};
 console.log('Нераспределённые записи:',counts);
 console.log('Эта команда переносит ВЕСЬ нераспределённый учёт в ОДИН зал. Для смешанных данных не продолжайте.');
 const school=await io.ask('Куда относятся ВСЕ старые записи? Введите 12 или 25 (Enter — отмена): ');
 if(!['12','25'].includes(school))throw new Error('Перенос отменён.');
 const phrase='ПЕРЕНЕСТИ В '+school;
 if(await io.ask(`Для подтверждения введите «${phrase}»: `)!==phrase)throw new Error('Перенос отменён.');
 await assignLegacy(db,'school-'+school,owner.id);console.log('Учёт перенесён. Оплаты, исправления и посещения сохранены.');
}catch(e){console.error(e.message);process.exitCode=1;}finally{io?.close();await db.$disconnect();}
