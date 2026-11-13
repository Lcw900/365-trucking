export const CUSTOMER_ID='customer-local';
export const LOCAL_DRIVER_ID='demo-driver-john';
export function storedValue(storage,key,fallback){try{return JSON.parse(storage.getItem(key))??fallback}catch{return fallback}}
export function adminState(storage){const raw=storedValue(storage,'365-admin-state',{});return {version:1,accounts:{},decisions:{},reviews:{},payments:{},audit:[],...raw}}
export function accountRemoved(storage,id){return adminState(storage).accounts[id]?.status==='Removed'}
export function effectiveOrder(storage,order){
 const state=adminState(storage),review=state.reviews[order.id],decision=state.decisions[order.id];
 return {...order,customerId:order.customerId||CUSTOMER_ID,
  ...(review?.outcome==='Not Delivered'?{status:'Delivery Failed',driverStatus:'Failed',adminReview:review}:{}),
  ...(decision?{adminDecision:decision,paymentStatus:decision.type==='refund'?'Refund approved (demo)':'Driver payment approved (demo)'}:{})};
}
