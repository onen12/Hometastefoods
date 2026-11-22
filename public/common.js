const IC={menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',plus:'<path d="M5 12h14M12 5v14"/>',minus:'<path d="M5 12h14"/>',search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
bag:'<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
utensils:'<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
receipt:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
grid:'<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
toggle:'<rect width="20" height="12" x="2" y="6" rx="6"/><circle cx="16" cy="12" r="2"/>',chart:'<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',check:'<path d="M20 6 9 17l-5-5"/>',clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
flame:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
bike:'<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
package:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
chef:'<path d="M6 13.87A4 4 0 0 1 7.5 6a5 5 0 0 1 9 0A4 4 0 0 1 18 13.87V21H6Z"/><path d="M6 17h12"/>',
phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
printer:'<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',copy:'<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
left:'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',right:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',cash:'<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
mobile:'<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
pencil:'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',lock:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'};
const ic=(n,s=20)=>`<svg class=ic width=${s} height=${s} viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=2 stroke-linecap=round stroke-linejoin=round>${IC[n]||''}</svg>`;
const $=s=>document.querySelector(s),fmt=n=>'UGX '+Math.round(n).toLocaleString(),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PMN={cash:'Cash',mtn:'MTN MoMo',airtel:'Airtel Money',momo:'Mobile Money'},A={};
const toast=m=>{const t=$('#toast');t.textContent=m;t.className='show';clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='',3200)};
const run=f=>async(...a)=>{try{await f(...a)}catch(e){toast(e.message)}};
async function api(p,m='GET',b){const t=getTok(),r=await fetch('/api/'+p,{method:m,headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(!r.ok){if(r.status==401&&t)onAuthFail();throw new Error(j.error||'Something went wrong')}return j}
const pic=(id,icon='utensils',c='')=>id?`<img class="pic ${c}" src="/img/${id}" loading=lazy alt="">`:`<div class="pic ph ${c}">${ic(icon,28)}</div>`;
const shrink=(file,max,png)=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL(png?'image/png':'image/jpeg',.82))};i.onerror=()=>rej(new Error('That file is not a valid image'));i.src=r.result};r.readAsDataURL(file)});
const pick=(cb,o={})=>{const f=document.createElement('input');f.type='file';f.accept='image/*';f.onchange=run(async()=>{if(!f.files[0])return;toast('Uploading…');const{id}=await api('upload','POST',{data:await shrink(f.files[0],o.max||640,o.png)});await cb(id)});f.click()};
function beep(){try{const c=new(window.AudioContext||webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;g.gain.setValueAtTime(.25,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.7);o.start();o.stop(c.currentTime+.7)}catch{}}
let PFX='';
async function profileView(prefix,el){PFX=prefix;const u=await api(prefix);el.innerHTML=`<div class="card prof"><div class=ipic data-a=pfpic>${pic(u.avatar_id,'user','round big')}<span>${ic('camera',14)}</span></div><h3>${esc(u.name)}</h3><small>${esc(u.email||u.phone)}</small><label>Your name</label><input id=pfn value="${esc(u.name)}"><button class=btn style="margin-top:12px" data-a=pfsave>Save profile</button><label>Change password</label><input id=pfc type=password placeholder="Current password"><input id=pfp type=password placeholder="New password" style="margin-top:8px"><button class="btn ghost" style="margin-top:12px" data-a=pfpw>Update password</button></div>`}
Object.assign(A,{pfpic:()=>pick(async id=>{await api(PFX,'PUT',{avatar_id:id});toast('Photo updated');onProfile()},{max:300}),
pfsave:run(async()=>{await api(PFX,'PUT',{name:$('#pfn').value});toast('Saved');onProfile()}),
pfpw:run(async()=>{await api(PFX+'/password','POST',{current:$('#pfc').value,password:$('#pfp').value});$('#pfc').value=$('#pfp').value='';toast('Password changed')}),
nvo:()=>document.body.classList.add('nv'),nvx:()=>document.body.classList.remove('nv'),
copen:()=>{$('#cart')?.classList.add('open');document.body.classList.add('lock')},cclose:()=>{$('#cart')?.classList.remove('open');document.body.classList.remove('lock')},
copy:v=>{navigator.clipboard?.writeText(v);toast('Copied '+v)}});
document.addEventListener('click',e=>{const t=e.target.closest('[data-a]');if(t){e.preventDefault();A[t.dataset.a]?.(t.dataset.v)}});
const STG=[['received','receipt','Received'],['preparing','chef','Preparing'],['ready','package','Ready'],['delivering','bike','On the way'],['done','check','Completed']];
const tracker=s=>{const i=STG.findIndex(x=>x[0]==s);return`<div class=trk>${STG.map((x,j)=>`<div class="st ${j<i?'ok':j==i?'now':''}"><i>${ic(j<i?'check':x[1],18)}</i><small>${x[2]}</small></div>`).join('')}</div>`};
const soldout=p=>!p.available||(p.stock!=null&&p.stock<=0);
const tile=(p,q=0)=>{const so=soldout(p);return`<div class="tile ${so?'so':''}"><div class=pw>${pic(p.image_id)}${so?'<span class=soldtag>Sold out</span>':p.stock!=null&&p.stock<=5?`<span class=lowtag>${ic('flame',12)} ${p.stock} left</span>`:''}${so?'':q?`<div class=stp2><button data-a=dec data-v=${p.id}>${ic('minus',16)}</button><b>${q}</b><button data-a=add data-v=${p.id}>${ic('plus',16)}</button></div>`:`<button class=addb data-a=add data-v=${p.id} aria-label="Add">${ic('plus',20)}</button>`}</div><div class=tb2><b>${esc(p.name)}</b><span>${fmt(p.price)}</span></div></div>`};
const greet=()=>{const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening'};
function confetti(){const c=['#ff6a13','#ffb067','#12a150','#17120f','#ffd23f','#e4002b'];for(let i=0;i<46;i++){const s=document.createElement('span');s.className='cf';s.style.cssText=`left:${Math.random()*100}vw;background:${c[i%6]};animation-delay:${Math.random()*.7}s;width:${6+Math.random()*6}px;height:${10+Math.random()*8}px;border-radius:${i%3?2:9}px`;document.body.appendChild(s);setTimeout(()=>s.remove(),3800)}}
