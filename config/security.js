function securityConfig(config){return{
 cookieName:config.production?'__Host-fed_admin_session':'fed_admin_session',
 cookieOptions:{httpOnly:true,secure:config.production,sameSite:'strict',path:'/'},
 absoluteTtlMs:(config.sessionHours||4)*60*60*1000,
 idleTtlMs:(config.sessionIdleMinutes||2)*60*1000,
 touchIntervalMs:20*1000,maxSessions:3,
};}
export {securityConfig};
