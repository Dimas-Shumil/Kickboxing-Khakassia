import db from '../lib/prisma.js';
import {hashPassword} from '../services/password.service.js';
import {openConsole,verifyOwner,newPassword} from './console.js';
let io;
try{
 io=openConsole();await verifyOwner(db,io);
 const records=[];
 for(const [name,gymId] of [['Берёзкин','school-12'],['Сазанцев','school-25']]){
  if(!await db.gym.findUnique({where:{id:gymId}}))throw new Error('Сначала примените миграции.');
  console.log(`\n${name} — ${gymId==='school-12'?'школа №12':'школа №25'}`);
  const login=(await io.ask('Новый логин: ')).toLowerCase();
  if(!/^[a-z0-9._-]{3,100}$/.test(login))throw new Error('Логин: 3–100 символов латиницы, цифры, ._-');
  if(records.some(r=>r.login===login)||await db.admin.findUnique({where:{login}}))throw new Error('Логин занят. Никакие существующие учётные записи не изменены.');
  const passwordHash=await hashPassword(await newPassword(io));records.push({name,login,passwordHash,role:'TRAINER',gymId});
 }
 await db.$transaction(async tx=>{for(const data of records)await tx.admin.create({data});});
 console.log('Обе учётные записи созданы. Вход: /admin');
}catch(e){console.error(e.code==='P2002'?'Логин занят. Создание отменено.':e.message);process.exitCode=1;}
finally{io?.close();await db.$disconnect();}
