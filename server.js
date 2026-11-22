const express=require('express'),{Pool}=require('pg'),bcrypt=require('bcryptjs'),crypto=require('crypto'),fs=require('fs'),path=require('path');
const app=express();app.use(express.json());app.use(express.static(path.join(__dirname,'public')));
const db=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString('hex');
const mac=b=>crypto.createHmac('sha256',SECRET).update(b).digest('base64url');
const sign=u=>{const b=Buffer.from(JSON.stringify({id:u.id,role:u.role,exp:Date.now()+12*36e5})).toString('base64url');return b+'.'+mac(b)};
const verify=t=>{try{const[b,s]=t.split('.');if(!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(mac(b))))return null;const p=JSON.parse(Buffer.from(b,'base64url'));return p.exp>Date.now()?p:null}catch{return null}};
const auth=role=>(q,r,n)=>{const u=verify((q.headers.authorization||'').slice(7));if(!u||(role?u.role!==role:u.role==='customer'))return r.status(u?403:401).json({error:'Not allowed'});q.user=u;n()};
const W=f=>(q,r)=>f(q,r).catch(e=>{if(e.code===400)return r.status(400).json({error:e.message});console.error(e);r.status(500).json({error:'Server error'})});
const K="(now() at time zone 'Africa/Kampala')::date",PD="(paid_at at time zone 'Africa/Kampala')::date";

app.post('/api/login',W(async(q,r)=>{const{rows:[u]}=await db.query('select * from users where lower(email)=lower($1)',[q.body.email||'']);
 if(!u||!bcrypt.compareSync(q.body.password||'',u.password_hash))return r.status(401).json({error:'Wrong email or password'});
 r.json({token:sign(u),user:{id:u.id,name:u.name,role:u.role}})}));

app.get('/api/products',auth(),W(async(q,r)=>r.json((await db.query('select * from products order by category,name')).rows)));
app.post('/api/products',auth('admin'),W(async(q,r)=>{const{name,category,price}=q.body;if(!name||!(+price>=0))return r.status(400).json({error:'Name and price required'});
 r.json((await db.query('insert into products(name,category,price) values($1,$2,$3) returning *',[name.trim(),(category||'General').trim(),Math.round(+price)])).rows[0])}));
app.put('/api/products/:id',auth('admin'),W(async(q,r)=>{const{name,category,price,active}=q.body;
 r.json((await db.query('update products set name=$1,category=$2,price=$3,active=$4 where id=$5 returning *',[name,category,Math.round(+price),active!==false,q.params.id])).rows[0])}));
app.delete('/api/products/:id',auth('admin'),W(async(q,r)=>{await db.query('delete from products where id=$1',[q.params.id]);r.json({ok:1})}));

async function makeOrder(o){const{rows:ps}=await db.query('select * from products where id=any($1) and active',[(o.items||[]).map(i=>+i.id)]);
 const L=(o.items||[]).map(i=>{const p=ps.find(x=>x.id==i.id);return p&&{p,qty:Math.max(1,Math.min(99,+i.qty|0))}}).filter(Boolean);
 if(!L.length)throw Object.assign(new Error('Your cart is empty or the items are unavailable'),{code:400});
 const total=L.reduce((s,l)=>s+l.p.price*l.qty,0),paid=!!o.pay&&['cash','momo'].includes(o.method),c=await db.connect();
 try{await c.query('begin');
  const{rows:[x]}=await c.query(`insert into orders(customer,phone,table_no,total,status,method,paid_at,user_id,customer_id,source,pay_pref,pay_ref) values($1,$2,$3,$4,$5,$6,${paid?'now()':'null'},$7,$8,$9,$10,$11) returning *`,[(o.customer||'').trim()||'Walk-in',o.phone||'',(o.table||'').trim(),total,paid?'paid':'open',paid?o.method:null,o.user_id||null,o.customer_id||null,o.source||'pos',paid?null:(o.method||null),(o.ref||'').trim()]);
  for(const l of L)await c.query('insert into order_items(order_id,product_id,name,price,qty) values($1,$2,$3,$4,$5)',[x.id,l.p.id,l.p.name,l.p.price,l.qty]);
  await c.query('commit');return{...x,items:L.map(l=>({name:l.p.name,price:l.p.price,qty:l.qty}))}}
 catch(e){await c.query('rollback');throw e}finally{c.release()}}
app.post('/api/orders',auth(),W(async(q,r)=>r.json(await makeOrder({...q.body,pay:true,user_id:q.user.id}))));

/* ---- customer portal ---- */
const ph=s=>String(s||'').replace(/[^\d+]/g,'');
app.get('/order',(q,r)=>r.sendFile(path.join(__dirname,'public','order.html')));
app.get('/api/c/info',(q,r)=>r.json({momo:process.env.MOMO_NUMBER||'',momoName:process.env.MOMO_NAME||'Home Taste Foods'}));
app.get('/api/c/menu',W(async(q,r)=>r.json((await db.query('select id,name,category,price from products where active order by category,name')).rows)));
app.post('/api/c/register',W(async(q,r)=>{const{name,password}=q.body,phone=ph(q.body.phone);
 if(!name||phone.length<9||(password||'').length<6)return r.status(400).json({error:'Enter your name, a valid phone number and a password of 6+ characters'});
 try{const{rows:[u]}=await db.query('insert into customers(name,phone,password_hash) values($1,$2,$3) returning id,name,phone',[name.trim(),phone,bcrypt.hashSync(password,10)]);r.json({token:sign({id:u.id,role:'customer'}),user:u})}
 catch{r.status(409).json({error:'That phone number already has an account. Please sign in.'})}}));
app.post('/api/c/login',W(async(q,r)=>{const{rows:[u]}=await db.query('select * from customers where phone=$1',[ph(q.body.phone)]);
 if(!u||!bcrypt.compareSync(q.body.password||'',u.password_hash))return r.status(401).json({error:'Wrong phone number or password'});
 r.json({token:sign({id:u.id,role:'customer'}),user:{id:u.id,name:u.name,phone:u.phone}})}));
app.post('/api/c/orders',auth('customer'),W(async(q,r)=>{const{rows:[u]}=await db.query('select id,name,phone from customers where id=$1',[q.user.id]);if(!u)return r.status(401).json({error:'Please sign in again'});
 const{items,method,ref,note}=q.body;if(!['cash','momo'].includes(method))return r.status(400).json({error:'Choose Cash or Mobile Money'});
 r.json(await makeOrder({items,method,ref,customer:u.name,phone:u.phone,table:note,customer_id:u.id,source:'online'}))}));
app.get('/api/c/orders',auth('customer'),W(async(q,r)=>r.json((await db.query(`select o.id,o.total,o.status,o.method,o.pay_pref,o.created_at,(select json_agg(json_build_object('name',i.name,'qty',i.qty)) from order_items i where i.order_id=o.id) as items from orders o where customer_id=$1 order by id desc limit 20`,[q.user.id])).rows)));

app.get('/api/orders',auth(),W(async(q,r)=>{const s=q.query.status;
 r.json((await db.query(`select o.*,u.name as cashier,(select json_agg(json_build_object('name',i.name,'price',i.price,'qty',i.qty)) from order_items i where i.order_id=o.id) as items from orders o left join users u on u.id=o.user_id ${s?'where o.status=$1':''} order by o.id desc limit 100`,s?[s]:[])).rows)}));
app.post('/api/orders/:id/pay',auth(),W(async(q,r)=>{if(!['cash','momo'].includes(q.body.method))return r.status(400).json({error:'Choose Cash or Mobile Money'});
 const{rows:[o]}=await db.query("update orders set status='paid',method=$1,paid_at=now() where id=$2 and status='open' returning *",[q.body.method,q.params.id]);
 o?r.json(o):r.status(409).json({error:'Order is not open'})}));
app.post('/api/orders/:id/cancel',auth(),W(async(q,r)=>{await db.query("update orders set status='cancelled' where id=$1 and status='open'",[q.params.id]);r.json({ok:1})}));

app.get('/api/reports',auth('admin'),W(async(q,r)=>{const t=`status='paid' and ${PD}=${K}`;
 const[a,b,c,d]=await Promise.all([
  db.query(`select count(*)::int as n,coalesce(sum(total),0)::int as sum from orders where ${t}`),
  db.query(`select method,coalesce(sum(total),0)::int as sum from orders where ${t} group by 1`),
  db.query(`select i.name,sum(i.qty)::int as qty from order_items i join orders o on o.id=i.order_id where o.status='paid' and o.paid_at>now()-interval '30 days' group by 1 order by 2 desc limit 5`),
  db.query(`select to_char(d,'Dy') as day,coalesce(sum(o.total),0)::int as sum from generate_series((${K}-6)::timestamp,${K}::timestamp,'1 day') d left join orders o on o.status='paid' and ${PD.replace('paid_at','o.paid_at')}=d::date group by d order by d`)]);
 r.json({today:a.rows[0],methods:b.rows,top:c.rows,week:d.rows})}));

app.get('/api/users',auth('admin'),W(async(q,r)=>r.json((await db.query('select id,name,email,role from users order by id')).rows)));
app.post('/api/users',auth('admin'),W(async(q,r)=>{const{name,email,password,role}=q.body;if(!name||!email||(password||'').length<8)return r.status(400).json({error:'Name, email and a password of 8+ characters are required'});
 try{await db.query('insert into users(name,email,password_hash,role) values($1,$2,$3,$4)',[name.trim(),email.trim(),bcrypt.hashSync(password,10),role=='admin'?'admin':'cashier']);r.json({ok:1})}
 catch{r.status(409).json({error:'That email is already used'})}}));
app.delete('/api/users/:id',auth('admin'),W(async(q,r)=>{if(+q.params.id===q.user.id)return r.status(400).json({error:'You cannot remove yourself'});await db.query('delete from users where id=$1',[q.params.id]);r.json({ok:1})}));

(async()=>{await db.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
 if(!(await db.query('select 1 from users limit 1')).rows.length)await db.query("insert into users(name,email,password_hash,role) values('Admin',$1,$2,'admin')",[process.env.ADMIN_EMAIL||'admin@hometaste.local',bcrypt.hashSync(process.env.ADMIN_PASSWORD||'ChangeMe123',10)]);
 if(!(await db.query('select 1 from products limit 1')).rows.length)for(const[n,c,p]of[['Chicken & Chips','Meals',18000],['Beef Stew & Rice','Meals',12000],['Pilau','Meals',12000],['Matooke & G-nut Sauce','Meals',10000],['Burger','Fast Food',15000],['Chicken Wings','Fast Food',15000],['Rolex','Fast Food',3000],['Chips','Sides',5000],['Chapati','Sides',1000],['Fresh Juice','Drinks',4000],['Soda','Drinks',2000],['Tea','Drinks',2000]])await db.query('insert into products(name,category,price) values($1,$2,$3)',[n,c,p]);
 app.listen(process.env.PORT||3000,()=>console.log('POS running'))})().catch(e=>{console.error(e);process.exit(1)});
