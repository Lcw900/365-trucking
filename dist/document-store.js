export const documentTypes=[['license-front','Driver’s license — front'],['license-back','Driver’s license — back'],['insurance','Vehicle insurance'],['identity','National ID / passport'],['background','Background check']];
export const documentTitle=kind=>documentTypes.find(x=>x[0]===kind)?.[1]||kind;
export const statusTitle=status=>({pending:'Pending review',approved:'Approved',replacement_requested:'Replacement requested'})[status]||'Not uploaded';
const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
export async function validateDocument(file){
 if(!file||!extensions[file.type]||!file.size||file.size>10*1024*1024)throw Error('Choose a JPG, PNG, WebP or PDF file up to 10 MB.');
 const b=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const matches=file.type==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:file.type==='image/png'?[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v):file.type==='image/webp'?String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP':String.fromCharCode(...b.slice(0,5))==='%PDF-';
 if(!matches)throw Error('This file does not match its image or PDF format. Export a new copy and try again.');
}
export async function uploadDriverDocument(client,driverId,kind,file,expectedVersion=0){
 if(!documentTypes.some(t=>t[0]===kind))throw Error('Unknown document type.');
 if(!/^[a-f0-9-]{36}$/i.test(driverId))throw Error('Sign in with your driver account first.');
 await validateDocument(file);
 const path=driverId+'/'+kind+'/'+crypto.randomUUID()+'.'+extensions[file.type];
 const {error:uploadError}=await client.storage.from('driver-documents').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'0'});if(uploadError)throw uploadError;
 const {data,error}=await client.rpc('submit_driver_document',{p_kind:kind,p_path:path,p_name:file.name.slice(0,255),p_expected_version:expectedVersion});if(error)throw error;return data;
}
export async function reviewDriverDocument(client,doc,status,note=''){
 if(!['approved','replacement_requested'].includes(status))throw Error('Choose a valid decision.');
 if(status==='replacement_requested'&&note.trim().length<3)throw Error('Enter a reason for requesting a replacement.');
 const {data,error}=await client.rpc('review_driver_document',{p_document_id:doc.id,p_version:doc.version,p_status:status,p_note:note.trim()});if(error)throw error;return data;
}
