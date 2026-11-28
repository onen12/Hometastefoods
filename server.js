const express=require('express'),{Pool}=require('pg'),bcrypt=require('bcryptjs'),crypto=require('crypto'),fs=require('fs'),path=require('path'),webpush=require('web-push'),{xlsx,H,N,B,BN}=require('./xlsx');
const app=express();app.use(express.json({limit:'2mb'}));app.use(express.static(path.join(__dirname,'public'),{setHeaders:(r,p)=>{if(p.endsWith('sw.js'))r.setHeader('Cache-Control','no-cache')}}));
const db=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
const mac=b=>crypto.createHmac('sha256',SECRET).update(b).digest('base64url');
const sign=u=>{const b=Buffer.from(JSON.stringify({id:u.id,role:u.role,exp:Date.now()+12*36e5})).toString('base64url');return b+'.'+mac(b)};
const verify=t=>{try{const[b,s]=t.split('.');if(!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(mac(b))))return null;const p=JSON.parse(Buffer.from(b,'base64url'));return p.exp>Date.now()?p:null}catch{return null}};
const tokOf=q=>verify((q.headers.authorization||'').slice(7));
const any=(q,r,n)=>{const u=tokOf(q);if(!u)return r.status(401).json({error:'Please sign in'});q.user=u;n()};
const auth=role=>(q,r,n)=>{const u=tokOf(q),ok=u&&(role==='*staff'?u.role!=='customer':role==='nowaiter'?['admin','cashier'].includes(u.role):role?u.role===role:!['customer','rider'].includes(u.role));if(!ok)return r.status(u?403:401).json({error:'Not allowed'});q.user=u;n()};
const W=f=>(q,r)=>f(q,r).catch(e=>{if(e.code===400)return r.status(400).json({error:e.message});console.error(e);r.status(500).json({error:'Server error'})});
const K="(now() at time zone 'Africa/Kampala')::date",PD="(paid_at at time zone 'Africa/Kampala')::date",PM=['cash','mtn','airtel'];
const cfg=async()=>Object.fromEntries((await db.query('select key,value from settings')).rows.map(x=>[x.key,x.value]));
const pub=o=>{const{vapid_priv,...x}=o;return x};
const PSEL=`select p.*,(select c.pack_fee from categories c where c.name=p.category) as cat_pack_fee,(select coalesce(sum(i.qty),0)::int from order_items i join orders o2 on o2.id=i.order_id where i.product_id=p.id and o2.status<>'cancelled' and o2.created_at>now()-interval '30 days') as sold,o.title as offer_title,coalesce(o.percent,0) as offer_percent,(p.price-round(p.price*coalesce(o.percent,0)/100.0))::int as eff_price from products p left join (select distinct on(product_id) product_id,title,percent from offers where active and (start_date is null or start_date<=${K}) and (end_date is null or end_date>=${K}) and (coalesce(weekdays,'')='' or extract(dow from ${K})::int::text=any(string_to_array(weekdays,','))) order by product_id,percent desc) o on o.product_id=p.id`;
let VAPID_PUB='';
const sendOne=(s,p)=>webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify(p),{TTL:90,urgency:'high'}).catch(e=>{if([404,410].includes(e.statusCode))return db.query('delete from push_subs where id=$1',[s.id])});
const pushAll=async(p,roles)=>{const{rows}=await db.query('select s.* from push_subs s join users u on u.id=s.user_id where u.role=any($1)',[roles||['admin','cashier','waiter']]);await Promise.all(rows.map(s=>sendOne(s,p)))};
const pushUser=async(uid,p)=>{const{rows}=await db.query('select * from push_subs where user_id=$1',[uid]);await Promise.all(rows.map(s=>sendOne(s,p)))};
function ringOrder(o){let n=0;const go=async()=>{try{const{rows:[x]}=await db.query('select stage,status from orders where id=$1',[o.id]);if(!x||x.stage!='received'||x.status=='cancelled'||n++>=5)return;
 await pushAll({title:`New order #${o.id}`,body:`${o.customer} - ${o.items.reduce((t,i)=>t+i.qty,0)} plate(s) - UGX ${Math.round(o.total).toLocaleString()}`,tag:'order-'+o.id,renotify:true,url:'/staff'});setTimeout(go,12000)}catch(e){console.error(e)}};go()}
const CLEAN="delete from images where created_at<now()-interval '1 hour' and id not in (select image_id from products where image_id is not null union select image_id from categories where image_id is not null union select avatar_id from users where avatar_id is not null union select avatar_id from customers where avatar_id is not null union select value::int from settings where key='logo' and value~'^[0-9]+$')";

/* images + settings */
app.post('/api/upload',any,W(async(q,r)=>{const m=/^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(q.body.data||'');if(!m)return r.status(400).json({error:'Please choose a JPG or PNG image'});
 const buf=Buffer.from(m[2],'base64');if(buf.length>700000)return r.status(400).json({error:'Image is too large'});
 const{rows:[x]}=await db.query('insert into images(mime,data) values($1,$2) returning id',['image/'+m[1],buf]);db.query(CLEAN).catch(()=>{});r.json({id:x.id})}));
app.get('/img/:id',W(async(q,r)=>{const{rows:[x]}=await db.query('select mime,data from images where id=$1',[+q.params.id||0]);if(!x)return r.sendStatus(404);r.set({'Content-Type':x.mime,'Cache-Control':'public,max-age=31536000,immutable'}).send(x.data)}));
app.get('/api/settings',W(async(q,r)=>r.json(pub(await cfg()))));
app.put('/api/settings',auth('admin'),W(async(q,r)=>{for(const k of['name','address','phones','mtn','airtel','packing','momo_fee','logo','hide_soldout','delivery_fee','whatsapp','email','facebook','instagram','founded','sides','gmaps'])if(q.body[k]!==undefined)await db.query('insert into settings(key,value) values($1,$2) on conflict(key) do update set value=excluded.value',[k,String(q.body[k])]);r.json(pub(await cfg()))}));

/* auth + profiles */
app.post('/api/login',W(async(q,r)=>{const{rows:[u]}=await db.query('select * from users where lower(email)=lower($1)',[q.body.email||'']);
 if(!u||!bcrypt.compareSync(q.body.password||'',u.password_hash))return r.status(401).json({error:'Wrong email or password'});
 r.json({token:sign(u),user:{id:u.id,name:u.name,role:u.role,avatar_id:u.avatar_id}})}));
function prof(tbl,pre,role){const cols=tbl=='users'?'id,name,email,role,avatar_id':'id,name,phone,avatar_id',min=tbl=='users'?8:6;
 app.get(pre,auth(role),W(async(q,r)=>r.json((await db.query(`select ${cols} from ${tbl} where id=$1`,[q.user.id])).rows[0])));
 app.put(pre,auth(role),W(async(q,r)=>r.json((await db.query(`update ${tbl} set name=coalesce(nullif($1,''),name),avatar_id=coalesce($2,avatar_id) where id=$3 returning ${cols}`,[(q.body.name||'').trim(),q.body.avatar_id||null,q.user.id])).rows[0])));
 app.post(pre+'/password',auth(role),W(async(q,r)=>{const{rows:[u]}=await db.query(`select password_hash from ${tbl} where id=$1`,[q.user.id]);
  if(!bcrypt.compareSync(q.body.current||'',u.password_hash))return r.status(400).json({error:'Your current password is wrong'});
  if((q.body.password||'').length<min)return r.status(400).json({error:`New password must be ${min}+ characters`});
  await db.query(`update ${tbl} set password_hash=$1 where id=$2`,[bcrypt.hashSync(q.body.password,10),q.user.id]);r.json({ok:1})}))}
prof('users','/api/me','*staff');prof('customers','/api/c/me','customer');

/* categories + products */
app.get('/api/categories',W(async(q,r)=>r.json((await db.query('select * from categories order by name')).rows)));
app.post('/api/categories',auth('admin'),W(async(q,r)=>{const n=(q.body.name||'').trim();if(!n)return r.status(400).json({error:'Enter a category name'});
 try{r.json((await db.query('insert into categories(name,image_id) values($1,$2) returning *',[n,q.body.image_id||null])).rows[0])}catch{r.status(409).json({error:'That category already exists'})}}));
app.put('/api/categories/:id/pack',auth('admin'),W(async(q,r)=>{const v=q.body.pack_fee===''||q.body.pack_fee==null?null:Math.max(0,Math.round(+q.body.pack_fee));r.json((await db.query('update categories set pack_fee=$1 where id=$2 returning *',[v,q.params.id])).rows[0])}));
app.put('/api/categories/:id',auth('admin'),W(async(q,r)=>r.json((await db.query('update categories set image_id=$1 where id=$2 returning *',[q.body.image_id||null,q.params.id])).rows[0])));
app.delete('/api/categories/:id',auth('admin'),W(async(q,r)=>{const{rows:[n]}=await db.query('select count(*)::int as n from products p join categories c on c.name=p.category where c.id=$1',[q.params.id]);
 if(n.n)return r.status(400).json({error:'This category still has items. Move or delete them first.'});await db.query('delete from categories where id=$1',[q.params.id]);r.json({ok:1})}));
app.get('/api/products',auth(),W(async(q,r)=>r.json((await db.query(PSEL+' order by p.category,p.name')).rows)));
app.get('/api/c/menu',W(async(q,r)=>{const h=(await cfg()).hide_soldout=='1';r.json((await db.query(`select * from (${PSEL}) x where x.active ${h?'and x.available and (x.stock is null or x.stock>0)':''} order by x.category,x.name`)).rows)}));
app.post('/api/products',auth('admin'),W(async(q,r)=>{const{name,category,price}=q.body;if(!name||!(+price>=0))return r.status(400).json({error:'Name and price required'});
 r.json((await db.query('insert into products(name,category,price,pack,local) values($1,$2,$3,$4,$5) returning *',[name.trim(),(category||'General').trim(),Math.round(+price),!/\b(sodas?|juices?|teas?|waters?|rolex(?:es)?)\b/i.test(name),/local/i.test(category||'')])).rows[0])}));
const oi=v=>Math.max(0,Math.round(+v||0));
app.put('/api/products/:id',auth('admin'),W(async(q,r)=>{const{name,category,price,active,image_id,pack,local,opt_name,opt_min,opt_max,opt_default,opt_free,opt_price}=q.body,mx=oi(opt_max),mn=Math.min(oi(opt_min),mx),df=Math.min(Math.max(oi(opt_default),mn),mx);
 r.json((await db.query('update products set name=$1,category=$2,price=$3,active=$4,image_id=$5,pack=$6,local=$7,opt_name=$9,opt_min=$10,opt_max=$11,opt_default=$12,opt_free=$13,opt_price=$14 where id=$8 returning *',[name,category,Math.round(+price),active!==false,image_id||null,pack!==false,!!local,q.params.id,String(opt_name||'').trim().slice(0,30),mn,mx,df,oi(opt_free),oi(opt_price)])).rows[0])}));
app.delete('/api/products/:id',auth('admin'),W(async(q,r)=>{await db.query('delete from products where id=$1',[q.params.id]);r.json({ok:1})}));

/* orders */
async function makeOrder(o){const{rows:ps}=await db.query(`select * from (${PSEL}) x where x.id=any($1) and x.active`,[(o.items||[]).map(i=>+i.id)]);
 const SD=String((await cfg()).sides||'').split(',').map(x=>x.trim()).filter(Boolean),vs=(p,s)=>{if(!p.local||!SD.length)return'';const a=[...new Set((Array.isArray(s)?s:[]).map(String))].filter(x=>SD.includes(x)||x=='Sauce only');if(!a.length)throw Object.assign(new Error(`Please choose sides for ${p.name}`),{code:400});return a.includes('Sauce only')?'Sauce only':SD.filter(x=>a.includes(x)).join(', ')};
 const on=(p,v)=>{if(!(+p.opt_max>0))return null;const n=Math.round(+v);if(!isFinite(n)||n<+p.opt_min||n>+p.opt_max)throw Object.assign(new Error(`Please choose ${p.opt_name||'the option'} for ${p.name}`),{code:400});return n};
 const L=(o.items||[]).map(i=>{const p=ps.find(x=>x.id==i.id);if(!p)return null;const qty=Math.max(1,Math.min(99,+i.qty|0)),sides=vs(p,i.sides),opt=on(p,i.opt),up=p.eff_price+(opt!=null?(+p.opt_price||0)*Math.max(0,opt-(+p.opt_free||0)):0),desc=[sides,opt!=null?`${p.opt_name||'Option'}: ${opt}`:''].filter(Boolean).join(', ');return{p,qty,sides,opt,up,desc}}).filter(Boolean);
 if(!L.length)throw Object.assign(new Error('Your cart is empty or the items are unavailable'),{code:400});
 for(const l of L)if(!l.p.available||(l.p.stock!=null&&l.p.stock<l.qty))throw Object.assign(new Error(l.p.available&&l.p.stock>0?`Only ${l.p.stock} plate(s) of ${l.p.name} left`:`Sorry, ${l.p.name} is sold out`),{code:400});
 if(o.type=='takeaway'&&o.fulfil=='delivery'&&!String(o.address||'').trim()&&!(o.lat!=null&&o.lng!=null&&isFinite(+o.lat)&&isFinite(+o.lng)))throw Object.assign(new Error('Please pin your location or enter the delivery address'),{code:400});
  const type=o.type=='takeaway'?'takeaway':'dine_in',plates=L.filter(l=>l.p.pack).reduce((s,l)=>s+l.qty,0),C=await cfg(),pack=type=='takeaway'?L.filter(l=>l.p.pack).reduce((t,l)=>t+l.qty*(l.p.cat_pack_fee!=null?+l.p.cat_pack_fee:(+C.packing||0)),0):0,fulfil=type=='takeaway'&&o.fulfil=='delivery'?'delivery':'pickup',dfee=fulfil=='delivery'?(+C.delivery_fee||0):0,gl=fulfil=='delivery'&&o.lat!=null&&o.lng!=null&&isFinite(+o.lat)&&isFinite(+o.lng)&&Math.abs(+o.lat)<=90&&Math.abs(+o.lng)<=180,mf=['mtn','airtel'].includes(o.method)?(+C.momo_fee||0):0,total=L.reduce((s,l)=>s+l.up*l.qty,0)+pack+dfee+mf,paid=!!o.pay&&PM.includes(o.method),c=await db.connect();
 try{await c.query('begin');
  const{rows:[x]}=await c.query(`insert into orders(customer,phone,table_no,total,status,method,paid_at,user_id,customer_id,source,pay_pref,pay_ref,order_type,packing,momo_fee,fulfil,delivery_fee,address,instructions,lat,lng) values($1,$2,$3,$4,$5,$6,${paid?'now()':'null'},$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) returning *`,[(o.customer||'').trim()||'Walk-in',o.phone||'',(o.table||'').trim(),total,paid?'paid':'open',paid?o.method:null,o.user_id||null,o.customer_id||null,o.source||'pos',paid?null:(o.method||null),'',type,pack,mf,fulfil,dfee,fulfil=='delivery'?(String(o.address||'').trim().slice(0,300)||(gl?'Pinned map location':'')):'',fulfil=='delivery'?String(o.instructions||'').trim().slice(0,500):'',gl?+o.lat:null,gl?+o.lng:null]);
  for(const l of L){const u=await c.query('update products set stock=stock-$1 where id=$2 and available and (stock is null or stock>=$1) returning id',[l.qty,l.p.id]);
   if(!u.rowCount)throw Object.assign(new Error(`Sorry, ${l.p.name} just ran out`),{code:400});
   await c.query('insert into order_items(order_id,product_id,name,price,qty,sides) values($1,$2,$3,$4,$5,$6)',[x.id,l.p.id,l.p.name,l.up,l.qty,l.desc])}
  await c.query('commit');return{...x,items:L.map(l=>({name:l.p.name,price:l.up,qty:l.qty,sides:l.desc}))}}
 catch(e){await c.query('rollback');throw e}finally{c.release()}}
app.post('/api/orders',auth(),W(async(q,r)=>r.json(await makeOrder({...q.body,pay:true,user_id:q.user.id,...(q.user.role=='waiter'?{type:'dine_in',fulfil:'pickup',address:''}:{})}))));
app.get('/api/orders',auth(),W(async(q,r)=>{const s=q.query.status;
 r.json((await db.query(`select o.*,u.name as cashier,rd.name as rider_name,rd.phone as rider_phone,(select json_agg(json_build_object('name',i.name,'price',i.price,'qty',i.qty,'sides',i.sides)) from order_items i where i.order_id=o.id) as items from orders o left join users u on u.id=o.user_id left join users rd on rd.id=o.rider_id ${s?'where o.status=$1':''} order by o.id desc limit 100`,s?[s]:[])).rows)}));
app.post('/api/orders/:id/pay',auth(),W(async(q,r)=>{if(!PM.includes(q.body.method))return r.status(400).json({error:'Choose a payment method'});
 const f=['mtn','airtel'].includes(q.body.method)?(+(await cfg()).momo_fee||0):0;
 const{rows:[o]}=await db.query("update orders set status='paid',method=$1,paid_at=now(),total=total-coalesce(momo_fee,0)+$3::int,momo_fee=$3::int where id=$2 and status='open' returning *",[q.body.method,q.params.id,f]);
 o?r.json(o):r.status(409).json({error:'Order is not open'})}));

const STAGES=['received','preparing','ready','delivering','done'];
app.post('/api/orders/:id/stage',auth(),W(async(q,r)=>{if(!STAGES.includes(q.body.stage))return r.status(400).json({error:'Unknown stage'});r.json((await db.query("update orders set stage=$1,picked_at=case when $1='delivering' and picked_at is null then now() else picked_at end where id=$2 and status<>'cancelled' returning *",[q.body.stage,q.params.id])).rows[0]||{})}));
app.put('/api/products/:id/stock',auth(),W(async(q,r)=>{const s=q.body.stock===''||q.body.stock==null?null:Math.max(0,Math.round(+q.body.stock));r.json((await db.query('update products set available=$1,stock=$2 where id=$3 returning *',[q.body.available!==false,s,q.params.id])).rows[0])}));
app.post('/api/orders/:id/cancel',auth('nowaiter'),W(async(q,r)=>{const u=await db.query("update orders set status='cancelled' where id=$1 and status in ('open','paid') returning id",[q.params.id]);if(u.rowCount)await db.query('update products p set stock=p.stock+i.qty from order_items i where i.order_id=$1 and i.product_id=p.id and p.stock is not null',[q.params.id]);r.json({ok:1})}));

/* customers */
const ph=s=>String(s||'').replace(/[^\d+]/g,'');
app.get('/order',(q,r)=>r.redirect('/'));app.get('/staff',(q,r)=>r.sendFile(path.join(__dirname,'public','staff.html')));
app.post('/api/c/register',W(async(q,r)=>{const{name,password}=q.body,phone=ph(q.body.phone);
 if(!name||phone.length<9||(password||'').length<6)return r.status(400).json({error:'Enter your name, a valid phone number and a password of 6+ characters'});
 try{const{rows:[u]}=await db.query('insert into customers(name,phone,password_hash) values($1,$2,$3) returning id,name,phone,avatar_id',[name.trim(),phone,bcrypt.hashSync(password,10)]);r.json({token:sign({id:u.id,role:'customer'}),user:u})}
 catch{r.status(409).json({error:'That phone number already has an account. Please sign in.'})}}));
app.post('/api/c/login',W(async(q,r)=>{const{rows:[u]}=await db.query('select * from customers where phone=$1',[ph(q.body.phone)]);
 if(!u||!bcrypt.compareSync(q.body.password||'',u.password_hash))return r.status(401).json({error:'Wrong phone number or password'});
 r.json({token:sign({id:u.id,role:'customer'}),user:{id:u.id,name:u.name,phone:u.phone,avatar_id:u.avatar_id}})}));
app.post('/api/c/orders',auth('customer'),W(async(q,r)=>{const{rows:[u]}=await db.query('select id,name,phone from customers where id=$1',[q.user.id]);if(!u)return r.status(401).json({error:'Please sign in again'});
 const{items,method,note,type,fulfil,address,instructions,contact,lat,lng}=q.body;if(!PM.includes(method))return r.status(400).json({error:'Choose how you will pay'});
  const o=await makeOrder({items,method,type,fulfil,address,instructions,lat,lng,customer:u.name,phone:ph(contact)||u.phone,table:note,customer_id:u.id,source:'online'});ringOrder(o);r.json(o)}));
app.get('/api/c/orders',auth('customer'),W(async(q,r)=>r.json((await db.query(`select o.id,o.total,o.status,o.method,o.pay_pref,o.order_type,o.fulfil,o.delivery_fee,o.address,o.stage,case when o.stage='delivering' then rd.name end as rider_name,case when o.stage='delivering' then rd.phone end as rider_phone,o.created_at,(select json_agg(json_build_object('name',i.name,'qty',i.qty,'sides',i.sides)) from order_items i where i.order_id=o.id) as items from orders o left join users rd on rd.id=o.rider_id where o.customer_id=$1 order by o.id desc limit 20`,[q.user.id])).rows)));

/* offers, push, app manifests */
app.get('/api/offers',auth('admin'),W(async(q,r)=>r.json((await db.query("select o.id,o.product_id,o.title,o.percent,to_char(o.start_date,'YYYY-MM-DD') as start_date,to_char(o.end_date,'YYYY-MM-DD') as end_date,o.weekdays,o.active,p.name as product from offers o join products p on p.id=o.product_id order by o.id desc")).rows)));
app.post('/api/offers',auth('admin'),W(async(q,r)=>{const{product_id,title,percent,start_date,end_date,weekdays}=q.body,pc=Math.round(+percent);if(!product_id||!(pc>=1&&pc<=90))return r.status(400).json({error:'Choose a dish and a discount between 1% and 90%'});
 r.json((await db.query('insert into offers(product_id,title,percent,start_date,end_date,weekdays) values($1,$2,$3,$4,$5,$6) returning id',[product_id,(title||'Special offer').trim(),pc,start_date||null,end_date||null,weekdays||''])).rows[0])}));
app.put('/api/offers/:id/toggle',auth('admin'),W(async(q,r)=>r.json((await db.query('update offers set active=not active where id=$1 returning id',[q.params.id])).rows[0])));
app.delete('/api/offers/:id',auth('admin'),W(async(q,r)=>{await db.query('delete from offers where id=$1',[q.params.id]);r.json({ok:1})}));
app.get('/api/push/key',auth('*staff'),(q,r)=>r.json({key:VAPID_PUB}));
app.post('/api/push/subscribe',auth('*staff'),W(async(q,r)=>{const s=q.body;if(!s||!s.endpoint||!s.keys)return r.status(400).json({error:'Bad subscription'});
 await db.query('insert into push_subs(user_id,endpoint,p256dh,auth) values($1,$2,$3,$4) on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth',[q.user.id,s.endpoint,s.keys.p256dh,s.keys.auth]);r.json({ok:1})}));
app.post('/api/push/test',auth('*staff'),W(async(q,r)=>{await pushUser(q.user.id,{title:'Alerts are on',body:'You will be alerted here for new orders and deliveries.',tag:'test',url:'/staff'});r.json({ok:1})}));
const mani=(id,start,name)=>({id,name,short_name:name.slice(0,12),start_url:start,scope:'/',display:'standalone',orientation:'portrait',background_color:'#ffffff',theme_color:'#ff6a13',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}]});
app.get('/manifest.json',W(async(q,r)=>r.type('application/manifest+json').send(JSON.stringify(mani('/pos-app','/staff',(await cfg()).name+' POS')))));
app.get('/order.webmanifest',W(async(q,r)=>r.type('application/manifest+json').send(JSON.stringify(mani('/order-app','/',(await cfg()).name)))));

/* reports + staff */
app.get('/api/reports',auth('admin'),W(async(q,r)=>{const t=`status='paid' and ${PD}=${K}`;
 const[a,b,c,d]=await Promise.all([
  db.query(`select count(*)::int as n,coalesce(sum(total),0)::int as sum from orders where ${t}`),
  db.query(`select method,coalesce(sum(total),0)::int as sum from orders where ${t} group by 1`),
  db.query(`select i.name,sum(i.qty)::int as qty from order_items i join orders o on o.id=i.order_id where o.status='paid' and o.paid_at>now()-interval '30 days' group by 1 order by 2 desc limit 5`),
  db.query(`select to_char(d,'Dy') as day,coalesce(sum(o.total),0)::int as sum from generate_series((${K}-6)::timestamp,${K}::timestamp,'1 day') d left join orders o on o.status='paid' and ${PD.replace('paid_at','o.paid_at')}=d::date group by d order by d`)]);
 r.json({today:a.rows[0],methods:b.rows,top:c.rows,week:d.rows})}));
/* riders */
app.get('/api/riders/list',auth(),W(async(q,r)=>r.json((await db.query("select id,name,phone from users where role='rider' order by name")).rows)));
app.post('/api/orders/:id/assign',auth(),W(async(q,r)=>{const rid=q.body.rider_id||null;let rd=null;
 if(rid){rd=(await db.query("select id,name from users where id=$1 and role='rider'",[rid])).rows[0];if(!rd)return r.status(400).json({error:'Choose a rider'})}
 const o=(await db.query("update orders set rider_id=$1 where id=$2 and fulfil='delivery' and status<>'cancelled' and stage<>'done' returning id,customer,address",[rid,q.params.id])).rows[0];
 if(!o)return r.status(400).json({error:'Only open delivery orders can be given to a rider'});
 if(rd)pushUser(rd.id,{title:`New delivery #${o.id}`,body:`${o.customer} - ${o.address||''}`.slice(0,120),tag:'ride-'+o.id,renotify:true,url:'/staff'}).catch(()=>{});r.json({ok:1})}));
app.get('/api/riders',auth('admin'),W(async(q,r)=>r.json((await db.query(`select u.id,u.name,u.phone,u.email,count(o.id) filter (where o.stage<>'done' and o.status<>'cancelled')::int as active,count(o.id) filter (where o.stage='done' and o.status<>'cancelled')::int as delivered,coalesce(sum(o.rider_cash) filter (where not o.cash_settled),0)::int as cash_due,coalesce(sum(o.rider_cash),0)::int as cash_total from users u left join orders o on o.rider_id=u.id where u.role='rider' group by u.id order by u.name`)).rows)));
app.post('/api/riders/:id/settle',auth('admin'),W(async(q,r)=>{await db.query('update orders set cash_settled=true where rider_id=$1 and rider_cash>0 and not cash_settled',[q.params.id]);r.json({ok:1})}));
const RO=`select o.id,o.customer,o.phone,o.address,o.lat,o.lng,o.instructions,o.table_no,o.total,o.status,o.stage,o.pay_pref,o.method,coalesce(o.rider_cash,0) as rider_cash,o.cash_settled,o.created_at,o.delivered_at,(select json_agg(json_build_object('name',i.name,'qty',i.qty,'sides',i.sides) order by i.id) from order_items i where i.order_id=o.id) as items from orders o where o.rider_id=$1 and o.fulfil='delivery' and o.status<>'cancelled'`;
app.get('/api/rider/orders',auth('rider'),W(async(q,r)=>r.json((await db.query(RO+" order by (o.stage='done'),o.id desc limit 100",[q.user.id])).rows)));
app.get('/api/rider/summary',auth('rider'),W(async(q,r)=>r.json((await db.query(`select coalesce(sum(rider_cash) filter (where not cash_settled),0)::int as due,coalesce(sum(rider_cash),0)::int as total,count(*) filter (where stage='done' and (delivered_at at time zone 'Africa/Kampala')::date=${K})::int as today,count(*) filter (where stage<>'done' and status<>'cancelled')::int as active from orders where rider_id=$1 and fulfil='delivery'`,[q.user.id])).rows[0])));
app.post('/api/rider/orders/:id/start',auth('rider'),W(async(q,r)=>{const u=await db.query("update orders set stage='delivering',picked_at=coalesce(picked_at,now()) where id=$1 and rider_id=$2 and stage in ('received','preparing','ready') returning id",[q.params.id,q.user.id]);r.json({ok:u.rowCount})}));
app.post('/api/rider/orders/:id/deliver',auth('rider'),W(async(q,r)=>{const{rows:[o]}=await db.query("select id,status from orders where id=$1 and rider_id=$2 and fulfil='delivery'",[q.params.id,q.user.id]);if(!o)return r.status(404).json({error:'Order not found'});
 if(o.status=='open'&&q.body.collected)await db.query("update orders set status='paid',method='cash',paid_at=now(),total=total-coalesce(momo_fee,0),momo_fee=0,rider_cash=total-coalesce(momo_fee,0),stage='done',delivered_at=now() where id=$1",[o.id]);
 else await db.query("update orders set stage='done',delivered_at=now() where id=$1",[o.id]);r.json({ok:1})}));

/* live rider tracking + bulk availability */
app.post('/api/rider/location',auth('rider'),W(async(q,r)=>{const lat=+q.body.lat,lng=+q.body.lng;if(!isFinite(lat)||!isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return r.status(400).json({error:'Bad location'});
 const n=v=>v!=null&&v!==''&&isFinite(+v)?+v:null;
 await db.query('insert into rider_locations(rider_id,lat,lng,accuracy,heading,speed,updated_at) values($1,$2,$3,$4,$5,$6,now()) on conflict(rider_id) do update set lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,heading=excluded.heading,speed=excluded.speed,updated_at=now()',[q.user.id,lat,lng,n(q.body.accuracy),n(q.body.heading),n(q.body.speed)]);
 await db.query('insert into rider_track(rider_id,lat,lng) values($1,$2,$3)',[q.user.id,lat,lng]);
 if(Math.random()<.02)db.query("delete from rider_track where at<now()-interval '3 days'").catch(()=>{});r.json({ok:1})}));
app.get('/api/orders/:id/track',auth(),W(async(q,r)=>{const o=(await db.query("select o.id,o.customer,o.phone,o.address,o.lat,o.lng,o.stage,o.status,o.rider_id,o.picked_at,rd.name as rider_name,rd.phone as rider_phone from orders o left join users rd on rd.id=o.rider_id where o.id=$1 and o.fulfil='delivery'",[q.params.id])).rows[0];
 if(!o)return r.status(404).json({error:'Delivery order not found'});let rider=null,trail=[];
 if(o.rider_id){rider=(await db.query('select lat,lng,accuracy,heading,speed,updated_at,extract(epoch from now()-updated_at)::int as age from rider_locations where rider_id=$1',[o.rider_id])).rows[0]||null;
  trail=(await db.query("select lat,lng from rider_track where rider_id=$1 and at>=coalesce($2::timestamptz,now()-interval '2 hours') order by id desc limit 300",[o.rider_id,o.picked_at])).rows.reverse().map(p=>[p.lat,p.lng])}
 r.json({order:o,rider,trail})}));
app.put('/api/stock/bulk',auth(),W(async(q,r)=>{const ids=(Array.isArray(q.body.ids)?q.body.ids:[]).map(Number).filter(Number.isInteger);if(!ids.length)return r.status(400).json({error:'Choose at least one item'});
 await db.query('update products set available=$1 where id=any($2)',[q.body.available!==false,ids]);r.json({ok:ids.length})}));

/* production mode, order delete, password resets */
app.get('/api/admin/counts',auth('admin'),W(async(q,r)=>{const c=async t=>(await db.query(`select count(*)::int as n from ${t}`)).rows[0].n;r.json({orders:await c('orders'),customers:await c('customers'),messages:await c('chat_messages'),live:(await cfg()).live=='1'})}));
app.post('/api/admin/reset',auth('admin'),W(async(q,r)=>{if(q.body.confirm!=='DELETE')return r.status(400).json({error:'Type DELETE to confirm'});const c=await db.connect();
 try{await c.query('begin');await c.query('truncate orders restart identity cascade');await c.query('truncate rider_track,rider_locations');
  if(q.body.chats!==false)await c.query('delete from chat_messages');if(q.body.customers)await c.query('delete from customers');if(q.body.plates)await c.query('update products set stock=null');
  await c.query("insert into settings(key,value) values('live','1') on conflict(key) do update set value='1'");await c.query('commit');r.json({ok:1})}
 catch(e){await c.query('rollback');throw e}finally{c.release()}}));
app.delete('/api/orders/:id',auth('admin'),W(async(q,r)=>{const o=(await db.query('select status from orders where id=$1',[q.params.id])).rows[0];if(!o)return r.status(404).json({error:'Order not found'});
 if(o.status!='cancelled')await db.query('update products p set stock=p.stock+i.qty from order_items i where i.order_id=$1 and i.product_id=p.id and p.stock is not null',[q.params.id]);
 await db.query('delete from orders where id=$1',[q.params.id]);r.json({ok:1})}));
app.post('/api/customers/:id/password',auth('admin'),W(async(q,r)=>{const p=String(q.body.password||'');if(p.length<6)return r.status(400).json({error:'Password must be 6 or more characters'});await db.query('update customers set password_hash=$1 where id=$2',[bcrypt.hashSync(p,10),q.params.id]);r.json({ok:1})}));
app.post('/api/users/:id/password',auth('admin'),W(async(q,r)=>{const p=String(q.body.password||'');if(p.length<8)return r.status(400).json({error:'Password must be 8 or more characters'});await db.query('update users set password_hash=$1 where id=$2',[bcrypt.hashSync(p,10),q.params.id]);r.json({ok:1})}));

/* live chat + customers */
app.get('/api/c/chat',auth('customer'),W(async(q,r)=>r.json((await db.query('select id,sender,body,created_at from chat_messages where customer_id=$1 order by id desc limit 100',[q.user.id])).rows.reverse())));
app.post('/api/c/chat',auth('customer'),W(async(q,r)=>{const b=String(q.body.body||'').trim().slice(0,1000);if(!b)return r.status(400).json({error:'Type a message first'});
 const{rows:[u]}=await db.query('select name from customers where id=$1',[q.user.id]);await db.query("insert into chat_messages(customer_id,sender,body) values($1,'customer',$2)",[q.user.id,b]);
 pushAll({title:`Message from ${u.name}`,body:b.slice(0,100),tag:'chat-'+q.user.id,renotify:true,url:'/staff'},['admin','cashier']).catch(()=>{});r.json({ok:1})}));
app.get('/api/chats',auth('nowaiter'),W(async(q,r)=>r.json((await db.query(`select c.id,c.name,c.phone,m.body as last,m.created_at as at,m.sender,(select count(*)::int from chat_messages x where x.customer_id=c.id and x.sender='customer' and not x.read) as unread from customers c join lateral (select body,created_at,sender from chat_messages where customer_id=c.id order by id desc limit 1) m on true order by m.created_at desc limit 100`)).rows)));
app.get('/api/chats/:id',auth('nowaiter'),W(async(q,r)=>{await db.query("update chat_messages set read=true where customer_id=$1 and sender='customer'",[q.params.id]);r.json((await db.query('select id,sender,body,created_at from chat_messages where customer_id=$1 order by id desc limit 200',[q.params.id])).rows.reverse())}));
app.post('/api/chats/:id',auth('nowaiter'),W(async(q,r)=>{const b=String(q.body.body||'').trim().slice(0,1000);if(!b)return r.status(400).json({error:'Type a message first'});
 await db.query("insert into chat_messages(customer_id,sender,staff_id,body,read) values($1,'staff',$2,$3,true)",[q.params.id,q.user.id,b]);r.json({ok:1})}));
app.get('/api/customers',auth('admin'),W(async(q,r)=>r.json((await db.query(`select c.id,c.name,c.phone,to_char(c.created_at at time zone 'Africa/Kampala','YYYY-MM-DD') as joined,count(o.id) filter (where o.status<>'cancelled')::int as orders,coalesce(sum(o.total) filter (where o.status='paid'),0)::int as spent from customers c left join orders o on o.customer_id=c.id group by c.id order by c.id desc limit 500`)).rows)));
app.get('/api/reports/export',auth('admin'),W(async(q,r)=>{const D=/^\d{4}-\d{2}-\d{2}$/,d0=(await db.query(`select to_char(${K},'YYYY-MM-DD') as t,to_char(${K}-29,'YYYY-MM-DD') as f`)).rows[0];
 let to=D.test(q.query.to||'')?q.query.to:d0.t,from=D.test(q.query.from||'')?q.query.from:d0.f;if(from>to)[from,to]=[to,from];
 const WH="(o.created_at at time zone 'Africa/Kampala')::date between $1::date and $2::date",AT="to_char(o.created_at at time zone 'Africa/Kampala','YYYY-MM-DD HH24:MI')";
 const os=(await db.query(`select o.id,${AT} as at,o.customer,o.phone,o.order_type,o.source,o.status,o.stage,o.method,coalesce(o.packing,0) as packing,coalesce(o.momo_fee,0) as momo_fee,coalesce(o.delivery_fee,0) as delivery_fee,o.fulfil,o.address,o.instructions,o.table_no,(select string_agg(i.qty||' x '||i.name||case when coalesce(i.sides,'')<>'' then ' ('||i.sides||')' else '' end,'; ' order by i.id) from order_items i where i.order_id=o.id) as items_text,rd.name as rider_name,coalesce(o.rider_cash,0) as rider_cash,o.lat,o.lng,o.total,u.name as cashier from orders o left join users u on u.id=o.user_id left join users rd on rd.id=o.rider_id where ${WH} order by o.id`,[from,to])).rows;
 const its=(await db.query(`select i.order_id,${AT} as at,o.customer,o.phone,i.name,i.sides,i.qty,i.price,o.status from order_items i join orders o on o.id=i.order_id where ${WH} order by i.order_id,i.id`,[from,to])).rows;
 const name=(await cfg()).name||'Restaurant',paid=os.filter(o=>o.status=='paid'),sum=(a,f)=>a.reduce((t,o)=>t+f(o),0),pm=m=>paid.filter(o=>o.method==m),ty=t=>paid.filter(o=>o.order_type==t),so=t=>paid.filter(o=>o.source==t);
 const top={},day={};for(const i of its)if(i.status=='paid'){const t=top[i.name]||(top[i.name]={qty:0,rev:0});t.qty+=i.qty;t.rev+=i.qty*i.price}
 for(const o of paid){const k=o.at.slice(0,10),t=day[k]||(day[k]={n:0,s:0});t.n++;t.s+=o.total}
 const L=(a,b,c)=>[a,N(b),c==null?'':N(c)];const gen=(await db.query("select to_char(now() at time zone 'Africa/Kampala','YYYY-MM-DD HH24:MI') as t")).rows[0].t;
 const sm=[[B(name+' - sales report')],['Period',from+' to '+to],['Generated',gen+' (Kampala time)'],[],H(['Measure','Orders','Amount (UGX)']),
  [B('Total sales (paid orders)'),BN(paid.length),BN(sum(paid,o=>o.total))],L('  Packing charges included',paid.filter(o=>o.packing>0).length,sum(paid,o=>o.packing)),L('  Mobile Money fees included',paid.filter(o=>o.momo_fee>0).length,sum(paid,o=>o.momo_fee)),L('  Delivery fees included',paid.filter(o=>o.delivery_fee>0).length,sum(paid,o=>o.delivery_fee)),
  [],H(['By payment method','Orders','Amount (UGX)']),L('Cash',pm('cash').length,sum(pm('cash'),o=>o.total)),L('MTN MoMo',pm('mtn').length,sum(pm('mtn'),o=>o.total)),L('Airtel Money',pm('airtel').length,sum(pm('airtel'),o=>o.total)),
  [],H(['By service','Orders','Amount (UGX)']),L('Dine in',ty('dine_in').length,sum(ty('dine_in'),o=>o.total)),L('Take away',ty('takeaway').length,sum(ty('takeaway'),o=>o.total)),L('  of which delivery',paid.filter(o=>o.fulfil=='delivery').length,sum(paid.filter(o=>o.fulfil=='delivery'),o=>o.total)),
  [],H(['By channel','Orders','Amount (UGX)']),L('Online (customer app)',so('online').length,sum(so('online'),o=>o.total)),L('At the till',so('pos').length,sum(so('pos'),o=>o.total)),
  [],H(['Other','Orders','Amount (UGX)']),L('Unpaid (open) orders',os.filter(o=>o.status=='open').length,sum(os.filter(o=>o.status=='open'),o=>o.total)),L('Cancelled orders',os.filter(o=>o.status=='cancelled').length,null),L('Cash collected by riders',paid.filter(o=>o.rider_cash>0).length,sum(paid,o=>o.rider_cash))];
 const lab={dine_in:'Dine in',takeaway:'Take away',online:'Online',pos:'Till',cash:'Cash',mtn:'MTN MoMo',airtel:'Airtel Money',momo:'Mobile Money',open:'Unpaid',paid:'Paid',cancelled:'Cancelled',received:'Received',preparing:'Preparing',ready:'Ready',delivering:'On the way',done:'Completed'};
 const buf=xlsx([{name:'Summary',widths:[38,16,18],rows:sm},
  {name:'Orders',widths:[9,18,22,16,12,13,10,12,11,13,48,10,12,10,13,32,32,22,14,18,16,44],rows:[H(['Order #','Date and time','Customer','Phone','Service','Fulfilment','Channel','Payment','Stage','Method','Items ordered','Packing','Delivery fee','MoMo fee','Total (UGX)','Delivery address','Delivery instructions','Note / table','Cashier','Rider','Rider cash collected','Map link']),...os.map(o=>[o.id,o.at,o.customer,o.phone,lab[o.order_type]||o.order_type,o.order_type=='takeaway'?(o.fulfil=='delivery'?'Delivery':'Self pickup'):'',lab[o.source]||o.source,lab[o.status]||o.status,lab[o.stage]||o.stage,lab[o.method]||'',o.items_text||'',N(o.packing),N(o.delivery_fee),N(o.momo_fee),N(o.total),o.address||'',o.instructions||'',o.table_no||'',o.cashier||'',o.rider_name||'',N(o.rider_cash),o.lat!=null?'https://www.google.com/maps?q='+o.lat+','+o.lng:''])]},
   {name:'Items sold',widths:[9,18,22,16,30,8,14,14,11],rows:[H(['Order #','Date and time','Customer','Phone','Dish','Plates','Unit price','Line total','Payment']),...its.map(i=>[i.order_id,i.at,i.customer,i.phone,i.name+(i.sides?' ('+i.sides+')':''),i.qty,N(i.price),N(i.qty*i.price),lab[i.status]||i.status])]},
   {name:'Top dishes',widths:[6,32,10,16],rows:[H(['#','Dish','Plates','Sales (UGX)']),...Object.entries(top).sort((a,b)=>b[1].rev-a[1].rev).map(([n,t],i)=>[i+1,n,t.qty,N(t.rev)])]},
  {name:'Daily sales',widths:[14,10,16],rows:[H(['Date','Orders','Sales (UGX)']),...Object.keys(day).sort().map(k=>[k,day[k].n,N(day[k].s)])]}]);
 r.set({'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="Sales-report-${from}-to-${to}.xlsx"`}).send(buf)}));
app.get('/api/users',auth('admin'),W(async(q,r)=>r.json((await db.query('select id,name,email,phone,role,avatar_id from users order by id')).rows)));
app.post('/api/users',auth('admin'),W(async(q,r)=>{const{name,email,password,role,phone}=q.body;if(!name||!email||(password||'').length<8)return r.status(400).json({error:'Name, email and a password of 8+ characters are required'});
 try{await db.query('insert into users(name,email,password_hash,role,phone) values($1,$2,$3,$4,$5)',[name.trim(),email.trim(),bcrypt.hashSync(password,10),['admin','rider','waiter'].includes(role)?role:'cashier',String(phone||'').trim().slice(0,30)]);r.json({ok:1})}
 catch{r.status(409).json({error:'That email is already used'})}}));
app.delete('/api/users/:id',auth('admin'),W(async(q,r)=>{if(+q.params.id===q.user.id)return r.status(400).json({error:'You cannot remove yourself'});await db.query('delete from users where id=$1',[q.params.id]);r.json({ok:1})}));

(async()=>{await db.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
 for(const[k,v]of Object.entries({name:'HOME TASTE FOODS',address:'Kansanga Ggabba Road, next to KIU',phones:'0750541790 / 0788507153',mtn:'320155',airtel:'1355266',packing:'1000',momo_fee:'1000',logo:'',hide_soldout:'0',delivery_fee:'2000',whatsapp:'256750541790',email:'',facebook:'https://www.facebook.com/share/1Cqi3U1LMu/',instagram:'https://www.instagram.com/home.taste.foods?bqrl=dnFjeWthNnprNHRk',founded:'',sides:'Rice,Posho,Matooke,Pumpkin',gmaps:'',live:'0'}))await db.query('insert into settings(key,value) values($1,$2) on conflict(key) do nothing',[k,v]);
 if(!(await db.query('select 1 from users limit 1')).rows.length)await db.query("insert into users(name,email,password_hash,role) values('Admin',$1,$2,'admin')",[process.env.ADMIN_EMAIL||'admin@hometaste.local',bcrypt.hashSync(process.env.ADMIN_PASSWORD||'ChangeMe123',10)]);
 if(!(await db.query('select 1 from products limit 1')).rows.length)for(const[n,c,p]of[['Chicken & Chips','Meals',18000],['Beef Stew & Rice','Meals',12000],['Pilau','Meals',12000],['Matooke & G-nut Sauce','Meals',10000],['Burger','Fast Food',15000],['Chicken Wings','Fast Food',15000],['Rolex','Fast Food',3000],['Chips','Sides',5000],['Chapati','Sides',1000],['Fresh Juice','Drinks',4000],['Soda','Drinks',2000],['Tea','Drinks',2000]])await db.query('insert into products(name,category,price) values($1,$2,$3)',[n,c,p]);
 await db.query('insert into categories(name) select distinct category from products on conflict do nothing');
 let VK=await cfg();if(!VK.vapid_pub){const k=webpush.generateVAPIDKeys();await db.query("insert into settings(key,value) values('vapid_pub',$1),('vapid_priv',$2) on conflict(key) do nothing",[k.publicKey,k.privateKey]);VK=await cfg()}
 VAPID_PUB=VK.vapid_pub;webpush.setVapidDetails('mailto:'+(process.env.ADMIN_EMAIL||'admin@hometaste.example.com'),VK.vapid_pub,VK.vapid_priv);
 if(!VK.pack_migrated2){await db.query("update products set pack=false where name ~* '\\y(sodas?|juices?|teas?|waters?)\\y'");await db.query("insert into settings(key,value) values('pack_migrated2','1') on conflict(key) do nothing")}
 if(!VK.pack_migrated){await db.query("update products set pack=false where name ~* 'soda|juice|water'");await db.query("insert into settings(key,value) values('pack_migrated','1') on conflict(key) do nothing")}
 if(!VK.pack_migrated3){await db.query("update products set pack=false where name ~* 'rolex'");await db.query("insert into settings(key,value) values('pack_migrated3','1') on conflict(key) do nothing")}
 if(!VK.local_migrated){await db.query("update products set local=true where category ~* 'local'");await db.query("update categories set pack_fee=500 where name ~* 'side' and pack_fee is null");await db.query("insert into settings(key,value) values('local_migrated','1') on conflict(key) do nothing")}
 if(!VK.opt_migrated){await db.query("update products set opt_name='Scoops',opt_min=1,opt_max=5,opt_default=1,opt_free=1,opt_price=0 where name ~* 'ice ?cream' and coalesce(opt_max,0)=0");await db.query("update products set opt_name='Spoons of sugar',opt_min=0,opt_max=5,opt_default=1,opt_free=5,opt_price=0 where name ~* $1 and coalesce(opt_max,0)=0",['\\y(teas?|chai)\\y']);await db.query("insert into settings(key,value) values('opt_migrated','1') on conflict(key) do nothing")}
 app.listen(process.env.PORT||3000,()=>console.log('POS running'))})().catch(e=>{console.error(e);process.exit(1)});
