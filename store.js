// assets/js/store.js (exemplo)
export const STORE = {
  KEYS: {
    USER_OFFERS: 'tri-go:offers_user',
    FIXED_OFFERS: 'tri-go:offers_fixed'
  },
  load(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  },
  save(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr || []));
  },
  addUserOffer(offer) {
    const arr = this.load(this.KEYS.USER_OFFERS);
    arr.push(offer);
    this.save(this.KEYS.USER_OFFERS, arr);
    return offer;
  },
  allForIndex() {
    const fixed = this.load(this.KEYS.FIXED_OFFERS);
    const user  = this.load(this.KEYS.USER_OFFERS);
    return [...user, ...fixed];
  }
};
