const session = require('express-session');
class PrismaSessionStore extends session.Store {
  constructor(db) {super(); this.db = db; this.timer = setInterval(() => this.db.session.deleteMany({where:{expires:{lt:new Date()}}}).catch(() => {}), 3600000); this.timer.unref();}
  get(sid, cb) {this.db.session.findUnique({where:{sid}}).then(row => {if (!row || row.expires < new Date()) return cb(null, null); cb(null, JSON.parse(row.data));}).catch(cb);}
  set(sid, value, cb = () => {}) {const expires = value.cookie?.expires ? new Date(value.cookie.expires) : new Date(Date.now()+8*3600000); this.db.session.upsert({where:{sid},create:{sid,data:JSON.stringify(value),expires},update:{data:JSON.stringify(value),expires}}).then(()=>cb()).catch(cb);}
  destroy(sid, cb = () => {}) {this.db.session.deleteMany({where:{sid}}).then(()=>cb()).catch(cb);}
  touch(sid, value, cb = () => {}) {this.db.session.updateMany({where:{sid},data:{expires:new Date(value.cookie.expires)}}).then(()=>cb()).catch(cb);}
  close() {clearInterval(this.timer);}
}
module.exports = {PrismaSessionStore};
