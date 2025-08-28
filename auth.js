// ===== auth.js =====
const AUTH_KEY  = 'tri-go:auth_user';
const USERS_KEY = 'tri-go:users';

export function loadUsers(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
  catch(_) { return []; }
}
export function saveUsers(users){
  localStorage.setItem(USERS_KEY, JSON.stringify(users || []));
}

export function currentUser(){
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
  catch(_) { return null; }
}
export function setCurrent(user){
  if (!user) localStorage.removeItem(AUTH_KEY);
  else {
    // normaliza ao gravar
    const normalized = {
      id: user.id,
      nome: user.nome || '',
      email: (user.email || '').trim().toLowerCase(),
      role: String(user.role || '').trim().toLowerCase()
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(normalized));
    
  }
}

// regras de permissão
export function can(action, user = currentUser()){
  if (!user) return false;
  const role = String(user.role || '').trim().toLowerCase();
  if (action === 'buy')  return ['comprador','vendedor','trader'].includes(role);
  if (action === 'sell') return ['vendedor','trader'].includes(role);
  return false;
}

// cadastro
export async function registerUser({ nome, email, senha, role='comprador', ...rest }) {
  email = (email || '').trim().toLowerCase();
  if (!email) throw new Error('E-mail obrigatório.');
  if (!senha || senha.length < 8) throw new Error('Senha inválida.');

  const users = loadUsers();
  if (users.some(u => (u.email || '').toLowerCase() === email)) {
    throw new Error('E-mail já cadastrado.');
  }

  const user = {
    id: crypto.randomUUID?.() || String(Date.now()),
    nome: nome || '',
    email,
    senha,
    role: String(role || 'comprador').trim().toLowerCase(),
    ...rest,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  saveUsers(users);
  setCurrent(user);
  return { ok: true, user: currentUser() };
}

// login
export async function login(email, senha){
  email = (email || '').trim().toLowerCase();
  const users = loadUsers();
  const found = users.find(u => (u.email || '').toLowerCase() === email);
  if (!found || found.senha !== senha) throw new Error('E-mail ou senha inválidos.');
  setCurrent(found);
  return { ok:true, user: currentUser() };
}

// logout
export function logout(){ setCurrent(null); }

// util
export function isLoggedIn(){ return !!currentUser(); }
