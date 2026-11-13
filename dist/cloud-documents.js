import {supabase,authReady,session,account} from './auth-client.js';
import {documentTypes,documentTitle,statusTitle,uploadDriverDocument,reviewDriverDocument} from './document-store.js';
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s?new Date(s).toLocaleString():'—';
const errorText=err=>/relation|schema cache|function.*not.*find/i.test(err?.message||'')?'Document storage is not set up yet. Contact the administrator.':err?.message||'Unable to load documents. Please try again.';
let activeDialog;
async function previewFile(doc,button){
 button.disabled=true;const original=button.textContent;button.textContent='Opening…';
 try{const {data,error}=await supabase.storage.from('driver-documents').download(doc.object_path);if(error)throw error;
 if(!button.isConnected)return;
 activeDialog?.close();const dialog=document.createElement('dialog'),url=URL.createObjectURL(data);activeDialog=dialog;dialog.className='document-viewer';dialog.innerHTML='<div class="document-viewer-heading"><h2>'+e(documentTitle(doc.kind))+'</h2><button type="button" aria-label="Close document">×</button></div><p>'+e(doc.file_name)+'</p>';
 if(doc.mime_type.startsWith('image/')){const img=new Image();img.src=url;img.alt=documentTitle(doc.kind);dialog.append(img)}else{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.className='btn';a.textContent='Open PDF in a new tab';dialog.append(a)}
 const download=document.createElement('a');download.href=url;download.download=doc.file_name;download.className='btn outline';download.textContent='Download file';dialog.append(download);
 dialog.querySelector('button').onclick=()=>dialog.close();dialog.onclose=()=>{URL.revokeObjectURL(url);dialog.remove();if(activeDialog===dialog)activeDialog=null};document.body.append(dialog);dialog.showModal();
 }catch(err){const status=button.closest('.cloud-document').querySelector('[role=status]');status.textContent=errorText(err)}finally{button.disabled=false;button.textContent=original}
}
window.addEventListener('hashchange',()=>activeDialog?.close());
window.addEventListener('365-auth-change',()=>activeDialog?.close());
export async function renderCloudDocuments(root,{admin=false,driverId=null}={}){
 root.innerHTML='<p role="status">Loading verification documents…</p>';
 await authReady;if(!root.isConnected)return;
 if(!session||!account||(admin?account.role!=='admin':account.role!=='driver')){root.innerHTML='<p role="status">Sign in with the correct account to access verification documents.</p>';return}
 let selected=admin?driverId:session.user.id;
 async function load(message=''){
 if(!root.isConnected)return;
 root.innerHTML='<p role="status">Loading verification documents…</p>';
 try{
 let drivers=[];
 if(admin){const {data,error}=await supabase.from('profiles').select('id,display_name,status').eq('role','driver').order('display_name');if(error)throw error;drivers=data;
 if(!selected&&drivers.length)selected=drivers[0].id;if(selected&&!drivers.some(d=>d.id===selected))throw Error('Driver account not found.');}
 if(!selected){root.innerHTML='<div class="media-card"><h2>No driver accounts yet</h2><p>Registered drivers and their uploaded documents will appear here.</p></div>';return}
 const [filesResult,historyResult]=await Promise.all([supabase.from('driver_documents').select('*').eq('driver_id',selected).order('kind'),supabase.from('driver_document_events').select('id,action,version,note,created_at,document_id').eq('driver_id',selected).order('created_at',{ascending:false}).limit(20)]);
 if(filesResult.error)throw filesResult.error;if(historyResult.error)throw historyResult.error;if(!root.isConnected)return;
 const files=filesResult.data,history=historyResult.data,approved=files.filter(d=>d.status==='approved').length,pending=files.filter(d=>d.status==='pending').length;
 root.innerHTML=`${admin?'<div class="media-card document-driver-select"><label for="document-driver">Driver account</label><select id="document-driver">'+drivers.map(d=>'<option value="'+e(d.id)+'" '+(d.id===selected?'selected':'')+'>'+e(d.display_name||'Driver')+' — '+e(d.status)+'</option>').join('')+'</select><p>Documents from real registered driver accounts. Account eligibility is managed separately.</p></div>':''}<div class="media-card document-summary"><h2>${admin?'Driver verification documents':'Documents & verification'}</h2><p>${files.length} of 5 uploaded · ${approved} approved · ${pending} awaiting review</p><p>${admin?'Open each file before reviewing it. Request a replacement when a document is unclear or out of date.':'Upload a clear scan or photo. Each upload is submitted to the admin for review. Replacing a file resets its approval.'}</p><p>Accepted: JPG, PNG, WebP or PDF. Maximum 10 MB per file. Files are private to this driver and authorized admins.</p><button type="button" class="btn outline" data-refresh-documents>Refresh documents</button><p role="status" aria-live="polite">${e(message)}</p></div><div class="cloud-document-grid"></div><section class="media-card document-history"><h2>Review history</h2>${history.length?'<ul>'+history.map(h=>'<li><strong>'+e(documentTitle(files.find(d=>d.id===h.document_id)?.kind||'Document')+' — '+(h.action==='uploaded'?'Uploaded':statusTitle(h.action)))+'</strong> · Version '+h.version+' · '+e(date(h.created_at))+(h.note?'<p>'+e(h.note)+'</p>':'')+'</li>').join('')+'</ul>':'<p>No uploads or reviews yet.</p>'}</section>`;
 root.querySelector('[data-refresh-documents]').onclick=()=>load();
 if(admin)root.querySelector('select').onchange=event=>{location.hash='/admin/documents/'+event.target.value};
 const grid=root.querySelector('.cloud-document-grid');
 for(const [kind,title] of documentTypes){const doc=files.find(d=>d.kind===kind),card=document.createElement('section');card.className='media-card cloud-document';card.innerHTML='<div class="cloud-document-heading"><h3>'+e(title)+'</h3><span class="document-status '+(doc?.status||'empty')+'">'+e(statusTitle(doc?.status))+'</span></div>'+(doc?'<p class="document-filename">'+e(doc.file_name)+'</p><p>Version '+doc.version+' · Uploaded '+e(date(doc.uploaded_at))+'</p>'+(doc.reviewed_at?'<p>Reviewed '+e(date(doc.reviewed_at))+'</p>':'')+(doc.review_note?'<p class="document-review-note">Admin note: '+e(doc.review_note)+'</p>':''):'<p>No file uploaded.</p>')+'<div class="document-actions"></div><p role="status" aria-live="polite"></p>';
 const actions=card.querySelector('.document-actions');
 if(doc){const view=document.createElement('button');view.type='button';view.className='btn outline';view.textContent='View '+title;view.onclick=()=>previewFile(doc,view);actions.append(view)}
 if(!admin){
 const upload=(camera=false)=>{const label=document.createElement('label');label.className='btn'+(camera?' outline':'');label.tabIndex=0;label.setAttribute('role','button');label.textContent=camera?'Take photo':doc?'Replace file':'Upload file';label.setAttribute('aria-label',(camera?'Take photo of ':doc?'Replace ':'Upload ')+title);const input=document.createElement('input');input.type='file';input.accept=camera?'image/jpeg,image/png,image/webp':'image/jpeg,image/png,image/webp,application/pdf';input.hidden=true;if(camera)input.setAttribute('capture','environment');label.append(input);label.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();input.click()}};
 input.onchange=async()=>{const file=input.files[0];if(!file)return;for(const input of root.querySelectorAll('input,button,select'))input.disabled=true;for(const label of root.querySelectorAll('label[role=button]'))label.style.pointerEvents='none';card.querySelector('[role=status]').textContent='Uploading securely…';try{await uploadDriverDocument(supabase,selected,kind,file,doc?.version||0);await load(title+' uploaded and submitted for review.')}catch(err){card.querySelector('[role=status]').textContent=errorText(err);for(const input of root.querySelectorAll('input,button,select'))input.disabled=false;for(const label of root.querySelectorAll('label[role=button]'))label.style.pointerEvents='';}input.value='';};actions.append(label)};upload();upload(true);
 }else if(doc?.status==='pending'){
 const label=document.createElement('label');label.textContent='Review note for '+title;const textarea=document.createElement('textarea');textarea.maxLength=1000;textarea.rows=3;textarea.placeholder='Required when requesting a replacement';label.append(textarea);card.append(label);
 for(const [decision,text] of [['approved','Approve document'],['replacement_requested','Request replacement']]){const button=document.createElement('button');button.type='button';button.className='btn'+(decision==='approved'?'':' outline');button.textContent=text;button.setAttribute('aria-label',text+': '+title);button.onclick=async()=>{const buttons=card.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{await reviewDriverDocument(supabase,doc,decision,textarea.value);await load(title+': '+statusTitle(decision)+'.')}catch(err){card.querySelector('[role=status]').textContent=errorText(err);buttons.forEach(b=>b.disabled=false)}};actions.append(button)}
 }grid.append(card);
 }
 }catch(err){if(!root.isConnected)return;root.innerHTML='<section class="media-card"><h2>Documents unavailable</h2><p role="status">'+e(errorText(err))+'</p><button type="button" class="btn outline">Try again</button></section>';root.querySelector('button').onclick=()=>load()}
 }
 await load();
}
