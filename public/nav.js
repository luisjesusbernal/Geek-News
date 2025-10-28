// public/nav.js
(async () => {
  const navAuth = document.getElementById('navAuth');
  const welcomeMsg = document.getElementById('welcomeMsg');

  let me = { loggedIn: false };
  try {
    const res = await fetch('/api/me');
    me = await res.json();
  } catch {}

  if (navAuth) {
    navAuth.innerHTML = '';
    if (!me.loggedIn) {
      const btnLogin = document.createElement('a');
      btnLogin.href = '/login.html';
      btnLogin.className = 'btn btn-outline-light btn-sm';
      btnLogin.textContent = 'Iniciar sesión';

      const btnReg = document.createElement('a');
      btnReg.href = '/register.html';
      btnReg.className = 'btn btn-primary btn-sm';
      btnReg.textContent = 'Registrarse';

      navAuth.append(btnLogin, btnReg);
    // ...
} else {
  const badge = document.createElement('span');
  badge.className = 'navbar-text me-2';
  badge.textContent = `Hola, ${me.email}`;

  // Si es admin, muestra acceso al panel
  if (me.role === 'admin') {
    const btnAdmin = document.createElement('a');
    btnAdmin.href = '/admin.html';
    btnAdmin.className = 'btn btn-warning btn-sm me-2';
    btnAdmin.textContent = 'Admin';
    navAuth.append(badge, btnAdmin);
  } else {
    navAuth.append(badge);
  }

  const btnLogout = document.createElement('button');
  btnLogout.className = 'btn btn-danger btn-sm';
  btnLogout.textContent = 'Cerrar sesión';
  btnLogout.addEventListener('click', async () => {
    try { await fetch('/api/logout', { method: 'POST' }); } catch {}
    window.location.href = '/';
  });

  navAuth.append(btnLogout);
}

  }

  if (welcomeMsg) {
    welcomeMsg.textContent = me.loggedIn ? `Bienvenido de nuevo, ${me.email}` : '';
  }
})();
