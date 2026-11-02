const express=require('express');
const session=require('express-session');
const helmet=require('helmet');
const {rateLimit}=require('express-rate-limit');
const {randomBytes,timingSafeEqual}=require('node:crypto');
const path=require('node:path');
const {PrismaSessionStore}=require('./session-store');
const {verifyPassword,hashPassword}=require('./passwords');
const v=require('./validation');
const asyncHandler=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const newsDTO=n=>({...JSON.parse(n.payload),id:n.id,title:n.title,status:n.status,version:n.version});
function createApp(db,cfg){
 const app=express();app.disable('x-powered-by');
 if(process.env.TRUST_PROXY)app.set('trust proxy',process.env.TRUST_PROXY);
 app.set('view engine','ejs');app.set('views',path.join(cfg.ROOT,'server/views'));
 app.use(helmet({contentSecurityPolicy:false,crossOriginEmbedderPolicy:false,strictTransportSecurity:cfg.production?undefined:false}));
 app.use(express.urlencoded({extended:false,limit:'256kb'}));app.use(express.json({limit:'256kb'}));
 app.get('/health/live',(_req,res)=>res.json({status:'ok'}));
 app.get('/health/ready',asyncHandler(async(_req,res)=>{await db.$queryRaw`SELECT 1`;res.json({status:'ok'});}));
 app.use('/admin/assets',express.static(path.join(cfg.ROOT,'admin-pages/assets'),{index:false}));
 const store=new PrismaSessionStore(db);app.locals.sessionStore=store;
 app.use('/admin',session({name:'fed.sid',secret:cfg.secret,resave:false,saveUninitialized:false,store,cookie:{httpOnly:true,sameSite:'lax',secure:cfg.production,maxAge:8*3600000},rolling:true}));
 app.use('/admin',asyncHandler(async(req,res,next)=>{
  res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});
  if(!req.session.csrf)req.session.csrf=randomBytes(32).toString('hex');
  if(req.session.userId){const user=await db.user.findUnique({where:{id:req.session.userId},select:{id:true,login:true,name:true,role:true,isActive:true}});if(user?.isActive&&['OWNER','EDITOR'].includes(user.role))req.user=user;else delete req.session.userId;}
  res.locals.csrf=req.session.csrf;next();
 }));
 const csrf=(req,_res,next)=>{const origin=req.get('origin');const token=req.get('x-csrf-token')||req.body?._csrf;const expected=req.session.csrf;if((origin&&origin!==cfg.origin)||typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token)||token.length!==expected.length||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))return next(new v.HttpError(403,'Защита запроса: обновите страницу и повторите действие.'));next();};
 const auth=(req,res,next)=>{if(req.user)return next();if(req.originalUrl.startsWith('/admin/api/'))return res.status(401).json({error:'Войдите в административную панель.'});return res.redirect('/admin/login');};
 const owner=(req,_res,next)=>req.user?.role==='OWNER'?next():next(new v.HttpError(403,'Доступ к ученикам и оплатам есть только у владельца.'));
 const loginLimit=rateLimit({windowMs:15*60*1000,limit:15,standardHeaders:'draft-8',legacyHeaders:false,handler:(_req,res)=>res.status(429).render('login',{error:'Слишком много попыток. Повторите через 15 минут.',login:''})});
 const dummyHash=hashPassword(randomBytes(32).toString('hex'));
 app.get('/admin/login',(req,res)=>req.user?res.redirect('/admin/dashboard.html'):res.render('login',{error:'',login:''}));
 app.post('/admin/login',loginLimit,csrf,asyncHandler(async(req,res)=>{
  const login=typeof req.body.login==='string'?req.body.login.trim().toLowerCase().slice(0,100):'';
  const password=typeof req.body.password==='string'?req.body.password:'';
  const user=await db.user.findUnique({where:{login}});
  const valid=password.length<=256&&await verifyPassword(password,user?.passwordHash||await dummyHash);
  if(!valid||!user?.isActive||!['OWNER','EDITOR'].includes(user.role))return res.status(401).render('login',{error:'Неверный логин или пароль.',login});
  await new Promise((resolve,reject)=>req.session.regenerate(err=>err?reject(err):resolve()));
  req.session.userId=user.id;req.session.csrf=randomBytes(32).toString('hex');
  await new Promise((resolve,reject)=>req.session.save(err=>err?reject(err):resolve()));
  res.redirect('/admin/dashboard.html');
 }));
 app.post('/admin/logout',auth,csrf,asyncHandler(async(req,res)=>{await new Promise((resolve,reject)=>req.session.destroy(err=>err?reject(err):resolve()));res.clearCookie('fed.sid',{httpOnly:true,sameSite:'lax',secure:cfg.production,path:'/'});res.redirect('/admin/login');}));
 app.use('/admin/api',auth);
 app.get('/admin/api/bootstrap',asyncHandler(async(req,res)=>{
  const canGym=req.user.role==='OWNER';
  const [news,logs,students,payments]=await Promise.all([db.news.findMany({orderBy:{updatedAt:'desc'}}),db.auditLog.findMany({where:canGym?{}:{scope:'news'},orderBy:{createdAt:'desc'},take:30}),canGym?db.student.findMany({orderBy:{name:'asc'}}):[],canGym?db.payment.findMany({include:{revisions:{orderBy:{createdAt:'desc'}}},orderBy:{received:'desc'}}):[]]);
  res.json({user:{id:req.user.id,name:req.user.name,role:req.user.role},students:students.map(s=>({...s,person:''})),payments:payments.map(({revisions,...p})=>({...p,history:revisions.map(h=>({before:JSON.parse(h.before),reason:h.reason,actorId:h.actorId,at:h.createdAt.toISOString()}))})),news:news.map(newsDTO),changes:logs.reverse().map(l=>({text:({students:'Ученик',payments:'Платёж',news:'Новость'}[l.scope]||'Запись')+': '+(l.action==='create'?'создание':'изменение')+' · '+l.entityId,at:l.createdAt.toISOString()}))});
 }));
 async function write(req,res,model,scope,data){
  const id=req.params.id;const version=id?v.version(req.body.version):null;
  const entity=await db.$transaction(async tx=>{
   let saved;
   if(id){const updated=await tx[model].updateMany({where:{id,version},data:{...data,version:{increment:1}}});if(!updated.count){if(!await tx[model].findUnique({where:{id}}))throw new v.HttpError(404,'Запись не найдена.');throw new v.HttpError(409,'Запись уже изменена в другом окне. Перезагрузите страницу, чтобы получить последнюю версию.');}saved=await tx[model].findUnique({where:{id}});}
   else saved=await tx[model].create({data});
   await tx.auditLog.create({data:{actorId:req.user.id,scope,entityId:saved.id,action:id?'update':'create'}});return saved;
  });res.status(id?200:201).json({entity:scope==='news'?newsDTO(entity):entity});
 }
 app.post('/admin/api/students',owner,csrf,asyncHandler(async(req,res)=>write(req,res,'student','students',v.student(req.body))));
 app.patch('/admin/api/students/:id',owner,csrf,asyncHandler(async(req,res)=>write(req,res,'student','students',v.student(req.body))));
 app.post('/admin/api/payments',owner,csrf,asyncHandler(async(req,res)=>{const data=v.payment(req.body);if(!await db.student.findUnique({where:{id:data.student}}))throw new v.HttpError(422,'Выберите существующего ученика.');return write(req,res,'payment','payments',data);}));
 app.patch('/admin/api/payments/:id',owner,csrf,asyncHandler(async(req,res)=>{
  const data=v.payment(req.body),version=v.version(req.body.version),reason=v.text(req.body.reason,'Причина исправления',2000,true);
  const entity=await db.$transaction(async tx=>{
   const before=await tx.payment.findUnique({where:{id:req.params.id}});if(!before)throw new v.HttpError(404,'Платёж не найден.');
   if(!await tx.student.findUnique({where:{id:data.student}}))throw new v.HttpError(422,'Ученик не найден.');
   const result=await tx.payment.updateMany({where:{id:req.params.id,version},data:{...data,version:{increment:1}}});if(!result.count)throw new v.HttpError(409,'Платёж изменён в другом окне. Обновите страницу; ваши правки ещё не сохранены.');
   await tx.paymentRevision.create({data:{paymentId:before.id,before:JSON.stringify({student:before.student,amount:before.amount,received:before.received,period:before.period,comment:before.comment}),reason,actorId:req.user.id}});
   await tx.auditLog.create({data:{actorId:req.user.id,scope:'payments',entityId:before.id,action:'update'}});
   return tx.payment.findUnique({where:{id:before.id}});
  });res.json({entity});
 }));
 app.post('/admin/api/news',csrf,asyncHandler(async(req,res)=>write(req,res,'news','news',v.news(req.body))));
 app.patch('/admin/api/news/:id',csrf,asyncHandler(async(req,res)=>write(req,res,'news','news',v.news(req.body))));
 // Нет эндпоинта публикации до согласования прав редактора.
 app.use('/admin/api',(_req,res)=>res.status(404).json({error:'Метод API не найден.'}));
 const pages={dashboard:'Обзор сайта',gym:'Управление залом',students:'Ученики',student:'Карточка ученика',payments:'Оплаты',payment:'Внести оплату',news:'Новости','news-edit':'Редактор новости','news-preview':'Предпросмотр новости'};
 app.get('/admin',auth,(_req,res)=>res.redirect('/admin/dashboard.html'));
 app.get('/admin/:page',auth,asyncHandler(async(req,res,next)=>{
  const page=req.params.page.replace(/\.html$/,'');if(!Object.hasOwn(pages,page))return next();
  if(['gym','students','student','payments','payment'].includes(page)&&req.user.role!=='OWNER')throw new v.HttpError(403,'Раздел доступен только владельцу.');
  const model=['student','payment','news-edit','news-preview'].includes(page)?(page.startsWith('news')?'news':page):null;
  if(model&&req.query.id&&req.query.id!=='working'){if(typeof req.query.id!=='string'||!await db[model].findUnique({where:{id:req.query.id},select:{id:true}}))throw new v.HttpError(404,'Запись не найдена.');}
  res.render('admin',{page,title:pages[page]});
 }));
 app.use('/admin',(_req,_res,next)=>next(new v.HttpError(404,'Страница управления не найдена.')));
 app.use('/admin-pages',(req,res)=>{const name=path.basename(req.path);if(name==='login.html')return res.redirect('/admin/login');res.redirect('/admin/'+(Object.hasOwn(pages,name.replace(/\.html$/,''))?name:'dashboard.html'));});
 app.use('/site',express.static(path.join(cfg.ROOT,'site'),{index:false}));
 app.use('/components',express.static(path.join(cfg.ROOT,'components'),{index:false}));
 app.use('/public',express.static(path.join(cfg.ROOT,'public'),{extensions:['html']}));
 app.use(express.static(path.join(cfg.ROOT,'public'),{extensions:['html']}));
 app.use((_req,res)=>res.status(404).sendFile(path.join(cfg.ROOT,'public/404.html')));
 app.use((err,req,res,_next)=>{
  const status=err.status|| (err.type==='entity.too.large'?413:500);
  const message=status>=500?'Не удалось выполнить действие. Данные не подтверждены как сохранённые; повторите попытку.':err.message;
  if(status>=500)console.error('Request failed:',err.code||err.name);
  if(req.originalUrl.startsWith('/admin/api/'))return res.status(status).json({error:message});
  if(req.path.startsWith('/admin'))return res.status(status).render('error',{status,message});
  res.status(status).send(status===404?'Страница не найдена.':'Ошибка запроса.');
 });return app;
}
module.exports={createApp};
