import {createClient} from '@supabase/supabase-js';
import {supabaseUrl,supabasePublishableKey} from './public-config.js';
export const supabase=createClient(supabaseUrl,supabasePublishableKey,{auth:{flowType:'pkce',detectSessionInUrl:true,persistSession:true,autoRefreshToken:true}});
export let session=null;
export let account=null;
export let setupError='';
let ready=false;
async function loadAccount(){account=null;setupError='';if(!session)return;const {data,error}=await supabase.from('profiles').select('id,display_name,role,status').eq('id',session.user.id).single();if(error)setupError='Your sign-in succeeded, but account permissions are not ready. Run the supplied Supabase setup SQL, then sign in again.';else account=data;}
export const authReady=(async()=>{try{const {data,error}=await supabase.auth.getSession();if(error)throw error;session=data.session;await loadAccount();}catch{setupError='Unable to connect to authentication. Check your connection and try again.'}ready=true;})();
supabase.auth.onAuthStateChange((event,next)=>{session=next;if(event==='PASSWORD_RECOVERY')location.hash='/auth/password';if(ready&&event!=='INITIAL_SESSION')setTimeout(async()=>{await loadAccount();window.dispatchEvent(new Event('365-auth-change'));},0)});
const home=role=>role==='driver'?'/driver/dashboard':role==='admin'?'/admin/overview':'/dashboard';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function frame(root,title,content){root.innerHTML=`<main class="secure-auth"><a href="#/" class="secure-brand" aria-label="365 Trucking home"><img src="assets/branding/365-trucking-updated.png" alt="365 Trucking"></a><section class="booking-card"><h1>${title}</h1>${content}<p class="secure-status" role="status" aria-live="polite"></p></section><p><a href="#/">← Back to home</a></p></main>`}
export function authGate(root,route){
 const driver=route.startsWith('/driver'),admin=route.startsWith('/admin'),role=admin?'admin':driver?'driver':'customer';
 const signup=/^\/(signup|driver\/signup)/.test(route),forgot=route==='/forgot'||route==='/driver/forgot',password=route==='/auth/password';
 const login=route==='/login'||route==='/driver/login'||route==='/admin/login';
 if(route==='/auth/signout'){frame(root,'Sign out','<p>Signing out…</p>');supabase.auth.signOut().then(({error})=>{if(error)root.querySelector('[role=status]').textContent=error.message;else location.hash='/login'});return true}
 if(login||signup||forgot||password){authForm(root,{role,signup,forgot,password});return true}
 const protectedRoute=driver||admin||/^\/(dashboard|book|orders|track|profile|notifications|confirmed)(\/|$)/.test(route);
 if(!protectedRoute)return false;
 if(!session){authForm(root,{role});return true}
 if(setupError||!account){frame(root,'Account setup required',`<p>${esc(setupError||'Your account profile is unavailable.')}</p><a class="btn" href="#/auth/signout">Sign out</a>`);return true}
 if(account.status==='removed'){frame(root,'Account unavailable','<p>Your account access has been removed. Contact support.</p><a href="#/auth/signout">Sign out</a>');return true}
 if(account.role!==role){frame(root,'Choose your portal',`<p>You are signed in as a ${esc(account.role)}.</p><a class="btn" href="#${home(account.role)}">Open my portal</a> <a href="#/auth/signout">Sign out</a>`);return true}
 if(driver&&account.status!=='approved'&&/^\/driver\/(projects|job)(\/|$)/.test(route)){frame(root,'Driver approval pending','<p>Your account must be approved before you can accept delivery jobs.</p><a class="btn" href="#/driver/profile">Complete your profile</a> <a href="#/auth/signout">Sign out</a>');return true}
 return false;
}
function authForm(root,{role='customer',signup=false,forgot=false,password=false}){
 const prefix=role==='driver'?'/driver':role==='admin'?'/admin':'';
 if(session&&account&&!password&&!forgot){frame(root,'You’re signed in',`<p>${esc(account.display_name||session.user.email)}</p><a class="btn" href="#${home(account.role)}">Open my portal</a> <a href="#/auth/signout">Use another account</a>`);return}
 const title=password?'Choose a new password':forgot?'Reset your password':signup?'Create your '+role+' account':role==='admin'?'Admin sign in':role==='driver'?'Driver sign in':'Welcome back';
 frame(root,title,`<form id="secure-auth-form" class="form-stack">${signup?'<div class="field"><label for="secure-name">Full name</label><input id="secure-name" name="name" autocomplete="name" maxlength="100" required></div>':''}${!password?'<div class="field"><label for="secure-email">Email address</label><input id="secure-email" name="email" type="email" autocomplete="email" required></div>':''}${!forgot?`<div class="field"><label for="secure-password">Password</label><input id="secure-password" name="password" type="password" minlength="8" autocomplete="${signup||password?'new-password':'current-password'}" required></div>`:''}${signup||password?'<div class="field"><label for="secure-confirm">Confirm password</label><input id="secure-confirm" name="confirm" type="password" minlength="8" autocomplete="new-password" required></div>':''}<button class="btn" type="submit">${password?'Save password':forgot?'Send reset email':signup?'Create account':'Sign in'}</button></form><p>${!signup&&!forgot&&!password?`<a href="#${role==='admin'?'/forgot':prefix+'/forgot'}">Forgot password?</a>`:''}</p><p>${role!=='admin'&&!password?(signup?`Already registered? <a href="#${prefix}/login">Sign in</a>`:`<a href="#${prefix}/signup">Create a ${role} account</a>`):''}</p>${role==='admin'?'<p>Admin accounts are assigned privately by the project owner.</p>':''}<p class="demo-note">Sign-in uses Supabase. Delivery, payment and file-upload screens are still local prototypes.</p>`);
 const form=root.querySelector('form');form.onsubmit=async event=>{event.preventDefault();const fd=new FormData(form),button=form.querySelector('button'),status=root.querySelector('[role=status]');button.disabled=true;status.textContent='Please wait…';try{
 const email=String(fd.get('email')||'').trim(),pw=String(fd.get('password')||'');if((signup||password)&&pw!==fd.get('confirm'))throw Error('Passwords must match.');
 if(forgot){const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/'});if(error)throw error;status.textContent='If an account exists for that email, you’ll receive a reset link.';}
 else if(password){if(!session)throw Error('Open the reset link from your email first.');const {error}=await supabase.auth.updateUser({password:pw});if(error)throw error;status.textContent='Password updated. You can open your portal.';form.reset();}
 else if(signup){const {data,error}=await supabase.auth.signUp({email,password:pw,options:{data:{display_name:String(fd.get('name')),requested_role:role==='driver'?'driver':'customer'},emailRedirectTo:location.origin+'/'}});if(error)throw error;form.reset();if(data.session){session=data.session;await loadAccount();location.hash=home(account?.role||role)}else status.textContent='Check your email to confirm your account, then return here to sign in.';}
 else {const {data,error}=await supabase.auth.signInWithPassword({email,password:pw});if(error)throw error;session=data.session;await loadAccount();location.hash=home(account?.role||role);window.dispatchEvent(new Event('365-auth-change'));}
 }catch(error){status.textContent=error.message||'Unable to complete this request.'}finally{button.disabled=false}};
}
