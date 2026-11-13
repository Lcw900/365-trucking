import {designJobs} from './driver-data.js';
import {effectiveOrder,adminState,accountRemoved} from './portal-state.js';
export const DRIVER_ID='demo-driver-john';
export function readStored(storage,key,fallback){try{return JSON.parse(storage.getItem(key))??fallback}catch{return fallback}}
export function driverJobs(storage){
  const changes=readStored(storage,'365-driver-job-state',{});
  const samples=designJobs.map(job=>({...job,...changes[job.id]}));
  const bookings=readStored(storage,'365-orders',[]).map(order=>effectiveOrder(storage,order)).map(order=>({
    id:order.id,displayId:order.id,customer:order.customerName||'365 Trucking Customer',
    pickup:order.pickup,dropoff:order.dropoff,date:order.date,time:order.time,
    vehicle:order.vehicle,total:order.total,service:order.service,notes:order.notes,
    extras:order.extras||[],stops:order.stops||[],sample:false,
    status:order.status==='Cancelled'?'Cancelled':order.driverStatus||'Pending',driverId:order.driverId,paymentStatus:order.paymentStatus
  }));
  const state=adminState(storage),reviews=state.reviews;
  return [...bookings,...samples].map(job=>({...job,...(reviews[job.id]?.outcome==='Not Delivered'?{status:'Failed'}:{}),...(state.decisions[job.id]?{paymentStatus:state.decisions[job.id].type==='payout'?'Payout approved (demo)':'Refund approved (demo)'}:{})}));
}
const nextStatus={Pending:'Accepted',Accepted:'In Progress','In Progress':'Picked Up','Picked Up':'Completed'};
export function advanceJob(storage,id,driverName='John Miller'){
  if(accountRemoved(storage,DRIVER_ID))throw new Error('This driver account has been removed. Contact the administrator.');
  const job=driverJobs(storage).find(j=>j.id===id);
  if(!job)throw new Error('This job is no longer available.');
  const next=nextStatus[job.status];
  if(!next)throw new Error('This job cannot be advanced.');
  if(job.driverId&&job.driverId!==DRIVER_ID)throw new Error('This job has already been assigned to another driver.');
  const update={status:next,driverId:DRIVER_ID,updatedAt:new Date().toISOString()};
  if(job.sample){const changes=readStored(storage,'365-driver-job-state',{});changes[id]={...changes[id],...update};storage.setItem('365-driver-job-state',JSON.stringify(changes));}
  else{
    const orders=readStored(storage,'365-orders',[]),order=orders.find(o=>o.id===id);
    if(!order||order.status==='Cancelled')throw new Error('This booking was cancelled.');
    Object.assign(order,{driverStatus:next,driverId:DRIVER_ID,driverName,status:({Accepted:'Accepted','In Progress':'Driver En Route','Picked Up':'In Transit',Completed:'Delivered'})[next],updatedAt:update.updatedAt});
    if(next==='Completed')order.completedAt=update.updatedAt;
    storage.setItem('365-orders',JSON.stringify(orders));
  }
  return next;
}
export function rejectJob(storage,id){
  const job=driverJobs(storage).find(j=>j.id===id);
  if(!job||job.status!=='Pending')throw new Error('Only pending jobs can be declined.');
  const declined=readStored(storage,'365-driver-declined',[]);
  if(!declined.includes(id))declined.push(id);
  storage.setItem('365-driver-declined',JSON.stringify(declined));
}
