import test from 'node:test';
import assert from 'node:assert/strict';
import {approveDecision,adminJobs,setAccountAccess,recordDemoPayment,reviewNonDelivery,adminState} from '../dist/admin-store.js';
import {advanceJob} from '../dist/driver-store.js';
import {accountRemoved,effectiveOrder} from '../dist/portal-state.js';
function memory(orders=[]){const data=new Map([['365-orders',JSON.stringify(orders)]]);return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}}
const review={reason:'Delivery completion reviewed by demo admin.',reviewed:true,amount:145};
test('completed delivery payout is approved once and audited',()=>{
 const storage=memory();const decision=approveDecision(storage,'finance-demo-1001','payout',review);
 assert.equal(decision.amount,145);assert.equal(adminState(storage).audit[0].action,'Driver payment approved');
 assert.throws(()=>approveDecision(storage,'finance-demo-1001','payout',review),/already been approved/);
 assert.throws(()=>approveDecision(storage,'finance-demo-1001','refund',review),/already been approved/);
});
test('driver payout requires completion and reviewed payment details',()=>{
 const storage=memory();assert.throws(()=>approveDecision(storage,'finance-demo-1002','payout',{...review,amount:95}),/only be approved after/);
 assert.throws(()=>approveDecision(storage,'finance-demo-1001','payout',{...review,reviewed:false}),/Confirm that you reviewed/);
 assert.throws(()=>approveDecision(storage,'finance-demo-1001','payout',{...review,amount:144}),/match the held/);
});
test('refund requires cancellation or reviewed non-delivery and rejects completed deliveries',()=>{
 const storage=memory();assert.throws(()=>approveDecision(storage,'finance-demo-1002','refund',{...review,amount:95}),/Confirm non-delivery/);
 assert.throws(()=>approveDecision(storage,'finance-demo-1001','refund',review),/not eligible/);
 reviewNonDelivery(storage,'finance-demo-1002','Customer confirmed items were never delivered.');
 approveDecision(storage,'finance-demo-1002','refund',{...review,amount:95});
 assert.equal(adminJobs(storage).find(j=>j.id==='finance-demo-1002').decision.type,'refund');
 assert.throws(()=>approveDecision(storage,'finance-demo-1002','payout',{...review,amount:95}),/already been approved/);
});
test('cash or uncollected bookings cannot produce a refund',()=>{
 const storage=memory([{id:'cash',total:80,status:'Cancelled',payment:'Cash on Delivery'},{id:'card',total:90,status:'Cancelled',payment:'Credit/Debit Card'}]);
 assert.throws(()=>approveDecision(storage,'cash','refund',{...review,amount:80}),/no platform payment/);
 assert.throws(()=>recordDemoPayment(storage,'cash','Reviewing cash collection.'),/paid directly/);
 assert.throws(()=>approveDecision(storage,'card','refund',{...review,amount:90}),/No payment is held/);
 recordDemoPayment(storage,'card','Sample card payment held for review.');
 approveDecision(storage,'card','refund',{...review,amount:90});
 assert.equal(effectiveOrder(storage,{id:'card'}).paymentStatus,'Refund approved (demo)');
});
test('non-delivery review stops driver progression and reaches customer state',()=>{
 const storage=memory([{id:'failed',status:'Accepted',driverStatus:'Accepted',total:95,payment:'Credit/Debit Card'}]);
 reviewNonDelivery(storage,'failed','Delivery was not made and was reviewed.');
 assert.equal(effectiveOrder(storage,{id:'failed'}).status,'Delivery Failed');
 assert.throws(()=>advanceJob(storage,'failed'),/cannot be advanced/);
});
test('removing and restoring driver access preserves bookings and finance records',()=>{
 const storage=memory([{id:'job',status:'Booking Confirmed',total:95}]);
 setAccountAccess(storage,'demo-driver-john',true,'Driver account removed for demo review.');
 assert.equal(accountRemoved(storage,'demo-driver-john'),true);
 assert.throws(()=>advanceJob(storage,'job'),/account has been removed/);
 assert.equal(JSON.parse(storage.getItem('365-orders')).length,1);
 setAccountAccess(storage,'demo-driver-john',false,'Driver account restored after review.');
 assert.equal(advanceJob(storage,'job'),'Accepted');
 assert.equal(adminState(storage).audit.length,2);
});
test('account actions require reasons and repeated removal is rejected',()=>{
 const storage=memory();assert.throws(()=>setAccountAccess(storage,'customer-local',true,'bad'),/at least 5/);
 setAccountAccess(storage,'customer-local',true,'Duplicate demo customer account.');
 assert.throws(()=>setAccountAccess(storage,'customer-local',true,'Another review reason.'),/already removed/);
 assert.equal(adminState(storage).accounts['customer-local'].status,'Removed');
});
