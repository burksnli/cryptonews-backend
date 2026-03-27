const crypto = require("crypto");
const db = require("./db");

function addNewsItem(item) {
  db.prepare("INSERT OR IGNORE INTO news (id,source,title,body,priority,tags,coins,created_at) VALUES (@id,@source,@title,@body,@priority,@tags,@coins,@created_at)").run({id:item.id||crypto.randomUUID(),source:item.source||"admin",title:item.title,body:item.body||item.title,priority:item.priority||"normal",tags:JSON.stringify(item.tags||[]),coins:JSON.stringify(item.coins||[]),created_at:item.createdAt||new Date().toISOString()});
}

function getNews(limit){
  limit=limit||50;
  return db.prepare("SELECT * FROM news ORDER BY created_at DESC LIMIT ?").all(limit).map(deserializeNews);
}

function getNewsById(id){
  var row=db.prepare("SELECT * FROM news WHERE id=?").get(id);
  return row?deserializeNews(row):null;
}

function updateNewsItem(id,patch){
  var cur=getNewsById(id); if(!cur)return null;
  var n=Object.assign({},cur,patch);
  db.prepare("UPDATE news SET title=@title,body=@body,priority=@priority,tags=@tags,coins=@coins WHERE id=@id").run({id,title:n.title,body:n.body,priority:n.priority,tags:JSON.stringify(n.tags||[]),coins:JSON.stringify(n.coins||[])});
  return getNewsById(id);
}

function deleteNewsItem(id){ db.prepare("DELETE FROM news WHERE id=?").run(id); }

function deserializeNews(row){
  return {id:row.id,source:row.source,title:row.title,body:row.body,priority:row.priority,tags:tryParse(row.tags,[]),coins:tryParse(row.coins,[]),createdAt:row.created_at};
}

function addPushToken(token){ db.prepare("INSERT OR IGNORE INTO push_tokens(token)VALUES(?)").run(token); }
function getPushTokens(){ return db.prepare("SELECT token FROM push_tokens").all().map(function(r){return r.token;}); }
function removePushToken(token){ db.prepare("DELETE FROM push_tokens WHERE token=?").run(token); }

function getUsers(opts){
  opts=opts||{}; var page=opts.page||1; var limit=opts.limit||50; var offset=(page-1)*limit;
  var rows=db.prepare("SELECT u.*,p.watchlist,p.alerts,p.settings FROM users u LEFT JOIN user_preferences p ON p.user_id=u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?").all(limit,offset);
  var total=db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  return {users:rows.map(deserializeUser),total:total};
}

function findUserByEmail(email){
  var n=String(email||"").trim().toLowerCase();
  var row=db.prepare("SELECT u.*,p.watchlist,p.alerts,p.settings FROM users u LEFT JOIN user_preferences p ON p.user_id=u.id WHERE u.email=?").get(n);
  return row?deserializeUser(row):null;
}

function findUserById(userId){
  var row=db.prepare("SELECT u.*,p.watchlist,p.alerts,p.settings FROM users u LEFT JOIN user_preferences p ON p.user_id=u.id WHERE u.id=?").get(userId);
  return row?deserializeUser(row):null;
}

function addUser(user){
  var prefs=user.preferences||{};
  db.transaction(function(){
    db.prepare("INSERT INTO users(id,email,name,password_hash,role,created_at)VALUES(@id,@email,@name,@passwordHash,@role,@createdAt)").run({id:user.id,email:user.email.toLowerCase(),name:user.name||"",passwordHash:user.passwordHash,role:user.role||"user",createdAt:user.createdAt||new Date().toISOString()});
    db.prepare("INSERT OR IGNORE INTO user_preferences(user_id,watchlist,alerts,settings)VALUES(@user_id,@watchlist,@alerts,@settings)").run({user_id:user.id,watchlist:JSON.stringify(prefs.watchlist||[]),alerts:JSON.stringify(prefs.alerts||[]),settings:JSON.stringify(prefs.settings||{})});
  })();
  return findUserById(user.id);
}

function updateUser(userId,updater){
  var cur=findUserById(userId); if(!cur)return null;
  var next=typeof updater==="function"?updater(cur):Object.assign({},cur,updater);
  var prefs=next.preferences||{};
  db.transaction(function(){
    db.prepare("UPDATE users SET name=@name,role=@role,last_seen=@lastSeen WHERE id=@id").run({id:userId,name:next.name,role:next.role||"user",lastSeen:next.lastSeen||null});
    db.prepare("INSERT INTO user_preferences(user_id,watchlist,alerts,settings)VALUES(@user_id,@watchlist,@alerts,@settings)ON CONFLICT(user_id)DO UPDATE SET watchlist=excluded.watchlist,alerts=excluded.alerts,settings=excluded.settings").run({user_id:userId,watchlist:JSON.stringify(prefs.watchlist||[]),alerts:JSON.stringify(prefs.alerts||[]),settings:JSON.stringify(prefs.settings||{})});
  })();
  return findUserById(userId);
}

function deleteUser(userId){ db.prepare("DELETE FROM users WHERE id=?").run(userId); }
function touchUserSeen(userId){ db.prepare("UPDATE users SET last_seen=? WHERE id=?").run(new Date().toISOString(),userId); }

function deserializeUser(row){
  return {id:row.id,email:row.email,name:row.name,passwordHash:row.password_hash,role:row.role||"user",createdAt:row.created_at,lastSeen:row.last_seen||null,preferences:{watchlist:tryParse(row.watchlist,[]),alerts:tryParse(row.alerts,[]),settings:tryParse(row.settings,{})}};
}

function getAppSetting(key,defaultValue){
  var row=db.prepare("SELECT value FROM app_settings WHERE key=?").get(key);
  if(!row)return defaultValue===undefined?null:defaultValue;
  return tryParse(row.value,row.value);
}

function setAppSetting(key,value){
  db.prepare("INSERT INTO app_settings(key,value,updated_at)VALUES(@key,@value,@updated_at)ON CONFLICT(key)DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").run({key,value:JSON.stringify(value),updated_at:new Date().toISOString()});
}

function getAllAppSettings(){
  var rows=db.prepare("SELECT key,value FROM app_settings").all();
  var result={};
  rows.forEach(function(r){result[r.key]=tryParse(r.value,r.value);});
  return result;
}

var SESSION_TTL_SEC=180;

function pingSession(sessionId,opts){
  opts=opts||{};
  db.prepare("INSERT INTO online_sessions(session_id,user_id,ip,user_agent,last_ping)VALUES(@sessionId,@userId,@ip,@userAgent,@now)ON CONFLICT(session_id)DO UPDATE SET last_ping=excluded.last_ping").run({sessionId:sessionId,userId:opts.userId||null,ip:opts.ip||null,userAgent:opts.userAgent||null,now:new Date().toISOString()});
  db.prepare("DELETE FROM online_sessions WHERE datetime(last_ping)<datetime('now','-'||?||' seconds')").run(SESSION_TTL_SEC);
}

function getOnlineCount(){
  return db.prepare("SELECT COUNT(*) as c FROM online_sessions WHERE datetime(last_ping)>=datetime('now','-'||?||' seconds')").get(SESSION_TTL_SEC).c;
}

function getStats(){
  return {
    userCount:db.prepare("SELECT COUNT(*) as c FROM users").get().c,
    newsCount:db.prepare("SELECT COUNT(*) as c FROM news").get().c,
    tokenCount:db.prepare("SELECT COUNT(*) as c FROM push_tokens").get().c,
    onlineCount:getOnlineCount(),
    recentRegistrations:db.prepare("SELECT date(created_at) as day,COUNT(*) as c FROM users WHERE created_at>=datetime('now','-7 days')GROUP BY day ORDER BY day DESC").all(),
    recentNews:db.prepare("SELECT date(created_at) as day,COUNT(*) as c FROM news WHERE created_at>=datetime('now','-7 days')GROUP BY day ORDER BY day DESC").all()
  };
}

function migrateFromJson(jsonPath){
  var fs=require("fs");
  if(!fs.existsSync(jsonPath))return;
  var data;
  try{data=JSON.parse(fs.readFileSync(jsonPath,"utf8"));}catch(e){return;}
  var alreadyMigrated=db.prepare("SELECT COUNT(*) as c FROM news").get().c>0||db.prepare("SELECT COUNT(*) as c FROM users").get().c>0;
  if(alreadyMigrated)return;
  console.log("Migrating store.json to SQLite...");
  if(Array.isArray(data.news))data.news.forEach(function(item){try{addNewsItem(item);}catch(e){}});
  if(Array.isArray(data.pushTokens))data.pushTokens.forEach(function(t){try{addPushToken(t);}catch(e){}});
  if(Array.isArray(data.users))data.users.forEach(function(u){try{addUser(u);}catch(e){}});
  console.log("Migration complete.");
}

function tryParse(str,fallback){
  try{return JSON.parse(str);}catch(e){return fallback;}
}

migrateFromJson(require("path").resolve(process.cwd(),"data","store.json"));

module.exports={
  addNewsItem,getNews,getNewsById,updateNewsItem,deleteNewsItem,
  addPushToken,getPushTokens,removePushToken,
  getUsers,findUserByEmail,findUserById,addUser,updateUser,deleteUser,touchUserSeen,
  getAppSetting,setAppSetting,getAllAppSettings,
  pingSession,getOnlineCount,
  getStats
};
