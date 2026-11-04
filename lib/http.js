const asyncHandler=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const newsDTO=n=>({...JSON.parse(n.payload),id:n.id,title:n.title,status:n.status,version:n.version,slug:n.slug,publishedOn:n.publishedOn,hasPublished:!!n.publishedPayload,hasChanges:!!n.publishedPayload&&n.payload!==n.publishedPayload});
export {asyncHandler,newsDTO};
