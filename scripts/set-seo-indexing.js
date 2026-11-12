import {readFile,writeFile,copyFile,chmod,rename} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from 'dotenv';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function main(){
 const flags=process.argv.slice(2);if(flags.some(x=>!['--check','--disable'].includes(x)))throw new Error('Допустимые параметры: --check, --disable.');
 const file=path.join(root,'.env'),text=await readFile(file,'utf8'),env=parse(text),enabled=!flags.includes('--disable');
 if(enabled&&(env.NODE_ENV!=='production'||String(env.APP_ORIGIN||'').split(',')[0].trim()!=='https://kickboxing19.ru'))throw new Error('Сначала подключите HTTPS и установите production APP_ORIGIN=https://kickboxing19.ru. Индексация не изменена.');
 const matches=[...text.matchAll(/^[ \t]*(?:export[ \t]+)?SEO_INDEXABLE[ \t]*=.*$/gm)];if(matches.length>1)throw new Error('Несколько SEO_INDEXABLE в .env: нужна ручная проверка.');
 const line='SEO_INDEXABLE='+String(enabled),nl=text.includes('\r\n')?'\r\n':'\n';
 const output=matches.length?text.replace(/^[ \t]*(?:export[ \t]+)?SEO_INDEXABLE[ \t]*=.*$/m,line):text+(text.endsWith('\n')?'':nl)+line+nl;
 if(flags.includes('--check')){console.log('Проверка пройдена. План: '+line+'. Файл не изменён.');return;}
 if(output===text){console.log('Настройка уже установлена: '+line);return;}
 const stamp=new Date().toISOString().replace(/[:.]/g,'-'),backup=file+'.before-seo-'+stamp,temp=file+'.seo-'+stamp+'.tmp';
 await copyFile(file,backup,constants.COPYFILE_EXCL);await chmod(backup,0o600);await writeFile(temp,output,{mode:0o600,flag:'wx'});await rename(temp,file);
 console.log('Установлено '+line);console.log('Копия настроек: '+backup);console.log('Перезапустите только federation-demo.');
}
main().catch(e=>{console.error('Настройки SEO не применены:',e.message);process.exitCode=1;});
