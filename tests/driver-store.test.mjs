import test from 'node:test';
import assert from 'node:assert/strict';
import {driverJobs,advanceJob,rejectJob} from '../dist/driver-store.js';
function memory(orders=[]){const data=new Map([['365-orders',JSON.stringify(orders)]]);return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}}
test('customer booking progresses through driver workflow and updates customer status',()=>{
 const storage=memory([{id:'test-1',pickup:'A',dropoff:'B',total:100,status:'Booking Confirmed'}]);
 assert.equal(driverJobs(storage).find(j=>j.id==='test-1').status,'Pending');
 for(const status of ['Accepted','In Progress','Picked Up','Completed'])assert.equal(advanceJob(storage,'test-1','Demo Driver'),status);
 const customer=JSON.parse(storage.getItem('365-orders'))[0];
 assert.equal(customer.status,'Delivered');assert.equal(customer.driverName,'Demo Driver');assert.ok(customer.completedAt);
 assert.throws(()=>advanceJob(storage,'test-1'),/cannot be advanced/);
});
test('cancelled or other-driver bookings cannot be accepted',()=>{
 const storage=memory([{id:'cancelled',status:'Cancelled'},{id:'assigned',status:'Accepted',driverStatus:'Accepted',driverId:'someone-else'}]);
 assert.throws(()=>advanceJob(storage,'cancelled'),/cannot be advanced/);
 assert.throws(()=>advanceJob(storage,'assigned'),/another driver/);
});
test('declining a pending customer booking preserves the customer request',()=>{
 const storage=memory([{id:'pending',status:'Booking Confirmed'}]);rejectJob(storage,'pending');
 assert.equal(JSON.parse(storage.getItem('365-orders'))[0].status,'Booking Confirmed');
 assert.deepEqual(JSON.parse(storage.getItem('365-driver-declined')),['pending']);
});
test('sample job updates stay isolated from customer orders',()=>{
 const storage=memory();const job=driverJobs(storage).find(j=>j.sample&&j.status==='Pending');
 advanceJob(storage,job.id);assert.equal(driverJobs(storage).find(j=>j.id===job.id).status,'Accepted');
 assert.deepEqual(JSON.parse(storage.getItem('365-orders')),[]);
});
