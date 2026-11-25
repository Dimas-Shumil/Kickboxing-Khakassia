const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {tmpdir}=require('node:os');
test('Галерея и история вариантов: дополнительная миграция сохраняет старые данные',()=>{
 const dir=fs.mkdtempSync(path.join(tmpdir(),'fed-shop-'));const db=new DatabaseSync(path.join(dir,'old.db'));
 try{
  const root=path.resolve(__dirname,'../prisma/migrations');
  for(const name of fs.readdirSync(root).sort())if(/^\d/.test(name)&&name!=='202611250001_shop_photos')db.exec(fs.readFileSync(path.join(root,name,'migration.sql'),'utf8'));
  const image='a'.repeat(48),variants=JSON.stringify([{code:'m',label:'M',price:100,available:true}]);
  db.prepare('INSERT INTO ShopProduct(id,slug,title,category,description,image,variants,published,updatedAt) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)').run('p','old','Товар','Категория','',image,variants,1);
  const before=db.prepare('SELECT * FROM ShopProduct').get();
  db.exec(fs.readFileSync(path.join(root,'202611250001_shop_photos','migration.sql'),'utf8'));
  const {photos,variantHistory,...after}=db.prepare('SELECT * FROM ShopProduct').get();
  assert.deepEqual(after,{...before});assert.deepEqual(JSON.parse(photos),[image]);assert.deepEqual(JSON.parse(variantHistory),{m:'M'});
  assert.equal(Object.values(db.prepare('PRAGMA integrity_check').get())[0],'ok');assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
