(() => {
  const LIST_ID  = '#lista-propostas';
  const COUNT_ID = '#count-pendentes';

  const listEl  = document.querySelector(LIST_ID);
  const countEl = document.querySelector(COUNT_ID);
  if (!listEl) return;

  // helpers
  const BRL = v => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })
                    .format(Number(v || 0));
  const fmtDate = iso => {
    try { return new Date(iso).toLocaleString('pt-BR'); }
    catch { return ''; }
  };

  // auth
  const auth = JSON.parse(localStorage.getItem('tri-go:auth_user') || 'null');
  if (!auth) {
    if (countEl) countEl.textContent = '0';
    listEl.innerHTML = '<div class="empty" style="opacity:.75;">Faça login para ver suas propostas.</div>';
    return;
  }
  const myKey = String(auth.id || auth.email || '').toLowerCase();

  // store helpers
  const PKEY = 'tri-go:proposals';
  const loadProps = () => JSON.parse(localStorage.getItem(PKEY) || '[]');
  const saveProps = arr => localStorage.setItem(PKEY, JSON.stringify(arr || []));

  // minhas ofertas (IDs)
function loadMyOfferIds() {
  const fromStore = window.OffersStore?.list?.({ source:'user', type:'sell' }) || [];
  const fromLS    = JSON.parse(localStorage.getItem('tri-go:offers_user') || '[]');
  const all       = [...fromStore, ...fromLS];

  return all
    .filter(o => {
      const ownerId    = String(o?.owner?.id || '').toLowerCase();
      const ownerEmail = String(o?.owner?.email || '').toLowerCase();
      return ownerId === myKey || ownerEmail === myKey;
    })
    .map(o => o.id);
}

// dentro de loadPendingProposals(), troque a linha do toMeByOwner por:
const toMeByOwner = [p?.to_owner?.id, p?.to_owner?.email]
  .some(v => String(v||'').toLowerCase() === myKey);

  function loadPendingProposals() {
    const myOfferIds = new Set(loadMyOfferIds());
    const all = loadProps();
    // Pertencem a mim se apontam para uma das minhas ofertas OU se to_owner.id == meu id
    return all.filter(p => {
      const toMeByOffer = myOfferIds.has(p?.to_offer_id);
      const toMeByOwner = String(p?.to_owner?.id || '').toLowerCase() === myKey;
      const isPending   = (p?.status || 'pending') === 'pending';
      return isPending && (toMeByOffer || toMeByOwner);
    });
  }

  // ações
  function setStatus(id, status) {
    const arr = loadProps();
    const i = arr.findIndex(p => p.id === id);
    if (i >= 0) {
      arr[i].status = status; // 'accepted' | 'declined'
      arr[i].updated_at = new Date().toISOString();
      saveProps(arr);
      if (window.OffersStore?.emit) window.OffersStore.emit('changed');
    }
    render();
  }

  // UI
  const card = (p) => `
    <div class="proposal-item">
      <div class="proposal-head">
        <b>${p?.from_user?.name || p?.from_user?.email || 'comprador'}</b>
        <small>${fmtDate(p?.created_at || Date.now())}</small>
      </div>

      <div class="proposal-body">
        <div><b>Oferta:</b> ${p?.to_offer_title || p?.to_offer_id || '-'}</div>
        <div class="proposal-grid">
          <div><b>Quantidade:</b> ${p?.quantity_ton || 0} t</div>
          <div><b>Preço:</b> ${BRL(p?.price_per_ton)} / t</div>
          <div><b>Total:</b> ${BRL((p?.quantity_ton||0) * (p?.price_per_ton||0))}</div>
          <div><b>Condição:</b> ${p?.incoterm || p?.meta?.incoterm || '-'}</div>
          <div><b>Prazo:</b> ${p?.prazo || p?.meta?.prazo || '-'}</div>
        </div>
        ${p?.message ? `<div class="proposal-note"><b>Obs.:</b> ${p.message}</div>` : ''}
      </div>

      <div class="proposal-actions">
        <button class="btn-accept" data-action="accept" data-id="${p.id}">ACEITAR</button>
        <button class="btn-decline" data-action="decline" data-id="${p.id}">RECUSAR</button>
      </div>
    </div>
  `;

  function render() {
    const pend = loadPendingProposals();
    if (countEl) countEl.textContent = String(pend.length);
    listEl.innerHTML = pend.length
      ? pend.map(card).join('')
      : '<div class="empty" style="opacity:.75;">Sem propostas pendentes.</div>';
  }

  // delegação de clique (aceitar/recusar)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action][data-id]');
    if (!btn || !listEl.contains(btn)) return;
    const id = btn.getAttribute('data-id');
    const act = btn.getAttribute('data-action');
    if (act === 'accept') setStatus(id, 'accepted');
    if (act === 'decline') setStatus(id, 'declined');
  });

  if (window.OffersStore?.on) window.OffersStore.on('changed', render);
  render();
})();
