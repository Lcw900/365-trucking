import {designJobs} from './driver-data.js';
import {driverJobs} from './driver-store.js?v=2';
import {adminState,storedValue,CUSTOMER_ID,LOCAL_DRIVER_ID} from './portal-state.js';
export const financeSamples=[
 {id:'finance-demo-1001',displayId:'DEMO-1001',customer:'Nicole Allen',customerId:'sample-customer-nicole-allen',driverId:LOCAL_DRIVER_ID,driverName:'John Miller',pickup:'Demo Warehouse',dropoff:'Demo Business Center',date:'2027-01-15',time:'14:30',vehicle:'Cargo Van',total:145,status:'Completed',payment:'Credit/Debit Card',captured:true,sample:true,completedAt:'2027-01-15T16:22:00Z'},
 {id:'finance-demo-1002',displayId:'DEMO-1002',customer:'Robert Johnson',customerId:'sample-customer-robert-johnson',driverId:LOCAL_DRIVER_ID,driverName:'John Miller',pickup:'Demo Retail Store',dropoff:'Demo Customer Home',date:'2027-01-16',time:'10:00',vehicle:'Box Truck',total:95,status:'In Progress',payment:'Credit/Debit Card',captured:true,sample:true},
 {id:'finance-demo-1003',displayId:'DEMO-1003',customer:'Jennifer Davis',customerId:'sample-customer-jennifer-davis',driverId:LOCAL_DRIVER_ID,driverName:'John Miller',pickup:'Demo Storage Unit',dropoff:'Demo Apartment',date:'2027-01-16',time:'12:00',vehicle:'Cargo Van',total:88.5,status:'Cancelled',payment:'Digital Wallet',captured:true,sample:true},
 {id:'finance-demo-1004',displayId:'DEMO-1004',customer:'Michael Brown',customerId:'sample-customer-michael-brown',driverId:LOCAL_DRIVER_ID,driverName:'John Miller',pickup:'Demo Office',dropoff:'Demo Downtown',date:'2027-01-17',time:'09:30',vehicle:'Pickup Truck',total:110,status:'Accepted',payment:'Credit/Debit Card',captured:false,sample:true}
];
const customerKey=name=>'sample-customer-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
export function adminAccounts(storage){
 const state=adminState(storage),customer=storedValue(storage,'365-profile',{}),driver=storedValue(storage,'365-driver-profile',{});
 const accounts=[{id:CUSTOMER_ID,role:'Customer',name:customer.name||'Local Customer',email:customer.email||'',source:'Local profile'},
  {id:LOCAL_DRIVER_ID,role:'Driver',name:[driver.firstName||'John',driver.lastName||'Miller'].join(' '),email:driver.email||'john.miller@example.com',source:'Local profile'},
  {id:'sample-driver-ahmed',role:'Driver',name:'Ahmed Hassan',email:'',source:'Design sample'}];
 for(const job of designJobs){const id=customerKey(job.customer);if(!accounts.some(a=>a.id===id))accounts.push({id,role:'Customer',name:job.customer,email:'',source:'Design sample'})}
 return accounts.map(account=>({...account,status:state.accounts[account.id]?.status||'Active',removal:state.accounts[account.id]}));
}
export function adminJobs(storage){
 const state=adminState(storage),sourceOrders=storedValue(storage,'365-orders',[]),profile=storedValue(storage,'365-profile',{});
 const base=driverJobs(storage).map(job=>{
  const original=sourceOrders.find(o=>o.id===job.id);
  return {...job,customerId:original?.customerId||(job.sample?customerKey(job.customer):CUSTOMER_ID),
   customer:original?.customerName||(!job.sample&&profile.name)||job.customer,
   driverId:job.driverId||(['Accepted','In Progress','Picked Up','Completed'].includes(job.status)?LOCAL_DRIVER_ID:null),
   driverName:original?.driverName||(['Accepted','In Progress','Picked Up','Completed'].includes(job.status)?'John Miller':''),
   payment:original?.payment||'Design sample',captured:false,completedAt:original?.completedAt,
   historical:job.sample};
 });
 return [...base,...financeSamples].map(job=>{
  const review=state.reviews[job.id],decision=state.decisions[job.id];
  return {...job,...(review?.outcome==='Not Delivered'?{status:'Failed'}:{}),review,decision,
   captured:state.payments[job.id]?.captured??job.captured,
   paymentLabel:decision?(decision.type==='refund'?'Refund approved':'Payout approved'):job.captured||state.payments[job.id]?.captured?'Held (demo)':job.payment==='Cash on Delivery'?'Cash on delivery':'Not recorded'};
 });
}
function write(storage,state,event){
 state.audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),actor:'Demo Admin',...event});
 storage.setItem('365-admin-state',JSON.stringify(state));
}
function reasonRequired(reason){if(typeof reason!=='string'||reason.trim().length<5)throw Error('Add a reason with at least 5 characters.');return reason.trim().slice(0,500)}
function findJob(storage,id){const job=adminJobs(storage).find(j=>j.id===id);if(!job)throw Error('This delivery was not found.');return job}
export function setAccountAccess(storage,id,removed,reason){
 const account=adminAccounts(storage).find(a=>a.id===id);if(!account)throw Error('Account not found.');
 if((account.status==='Removed')===removed)throw Error(removed?'This account is already removed.':'This account is already active.');
 const state=adminState(storage),note=reasonRequired(reason);
 state.accounts[id]={status:removed?'Removed':'Active',reason:note,at:new Date().toISOString()};
 write(storage,state,{action:removed?'Account removed':'Account restored',entity:id,label:account.name,role:account.role,reason:note});
}
export function reviewNonDelivery(storage,id,reason){
 const job=findJob(storage,id),state=adminState(storage);
 if(job.status==='Completed')throw Error('A completed delivery cannot be marked as not delivered.');
 if(job.decision)throw Error('A financial decision already exists for this delivery.');
 if(job.review?.outcome==='Not Delivered')throw Error('Non-delivery has already been recorded.');
 const note=reasonRequired(reason);
 state.reviews[id]={outcome:'Not Delivered',reason:note,at:new Date().toISOString()};
 write(storage,state,{action:'Non-delivery recorded',entity:id,label:job.displayId,reason:note});
}
export function recordDemoPayment(storage,id,reason){
 const job=findJob(storage,id),state=adminState(storage);
 if(!Number.isFinite(job.total)||job.total<=0)throw Error('A valid positive payment amount is required.');
 if(job.decision)throw Error('A financial decision already exists.');
 if(job.captured)throw Error('A demo payment has already been recorded.');
 if(job.payment==='Cash on Delivery')throw Error('Cash-on-delivery payments are paid directly to the driver. No platform payment is held.');
 const note=reasonRequired(reason);
 state.payments[id]={captured:true,amount:job.total,at:new Date().toISOString()};
 write(storage,state,{action:'Demo payment recorded',entity:id,label:job.displayId,amount:job.total,reason:note});
}
export function decisionEligibility(job,type){
 if(job.decision)return 'A payout or refund has already been approved for this delivery.';
 if(!Number.isFinite(job.total)||job.total<=0)return 'A valid positive payment amount is required.';
 if(!job.captured)return job.payment==='Cash on Delivery'?'Cash is paid directly to the driver; there is no platform payment to release or refund.':'No payment is held. Record a demo payment before approving a financial decision.';
 if(type==='payout'){
  if(job.status!=='Completed')return 'Driver payment can only be approved after the delivery is completed.';
  if(!job.driverId)return 'A driver must be assigned before approving payment.';
 }else if(type==='refund'){
  if(job.status==='Completed')return 'Completed deliveries are not eligible for a non-delivery refund.';
  if(!['Cancelled','Failed'].includes(job.status))return 'Confirm non-delivery or cancellation before approving a refund.';
 }else return 'Unsupported financial decision.';
 return '';
}
export function approveDecision(storage,id,type,{reason,reviewed=false,amount}={}){
 const job=findJob(storage,id),state=adminState(storage),error=decisionEligibility(job,type);
 if(error)throw Error(error);
 if(!reviewed)throw Error('Confirm that you reviewed the delivery and payment details.');
 if(Number(amount)!==job.total)throw Error('The approved amount must match the held booking amount.');
 const note=reasonRequired(reason);
 const decision={type,amount:job.total,reason:note,at:new Date().toISOString(),actor:'Demo Admin',status:'Approved (demo)',driverId:job.driverId,customerId:job.customerId};
 state.decisions[id]=decision;
 write(storage,state,{action:type==='payout'?'Driver payment approved':'Customer refund approved',entity:id,label:job.displayId,amount:job.total,reason:note});
 return decision;
}
export {adminState};
