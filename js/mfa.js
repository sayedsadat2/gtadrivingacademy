(() => {
  'use strict';

  const client = window.gtaSupabase;

  const form = document.getElementById('mfa-form');
  const codeInput = document.getElementById('mfa-code');
  const submitButton = document.getElementById('mfa-submit');
  const message = document.getElementById('mfa-message');

  function showMessage(text, type = 'error') {
    message.textContent = text;
    message.className = `message show ${type}`;
  }

  function clearMessage() {
    message.textContent = '';
    message.className = 'message';
  }

  function setLoading(loading) {
    submitButton.disabled = loading;
    codeInput.disabled = loading;

    submitButton.textContent = loading
      ? 'Verifying...'
      : 'Verify and continue';
  }

  async function signOutAndReturnToLogin() {
    try {
      await client.auth.signOut();
    } finally {
      window.location.replace('login.html');
    }
  }

  async function initializeMfaPage() {
    if (!client) {
      showMessage('Authentication service is unavailable.');
      return;
    }

    const {
      data: { session },
      error: sessionError
    } = await client.auth.getSession();

    if (sessionError || !session) {
      window.location.replace('login.html');
      return;
    }

    const { data: aalData, error: aalError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError || !aalData) {
      showMessage(
        'We could not verify the security level of your session. Please sign in again.'
      );
      return;
    }

    if (aalData.currentLevel === 'aal2') {
      window.location.replace('student-dashboard.html');
      return;
    }

    if (aalData.nextLevel !== 'aal2') {
      showMessage(
        'No verified authenticator factor is available for this account. Please contact GTA Driving Academy.'
      );

      submitButton.disabled = true;
      codeInput.disabled = true;
      return;
    }

    codeInput.focus();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const code = codeInput.value.replace(/\D/g, '');

    if (!/^\d{6}$/.test(code)) {
      showMessage('Enter the 6-digit code from your authenticator app.');
      codeInput.focus();
      return;
    }

    setLoading(true);

    try {
      const { data: factorsData, error: factorsError } =
        await client.auth.mfa.listFactors();

      if (factorsError) {
        throw factorsError;
      }

      const verifiedTotpFactors = (factorsData?.totp || []).filter(
        (factor) => factor.status === 'verified'
      );

      if (verifiedTotpFactors.length === 0) {
        showMessage(
          'No verified authenticator factor is available for this account. Please contact GTA Driving Academy.'
        );
        return;
      }

      /*
       * GTA Driving Academy currently uses one primary verified TOTP factor
       * per student login. If multiple verified factors exist, the first
       * verified TOTP factor returned by Supabase is used.
       */
      const factor = verifiedTotpFactors[0];

      const { data: challengeData, error: challengeError } =
        await client.auth.mfa.challenge({
          factorId: factor.id
        });

      if (challengeError || !challengeData?.id) {
        throw challengeError || new Error('MFA challenge could not be created.');
      }

      const { error: verifyError } =
        await client.auth.mfa.verify({
          factorId: factor.id,
          challengeId: challengeData.id,
          code
        });

      if (verifyError) {
        codeInput.value = '';
        showMessage(
          'The verification code was not accepted. Enter the current code from your authenticator app.'
        );
        codeInput.focus();
        return;
      }

      /*
       * Do not trust the successful verify call alone.
       * Confirm that Supabase has actually upgraded this session to AAL2.
       */
      const { data: finalAal, error: finalAalError } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();

      if (
        finalAalError ||
        !finalAal ||
        finalAal.currentLevel !== 'aal2'
      ) {
        showMessage(
          'Your identity was verified, but the secure session could not be confirmed. Please sign in again.'
        );

        setTimeout(signOutAndReturnToLogin, 1800);
        return;
      }

      showMessage('Identity verified. Opening your student portal...', 'success');

      window.location.replace('student-dashboard.html');
    } catch (error) {
      console.error('MFA verification error:', error);

      showMessage(
        'We could not complete verification. Please try again. If the problem continues, sign in again.'
      );
    } finally {
      setLoading(false);
    }
  });

  initializeMfaPage();
})();
