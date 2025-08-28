// ===== Utilidades básicas =====
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('is-open');
  document.body.classList.add('modal-open');

  // foca no primeiro campo do modal
  const firstInput = modal.querySelector('input, select, textarea, button');
  if (firstInput) firstInput.focus();
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('is-open');
  document.body.classList.remove('modal-open');
}

// ===== Inicialização =====
(function initAuthModals(){
  // âncoras/botões do header
  const linkRegistrar = document.getElementById('link-sou-vendedor');
  const linkEntrar    = document.getElementById('link-entrar');

  // modais
  const MODAL_CAD = document.getElementById('modal-entrar');
  const MODAL_LOG = document.getElementById('modal-login');

  // passos do cadastro
  const PASSO1 = document.getElementById('form-pass1');
  const PASSO2 = document.getElementById('form-pass2');
  const BTN_IR_PASSO2 = document.getElementById('btn-cadastrar');

  // links internos (rodapés dos formulários)
  const linkAbreLoginDoCadastro = document.getElementById('abre-login-do-cadastro');
  const linkAbreLoginDoPass2    = document.getElementById('abre-login-do-pass2');
  const linkIrCadastroNoLogin   = document.getElementById('link-ir-cadastro');

  // --- helpers de passo ---
  function showPasso1(){
    if (PASSO1) PASSO1.style.display = '';
    if (PASSO2) PASSO2.style.display = 'none';
  }
  function showPasso2(){
    if (PASSO1) PASSO1.style.display = 'none';
    if (PASSO2) PASSO2.style.display = '';
    const first = PASSO2?.querySelector('input,select,textarea,button');
    first && first.focus();
  }

  // --- abrir modais a partir do header ---
  linkRegistrar?.addEventListener('click', (e)=>{
    e.preventDefault();
    showPasso1();               // sempre começa do Passo 1
    openModal('modal-entrar');
  });
  linkEntrar?.addEventListener('click', (e)=>{
    e.preventDefault();
    openModal('modal-login');
  });

  // --- fechar ao clicar no overlay ou no X ---
  $all('.modal').forEach(modal=>{
    modal.addEventListener('click', (e)=>{
      if (e.target.matches('.modal-overlay,[data-close],.modal-close')) {
        modal.classList.remove('is-open');
        document.body.classList.remove('modal-open');
      }
    });
  });

  // --- botões de atalho entre modais dentro dos formulários ---
  linkAbreLoginDoCadastro?.addEventListener('click', (e)=>{
    e.preventDefault();
    closeModal('modal-entrar');
    openModal('modal-login');
  });
  linkAbreLoginDoPass2?.addEventListener('click', (e)=>{
    e.preventDefault();
    closeModal('modal-entrar');
    openModal('modal-login');
  });
  linkIrCadastroNoLogin?.addEventListener('click', (e)=>{
    e.preventDefault();
    closeModal('modal-login');
    showPasso1();
    openModal('modal-entrar');
  });

  // --- trocar Passo 1 -> Passo 2 ---
  // clique no botão CADASTRAR (Passo 1)
  BTN_IR_PASSO2?.addEventListener('click', (e)=>{
    e.preventDefault(); // evita submit do form
    showPasso2();
  });
  // pressione Enter dentro do Passo 1 (submit do form)
  PASSO1?.addEventListener('submit', (e)=>{
    e.preventDefault(); // não submete, apenas avança
    showPasso2();
  });

  // --- mostrar/ocultar senha (ícones com data-target) ---
  $all('.toggle-pass').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;
      input.type = (input.type === 'password') ? 'text' : 'password';
      input.focus();
    });
  });
})();
(function () {
  function hide(modal){
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
  }
  function hideAll(){
    document.querySelectorAll('.modal.is-open').forEach(hide);
  }

  // Fecha com clique no X, em qualquer elemento com [data-close], ou no overlay.
  document.addEventListener('click', function (e) {
    // fechar pelo X
    if (e.target.closest('.modal-close,[data-close]')) {
      e.preventDefault();
      hide(e.target.closest('.modal'));
      return;
    }
    // fechar clicando fora (overlay)
    if (e.target.classList.contains('modal-overlay')) {
      e.preventDefault();
      hide(e.target.closest('.modal'));
      return;
    }
    // impedir que href="#" force rolagem para topo
    if (e.target.matches('a[href="#"]')) e.preventDefault();
  }, true);

  // Fecha com ESC
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideAll();
  });

  // Exporte, se você ainda usa onclick antigos no HTML:
  window.closeModal = function(id){
    hide(document.getElementById(id));
  };
})();