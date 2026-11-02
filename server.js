const {config}=require('./server/config');
const {PrismaClient}=require('@prisma/client');
const {createApp}=require('./server/app');
async function main(){
 const cfg=config();const db=new PrismaClient();
 await db.$connect();await db.user.count();
 const app=createApp(db,cfg);
 const server=app.listen(cfg.port,cfg.host,()=>console.log(`Federation: ${cfg.origin}\nАдминка: ${cfg.origin}/admin`));
 async function stop(){server.close(async()=>{app.locals.sessionStore.close();await db.$disconnect();process.exit(0);});}
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
main().catch(err=>{console.error('Запуск остановлен:',err.message);process.exitCode=1;});
