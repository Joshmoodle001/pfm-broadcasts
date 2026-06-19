'use strict';

/* PFM Broadcasts — Supabase */

const SUPABASE_URL = 'https://bmzzbtwhxhijueudznuk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtenpidHdoeGhpanVldWR6bnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDQzMzIsImV4cCI6MjA5NzM4MDMzMn0.K8r4XYMrSnCXQ4j_FJw7J4cbzuQ9O1RToDsmCUyLQSM';

let live = false;
let sb = null;
let channel = null;
let broadcasts = [];
let reads = new Set();

const DEV = 'pfm_device_id';
const ITEMS = 'pfm_items';
const ADM = 'pfm_admin';

const PRIO = { urgent:3, important:2, general:1 };
const DEMO = { email:'admin@pfm.co.za', pw:'PFM2026!' };
const BC = 'BroadcastChannel' in window ? new BroadcastChannel('pfm_chan') : null;

let deviceId = localStorage.getItem(DEV);
if (!deviceId) { deviceId = crypto.randomUUID ? crypto.randomUUID() : Date.now()+'-'+Math.random().toString(36).slice(2); localStorage.setItem(DEV, deviceId); }
let deferredInstall = null;

const $ = id => document.querySelector(id);

const el = {
  posts: $('#postsList'), count: $('#postCount'), recent: $('#recentList'),
  loginCard: $('#adminLoginCard'), center: $('#adminCenter'),
  loginForm: $('#adminLoginForm'), loginEmail: $('#adminEmail'), loginPw: $('#adminPassword'),
  resetForm: $('#resetPasswordForm'), resetEmail: $('#resetEmail'),
  newPwForm: $('#newPasswordForm'), newPw: $('#newPassword'),
  showReset: $('#showResetBtn'), backLogin: $('#backToLoginBtn'),
  showSignup: $('#showSignupBtn'), signupForm: $('#signupForm'),
  signupEmail: $('#signupEmail'), signupPw: $('#signupPassword'),
  backFromSignup: $('#backToLoginFromSignup'),
  addAdminForm: $('#addAdminForm'), addAdminEmail: $('#newAdminEmail'), addAdminPw: $('#newAdminPassword'),
  lockBtn: $('#lockAdminBtn'), broadcastForm: $('#broadcastForm'),
  title: $('#title'), body: $('#body'),
  seedBtn: $('#seedBtn'), clearBtn: $('#clearBtn'),
  installBtn: $('#installBtn'), installWelcome: $('#installFromWelcomeBtn'),
  installSteps: $('#installSteps'), backend: $('#backendStatus'),
  toast: $('#toast'), dot: $('#statusDot'), label: $('#statusLabel'),
};

function toast(m) { el.toast.textContent=m; el.toast.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.toast.classList.remove('show'),2400); }

function esc(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }

function fmt(d) { return new Intl.DateTimeFormat('en-ZA',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(d)); }

function pl(p) { return {urgent:'Urgent',important:'Important',general:'General'}[p]||'General'; }

function norm(r) {
  return { id:r.id, title:r.title, body:r.body||r.message, priority:r.priority||'general',
    created_at:r.created_at||r.createdAt||r.created||new Date().toISOString(),
    created_by:r.created_by||r.createdBy||null, readBy:r.readBy||[], image:r.image||null,
    is_active:r.isActive??r.is_active??true };
}

function read(item) { return live ? reads.has(item.id) : Array.isArray(item.readBy)&&item.readBy.includes(deviceId); }

function sort(items) {
  return [...items].filter(i=>i.is_active!==false).sort((a,b)=>{
    const ar=read(a)?1:0,br=read(b)?1:0; if(ar!==br)return ar-br;
    const ap=PRIO[a.priority]||0,bp=PRIO[b.priority]||0; if(ap!==bp)return bp-ap;
    return new Date(b.created_at)-new Date(a.created_at);
  });
}

function status(on) { if(el.dot)el.dot.style.background=on?'#15803d':'#d71920'; if(el.label)el.label.textContent=on?'Connected':'Offline'; }

// demo
function localGet() { try{const s=JSON.parse(localStorage.getItem(ITEMS));return Array.isArray(s)?s.map(norm):[]}catch{return[]} }
function localSet(items) { localStorage.setItem(ITEMS,JSON.stringify(items)); broadcasts=items.map(norm); if(BC)BC.postMessage({type:'update'}); render(); }

// supabase
function hasSB() { return !!(SUPABASE_URL&&SUPABASE_KEY&&window.supabase&&typeof window.supabase.createClient==='function'); }

async function initSB() {
  if(!hasSB())return false;
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  sb.auth.onAuthStateChange(async(e,session)=>{
    if(e==='PASSWORD_RECOVERY'){showNP();switchScreen('admin');return}
    if(session?.user){
      try{const{data}=await sb.from('admin_profiles').select('is_admin').eq('user_id',session.user.id).eq('is_admin',true).maybeSingle();sessionStorage.setItem(ADM,data?'1':'')}catch{sessionStorage.removeItem(ADM)}
    }else sessionStorage.removeItem(ADM);
    renderAdmin();
  });
  try{
    const{data}=await sb.auth.getSession();
    if(data?.session?.user){
      try{const p=await sb.from('admin_profiles').select('is_admin').eq('user_id',data.session.user.id).eq('is_admin',true).maybeSingle();sessionStorage.setItem(ADM,p.data?'1':'')}catch{}
    }
    try{const c=await sb.from('admin_profiles').select('user_id',{count:'exact',head:true}).eq('is_admin',true);if(el.showSignup)el.showSignup.classList.toggle('hidden',(c.count||0)>0)}catch{}
  }catch(e){console.warn(e)}
  return true;
}

async function refresh() {
  if(!sb)return;
  const[b,r]=await Promise.all([
    sb.from('broadcasts').select('*').eq('is_active',true).order('created_at',{ascending:false}).limit(200),
    sb.from('broadcast_reads').select('broadcast_id').eq('device_id',deviceId)
  ]);
  if(!b.error)broadcasts=(b.data||[]).map(norm);
  if(!r.error)reads=new Set((r.data||[]).map(x=>x.broadcast_id));
  render();
}

function sub() {
  if(!sb||channel)return;
  channel=sb.channel('pfm').on('postgres_changes',{event:'*',schema:'public',table:'broadcasts'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'broadcast_reads'},refresh).subscribe();
}

function admin() { return live&&sessionStorage.getItem(ADM)==='1'; }

async function deleteBroadcast(id) {
  if(!live||!admin()){toast('Admin required');return}
  const{error}=await sb.from('broadcasts').update({is_active:false}).eq('id',id);
  if(error){toast(error.message);return}
  await refresh();toast('Deleted');
}

async function createBroadcast({title,body,priority}) {
  if(live){const{error}=await sb.from('broadcasts').insert({title,message:body,priority:priority||'general',is_active:true});if(error)throw error;await refresh();return}
  const item=norm({id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}`,title,body,priority,created_at:new Date().toISOString(),readBy:[],is_active:true});
  localSet([item,...localGet()]);
}

async function mark(id) {
  if(live){await sb.from('broadcast_reads').upsert({broadcast_id:id,device_id:deviceId},{onConflict:'broadcast_id,device_id'});reads.add(id);render();toast('Marked as read');return}
  const u=localGet().map(i=>{if(i.id!==id)return i;const s=new Set(i.readBy||[]);s.add(deviceId);return{...i,readBy:Array.from(s)}});
  localSet(u);toast('Marked as read');
}

async function login(email,pw) {
  const{data,error}=await sb.auth.signInWithPassword({email,password:pw});
  if(error)throw error;
  const p=await sb.from('admin_profiles').select('is_admin').eq('user_id',data.user.id).eq('is_admin',true).maybeSingle();
  if(!p.data){await sb.auth.signOut();throw new Error('Not an approved admin')}
  sessionStorage.setItem(ADM,'1');
}

function logout() { sb?.auth.signOut(); sessionStorage.removeItem(ADM); showLogin(); renderAdmin(); toast('Locked'); }

async function forgot(email) { await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+'#admin'}); }
async function resetPw(pw) { await sb.auth.updateUser({password:pw}); }

// standalone
const standalone = window.matchMedia('(display-mode:standalone)').matches||window.navigator.standalone===true;
if(standalone)document.body.classList.add('standalone');

// render
function card(item) {
  const rd=read(item);
  const c=document.createElement('article');
  c.className=`post-card ${rd?'read':'unread'} ${esc(item.priority)}`;
  c.innerHTML=`<div class="post-top"><h3>${esc(item.title)}</h3><span class="tag ${rd?'read':esc(item.priority)}">${rd?'Read':pl(item.priority)}</span></div><p>${esc(item.body)}</p><div class="post-meta"><span>${fmt(item.created_at)}</span><button class="${rd?'btn-secondary':''}" type="button" data-read="${esc(item.id)}">${rd?'Read again':'I have read this'}</button></div>`;
  return c;
}

function recentItem(item) {
  const d=document.createElement('div');d.className='recent-item';
  d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><div><strong>${esc(item.title)}</strong><br><span>${pl(item.priority)} - ${fmt(item.created_at)}</span></div><button class="btn-link" type="button" data-delete="${esc(item.id)}" style="color:#d71920;font-size:12px;white-space:nowrap">Delete</button></div>`;return d;
}

function renderPosts() {
  const items=sort(broadcasts);
  const unread=items.filter(i=>!read(i)).length;
  el.count.textContent=items.length===1?'1 post':`${items.length} posts`;
  if(unread)el.count.textContent+=` - ${unread} unread`;
  el.posts.innerHTML='';
  if(!items.length){el.posts.innerHTML='<div class="empty"><strong>No posts yet.</strong><p>When admin sends a broadcast, it will appear here.</p></div>';return}
  items.forEach(i=>el.posts.appendChild(card(i)));
}

function renderRecent() {
  if(!el.recent)return;
  const items=[...broadcasts].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  el.recent.innerHTML=items.length?'':'<div class="empty"><strong>No broadcasts yet.</strong></div>';
  items.forEach(i=>el.recent.appendChild(recentItem(i)));
}

function renderAdmin() {
  const u=admin();
  if(el.loginCard)el.loginCard.classList.toggle('hidden',u);
  if(el.center)el.center.classList.toggle('hidden',!u);
  if(el.backend)el.backend.innerHTML=live?'<strong>Supabase backend</strong><span>Live with realtime sync.</span>':'<strong>Demo mode</strong><span>Set SUPABASE_URL and SUPABASE_KEY in app.js.</span>';
}

function showLogin() {
  if(el.loginForm)el.loginForm.classList.remove('hidden');
  if(el.resetForm)el.resetForm.classList.add('hidden');
  if(el.newPwForm)el.newPwForm.classList.add('hidden');
  if(el.signupForm)el.signupForm.classList.add('hidden');
  setTimeout(()=>el.loginEmail?.focus(),80);
}

function showReset() {
  if(el.loginForm)el.loginForm.classList.add('hidden');
  if(el.resetForm)el.resetForm.classList.remove('hidden');
  if(el.newPwForm)el.newPwForm.classList.add('hidden');
  if(el.signupForm)el.signupForm.classList.add('hidden');
  if(el.resetEmail)el.resetEmail.value=el.loginEmail?.value||'';
  setTimeout(()=>el.resetEmail?.focus(),80);
}

function showNP() {
  if(el.loginForm)el.loginForm.classList.add('hidden');
  if(el.resetForm)el.resetForm.classList.add('hidden');
  if(el.newPwForm)el.newPwForm.classList.remove('hidden');
  if(el.signupForm)el.signupForm.classList.add('hidden');
  setTimeout(()=>el.newPw?.focus(),80);
}

function showSignup() {
  if(el.loginForm)el.loginForm.classList.add('hidden');
  if(el.resetForm)el.resetForm.classList.add('hidden');
  if(el.newPwForm)el.newPwForm.classList.add('hidden');
  if(el.signupForm)el.signupForm.classList.remove('hidden');
  setTimeout(()=>el.signupEmail?.focus(),80);
}

function renderInstall() {
  if(!el.installSteps)return;
  if(standalone){el.installSteps.innerHTML='<div><strong>Installed.</strong> PFM Broadcasts is on your home screen.</div>';el.installBtn.disabled=true;el.installBtn.textContent='Installed';return}
  if(deferredInstall){el.installSteps.innerHTML='<div><strong>Ready.</strong> Tap to install.</div>';el.installBtn.disabled=false;el.installBtn.textContent='Install PFM Broadcasts';return}
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const android=/android/i.test(navigator.userAgent);
  if(android){el.installSteps.innerHTML='<div><strong>Chrome menu</strong> → Install app.</div>';el.installBtn.disabled=true;el.installBtn.textContent='Chrome menu';return}
  if(ios){el.installSteps.innerHTML='<div><strong>Safari</strong> → Share → Add to Home Screen.</div>';el.installBtn.disabled=true;el.installBtn.textContent='Safari Share';return}
  el.installSteps.innerHTML='<div>Use the install icon in your browser address bar.</div>';el.installBtn.disabled=true;el.installBtn.textContent='N/A';
}

function render() { renderPosts(); renderRecent(); renderAdmin(); renderInstall(); }

function switchScreen(s) {
  document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id==='screen-'+s));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.screen===s));
  if(s==='admin')renderAdmin();
  if(location.hash!=='#'+s)history.replaceState(null,'','#'+s);
  scrollTo({top:0,behavior:'smooth'});
}

// demo seed
function seed() {
  const n=Date.now();
  localSet([{id:crypto.randomUUID?crypto.randomUUID():n+'-1',title:'Price Update',body:'New pricing effective today.',priority:'urgent',created_at:new Date(n).toISOString(),readBy:[],is_active:true},{id:crypto.randomUUID?crypto.randomUUID():n+'-2',title:'Holiday Schedule',body:'Office closed public holiday.',priority:'important',created_at:new Date(n-288e5).toISOString(),readBy:[],is_active:true},{id:crypto.randomUUID?crypto.randomUUID():n+'-3',title:'New Product',body:'Launching next week.',priority:'general',created_at:new Date(n-108e6).toISOString(),readBy:[],is_active:true}].map(norm));
  toast('Demo posts added');
}
function clr() { if(live){toast('Disabled on live');return} localSet([]); toast('Cleared'); }

// events
function bind() {
  document.addEventListener('click',async e=>{
    const s=e.target.closest('[data-screen]'); if(s){switchScreen(s.dataset.screen);return}
    const r=e.target.closest('[data-read]'); if(r){await mark(r.dataset.read);return}
    const del=e.target.closest('[data-delete]'); if(del){if(confirm('Delete this broadcast?')){await deleteBroadcast(del.dataset.delete);}return}
  });

  el.loginForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    const email=el.loginEmail.value.trim(),pw=el.loginPw.value;
    if(live){try{await login(email,pw);toast('Admin unlocked');renderAdmin()}catch(err){toast(err.message||'Login failed')}return}
    if(email.toLowerCase()===DEMO.email&&pw===DEMO.pw){sessionStorage.setItem(ADM,'1');renderAdmin();toast('Unlocked (demo)');return}
    toast('Incorrect login');
  });

  el.resetForm?.addEventListener('submit',async e=>{
    e.preventDefault(); if(!live){toast('Supabase required');showLogin();return}
    try{await forgot(el.resetEmail.value.trim());toast('Reset email sent');showLogin()}catch(err){toast(err.message)}
  });

  el.newPwForm?.addEventListener('submit',async e=>{
    e.preventDefault(); if(!live){toast('Supabase required');return}
    try{await resetPw(el.newPw.value);toast('Password updated');showLogin()}catch(err){toast(err.message)}
  });

  el.showReset?.addEventListener('click',showReset);
  el.backLogin?.addEventListener('click',showLogin);
  el.showSignup?.addEventListener('click',showSignup);
  el.backFromSignup?.addEventListener('click',showLogin);

  el.signupForm?.addEventListener('submit',async e=>{
    e.preventDefault(); if(!live){toast('Supabase required');showLogin();return}
    const email=el.signupEmail.value.trim(),pw=el.signupPw.value;
    if(pw.length<8){toast('Password 8+ characters');return}
    const{data,error}=await sb.auth.signUp({email,password:pw});
    if(error){toast(error.message);return}
    toast('Account created! Log in now.');showLogin();
  });

  el.addAdminForm?.addEventListener('submit',async e=>{
    e.preventDefault(); if(!live){toast('Supabase required');return}
    const email=el.addAdminEmail.value.trim(),pw=el.addAdminPw.value;
    if(pw.length<8){toast('Password 8+ characters');return}
    const{data,error}=await sb.auth.signUp({email,password:pw});
    if(error){toast(error.message);return}
    await sb.from('admin_profiles').insert({user_id:data.user.id,full_name:email,is_admin:true});
    toast('Admin added: '+email);el.addAdminForm.reset();
  });

  el.broadcastForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    const fd=new FormData(el.broadcastForm);
    const title=String(fd.get('title')||'').trim(),body=String(fd.get('body')||'').trim(),priority=String(fd.get('priority')||'general');
    if(!title||!body){toast('Title and message required');return}
    try{await createBroadcast({title,body,priority});el.broadcastForm.reset();el.broadcastForm.querySelector('input[name="priority"][value="important"]').checked=true;toast('Broadcast sent');switchScreen('posts')}catch(err){console.error(err);toast(err.message||'Failed')}
  });

  el.lockBtn?.addEventListener('click',logout);
  el.seedBtn?.addEventListener('click',seed);
  el.clearBtn?.addEventListener('click',clr);

  window.addEventListener('hashchange',()=>{const s=location.hash.replace('#','').split('?')[0]||'welcome';if(document.querySelector('#screen-'+s))switchScreen(s)});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;renderInstall()});
  window.addEventListener('appinstalled',()=>{deferredInstall=null;toast('Installed');renderInstall()});

  async function pi(){if(!deferredInstall){renderInstall();switchScreen('install');return}deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;renderInstall()}
  el.installBtn?.addEventListener('click',pi);
  el.installWelcome?.addEventListener('click',pi);

  if(BC)BC.addEventListener('message',e=>{if(e.data?.type==='update'&&!live){broadcasts=localGet();render()}});

  const hp=new URLSearchParams(location.hash.split('?')[1]||'');
  if(hp.get('token')){showNP();switchScreen('admin');}
}

async function sw() { if('serviceWorker' in navigator) try{await navigator.serviceWorker.register('./sw.js')}catch{} }

async function boot() {
  bind();
  live=await initSB();
  if(live){await refresh();sub();status(true)}
  else{status(false);broadcasts=localGet()}
  render();
  const s=(location.hash.replace('#','').split('?')[0])||'welcome';
  if(document.querySelector('#screen-'+s))switchScreen(s);
  await sw();
}
boot();
