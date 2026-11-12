// Update only the origin, preserving the actual DB path, sessions and other settings.
import {readFile,writeFile,copyFile,rename,chmod} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'dotenv';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function main(){
 const envFile=path.join(root,'.env'),text=await readFile(envFile,'utf8'),values=parse(text);
 if(values.NODE_ENV!=='production')throw new Error('Команда предназначена для серверного .env с NODE_ENV=production. Локальный .env не изменён.');
 if(!values.DATABASE_URL?.startsWith('file:'))throw new Error('Не подтверждён существующий путь SQLite в .env.');
 const origin='https://kickboxing19.ru';
 const flags=process.argv.slice(2);
 if(flags.some(f=>!['--transition','--check'].includes(f)))throw new Error('Допустимые параметры: --check, --transition.');
 const origins=flags.includes('--transition')?origin+',https://kickboxing-federation.shumdev.ru':origin;
 const matches=[...text.matchAll(/^[ \t]*(?:export[ \t]+)?APP_ORIGIN[ \t]*=.*$/gm)];
 if(matches.length>1)throw new Error('В .env найдено несколько APP_ORIGIN. Нужна ручная проверка.');
 const newline=text.includes('\r\n')?'\r\n':'\n';
 const result=matches.length?text.replace(/^[ \t]*(?:export[ \t]+)?APP_ORIGIN[ \t]*=.*$/m,'APP_ORIGIN='+origins):text+(text.endsWith('\n')?'':newline)+'APP_ORIGIN='+origins+newline;
 if(flags.includes('--check')){console.log('Проверка пройдена. Будет установлен APP_ORIGIN='+origins+'. Файл не изменён.');return;}
 if(result===text){console.log('APP_ORIGIN уже соответствует выбранному режиму. Изменений нет.');return;}
 const suffix=new Date().toISOString().replace(/[:.]/g,'-');const backup=envFile+'.before-domain-'+suffix,temp=envFile+'.origin-'+suffix+'.tmp';
 await copyFile(envFile,backup,constants.COPYFILE_EXCL);await chmod(backup,0o600);
 await writeFile(temp,result,{flag:'wx',mode:0o600});await rename(temp,envFile);
 console.log('APP_ORIGIN обновлён: '+origins);console.log('Резервная копия .env: '+backup);console.log('Перезапустите только federation-demo. На новом домене потребуется войти заново.');
}
main().catch(e=>{console.error('Настройки не применены:',e.message);process.exitCode=1;});
