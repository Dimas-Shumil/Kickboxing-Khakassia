import path from 'node:path';

// These files are rendered by dedicated routes, never by static-file middleware.
const templateNames = new Set(['athlete','athlete-profile','coach-legend','coach-profile','coaches','hall-of-fame','history-item','product']);
export function isServerTemplatePath(requestPath) {
 let decoded;
 try { decoded = decodeURIComponent(requestPath); } catch { return false; }
 const normalized = path.posix.normalize('/' + decoded.replaceAll('\\','/')).toLowerCase().replace(/\/$/,'');
 const name = normalized.replace(/^\/(?:public\/)?/,'').replace(/\.html$/,'');
 return templateNames.has(name);
}
