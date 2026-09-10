
/* BT42.195km Race — merged official Google traces + water kiosks */
(function () {
  // Trace A https://maps.app.goo.gl/R5KA2vtMYTFCWaCq5
  const TRACE_A = [
    [-15.8007524, 35.0219295],
    [-15.8016333, 35.0359899],
    [-15.8019151, 35.0504419],
    [-15.8045083, 35.0430229],
    [-15.8067172, 35.0427235],
    [-15.8069579, 35.0427093]
  ];
  // Trace B https://maps.app.goo.gl/CZbQSw1uRiY3QxgBA
  const TRACE_B = [
    [-15.8072469, 35.0426382],
    [-15.8097017, 35.0426429],
    [-15.8098938, 35.0133031],
    [-15.8047091, 35.0104083],
    [-15.8004905, 35.0193305],
    [-15.7936569, 35.0121197],
    [-15.7880388, 35.013536],
    [-15.800727, 35.0219592]
  ];
  const START = TRACE_A[0];
  const FINISH = [-15.79889, 35.03450];
  const ROUTE = TRACE_A.concat(TRACE_B).concat([
    [-15.8002, 35.0265],
    [-15.7985, 35.0318],
    FINISH
  ]);
  const KIOSKS = [
    { name: 'Water kiosk — Kwacha Roundabout', latlng: [-15.8097017, 35.0426429] },
    { name: 'Water kiosk — Kamba Stereo', latlng: [-15.7880388, 35.013536] },
    { name: 'Water kiosk — CFAO Mandala', latlng: [-15.7936569, 35.0121197] },
    { name: 'Water kiosk — Trade Fair Grounds entrance', latlng: [-15.8016333, 35.0359899] }
  ];

  let map;
  function kioskIcon() {
    return L.divIcon({
      className: '',
      html: '<div class="kiosk-icon">⌂</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });
  }

  function initMap() {
    const el = document.getElementById('bt42-gis-map');
    if (!el || typeof L === 'undefined') return;
    if (map) { map.invalidateSize(); return; }
    map = L.map('bt42-gis-map', { zoomControl: true, attributionControl: true });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics'
    }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      opacity: 0.9
    }).addTo(map);
    const lineA = L.polyline(TRACE_A, { color: '#f4d03f', weight: 5, opacity: 0.95 }).addTo(map);
    const lineB = L.polyline(TRACE_B, { color: '#f39c12', weight: 5, opacity: 0.95 }).addTo(map);
    L.polyline([TRACE_A[TRACE_A.length - 1], TRACE_B[0]], { color: '#f4d03f', weight: 5, opacity: 0.95 }).addTo(map);
    L.polyline([TRACE_B[TRACE_B.length - 1], [-15.8002, 35.0265], [-15.7985, 35.0318], FINISH], {
      color: '#e74c3c', weight: 4, opacity: 0.95, dashArray: '8 6'
    }).addTo(map);
    L.circleMarker(START, { radius: 8, color: '#145a32', fillColor: '#27AE60', fillOpacity: 1 }).addTo(map)
      .bindPopup('<strong>START</strong><br>Ginnery Corner · NBS / ShopRite<br>−15.80075, 35.02193');
    L.circleMarker(FINISH, { radius: 8, color: '#7b241c', fillColor: '#C0392B', fillOpacity: 1 }).addTo(map)
      .bindPopup('<strong>FINISH</strong><br>Kamuzu Stadium VIP');
    KIOSKS.forEach((k) => {
      L.marker(k.latlng, { icon: kioskIcon() }).addTo(map)
        .bindPopup('<strong>' + k.name + '</strong><br>Aid / water station');
    });
    const all = TRACE_A.concat(TRACE_B).concat([FINISH]);
    map.fitBounds(L.latLngBounds(all).pad(0.1));
    setTimeout(function () { map.invalidateSize(); }, 300);
  }

  window.BT42_initCourseMap = initMap;
  document.addEventListener('DOMContentLoaded', function () {
    if ((location.hash || '').indexOf('course') >= 0) initMap();
  });
  window.addEventListener('hashchange', function () {
    if ((location.hash || '').indexOf('course') >= 0) setTimeout(initMap, 50);
  });
})();
