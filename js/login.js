(() => {
  'use strict';

  const client = window.gtaSupabase;
  const form = document.getElementById('loginForm');
  const button = document.getElementById('loginButton');
  const message = document.getElementById('loginMessage');

  function showMessage(text) {
    message.textContent = text;
  }

  function setLoading(loading) {
    button.disabled = loading;
    button.textContent = loading ? 'Signing in...' : 'Sign in';
  }

  async function routeAuthenticatedUser() {
    const {
      data: { session },
      error: sessionError
    } = await client.auth.getSession();

    if (sessionError || !session) {
      return false;
    }

    const { data: aalData, error: aalError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError || !aalData) {
      showMessage(
        'We could not verify your session security level. Please sign in again.'
      );
      return false;
    }

    /*
     * Only an AAL2 session may enter the learning portal.
     */
    if (aalData.currentLevel === 'aal2') {
      window.location.replace('student-dashboard.html');
      return true;
    }

    /*
     * The student has a verified MFA factor available,
     * but this session has not completed MFA yet.
     */
    if (
      aalData.currentLevel === 'aal1' &&
      aalData.nextLevel === 'aal2'
    ) {
      window.location.replace('mfa.html');
      return true;
    }

    /*
     * AAL1 with no path to AAL2 means this account does not
     * currently have a verified MFA factor available.
     *
     * Do not allow access to the learning portal because the
     * protected LMS RPCs require AAL2.
     */
    if (aalData.currentLevel === 'aal1') {
      showMessage(
        'Multi-factor authentication is not configured for this account. Please contact GTA Driving Academy.'
      );
      return false;
    }

    showMessage(
      'Your secure session could not be verified. Please try again.'
    );

    return false;
  }

  async function initializeLogin() {
    if (!client) {
      showMessage('Authentication service is unavailable.');
      button.disabled = true;
      return;
    }

    try {
      await routeAuthenticatedUser();
    } catch (error) {
      console.error('Login initialization error:', error);
      showMessage(
        'We could not verify your existing session. Please try signing in.'
      );
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    showMessage('');
    setLoading(true);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const { error: signInError } =
        await client.auth.signInWithPassword({
          email,
          password
        });

      if (signInError) {
        showMessage(
          'Sign-in failed. Check your email and password and try again.'
        );
        return;
      }

      /*
       * Do not redirect directly to the dashboard.
       * Determine the authenticated session's actual AAL first.
       */
      const routed = await routeAuthenticatedUser();

      if (!routed && !message.textContent) {
        showMessage(
          'Your account requires additional security configuration before training can begin.'
        );
      }
    } catch (error) {
      console.error('Student login error:', error);

      showMessage(
        'We could not complete sign-in. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  });

  initializeLogin();
})();
