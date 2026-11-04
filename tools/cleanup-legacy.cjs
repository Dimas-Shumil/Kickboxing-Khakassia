// Однократная очистка файлов нашего прежнего патча 08.2. БД и .env не затрагиваются.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const files={
  "server/validation.js": "e2f0bd0953e51aa01c77df594e70b0abdc229be9af4fe242c7f49b3e20bf635c",
  "server/app.js": "82436dc014fd3dbf8ca2ac9c7d76ab94be9291f2278d1b9087640e8775c43b19",
  "server/config.js": "183b40a198b01359bde6003fbcc5e638f8afde32da5c1b957eb67d70dc520dbf",
  "server/passwords.js": "1b26e0933e33aa6bde0b4ae8495b6b0be4077a2b3af18451ae95d2d017d4c1c1",
  "server/session-store.js": "f1f7c2149c57249074e8886360860e7166fa1eb9ffdece443b30b8025166d46e",
  "server/views/admin.ejs": "c6c6ef08cc09f3ab564f13d9e34ac46f087b2a2c200a57e36b77ef903211a21a",
  "server/views/login.ejs": "9bfefde39a29443aff5226395a097e4294fbf33bbac281d1d815a643d7b7a369",
  "server/views/error.ejs": "b28e00ea9fcff8f1389de41faf6590cfd6ac670f18cb9a504b7e6b7d40957814",
  "tools/setup-local.cjs": "b0ed1e5bd1dea610462eaf8ccba411188244cbe2bea36887ffcad7efb44c7269",
  "tools/create-user.cjs": "01a9e9a7d1fe02ed8e9b4174550ee19c3eb155496447fb3a2c425cdd743d6e14",
  "admin-pages/assets/admin.js": "26e152cd67819f57d101d9b34f441b45d2888c4020c538e308d70c911548d08a"
};
for(const [relative,hash]of Object.entries(files)){
 const file=path.join(root,relative);if(!fs.existsSync(file))continue;
 if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==hash){console.log('Сохранён изменённый файл: '+relative);continue;}
 fs.unlinkSync(file);console.log('Удалён устаревший файл: '+relative);
}
for(const relative of ['server/views','server']){try{fs.rmdirSync(path.join(root,relative));}catch{}}
