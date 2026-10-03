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

    /*
     * Determine the actual assurance level of the authenticated session.
     */
    const { data: aalData, error: aalError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError || !aalData) {
      showMessage(
        'We could not verify your session security level. Please sign in again.'
      );
      return false;
    }

    /*
     * AAL2 means password + second factor have already been verified.
     * The student may enter the portal.
     */
    if (aalData.currentLevel === 'aal2') {
      window.location.replace('student-dashboard.html');
      return true;
    }

    /*
     * The student is authenticated with the password but has not
     * completed MFA for this session.
     *
     * Inspect MFA factors to determine whether the student needs:
     *
     * 1. normal MFA verification, or
     * 2. first-time MFA enrollment.
     */
    const { data: factorsData, error: factorsError } =
      await client.auth.mfa.listFactors();

    if (factorsError) {
      showMessage(
        'We could not check your account security configuration. Please try again.'
      );
      return false;
    }

    const verifiedTotpFactors = (factorsData?.totp || []).filter(
      (factor) => factor.status === 'verified'
    );

    /*
     * Existing verified TOTP factor:
     * require the student to prove possession of that factor.
     */
    if (verifiedTotpFactors.length > 0) {
      window.location.replace('mfa.html');
      return true;
    }

    /*
     * No verified TOTP factor:
     * send the authenticated student through secure first-time
     * authenticator enrollment.
     */
    window.location.replace('mfa-enroll.html');
    return true;
  }

  async function initializeLogin() {
    if (!client) {
      showMessage('Authentication service is unavailable.');
      button.disabled = true;
      return;
    }

    try {
      /*
       * An existing authenticated session must still pass through
       * the same MFA/AAL routing controls.
       */
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
       * Password authentication alone is not enough to enter
       * GTA Driving Academy's protected learning environment.
       */
      const routed = await routeAuthenticatedUser();

      if (!routed && !message.textContent) {
        showMessage(
          'Your secure student session could not be established. Please try again.'
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
