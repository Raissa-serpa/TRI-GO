// assets/js/painel-vendedor.js
(function () {
  // ------- anchors na página
  const GRID_ID  = '#lista-anuncios';    // coluna da esquerda (minhas ofertas)
  const PROP_ID  = '#lista-propostas';   // coluna da direita (propostas recebidas)
  const COUNT_ID = '#count-pendentes';   // badge/contador no topo

  const grid  = document.querySelector(GRID_ID);
  const propC = document.querySelector(PROP_ID);
  const count = document.querySelector(COUNT_ID);
  if (!grid) console.warn('[painel] #lista-anuncios não encontrado; renderizando só propostas.');

  // ------- autenticação
  const auth = JSON.parse(localStorage.getItem('tri-go:auth_user') || 'null');
  if (!auth) {
    if (grid)  grid.innerHTML = '<div class="empty" style="opacity:.75;padding:16px;">Faça login para ver seus anúncios.</div>';
    if (count) count.textContent = '0';
    if (propC) propC.innerHTML = '<div class="empty" style="opacity:.75;">Sem propostas pendentes.</div>';
    return;
  }

  const meKey = String(auth.id || auth.email || '').toLowerCase();
  const BRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                    .format(Number(v || 0));

  // =========================
  // Storage helpers (Proposals)
  // =========================
  const PKEY = 'tri-go:proposals';
  const loadProps = () => JSON.parse(localStorage.getItem(PKEY) || '[]');
  const saveProps = (arr) => localStorage.setItem(PKEY, JSON.stringify(arr || []));
  const setPropStatus = (id, status) => {
    const arr = loadProps();
    const i = arr.findIndex(p => p.id === id);
    if (i >= 0) {
      arr[i].status = status; // 'accepted' | 'declined'
      arr[i].updated_at = new Date().toISOString();
      saveProps(arr);
    }
  };

  // =========================
  // Ofertas do vendedor (Store + LocalStorage)
  // =========================
  const isMineOffer = (o) => {
    const ownerId    = String(o?.owner?.id || '').toLowerCase();
    const ownerEmail = String(o?.owner?.email || '').toLowerCase();
    return ownerId === meKey || ownerEmail === meKey;
  };

  function dedupeById(arr) {
    const map = new Map();
    for (const item of arr) {
      const key = item?.id || `noid_${Math.random().toString(36).slice(2)}`;
      // preferência para o que tiver timestamps/meta mais novo
      if (!map.has(key)) { map.set(key, item); continue; }
      const a = map.get(key);
      const ta = new Date(a?.updated_at || a?.meta?.updated_at || a?.created_at || a?.meta?._createdAt || 0).getTime();
      const tb = new Date(item?.updated_at || item?.meta?.updated_at || item?.created_at || item?.meta?._createdAt || 0).getTime();
      if (tb >= ta) map.set(key, item);
    }
    return [...map.values()];
  }

  function loadMyOffers() {
    const fromStore = window.OffersStore?.list?.({ source:'user', type:'sell' }) || [];
    const fromLS    = JSON.parse(localStorage.getItem('tri-go:offers_user') || '[]');
    const all       = dedupeById([...fromStore, ...fromLS]);

    return all
      .filter(isMineOffer)
      .sort((a, b) => {
        const ta = new Date(a?.updated_at || a?.meta?.updated_at || a?.meta?._createdAt || a?.created_at || 0).getTime();
        const tb = new Date(b?.updated_at || b?.meta?.updated_at || b?.meta?._createdAt || b?.created_at || 0).getTime();
        return tb - ta;
      });
  }

  // =========================
  // Propostas recebidas (pendentes)
  // =========================
  function loadPendingProposals() {
    const myOffers = loadMyOffers();
    const idSet = new Set(myOffers.map(o => o.id));
    const all = loadProps();

    return all.filter(p => {
      const isMineByOffer = idSet.size && idSet.has(p?.to_offer_id);
      const isMineByOwner = [p?.to_owner?.id, p?.to_owner?.email]
        .some(v => String(v || '').toLowerCase() === meKey);
      const status = (p?.status || 'pending').toLowerCase();
      const isPending = status === 'pending';
      return isPending && (isMineByOffer || isMineByOwner);
    });
  }

  // =========================
  // Renderizadores
  // =========================
  const propCard = (p) => `
    <div class="proposal-item">
      <div class="proposal-head">
        <b>${p?.from_user?.name || p?.from_user?.email || 'Comprador'}</b>
        <small>${new Date(p?.created_at || Date.now()).toLocaleString('pt-BR')}</small>
      </div>
      <div class="proposal-body">
        <div><b>Oferta:</b> ${p?.to_offer_title || p?.to_offer_id || '-'}</div>
        <div><b>Quantidade:</b> ${p?.quantity_ton || 0} t</div>
        <div><b>Preço:</b> ${BRL(p?.price_per_ton)}</div>
        <div><b>Total:</b> ${BRL((p?.quantity_ton || 0) * (p?.price_per_ton || 0))}</div>
      </div>
      <div class="proposal-actions">
        <button class="btn-accept" data-action="accept" data-id="${p.id}">ACEITAR</button>
        <button class="btn-decline" data-action="decline" data-id="${p.id}">RECUSAR</button>
      </div>
    </div>
  `;

  function renderProposals() {
    if (!propC) return;
    const pend = loadPendingProposals();
    if (count) count.textContent = String(pend.length);
    propC.innerHTML = pend.length
      ? pend.map(propCard).join('')
      : '<div class="empty" style="opacity:.75;">Sem propostas pendentes.</div>';
  }

  const offerCard = (o) => {
    const loc = [o?.location?.city, o?.location?.uf].filter(Boolean).join('-') || (o?.meta?.endereco || '-');
    const qty = (o?.quantity_ton ?? o?.meta?.quantity_ton ?? '-');
    const price = BRL(o?.price_per_ton ?? o?.meta?.price_per_ton ?? 0);
    const incoterm = o?.incoterm || o?.meta?.incoterm || '';
    const title = o?.title || [o?.cultivar, `${qty}t`, loc].filter(Boolean).join(' • ');
    const when = new Date(o?.updated_at || o?.meta?.updated_at || o?.created_at || o?.meta?._createdAt || Date.now()).toLocaleString('pt-BR');

    return `
      <div class="offer-card">
        <div class="offer-head">
          <b>${title}</b>
          <small>${when}</small>
        </div>
        <div class="offer-body">
          <div><b>Preço:</b> ${price}</div>
          <div><b>Quantidade:</b> ${qty} t</div>
          <div><b>Incoterm:</b> ${incoterm}</div>
          <div><b>Local:</b> ${loc}</div>
        </div>
      </div>
    `;
  };

  function renderOffers() {
    if (!grid) return; // se não existir, só não renderiza
    const mine = loadMyOffers();
    grid.innerHTML = mine.length
      ? mine.map(offerCard).join('')
      : '<div class="empty" style="opacity:.75;padding:16px;">Você ainda não publicou ofertas.</div>';
  }

  // =========================
  // Ações (aceitar/recusar)
  // =========================
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action][data-id]');
    if (!btn) return;
    const id  = btn.getAttribute('data-id');
    const act = btn.getAttribute('data-action');
    if (act === 'accept') setPropStatus(id, 'accepted');
    if (act === 'decline') setPropStatus(id, 'declined');
    renderProposals();
  });

  // Reagir a mudanças externas (outras abas/rotinas)
  window.addEventListener('storage', (e) => {
    if (e.key === PKEY) renderProposals();
    if (e.key === 'tri-go:offers_user') renderOffers();
  });

  // Se a Store emitir eventos, reagir também
  if (window.OffersStore?.on) window.OffersStore.on('changed', () => { renderOffers(); renderProposals(); });

  // =========================
  // Boot
  // =========================
  function renderAll() {
    try { if (typeof renderOffers === 'function') renderOffers(); } catch (_) {}
    renderProposals();
  }
  renderAll();
})();
