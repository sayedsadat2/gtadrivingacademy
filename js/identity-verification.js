(() => {
  'use strict';

  /*
   * GTA Driving Academy
   * Secure Learning Identity Verification Client
   *
   * Security model:
   * 1. Student must already have an authenticated Supabase session.
   * 2. Student must have a verified TOTP factor.
   * 3. A learning identity challenge is created by the trusted DB function.
   * 4. Student must enter a fresh authenticator code.
   * 5. Supabase Auth verifies the TOTP code.
   * 6. The trusted DB completion function verifies the server-side context.
   * 7. The browser never authorizes learning itself.
   */

  const COURSE_ID = 1;

  const match = window.location.pathname.match(
    /session-(\d+)\.html$/i
  );

  if (!match) {
    return;
  }

  const moduleNumber = Number.parseInt(match[1], 10);

  if (
    !Number.isInteger(moduleNumber) ||
    moduleNumber < 1 ||
    moduleNumber > 10
  ) {
    console.error(
      'GTA LMS Identity: Invalid module number.'
    );
    return;
  }

  const MODULE_ID = moduleNumber;

  let client = null;
  let learningSessionId = null;
  let identityChallengeId = null;
  let verificationInProgress = false;
  let overlay = null;
  let codeInput = null;
  let statusElement = null;
  let verifyButton = null;

  function setStatus(message, isError = false) {
    if (!statusElement) {
      return;
    }

    statusElement.textContent = message;
    statusElement.style.color = isError
      ? '#b42318'
      : '#344054';
  }

  function setBusy(busy) {
    verificationInProgress = busy;

    if (verifyButton) {
      verifyButton.disabled = busy;
      verifyButton.textContent = busy
        ? 'Verifying...'
        : 'Verify Identity';
    }

    if (codeInput) {
      codeInput.disabled = busy;
    }
  }

  function createVerificationOverlay() {
    if (overlay) {
      return;
    }

    overlay = document.createElement('div');

    overlay.id = 'gta-identity-verification-overlay';

    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      background: 'rgba(10, 31, 56, 0.78)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      boxSizing: 'border-box'
    });

    const card = document.createElement('div');

    Object.assign(card.style, {
      width: '100%',
      maxWidth: '480px',
      background: '#ffffff',
      borderRadius: '18px',
      boxShadow: '0 24px 70px rgba(0, 0, 0, 0.28)',
      padding: '32px',
      boxSizing: 'border-box',
      fontFamily:
        'Inter, Arial, Helvetica, sans-serif'
    });

    const eyebrow = document.createElement('div');

    eyebrow.textContent = 'GTA DRIVING ACADEMY';

    Object.assign(eyebrow.style, {
      color: '#f05a00',
      fontWeight: '800',
      fontSize: '12px',
      letterSpacing: '1.4px',
      marginBottom: '12px'
    });

    const heading = document.createElement('h2');

    heading.textContent = 'Identity verification required';

    Object.assign(heading.style, {
      margin: '0 0 12px',
      color: '#173b67',
      fontSize: '26px',
      lineHeight: '1.2'
    });

    const explanation = document.createElement('p');

    explanation.textContent =
      'To begin this secure learning session, enter the current 6-digit code from the authenticator app connected to your GTA Driving Academy student account.';

    Object.assign(explanation.style, {
      margin: '0 0 22px',
      color: '#475467',
      fontSize: '15px',
      lineHeight: '1.6'
    });

    const label = document.createElement('label');

    label.textContent = 'Authenticator code';

    Object.assign(label.style, {
      display: 'block',
      color: '#1d2939',
      fontWeight: '700',
      fontSize: '14px',
      marginBottom: '8px'
    });

    codeInput = document.createElement('input');

    codeInput.type = 'text';
    codeInput.inputMode = 'numeric';
    codeInput.autocomplete = 'one-time-code';
    codeInput.maxLength = 6;
    codeInput.placeholder = '000000';
    codeInput.setAttribute(
      'aria-label',
      'Six digit authenticator code'
    );

    Object.assign(codeInput.style, {
      width: '100%',
      boxSizing: 'border-box',
      border: '1px solid #d0d5dd',
      borderRadius: '10px',
      padding: '14px 16px',
      fontSize: '24px',
      fontWeight: '700',
      letterSpacing: '8px',
      textAlign: 'center',
      outline: 'none',
      marginBottom: '14px'
    });

    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value
        .replace(/\D/g, '')
        .slice(0, 6);
    });

    codeInput.addEventListener('keydown', event => {
      if (
        event.key === 'Enter' &&
        !verificationInProgress
      ) {
        void verifyIdentity();
      }
    });

    verifyButton = document.createElement('button');

    verifyButton.type = 'button';
    verifyButton.textContent = 'Verify Identity';

    Object.assign(verifyButton.style, {
      width: '100%',
      border: '0',
      borderRadius: '10px',
      padding: '14px 18px',
      background: '#f05a00',
      color: '#ffffff',
      fontSize: '16px',
      fontWeight: '800',
      cursor: 'pointer'
    });

    verifyButton.addEventListener('click', () => {
      void verifyIdentity();
    });

    statusElement = document.createElement('p');

    statusElement.setAttribute(
      'role',
      'status'
    );

    statusElement.setAttribute(
      'aria-live',
      'polite'
    );

    Object.assign(statusElement.style, {
      minHeight: '22px',
      margin: '14px 0 0',
      fontSize: '14px',
      lineHeight: '1.5',
      textAlign: 'center'
    });

    const securityNote = document.createElement('p');

    securityNote.textContent =
      'Your authenticator code is verified through the secure authentication service. GTA Driving Academy does not store the code you enter.';

    Object.assign(securityNote.style, {
      margin: '18px 0 0',
      color: '#667085',
      fontSize: '12px',
      lineHeight: '1.5',
      textAlign: 'center'
    });

    card.appendChild(eyebrow);
    card.appendChild(heading);
    card.appendChild(explanation);
    card.appendChild(label);
    card.appendChild(codeInput);
    card.appendChild(verifyButton);
    card.appendChild(statusElement);
    card.appendChild(securityNote);

    overlay.appendChild(card);

    document.body.appendChild(overlay);

    window.setTimeout(() => {
      codeInput?.focus();
    }, 100);
  }

  function removeVerificationOverlay() {
    if (overlay) {
      overlay.remove();
    }

    overlay = null;
    codeInput = null;
    statusElement = null;
    verifyButton = null;
  }

  async function requireAuthenticatedSession() {
    const {
      data: { session },
      error
    } = await client.auth.getSession();

    if (error || !session) {
      window.location.replace('login.html');
      return false;
    }

    return true;
  }

  async function getVerifiedTotpFactor() {
    const { data, error } =
      await client.auth.mfa.listFactors();

    if (error) {
      throw error;
    }

    const totpFactors = data?.totp || [];

    return (
      totpFactors.find(
        factor => factor.status === 'verified'
      ) || null
    );
  }

  async function createIdentityChallenge() {
    const { data, error } = await client.rpc(
      'create_identity_verification_challenge',
      {
        p_course_id: COURSE_ID,
        p_module_id: MODULE_ID,
        p_learning_session_id: learningSessionId,
        p_challenge_type: 'initial_login',
        p_quiz_attempt_id: null
      }
    );

    if (error) {
      throw error;
    }

    const challenge = Array.isArray(data)
      ? data[0]
      : data;

    if (!challenge || !challenge.id) {
      throw new Error(
        'Identity challenge was not created.'
      );
    }

    identityChallengeId = challenge.id;

    return challenge;
  }

  async function performFreshTotpVerification(code) {
    const factor = await getVerifiedTotpFactor();

    if (!factor) {
      throw new Error(
        'No verified authenticator is connected to this account.'
      );
    }

    /*
     * challengeAndVerify performs a fresh TOTP verification through
     * Supabase Auth. The code itself is not written to our application
     * database.
     */
    const { data, error } =
      await client.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code
      });

    if (error) {
      throw error;
    }

    return data;
  }

  async function confirmAal2() {
    const { data, error } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();

    if (error) {
      throw error;
    }

    if (!data || data.currentLevel !== 'aal2') {
      throw new Error(
        'Secure authentication could not be confirmed.'
      );
    }

    return true;
  }

  async function completeIdentityChallenge() {
    const { data, error } = await client.rpc(
      'complete_identity_verification_challenge',
      {
        p_challenge_id: identityChallengeId
      }
    );

    if (error) {
      throw error;
    }

    return data;
  }

  async function verifyIdentity() {
    if (verificationInProgress) {
      return;
    }

    const code = codeInput?.value
      .replace(/\D/g, '')
      .trim();

    if (!code || code.length !== 6) {
      setStatus(
        'Enter the current 6-digit authenticator code.',
        true
      );

      codeInput?.focus();
      return;
    }

    setBusy(true);
    setStatus('Verifying your identity...');

    try {
      await performFreshTotpVerification(code);

      /*
       * Independently verify the authentication assurance level after
       * the TOTP operation. Do not trust the client operation alone.
       */
      await confirmAal2();

      /*
       * The database function performs the authoritative challenge
       * completion and creates the trusted identity evidence.
       */
      const result =
        await completeIdentityChallenge();

      if (!result || result.ok !== true) {
        const status =
          result?.status ||
          'verification_not_completed';

        throw new Error(status);
      }

      setStatus(
        'Identity verified. Your secure learning session is now authorized.'
      );

      window.setTimeout(() => {
        removeVerificationOverlay();

        window.dispatchEvent(
          new CustomEvent(
            'gta:identity-verified',
            {
              detail: {
                learningSessionId,
                challengeId:
                  identityChallengeId
              }
            }
          )
        );
      }, 700);
    } catch (error) {
      console.error(
        'GTA LMS Identity: Verification failed:',
        error
      );

      if (codeInput) {
        codeInput.value = '';
      }

      setStatus(
        'Identity verification was not completed. Check your authenticator code and try again.',
        true
      );

      codeInput?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function initializeIdentityVerification() {
    client = window.gtaSupabase;

    if (!client) {
      console.error(
        'GTA LMS Identity: Supabase client is unavailable.'
      );
      return;
    }

    const authenticated =
      await requireAuthenticatedSession();

    if (!authenticated) {
      return;
    }

    /*
     * module-progress.js exposes the authoritative learning session
     * through this event. We deliberately do not create a second
     * digital learning session here.
     */
    window.addEventListener(
      'gta:learning-session-ready',
      async event => {
        try {
          const detail = event.detail || {};

          learningSessionId =
            detail.learningSessionId || null;

          const authorizationState =
            detail.authorizationState || null;

          if (!learningSessionId) {
            throw new Error(
              'Learning session ID is unavailable.'
            );
          }

          if (
            authorizationState !==
            'initial_verification_required'
          ) {
            return;
          }

          await createIdentityChallenge();

          createVerificationOverlay();
        } catch (error) {
          console.error(
            'GTA LMS Identity: Unable to initialize verification:',
            error
          );
        }
      }
    );
  }

  void initializeIdentityVerification();
})();
