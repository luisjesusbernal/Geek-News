// public/newsletter.js
const formNL = document.getElementById('newsletterForm');
const inputNL = document.getElementById('newsletterEmail');
const msgNL   = document.getElementById('newsletterMsg');

function setMsg(text, type='secondary') {
  if (!msgNL) return;
  msgNL.textContent = text;
  msgNL.className = `small mt-2 text-${type}`;
}

if (formNL && inputNL) {
  formNL.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = inputNL.value.trim();

    // validación sencilla en el front
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMsg('Ingresa un correo válido.', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setMsg(data.msg || '¡Gracias por suscribirte!', 'success');
        formNL.reset();
      } else {
        setMsg(data.msg || `Error ${res.status}`, res.status === 409 ? 'info' : 'danger');
      }
    } catch (err) {
      console.error('NEWSLETTER ERROR:', err);
      setMsg('Error de conexión. Intenta más tarde.', 'danger');
    }
  });
}
