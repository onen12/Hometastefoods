const express=require('express'),{Pool}=require('pg'),bcrypt=require('bcryptjs'),crypto=require('crypto'),fs=require('fs'),path=require('path'),webpush=require('web-push');
const app=express();app.use(express.json({limit:'2mb'}));app.use(express.static(path.join(__dirname,'public'),{setHeaders:(r,p)=>{if(p.endsWith('sw.js'))r.setHeader('Cache-Control','no-cache')}}));
const db=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
const mac=b=>crypto.createHmac('sha256',SECRET).update(b).digest('base64url');
const sign=u=>{const b=Buffer.from(JSON.stringify({id:u.id,role:u.role,exp:Date.now()+12*36e5})).toString('base64url');return b+'.'+mac(b)};
const verify=t=>{try{const[b,s]=t.split('.');if(!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(mac(b))))return null;const p=JSON.parse(Buffer.from(b,'base64url'));return p.exp>Date.now()?p:null}catch{return null}};
const tokOf=q=>verify((q.headers.authorization||'').slice(7));
const any=(q,r,n)=>{const u=tokOf(q);if(!u)return r.status(401).json({error:'Please sign in'});q.user=u;n()};
const auth=role=>(q,r,n)=>{const u=tokOf(q);if(!u||(role?u.role!==role:u.role==='customer'))return r.status(u?403:401).json({error:'Not allowed'});q.user=u;n()};
const W=f=>(q,r)=>f(q,r).catch(e=>{if(e.code===400)return r.status(400).json({error:e.message});console.error(e);r.status(500).json({error:'Server error'})});
const K="(now() at time zone 'Africa/Kampala')::date",PD="(paid_at at time zone 'Africa/Kampala')::date",PM=['cash','mtn','airtel'];
const cfg=async()=>Object.fromEntries((await db.query('select key,value from settings')).rows.map(x=>[x.key,x.value]));
const pub=o=>{const{vapid_priv,...x}=o;return x};
const PSEL=`select p.*,o.title as offer_title,coalesce(o.percent,0) as offer_percent,(p.price-round(p.price*coalesce(o.percent,0)/100.0))::int as eff_price from products p left join (select distinct on(product_id) product_id,title,percent from offers where active and (start_date is null or start_date<=${K}) and (end_date is null or end_date>=${K}) and (coalesce(weekdays,'')='' or extract(dow from ${K})::int::text=any(string_to_array(weekdays,','))) order by product_id,percent desc) o on o.product_id=p.id`;
let VAPID_PUB='';
const pushAll=async p=>{const{rows}=await db.query('select * from push_subs');await Promise.all(rows.map(s=>webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify(p),{TTL:90,urgency:'high'}).catch(e=>{if([404,410].includes(e.statusCode))return db.query('delete from push_subs where id=$1',[s.id])})))};
function ringOrder(o){let n=0;const go=async()=>{try{const{rows:[x]}=await db.query('select stage,status from orders where id=$1',[o.id]);if(!x||x.stage!='received'||x.status=='cancelled'||n++>=5)return;
 await pushAll({title:`New order #${o.id}`,body:`${o.customer} - ${o.items.reduce((t,i)=>t+i.qty,0)} plate(s) - UGX ${Math.round(o.total).toLocaleString()}`,tag:'order-'+o.id,renotify:true,url:'/staff'});setTimeout(go,12000)}catch(e){console.error(e)}};go()}
const CLEAN="delete from images where created_at<now()-interval '1 hour' and id not in (select image_id from products where image_id is not null union select image_id from categories where image_id is not null union select avatar_id from users where avatar_id is not null union select avatar_id from customers where avatar_id is not null union select value::int from settings where key='logo' and value~'^[0-9]+$')";

/* images + settings */
app.post('/api/upload',any,W(async(q,r)=>{const m=/^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(q.body.data||'');if(!m)return r.status(400).json({error:'Please choose a JPG or PNG image'});
 const buf=Buffer.from(m[2],'base64');if(buf.length>700000)return r.status(400).json({error:'Image is too large'});
 const{rows:[x]}=await db.query('insert into images(mime,data) values($1,$2) returning id',['image/'+m[1],buf]);db.query(CLEAN).catch(()=>{});r.json({id:x.id})}));
app.get('/img/:id',W(async(q,r)=>{const{rows:[x]}=await db.query('select mime,data from images where id=$1',[+q.params.id||0]);if(!x)return r.sendStatus(404);r.set({'Content-Type':x.mime,'Cache-Control':'public,max-age=31536000,immutable'}).send(x.data)}));
app.get('/api/settings',W(async(q,r)=>r.json(pub(await cfg()))));
app.put('/api/settings',auth('admin'),W(async(q,r)=>{for(const k of['name','address','phones','mtn','airtel','packing','momo_fee','logo','hide_soldout'])if(q.body[k]!==undefined)await db.query('insert into settings(key,value) values($1,$2) on conflict(key) do update set value=excluded.value',[k,String(q.body[k])]);r.json(pub(await cfg()))}));

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
prof('users','/api/me');prof('customers','/api/c/me','customer');

/* categories + products */
app.get('/api/categories',W(async(q,r)=>r.json((await db.query('select * from categories order by name')).rows)));
app.post('/api/categories',auth('admin'),W(async(q,r)=>{const n=(q.body.name||'').trim();if(!n)return r.status(400).json({error:'Enter a category name'});
 try{r.json((await db.query('insert into categories(name,image_id) values($1,$2) returning *',[n,q.body.image_id||null])).rows[0])}catch{r.status(409).json({error:'That category already exists'})}}));
app.put('/api/categories/:id',auth('admin'),W(async(q,r)=>r.json((await db.query('update categories set image_id=$1 where id=$2 returning *',[q.body.image_id||null,q.params.id])).rows[0])));
app.delete('/api/categories/:id',auth('admin'),W(async(q,r)=>{const{rows:[n]}=await db.query('select count(*)::int as n from products p join categories c on c.name=p.category where c.id=$1',[q.params.id]);
 if(n.n)return r.status(400).json({error:'This category still has items. Move or delete them first.'});await db.query('delete from categories where id=$1',[q.params.id]);r.json({ok:1})}));
app.get('/api/products',auth(),W(async(q,r)=>r.json((await db.query(PSEL+' order by p.category,p.name')).rows)));
app.get('/api/c/menu',W(async(q,r)=>{const h=(await cfg()).hide_soldout=='1';r.json((await db.query(`select * from (${PSEL}) x where x.active ${h?'and x.available and (x.stock is null or x.stock>0)':''} order by x.category,x.name`)).rows)}));
app.post('/api/products',auth('admin'),W(async(q,r)=>{const{name,category,price}=q.body;if(!name||!(+price>=0))return r.status(400).json({error:'Name and price required'});
 r.json((await db.query('insert into products(name,category,price,pack) values($1,$2,$3,$4) returning *',[name.trim(),(category||'General').trim(),Math.round(+price),!/\b(sodas?|juices?|teas?|waters?)\b/i.test(name)])).rows[0])}));
app.put('/api/products/:id',auth('admin'),W(async(q,r)=>{const{name,category,price,active,image_id,pack}=q.body;
 r.json((await db.query('update products set name=$1,category=$2,price=$3,active=$4,image_id=$5,pack=$6 where id=$7 returning *',[name,category,Math.round(+price),active!==false,image_id||null,pack!==false,q.params.id])).rows[0])}));
app.delete('/api/products/:id',auth('admin'),W(async(q,r)=>{await db.query('delete from products where id=$1',[q.params.id]);r.json({ok:1})}));

/* orders */
async function makeOrder(o){const{rows:ps}=await db.query(`select * from (${PSEL}) x where x.id=any($1) and x.active`,[(o.items||[]).map(i=>+i.id)]);
 const L=(o.items||[]).map(i=>{const p=ps.find(x=>x.id==i.id);return p&&{p,qty:Math.max(1,Math.min(99,+i.qty|0))}}).filter(Boolean);
 if(!L.length)throw Object.assign(new Error('Your cart is empty or the items are unavailable'),{code:400});
 for(const l of L)if(!l.p.available||(l.p.stock!=null&&l.p.stock<l.qty))throw Object.assign(new Error(l.p.available&&l.p.stock>0?`Only ${l.p.stock} plate(s) of ${l.p.name} left`:`Sorry, ${l.p.name} is sold out`),{code:400});
 const type=o.type=='takeaway'?'takeaway':'dine_in',plates=L.filter(l=>l.p.pack).reduce((s,l)=>s+l.qty,0),C=await cfg(),pack=type=='takeaway'?(+C.packing||0)*plates:0,mf=['mtn','airtel'].includes(o.method)?(+C.momo_fee||0):0,total=L.reduce((s,l)=>s+l.p.eff_price*l.qty,0)+pack+mf,paid=!!o.pay&&PM.includes(o.method),c=await db.connect();
 try{await c.query('begin');
  const{rows:[x]}=await c.query(`insert into orders(customer,phone,table_no,total,status,method,paid_at,user_id,customer_id,source,pay_pref,pay_ref,order_type,packing,momo_fee) values($1,$2,$3,$4,$5,$6,${paid?'now()':'null'},$7,$8,$9,$10,$11,$12,$13,$14) returning *`,[(o.customer||'').trim()||'Walk-in',o.phone||'',(o.table||'').trim(),total,paid?'paid':'open',paid?o.method:null,o.user_id||null,o.customer_id||null,o.source||'pos',paid?null:(o.method||null),'',type,pack,mf]);
  for(const l of L){const u=await c.query('update products set stock=stock-$1 where id=$2 and available and (stock is null or stock>=$1) returning id',[l.qty,l.p.id]);
   if(!u.rowCount)throw Object.assign(new Error(`Sorry, ${l.p.name} just ran out`),{code:400});
   await c.query('insert into order_items(order_id,product_id,name,price,qty) values($1,$2,$3,$4,$5)',[x.id,l.p.id,l.p.name,l.p.eff_price,l.qty])}
  await c.query('commit');return{...x,items:L.map(l=>({name:l.p.name,price:l.p.eff_price,qty:l.qty}))}}
 catch(e){await c.query('rollback');throw e}finally{c.release()}}
app.post('/api/orders',auth(),W(async(q,r)=>r.json(await makeOrder({...q.body,pay:true,user_id:q.user.id}))));
app.get('/api/orders',auth(),W(async(q,r)=>{const s=q.query.status;
 r.json((await db.query(`select o.*,u.name as cashier,(select json_agg(json_build_object('name',i.name,'price',i.price,'qty',i.qty)) from order_items i where i.order_id=o.id) as items from orders o left join users u on u.id=o.user_id ${s?'where o.status=$1':''} order by o.id desc limit 100`,s?[s]:[])).rows)}));
app.post('/api/orders/:id/pay',auth(),W(async(q,r)=>{if(!PM.includes(q.body.method))return r.status(400).json({error:'Choose a payment method'});
 const f=['mtn','airtel'].includes(q.body.method)?(+(await cfg()).momo_fee||0):0;
 const{rows:[o]}=await db.query("update orders set status='paid',method=$1,paid_at=now(),total=total-coalesce(momo_fee,0)+$3::int,momo_fee=$3::int where id=$2 and status='open' returning *",[q.body.method,q.params.id,f]);
 o?r.json(o):r.status(409).json({error:'Order is not open'})}));

const STAGES=['received','preparing','ready','delivering','done'];
app.post('/api/orders/:id/stage',auth(),W(async(q,r)=>{if(!STAGES.includes(q.body.stage))return r.status(400).json({error:'Unknown stage'});r.json((await db.query("update orders set stage=$1 where id=$2 and status<>'cancelled' returning *",[q.body.stage,q.params.id])).rows[0]||{})}));
app.put('/api/products/:id/stock',auth('admin'),W(async(q,r)=>{const s=q.body.stock===''||q.body.stock==null?null:Math.max(0,Math.round(+q.body.stock));r.json((await db.query('update products set available=$1,stock=$2 where id=$3 returning *',[q.body.available!==false,s,q.params.id])).rows[0])}));
app.post('/api/orders/:id/cancel',auth(),W(async(q,r)=>{const u=await db.query("update orders set status='cancelled' where id=$1 and status='open' returning id",[q.params.id]);if(u.rowCount)await db.query('update products p set stock=p.stock+i.qty from order_items i where i.order_id=$1 and i.product_id=p.id and p.stock is not null',[q.params.id]);r.json({ok:1})}));

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
 const{items,method,note,type}=q.body;if(!PM.includes(method))return r.status(400).json({error:'Choose how you will pay'});
  const o=await makeOrder({items,method,type,customer:u.name,phone:u.phone,table:note,customer_id:u.id,source:'online'});ringOrder(o);r.json(o)}));
app.get('/api/c/orders',auth('customer'),W(async(q,r)=>r.json((await db.query(`select o.id,o.total,o.status,o.method,o.pay_pref,o.order_type,o.stage,o.created_at,(select json_agg(json_build_object('name',i.name,'qty',i.qty)) from order_items i where i.order_id=o.id) as items from orders o where customer_id=$1 order by id desc limit 20`,[q.user.id])).rows)));

/* offers, push, app manifests */
app.get('/api/offers',auth('admin'),W(async(q,r)=>r.json((await db.query("select o.id,o.product_id,o.title,o.percent,to_char(o.start_date,'YYYY-MM-DD') as start_date,to_char(o.end_date,'YYYY-MM-DD') as end_date,o.weekdays,o.active,p.name as product from offers o join products p on p.id=o.product_id order by o.id desc")).rows)));
app.post('/api/offers',auth('admin'),W(async(q,r)=>{const{product_id,title,percent,start_date,end_date,weekdays}=q.body,pc=Math.round(+percent);if(!product_id||!(pc>=1&&pc<=90))return r.status(400).json({error:'Choose a dish and a discount between 1% and 90%'});
 r.json((await db.query('insert into offers(product_id,title,percent,start_date,end_date,weekdays) values($1,$2,$3,$4,$5,$6) returning id',[product_id,(title||'Special offer').trim(),pc,start_date||null,end_date||null,weekdays||''])).rows[0])}));
app.put('/api/offers/:id/toggle',auth('admin'),W(async(q,r)=>r.json((await db.query('update offers set active=not active where id=$1 returning id',[q.params.id])).rows[0])));
app.delete('/api/offers/:id',auth('admin'),W(async(q,r)=>{await db.query('delete from offers where id=$1',[q.params.id]);r.json({ok:1})}));
app.get('/api/push/key',auth(),(q,r)=>r.json({key:VAPID_PUB}));
app.post('/api/push/subscribe',auth(),W(async(q,r)=>{const s=q.body;if(!s||!s.endpoint||!s.keys)return r.status(400).json({error:'Bad subscription'});
 await db.query('insert into push_subs(user_id,endpoint,p256dh,auth) values($1,$2,$3,$4) on conflict(endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth',[q.user.id,s.endpoint,s.keys.p256dh,s.keys.auth]);r.json({ok:1})}));
app.post('/api/push/test',auth(),W(async(q,r)=>{await pushAll({title:'Order alerts are on',body:'You will be alerted when a customer orders.',tag:'test',url:'/staff'});r.json({ok:1})}));
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
app.get('/api/users',auth('admin'),W(async(q,r)=>r.json((await db.query('select id,name,email,role,avatar_id from users order by id')).rows)));
app.post('/api/users',auth('admin'),W(async(q,r)=>{const{name,email,password,role}=q.body;if(!name||!email||(password||'').length<8)return r.status(400).json({error:'Name, email and a password of 8+ characters are required'});
 try{await db.query('insert into users(name,email,password_hash,role) values($1,$2,$3,$4)',[name.trim(),email.trim(),bcrypt.hashSync(password,10),role=='admin'?'admin':'cashier']);r.json({ok:1})}
 catch{r.status(409).json({error:'That email is already used'})}}));
app.delete('/api/users/:id',auth('admin'),W(async(q,r)=>{if(+q.params.id===q.user.id)return r.status(400).json({error:'You cannot remove yourself'});await db.query('delete from users where id=$1',[q.params.id]);r.json({ok:1})}));

(async()=>{await db.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
 for(const[k,v]of Object.entries({name:'HOME TASTE FOODS',address:'Kansanga Ggabba Road, next to KIU',phones:'0750541790 / 0788507153',mtn:'320155',airtel:'1355266',packing:'1000',momo_fee:'1000',logo:'',hide_soldout:'0'}))await db.query('insert into settings(key,value) values($1,$2) on conflict(key) do nothing',[k,v]);
 if(!(await db.query('select 1 from users limit 1')).rows.length)await db.query("insert into users(name,email,password_hash,role) values('Admin',$1,$2,'admin')",[process.env.ADMIN_EMAIL||'admin@hometaste.local',bcrypt.hashSync(process.env.ADMIN_PASSWORD||'ChangeMe123',10)]);
 if(!(await db.query('select 1 from products limit 1')).rows.length)for(const[n,c,p]of[['Chicken & Chips','Meals',18000],['Beef Stew & Rice','Meals',12000],['Pilau','Meals',12000],['Matooke & G-nut Sauce','Meals',10000],['Burger','Fast Food',15000],['Chicken Wings','Fast Food',15000],['Rolex','Fast Food',3000],['Chips','Sides',5000],['Chapati','Sides',1000],['Fresh Juice','Drinks',4000],['Soda','Drinks',2000],['Tea','Drinks',2000]])await db.query('insert into products(name,category,price) values($1,$2,$3)',[n,c,p]);
 await db.query('insert into categories(name) select distinct category from products on conflict do nothing');
 let VK=await cfg();if(!VK.vapid_pub){const k=webpush.generateVAPIDKeys();await db.query("insert into settings(key,value) values('vapid_pub',$1),('vapid_priv',$2) on conflict(key) do nothing",[k.publicKey,k.privateKey]);VK=await cfg()}
 VAPID_PUB=VK.vapid_pub;webpush.setVapidDetails('mailto:'+(process.env.ADMIN_EMAIL||'admin@hometaste.example.com'),VK.vapid_pub,VK.vapid_priv);
 if(!VK.pack_migrated2){await db.query("update products set pack=false where name ~* '\\y(sodas?|juices?|teas?|waters?)\\y'");await db.query("insert into settings(key,value) values('pack_migrated2','1') on conflict(key) do nothing")}
 if(!VK.pack_migrated){await db.query("update products set pack=false where name ~* 'soda|juice|water'");await db.query("insert into settings(key,value) values('pack_migrated','1') on conflict(key) do nothing")}
 app.listen(process.env.PORT||3000,()=>console.log('POS running'))})().catch(e=>{console.error(e);process.exit(1)});
