// assets/js/app.js
import { openAuthModal, closeModal } from './modal.js';
import { registerUser, login, logout, currentUser, can, setCurrent } from './auth.js';

/* ============================
   Utils
============================ */
const debounce = (fn, wait = 300) => {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
};
const onlyDigits = v => (v || '').replace(/\D+/g, '');
const emailRegex = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function showInvalid(el, msg){
  if (!el) return;
  el.setCustomValidity(msg || '');
  let small = el.parentElement?.querySelector('.error-msg');
  if (!small && msg){
    small = document.createElement('small');
    small.className = 'error-msg';
    el.parentElement.appendChild(small);
  }
  if (small) small.textContent = msg || '';
}

/* ============================
   CPF / CNPJ
============================ */
function isValidCPF(cpf) {
  cpf = onlyDigits(cpf);
  if (!cpf || cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0, rest;
  for (let i=1;i<=9;i++) sum += parseInt(cpf.substring(i-1,i),10)*(11-i);
  rest = (sum*10)%11; if (rest===10||rest===11) rest=0;
  if (rest !== parseInt(cpf.substring(9,10),10)) return false;
  sum = 0;
  for (let i=1;i<=10;i++) sum += parseInt(cpf.substring(i-1,i),10)*(12-i);
  rest = (sum*10)%11; if (rest===10||rest===11) rest=0;
  return rest === parseInt(cpf.substring(10,11),10);
}
function isValidCNPJ(cnpj) {
  cnpj = onlyDigits(cnpj);
  if (!cnpj || cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base) => {
    let length = base.length;
    let numbers = base.substring(0, length-2);
    let digits = base.substring(length-2);
    let sum = 0, pos = length - 7;
    for (let i = length - 12; i >= 1; i--) {
      sum += numbers.charAt(length - i - 1) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0), 10)) return false;
    length = length + 1;
    numbers = base.substring(0, length-2);
    sum = 0; pos = length - 7;
    for (let i = length - 12; i >= 1; i--) {
      sum += numbers.charAt(length - i - 1) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result === parseInt(digits.charAt(1), 10);
  };
  return calc(cnpj);
}

/* máscara cpf/cnpj */
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.matches('input[name="cpf_cnpj"]')) return;
  let v = onlyDigits(el.value);
  if (v.length <= 11) {
    v = v.replace(/^(\d{3})(\d)/, '$1.$2')
         .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
         .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2}).*/, '$1.$2.$3-$4');
  } else {
    v = v.replace(/^(\d{2})(\d)/, '$1.$2')
         .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
         .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
         .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d{1,2}).*/, '$1.$2.$3/$4-$5');
  }
  el.value = v;
});
document.addEventListener('blur', (e) => {
  const el = e.target;
  if (!el.matches('input[name="cpf_cnpj"]')) return;
  const raw = onlyDigits(el.value);
  let ok = false;
  if (raw.length === 11) ok = isValidCPF(raw);
  if (raw.length === 14) ok = isValidCNPJ(raw);
  if (!ok) showInvalid(el, 'CPF/CNPJ inválido.');
  else showInvalid(el, '');
}, true);

/* ============================
   CEP + Google Geocoder
============================ */
window._triGo = window._triGo || {};
window._triGo.initMaps = function initMaps(){ 
  window._triGo.geocoder = new google.maps.Geocoder();
};
// alias para o callback global usado no script do Maps
window.initMaps = window.initMaps || window._triGo.initMaps;

const formatCEP = (v) => {
  const d = onlyDigits(v).slice(0,8);
  return d.replace(/^(\d{5})(\d{0,3}).*/, (m,a,b)=> b ? `${a}-${b}` : a);
};
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.matches('input[name="cep"]')) return;
  el.value = formatCEP(el.value);
});
const geocodeByCEP = debounce((el) => {
  const geocoder = window._triGo && window._triGo.geocoder;
  const cep = onlyDigits(el.value);
  if (!geocoder || cep.length !== 8) return;

  geocoder.geocode({ address: cep, componentRestrictions: { country: 'BR' } },
    (results, status) => {
      if (status !== 'OK' || !results?.length) return;
      const comps = results[0].address_components;
      const get = (...types) => {
        const c = comps.find(x => types.some(t => x.types.includes(t)));
        return c ? { long: c.long_name, short: c.short_name } : { long: '', short: '' };
      };
      const route   = get('route').long;
      const number  = get('street_number').long;
      const bairro  = get('sublocality_level_1','sublocality','neighborhood','political').long;
      const cidade  = get('administrative_area_level_2','locality').long;
      const uf      = get('administrative_area_level_1').short;

      const root = el.closest('form') || document;
      const set = (sel, val) => { const i = root.querySelector(sel); if (i) i.value = val || ''; };
      set('input[name="logradouro"]', [route, number].filter(Boolean).join(', '));
      set('input[name="bairro"]', bairro);
      set('input[name="cidade"]', cidade);
      set('input[name="uf"]', uf);
    }
  );
}, 300);
document.addEventListener('keyup', (e) => {
  const el = e.target;
  if (!el.matches('input[name="cep"]')) return;
  if (onlyDigits(el.value).length === 8) geocodeByCEP(el);
});

/* ============================
   Abrir modais
============================ */
function bindOpeners() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open-auth]');
    if (!btn) return;
    e.preventDefault();
    const kind = btn.getAttribute('data-open-auth'); // "login" | "register"
    openAuthModal(kind);
  });
}

/* ============================
   Passo1 -> Passo2 do cadastro
============================ */
function bindRegisterStepAdvance() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-cadastrar');
    if (!btn) return;
    e.preventDefault();

    const form1 = btn.closest('.modal')?.querySelector('#form-pass1') || document.querySelector('#form-pass1');
    const form2 = btn.closest('.modal')?.querySelector('#form-pass2') || document.querySelector('#form-pass2');
    if (!form1 || !form2) return;

    // valida CPF/CNPJ antes de avançar
    const doc = form1.querySelector('input[name="cpf_cnpj"]');
    const raw = doc ? onlyDigits(doc.value) : '';
    const ok = (raw.length === 11 && isValidCPF(raw)) || (raw.length === 14 && isValidCNPJ(raw));
    if (!ok) {
      showInvalid(doc, 'CPF/CNPJ inválido.');
      doc?.focus();
      return;
    }
    showInvalid(doc, '');

    // avança
    form1.style.display = 'none';
    form2.style.display = 'block';
    const first = form2.querySelector('input,select,textarea,button');
    first?.focus();
  });
}

/* ============================
   Formulários (login + passo2)
============================ */
function bindForms() {
  // toggle "olho" senha
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-pass');
    if (!btn) return;
    e.preventDefault();
    const target = btn.getAttribute('data-target');
    const input = target ? document.getElementById(target) : btn.previousElementSibling;
    if (input) input.type = (input.type === 'password') ? 'text' : 'password';
  });

  // LOGIN
  document.addEventListener('submit', async (e) => {
    const f = e.target;
    if (!f.matches('#form-login')) return;
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    try {
      await login(data.email, data.password);
      closeModal();
      updateAuthUI();
      const u = currentUser();
      if (can('sell', u)) {
        // ex: redirecionar painel do vendedor
        // location.href = 'painel-vendedor.html';
      }
    } catch (err) {
      alert(err.message || 'Falha no login.');
    }
  });

  // REGISTRO PASSO 2
  document.addEventListener('submit', async (e) => {
    const f = e.target;
    if (!(
      f.matches('#form-cadastro') ||
      f.matches('#form-pass2') ||
      f.matches('[data-auth="register"]')
    )) return;

    e.preventDefault();

    // validações rápidas
    const email   = f.querySelector('input[name="email"]');
    const celular = f.querySelector('input[name="celular"]');
    const s1      = f.querySelector('input[name="senha"]');
    const s2      = f.querySelector('input[name="senha2"]');

    let ok = true;
    if (!emailRegex.test((email?.value || '').trim())) { showInvalid(email, 'E-mail inválido.'); ok = false; } else showInvalid(email, '');
    if (onlyDigits(celular?.value).length !== 11)     { showInvalid(celular, 'Digite 11 números (DDD + número).'); ok = false; } else showInvalid(celular, '');
    if ((s1?.value || '').length < 8)                 { showInvalid(s1, 'Senha deve ter no mínimo 8 caracteres.'); ok = false; } else showInvalid(s1, '');
    if ((s1?.value || '') !== (s2?.value || ''))      { showInvalid(s2, 'As senhas não coincidem.'); ok = false; } else showInvalid(s2, '');
    if (!ok) { f.reportValidity?.(); return; }

    // junta passo 1 + passo 2
    const p1 = document.getElementById('form-pass1');
    const d1 = p1 ? Object.fromEntries(new FormData(p1)) : {};
    const d2 = Object.fromEntries(new FormData(f));

    // normaliza o papel
    let role = String(d1.tipo_usuario || '').trim().toLowerCase();
    const roleMap = { vendedor:'vendedor', comprador:'comprador', trader:'trader' };
    role = roleMap[role] || 'comprador';

    try {
      const senhaVal = (d2.senha || d2.password || '').trim();

      const res = await registerUser({
        nome: d1.nome_razao || '',
        email: (d2.email || '').trim().toLowerCase(),
        senha: senhaVal,
        role, // 'comprador' | 'vendedor' | 'trader'
        doc: d1.cpf_cnpj || '',
        endereco: {
          cep: d1.cep || '',
          logradouro: d1.logradouro || '',
          numero: d1.numero || '',
          bairro: d1.bairro || '',
          cidade: d1.cidade || '',
          uf: d1.uf || ''
        },
        celular: d2.celular || ''
      });

      // Garantia absoluta: se por algum motivo não ficou salvo, salva agora
      let u = currentUser();
      if (!u) {
        setCurrent({
          id: res?.user?.id || String(Date.now()),
          nome: d1.nome_razao || '',
          email: (d2.email || '').trim().toLowerCase(),
          role: String(role || 'comprador').trim().toLowerCase()
        });
        u = currentUser();
      }

      console.log('auth_user:', localStorage.getItem('tri-go:auth_user'));

      // reforço opcional do role
      try {
        const raw = localStorage.getItem('tri-go:auth_user');
        if (raw) {
          const ju = JSON.parse(raw);
          if (ju) {
            ju.role  = String(role).trim().toLowerCase();
            ju.roles = Array.from(new Set([...(ju.roles || []), ju.role]));
            localStorage.setItem('tri-go:auth_user', JSON.stringify(ju));
          }
        }
      } catch {}

      closeModal();
      updateAuthUI();
      if (can('sell', u)) {
        // location.href = 'painel-vendedor.html';
      }
    } catch (err) {
      console.error(err);
      alert(err?.message || 'Falha no cadastro.');
    }
  });
}

/* ============================
   Auth UI (dropdown, permissões)
============================ */
function updateAuthUI() {
  const user = currentUser();

  // Exibir/ocultar itens por permissão
  document.querySelectorAll('[data-auth="sell-only"]').forEach(el => {
    el.style.display = can('sell', user) ? '' : 'none';
  });
  document.querySelectorAll('[data-auth="buy-only"]').forEach(el => {
    el.style.display = can('buy', user) ? '' : 'none';
  });

  // Troca rótulo do botão "Entrar"
  const drop = document.querySelector('.dropdown .dropbtn');
  if (drop) drop.textContent = user ? `Olá, ${user.nome || user.name || user.email}` : 'Entrar ▼';

  // Item "Sair"
  const container = document.querySelector('.dropdown-content');
  if (container) {
    let logoutItem = container.querySelector('[data-action="logout"]');
    if (!logoutItem) {
      logoutItem = document.createElement('a');
      logoutItem.href = '#';
      logoutItem.dataset.action = 'logout';
      logoutItem.textContent = 'Sair';
      container.appendChild(logoutItem);
    }
    logoutItem.style.display = user ? 'block' : 'none';
  }
}

function bindAuthActions() {
  // LOGOUT
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action="logout"]');
    if (!a) return;
    e.preventDefault();
    logout();
    updateAuthUI();
  });
}

/* ============================
   Boot
============================ */
window.addEventListener('DOMContentLoaded', () => {
  bindOpeners();
  bindRegisterStepAdvance();
  bindForms();
  bindAuthActions();
  updateAuthUI();
});
