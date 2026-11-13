import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDocument,uploadDriverDocument,reviewDriverDocument} from '../dist/document-store.js';
const file=(type='image/png',bytes=[137,80,78,71,13,10,26,10,0])=>new File([new Uint8Array(bytes)],'sample.png',{type});
const driver='11111111-1111-4111-8111-111111111111';
test('document validator rejects disguised files, unsupported types and oversized scans',async()=>{
 await assert.rejects(validateDocument(file('image/png',[60,115,118,103,62])),/format/);
 await assert.rejects(validateDocument(file('image/svg+xml')),/Choose/);
 await assert.rejects(validateDocument(new File([new Uint8Array(10485761)],'large.pdf',{type:'application/pdf'})),/10 MB/);
 await validateDocument(file());await validateDocument(file('application/pdf',[37,80,68,70,45,49]));
});
test('upload uses an immutable owner path and submits the expected version only after storage succeeds',async()=>{
 const calls=[];const client={storage:{from(bucket){assert.equal(bucket,'driver-documents');return{async upload(path,body,options){calls.push(path);assert.match(path,new RegExp('^'+driver+'/insurance/[a-f0-9-]+\\.png$'));assert.equal(options.upsert,false);return{}}}}},async rpc(name,args){assert.equal(name,'submit_driver_document');assert.equal(calls.length,1);assert.equal(args.p_expected_version,2);assert.equal(args.p_path,calls[0]);assert.equal(args.p_kind,'insurance');return{data:{status:'pending'}}}};
 assert.equal((await uploadDriverDocument(client,driver,'insurance',file(),2)).status,'pending');
});
test('failed uploads cannot create phantom document submissions',async()=>{
 let submitted=false;const client={storage:{from(){return{async upload(){return{error:new Error('Upload failed')}}}}},rpc(){submitted=true}};
 await assert.rejects(uploadDriverDocument(client,driver,'identity',file()),/Upload failed/);assert.equal(submitted,false);
});
test('replacement decisions require reasons and carry the reviewed version for concurrency checks',async()=>{
 let args;const client={async rpc(name,input){assert.equal(name,'review_driver_document');args=input;return{data:input}}};
 await assert.rejects(reviewDriverDocument(client,{id:driver,version:3},'replacement_requested',''),/reason/);
 await reviewDriverDocument(client,{id:driver,version:3},'replacement_requested','  Scan is blurry  ');assert.equal(args.p_version,3);assert.equal(args.p_note,'Scan is blurry');
});
