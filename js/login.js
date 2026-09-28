(() => {
  'use strict';

  const client = window.gtaSupabase;
  const form = document.getElementById('loginForm');
  const button = document.getElementById('loginButton');
  const message = document.getElementById('loginMessage');

  async function redirectIfSignedIn() {
    const { data } = await client.auth.getSession();
    if (data.session) window.location.replace('student-dashboard.html');
  }

  redirectIfSignedIn();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    button.disabled = true;
    button.textContent = 'Signing in…';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const { error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      message.textContent = 'Sign-in failed. Check your email and password and try again.';
      button.disabled = false;
      button.textContent = 'Sign in';
      return;
    }

    window.location.replace('student-dashboard.html');
  });
})();
