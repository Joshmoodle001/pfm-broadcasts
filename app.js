'use strict';

const SUPABASE_URL = 'https://bmzzbtwhxhijueudznuk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtenpidHdoeGhpanVldWR6bnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDQzMzIsImV4cCI6MjA5NzM4MDMzMn0.K8r4XYMrSnCXQ4j_FJw7J4cbzuQ9O1RToDsmCUyLQSM';

const DEV = 'pfm_did';
let devId = localStorage.getItem(DEV);
if(!devId){devId=crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2);localStorage.setItem(DEV,devId);}

let sb, live, channel, posts=[], reads=new Set(), defInstall, showRead=false, imgCache=null;
const MEDIA_CACHE='pfm-media-v1';
const MEDIA_META='pfm_media_meta_v1';
let mediaMetaCache=null;
const mediaMetaPending=new Set();

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
  lk:$('#lockAdminBtn'),
  is:$('#installSteps'),
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
function getMediaMeta(){if(!mediaMetaCache)mediaMetaCache=JSON.parse(localStorage.getItem(MEDIA_META)||'{}');return mediaMetaCache;}
function saveMediaMeta(url,meta){const all=getMediaMeta();all[url]={...(all[url]||{}),...meta};localStorage.setItem(MEDIA_META,JSON.stringify(all));mediaMetaCache=all;}
function mediaSaved(url){return !!getImgCache()[url];}
function mediaCopy(type,saved){return saved?`Tap to open saved ${type}`:`Tap to view ${type}`;}
function formatBytes(bytes){
  const num=Number(bytes);
  if(!Number.isFinite(num)||num<=0)return '';
  const units=['B','KB','MB','GB'];
  let value=num,unit=0;
  while(value>=1024&&unit<units.length-1){value/=1024;unit++;}
  return `${value>=10||unit===0?value.toFixed(0):value.toFixed(1)} ${units[unit]}`;
}
function mediaDetail(url,fallback){
  const size=getMediaMeta()[url]?.size;
  const sizeText=formatBytes(size);
  return sizeText?`${fallback} • Uses about ${sizeText}`:fallback;
}
async function ensureMediaMeta(url){
  if(getMediaMeta()[url]?.size||mediaMetaPending.has(url))return;
  mediaMetaPending.add(url);
  try{
    const response=await fetch(url,{method:'HEAD',mode:'cors',credentials:'omit'});
    const length=response.headers.get('content-length');
    const size=length?parseInt(length,10):0;
    if(size>0){
      saveMediaMeta(url,{size});
      renderPosts();
    }
  }catch{}
  mediaMetaPending.delete(url);
}
async function clearSavedMedia(){
  if('caches' in window)await caches.delete(MEDIA_CACHE);
  localStorage.removeItem('pfm_imgs');
  imgCache=null;
  renderPosts();
}
async function mediaSrc(url){
  if(!('caches' in window))return url;
  const cache=await caches.open(MEDIA_CACHE);
  let response=await cache.match(url);
  if(!response){
    response=await fetch(url,{mode:'cors',credentials:'omit'});
    if(!response.ok)throw new Error(`Could not load ${url}`);
    await cache.put(url,response.clone());
  }
  saveImgCache(url);
  return URL.createObjectURL(await response.blob());
}
function hardenMedia(el){
  el.setAttribute('draggable','false');
  el.addEventListener('contextmenu',event=>event.preventDefault());
  if(el.tagName==='VIDEO'){
    el.controls=true;
    el.preload='metadata';
    el.playsInline=true;
    el.disablePictureInPicture=true;
    el.setAttribute('controlsList','nodownload noplaybackrate');
    el.setAttribute('disablePictureInPicture','');
  }
  return el;
}
function enableImageZoom(wrap,img){
  wrap.classList.add('zoomable-media');
  const hint=document.createElement('div');
  hint.className='media-zoom-hint';
  hint.textContent='Pinch to zoom';
  wrap.appendChild(hint);
  setTimeout(()=>hint.classList.add('fade'),2200);

  const state={scale:1,x:0,y:0,startX:0,startY:0,startScale:1,startDistance:0,lastTap:0,lastTouch:0};
  const pointers=new Map();
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const bounds=()=>{
    const maxX=Math.max(0,(wrap.clientWidth*(state.scale-1))/2);
    const maxY=Math.max(0,(img.clientHeight*(state.scale-1))/2);
    state.x=clamp(state.x,-maxX,maxX);
    state.y=clamp(state.y,-maxY,maxY);
  };
  const paint=()=>{
    bounds();
    img.style.transform=`translate3d(${state.x}px,${state.y}px,0) scale(${state.scale})`;
    img.style.cursor=state.scale>1?'grab':'zoom-in';
  };
  const reset=()=>{
    state.scale=1;
    state.x=0;
    state.y=0;
    paint();
  };
  const dist=pts=>Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
  const mid=pts=>({x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2});

  wrap.addEventListener('dblclick',event=>{
    event.preventDefault();
    if(state.scale>1.05){reset();return}
    state.scale=2;
    state.x=0;
    state.y=0;
    paint();
  });
  wrap.addEventListener('wheel',event=>{
    if(!event.ctrlKey&&!event.metaKey)return;
    event.preventDefault();
    const next=clamp(state.scale-(event.deltaY*0.01),1,4);
    if(next===state.scale)return;
    state.scale=next;
    if(state.scale===1){state.x=0;state.y=0}
    paint();
  },{passive:false});
  wrap.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    wrap.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(event.pointerType!=='mouse')state.lastTouch=Date.now();
    if(pointers.size===1){
      state.startX=event.clientX-state.x;
      state.startY=event.clientY-state.y;
    }else if(pointers.size===2){
      const pts=[...pointers.values()];
      state.startDistance=dist(pts);
      state.startScale=state.scale;
      const center=mid(pts);
      state.startX=center.x-state.x;
      state.startY=center.y-state.y;
    }
  });
  wrap.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size>=2){
      const pts=[...pointers.values()];
      const nextDistance=dist(pts);
      state.scale=clamp(state.startScale*(nextDistance/(state.startDistance||nextDistance||1)),1,4);
      const center=mid(pts);
      state.x=center.x-state.startX;
      state.y=center.y-state.startY;
      paint();
      return;
    }
    if(state.scale<=1||event.pointerType==='mouse'&&!(event.buttons&1))return;
    event.preventDefault();
    state.x=event.clientX-state.startX;
    state.y=event.clientY-state.startY;
    paint();
  });
  const release=event=>{
    pointers.delete(event.pointerId);
    wrap.releasePointerCapture?.(event.pointerId);
    if(!pointers.size){
      const now=Date.now();
      if(state.scale===1&&event.pointerType!=='mouse'&&now-state.lastTap<280&&now-state.lastTouch<400){
        state.scale=2;
        paint();
      }
      state.lastTap=now;
      img.style.cursor=state.scale>1?'grab':'zoom-in';
      return;
    }
    const [pt]=[...pointers.values()];
    if(pt){
      state.startX=pt.x-state.x;
      state.startY=pt.y-state.y;
    }
  };
  wrap.addEventListener('pointerup',release);
  wrap.addEventListener('pointercancel',release);
  wrap.addEventListener('pointerleave',event=>{
    if(event.pointerType==='mouse')img.style.cursor=state.scale>1?'grab':'zoom-in';
  });
  img.addEventListener('load',paint,{once:true});
  window.addEventListener('resize',paint);
  paint();
}
function standalone(){return window.matchMedia('(display-mode:standalone)').matches||window.navigator.standalone===true;}
function ios(){return /iphone|ipad|ipod/i.test(navigator.userAgent);}
function android(){return /android/i.test(navigator.userAgent);}
async function openInstallFlow(){
  if(standalone()){switchScreen('posts');return;}
  if(defInstall){
    defInstall.prompt();
    await defInstall.userChoice;
    defInstall=null;
    renderInstallSteps();
    return;
  }
  if(ios()){
    toast('Open in Safari → tap Share → Add to Home Screen');
    switchScreen('install');
    renderInstallSteps();
    return;
  }
  if(android()){
    toast('Open Chrome menu → Install app or Add to Home screen');
    switchScreen('install');
    renderInstallSteps();
    return;
  }
  toast('Use Chrome on Android or Safari on iPhone to install this app.');
  switchScreen('install');
  renderInstallSteps();
}
function renderInstallSteps(){
  if(!E.is)return;
  if(standalone()){
    E.is.innerHTML='<div><strong>Installed already.</strong> This app is already running from your home screen.</div>';
    return;
  }
  if(defInstall){
    E.is.innerHTML='<div><strong>Ready to install.</strong> Return to the Welcome screen and tap <strong>Install App</strong>, then confirm the browser prompt.</div>';
    return;
  }
  if(ios()){
    E.is.innerHTML='<div><strong>1.</strong> Open this site in Safari.</div><div><strong>2.</strong> Tap the Share button.</div><div><strong>3.</strong> Choose <strong>Add to Home Screen</strong>.</div>';
    return;
  }
  if(android()){
    E.is.innerHTML='<div><strong>1.</strong> Open this site in Chrome.</div><div><strong>2.</strong> Tap the browser menu.</div><div><strong>3.</strong> Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</div>';
    return;
  }
  E.is.innerHTML='<div><strong>Install support depends on your browser.</strong> Use Chrome on Android or Safari on iPhone, then start from the Welcome screen <strong>Install App</strong> button.</div>';
}

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

function sub(){if(!sb||channel)return;channel=sb.channel('p').on('postgres_changes',{event:'INSERT',schema:'public',table:'broadcasts'},p=>{
  const n=p.new;if(n&&n.priority==='urgent'&&Notification.permission==='granted'){new Notification(n.title,{body:n.message,icon:'/icons/icon-192.png',tag:n.id})}
  refresh();
}).on('postgres_changes',{event:'*',schema:'public',table:'broadcast_reads'},refresh).subscribe();}

function admin(){
  if(!live||sessionStorage.getItem('pfm_ad')!=='1')return false;
  const ts=parseInt(sessionStorage.getItem('pfm_ad_ts')||'0');
  if(Date.now()-ts>43200000){sessionStorage.removeItem('pfm_ad');sessionStorage.removeItem('pfm_ad_ts');return false}
  return true;
}

async function login(){
  const{data,error}=await sb.auth.signInWithPassword({email:E.le.value.trim(),password:E.lp.value});
  if(error)throw error;
  const{data:prof}=await sb.from('admin_profiles').select('is_admin').eq('user_id',data.user.id).eq('is_admin',true).maybeSingle();
  if(!prof)throw new Error('Not an approved admin');
  sessionStorage.setItem('pfm_ad','1');
  sessionStorage.setItem('pfm_ad_ts',Date.now());
  if(data.session?.access_token)sessionStorage.setItem('pfm_tok',data.session.access_token);
}

async function create(){
  const h=document.querySelector('#expiry')?.value;
  const exp=h?new Date(Date.now()+h*3600000).toISOString():null;
  let msg=E.b.value.trim();
  const title=E.t.value.trim();
  if(!title||!msg){toast('Title and message are required');return}

  // Handle file upload - wait for completion
  const imgFile=document.querySelector('#broadcastImageFile')?.files?.[0];
  const vidFile=document.querySelector('#broadcastVideoFile')?.files?.[0];
  const imgStatus=document.querySelector('#broadcastImageStatus');
  const vidStatus=document.querySelector('#broadcastVideoStatus');
  const uploads=[{file:imgFile,status:imgStatus,label:'image'},{file:vidFile,status:vidStatus,label:'video'}].filter(x=>x.file);
  if(uploads.length){
    if(uploads.some(x=>x.file.size>52428800)){toast('File too large (max 50 MB)');return}
    const btn=document.querySelector('#broadcastForm button[type="submit"]');
    btn.textContent='Uploading...';btn.disabled=true;
    uploads.forEach(x=>{if(x.status)x.status.textContent='Uploading...'});
    try{
      const{data:{session}}=await sb.auth.getSession();
      const tok=session?.access_token||sessionStorage.getItem('pfm_tok')||'';
      const urls=[];
      for(const upload of uploads){
        const r1=await fetch('/api/upload',{method:'POST',body:JSON.stringify({fileName:upload.file.name}),headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok}});
        const j1=await r1.json();
        if(!r1.ok||!j1.uploadUrl)throw new Error(j1.error||`Failed to get ${upload.label} upload URL`);
        const r2=await fetch(j1.uploadUrl,{method:'PUT',body:upload.file,headers:{'Content-Type':upload.file.type||'application/octet-stream'}});
        if(!r2.ok)throw new Error(`${upload.label[0].toUpperCase()+upload.label.slice(1)} upload failed`);
        urls.push(j1.publicUrl);
        if(upload.status)upload.status.textContent='Uploaded';
      }
      msg+='\n'+urls.join('\n');
      toast(uploads.length===1?uploads[0].file.name+' attached':'Image and video attached');
    }catch(e){
      const em=e.message||'Upload failed';
      sessionStorage.setItem('pfm_err',em);
      if(imgStatus)imgStatus.textContent='Failed: '+em;
      if(vidStatus)vidStatus.textContent='Failed: '+em;
      toast('Upload failed: '+em);
      document.querySelector('#broadcastImageFile').value='';
      document.querySelector('#broadcastVideoFile').value='';
      return;
    }finally{btn.textContent='Send Broadcast';btn.disabled=false}
  }

  const{error}=await sb.from('broadcasts').insert({title,message:msg,priority:document.querySelector('input[name="priority"]:checked')?.value||'general',expires_at:exp,is_active:true});
  if(error){toast(error.message);return}
  await refresh();toast('Broadcast sent');
  E.bf.reset();if(imgStatus)imgStatus.textContent='';if(vidStatus)vidStatus.textContent='';switchScreen('posts');
}

async function del(id){
  if(!live||!admin()){toast('Admin login required');return}
  const{error}=await sb.from('broadcasts').update({is_active:false}).eq('id',id);
  if(error){
    // Force full logout and prompt re-login
    await sb.auth.signOut();
    sessionStorage.removeItem('pfm_ad');
    sessionStorage.removeItem('pfm_ad_ts');
    renderAdmin();
    showLogin();
    switchScreen('admin');
    toast('Session expired. Please log in again.');
    return;
  }
  posts=posts.filter(p=>p.id!==id);
  render();toast('Deleted');
}

function renderBody(txt){
  let safe=esc(txt),btns='';
  safe=safe.replace(/(https?:\/\/\S+)/gi,(url)=>{
    const isImg=/\.(jpg|jpeg|png|webp|gif)(\?\S*)?$/i.test(url)||/images\.unsplash\.com\/photo-/.test(url);
    const yt=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    const isMP4=/\.(mp4|webm|mov|3gp|avi|mkv)(\?\S*)?$/i.test(url)||/storage\/v1\/object\/public/.test(url);
    if(isImg){
      const saved=mediaSaved(url);
      ensureMediaMeta(url);
      btns+='<div class="media-block"><button class="media-launch img-load" type="button" data-img="'+url+'"><span class="media-chip">'+(saved?'Saved image':'Image')+'</span><strong>'+mediaCopy('image',saved)+'</strong><span>'+mediaDetail(url,saved?'Stored in app data for repeat viewing.':'Loads only when you choose to open it.')+'</span></button></div>';
      return'';
    }
    if(yt){
      btns+='<div class="media-block"><button class="media-launch vid-card" type="button" data-vid="'+yt[1]+'"><span class="media-chip">Video</span><strong>Tap to play video</strong><span>Streams securely inside the app when opened.</span></button></div>';
      return'';
    }
    if(isMP4){
      const saved=mediaSaved(url);
      ensureMediaMeta(url);
      btns+='<div class="media-block"><button class="media-launch vid-card" type="button" data-vid="'+url+'"><span class="media-chip">'+(saved?'Saved video':'Video')+'</span><strong>'+mediaCopy('video',saved)+'</strong><span>'+mediaDetail(url,saved?'Stored in app data for repeat playback.':'Loads only when you choose to play it.')+'</span></button></div>';
      return'';
    }
    return '<a href="'+url+'" target="_blank" rel="noopener" style="color:var(--pfm-blue-2);text-decoration:underline;word-break:break-all">'+url+'</a>';
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
  items.forEach(i=>{try{const c=document.createElement('article');const rd=isRead(i);c.className='post-card '+(rd?'read ':'unread ')+esc(i.priority);c.innerHTML='<div class="post-top"><div class="post-heading"><h3>'+esc(i.title)+'</h3><span class="post-date">'+dt(i.created)+'</span></div><span class="tag '+(rd?'read':esc(i.priority))+'">'+(rd?'Read':prio(i.priority))+'</span></div><div class="post-body">'+renderBody(i.body)+'</div><div class="post-meta"><button class="'+(rd?'btn-secondary':'')+'" type="button" data-read="'+esc(i.id)+'">'+(rd?'Read again':'I have read this')+'</button></div>';E.list.appendChild(c);}catch{}});
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
  if(E.bs)E.bs.innerHTML=live?'<strong>Supabase connected</strong><span>Live broadcasts, uploads, and admin actions are available.</span>':'<strong>Connection unavailable</strong><span>The app cannot reach Supabase right now, so admin publishing is unavailable.</span>';
}

function render(){renderPosts();renderRecent();renderPast();renderAdmin();}

function show(s){E.lf.classList.add('hidden');E.rf.classList.add('hidden');E.nf.classList.add('hidden');if(s)(s==='login'?E.lf:s==='reset'?E.rf:E.nf).classList.remove('hidden');}

function switchScreen(s){
  if(s==='install'&&standalone())s='posts';
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
  if('Notification' in window&&Notification.permission==='default'){Notification.requestPermission()}
  if(E.bs)E.bs.innerHTML='<strong>Supabase connected</strong><span>Realtime active.</span>';
  renderInstallSteps();
  sb.auth.onAuthStateChange((e,session)=>{
    if(e==='PASSWORD_RECOVERY'){show('new');switchScreen('admin')}
    if(e==='SIGNED_OUT'){sessionStorage.removeItem('pfm_ad');sessionStorage.removeItem('pfm_ad_ts');renderAdmin();}
    if(session?.access_token)sessionStorage.setItem('pfm_tok',session.access_token);
  });
  await refresh();sub();
  if(standalone()){document.body.classList.add('standalone');renderInstallSteps();switchScreen('posts');return}
  const s=(location.hash||'#welcome').replace('#','');if(document.querySelector('#screen-'+s))switchScreen(s);
}
init();

document.addEventListener('click',async e=>{
  const s=e.target.closest('[data-screen]');if(s){switchScreen(s.dataset.screen);return}
  const r=e.target.closest('[data-read]');if(r){if(!live){reads.add(r.dataset.read);render();toast('Marked as read');return}try{await sb.from('broadcast_reads').upsert({broadcast_id:r.dataset.read,device_id:devId},{onConflict:'broadcast_id,device_id'})}catch{const q=JSON.parse(localStorage.getItem('pfm_readq')||'[]');if(!q.includes(r.dataset.read)){q.push(r.dataset.read);localStorage.setItem('pfm_readq',JSON.stringify(q))}}reads.add(r.dataset.read);render();toast('Marked as read');return}
  const d=e.target.closest('[data-delete]');if(d){if(confirm('Delete this broadcast?'))await del(d.dataset.delete);return}
    const img=e.target.closest('.img-load');if(img){const wrap=document.createElement('div');wrap.className='media-preview';const el=hardenMedia(document.createElement('img'));try{el.src=await mediaSrc(img.dataset.img)}catch{el.src=img.dataset.img}el.loading='lazy';el.referrerPolicy='no-referrer';el.alt='Broadcast image preview';el.onerror=()=>wrap.remove();wrap.appendChild(el);enableImageZoom(wrap,el);try{img.closest('.media-block')?.replaceWith(wrap)}catch{render()};return}
    const vc=e.target.closest('.vid-card');if(vc){const id=vc.dataset.vid;let el;if(id.includes('.')){el=hardenMedia(document.createElement('video'));try{el.src=await mediaSrc(id)}catch{el.src=id}el.style.cssText='width:100%;max-height:360px;border-radius:12px;display:block;background:#000'}else{el=document.createElement('iframe');el.src='https://www.youtube.com/embed/'+id+'?autoplay=1&rel=0';el.allow='autoplay;fullscreen';el.style.cssText='width:100%;aspect-ratio:16/9;border:0;border-radius:12px'}const wrap=document.createElement('div');wrap.className='media-preview';wrap.appendChild(el);try{vc.closest('.media-block')?.replaceWith(wrap)}catch{render()};return}
});
document.addEventListener('contextmenu',e=>{if(e.target.closest('img,video'))e.preventDefault()});
document.addEventListener('dragstart',e=>{if(e.target.closest('img,video'))e.preventDefault()});

E.lf?.addEventListener('submit',async e=>{e.preventDefault();try{await login();toast('Admin signed in');renderAdmin()}catch(err){toast(err.message||'Login failed')}});
E.rf?.addEventListener('submit',async e=>{e.preventDefault();await sb.auth.resetPasswordForEmail(E.re.value.trim());toast('Email sent');show('login')});
E.nf?.addEventListener('submit',async e=>{e.preventDefault();await sb.auth.updateUser({password:E.np.value});toast('Updated');show('login')});
E.bf?.addEventListener('submit',async e=>{e.preventDefault();try{await create();E.bf.reset()}catch(err){toast(err.message)}});
E.sr?.addEventListener('click',()=>show('reset'));
E.bl?.addEventListener('click',()=>show('login'));
E.lk?.addEventListener('click',()=>{sb.auth.signOut();sessionStorage.removeItem('pfm_ad');sessionStorage.removeItem('pfm_ad_ts');renderAdmin();toast('Admin locked')});
E.tabA?.addEventListener('click',()=>{showRead=false;E.tabA.classList.add('active');E.tabR.classList.remove('active');renderPosts()});
E.tabR?.addEventListener('click',()=>{showRead=true;E.tabR.classList.add('active');E.tabA.classList.remove('active');renderPosts()});
$('#clearSavedMediaBtn')?.addEventListener('click',async()=>{
  if(!confirm('Clear all saved image and video copies from this device? You will need to tap to load them again.'))return;
  await clearSavedMedia();
  toast('Saved media cleared from this device');
});

window.addEventListener('online',async()=>{
  const q=JSON.parse(localStorage.getItem('pfm_readq')||'[]');
  if(!q.length||!sb)return;
  for(const id of q){try{await sb.from('broadcast_reads').upsert({broadcast_id:id,device_id:devId},{onConflict:'broadcast_id,device_id'})}catch{break}}
  localStorage.removeItem('pfm_readq');
});
window.addEventListener('hashchange',()=>{const s=location.hash.replace('#','');if(document.querySelector('#screen-'+s))switchScreen(s)});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();defInstall=e;renderInstallSteps()});
window.addEventListener('appinstalled',()=>{defInstall=null;document.body.classList.add('standalone');renderInstallSteps();switchScreen('posts')});
window.addEventListener('beforeunload',()=>{if(channel){sb.removeChannel(channel);channel=null}});
const smartBtn=$('#smartInstallBtn');
smartBtn?.addEventListener('click',openInstallFlow);

if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');

