/* ============================================================
   SIMULADOR DE FRETE – TRI-GO
   Dependências na página:
   - Google Maps JS (window.geocoder) OU fallback Haversine
   - Modal HTML #modal-frete
   - Botão #btn-open-frete
   - Objeto global window.TGOFERTA { volumeTon, origemCep, origemTexto }
============================================================ */

/* ===== CONFIG ===== */
const PRICING_MODE = "per_ton"; // "per_ton" (valor/ton) ou "per_truck"
const GMAPS_DISTANCE_API_KEY = "AIzaSyDM0_zfY0C026BnwXSuTFbjgKXhSv8Wgo4"; // opcional (usa Distance Matrix); fallback = Haversine

/* Capacidade por tipo de caminhão (ton) */
const TRUCKS = [
  { key: "8T",  label: "8Ton (TOCO)",        capacity: 8  },
  { key: "14T", label: "14Ton (TRUCK)",      capacity: 14 },
  { key: "26T", label: "26Ton (CARRETA)",    capacity: 26 },
  { key: "32T", label: "32Ton (LS)",         capacity: 32 },
  { key: "37T", label: "37Ton (BITREM)",     capacity: 37 },
  { key: "49T", label: "49Ton (RODOTREM)",   capacity: 49 },
];

/* Tabela: valor (R$) por TONELADA por faixa de distância e tipo */
const FRETE_TABLE = [
  { range:[   0,  50], R:{ "8T":127.69,"14T":83.56,"26T":63.58,"32T":63.12,"37T":46.81,"49T":43.23 } },
  { range:[  51, 100], R:{ "8T":225.44,"14T":150.08,"26T":70.17,"32T":110.68,"37T":85.78,"49T":79.63 } },
  { range:[ 101, 150], R:{ "8T":265.61,"14T":214.57,"26T":134.96,"32T":135.14,"37T":103.23,"49T":114.14 } },
  { range:[ 151, 200], R:{ "8T":346.31,"14T":219.01,"26T":157.31,"32T":158.61,"37T":147.98,"49T":114.53 } },
  { range:[ 201, 250], R:{ "8T":343.43,"14T":230.14,"26T":158.17,"32T":143.34,"37T":136.95,"49T":122.54 } },
  { range:[ 251, 300], R:{ "8T":448.08,"14T":288.34,"26T":217.99,"32T":171.56,"37T":163.65,"49T":164.77 } },
  { range:[ 301, 350], R:{ "8T":472.48,"14T":284.20,"26T":247.91,"32T":198.94,"37T":188.19,"49T":182.70 } },
  { range:[ 351, 400], R:{ "8T":449.62,"14T":297.49,"26T":229.72,"32T":189.31,"37T":179.08,"49T":154.54 } },
  { range:[ 401, 450], R:{ "8T":464.58,"14T":318.57,"26T":303.05,"32T":209.06,"37T":200.90,"49T":159.28 } },
  { range:[ 451, 500], R:{ "8T":539.40,"14T":354.46,"26T":233.19,"32T":232.62,"37T":221.59,"49T":176.13 } },
  { range:[ 501, 550], R:{ "8T":593.34,"14T":389.91,"26T":256.51,"32T":255.88,"37T":243.75,"49T":193.74 } },
  { range:[ 551, 600], R:{ "8T":608.93,"14T":432.22,"26T":283.83,"32T":283.64,"37T":270.36,"49T":209.49 } },
  { range:[ 601, 650], R:{ "8T":669.55,"14T":475.67,"26T":311.81,"32T":311.70,"37T":297.36,"49T":227.49 } },
  { range:[ 651, 700], R:{ "8T":724.81,"14T":514.92,"26T":331.51,"32T":336.94,"37T":317.67,"49T":249.47 } },
  { range:[ 701, 750], R:{ "8T":792.68,"14T":550.90,"26T":362.56,"32T":368.49,"37T":338.15,"49T":272.82 } },
  { range:[ 751, 800], R:{ "8T":832.65,"14T":578.67,"26T":360.06,"32T":360.06,"37T":355.20,"49T":286.58 } },
  { range:[ 801, 850], R:{ "8T":823.31,"14T":588.08,"26T":379.99,"32T":375.64,"37T":351.58,"49T":302.44 } },
  { range:[ 851, 900], R:{ "8T":871.74,"14T":622.67,"26T":402.34,"32T":397.73,"37T":372.26,"49T":320.23 } },
  { range:[ 901, 950], R:{ "8T":920.17,"14T":657.26,"26T":424.69,"32T":419.83,"37T":392.94,"49T":338.03 } },
  { range:[ 951,1000], R:{ "8T":968.60,"14T":678.02,"26T":546.09,"32T":443.70,"37T":447.70,"49T":386.35 } },
  { range:[1001,1050], R:{ "8T":991.60,"14T":711.92,"26T":582.95,"32T":465.89,"37T":470.08,"49T":405.67 } },
  { range:[1051,1100], R:{ "8T":1038.82,"14T":745.82,"26T":610.71,"32T":479.94,"37T":492.47,"49T":424.99 } },
  { range:[1101,1150], R:{ "8T":1083.26,"14T":778.13,"26T":628.01,"32T":501.75,"37T":514.85,"49T":444.30 } },
];

/* ===== Helpers DOM/format ===== */
const $ = (s, r=document)=>r.querySelector(s);
const formatBRL = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const round2 = n => Math.round((+n + Number.EPSILON)*100)/100;

/* Lê os campos do destino e retorna {cep, texto} */
function lerEnderecoDestino(){
  const cepRaw = $('#frete-cep')?.value || '';
  const cep    = cepRaw.replace(/\D/g,'');
  const rua    = $('#frete-rua')?.value?.trim() || '';
  const numero = $('#frete-num')?.value?.trim() || '';
  const bairro = $('#frete-bairro')?.value?.trim() || '';
  const cidade = $('#frete-cidade')?.value?.trim() || '';
  const uf     = $('#frete-uf')?.value?.trim() || '';
  const ruaNum = [rua, numero].filter(Boolean).join(', ');
  const resto  = [bairro, cidade, uf].filter(Boolean).join(' - ');
  return {
    cep: cep.length === 8 ? cep : null,
    texto: [ruaNum, resto].filter(Boolean).join(' | ')
  };
}

/* ===== Modal open/close ===== */
(function setupModal(){
  const modal = $('#modal-frete');
  $('#btn-open-frete')?.addEventListener('click', () => {
    preloadUserCep();
    buildTruckSelect();
    modal?.setAttribute('aria-hidden','false');
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
  });
  modal?.addEventListener('click', e=>{
    if (e.target.matches('[data-close], .tg-modal')) {
      modal.setAttribute('aria-hidden','true');
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
    }
  });
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && modal?.getAttribute('aria-hidden') === 'false'){
      modal.setAttribute('aria-hidden','true');
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
    }
  });
})();

/* ===== Sugestão de caminhão pelo volume ===== */
function buildTruckSelect(){
  const sel = $('#frete-truck');
  if (!sel) return;
  sel.innerHTML = TRUCKS.map(t=>`<option value="${t.key}">${t.label}</option>`).join('');
  const v = Number(window.TGOFERTA?.volumeTon || 0);
  const sug = TRUCKS.find(t => v && v <= t.capacity) || TRUCKS[TRUCKS.length-1];
  sel.value = sug.key;
}

/* ===== CEP do usuário para pré-preencher ===== */
function preloadUserCep(){
  try{
    const user = JSON.parse(localStorage.getItem('tri-go:auth_user')||'null');
    if (user?.cep){
      const el = $('#frete-cep');
      if (el){
        el.value = String(user.cep).replace(/\D/g,'').replace(/^(\d{5})(\d{0,3}).*/, (_,a,b)=>b?`${a}-${b}`:a);
        el.dispatchEvent(new Event('input', {bubbles:true})); // dispara auto-preencher (ou geocode na página)
      }
    }
  }catch{}
}

/* ===== Formulário / Botão: calcular ===== */
(function(){
  async function calcular(ev){
    ev?.preventDefault?.();

    const truckKey = $('#frete-truck').value;
    const destino  = lerEnderecoDestino();
    if (!destino?.texto && !destino?.cep) {
      alert('Informe um CEP ou endereço de destino.');
      return;
    }

    try{
      const { km, faixa } = await obterDistanciaFaixa(window.TGOFERTA, destino);
      $('#frete-dist').textContent  = `${km.toLocaleString('pt-BR')} km`;
      $('#frete-faixa').textContent = faixa ? `${faixa.range[0]}-${faixa.range[1]} km` : '—';

      if (!faixa || !faixa.R || !(truckKey in faixa.R)) {
        $('#frete-total').textContent = '—';
        return;
      }

      const valorTabela = faixa.R[truckKey];
      const total = calcularFreteTotal(
        valorTabela,
        truckKey,
        Number(window.TGOFERTA?.volumeTon || 0)
      );

      $('#frete-total').textContent = formatBRL(total);

      // habilita os botões de gerar contrato
      document.getElementById('btn-modal-gerar')?.removeAttribute('disabled');
      document.getElementById('btn-gerar-contrato')?.removeAttribute('disabled');

    }catch(err){
      console.error(err);
      alert('Não foi possível calcular o frete. Verifique os endereços e tente novamente.');
    }
  }

  // submit do formulário
  document.getElementById('form-frete')?.addEventListener('submit', calcular);

  // botão "SIMULAR FRETE..." dispara o submit
  const form = document.getElementById('form-frete');
  const btn  = document.getElementById('btn-calc-frete');
  if (form && btn) {
    btn.addEventListener('click', () => {
      if (form.requestSubmit) form.requestSubmit();
      else form.dispatchEvent(new Event('submit', {cancelable:true, bubbles:true}));
    });
  }
})();

/* ===== Distância & Geocoding ===== */
async function obterDistanciaFaixa(oferta, destino){
  const km = await estimarDistanciaKm(oferta, destino);
  const faixa = pickFaixa(km);
  if (!faixa) throw new Error('Distância fora da tabela configurada');
  return { km, faixa };
}

async function estimarDistanciaKm(oferta, destino){
  const origem = await geocodeOrigem(oferta);
  const dest   = await geocodeDestino(destino);
  if (!origem || !dest) throw new Error('Falha ao geocodificar origem/destino');

  // 1) Distance Matrix (se chave disponível). Pode sofrer CORS; se falhar, cai no Haversine.
  if (GMAPS_DISTANCE_API_KEY){
    try{
      const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      url.searchParams.set('origins', `${origem.lat},${origem.lng}`);
      url.searchParams.set('destinations', `${dest.lat},${dest.lng}`);
      url.searchParams.set('units','metric');
      url.searchParams.set('key', GMAPS_DISTANCE_API_KEY);
      const data = await fetch(url).then(r=>r.json());
      const el = data?.rows?.[0]?.elements?.[0];
      const meters = el?.distance?.value;
      if (meters) return Math.round(meters/1000);
    }catch(e){ /* fallback abaixo */ }
  }

  // 2) Haversine (aproximação)
  return Math.round(haversineKm(origem.lat,origem.lng,dest.lat,dest.lng));
}

async function geocodeOrigem(oferta){
  if (!oferta) return null;
  if (oferta.origemLatLng) return oferta.origemLatLng;
  if (oferta.origemCep)    return await geocodeByText(oferta.origemCep);
  if (oferta.origemTexto)  return await geocodeByText(oferta.origemTexto);
  return null;
}
async function geocodeDestino(d){
  if (d?.cep)   return await geocodeByText(d.cep);
  if (d?.texto) return await geocodeByText(d.texto);
  return null;
}

async function geocodeByText(text){
  // Google Geocoder (se carregado via initMaps)
  if (window.geocoder){
    const p = new Promise((resolve)=>{
      window.geocoder.geocode({ address: text, componentRestrictions:{ country:'BR' }}, (res, status)=>{
        if (status === 'OK' && res?.[0]?.geometry?.location){
          const g = res[0].geometry.location;
          resolve({ lat: g.lat(), lng: g.lng() });
        }else resolve(null);
      });
    });
    const g = await p;
    if (g) return g;
  }

  // Fallback: Nominatim (OSM)
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', text);
  url.searchParams.set('format','json');
  url.searchParams.set('countrycodes','br');
  url.searchParams.set('limit','1');
  const r = await fetch(url, { headers:{ 'Accept-Language':'pt-BR', 'User-Agent':'tri-go/1.0' }});
  const j = await r.json();
  if (j?.[0]) return { lat:+j[0].lat, lng:+j[0].lon };
  return null;
}

function haversineKm(lat1,lon1,lat2,lon2){
  const R=6371,toRad=v=>v*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

/* ===== Faixa & cálculo ===== */
function pickFaixa(km){
  return FRETE_TABLE.find(f => km >= f.range[0] && km <= f.range[1]) || null;
}
function calcularFreteTotal(valorTabela, truckKey, volumeTon){
  if (!Number.isFinite(valorTabela)) return 0;
  volumeTon = Number(volumeTon||0);

  if (PRICING_MODE === "per_ton"){
    return round2(valorTabela * volumeTon);
  }else{
    const cap = TRUCKS.find(t=>t.key===truckKey)?.capacity ?? 1;
    const viagens = Math.ceil(volumeTon / cap);
    return round2(valorTabela * viagens);
  }
}
