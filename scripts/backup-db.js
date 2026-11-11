import 'dotenv/config';
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,chmod,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
try{
 const url=process.env.DATABASE_URL;
 if(!url?.startsWith('file:'))throw new Error('DATABASE_URL должен указывать SQLite.');
 const filePart=decodeURIComponent(url.slice(5).split('?')[0]);
 const source=path.isAbsolute(filePart)?filePart:path.resolve(root,'prisma',filePart);
 await stat(source); // Never create an empty source by mistake.
 const destination=path.resolve(process.argv[2]||path.join(root,'backups',`federation-${new Date().toISOString().replace(/[:.]/g,'-')}.db`));
 if(destination===source)throw new Error('Резервная копия должна быть отдельным файлом.');
 try{await stat(destination);throw new Error('Файл копии уже существует. Выберите другое имя.');}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(path.dirname(destination),{recursive:true,mode:0o700});
 const db=new DatabaseSync(source,{readOnly:true});
 try{await backup(db,destination);}finally{db.close();}
 await chmod(destination,0o600);
 const copy=new DatabaseSync(destination,{readOnly:true});
 try{
  const check=copy.prepare('PRAGMA integrity_check').all();
  if(check.length!==1||Object.values(check[0])[0]!=='ok'||copy.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Резервная копия не прошла проверку целостности.');
 }finally{copy.close();}
 console.log('Проверенная резервная копия:',destination);
}catch(e){console.error('Ошибка резервного копирования:',e.message);process.exitCode=1;}
