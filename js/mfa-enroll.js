(() => {
  'use strict';

  const client = window.gtaSupabase;

  const form = document.getElementById('mfa-enroll-form');
  const codeInput = document.getElementById('mfa-code');
  const submitButton = document.getElementById('mfa-enroll-submit');
  const message = document.getElementById('mfa-enroll-message');
  const qrImage = document.getElementById('mfa-qr');
  const qrLoading = document.getElementById('qr-loading');
  const secretElement = document.getElementById('mfa-secret');

  let factorId = null;

  function showMessage(text, type = 'error') {
    message.textContent = text;
    message.className = `message show ${type}`;
  }

  function clearMessage() {
    message.textContent = '';
    message.className = 'message';
  }

  function setLoading(loading) {
    submitButton.disabled = loading || !factorId;
    codeInput.disabled = loading;

    submitButton.textContent = loading
      ? 'Verifying...'
      : 'Verify and secure my account';
  }

  async function returnToLogin() {
    try {
      await client.auth.signOut();
    } finally {
      window.location.replace('login.html');
    }
  }

  async function initializeEnrollment() {
    if (!client) {
      qrLoading.textContent = 'Authentication service is unavailable.';
      showMessage('Authentication service is unavailable.');
      return;
    }

    /*
     * Enrollment is only allowed for an authenticated user.
     */
    const {
      data: { session },
      error: sessionError
    } = await client.auth.getSession();

    if (sessionError || !session) {
      window.location.replace('login.html');
      return;
    }

    /*
     * If this session is already AAL2, MFA is already satisfied.
     */
    const { data: aalData, error: aalError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aalError || !aalData) {
      showMessage(
        'We could not verify your session security level. Please sign in again.'
      );
      return;
    }

    if (aalData.currentLevel === 'aal2') {
      window.location.replace('student-dashboard.html');
      return;
    }

    /*
     * Check existing factors before creating another one.
     * A verified TOTP factor means this student should complete
     * the normal MFA challenge instead of enrolling again.
     */
    const { data: factorsData, error: factorsError } =
      await client.auth.mfa.listFactors();

    if (factorsError) {
      showMessage(
        'We could not check your authenticator setup. Please sign in again.'
      );
      return;
    }

    const verifiedTotpFactors = (factorsData?.totp || []).filter(
      (factor) => factor.status === 'verified'
    );

    if (verifiedTotpFactors.length > 0) {
      window.location.replace('mfa.html');
      return;
    }

    /*
     * Clean up stale unverified TOTP factors belonging to this
     * authenticated user before starting a fresh enrollment.
     *
     * This prevents abandoned setup attempts from accumulating
     * unnecessary factors.
     */
    const unverifiedTotpFactors = (factorsData?.totp || []).filter(
      (factor) => factor.status === 'unverified'
    );

    for (const factor of unverifiedTotpFactors) {
      const { error: unenrollError } =
        await client.auth.mfa.unenroll({
          factorId: factor.id
        });

      if (unenrollError) {
        console.error(
          'Unable to remove stale unverified MFA factor:',
          unenrollError
        );
      }
    }

    /*
     * Create a new unverified TOTP factor.
     * Supabase generates the secret and QR-code data.
     */
    const { data: enrollData, error: enrollError } =
      await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'GTA Driving Academy Student Portal'
      });

    if (
      enrollError ||
      !enrollData?.id ||
      !enrollData?.totp?.qr_code ||
      !enrollData?.totp?.secret
    ) {
      console.error('MFA enrollment error:', enrollError);

      qrLoading.textContent =
        'Authenticator setup could not be prepared.';

      showMessage(
        'We could not prepare multi-factor authentication. Please sign in again and try once more.'
      );

      return;
    }

    factorId = enrollData.id;

    /*
     * The QR code and secret are shown only on this authenticated
     * enrollment page. They are never stored by our application.
     */
    qrImage.src = enrollData.totp.qr_code;
    qrImage.style.display = 'block';
    qrLoading.style.display = 'none';

    secretElement.textContent = enrollData.totp.secret;

    submitButton.disabled = false;
    codeInput.focus();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    if (!factorId) {
      showMessage(
        'Authenticator setup is not ready. Please sign in again.'
      );
      return;
    }

    const code = codeInput.value.replace(/\D/g, '');

    if (!/^\d{6}$/.test(code)) {
      showMessage(
        'Enter the 6-digit code from your authenticator app.'
      );
      codeInput.focus();
      return;
    }

    setLoading(true);

    try {
      /*
       * challengeAndVerify performs the TOTP challenge and verifies
       * the code for the factor being enrolled.
       */
      const { error: verifyError } =
        await client.auth.mfa.challengeAndVerify({
          factorId,
          code
        });

      if (verifyError) {
        console.error('MFA enrollment verification error:', verifyError);

        codeInput.value = '';

        showMessage(
          'The verification code was not accepted. Enter the current 6-digit code from your authenticator app.'
        );

        codeInput.focus();
        return;
      }

      /*
       * Do not rely only on the successful verification response.
       * Independently confirm that Supabase promoted this session
       * to AAL2 before allowing access to training.
       */
      const { data: finalAal, error: finalAalError } =
        await client.auth.mfa.getAuthenticatorAssuranceLevel();

      if (
        finalAalError ||
        !finalAal ||
        finalAal.currentLevel !== 'aal2'
      ) {
        showMessage(
          'Your authenticator was verified, but the secure session could not be confirmed. Please sign in again.'
        );

        setTimeout(returnToLogin, 1800);
        return;
      }

      showMessage(
        'Multi-factor authentication is active. Opening your student portal...',
        'success'
      );

      window.location.replace('student-dashboard.html');
    } catch (error) {
      console.error('MFA enrollment error:', error);

      showMessage(
        'We could not complete authenticator setup. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  });

  initializeEnrollment();
})();
