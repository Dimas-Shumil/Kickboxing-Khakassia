const fs=require('node:fs');const path=require('node:path');const {randomBytes}=require('node:crypto');const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');const envFile=path.join(root,'.env');const dbFile=path.join(root,'prisma/federation-dev.db');
if(fs.existsSync(envFile)||fs.existsSync(dbFile)){console.error('Остановлено: .env или federation-dev.db уже существует. Ничего не перезаписано. Если установка уже выполнена — используйте npm start.');process.exit(1);}
const text=fs.readFileSync(path.join(root,'.env.example'),'utf8').replace('SESSION_SECRET=','SESSION_SECRET='+randomBytes(48).toString('hex'));
fs.writeFileSync(envFile,text,{flag:'wx',mode:0o600});
fs.writeFileSync(dbFile,'',{flag:'wx',mode:0o600});
try{execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,stdio:'inherit'});execFileSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'generate'],{cwd:root,stdio:'inherit'});console.log('Новая отдельная база разработки готова. Теперь: npm run user:create, затем npm start.');}
catch{console.error('Подготовка остановлена. Созданный .env сохранён для диагностики; существующие базы не менялись. Исправьте ошибку и выполните npm run db:deploy для этой новой базы.');process.exitCode=1;}
