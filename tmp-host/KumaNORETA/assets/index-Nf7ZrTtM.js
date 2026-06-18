(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=1e3,t=3,n=e=>e*Math.PI/180;function r(e,t){let r=n(t.latitude-e.latitude),i=n(t.longitude-e.longitude),a=n(e.latitude),o=n(t.latitude),s=Math.sin(r/2)**2+Math.cos(a)*Math.cos(o)*Math.sin(i/2)**2;return 2*6371e3*Math.asin(Math.sqrt(s))}function i(e,t,n){return Math.min(n,Math.max(t,e))}function a(t,n,r){let a=i(1-t/e,0,1),o=i(n/200,0,.25),s=i(1-Math.max(0,(Date.now()-r.getTime())/1e3)/180,.2,1);return i(a*.8+s*.2-o,.1,.99)}function o(n,i,o,s){let c=new Map(o.map(e=>[e.id,e])),l=new Map(s.map(e=>[e.id,e]));return i.map(t=>{let i=c.get(t.tripId),o=i?l.get(i.routeId):void 0;if(!i||!o)return;let s=r(n,t);if(s>e)return;let u=a(s,n.accuracyMeters,t.timestamp);return{trip:i,route:o,vehicle:t,distanceMeters:s,score:u,confidence:u,reason:`GPS位置と車両位置の距離が約${Math.round(s)}mです`}}).filter(e=>e!==void 0).sort((e,t)=>e.distanceMeters===t.distanceMeters?t.score===e.score?t.vehicle.timestamp.getTime()-e.vehicle.timestamp.getTime():t.score-e.score:e.distanceMeters-t.distanceMeters).slice(0,t)}function s(n,i,a,o){let s=new Map(a.map(e=>[e.id,e])),c=new Map(o.map(e=>[e.id,e])),l=0,u=0;for(let t of i){let i=s.get(t.tripId),a=i?c.get(i.routeId):void 0;!i||!a||(l+=1,r(n,t)<=e&&(u+=1))}return{totalVehicles:i.length,matchedVehicles:l,nearbyMatchedVehicles:u,candidateCount:Math.min(u,t)}}function c(e,t,n){let r=n.find(e=>e.id===t);if(!r)return;let i=e.trip.stopIds.indexOf(t),a=i>=0?Math.max(3,(i+1)*4):12;return{stop:r,estimatedArrival:new Date(Date.now()+a*6e4),minutesUntilArrival:a,source:`mock`}}var l={latitude:32.8031,longitude:130.7079,accuracyMeters:18,capturedAt:new Date},u=[{id:`stop-kumamoto-station`,name:`熊本駅前`,latitude:32.7897,longitude:130.6899},{id:`stop-sakuramachi`,name:`桜町バスターミナル`,latitude:32.8002,longitude:130.7041},{id:`stop-torichosuji`,name:`通町筋`,latitude:32.8031,longitude:130.7113},{id:`stop-suizenji`,name:`水前寺公園前`,latitude:32.7891,longitude:130.7338}],d=[{id:`route-a`,shortName:`A1-1`,longName:`熊本駅前 → 水前寺公園前`,color:`#0f766e`},{id:`route-b`,shortName:`B2-3`,longName:`桜町バスターミナル → 健軍町`,color:`#ea580c`},{id:`route-c`,shortName:`C4-2`,longName:`熊本駅前 → 県庁前`,color:`#2563eb`}],f=[{id:`trip-a-morning`,routeId:`route-a`,headsign:`水前寺公園前 行き`,stopIds:u.map(e=>e.id)},{id:`trip-b-daytime`,routeId:`route-b`,headsign:`健軍町 行き`,stopIds:[u[1].id,u[2].id,u[3].id]},{id:`trip-c-daytime`,routeId:`route-c`,headsign:`県庁前 行き`,stopIds:[u[0].id,u[1].id,u[2].id]}],p=[{vehicleId:`vehicle-096`,tripId:`trip-a-morning`,latitude:32.8025,longitude:130.7098,bearing:92,timestamp:new Date},{vehicleId:`vehicle-104`,tripId:`trip-b-daytime`,latitude:32.8021,longitude:130.7064,bearing:75,timestamp:new Date},{vehicleId:`vehicle-118`,tripId:`trip-c-daytime`,latitude:32.8046,longitude:130.7129,bearing:88,timestamp:new Date}];function m(e){if(!e)return;let t=Number(e);return Number.isFinite(t)?t:void 0}function h(){let e=m(`32.8009204`),t=m(`130.702227`),n=m(`10`)??10;if(e===void 0||t===void 0){console.warn(`GPS override is enabled but latitude/longitude is missing.`);return}return{latitude:e,longitude:t,accuracyMeters:n,capturedAt:new Date}}async function g(){let e=h();return e?{position:e,source:`override`}:`geolocation`in navigator?new Promise(e=>{navigator.geolocation.getCurrentPosition(t=>{e({position:{latitude:t.coords.latitude,longitude:t.coords.longitude,accuracyMeters:t.coords.accuracy,capturedAt:new Date(t.timestamp)},source:`browser`})},()=>e({position:l,source:`mock-fallback`}),{enableHighAccuracy:!0,timeout:5e3,maximumAge:1e4})}):{position:l,source:`mock-fallback`}}var _=`/KumaNORETA/gtfs/toshibus-static.json`;async function v(){try{let e=await fetch(_);if(!e.ok)throw Error(`Static GTFS request failed with ${e.status}`);return await e.json()}catch(e){return console.error(`Failed to load static GTFS-JP data, falling back to mocks.`,e),{metadata:{publisherName:`mock`,version:`mock`,startDate:new Date().toISOString().slice(0,10),endDate:new Date().toISOString().slice(0,10),sourceUrl:`mock`,fetchedAt:new Date().toISOString(),routeCount:d.length,stopCount:u.length,tripCount:f.length},routes:d,stops:u,trips:f}}}var y=class{bytes;offset=0;constructor(e){this.bytes=e}get eof(){return this.offset>=this.bytes.length}readFloat32(){let e=new DataView(this.bytes.buffer,this.bytes.byteOffset+this.offset,4).getFloat32(0,!0);return this.offset+=4,e}readLengthDelimited(){let e=this.readVarint(),t=this.offset,n=t+e;if(n>this.bytes.length)throw Error(`Unexpected end of protobuf field`);return this.offset=n,this.bytes.subarray(t,n)}readString(){return new TextDecoder().decode(this.readLengthDelimited())}readTag(){let e=this.readVarint();return{fieldNumber:e>>>3,wireType:e&7}}readVarint(){let e=0n,t=0n;for(;;){if(this.offset>=this.bytes.length)throw Error(`Unexpected end of protobuf varint`);let n=this.bytes[this.offset++];if(e|=BigInt(n&127)<<t,!(n&128)){let t=Number(e);if(!Number.isSafeInteger(t))throw Error(`Protobuf varint exceeds safe integer range`);return t}t+=7n}}skip(e){switch(e){case 0:this.readVarint();return;case 1:this.offset+=8;return;case 2:this.offset+=this.readVarint();return;case 5:this.offset+=4;return;default:throw Error(`Unsupported protobuf wire type: ${e}`)}}};function b(e){let t={};for(;!e.eof;){let{fieldNumber:n,wireType:r}=e.readTag();if(r!==5){e.skip(r);continue}switch(n){case 1:t.latitude=e.readFloat32();break;case 2:t.longitude=e.readFloat32();break;case 3:t.bearing=e.readFloat32();break;default:e.skip(r)}}return t}function x(e){let t;for(;!e.eof;){let{fieldNumber:n,wireType:r}=e.readTag();if(n===1&&r===2){t=e.readString();continue}e.skip(r)}return t}function S(e){let t;for(;!e.eof;){let{fieldNumber:n,wireType:r}=e.readTag();if(n===1&&r===2){t=e.readString();continue}e.skip(r)}return t}function C(e){let t={};for(;!e.eof;){let{fieldNumber:n,wireType:r}=e.readTag();switch(n){case 1:if(r===2){t.tripId=x(new y(e.readLengthDelimited()));break}e.skip(r);break;case 2:if(r===2){Object.assign(t,b(new y(e.readLengthDelimited())));break}e.skip(r);break;case 5:if(r===0){t.timestamp=e.readVarint();break}e.skip(r);break;case 8:if(r===2){t.vehicleId=S(new y(e.readLengthDelimited()));break}e.skip(r);break;default:e.skip(r)}}return t}function w(e){let t;for(;!e.eof;){let{fieldNumber:n,wireType:r}=e.readTag();if(n===4&&r===2){t=C(new y(e.readLengthDelimited()));continue}e.skip(r)}return t}function T(e){let t=new y(new Uint8Array(e)),n=[];for(;!t.eof;){let{fieldNumber:e,wireType:r}=t.readTag();if(e!==2||r!==2){t.skip(r);continue}let i=w(new y(t.readLengthDelimited()));!i?.vehicleId||!i.tripId||i.latitude===void 0||i.longitude===void 0||n.push({vehicleId:i.vehicleId,tripId:i.tripId,latitude:i.latitude,longitude:i.longitude,bearing:i.bearing,timestamp:new Date((i.timestamp??Math.trunc(Date.now()/1e3))*1e3)})}return n}function E(){return{apiKey:``,apiKeyHeader:`x-api-key`,authToken:``,alertsUrl:`https://km.bus-vision.jp/realtime/toshibus_alrt_update.bin`,tripUpdatesUrl:`https://km.bus-vision.jp/realtime/toshibus_trip_update.bin`,url:`https://km.bus-vision.jp/realtime/toshibus_vpos_update.bin`,useMock:!1}}async function D(){let e=E();if(e.useMock)return p;let t=new Headers({Accept:`application/x-protobuf`});e.apiKey&&t.set(e.apiKeyHeader,e.apiKey),e.authToken&&t.set(`Authorization`,`Bearer ${e.authToken}`);try{let n=await fetch(e.url,{headers:t});if(!n.ok)throw Error(`GTFS-RT VehiclePositions request failed with ${n.status}`);return T(await n.arrayBuffer())}catch(e){return console.error(`Failed to fetch GTFS-RT VehiclePositions`,e),[]}}var O=e=>new Intl.DateTimeFormat(`ja-JP`,{hour:`2-digit`,minute:`2-digit`,hour12:!1}).format(e);function k(e){e.innerHTML=`
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Kumamoto bus ride companion</p>
        <h1>KumaNORETA</h1>
        <p>GTFS-JP と車両データを読み込んでいます。</p>
      </section>

      <section class="card">
        <h2>読み込み中</h2>
        <p class="muted">初回は静的ダイヤデータの取得に少し時間がかかることがあります。</p>
      </section>
    </main>
  `}function A(e){e.innerHTML=`
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Kumamoto bus ride companion</p>
        <h1>KumaNORETA</h1>
        <p>アプリの初期化に失敗しました。</p>
      </section>

      <section class="card">
        <h2>エラー</h2>
        <p class="muted">ページを再読み込みしても改善しない場合は、ブラウザのキャッシュ削除を試してください。</p>
      </section>
    </main>
  `}function j(e,t){return`
    <li class="candidate-item">
      <div class="candidate-item-header">
        <p class="route" style="--route-color:${e.route.color}">${e.route.shortName}</p>
        <p class="candidate-rank">候補 ${t}</p>
      </div>
      <p class="candidate-title">${e.route.longName}</p>
      <p class="muted">
        距離 約${Math.round(e.distanceMeters)}m / 信頼度 ${Math.round(e.confidence*100)}%
      </p>
      <p class="muted">${e.reason}</p>
    </li>
  `}function M(e){let{root:t,position:n,candidate:r,candidates:i,diagnostics:a,eta:o,stops:s}=e;t.innerHTML=`
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Kumamoto bus ride companion</p>
        <h1>KumaNORETA</h1>
        <p>いま乗っているバスを推定し、降車停留所への到着予想時刻を表示します。</p>
      </section>

      <section class="card grid">
        <div>
          <h2>現在位置</h2>
          <p>緯度 ${n.latitude.toFixed(4)} / 経度 ${n.longitude.toFixed(4)}</p>
          <p class="muted">精度 約${Math.round(n.accuracyMeters)}m</p>
          <p class="muted">位置ソース ${a.positionSource}</p>
        </div>
        <div>
          <h2>推定中のバス</h2>
          ${r?`<p class="route" style="--route-color:${r.route.color}">${r.route.shortName}</p>
                 <p>${r.route.longName}</p>
                 <p class="muted">
                   距離 約${Math.round(r.distanceMeters)}m / 信頼度 ${Math.round(r.confidence*100)}%
                 </p>
                 <p class="muted">${r.reason}</p>`:`<p>有力な候補はまだ見つかっていません。</p>`}
        </div>
      </section>

      <section class="card diagnostics-card">
        <div class="section-heading">
          <h2>候補診断</h2>
          <p class="muted">候補が出ないときの切り分け用です。</p>
        </div>
        <div class="diagnostics-grid">
          <p><strong>車両ソース:</strong> ${a.vehicleSource}</p>
          <p><strong>取得車両数:</strong> ${a.totalVehicles}件</p>
          <p><strong>trip/route 紐付け成功:</strong> ${a.matchedVehicles}件</p>
          <p><strong>1km以内の紐付け成功車両:</strong> ${a.nearbyMatchedVehicles}件</p>
          <p><strong>表示候補数:</strong> ${a.candidateCount}件</p>
        </div>
        ${a.note?`<p class="diagnostics-note">${a.note}</p>`:``}
      </section>

      <section class="card">
        <div class="section-heading">
          <h2>近いバス候補</h2>
          <p class="muted">GPS位置に近い順で最大3件を表示します。</p>
        </div>
        ${i.length>0?`<ol class="candidate-list">${i.map((e,t)=>j(e,t+1)).join(``)}</ol>`:`<p>近いバス候補は見つかりませんでした。</p>`}
      </section>

      <section class="card">
        <h2>降車停留所と ETA</h2>
        <label for="destination">降車停留所</label>
        <select id="destination" disabled>
          ${s.map(e=>`<option ${o?.stop.id===e.id?`selected`:``}>${e.name}</option>`).join(``)}
        </select>
        ${o?`<p class="eta">${o.stop.name} に ${O(o.estimatedArrival)} ごろ到着予定</p>
               <p class="muted">あと約${o.minutesUntilArrival}分（${o.source===`mock`?`モック計算`:`GTFS-RT`}）</p>`:`<p>先頭候補が確定したら ETA を表示します。</p>`}
      </section>
    </main>
  `}async function N(){let e=document.querySelector(`#app`);if(!e)throw Error(`App root element was not found`);k(e);let[t,n,r]=await Promise.all([g(),v(),D()]),i=t.position,a=o(i,r,n.trips,n.routes),l=a[0],u=s(i,r,n.trips,n.routes),d=new Map(n.stops.map(e=>[e.id,e])),f={...u,candidateCount:a.length,positionSource:t.source,vehicleSource:`gtfs-rt`,note:r.length>0&&u.matchedVehicles===0?`実GTFS-RTの tripId と静的GTFSのモック便データが一致していないため、候補化できていない可能性があります。`:void 0},p=l?.trip.stopIds.at(-1);M({root:e,position:i,candidate:l,candidates:a,diagnostics:f,eta:l&&p?c(l,p,n.stops):void 0,stops:l?l.trip.stopIds.map(e=>d.get(e)).filter(e=>e!==void 0):[]}),`serviceWorker`in navigator&&window.addEventListener(`load`,()=>{navigator.serviceWorker.register(`/KumaNORETA/sw.js`)})}N().catch(e=>{console.error(e);let t=document.querySelector(`#app`);t&&A(t)});