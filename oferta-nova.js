/* =========================
   Guard: precisa estar logado como Vendedor ou Trader
========================= */
(function guardVendedor() {
  try {
    const user = JSON.parse(localStorage.getItem('tri-go:auth_user') || 'null');
    const role = String(user?.role || '').trim().toLowerCase();
    const canSell = role === 'vendedor' || role === 'trader';
    if (!user || !canSell) {
      alert('Faça login como Vendedor ou Trader para publicar uma oferta.');
      location.href = 'index.html';
    }
  } catch {}
})();

/* =========================
   Helpers
========================= */
const $  = (s, r=document) => r.querySelector(s);
const onlyDigits = v => (v || '').replace(/\D+/g, '');
const debounce = (fn, t=300) => { let id; return (...a)=>{ clearTimeout(id); id=setTimeout(()=>fn(...a),t); }; };
const toFloat = (v) => {
  if (v == null) return null;
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const fmtCEPInput = (v) => {
  const d = onlyDigits(v).slice(0,8);
  return d.replace(/^(\d{5})(\d{0,3}).*/, (_,a,b)=> b ? `${a}-${b}` : a);
};
const composeLocal = ({ cidade, uf, bairro, logradouro, numero }) => {
  const p1 = [cidade, uf].filter(Boolean).join('/');
  const p2 = [bairro].filter(Boolean).join(', ');
  const p3 = [logradouro, numero].filter(Boolean).join(', ');
  return [p1, p2, p3].filter(Boolean).join(' — ');
};

/* =========================
   Google Geocoder (callback no script do Maps)
========================= */
let _geocoder = null;
window.initMaps = function initMaps() {
  try { _geocoder = new google.maps.Geocoder(); } catch {}
};

function fillAddressFields(root, { logradouro, bairro, cidade, uf, numero }) {
  const set = (sel, val) => { const el = root.querySelector(sel); if (el) el.value = val || ''; };
  set('#logradouro', logradouro ?? '');
  set('#bairro',     bairro ?? '');
  set('#cidade',     cidade ?? '');
  set('#uf',         (uf ?? '').toUpperCase());
  set('#local', composeLocal({ cidade, uf, bairro, logradouro, numero }));
}

async function resolveCep(root, cepDigits) {
  // 1) Google
  try {
    if (_geocoder) {
      const results = await new Promise((res, rej) => {
        _geocoder.geocode(
          { address: cepDigits, componentRestrictions: { country: 'BR' } },
          (r, status) => (status === 'OK' ? res(r) : rej(status))
        );
      });
      if (results?.length) {
        const comps = results[0].address_components;
        const get = (...types) => {
          const c = comps.find(x => types.some(t => x.types.includes(t)));
          return c ? { long: c.long_name, short: c.short_name } : { long: '', short: '' };
        };
        const route  = get('route').long;
        const number = get('street_number').long;
        const bairro = get('sublocality_level_1','sublocality','neighborhood','political').long;
        const cidade = get('administrative_area_level_2','locality').long;
        const uf     = get('administrative_area_level_1').short;
        fillAddressFields(root, { logradouro: route, numero: number, bairro, cidade, uf });
        return;
      }
    }
  } catch {}

  // 2) ViaCEP
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    const j = await resp.json();
    if (!j.erro) {
      fillAddressFields(root, {
        logradouro: j.logradouro,
        bairro: j.bairro,
        cidade: j.localidade,
        uf: j.uf
      });
    }
  } catch {}
}

/* =========================
   Bind das máscaras básicas
========================= */
(function bindInputs() {
  const f   = $('#form-oferta');
  const cep = $('#cep');

  if (cep) {
    cep.addEventListener('input', () => { cep.value = fmtCEPInput(cep.value); });
    const trigger = debounce(() => {
      const digits = onlyDigits(cep.value);
      if (digits.length === 8) resolveCep(f, digits);
    }, 250);
    cep.addEventListener('input', trigger);
    cep.addEventListener('keyup', trigger);
  }
})();

/* =========================
   Feedback
========================= */
const okBox  = document.querySelector('#msg-ok');
const errBox = document.querySelector('#msg-err');
function showMsg(success, text) {
  if (success) {
    if (okBox) { okBox.textContent = text; okBox.hidden = false; }
    if (errBox) errBox.hidden = true;
  } else {
    if (errBox) { errBox.textContent = text; errBox.hidden = false; }
    if (okBox) okBox.hidden = true;
  }
  (okBox || errBox)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* =========================
   Fallback OffersStore (salva em tri-go:offers_user)
   — usa se window.OffersStore não estiver definido
========================= */
(function ensureOffersStore(){
  if (window.OffersStore) return;
  const KEYS = {
    USER_OFFERS:  'tri-go:offers_user',
  };
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v || []));
  const uid  = () => (crypto.randomUUID?.() || ('offer_' + Date.now() + '_' + Math.random().toString(36).slice(2)));

  window.OffersStore = {
    upsertUserOffer(offer){
      const arr = load(KEYS.USER_OFFERS);
      // define id caso não exista
      if (!offer.id) offer.id = uid();
      const idx = arr.findIndex(o => o.id === offer.id);
      if (idx >= 0) arr[idx] = { ...arr[idx], ...offer };
      else arr.push(offer);
      save(KEYS.USER_OFFERS, arr);
      return offer;
    }
  };
})();

/* =========================
   Submit: salva no OffersStore
========================= */
document.querySelector('#form-oferta').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;

  // trava botão enquanto salva
  const submitBtn = f.querySelector('button[type="submit"]');
  const btnOld = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = 'Salvando…'; }

  try {
    const data = {
      tipoTrigo:  $('#tipo')?.value,
      safra:      $('#safra')?.value,
      cultivar:   ($('#cultivar')?.value || '').trim(),
      phMin:      toFloat($('#phMin')?.value),
      protMin:    toFloat($('#protMin')?.value),
      wMin:       toFloat($('#wMin')?.value),
      fnMin:      toFloat($('#fnMin')?.value),
      donMax:     toFloat($('#donMax')?.value),
      umiMax:     toFloat($('#umiMax')?.value),
      impMax:     toFloat($('#impMax')?.value),
      volumeTon:  toFloat($('#volume')?.value),
      precoTon:   toFloat($('#precoTon')?.value),
      cep:        ($('#cep')?.value || '').trim(),
      logradouro: ($('#logradouro')?.value || '').trim(),
      numero:     ($('#numero')?.value || '').trim(),
      bairro:     ($('#bairro')?.value || '').trim(),
      cidade:     ($('#cidade')?.value || '').trim(),
      uf:         ($('#uf')?.value || '').trim().toUpperCase(),
      local:      ($('#local')?.value || '').trim(),
      condicao:   (document.querySelector('input[name="condicao"]:checked') || {}).value || '',
    };

    // validações mínimas
    const errs = [];
    if (!data.cultivar) errs.push('Informe a cultivar.');
    if (!data.volumeTon || !Number.isFinite(data.volumeTon) || data.volumeTon <= 0) errs.push('Informe volume em toneladas (> 0).');
    if (!data.precoTon  || !Number.isFinite(data.precoTon)  || data.precoTon <= 0)  errs.push('Informe preço desejado (R$/t) (> 0).');
    if (!data.cidade && !data.uf) errs.push('Informe cidade e/ou UF.');
    if (!data.condicao) errs.push('Selecione a condição (FOB/CIF).');
    if (errs.length) { showMsg(false, errs.join(' ')); return; }

    if (!data.local) {
      data.local = composeLocal({
        cidade: data.cidade, uf: data.uf, bairro: data.bairro,
        logradouro: data.logradouro, numero: data.numero
      });
    }

    // dono logado
    const auth = JSON.parse(localStorage.getItem('tri-go:auth_user') || 'null');
    const owner = auth ? { id: auth.id || auth.email || 'user', name: auth.nome || auth.name || auth.email || 'Usuário' }
                       : { id: 'user', name: 'Usuário' };

    // objeto no formato do Store
    const offerForStore = {
      id: null, // será gerado se faltar
      type: 'sell',
      status: 'open',
      title: `${data.cultivar} • ${data.volumeTon}t • ${data.cidade || ''}${data.uf ? '-' + data.uf : ''}`.trim(),
      quantity_ton: Number(data.volumeTon),
      price_per_ton: Number(data.precoTon),
      location: { city: data.cidade || null, uf: data.uf || null },
      incoterm: data.condicao || 'FOB',
      cultivar: data.cultivar,
      harvest: data.safra || null,
      specs: {
        ph: data.phMin ?? null,
        protein: data.protMin ?? null,
        don: data.donMax ?? null,
        moisture: data.umiMax ?? null
      },
      min_lot_ton: Math.max(1, Math.floor(Number(data.volumeTon) || 1)),
      owner,
      meta: {
        wheat_type: data.tipoTrigo || null,
        w: data.wMin ?? null,
        falling_number: data.fnMin ?? null,
        cep: data.cep || null,
        endereco: data.local || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        bairro: data.bairro || null,
        img: 'img/Rectangle 160.png'
      },
      _source: 'user'
    };

    const saved = window.OffersStore.upsertUserOffer(offerForStore);
    console.log('Oferta salva:', saved);

    showMsg(true, 'Oferta salva com sucesso! Redirecionando…');
    setTimeout(() => { location.href = 'painel-vendedor.html'; }, 900);

  } catch (err) {
    console.error(err);
    showMsg(false, 'Não foi possível salvar sua oferta agora. Tente novamente.');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = btnOld; }
  }
});
