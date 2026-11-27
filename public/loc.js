/* Location picker: Google Maps when an API key is set in Settings, otherwise Leaflet + OpenStreetMap */
const LOC={el:null,map:null,mk:null,g:false,cb:null,loading:null},KLA={lat:0.3476,lng:32.5825};
const loadJs=src=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=res;s.onerror=()=>rej(new Error('Could not load the map'));document.head.appendChild(s)});
const leaflet=()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';document.head.appendChild(l);return loadJs('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js')};
function locLib(){if(LOC.loading)return LOC.loading;const k=(S.cfg&&S.cfg.gmaps)||'';
 LOC.loading=(k?new Promise((res,rej)=>{window.__gmReady=res;loadJs('https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(k)+'&callback=__gmReady').catch(rej)}).then(()=>{LOC.g=true}).catch(()=>leaflet()):leaflet()).catch(e=>{LOC.loading=null;throw e});return LOC.loading}
async function locMount(slot,cb){LOC.cb=cb;if(!LOC.el){LOC.el=document.createElement('div');LOC.el.style.cssText='width:100%;height:100%'}slot.appendChild(LOC.el);
 try{await locLib()}catch(e){slot.innerHTML='<small style="padding:12px;display:block">The map could not load. Please type your address below.</small>';return}
 if(!LOC.map){const has=S.lat!=null&&S.lng!=null,c=has?{lat:S.lat,lng:S.lng}:KLA;
  if(LOC.g){LOC.map=new google.maps.Map(LOC.el,{center:c,zoom:has?17:13,disableDefaultUI:true,zoomControl:true,gestureHandling:'greedy'});LOC.mk=new google.maps.Marker({map:LOC.map,position:c,draggable:true,visible:has});
   LOC.mk.addListener('dragend',()=>{const p=LOC.mk.getPosition();LOC.cb(p.lat(),p.lng())});LOC.map.addListener('click',e=>{locSet(e.latLng.lat(),e.latLng.lng());LOC.cb(e.latLng.lat(),e.latLng.lng())})}
  else{LOC.map=L.map(LOC.el,{zoomControl:true}).setView([c.lat,c.lng],has?17:13);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(LOC.map);
   LOC.mk=L.marker([c.lat,c.lng],{draggable:true});if(has)LOC.mk.addTo(LOC.map);LOC.mk.on('dragend',()=>{const p=LOC.mk.getLatLng();LOC.cb(p.lat,p.lng)});LOC.map.on('click',e=>{locSet(e.latlng.lat,e.latlng.lng);LOC.cb(e.latlng.lat,e.latlng.lng)})}
 }else setTimeout(()=>{LOC.g?google.maps.event.trigger(LOC.map,'resize'):LOC.map.invalidateSize()},60)}
function locSet(lat,lng){if(!LOC.map)return;if(LOC.g){LOC.mk.setPosition({lat,lng});LOC.mk.setVisible(true);LOC.map.setCenter({lat,lng});LOC.map.setZoom(17)}else{LOC.mk.setLatLng([lat,lng]);if(!LOC.map.hasLayer(LOC.mk))LOC.mk.addTo(LOC.map);LOC.map.setView([lat,lng],17)}}
const locAddr=async(lat,lng)=>{try{if(LOC.g){const r=await new google.maps.Geocoder().geocode({location:{lat,lng}});return r.results&&r.results[0]?r.results[0].formatted_address:''}const j=await(await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat='+lat+'&lon='+lng)).json();return(j.display_name||'').split(',').slice(0,4).join(',').trim()}catch{return''}};
const locFind=async q=>{try{if(LOC.g){const r=await new google.maps.Geocoder().geocode({address:q+', Uganda'}),l=r.results&&r.results[0]&&r.results[0].geometry.location;return l?{lat:l.lat(),lng:l.lng()}:null}const j=await(await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ug&q='+encodeURIComponent(q))).json();return j[0]?{lat:+j[0].lat,lng:+j[0].lon}:null}catch{return null}};
const locGps=()=>new Promise((res,rej)=>{if(!navigator.geolocation)return rej(new Error('Your device does not support location'));navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude}),e=>rej(new Error(e.code==1?'Location is blocked. Allow location access in your browser settings, or tap the map to drop a pin.':'Could not get your location. Tap the map to drop a pin.')),{enableHighAccuracy:true,timeout:15000,maximumAge:30000})});
/* live tracking map (customer pin + rider + trail) */
async function trackMapInit(el){await locLib();
 if(LOC.g){const m=new google.maps.Map(el,{center:KLA,zoom:13,disableDefaultUI:true,zoomControl:true,gestureHandling:'greedy'});let c=null,rd=null,pl=null,fit=false;
  return{refit(){fit=false},update(client,rider,trail){const b=new google.maps.LatLngBounds();
   if(client){if(!c)c=new google.maps.Marker({map:m,position:client,label:'C',title:'Customer'});c.setPosition(client);b.extend(client)}
   if(rider){if(!rd)rd=new google.maps.Marker({map:m,position:rider,label:'R',title:'Rider',zIndex:9});rd.setPosition(rider);b.extend(rider)}
   if(trail&&trail.length>1){const path=trail.map(p=>({lat:p[0],lng:p[1]}));if(!pl)pl=new google.maps.Polyline({map:m,path,strokeColor:'#ff6a13',strokeWeight:4});else pl.setPath(path)}
   if(!b.isEmpty()&&!fit){m.fitBounds(b,40);fit=true}}}}
 const m=L.map(el).setView([KLA.lat,KLA.lng],13);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(m);
 let c=null,rd=null,pl=null,fit=false;const mk=(cls,t)=>L.divIcon({className:'',html:'<div class="mk '+cls+'">'+t+'</div>',iconSize:[30,30],iconAnchor:[15,15]});
 return{refit(){fit=false},update(client,rider,trail){const pts=[];
  if(client){if(!c)c=L.marker([client.lat,client.lng],{icon:mk('mc','C')}).addTo(m);else c.setLatLng([client.lat,client.lng]);pts.push([client.lat,client.lng])}
  if(rider){if(!rd)rd=L.marker([rider.lat,rider.lng],{icon:mk('mr','R'),zIndexOffset:500}).addTo(m);else rd.setLatLng([rider.lat,rider.lng]);pts.push([rider.lat,rider.lng])}
  if(trail&&trail.length>1){if(!pl)pl=L.polyline(trail,{color:'#ff6a13',weight:4}).addTo(m);else pl.setLatLngs(trail)}
  if(pts.length&&!fit){m.invalidateSize();m.fitBounds(pts,{padding:[40,40],maxZoom:17});fit=true}}}}
