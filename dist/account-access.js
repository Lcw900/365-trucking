import {accountRemoved,adminState,CUSTOMER_ID,LOCAL_DRIVER_ID} from './portal-state.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderAccessNotice(app,role){
 const id=role==='Driver'?LOCAL_DRIVER_ID:CUSTOMER_ID;
 if(!accountRemoved(localStorage,id))return false;
 const record=adminState(localStorage).accounts[id];
 app.innerHTML=`<main class="access-notice"><a href="#/" class="access-logo"><img src="assets/4b7b8.png" alt="365 Trucking"></a><div class="access-symbol">!</div><h1>Account access removed</h1><p>Your ${role.toLowerCase()} account was removed by an administrator.</p><div class="access-reason"><strong>Reason</strong><p>${escape(record.reason)}</p></div><p>Existing delivery and financial records have been retained for review. Contact support if you believe this was a mistake.</p><a class="btn" href="#/${role==='Driver'?'driver/support':'support'}">Contact Support</a><a class="text-btn" href="#/admin/${role==='Driver'?'drivers':'customers'}">Return to demo admin →</a><small>This is local demo access control. Production permissions require server-side authentication.</small></main>`;
 return true;
}
