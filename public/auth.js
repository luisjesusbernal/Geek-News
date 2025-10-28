// public/auth.js
const form = document.getElementById('loginForm');
const alertBox = document.getElementById('alertBox');

// Función para mostrar alertas en pantalla
function showAlert(type, text) {
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = text;
  alertBox.classList.remove('d-none');
}

// Listener del formulario
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validación visual de Bootstrap
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      let data = {};
      try { data = await res.json(); } catch {}

      // Si el servidor responde con error
      if (!res.ok || !data.ok) {
        const msg = data && data.msg
          ? data.msg
          : `Error ${res.status} al conectar con el servidor`;
        showAlert('danger', msg);
        return;
      }

      // ✅ Si el login fue exitoso
      showAlert('success', '¡Login exitoso! Redirigiendo al panel...');
      // Espera un momento y redirige al panel protegido
      setTimeout(() => {
        window.location.href = '/';
      }, 800);

    } catch (err) {
      console.error('FETCH ERROR:', err);
      showAlert('danger', 'Error de conexión. ¿Servidor encendido?');
    }
  });
}
