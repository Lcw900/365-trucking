// Interaction helpers shared by customer screens.
export function installEnhancements({onService,onOffer}){
  installScrollMotion();
  document.addEventListener('click',event=>{
    const service=event.target.closest('[data-service]');
    if(service)onService(service.dataset.service);
    const offer=event.target.closest('[data-action="offer"]');
    if(offer)onOffer();
  });
}

function installScrollMotion(){
  const root=document.getElementById('app');
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(!root||!('IntersectionObserver' in window))return;
  const seen=new WeakSet();
  const reveal=element=>{
    element.classList.add('is-revealed');
    observer.unobserve(element);
  };
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries)if(entry.isIntersecting)reveal(entry.target);
  },{threshold:0.08,rootMargin:'0px 0px -32px 0px'});
  const selectors=[
    '.hero-body > *','.dashboard-hero > *','.page-main > h1','.page-main > .muted',
    '.page-toolbar','.progress-wrap','.booking-card','.confirmation',
    '.login-visual > div','.login-form','.tracking-layout',
    '.a-page-heading > *','.a-stat','.a-panel','.d-title > *','.d-stat','.d-quick','.d-card','.d-referral','.d-auth-heading','.d-auth-feature','.d-filters','.d-table-wrap','.section h2','.section .subtitle','.step','.vehicle','.benefit',
    '.review-card','.dots','.cta-actions','.stats > div',
    '.quick-card','.offer','.dashboard-orders .panel','.dashboard-ready',
    '.page-main .order-card','.site-footer .footer-top','.site-footer .copyright'
  ].join(',');
  let previousRoute;
  function prepare(){
    if(!root.children.length)return;
    const route=location.hash.split('#')[1]||'/';
    const enterPage=route!==previousRoute;
    previousRoute=route;
    let entranceIndex=0;
    for(const element of root.querySelectorAll(selectors)){
      if(seen.has(element))continue;
      seen.add(element);
      // Avoid double motion when a whole card already reveals its contents.
      if(element.parentElement.closest('.vehicle,.benefit,.quick-card,.offer,.dashboard-ready,.panel,.d-card,.d-quick,.d-stat,.a-panel'))continue;
      if(preference.matches)continue;
      const bounds=element.getBoundingClientRect();
      if(bounds.top<window.innerHeight-24){
        if(enterPage&&bounds.bottom>0){
          element.style.setProperty('--entrance-delay',`${Math.min(entranceIndex++,4)*110}ms`);
          element.classList.add('page-entrance');
        }
        continue;
      }
      const group=element.parentElement;
      const stagger=group.matches('.steps,.vehicle-grid,.benefits,.dashboard-grid,.stats,.order-list,.d-stats,.d-quick-grid,.a-stats');
      const index=stagger?Array.from(group.children).indexOf(element):0;
      element.style.setProperty('--reveal-delay',`${Math.min(index,3)*85}ms`);
      element.classList.add('scroll-reveal');
      observer.observe(element);
    }
  }
  let frame;
  new MutationObserver(()=>{
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(prepare);
  }).observe(root,{childList:true,subtree:true});
  root.addEventListener('focusin',event=>{
    const element=event.target.closest('.scroll-reveal');
    if(element)reveal(element);
  });
  preference.addEventListener('change',()=>{
    if(preference.matches){
      observer.disconnect();
      root.querySelectorAll('.scroll-reveal').forEach(reveal);
    }
  });
  prepare();
}
