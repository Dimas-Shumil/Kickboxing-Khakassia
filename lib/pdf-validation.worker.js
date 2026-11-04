import {parentPort,workerData} from 'node:worker_threads';
import {PDFDocument,PDFDict,PDFArray,PDFName} from 'pdf-lib';
try{
 const bytes=new Uint8Array(workerData);
 if(Buffer.from(bytes.subarray(0,5)).toString()!=='%PDF-')throw Error();
 const doc=await PDFDocument.load(bytes,{ignoreEncryption:false,throwOnInvalidObject:true,updateMetadata:false});
 if(doc.getPageCount()<1||doc.getPageCount()>2000)throw Error();
 const forbidden=new Set(['JS','JavaScript','OpenAction','AA','Launch','EmbeddedFiles','EmbeddedFile','RichMedia','XFA','AcroForm']);
 const actions=new Set(['JavaScript','Launch','SubmitForm','ImportData','GoToE','GoToR','Rendition','URI','Named','Sound','Movie','Hide','SetOCGState','Trans','Thread','GoTo3DView','ResetForm']);
 const seen=new Set(),queue=doc.context.enumerateIndirectObjects().map(([,o])=>o);let count=0;
 while(queue.length){const o=queue.pop();if(!o||seen.has(o))continue;seen.add(o);if(++count>100000)throw Error();
  if(o instanceof PDFDict){for(const [k,v] of o.entries()){if(forbidden.has(k.decodeText()))throw Error();if(k.decodeText()==='S'){const a=doc.context.lookup(v);if(a instanceof PDFName&&actions.has(a.decodeText()))throw Error();}queue.push(doc.context.lookup(v));}}
  else if(o instanceof PDFArray)for(let i=0;i<o.size();i++)queue.push(doc.context.lookup(o.get(i)));
  // Streams may contain attachment dictionaries, too.
  else if(o.dict)queue.push(o.dict);
 }
 parentPort.postMessage({ok:true});
}catch{parentPort.postMessage({ok:false});}
