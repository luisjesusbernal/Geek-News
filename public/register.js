// public/register.js
const form = document.getElementById('registerForm');
const alertBox = document.getElementById('alertBox');

function showAlert(type, text) {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = text;
  alertBox.classList.remove('d-none');
}

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;

    if (password !== confirm) {
      showAlert('danger', 'Las contraseñas no coinciden');
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email, password, confirm })
      });

      let data = {};
      try { data = await res.json(); } catch {}

      if (!res.ok || !data.ok) {
        const msg = data && data.msg ? data.msg : `Error ${res.status} al registrar`;
        showAlert('danger', msg);
        return;
      }

      showAlert('success', '¡Registro exitoso! Redirigiendo al login...');
      setTimeout(() => { window.location.href = '/login.html'; }, 1000);
    } catch (err) {
      console.error('REGISTER FETCH ERROR:', err);
      showAlert('danger', 'Error de conexión. ¿Servidor encendido?');
    }
  });
}
