/* Push reminder handlers (imported by sw.js) */
self.addEventListener("push",function(e){var d={};try{d=e.data?e.data.json():{}}catch(x){d={body:e.data&&e.data.text()}}
 e.waitUntil(self.registration.showNotification(d.title||"Time to move 💪",{body:d.body||"Your 7-minute workout is waiting. Keep your streak alive.",icon:"/icons/icon-192-v2.png",badge:"/icons/icon-192-v2.png",tag:"daily-reminder",renotify:true,data:{url:d.url||"/"}}))});
self.addEventListener("notificationclick",function(e){e.notification.close();var u=(e.notification.data&&e.notification.data.url)||"/";
 e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(function(cs){for(var c of cs){if("focus"in c){c.navigate&&c.navigate(u);return c.focus()}}return clients.openWindow(u)}))});
