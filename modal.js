const MODAL_ROOT_ID = 'modal-root';
const cache = new Map();
let escHandler = null;

function ensureRoot() {
  let root = document.getElementById(MODAL_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = MODAL_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

export function closeModal() {
  const root = document.getElementById(MODAL_ROOT_ID);
  if (root) root.replaceChildren();
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  document.body.classList.remove('modal-open');
}

function mount(htmlString) {
  const tpl = document.createElement('template');
  tpl.innerHTML = htmlString.trim();

  const modalSection = tpl.content.querySelector('.modal');
  if (!modalSection) throw new Error('Partial sem elemento .modal');

  modalSection.classList.add('is-open');

  const root = ensureRoot();
  root.innerHTML = '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'modal-content';
  wrapper.appendChild(modalSection);

  root.appendChild(overlay);
  overlay.appendChild(wrapper);

  modalSection.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', closeModal);
  });

  escHandler = (ev) => { if (ev.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', escHandler);

  const first = modalSection.querySelector('input, select, textarea, button');
  if (first) first.focus();

  document.body.classList.add('modal-open');
}

async function fetchPartial(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
  const html = await res.text();
  cache.set(path, html);
  return html;
}

export async function openAuthModal(kind = 'login') {
  const rel = kind === 'register'
    ? 'assets/partials/register.html'
    : 'assets/partials/login.html';
  const url = new URL(rel, window.location.href).toString();
  const html = await fetchPartial(url);
  mount(html);
}


document.addEventListener("DOMContentLoaded", function () {
  const btnCadastrar = document.getElementById("btn-cadastrar");
  const formPass1 = document.getElementById("form-pass1");
  const formPass2 = document.getElementById("form-pass2");

  if (btnCadastrar) {
    btnCadastrar.addEventListener("click", function () {
      // Esconde passo 1
      formPass1.style.display = "none";
      // Mostra passo 2
      formPass2.style.display = "block";
    });
  }
});

