/* ---------- Jam Dunia (contoh beberapa kota) ---------- */
const cities = [
  {name: "Jakarta", tz: "Asia/Jakarta"},
  {name: "London", tz: "Europe/London"},
  {name: "Sydney", tz: "Australia/Sydney"}
];

function updateClocks(){
  const container = document.getElementById("clocks");
  container.innerHTML = "";
  const now = new Date();
  cities.forEach(c=>{
    // tampilkan waktu lokal kota menggunakan Intl
    const time = now.toLocaleTimeString("en-GB", {timeZone: c.tz, hour: "2-digit", minute:"2-digit", second:"2-digit"});
    const date = now.toLocaleDateString("id-ID", {timeZone: c.tz});
    const div = document.createElement("div");
    div.className = "clock-card";
    div.innerHTML = `<strong>${c.name}</strong><div style="color:var(--muted);font-size:0.85rem">${date}</div><div style="font-size:1.2rem;margin-top:8px">${time}</div>`;
    container.appendChild(div);
  });
}
setInterval(updateClocks,1000);
updateClocks();

/* ---------- Tanggal Masehi & Hijri ---------- */
function updateDates(){
  const today = new Date();
  document.getElementById("masehi").innerText = today.toLocaleString("id-ID", {weekday:"long", day:"numeric", month:"long", year:"numeric"});
  // Hijri (Intl support modern browsers)
  try{
    const hijri = new Intl.DateTimeFormat("id-u-ca-islamic", {day:"numeric", month:"long", year:"numeric"}).format(today);
    document.getElementById("hijri").innerText = hijri;
  }catch(e){
    document.getElementById("hijri").innerText = "Hijri: tidak tersedia di browser ini";
  }
}
updateDates();

/* ---------- PRAY TIMES (PrayTimes.js simplified port) ----------
   Menggunakan metode perhitungan yang umum (Muslim World League / angle twilight).
   Catatan: Ini adalah implementasi sederhana untuk pendidikan.
*/
function toRad(d){return d*Math.PI/180}
function toDeg(r){return r*180/Math.PI}
function fixAngle(a){ a = a%360; if(a<0) a+=360; return a; }

// menghitung declination matahari & eqtime (approximation) - dari algoritma NOAA
function sunPosition(jd){
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915*Math.sin(toRad(g)) + 0.020*Math.sin(toRad(2*g)));
  const e = 23.439 - 0.00000036 * D;
  const RA = toDeg(Math.atan2(Math.cos(toRad(e))*Math.sin(toRad(L)), Math.cos(toRad(L))))/15;
  const decl = toDeg(Math.asin(Math.sin(toRad(e))*Math.sin(toRad(L))));
  const eqt = (q/15 - RA) * 15; // minutes approx multiply? we'll use degrees
  return {decl:decl, eqt: eqt};
}

// convert date -> Julian Day
function toJulian(date){
  return date/86400000 + 2440587.5;
}

// hitung time for angle (hour angle)
function hourAngle(lat, decl, angle){
  // angle in degrees (e.g., 90+zenith)
  const latR = toRad(lat), declR = toRad(decl), angR = toRad(angle);
  const HA = Math.acos((Math.sin(angR)-Math.sin(latR)*Math.sin(declR))/(Math.cos(latR)*Math.cos(declR)));
  return toDeg(HA); // degrees
}

// main function
function computePrayerTimes(date, lat, lon){
  // date = JS Date at local midnight
  const jd = toJulian(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
  const sp = sunPosition(jd);
  const decl = sp.decl;
  // approximate Dhuhr (solar noon) in UTC hours:
  const noon = (12 - sp.eqt/60 - lon/15); // simple
  // sunrise/sunset via zenith 90.833
  const haSun = hourAngle(lat, decl, 90.833); // degrees
  const deltaH = haSun/15; // hours
  const sunrise = noon - deltaH;
  const sunset = noon + deltaH;
  // Fajr/Isha at 18 degrees twilight (common)
  let haFajr = hourAngle(lat, decl, 90+18);
  const fajr = noon - haFajr/15;
  const isha = noon + haFajr/15;
  // Asr simple (Shafi'i) using formula: asr time when shadow = 1 -> compute angle
  // Use formula to compute hour angle for Asr: acos((sin(atan(1+tan(abs(lat-decl)))) - sin lat * sin decl)/(cos lat * cos decl))
  const phi = Math.abs(lat - decl);
  const asrAngle = toDeg(Math.atan(1 + 1/Math.tan(Math.abs(toRad(lat - decl))))); // rough; fallback
  // Simpler approach: compute asr via tangent method: factor = 1 (Shafi'i)
  // We'll use formula: HA_asr = acos((sin(atan(1 + tan(|lat-decl|))) - sin lat * sin decl)/(cos lat * cos decl))
  let haAsr;
  try{
    const x = Math.atan(1 + Math.tan(Math.abs(toRad(lat - decl))));
    haAsr = Math.acos((Math.sin(x) - Math.sin(toRad(lat))*Math.sin(toRad(decl)))/(Math.cos(toRad(lat))*Math.cos(toRad(decl))));
    haAsr = toDeg(haAsr);
    var asr = noon + haAsr/15; // approximate afternoon time
  }catch(e){
    var asr = noon + (haSun/15)/2;
  }

  function hoursToTime(h){
    // h in hours UTC; convert to local time by adding timezone offset (we'll display local via Date object)
    let hh = Math.floor(h);
    let mm = Math.floor((h - hh)*60 + 0.5);
    if(mm>=60){ hh+=1; mm-=60; }
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  }
  return {
    fajr: hoursToTime(fajr),
    sunrise: hoursToTime(sunrise),
    dhuhr: hoursToTime(noon),
    asr: hoursToTime(asr),
    maghrib: hoursToTime(sunset),
    isha: hoursToTime(isha)
  };
}

/* ---------- GEO & QIBLA ---------- */
function computeQibla(lat1, lon1){
  // Mekah: 21.4225N, 39.8262E
  const lat2 = 21.4225, lon2 = 39.8262;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const x = Math.sin(Δλ);
  const y = Math.cos(φ1)*Math.tan(φ2) - Math.sin(φ1)*Math.cos(Δλ);
  let brng = Math.atan2(x, y);
  brng = toDeg(brng);
  brng = (brng + 360) % 360; // bearing from north clockwise
  return brng;
}

/* ---------- UI + Integrasi ---------- */
let currentLat = null, currentLon = null;

async function updateAllWithLocation(lat, lon){
  currentLat = lat; currentLon = lon;
  // Prayer times (use computePrayerTimes)
  const today = new Date();
  const localMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const times = computePrayerTimes(localMidnight, lat, lon);

  const ul = document.getElementById("prayer-times");
  ul.innerHTML = "";
  const order = ["fajr","sunrise","dhuhr","asr","maghrib","isha"];
  order.forEach(k=>{
    const li = document.createElement("li");
    li.innerHTML = `<span style="text-transform:capitalize">${k}</span><strong>${times[k]}</strong>`;
    ul.appendChild(li);
  });

  // Qibla
  const brng = computeQibla(lat, lon);
  const needle = document.getElementById("needle");
  needle.style.transform = `rotate(${brng}deg)`; // rotate the icon
  document.getElementById("qibla-info").innerText = `${brng.toFixed(2)}° dari Utara`;
}

function handleGeoError(){
  document.getElementById("prayer-times").innerHTML = "<li>Lokasi tidak aktif / ditolak</li>";
  document.getElementById("qibla-info").innerText = "Lokasi tidak tersedia";
}

function tryGetLocation(){
  if(!navigator.geolocation){
    handleGeoError();
    return;
  }
  navigator.geolocation.getCurrentPosition(pos=>{
    updateAllWithLocation(pos.coords.latitude, pos.coords.longitude);
  }, err=>{
    handleGeoError();
  }, {enableHighAccuracy:true,timeout:8000});
}

// tombol
document.getElementById("refreshLocation").addEventListener("click", tryGetLocation);
document.getElementById("btnFindQibla").addEventListener("click", tryGetLocation);

// inisialisasi
tryGetLocation();
