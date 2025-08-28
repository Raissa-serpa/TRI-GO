(function (global) {
  'use strict';

  const LS_KEYS = {
    FIXED: 'tri-go:offers_fixed',
    USER: 'tri-go:offers_user',
    PROPOSALS: 'tri-go:proposals',
    VERSION: 'tri-go:store_version',
  };
  const STORE_VERSION = 1;

  // Utils
  const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,10)}_${Date.now().toString(36)}`;
  const nowISO = () => new Date().toISOString();
  const readLS = (k, fb) => { try { const r = localStorage.getItem(k); return r? JSON.parse(r): fb; } catch { return fb; } };
  const writeLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // Emitter simples
  const listeners = {};
  function on(evt, cb){ (listeners[evt] ||= []).push(cb); }
  function emit(evt, payload){ (listeners[evt]||[]).forEach(fn => { try{ fn(clone(payload)); }catch{} }); }
  window.addEventListener('storage', (e) => {
    if ([LS_KEYS.FIXED, LS_KEYS.USER, LS_KEYS.PROPOSALS].includes(e.key)) emit('changed', { key: e.key });
  });

  // Modelo
  function normalizeOffer(o){
    const now = nowISO();
    return {
      id: o.id || uid('offer'),
      type: (o.type || 'sell').toLowerCase(),              // 'sell' | 'buy'
      title: o.title || 'Oferta de Trigo',
      status: (o.status || 'open').toLowerCase(),          // 'open' | 'negotiating' | 'closed'
      cultivar: o.cultivar || null,
      harvest: o.harvest || null,
      specs: {
        ph: o?.specs?.ph ?? null,
        protein: o?.specs?.protein ?? null,
        don: o?.specs?.don ?? null,
        moisture: o?.specs?.moisture ?? null,
      },
      quantity_ton: Number(o.quantity_ton || 0),
      price_per_ton: Number(o.price_per_ton || 0),
      pricing_mode: o.pricing_mode || 'per_ton',
      min_lot_ton: Number(o.min_lot_ton || 1),
      location: o.location || { city: null, uf: null, state: null, coords: null },
      incoterm: o.incoterm || 'FOB',
      owner: o.owner || { id: 'system', name: 'TRI-GO' },
      visibility: o.visibility || 'public',
      created_at: o.created_at || now,
      updated_at: o.updated_at || now,
      meta: o.meta || {},
      _source: o._source || 'fixed',                        // 'fixed' | 'user'
    };
  }

  function validateOffer(o){
    const errors = [];
    if (!o.title) errors.push('title');
    if (!['sell','buy'].includes(o.type)) errors.push('type');
    if (!o.quantity_ton || o.quantity_ton <= 0) errors.push('quantity_ton');
    if (!o.price_per_ton || o.price_per_ton <= 0) errors.push('price_per_ton');
    if (!o.location || (!o.location.city && !o.location.uf)) errors.push('location');
    return errors;
  }

  // Store interno
  function loadAll(){
    return {
      fixed: readLS(LS_KEYS.FIXED, []),
      user: readLS(LS_KEYS.USER, []),
      proposals: readLS(LS_KEYS.PROPOSALS, []),
    };
  }
  function saveAll({ fixed, user, proposals }){
    writeLS(LS_KEYS.FIXED, fixed || []);
    writeLS(LS_KEYS.USER, user || []);
    writeLS(LS_KEYS.PROPOSALS, proposals || []);
    emit('changed', { key: 'all' });
  }
  function migrateIfNeeded(){
    const v = readLS(LS_KEYS.VERSION, 0);
    if (v < STORE_VERSION){
      // futuras migrações...
      writeLS(LS_KEYS.VERSION, STORE_VERSION);
    }
  }

  // API pública
  const OffersStore = {
    init({ seedFixedOffers = [] } = {}){
      migrateIfNeeded();
      const { fixed, user, proposals } = loadAll();
      if (!fixed || fixed.length === 0){
        const seeded = seedFixedOffers.map(o => normalizeOffer({ ...o, _source:'fixed' }));
        // (opcional) validação no seed
        saveAll({ fixed: seeded, user: user||[], proposals: proposals||[] });
      }
      return this;
    },

    on,

    list(filters = {}){
      const { fixed, user } = loadAll();
      let arr = [...fixed, ...user];
      const {
        type, status, uf, city, source, q, ownerId,
        sortBy = 'updated_at',
        sortDir = 'desc'
      } = filters;

      if (type)   arr = arr.filter(o => o.type === type);
      if (status) arr = arr.filter(o => o.status === status);
      if (source) arr = arr.filter(o => o._source === source);
      if (ownerId)arr = arr.filter(o => o.owner?.id === ownerId);
      if (uf)     arr = arr.filter(o => (o.location?.uf || o.location?.state) === uf);
      if (city)   arr = arr.filter(o => (o.location?.city||'').toLowerCase() === city.toLowerCase());
      if (q){
        const t = q.toLowerCase();
        arr = arr.filter(o =>
          (o.title||'').toLowerCase().includes(t) ||
          (o.cultivar||'').toLowerCase().includes(t)
        );
      }

      arr.sort((a,b) => {
        const A = a[sortBy], B = b[sortBy];
        if (A === B) return 0;
        return (sortDir === 'asc') ? (A > B ? 1 : -1) : (A < B ? 1 : -1);
      });

      return arr.map(clone);
    },

    getById(id){
      const { fixed, user } = loadAll();
      const found = [...fixed, ...user].find(o => o.id === id);
      return found ? clone(found) : null;
    },

    upsertUserOffer(partial){
      const { fixed, user, proposals } = loadAll();
      const isNew = !partial.id;
      let obj;

      if (isNew){
        obj = normalizeOffer({ ...partial, _source: 'user' });
        const errs = validateOffer(obj);
        if (errs.length) throw new Error('Campos inválidos: ' + errs.join(', '));
        user.push(obj);
      } else {
        const idx = user.findIndex(o => o.id === partial.id);
        if (idx === -1) throw new Error('Oferta do usuário não encontrada');
        obj = normalizeOffer({ ...user[idx], ...partial, _source: 'user', updated_at: nowISO() });
        const errs = validateOffer(obj);
        if (errs.length) throw new Error('Campos inválidos: ' + errs.join(', '));
        user[idx] = obj;
      }

      saveAll({ fixed, user, proposals });
      return clone(obj);
    },

    removeUserOffer(id){
      const { fixed, user, proposals } = loadAll();
      const remaining = user.filter(o => o.id !== id);
      if (remaining.length === user.length) return false;
      const remainingProps = proposals.filter(p => p.offerId !== id);
      saveAll({ fixed, user: remaining, proposals: remainingProps });
      return true;
    },

    // Propostas
    createProposal(offerId, payload){
      const { fixed, user, proposals } = loadAll();
      const offer = [...fixed, ...user].find(o => o.id === offerId);
      if (!offer) throw new Error('Oferta não encontrada');

      const prop = {
        id: uid('prop'),
        offerId,
        status: 'sent',
        price_per_ton: Number(payload.price_per_ton || offer.price_per_ton || 0),
        quantity_ton: Number(payload.quantity_ton || offer.min_lot_ton || 0),
        message: payload.message || '',
        proposer: payload.proposer || { id: 'buyer', name: 'Comprador' },
        created_at: nowISO(),
        updated_at: nowISO(),
        meta: payload.meta || {},
      };

      proposals.push(prop);

      if (offer.status === 'open'){
        offer.status = 'negotiating';
        offer.updated_at = nowISO();
        const uIdx = user.findIndex(o => o.id === offer.id);
        const fIdx = fixed.findIndex(o => o.id === offer.id);
        if (uIdx >= 0) user[uIdx] = offer; else if (fIdx >= 0) fixed[fIdx] = offer;
      }

      saveAll({ fixed, user, proposals });
      return clone(prop);
    },

    listProposals(offerId){
      const { proposals } = loadAll();
      return proposals.filter(p => p.offerId === offerId).map(clone);
    },

    updateProposal(id, patch){
      const { fixed, user, proposals } = loadAll();
      const idx = proposals.findIndex(p => p.id === id);
      if (idx === -1) throw new Error('Proposta não encontrada');
      proposals[idx] = { ...proposals[idx], ...patch, updated_at: nowISO() };
      saveAll({ fixed, user, proposals });
      return clone(proposals[idx]);
    },

    acceptProposal(id){ return this.updateProposal(id, { status:'accepted' }); },
    rejectProposal(id){ return this.updateProposal(id, { status:'rejected' }); },
    counterProposal(id, newValues){ return this.updateProposal(id, { status:'countered', ...newValues }); },
  };

  global.OffersStore = OffersStore;
})(window);

