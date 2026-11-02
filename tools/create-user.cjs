const readline=require('node:readline');const {Writable}=require('node:stream');
const {config}=require('../server/config');const {hashPassword}=require('../server/passwords');const {PrismaClient}=require('@prisma/client');
async function main(){config();const db=new PrismaClient();let muted=false;const output=new Writable({write(chunk,encoding,cb){if(!muted)process.stdout.write(chunk,encoding);cb();}});const rl=readline.createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
 const ask=q=>new Promise(resolve=>{muted=false;rl.question(q,a=>{muted=false;resolve(a.trim());});});
 try{const roleArg=process.argv.find(x=>x.startsWith('--role='));const role=roleArg?roleArg.slice(7):'OWNER';if(!['OWNER','EDITOR'].includes(role))throw Error('Допустимы OWNER или EDITOR.');
 const login=(await ask('Логин (латиница, цифры, ._-): ')).toLowerCase();if(!/^[a-z0-9._-]{3,100}$/.test(login))throw Error('Логин должен быть от 3 до 100 допустимых символов.');
 const name=await ask('Имя: ');if(!name||name.length>180)throw Error('Укажите имя до 180 символов.');
 const password=await new Promise(resolve=>{process.stdout.write('Пароль (от 12 символов, ввод скрыт): ');muted=true;rl.question('',p=>{muted=false;process.stdout.write('\n');resolve(p);});});if(password.length<12||password.length>256)throw Error('Пароль должен быть от 12 до 256 символов.');
 if(await db.user.findUnique({where:{login}}))throw Error('Логин уже существует; существующий пользователь не изменён.');
 await db.user.create({data:{login,name,role,passwordHash:await hashPassword(password)}});console.log('Пользователь создан. Роль: '+role+'. Пароль не выводится и хранится в виде scrypt-хеша.');
 }finally{rl.close();await db.$disconnect();}}
main().catch(err=>{console.error('Пользователь не создан:',err.message);process.exitCode=1;});
