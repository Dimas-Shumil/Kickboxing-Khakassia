import 'dotenv/config';
import prisma from './lib/prisma.js';
import {readConfig} from './config/env.js';
import {createApp} from './lib/app.js';
async function main(){
 const config=readConfig();await prisma.$connect();await prisma.admin.count();await prisma.adminSession.count();
 const app=createApp(prisma,config);
 const server=app.listen(config.port,config.host,()=>console.log(`Federation: ${config.origin}\nАдминка: ${config.origin}/admin`));
 const stop=()=>server.close(async()=>{await prisma.$disconnect();process.exit(0);});
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
main().catch(error=>{console.error('Запуск остановлен:',error.message);process.exitCode=1;});
