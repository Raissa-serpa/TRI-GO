// assets/js/guard.js
;(function (win, doc) {
  const AUTH_KEY = 'tri-go:auth_user';

  const Guard = {
    /* ===== estado ===== */
    currentUser() {
      try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
      catch { return null; }
    },
    isLoggedIn() { return !!this.currentUser(); },
    role(user = this.currentUser()) {
      return (user && (user.role || user.perfil || '')).toLowerCase(); // vendedor|comprador|trader
    },

    /* ===== capabilities ===== */
    can(action, user = this.currentUser()) {
      const r = this.role(user);
      if (action === 'buy')  return ['comprador','vendedor','trader'].includes(r);
      if (action === 'sell') return ['vendedor','trader'].includes(r);
      return false;
    },

    /* ===== guards ===== */
    /**
     * Exige login e/ou papéis.
     * @param {Object} opts
     *  - requireLogin: boolean (default true)
     *  - allowedRoles: array de papéis permitidos (ex: ['vendedor','trader'])
     *  - loginUrl: para redirecionar quem não está logado (default 'index.html')
     *  - denyUrl: para redirecionar quem não tem papel (default 'index.html')
     */
    requireAuth(opts = {}) {
      const {
        requireLogin = true,
        allowedRoles = null,
        loginUrl = 'index.html',
        denyUrl = 'index.html',
      } = opts;

      const user = this.currentUser();

      if (requireLogin && !user) {
        try { sessionStorage.setItem('guard:returnTo', location.href); } catch {}
        location.replace(loginUrl);
        return false;
      }

      if (allowedRoles && allowedRoles.length) {
        const r = this.role(user);
        if (!allowedRoles.map(x => x.toLowerCase()).includes(r)) {
          location.replace(denyUrl);
          return false;
        }
      }
      return true;
    },

    /**
     * Redireciona por papel (use depois do login/cadastro).
     * ex: Guard.redirectByRole({ vendedor:'painel-produtor.html', trader:'painel-produtor.html', comprador:'ofertas.html' })
     */
    redirectByRole(map, fallback) {
      const r = this.role();
      const url = map[r] || fallback;
      if (url) location.href = url;
    },

    /* ===== UI helpers ===== */
    /**
     * Ajusta UI:
     *  - data-auth="sell-only"  → mostra só p/ quem pode vender
     *  - data-auth="buy-only"   → mostra só p/ quem pode comprar
     *  - data-auth="user-only"  → mostra só logado
     *  - data-auth="guest-only" → mostra só deslogado
     *  - Atualiza .dropdown .dropbtn com nome/email
     *  - [data-action="logout"] faz logout
     */
    decorateUI() {
      const user = this.currentUser();
      const logged = !!user;

      // Mostrar/ocultar por regra
      qsAll('[data-auth]').forEach(el => {
        const rule = (el.getAttribute('data-auth') || '').toLowerCase();
        let show = true;
        if (rule === 'sell-only')  show = this.can('sell', user);
        else if (rule === 'buy-only') show = this.can('buy', user);
        else if (rule === 'user-only') show = logged;
        else if (rule === 'guest-only') show = !logged;
        el.style.display = show ? '' : 'none';
      });

      // Texto do dropdown
      const drop = qs('.dropdown .dropbtn');
      if (drop) drop.textContent = logged ? `Olá, ${user.nome || user.email || 'usuário'} ▼` : 'Entrar ▼';

      // Item "Sair" dinâmico no dropdown
      const cont = qs('.dropdown .dropdown-content');
      if (cont) {
        let out = cont.querySelector('[data-action="logout"]');
        if (!out) {
          out = doc.createElement('a');
          out.href = '#';
          out.dataset.action = 'logout';
          out.textContent = 'Sair';
          cont.appendChild(out);
        }
        out.style.display = logged ? 'block' : 'none';
      }
    },

    logout() {
      localStorage.removeItem(AUTH_KEY);
      // limpar itens opcionais relacionados…
      try { sessionStorage.removeItem('guard:returnTo'); } catch {}
      // recarrega para re-aplicar regras/menus
      location.reload();
    },
  };

  /* ===== util DOM ===== */
  function qs(sel, root = doc) { return root.querySelector(sel); }
  function qsAll(sel, root = doc) { return Array.from(root.querySelectorAll(sel)); }

  // Logout handler global
  doc.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action="logout"]');
    if (!a) return;
    e.preventDefault();
    Guard.logout();
  });

  // Exposição global
  win.AuthGuard = Guard;

  // Aplica UI automaticamente após carregar
  doc.addEventListener('DOMContentLoaded', () => Guard.decorateUI());
})(window, document);
