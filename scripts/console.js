import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {verifyPassword} from '../services/password.service.js';
export function openConsole(){
 if(!process.stdin.isTTY)throw new Error('Откройте интерактивный терминал CMD/SSH.');
 let hidden=false;
 const output=new Writable({write(chunk,encoding,done){if(!hidden)process.stdout.write(chunk,encoding);done();}});
 const rl=createInterface({input:process.stdin,output,terminal:true});
 rl.on('SIGINT',()=>{rl.close();process.exit(130);});
 return {
  ask:async prompt=>(await rl.question(prompt)).trim(),
  secret:async prompt=>{process.stdout.write(prompt);hidden=true;try{return await rl.question('');}finally{hidden=false;process.stdout.write('\n');}},
  close:()=>rl.close()
 };
}
export async function verifyOwner(db,io){
 const login=(await io.ask('Логин OWNER: ')).toLowerCase();
 const password=await io.secret('Пароль OWNER: ');
 const owner=await db.admin.findUnique({where:{login}});
 if(!owner||owner.role!=='OWNER'||!owner.isActive||!await verifyPassword(password,owner.passwordHash))throw new Error('Не подтверждён доступ владельца.');
 return owner;
}
export async function newPassword(io){
 const password=await io.secret('Пароль (12–256 символов): '),confirmation=await io.secret('Подтвердите пароль: ');
 if(password!==confirmation)throw new Error('Пароли не совпадают. Изменения не сохранены.');
 if(password.length<12||password.length>256)throw new Error('Пароль должен содержать 12–256 символов.');
 return password;
}
