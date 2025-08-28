 type="module">
(() => {
  const MODAL = document.getElementById('modal-proposta');
  const FORM  = document.getElementById('form-proposta');
  const FEEDBACK = document.getElementById('prop-feedback');

  const INPUT_VOL   = document.getElementById('prop-volume');   // name="volume"
  const INPUT_PRECO = document.getElementById('prop-preco');    // name="preco"
  const INPUT_PRAZO = document.getElementById('prop-prazo');    // name="prazo"
  const TXT_OBS     = document.getElementById('prop-msg');      // textarea (obs)
  const H_MAX = document.getElementById('prop-max');
  const H_REF = document.getElementById('prop-ref');
  const RADIO_COND = () => MODAL.querySelector('input[name="cond"]:checked');

  // ----- storage helpers
  const PKEY = 'tri-go:proposals';
  const loadProps = () => JSON.parse(localStorage.getItem(PKEY) || '[]');
  const saveProps = (arr) => localStorage.setItem(PKEY, JSON.stringify(arr || []));

  // ----- utils
  const toNumber = (s) => {
    if (s == null) return NaN;
    const t = String(s).trim().replace(/\./g,'').replace(',', '.');
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : NaN;
  };

  const getOfferById = (id) => {
    if (window.OffersStore?.getById) return window.OffersStore.getById(id);
    const all = [
      ...(JSON.parse(localStorage.getItem('tri-go:offers_user')  || '[]')),
      ...(JSON.parse(localStorage.getItem('tri-go:offers_fixed') || '[]')),
    ];
    return all.find(o => o.id === id);
  };

  // ===== Open / Close =====
  const openModal = (offerId) => {
    MODAL.dataset.offerId = offerId || '';
    MODAL.setAttribute('aria-hidden', 'false');
    MODAL.classList.add('is-open');

    // preencher dicas com a oferta
    const offer = getOfferById(offerId);
    if (offer) {
      H_MAX.textContent = offer.quantity_ton ? `Disponível: ${offer.quantity_ton} t` : '';
      H_REF.textContent = offer.price_per_ton ? `Preço de referência: R$ ${Number(offer.price_per_ton).toLocaleString('pt-BR')}/t` : '';

      INPUT_VOL.value = '';
      INPUT_PRECO.value = offer.price_per_ton ? String(offer.price_per_ton) : '';
      INPUT_PRAZO.value = '';
      TXT_OBS.value = '';
      // marca condição conforme oferta
      MODAL.querySelectorAll('input[name="cond"]').forEach(r => r.checked = false);
      const r = offer.incoterm && MODAL.querySelector(`input[name="cond"][value="${String(offer.incoterm).toUpperCase()}"]`);
      if (r) r.checked = true;
    }

    FEEDBACK.style.display = 'none';
    setTimeout(() => INPUT_VOL?.focus(), 0);
  };

  const closeModal = () => {
    MODAL.setAttribute('aria-hidden', 'true');
    MODAL.classList.remove('is-open');
  };

  // abrir pelo botão: <button data-open-proposta="OFFER_ID">...</button>
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open-proposta]');
    if (opener) {
      e.preventDefault();
      const offerId =
        opener.getAttribute('data-open-proposta') ||
        opener.getAttribute('data-offer') ||
        new URLSearchParams(location.search).get('id');
      openModal(offerId);
    }
    if (e.target.matches('[data-close]') || e.target.closest('[data-close]')) {
      e.preventDefault();
      closeModal();
    }
  });

  // ===== Submit =====
  FORM?.addEventListener('submit', (e) => {
    e.preventDefault();

    const auth = JSON.parse(localStorage.getItem('tri-go:auth_user') || 'null');
    if (!auth) { alert('Faça login para enviar uma proposta.'); return; }

    const offerId = MODAL.dataset.offerId || new URLSearchParams(location.search).get('id');
    const offer = getOfferById(offerId);
    if (!offer) { alert('Oferta não encontrada.'); return; }

    const qtt   = toNumber(INPUT_VOL.value);
    const preco = toNumber(INPUT_PRECO.value);
    const cond  = RADIO_COND()?.value || (offer.incoterm || 'FOB');
    const prazo = INPUT_PRAZO.value.trim();
    const obs   = TXT_OBS.value.trim();

    const errs = [];
    if (!(qtt > 0))   errs.push('Informe o volume em toneladas.');
    if (!(preco > 0)) errs.push('Informe o valor por tonelada.');
    if (!cond)        errs.push('Selecione a condição (FOB/CIF).');
    if (errs.length) {
      FEEDBACK.textContent = errs.join(' ');
      FEEDBACK.style.display = 'block';
      FEEDBACK.style.color = '#c0392b';
      return;
    }

    const proposal = {
      id: crypto.randomUUID?.() || ('prop_' + Date.now()),
      created_at: new Date().toISOString(),
      status: 'pending',
      to_offer_id: offer.id,
      to_offer_title: offer.title || `${offer.cultivar} • ${offer.quantity_ton}t`,
      to_owner: { id: offer.owner?.id, name: offer.owner?.name || '' },
      from_user: { id: auth.id, name: auth.nome || auth.name || auth.email, email: auth.email },
      quantity_ton: qtt,
      price_per_ton: preco,
      incoterm: cond,
      prazo,
      message: obs
    };

    const arr = loadProps(); arr.push(proposal); saveProps(arr);
    // avisa o painel do vendedor (se ele escutar)
    if (window.OffersStore?.emit) window.OffersStore.emit('changed');

    FEEDBACK.textContent = 'Proposta enviada com sucesso!';
    FEEDBACK.style.display = 'block';
    FEEDBACK.style.color = '#2e7d32';
    FORM.reset();
    setTimeout(closeModal, 700);
  });
})();
