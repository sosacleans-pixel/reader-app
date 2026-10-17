/* Coach Salim: workout-time onboarding, daily reminders, streaks. */
(function(){
"use strict";
var SB="https://olncfwohfpgpmygxjpcm.supabase.co",ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sbmNmd29oZnBncG15Z3hqcGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzQ0ODgsImV4cCI6MjEwNzMxMDQ4OH0.rcjQ4E2oPVyth1bboHvwRFqUtwAAAkmUw1TGwF20_Uc",VAPID="BH5O9YZfRa4pKPjnkO-FevCFXgyTcRXP3GYE6SaLP3YLLPGxmQfzdEeeX0rh77RwhcfQ4UGkBTHLy1JMGc2a-Es";
var KP="actm.reminder.prefs",KS="actm.streak",KC="actm.streak.celebrated",KT="actm.iostip.dismissed";
var SLOTS={morning:{label:"Morning",time:"07:00"},afternoon:{label:"Afternoon",time:"12:30"},evening:{label:"Evening",time:"18:00"}};
function ls(k,v){try{if(v===undefined){var r=localStorage.getItem(k);return r?JSON.parse(r):null}localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}}
function tz(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"}catch(e){return"UTC"}}
function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function isIOS(){var u=navigator.userAgent;return/iphone|ipad|ipod/i.test(u)||(u.indexOf("Macintosh")>-1&&navigator.maxTouchPoints>1)}
function standalone(){return matchMedia("(display-mode: standalone)").matches||navigator.standalone===true}
function session(){try{var k=Object.keys(localStorage).find(function(k){return/^sb-.*-auth-token$/.test(k)});if(!k)return null;var s=JSON.parse(localStorage.getItem(k));return s&&s.access_token&&s.user?s:null}catch(e){return null}}
function sbUpsert(table,row,conflict){var s=session();if(!s)return Promise.resolve(false);row.user_id=s.user.id;
 return fetch(SB+"/rest/v1/"+table+(conflict?"?on_conflict="+conflict:""),{method:"POST",headers:{apikey:ANON,Authorization:"Bearer "+s.access_token,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(row)}).then(function(r){return r.ok}).catch(function(){return false})}

/* ---------- styles ---------- */
var css=".rf-ov{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.82);display:flex;align-items:flex-end;justify-content:center;font-family:Lato,system-ui,sans-serif}"+
".rf-card{background:#000;color:#fff;width:100%;max-width:480px;border-top:4px solid #FFC700;border-radius:20px 20px 0 0;padding:24px 20px calc(24px + env(safe-area-inset-bottom));box-sizing:border-box}"+
".rf-h{font-family:Anton,Impact,sans-serif;font-size:30px;line-height:1.1;text-transform:uppercase;margin:0 0 6px;color:#FFC700;letter-spacing:.5px}"+
".rf-p{margin:0 0 16px;color:#ddd;font-size:15px;line-height:1.45}"+
".rf-opt{display:flex;justify-content:space-between;align-items:center;width:100%;margin:0 0 10px;padding:16px;border:2px solid #333;border-radius:14px;background:#111;color:#fff;font-size:17px;font-weight:700;cursor:pointer;box-sizing:border-box}"+
".rf-opt span{color:#999;font-weight:400}.rf-opt.on{border-color:#FFC700;background:#1a1500}.rf-opt.on span{color:#FFC700}"+
".rf-btn{width:100%;padding:16px;border:0;border-radius:14px;background:#FFC700;color:#000;font-weight:900;font-size:17px;cursor:pointer;margin-top:6px}"+
".rf-btn2{width:100%;padding:12px;border:0;background:none;color:#aaa;font-size:15px;cursor:pointer;margin-top:4px}"+
".rf-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #222;font-size:15px}"+
".rf-row small{display:block;color:#999;font-size:13px;margin-top:2px}.rf-sel{background:#111;color:#fff;border:1px solid #444;border-radius:10px;padding:8px;max-width:55%;font-size:14px}"+
".rf-tog{appearance:none;-webkit-appearance:none;width:48px;height:28px;border-radius:14px;background:#444;position:relative;cursor:pointer;flex:none}.rf-tog:checked{background:#FFC700}"+
".rf-tog:after{content:'';position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:.2s}.rf-tog:checked:after{left:23px;background:#000}"+
".rf-tip{background:#BF3404;color:#fff;border-radius:14px;padding:12px 14px;margin:6px 0 12px;font-size:14px;line-height:1.4}.rf-tip b{color:#FFC700}"+
".rf-bell{position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:9000;width:52px;height:52px;border-radius:50%;border:2px solid #000;background:#FFC700;color:#000;font-size:24px;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer}"+
".rf-banner{position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:9001;background:#BF3404;color:#fff;border-radius:14px;padding:14px 40px 14px 14px;font:15px/1.4 Lato,system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4);max-width:456px;margin:0 auto}"+
".rf-banner b{color:#FFC700}.rf-banner button{position:absolute;top:8px;right:8px;background:none;border:0;color:#fff;font-size:22px;cursor:pointer}"+
".rf-cel{position:fixed;inset:0;z-index:10000;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden;font-family:Lato,system-ui,sans-serif;color:#fff;padding:24px;box-sizing:border-box}"+
".rf-flame{font-size:84px;animation:rfpop .6s cubic-bezier(.2,1.6,.4,1)}.rf-num{font-family:Anton,Impact,sans-serif;font-size:132px;line-height:.9;color:#FFC700;animation:rfpop .7s .1s both cubic-bezier(.2,1.6,.4,1)}"+
".rf-lbl{font-family:Anton,Impact,sans-serif;font-size:40px;text-transform:uppercase;letter-spacing:1px;margin:4px 0 12px}.rf-sub{color:#ccc;font-size:16px;max-width:300px;margin:0 0 28px}"+
".rf-cel .rf-btn{max-width:320px}.rf-cf{position:absolute;top:-20px;width:9px;height:14px;opacity:.9;animation:rffall linear forwards}"+
"@keyframes rfpop{0%{transform:scale(.2);opacity:0}100%{transform:scale(1);opacity:1}}@keyframes rffall{to{transform:translateY(110vh) rotate(720deg)}}";
function addCss(){var s=document.createElement("style");s.textContent=css;document.head.appendChild(s)}
function el(h){var d=document.createElement("div");d.innerHTML=h.trim();return d.firstChild}
function close(n){n&&n.parentNode&&n.parentNode.removeChild(n)}

/* ---------- prefs ---------- */
function prefs(){return ls(KP)}
function savePrefs(p){p.tz=p.tz||tz();p.updatedAt=new Date().toISOString();ls(KP,p);
 sbUpsert("workout_prefs",{slot:p.slot,local_time:SLOTS[p.slot].time,timezone:p.tz,push_enabled:!!p.push,email_enabled:!!p.email,updated_at:p.updatedAt},"user_id")}

function tipHtml(){return isIOS()&&!standalone()?'<div class="rf-tip">📲 <b>Add to Home Screen to get reminders.</b> On iPhone, tap the Share button, then “Add to Home Screen,” and open the app from your home screen (iOS 16.4 or later).</div>':""}

function onboarding(){
 var sel="evening";var o=el('<div class="rf-ov" role="dialog" aria-modal="true"><div class="rf-card"><h2 class="rf-h">When do you plan to work out?</h2><p class="rf-p">Pick a time and I’ll nudge you every day. Seven minutes. That’s it.</p>'+
 Object.keys(SLOTS).map(function(k){return'<button class="rf-opt'+(k===sel?" on":"")+'" data-k="'+k+'">'+SLOTS[k].label+'</button>'}).join("")+
 '<p class="rf-p" style="font-size:13px;margin:4px 0 12px">Time zone: '+tz()+'</p><button class="rf-btn">Set my reminder</button><button class="rf-btn2">Not now</button></div></div>');
 o.querySelectorAll(".rf-opt").forEach(function(b){b.onclick=function(){sel=b.dataset.k;o.querySelectorAll(".rf-opt").forEach(function(x){x.classList.toggle("on",x===b)})}});
 o.querySelector(".rf-btn").onclick=function(){var p={slot:sel,tz:tz(),push:false,email:false};savePrefs(p);close(o);enablePush().then(function(ok){if(ok){p.push=true;savePrefs(p)}else if(isIOS()&&!standalone())iosBanner()})};
 o.querySelector(".rf-btn2").onclick=function(){ls(KP,{slot:null,skipped:true,tz:tz()});close(o)};
 document.body.appendChild(o)}

var onboardingTimer=null;
function scheduleOnboarding(){if(onboardingTimer)return;if(prefs()||!session())return;onboardingTimer=setTimeout(function(){onboardingTimer=null;if(!prefs()&&session())onboarding()},1200)}

function settings(){
 var p=prefs()||{};var s=session();var email=s&&s.user&&s.user.email;
 var o=el('<div class="rf-ov" role="dialog" aria-modal="true"><div class="rf-card"><h2 class="rf-h">Workout reminders</h2>'+tipHtml()+
 '<div class="rf-row"><div>Workout time<small>Daily reminder time</small></div><select class="rf-sel" id="rf-slot"><option value="">Off</option>'+Object.keys(SLOTS).map(function(k){return'<option value="'+k+'"'+(p.slot===k?" selected":"")+'>'+SLOTS[k].label+'</option>'}).join("")+'</select></div>'+
 '<div class="rf-row"><div>Time zone<small>From this device</small></div><span style="color:#FFC700">'+(p.tz||tz())+'</span></div>'+
 '<div class="rf-row"><div>Push notifications<small id="rf-pst">'+pushStatus()+'</small></div><input type="checkbox" class="rf-tog" id="rf-push"'+(p.push?" checked":"")+'></div>'+
 '<div class="rf-row"><div>Email reminder too<small>'+(email?"Sent to "+email:"Sign in to use email reminders")+'</small></div><input type="checkbox" class="rf-tog" id="rf-mail"'+(p.email?" checked":"")+(email?"":" disabled")+'></div>'+
 '<div class="rf-row"><div>Current streak<small>Days in a row with a workout</small></div><span style="font-family:Anton,Impact;font-size:24px;color:#FFC700">🔥 '+streak().current+'</span></div>'+
 '<button class="rf-btn">Done</button></div></div>');
 var q=function(id){return o.querySelector(id)};
 q("#rf-slot").onchange=function(){p.slot=this.value||null;savePrefs(p)};
 q("#rf-push").onchange=function(){var t=this;if(t.checked){enablePush().then(function(ok){t.checked=ok;p.push=ok;savePrefs(p);q("#rf-pst").textContent=pushStatus()})}else{disablePush();p.push=false;savePrefs(p);q("#rf-pst").textContent=pushStatus()}};
 q("#rf-mail").onchange=function(){p.email=this.checked;savePrefs(p)};
 q(".rf-btn").onclick=function(){close(o)};o.onclick=function(e){if(e.target===o)close(o)};
 document.body.appendChild(o)}
function pushStatus(){if(isIOS()&&!standalone())return"Needs Home Screen app on iPhone";if(!("PushManager"in window))return"Not supported in this browser";var n=window.Notification&&Notification.permission;return n==="denied"?"Blocked in browser settings":n==="granted"?"Allowed":"Tap to allow"}

function iosBanner(){if(ls(KT)||standalone()||!isIOS())return;var b=el('<div class="rf-banner"><b>Add to Home Screen to get reminders.</b><br>Tap Share ⬆︎ then “Add to Home Screen.”<button aria-label="Dismiss">×</button></div>');b.querySelector("button").onclick=function(){ls(KT,1);close(b)};document.body.appendChild(b)}

/* ---------- push ---------- */
function b64u(s){var p="=".repeat((4-s.length%4)%4),r=atob((s+p).replace(/-/g,"+").replace(/_/g,"/")),a=new Uint8Array(r.length);for(var i=0;i<r.length;i++)a[i]=r.charCodeAt(i);return a}
function enablePush(){
 if(!("serviceWorker"in navigator)||!("PushManager"in window)||!window.Notification)return Promise.resolve(false);
 return Notification.requestPermission().then(function(perm){if(perm!=="granted")return false;
  return navigator.serviceWorker.ready.then(function(reg){return reg.pushManager.getSubscription().then(function(s){return s||reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(VAPID)})})}).then(function(sub){
   var j=sub.toJSON();ls("actm.push.sub",j);sbUpsert("push_subscriptions",{endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,user_agent:navigator.userAgent.slice(0,200)},"endpoint");return true})}).catch(function(){return false})}
function disablePush(){if(!("serviceWorker"in navigator))return;navigator.serviceWorker.ready.then(function(r){return r.pushManager.getSubscription()}).then(function(s){if(!s)return;var ep=s.endpoint;s.unsubscribe();var x=session();if(x)fetch(SB+"/rest/v1/push_subscriptions?endpoint=eq."+encodeURIComponent(ep),{method:"DELETE",headers:{apikey:ANON,Authorization:"Bearer "+x.access_token}})}).catch(function(){})}

/* ---------- streaks ---------- */
function workoutDates(){var set={};try{Object.keys(localStorage).forEach(function(k){if(k.indexOf("actm.logs.")!==0)return;var a=JSON.parse(localStorage.getItem(k))||[];a.forEach(function(l){if(l&&l.calendarDate)set[l.calendarDate]=1})})}catch(e){}return set}
function streak(){var d=workoutDates(),now=new Date(),c=0,t=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 if(!d[ymd(t)])t.setDate(t.getDate()-1); /* today not done yet: streak alive through yesterday */
 while(d[ymd(t)]){c++;t.setDate(t.getDate()-1)}
 var prev=ls(KS)||{best:0};var s={current:c,best:Math.max(prev.best||0,c),total:Object.keys(d).length,lastDate:Object.keys(d).sort().pop()||null,updatedAt:new Date().toISOString()};
 if(s.current!==prev.current||s.best!==prev.best||s.total!==prev.total){ls(KS,s);sbUpsert("streaks",{current_streak:s.current,best_streak:s.best,total_workouts:s.total,last_workout_date:s.lastDate,timezone:tz(),updated_at:s.updatedAt},"user_id")}
 return s}
function celebrate(n){
 var o=el('<div class="rf-cel" role="dialog" aria-live="polite"><div class="rf-flame">🔥</div><div class="rf-num">'+n+'</div><div class="rf-lbl">'+n+'-day streak!</div><p class="rf-sub">'+msg(n)+'</p><button class="rf-btn">Keep it going</button></div>');
 var cols=["#FFC700","#BF3404","#fff","#FFC700"];for(var i=0;i<44;i++){var c=document.createElement("i");c.className="rf-cf";c.style.left=Math.random()*100+"%";c.style.background=cols[i%4];c.style.animationDuration=(2.2+Math.random()*2)+"s";c.style.animationDelay=(Math.random()*.8)+"s";c.style.borderRadius=i%3?"2px":"50%";o.appendChild(c)}
 o.querySelector(".rf-btn").onclick=function(){close(o)};document.body.appendChild(o);try{navigator.vibrate&&navigator.vibrate([40,40,80])}catch(e){}}
function msg(n){return n>=21?"Three weeks straight. This is who you are now.":n>=7?"A full week and counting. Don’t break the chain.":"You showed up "+n+" days in a row. See you tomorrow."}
function checkCelebrate(){var s=streak(),today=ymd(new Date());if(s.current>=3&&workoutDates()[today]&&ls(KC)!==today){ls(KC,today);celebrate(s.current)}}
/* Detect workout completion: the app writes logs to localStorage key actm.logs.<user>. */
var orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){var before=null;var watchLog=this===window.localStorage&&typeof k==="string"&&k.indexOf("actm.logs.")===0;var watchAuth=this===window.localStorage&&typeof k==="string"&&/^sb-.*-auth-token$/.test(k);if(watchLog)before=this.getItem(k);orig.apply(this,arguments);if(watchLog&&before!==v)setTimeout(checkCelebrate,600);if(watchAuth)setTimeout(scheduleOnboarding,0)};

/* ---------- boot ---------- */
function boot(){addCss();
 var bell=el('<button class="rf-bell" aria-label="Workout reminders">⏰</button>');bell.onclick=settings;document.body.appendChild(bell);
 streak();var p=prefs();scheduleOnboarding();if(p&&p.slot)iosBanner();
 if(p&&p.push&&window.Notification&&Notification.permission==="granted")enablePush(); /* refresh subscription */
 if(p&&p.slot&&session()&&!p.synced){savePrefs(p);p.synced=1;ls(KP,p)}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
window.__rf={settings:settings,onboarding:onboarding,streak:streak,celebrate:celebrate};
})();
