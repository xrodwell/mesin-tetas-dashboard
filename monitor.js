'use strict';
const $ = id => document.getElementById(id);
const topic = 'incubator/sensor/state';
const endpoint = `ws://${location.hostname}:9001/mqtt`;
const fmt = new Intl.NumberFormat('id-ID', {minimumFractionDigits:1,maximumFractionDigits:1});
const deg = v => `${fmt.format(v)} °C`;
const valid = (v,min,max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
let client, connected = false, liveSession = false, data, last, busy = false;
const status = (id, text, tone) => {
  if ($(id).textContent !== text) $(id).textContent = text;
  $(id).dataset.tone = tone;
};
const fresh = () => connected && liveSession && Date.now() - last <= 15000;
const usable = () => fresh() && typeof data?.power === 'boolean';
function render() {
  const live = fresh();
  status('device', live ? 'Data masuk' : last != null ? 'Data terakhir kedaluwarsa' : 'Belum ada data', live ? 'ok' : 'wait');
  $('temp').textContent = data ? fmt.format(data.temp) : '--';
  $('humidity').textContent = data?.humidity == null ? '--' : `${fmt.format(data.humidity)} %`;
  $('target').textContent = data?.target == null ? '--' : `${deg(data.target)}${live ? '' : ' (terakhir)'}`;
  $('power').textContent = !live || data.power == null ? 'Tidak diketahui' : data.power ? 'ON' : 'OFF';
  $('last').textContent = last == null ? 'Menunggu pembacaan pertama.' : `${live ? 'Diterima pukul' : 'Data terakhir, pukul'} ${new Date(last).toLocaleTimeString('id-ID')}`;
  $('toggle').disabled = !usable() || busy;
  $('toggle').textContent = !usable() ? 'ON/OFF' : data.power ? 'Matikan' : 'Nyalakan';
  $('slider').disabled = !usable() || data.power || busy;
  $('apply').disabled = $('slider').disabled;
  $('controlHint').textContent = !usable() ? 'Menunggu pembacaan dan status ON/OFF dari alat.' : data.power ? 'Target manual tersedia saat alat OFF.' : 'Saat dinyalakan, target dikembalikan ke 37,5 °C.';
  $('draft').textContent = deg(Number($('slider').value));
}
function notice(text) { $('notice').hidden = false; $('notice').textContent = text; }
function publish(c, sub, payload) {
  return new Promise((resolve,reject) => {
    if (client !== c || !c.connected || !usable()) return reject(new Error('Koneksi atau data tidak tersedia'));
    const timer = setTimeout(()=>{
      reject(new Error('Broker tidak merespons'));
      if (client === c) c.end(true);
    },5000);
    c.publish(`incubator/control/${sub}`,String(payload),{qos:1,retain:false},err=>{
      clearTimeout(timer);
      if (err || client !== c) reject(err || new Error('Koneksi putus'));
      else resolve();
    });
  });
}
async function command(kind) {
  if (!usable() || busy || (kind === 'manual' && data.power)) return;
  const c = client;
  busy = true; render(); notice('Mengirim perintah…');
  try {
    if (kind === 'manual') {
      const v = Number($('slider').value);
      if (!valid(v,30,42) || !Number.isInteger(v*2)) throw new Error('Target tidak valid');
      await publish(c,'setpoint',v);
    } else if (data.power) await publish(c,'power','off');
    else { await publish(c,'setpoint',37.5); await publish(c,'power','on'); }
    notice('Perintah diterima broker. Cek status dari alat untuk memastikan.');
  } catch { notice('Pengiriman tidak terkonfirmasi. Periksa status alat sebelum mencoba lagi.'); }
  finally { busy = false; render(); }
}
function connect() {
  if (!window.mqtt) {status('broker','Klien gagal dimuat','wait'); return;}
  const c = client = window.mqtt.connect(endpoint,{reconnectPeriod:0,connectTimeout:5000,queueQoSZero:false});
  c.on('connect',()=>{
    connected = true; liveSession = false; status('broker','Terhubung','ok'); render();
    c.subscribe(topic,{qos:0},(err,granted)=>{ if (client === c && (err || granted?.[0]?.qos === 128)) status('device','Gagal berlangganan','wait'); });
  });
  c.on('message',(channel,bytes,packet)=>{
    if (client !== c || channel !== topic || packet.retain || !connected) return;
    let d; try { d=JSON.parse(bytes.toString()); } catch { return; }
    const temp=d?.temp_c ?? d?.temperature ?? d?.temp;
    if (!valid(temp,-40,85)) return;
    const h=d.humidity ?? d.humi ?? d.hum, t=d.setpoint ?? d.sp;
    data={temp,humidity:valid(h,0,100)?h:null,target:valid(t,0,85)?t:null,power:typeof d.power==='boolean'?d.power:null};
    last=Date.now(); liveSession=true; render();
  });
  c.on('error',()=>{});
  c.once('close',()=>{
    connected=false; liveSession=false; client=null;
    c.end(true); status('broker','Terputus','wait'); render();
    if (busy) {busy=false; notice('Koneksi terputus; hasil perintah belum diketahui.'); render();}
    setTimeout(connect,3000);
  });
}
$('endpoint').textContent=endpoint;
$('slider').addEventListener('input',render);
$('toggle').addEventListener('click',()=>command('toggle'));
$('controls').addEventListener('submit',e=>{e.preventDefault(); command('manual');});
render(); connect(); setInterval(render,1000);
