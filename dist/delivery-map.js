import {mapsConfig} from './maps-config.js';
let loading;
const hosts=new Set();
function fail(host,message){host.dataset.mapState='error';const status=host.querySelector('[data-map-message]');if(status)status.textContent=message;host.querySelector('[data-map-canvas]')?.setAttribute('hidden','');}
const authFailure=()=>{for(const host of hosts)if(host.isConnected)fail(host,'Google Maps could not authorize this website. Check the API key’s website restrictions, enabled API and billing in Google Cloud.');};
window.gm_authFailure=authFailure;
export function loadMaps(){
 if(window.google?.maps?.importLibrary)return Promise.resolve(window.google.maps);
 if(loading)return loading;
 loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.async=true;
  const timer=setTimeout(()=>reject(new Error('The map took too long to load. Check your connection and refresh the page.')),20000);
  window.truckingMapsReady=()=>{clearTimeout(timer);delete window.truckingMapsReady;resolve(window.google.maps)};
  script.onerror=()=>{clearTimeout(timer);script.remove();delete window.truckingMapsReady;loading=undefined;reject(new Error('Unable to load Google Maps. Check your connection and refresh the page.'))};
  const params=new URLSearchParams({key:mapsConfig.browserKey,v:'weekly',loading:'async',callback:'truckingMapsReady'});
  script.src='https://maps.googleapis.com/maps/api/js?'+params;document.head.append(script);
 });return loading;
}
export function deliveryMapMarkup({sample=false,region='customer'}={}){
 return `<section class="delivery-map" data-delivery-map data-sample="${sample?'true':'false'}" data-region="${region}"><div class="delivery-map-heading"><strong>Delivery map</strong><span>${sample?'Illustrative sample locations':'Waiting for delivery location'}</span></div><div data-map-canvas class="delivery-map-canvas" role="region" aria-label="Delivery location map"></div><p data-map-message role="status">Loading map…</p><p class="delivery-map-note">${sample?'Sample pins show an example only. No live driver location or arrival estimate is available.':'Live GPS is not connected yet. Pickup and drop-off pins will appear when verified coordinates are available.'}</p></section>`;
}
export async function mountDeliveryMap(host){
 if(host.dataset.mapState)return;host.dataset.mapState='loading';hosts.add(host);
 try{const maps=await loadMaps();if(!host.isConnected)return;const {Map}=await maps.importLibrary('maps');if(!host.isConnected)return;
 const sample=host.dataset.sample==='true',driver=host.dataset.region==='driver';
 const center=sample?(driver?{lat:34.0522,lng:-118.2437}:{lat:25.0805,lng:55.1403}):{lat:39.8283,lng:-98.5795};
 const map=new Map(host.querySelector('[data-map-canvas]'),{center,zoom:sample?13:4,mapId:mapsConfig.mapId,mapTypeControl:false,streetViewControl:false,fullscreenControl:true,gestureHandling:'cooperative'});
 if(sample){const {AdvancedMarkerElement}=await maps.importLibrary('marker');if(!host.isConnected)return;
 for(const [title,position] of [['Example pickup',center],['Example drop-off',{lat:center.lat+.022,lng:center.lng+.018}]])new AdvancedMarkerElement({map,position,title});}
 if(host.dataset.mapState==='error')return;host.dataset.mapState='ready';host.querySelector('[data-map-message]').textContent=sample?'Example map · not live tracking':'Map connected · no driver location available';
 }catch(error){if(host.isConnected)fail(host,error.message||'The map is unavailable. Refresh to try again.')}finally{for(const item of hosts)if(!item.isConnected)hosts.delete(item)}
}
const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);mountDeliveryMap(entry.target)}},{rootMargin:'120px'});
export function observeDeliveryMaps(){for(const host of document.querySelectorAll('[data-delivery-map]:not([data-map-observed])')){host.dataset.mapObserved='true';observer.observe(host)}}
