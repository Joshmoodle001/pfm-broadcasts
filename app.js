'use strict';

const SUPABASE_URL = 'https://bmzzbtwhxhijueudznuk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtenpidHdoeGhpanVldWR6bnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDQzMzIsImV4cCI6MjA5NzM4MDMzMn0.K8r4XYMrSnCXQ4j_FJw7J4cbzuQ9O1RToDsmCUyLQSM';

const DEV = 'pfm_did';
let devId = localStorage.getItem(DEV);
if(!devId){devId=crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);localStorage.setItem(DEV,devId);}

let sb, live, channel, posts=[], reads=new Set(), defInstall, showRead=false, imgCache=null;

const $=s=>document.querySelector(s);
const E={
  list:$('#postsList'),cnt:$('#postCount'),rec:$('#recentList'),past:$('#pastList'),
  tabA:$('#tabActive'),tabR:$('#tabRead'),
  loginCard:$('#adminLoginCard'),center:$('#adminCenter'),
  lf:$('#adminLoginForm'),le:$('#adminEmail'),lp:$('#adminPassword'),
  rf:$('#resetPasswordForm'),re:$('#resetEmail'),
  nf:$('#newPasswordForm'),np:$('#newPassword'),
  sr:$('#showResetBtn'),bl:$('#backToLoginBtn'),
  bf:$('#broadcastForm'),t:$('#title'),b:$('#body'),
  sbSeed:$('#seedBtn'),sbClear:$('#clearBtn'),lk:$('#lockAdminBtn'),
  ib:$('#installBtn'),iw:$('#installFromWelcomeBtn'),is:$('#installSteps'),
  bs:$('#backendStatus'),toast:$('#toast'),dot:$('#statusDot'),lbl:$('#statusLabel')
};

function toast(m){E.toast.textContent=m;E.toast.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>E.toast.classList.remove('show'),2500);}
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function dt(d){return new Intl.DateTimeFormat('en-ZA',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(d));}
function prio(p){return{urgent:'Urgent',important:'Important',general:'General'}[p]||'General';}
function norm(r){return{id:r.id,title:r.title,body:r.body||r.message,priority:r.priority||'general',created:r.created_at||r.created||new Date().toISOString(),expires:r.expires_at||null,is_active:r.isActive??r.is_active??true};}
function isRead(i){return reads.has(i.id);}
function sorted(a,expired){
  let arr=[...a].filter(i=>i.is_active!==false);
  if(!expired)arr=arr.filter(i=>!i.expires||new Date(i.expires)>new Date());
  return arr.sort((a,b)=>{const ar=isRead(a)?1:0,br=isRead(b)?1:0;if(ar!==br)return ar-br;const ap={urgent:3,important:2,general:1}[a.priority]||0,bp={urgent:3,important:2,general:1}[b.priority]||0;if(ap!==bp)return bp-ap;return new Date(b.created)-new Date(a.created);});
}
function on(v){if(E.dot)E.dot.style.background=v?'#15803d':'#d71920';if(E.lbl)E.lbl.textContent=v?'Connected':'Offline';}

function getImgCache(){if(!imgCache)imgCache=JSON.parse(localStorage.getItem('pfm_imgs')||'{}');return imgCache;}
function saveImgCache(url){const c=getImgCache();c[url]=1;localStorage.setItem('pfm_imgs',JSON.stringify(c));imgCache=c;}

async function refresh(){
  try{
    const[a,b]=await Promise.all([
      sb.from('broadcasts').select('id,title,message,priority,created_at,expires_at,is_active').eq('is_active',true).order('created_at',{ascending:false}).limit(200),
      sb.from('broadcast_reads').select('broadcast_id').eq('device_id',devId)
    ]);
    if(!a.error)posts=(a.data||[]).map(norm);
    if(!b.error)reads=new Set((b.data||[]).map(r=>r.broadcast_id));
    render();
  }catch(e){console.error(e)}
}

function sub(){if(!sb||channel)return;channel=sb.channel('p').on('postgres_changes',{event:'*',schema:'public',table:'broadcasts'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'broadcast_reads'},refresh).subscribe();}

function admin(){return live&&sessionStorage.getItem('pfm_ad')==='1';}

async function login(){
  const{data,error}=await sb.auth.signInWithPassword({email:E.le.value.trim(),password:E.lp.value});
  if(error)throw error;
  const{data:prof}=await sb.from('admin_profiles').select('is_admin').eq('user_id',data.user.id).eq('is_admin',true).maybeSingle();
  if(!prof)throw new Error('Not an approved admin');
  sessionStorage.setItem('pfm_ad','1');
}

async function create(){
  const h=document.querySelector('#expiry')?.value;
  const exp=h?new Date(Date.now()+h*3600000).toISOString():null;
  const{error}=await sb.from('broadcasts').insert({title:E.t.value.trim(),message:E.b.value.trim(),priority:document.querySelector('input[name="priority"]:checked')?.value||'general',expires_at:exp,is_active:true});
  if(error)throw error;
  await refresh();toast('Broadcast sent');switchScreen('posts');
}

async function del(id){await sb.from('broadcasts').update({is_active:false}).eq('id',id);await refresh();toast('Deleted');}

function renderBody(txt){
  let safe=esc(txt),btns='';
  const loaded=getImgCache();
  safe=safe.replace(/(https?:\/\/\S+)/gi,(url)=>{
    const isImg=/\.(jpg|jpeg|png|webp|gif)(\?\S*)?$/i.test(url)||/images\.unsplash\.com\/photo-/.test(url)||/picsum\.photos/.test(url);
    const yt=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    const isMP4=/\.(mp4|webm|mov)(\?\S*)?$/i.test(url);
    const isVimeo=url.match(/vimeo\.com\/(\d+)/);
    if(isImg){
      if(loaded[url]){btns+='<img src="'+url+'" loading="lazy" style="width:100%;max-height:300px;object-fit:cover;border-radius:12px;display:block;margin:8px 0" onerror="this.remove()" />';}
      else{btns+='<button class="img-load" data-img="'+url+'" style="width:100%;min-height:48px;border:1px dashed var(--line);border-radius:12px;background:var(--soft);color:var(--pfm-blue-2);font-size:13px;font-weight:700;cursor:pointer;margin:8px 0;display:flex;align-items:center;justify-content:center">Tap to view image</button>';}
      return'';
    }
    if(yt){
      const thumb='https://img.youtube.com/vi/'+yt[1]+'/hqdefault.jpg';
      btns+='<div class="vid-card" data-vid="'+yt[1]+'" style="position:relative;width:100%;border-radius:12px;overflow:hidden;cursor:pointer;margin:8px 0;background:#000"><img src="'+thumb+'" loading="lazy" style="width:100%;display:block;opacity:0.7" onerror="this.parentElement.remove()" /><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div style="width:52px;height:52px;border-radius:50%;background:rgba(255,0,0,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.4)"><span style="color:#fff;font-size:22px;margin-left:4px">&#9654;</span></div></div></div>';
      return'';
    }
    if(isMP4){
      btns+='<div class="vid-card" data-vid="'+url+'" style="position:relative;width:100%;border-radius:12px;overflow:hidden;cursor:pointer;margin:8px 0;background:#000;min-height:160px;display:flex;align-items:center;justify-content:center"><div style="width:52px;height:52px;border-radius:50%;background:rgba(255,0,0,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.4)"><span style="color:#fff;font-size:22px;margin-left:4px">&#9654;</span></div></div>';
      return'';
    }
    if(isVimeo){
      btns+='<div class="vid-card" data-vid="vimeo-'+isVimeo[1]+'" style="position:relative;width:100%;border-radius:12px;overflow:hidden;cursor:pointer;margin:8px 0;background:#000"><img src="https://vumbnail.com/'+isVimeo[1]+'.jpg" loading="lazy" style="width:100%;display:block;opacity:0.7" onerror="this.style.display=\'none\'" /><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div style="width:52px;52px;border-radius:50%;background:rgba(255,0,0,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.4)"><span style="color:#fff;font-size:22px;margin-left:4px">&#9654;</span></div></div></div>';
      return'';
    }
    // All other URLs become clickable links
    const short=url.length>50?url.slice(0,47)+'...':url;
    return '<a href="'+url+'" target="_blank" rel="noopener" style="color:var(--pfm-blue-2);text-decoration:underline;word-break:break-all">'+short+'</a>';
  });
  return btns+safe;
}

function renderPosts(){
  const active=sorted(posts).filter(i=>!isRead(i));
  const readItems=sorted(posts).filter(i=>isRead(i));
  const items=showRead?readItems:active;
  E.cnt.textContent=items.length+' post'+(items.length!==1?'s':'');
  if(!showRead){const u=active.length;if(u)E.cnt.textContent+=' - '+u+' unread';}
  E.list.innerHTML=items.length?'':'<div class="empty">'+(showRead?'No read posts yet.':'No posts yet.')+'</div>';
  items.forEach(i=>{const c=document.createElement('article');const rd=isRead(i);c.className='post-card '+(rd?'read ':'unread ')+esc(i.priority);c.innerHTML='<div class="post-top"><h3>'+esc(i.title)+'</h3><span class="tag '+(rd?'read':esc(i.priority))+'">'+(rd?'Read':prio(i.priority))+'</span></div><div style="margin:0;color:#344054;line-height:1.52;white-space:pre-wrap">'+renderBody(i.body)+'</div><div class="post-meta"><span>'+dt(i.created)+'</span><button class="'+(rd?'btn-secondary':'')+'" type="button" data-read="'+esc(i.id)+'">'+(rd?'Read again':'I have read this')+'</button></div>';E.list.appendChild(c);});
}

function renderRecent(){
  if(!E.rec)return;const items=sorted(posts).slice(0,10);
  E.rec.innerHTML=items.length?'':'<div class="empty">No active broadcasts.</div>';
  items.forEach(i=>{const d=document.createElement('div');d.className='recent-item';d.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><div><strong>'+esc(i.title)+'</strong><br><span>'+prio(i.priority)+' - '+dt(i.created)+(i.expires?' - Expires: '+dt(i.expires):'')+'</span></div><button class="btn-link" data-delete="'+esc(i.id)+'" style="color:#d71920;font-size:12px">Delete</button></div>';E.rec.appendChild(d);});
}

function renderPast(){
  if(!E.past)return;const past=posts.filter(i=>i.is_active!==false&&i.expires&&new Date(i.expires)<=new Date());
  E.past.innerHTML=past.length?'':'<div class="empty">No expired posts.</div>';
  past.forEach(i=>{const d=document.createElement('div');d.className='recent-item';d.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><div><strong>'+esc(i.title)+'</strong><br><span>Expired: '+dt(i.expires)+'</span></div><button class="btn-link" data-delete="'+esc(i.id)+'" style="color:#d71920;font-size:12px">Delete</button></div>';E.past.appendChild(d);});
}

function renderAdmin(){
  if(E.loginCard)E.loginCard.classList.toggle('hidden',admin());
  if(E.center)E.center.classList.toggle('hidden',!admin());
  if(E.bs)E.bs.innerHTML=live?'<strong>Supabase connected</strong>':'<strong>Not connected</strong>';
}

function render(){renderPosts();renderRecent();renderPast();renderAdmin();}

function show(s){E.lf.classList.add('hidden');E.rf.classList.add('hidden');E.nf.classList.add('hidden');if(s)(s==='login'?E.lf:s==='reset'?E.rf:E.nf).classList.remove('hidden');}

function switchScreen(s){
  document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id==='screen-'+s));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.screen===s));
  if(s==='admin')renderAdmin();
  history.replaceState(null,'','#'+s);scrollTo(0,0);
}

async function init(){
  let tries=0;
  while(!window.supabase&&tries<50){await new Promise(r=>setTimeout(r,100));tries++;}
  if(!window.supabase){on(false);return}
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  try{const{error}=await sb.from('broadcasts').select('id').limit(1);if(error)throw error;}
  catch(e){console.error('Probe failed:',e.message);on(false);return}
  live=true;on(true);
  if(E.bs)E.bs.innerHTML='<strong>Supabase connected</strong><span>Realtime active.</span>';
  sb.auth.onAuthStateChange((e,session)=>{
    if(e==='PASSWORD_RECOVERY'){show('new');switchScreen('admin')}
    if(session?.user){sb.from('admin_profiles').select('is_admin').eq('user_id',session.user.id).eq('is_admin',true).maybeSingle().then(r=>{sessionStorage.setItem('pfm_ad',r.data?'1':'')}).catch(()=>{sessionStorage.removeItem('pfm_ad')});renderAdmin();}
    else{sessionStorage.removeItem('pfm_ad');renderAdmin();}
  });
  const{data:ses}=await sb.auth.getSession();
  if(ses?.session?.user){sb.from('admin_profiles').select('is_admin').eq('user_id',ses.session.user.id).eq('is_admin',true).maybeSingle().then(r=>{sessionStorage.setItem('pfm_ad',r.data?'1':'')});}
  await refresh();sub();
  const standalone=window.matchMedia('(display-mode:standalone)').matches||window.navigator.standalone===true;
  if(standalone&&!location.hash){switchScreen('posts');return}
  const s=(location.hash||'#welcome').replace('#','');if(document.querySelector('#screen-'+s))switchScreen(s);
}
init();

document.addEventListener('click',async e=>{
  const s=e.target.closest('[data-screen]');if(s){switchScreen(s.dataset.screen);return}
  const r=e.target.closest('[data-read]');if(r){if(!live)return;await sb.from('broadcast_reads').upsert({broadcast_id:r.dataset.read,device_id:devId},{onConflict:'broadcast_id,device_id'});reads.add(r.dataset.read);render();toast('Marked as read');return}
  const d=e.target.closest('[data-delete]');if(d){if(confirm('Delete this broadcast?'))await del(d.dataset.delete);return}
    const img=e.target.closest('.img-load');if(img){saveImgCache(img.dataset.img);const el=document.createElement('img');el.src=img.dataset.img;el.loading='lazy';el.style.cssText='width:100%;max-height:300px;object-fit:cover;border-radius:12px;display:block;margin-top:6px';el.onerror=()=>el.remove();try{img.replaceWith(el)}catch{render()};return}
    const vc=e.target.closest('.vid-card');if(vc){const id=vc.dataset.vid;let el;
    if(id.startsWith('vimeo-')){
      el=document.createElement('iframe');el.src='https://player.vimeo.com/video/'+id.replace('vimeo-','')+'?autoplay=1';el.allow='autoplay;fullscreen';el.style.cssText='width:100%;aspect-ratio:16/9;border:0;border-radius:12px';
    }else if(id.includes('.')){
      el=document.createElement('video');el.src=id;el.controls=true;el.preload='none';el.playsInline=true;el.style.cssText='width:100%;max-height:360px;border-radius:12px;display:block;background:#000';
    }else{
      el=document.createElement('iframe');el.src='https://www.youtube.com/embed/'+id+'?autoplay=1&rel=0';el.allow='autoplay;fullscreen;picture-in-picture';el.style.cssText='width:100%;aspect-ratio:16/9;border:0;border-radius:12px';
    }
    el.onerror=()=>el.remove();try{vc.replaceWith(el)}catch{render()};return}
});

E.lf?.addEventListener('submit',async e=>{e.preventDefault();try{await login();toast('Unlocked');renderAdmin()}catch(err){toast(err.message||'Login failed')}});
E.rf?.addEventListener('submit',async e=>{e.preventDefault();await sb.auth.resetPasswordForEmail(E.re.value.trim());toast('Email sent');show('login')});
E.nf?.addEventListener('submit',async e=>{e.preventDefault();await sb.auth.updateUser({password:E.np.value});toast('Updated');show('login')});
E.bf?.addEventListener('submit',async e=>{e.preventDefault();try{await create();E.bf.reset()}catch(err){toast(err.message)}});
E.sr?.addEventListener('click',()=>show('reset'));
E.bl?.addEventListener('click',()=>show('login'));
E.lk?.addEventListener('click',()=>{sb.auth.signOut();sessionStorage.removeItem('pfm_ad');renderAdmin();toast('Locked')});
E.tabA?.addEventListener('click',()=>{showRead=false;E.tabA.classList.add('active');E.tabR.classList.remove('active');renderPosts()});
E.tabR?.addEventListener('click',()=>{showRead=true;E.tabR.classList.add('active');E.tabA.classList.remove('active');renderPosts()});

window.addEventListener('hashchange',()=>{const s=location.hash.replace('#','');if(document.querySelector('#screen-'+s))switchScreen(s)});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();defInstall=e});
window.addEventListener('appinstalled',()=>{defInstall=null});
window.addEventListener('beforeunload',()=>{if(channel){sb.removeChannel(channel);channel=null}});
E.ib?.addEventListener('click',async()=>{if(defInstall){defInstall.prompt();await defInstall.userChoice;defInstall=null}});
E.iw?.addEventListener('click',async()=>{if(defInstall){defInstall.prompt();await defInstall.userChoice;defInstall=null}});

if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');
