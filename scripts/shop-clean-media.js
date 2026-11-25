import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {readdir,stat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.resolve(root,'var/shop-media');
const apply=process.argv.includes('--apply');
if(apply&&!process.argv.includes('--server-stopped'))throw new Error('Остановите приложение и укажите --server-stopped.');
const db=new PrismaClient();
try{
 const products=await db.shopProduct.findMany({select:{image:true,photos:true}});
 const used=new Set(products.flatMap(row=>[row.image,...JSON.parse(row.photos)]).filter(Boolean));
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(!entry.isFile()||!/^\w{48}\.webp$/.test(entry.name)||!/^[a-f0-9]{48}\.webp$/.test(entry.name)||used.has(entry.name.slice(0,-5)))continue;
  const file=path.join(dir,entry.name);
  if(Date.now()-(await stat(file)).mtimeMs<24*60*60*1000)continue;
  console.log(apply?'Удаление:':'Не используется:',entry.name);
  if(apply)await unlink(file);
 }
}finally{await db.$disconnect();}
