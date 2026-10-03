(() => {
  'use strict';

  /*
   * ============================================================
   * GTA Driving Academy LMS
   * Secure Learning Identity Verification Client
   * ============================================================
   *
   * SECURITY PRINCIPLES
   *
   * 1. The browser never authorizes learning.
   * 2. The browser never awards training time.
   * 3. The browser never writes trusted identity evidence directly.
   * 4. A fresh TOTP verification is performed through Supabase Auth.
   * 5. The database creates/completes identity challenges.
   * 6. Final authorization is confirmed through the trusted,
   *    student-safe get_learning_identity_status() RPC.
   * 7. Any uncertain condition fails closed.
   * 8. TOTP codes are never stored in localStorage/sessionStorage.
   * ============================================================
   */

  const COURSE_ID = 1;

  const SESSION_WAIT_TIMEOUT_MS = 10_000;
  const SESSION_POLL_INTERVAL_MS = 250;

  const TAB_LOCK_TTL_MS = 15_000;
  const TAB_LOCK_REFRESH_MS = 5_000;

  const AUTHORIZATION_POLL_ATTEMPTS = 5;
  const AUTHORIZATION_POLL_DELAY_MS = 300;

  const match = window.location.pathname.match(
    /session-(\d+)\.html$/i
  );

  if (!match) {
    return;
  }

  const moduleNumber = Number.parseInt(
    match[1],
    10
  );

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

  const TAB_ID =
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  let client = null;

  let learningSessionId = null;
  let identityChallengeId = null;

  let initialized = false;
  let initializationInProgress = false;
  let verificationInProgress = false;
  let verificationComplete = false;

  let overlay = null;
  let card = null;
  let codeInput = null;
  let verifyButton = null;
  let statusElement = null;
  let supportElement = null;

  let previousActiveElement = null;

  let tabLockRefreshTimer = null;

  /*
   * BroadcastChannel is coordination only.
   * It is NOT treated as a security authority.
   */
  const identityChannel =
    'BroadcastChannel' in window
      ? new BroadcastChannel(
          'gta-learning-identity'
        )
      : null;

  function sleep(milliseconds) {
    return new Promise(resolve => {
      window.setTimeout(
        resolve,
        milliseconds
      );
    });
  }

  function getTabLockKey() {
    if (!learningSessionId) {
      return null;
    }

    return (
      `gta_identity_verification_lock_` +
      `${learningSessionId}`
    );
  }

  function readTabLock() {
    const key =
      getTabLockKey();

    if (!key) {
      return null;
    }

    try {
      const raw =
        window.localStorage.getItem(
          key
        );

      if (!raw) {
        return null;
      }

      const parsed =
        JSON.parse(raw);

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.tabId ||
        !parsed.expiresAt
      ) {
        return null;
      }

      if (
        Number(parsed.expiresAt) <=
        Date.now()
      ) {
        window.localStorage.removeItem(
          key
        );

        return null;
      }

      return parsed;
    } catch (error) {
      console.warn(
        'GTA LMS Identity: Unable to read tab coordination lock.',
        error
      );

      return null;
    }
  }

  function acquireTabLock() {
    const key =
      getTabLockKey();

    if (!key) {
      return true;
    }

    const existing =
      readTabLock();

    if (
      existing &&
      existing.tabId !== TAB_ID
    ) {
      return false;
    }

    try {
      const value = {
        tabId: TAB_ID,
        expiresAt:
          Date.now() +
          TAB_LOCK_TTL_MS
      };

      window.localStorage.setItem(
        key,
        JSON.stringify(value)
      );

      const confirmed =
        readTabLock();

      return (
        confirmed?.tabId === TAB_ID
      );
    } catch (error) {
      /*
       * Browser storage coordination is best-effort only.
       * Server-side challenge/session checks remain authoritative.
       */
      console.warn(
        'GTA LMS Identity: Tab coordination storage unavailable.',
        error
      );

      return true;
    }
  }

  function refreshTabLock() {
    const key =
      getTabLockKey();

    if (!key) {
      return;
    }

    try {
      const existing =
        readTabLock();

      if (
        existing?.tabId !== TAB_ID
      ) {
        return;
      }

      window.localStorage.setItem(
        key,
        JSON.stringify({
          tabId: TAB_ID,
          expiresAt:
            Date.now() +
            TAB_LOCK_TTL_MS
        })
      );
    } catch (error) {
      console.warn(
        'GTA LMS Identity: Unable to refresh tab coordination lock.',
        error
      );
    }
  }

  function beginTabLockRefresh() {
    stopTabLockRefresh();

    tabLockRefreshTimer =
      window.setInterval(
        refreshTabLock,
        TAB_LOCK_REFRESH_MS
      );
  }

  function stopTabLockRefresh() {
    if (
      tabLockRefreshTimer !== null
    ) {
      window.clearInterval(
        tabLockRefreshTimer
      );

      tabLockRefreshTimer = null;
    }
  }

  function releaseTabLock() {
    stopTabLockRefresh();

    const key =
      getTabLockKey();

    if (!key) {
      return;
    }

    try {
      const existing =
        readTabLock();

      if (
        existing?.tabId === TAB_ID
      ) {
        window.localStorage.removeItem(
          key
        );
      }
    } catch (error) {
      console.warn(
        'GTA LMS Identity: Unable to release tab coordination lock.',
        error
      );
    }
  }

  function broadcast(message) {
    try {
      identityChannel?.postMessage({
        ...message,
        learningSessionId,
        moduleId: MODULE_ID,
        senderTabId: TAB_ID
      });
    } catch (error) {
      console.warn(
        'GTA LMS Identity: Broadcast failed.',
        error
      );
    }
  }

  function setStatus(
    message,
    isError = false
  ) {
    if (!statusElement) {
      return;
    }

    statusElement.textContent =
      message;

    statusElement.style.color =
      isError
        ? '#b42318'
        : '#344054';
  }

  function setSupportMessage(
    message = ''
  ) {
    if (!supportElement) {
      return;
    }

    supportElement.textContent =
      message;

    supportElement.style.display =
      message ? 'block' : 'none';
  }

  function setBusy(busy) {
    verificationInProgress =
      busy;

    if (verifyButton) {
      verifyButton.disabled =
        busy;

      verifyButton.textContent =
        busy
          ? 'Verifying...'
          : 'Verify Identity';

      verifyButton.style.opacity =
        busy ? '0.65' : '1';

      verifyButton.style.cursor =
        busy
          ? 'not-allowed'
          : 'pointer';
    }

    if (codeInput) {
      codeInput.disabled =
        busy;
    }
  }

  function blockLessonInteraction() {
    document.documentElement.setAttribute(
      'data-gta-identity-required',
      'true'
    );
  }

  function unblockLessonInteraction() {
    document.documentElement.removeAttribute(
      'data-gta-identity-required'
    );
  }

  function handleOverlayKeydown(
    event
  ) {
    if (
      event.key === 'Escape'
    ) {
      /*
       * Verification cannot be dismissed with Escape.
       * Learning remains blocked until the trusted server state
       * becomes authorized.
       */
      event.preventDefault();
      return;
    }

    if (
      event.key !== 'Tab' ||
      !card
    ) {
      return;
    }

    const focusable =
      Array.from(
        card.querySelectorAll(
          'input:not([disabled]), button:not([disabled])'
        )
      );

    if (!focusable.length) {
      return;
    }

    const first =
      focusable[0];

    const last =
      focusable[
        focusable.length - 1
      ];

    if (
      event.shiftKey &&
      document.activeElement ===
        first
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement ===
        last
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  function createVerificationOverlay() {
    if (overlay) {
      return;
    }

    previousActiveElement =
      document.activeElement;

    blockLessonInteraction();

    overlay =
      document.createElement(
        'div'
      );

    overlay.id =
      'gta-identity-verification-overlay';

    overlay.setAttribute(
      'role',
      'dialog'
    );

    overlay.setAttribute(
      'aria-modal',
      'true'
    );

    overlay.setAttribute(
      'aria-labelledby',
      'gta-identity-heading'
    );

    overlay.setAttribute(
      'aria-describedby',
      'gta-identity-description'
    );

    Object.assign(
      overlay.style,
      {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        background:
          'rgba(10, 31, 56, 0.84)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }
    );

    card =
      document.createElement(
        'div'
      );

    Object.assign(
      card.style,
      {
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflowY: 'auto',
        background: '#ffffff',
        borderRadius: '18px',
        boxShadow:
          '0 24px 70px rgba(0, 0, 0, 0.28)',
        padding: '32px',
        boxSizing: 'border-box',
        fontFamily:
          'Inter, Arial, Helvetica, sans-serif'
      }
    );

    const eyebrow =
      document.createElement(
        'div'
      );

    eyebrow.textContent =
      'GTA DRIVING ACADEMY';

    Object.assign(
      eyebrow.style,
      {
        color: '#f05a00',
        fontWeight: '800',
        fontSize: '12px',
        letterSpacing: '1.4px',
        marginBottom: '12px'
      }
    );

    const heading =
      document.createElement(
        'h2'
      );

    heading.id =
      'gta-identity-heading';

    heading.textContent =
      'Identity verification required';

    Object.assign(
      heading.style,
      {
        margin: '0 0 12px',
        color: '#173b67',
        fontSize: '26px',
        lineHeight: '1.2'
      }
    );

    const explanation =
      document.createElement(
        'p'
      );

    explanation.id =
      'gta-identity-description';

    explanation.textContent =
      'To begin this secure learning session, enter the current 6-digit code from the authenticator app connected to your GTA Driving Academy student account.';

    Object.assign(
      explanation.style,
      {
        margin: '0 0 22px',
        color: '#475467',
        fontSize: '15px',
        lineHeight: '1.6'
      }
    );

    const label =
      document.createElement(
        'label'
      );

    label.htmlFor =
      'gta-identity-code';

    label.textContent =
      'Authenticator code';

    Object.assign(
      label.style,
      {
        display: 'block',
        color: '#1d2939',
        fontWeight: '700',
        fontSize: '14px',
        marginBottom: '8px'
      }
    );

    codeInput =
      document.createElement(
        'input'
      );

    codeInput.id =
      'gta-identity-code';

    codeInput.type =
      'text';

    codeInput.inputMode =
      'numeric';

    codeInput.autocomplete =
      'one-time-code';

    codeInput.maxLength = 6;

    codeInput.placeholder =
      '000000';

    codeInput.setAttribute(
      'aria-label',
      'Six digit authenticator code'
    );

    Object.assign(
      codeInput.style,
      {
        width: '100%',
        boxSizing: 'border-box',
        border:
          '1px solid #d0d5dd',
        borderRadius: '10px',
        padding: '14px 16px',
        fontSize: '24px',
        fontWeight: '700',
        letterSpacing: '8px',
        textAlign: 'center',
        outline: 'none',
        marginBottom: '14px'
      }
    );

    codeInput.addEventListener(
      'input',
      () => {
        codeInput.value =
          codeInput.value
            .replace(/\D/g, '')
            .slice(0, 6);
      }
    );

    codeInput.addEventListener(
      'keydown',
      event => {
        if (
          event.key ===
            'Enter' &&
          !verificationInProgress
        ) {
          void verifyIdentity();
        }
      }
    );

    verifyButton =
      document.createElement(
        'button'
      );

    verifyButton.type =
      'button';

    verifyButton.textContent =
      'Verify Identity';

    Object.assign(
      verifyButton.style,
      {
        width: '100%',
        border: '0',
        borderRadius: '10px',
        padding: '14px 18px',
        background: '#f05a00',
        color: '#ffffff',
        fontSize: '16px',
        fontWeight: '800',
        cursor: 'pointer'
      }
    );

    verifyButton.addEventListener(
      'click',
      () => {
        void verifyIdentity();
      }
    );

    statusElement =
      document.createElement(
        'p'
      );

    statusElement.setAttribute(
      'role',
      'status'
    );

    statusElement.setAttribute(
      'aria-live',
      'polite'
    );

    Object.assign(
      statusElement.style,
      {
        minHeight: '22px',
        margin: '14px 0 0',
        color: '#344054',
        fontSize: '14px',
        lineHeight: '1.5',
        textAlign: 'center'
      }
    );

    supportElement =
      document.createElement(
        'p'
      );

    supportElement.setAttribute(
      'role',
      'alert'
    );

    Object.assign(
      supportElement.style,
      {
        display: 'none',
        margin: '10px 0 0',
        color: '#b42318',
        fontSize: '13px',
        lineHeight: '1.5',
        textAlign: 'center'
      }
    );

    const securityNote =
      document.createElement(
        'p'
      );

    securityNote.textContent =
      'Your authenticator code is verified through the secure authentication service. GTA Driving Academy does not store the code you enter.';

    Object.assign(
      securityNote.style,
      {
        margin: '18px 0 0',
        color: '#667085',
        fontSize: '12px',
        lineHeight: '1.5',
        textAlign: 'center'
      }
    );

    card.appendChild(
      eyebrow
    );

    card.appendChild(
      heading
    );

    card.appendChild(
      explanation
    );

    card.appendChild(
      label
    );

    card.appendChild(
      codeInput
    );

    card.appendChild(
      verifyButton
    );

    card.appendChild(
      statusElement
    );

    card.appendChild(
      supportElement
    );

    card.appendChild(
      securityNote
    );

    overlay.appendChild(
      card
    );

    overlay.addEventListener(
      'keydown',
      handleOverlayKeydown
    );

    document.body.appendChild(
      overlay
    );

    window.setTimeout(
      () => {
        codeInput?.focus();
      },
      50
    );
  }

  function removeVerificationOverlay() {
    if (overlay) {
      overlay.removeEventListener(
        'keydown',
        handleOverlayKeydown
      );

      overlay.remove();
    }

    overlay = null;
    card = null;
    codeInput = null;
    verifyButton = null;
    statusElement = null;
    supportElement = null;

    unblockLessonInteraction();

    if (
      previousActiveElement &&
      typeof previousActiveElement
        .focus === 'function'
    ) {
      try {
        previousActiveElement.focus();
      } catch {
        // No action required.
      }
    }

    previousActiveElement =
      null;
  }

  async function requireAuthenticatedSession() {
    const {
      data: { session },
      error
    } =
      await client.auth.getSession();

    if (
      error ||
      !session
    ) {
      window.location.replace(
        'login.html'
      );

      return false;
    }

    return true;
  }

  async function confirmAal2() {
    const {
      data,
      error
    } =
      await client.auth.mfa
        .getAuthenticatorAssuranceLevel();

    if (error) {
      throw error;
    }

    if (
      !data ||
      data.currentLevel !==
        'aal2'
    ) {
      throw new Error(
        'aal2_required'
      );
    }

    return true;
  }

  async function getVerifiedTotpFactor() {
    const {
      data,
      error
    } =
      await client.auth.mfa
        .listFactors();

    if (error) {
      throw error;
    }

    const factors =
      data?.totp || [];

    return (
      factors.find(
        factor =>
          factor.status ===
          'verified'
      ) || null
    );
  }

  async function getAuthoritativeStatus() {
    if (!learningSessionId) {
      throw new Error(
        'learning_session_unavailable'
      );
    }

    const {
      data,
      error
    } =
      await client.rpc(
        'get_learning_identity_status',
        {
          p_learning_session_id:
            learningSessionId
        }
      );

    if (error) {
      throw error;
    }

    if (
      !data ||
      data.ok !== true ||
      !data.learning_session
    ) {
      throw new Error(
        'invalid_identity_status_response'
      );
    }

    return data;
  }

  function isExpiredChallenge(
    challenge
  ) {
    if (
      !challenge ||
      !challenge.expires_at
    ) {
      return false;
    }

    const expiresAt =
      Date.parse(
        challenge.expires_at
      );

    if (
      Number.isNaN(expiresAt)
    ) {
      return false;
    }

    return (
      expiresAt <= Date.now()
    );
  }

  function dispatchAuthoritativeVerification(
    status
  ) {
    const session =
      status.learning_session;

    window.dispatchEvent(
      new CustomEvent(
        'gta:identity-verified',
        {
          detail: {
            learningSessionId:
              Number(session.id),

            authorizationState:
              session.learning_authorization_state,

            authorizationGeneration:
              Number(
                session.authorization_generation ||
                0
              ),

            verifiedAt:
              session.last_identity_verified_at ||
              null
          }
        }
      )
    );

    broadcast({
      type:
        'identity-authorized'
    });
  }

  async function handleAuthorizedStatus(
    status
  ) {
    const session =
      status.learning_session;

    if (
      session.learning_authorization_state !==
      'authorized'
    ) {
      return false;
    }

    verificationComplete =
      true;

    releaseTabLock();

    setStatus(
      'Identity verified. Your secure learning session is authorized.'
    );

    dispatchAuthoritativeVerification(
      status
    );

    await sleep(500);

    removeVerificationOverlay();

    return true;
  }

  function handleTerminalChallenge(
    challenge
  ) {
    if (!challenge) {
      return false;
    }

    if (
      challenge.status ===
      'locked'
    ) {
      createVerificationOverlay();

      setBusy(true);

      setStatus(
        'Identity verification is locked.',
        true
      );

      setSupportMessage(
        challenge.support_reason
          ? `Support is required: ${challenge.support_reason}`
          : 'Support is required before this learning session can continue.'
      );

      releaseTabLock();

      return true;
    }

    if (
      challenge.status ===
        'cancelled' ||
      challenge.status ===
        'expired' ||
      isExpiredChallenge(
        challenge
      )
    ) {
      createVerificationOverlay();

      setBusy(true);

      setStatus(
        'This identity verification challenge is no longer active.',
        true
      );

      setSupportMessage(
        'Return to the student dashboard and reopen the module to request a valid learning session.'
      );

      releaseTabLock();

      return true;
    }

    if (
      challenge.support_required ===
      true
    ) {
      createVerificationOverlay();

      setBusy(true);

      setStatus(
        'This verification requires support.',
        true
      );

      setSupportMessage(
        challenge.support_reason ||
        'Contact GTA Driving Academy before continuing.'
      );

      releaseTabLock();

      return true;
    }

    return false;
  }

  async function createIdentityChallenge() {
    const {
      data,
      error
    } =
      await client.rpc(
        'create_identity_verification_challenge',
        {
          p_course_id:
            COURSE_ID,

          p_module_id:
            MODULE_ID,

          p_learning_session_id:
            learningSessionId,

          p_challenge_type:
            'initial_login',

          p_quiz_attempt_id:
            null
        }
      );

    if (error) {
      /*
       * Another tab/request may have created the challenge between
       * our status check and this call.
       *
       * Do not assume failure. The caller re-reads authoritative
       * status after this exception.
       */
      throw error;
    }

    const challenge =
      Array.isArray(data)
        ? data[0]
        : data;

    if (
      !challenge ||
      !challenge.id
    ) {
      throw new Error(
        'identity_challenge_not_created'
      );
    }

    return challenge;
  }

  async function ensureChallenge() {
    let status =
      await getAuthoritativeStatus();

    if (
      await handleAuthorizedStatus(
        status
      )
    ) {
      return status;
    }

    const session =
      status.learning_session;

    if (
      session.status !==
      'active'
    ) {
      throw new Error(
        'learning_session_not_active'
      );
    }

    if (
      session.learning_authorization_state !==
      'initial_verification_required'
    ) {
      throw new Error(
        `unexpected_authorization_state:${
          session.learning_authorization_state
        }`
      );
    }

    let challenge =
      status.identity_challenge;

    if (
      challenge &&
      handleTerminalChallenge(
        challenge
      )
    ) {
      return status;
    }

    if (
      challenge &&
      challenge.status ===
        'passed'
    ) {
      /*
       * Challenge says passed but session is not authorized.
       * Do not trust the browser or challenge alone.
       */
      throw new Error(
        'challenge_passed_session_not_authorized'
      );
    }

    if (
      challenge &&
      challenge.status ===
        'pending' &&
      !isExpiredChallenge(
        challenge
      )
    ) {
      identityChallengeId =
        Number(challenge.id);

      createVerificationOverlay();

      return status;
    }

    /*
     * No usable challenge exists.
     *
     * Browser tab coordination reduces duplicate simultaneous create
     * calls. The database remains the security authority.
     */
    const ownsTabLock =
      acquireTabLock();

    if (!ownsTabLock) {
      createVerificationOverlay();

      setBusy(true);

      setStatus(
        'Identity verification is active in another tab.'
      );

      setSupportMessage(
        'Complete the verification in the other module tab, or close that tab and try again.'
      );

      return status;
    }

    beginTabLockRefresh();

    try {
      await createIdentityChallenge();
    } catch (error) {
      console.warn(
        'GTA LMS Identity: Challenge creation returned an error; checking authoritative state.',
        error
      );
    }

    /*
     * Always re-read server state after attempting creation.
     * Never trust the create response as the final authority.
     */
    status =
      await getAuthoritativeStatus();

    if (
      await handleAuthorizedStatus(
        status
      )
    ) {
      return status;
    }

    challenge =
      status.identity_challenge;

    if (
      challenge &&
      handleTerminalChallenge(
        challenge
      )
    ) {
      return status;
    }

    if (
      !challenge ||
      challenge.status !==
        'pending' ||
      isExpiredChallenge(
        challenge
      )
    ) {
      releaseTabLock();

      throw new Error(
        'usable_identity_challenge_unavailable'
      );
    }

    identityChallengeId =
      Number(challenge.id);

    createVerificationOverlay();

    return status;
  }

  async function performFreshTotpVerification(
    code
  ) {
    const factor =
      await getVerifiedTotpFactor();

    if (!factor) {
      throw new Error(
        'verified_totp_factor_missing'
      );
    }

    const {
      data,
      error
    } =
      await client.auth.mfa
        .challengeAndVerify({
          factorId:
            factor.id,
          code
        });

    if (error) {
      throw error;
    }

    return data;
  }

  async function completeIdentityChallenge() {
    const {
      data,
      error
    } =
      await client.rpc(
        'complete_identity_verification_challenge',
        {
          p_challenge_id:
            identityChallengeId
        }
      );

    if (error) {
      throw error;
    }

    return data;
  }

  async function waitForAuthorizedState() {
    let lastStatus = null;

    for (
      let attempt = 0;
      attempt <
      AUTHORIZATION_POLL_ATTEMPTS;
      attempt += 1
    ) {
      lastStatus =
        await getAuthoritativeStatus();

      if (
        lastStatus
          .learning_session
          .learning_authorization_state ===
        'authorized'
      ) {
        return lastStatus;
      }

      if (
        attempt <
        AUTHORIZATION_POLL_ATTEMPTS -
          1
      ) {
        await sleep(
          AUTHORIZATION_POLL_DELAY_MS
        );
      }
    }

    return lastStatus;
  }

  function classifyVerificationError(
    error
  ) {
    const message =
      String(
        error?.message ||
        error?.code ||
        error ||
        ''
      ).toLowerCase();

    if (
      message.includes(
        'aal2_required'
      )
    ) {
      return {
        message:
          'Your secure authentication session is no longer valid. Sign in again before continuing.',
        clearCode: true
      };
    }

    if (
      message.includes(
        'expired'
      )
    ) {
      return {
        message:
          'The verification challenge expired. Reopen the module to start a new secure session.',
        clearCode: true
      };
    }

    if (
      message.includes(
        'locked'
      ) ||
      message.includes(
        'maximum'
      )
    ) {
      return {
        message:
          'Identity verification is locked. Contact GTA Driving Academy before continuing.',
        clearCode: true
      };
    }

    if (
      message.includes(
        'auth_session'
      ) ||
      message.includes(
        'session mismatch'
      )
    ) {
      return {
        message:
          'Your secure login session changed. Sign in again before continuing.',
        clearCode: true
      };
    }

    if (
      message.includes(
        'totp'
      ) ||
      message.includes(
        'factor'
      ) ||
      message.includes(
        'code'
      ) ||
      message.includes(
        'verify'
      )
    ) {
      return {
        message:
          'The authenticator code could not be verified. Enter the current code and try again.',
        clearCode: true
      };
    }

    return {
      message:
        'Identity verification could not be completed. Your learning session remains protected. Please try again.',
      clearCode: false
    };
  }

  async function verifyIdentity() {
    if (
      verificationInProgress ||
      verificationComplete
    ) {
      return;
    }

    const code =
      codeInput?.value
        .replace(/\D/g, '')
        .trim();

    if (
      !code ||
      code.length !== 6
    ) {
      setStatus(
        'Enter the current 6-digit authenticator code.',
        true
      );

      codeInput?.focus();

      return;
    }

    setBusy(true);

    setSupportMessage('');

    setStatus(
      'Verifying your identity...'
    );

    try {
      /*
       * Re-check authoritative challenge state immediately before
       * consuming the student's fresh TOTP.
       */
      let status =
        await getAuthoritativeStatus();

      if (
        await handleAuthorizedStatus(
          status
        )
      ) {
        return;
      }

      const challenge =
        status.identity_challenge;

      if (
        !challenge ||
        challenge.status !==
          'pending' ||
        isExpiredChallenge(
          challenge
        )
      ) {
        throw new Error(
          'identity_challenge_not_pending'
        );
      }

      identityChallengeId =
        Number(challenge.id);

      /*
       * Perform a fresh authentication event.
       */
      await performFreshTotpVerification(
        code
      );

      /*
       * Independently confirm the authentication assurance level.
       */
      await confirmAal2();

      /*
       * Ask the trusted database function to complete the challenge.
       *
       * Its return value is informative only.
       * We still independently read authoritative state afterward.
       */
      await completeIdentityChallenge();

      status =
        await waitForAuthorizedState();

      if (
        !status ||
        status.learning_session
          .learning_authorization_state !==
          'authorized'
      ) {
        throw new Error(
          'server_authorization_not_confirmed'
        );
      }

      verificationComplete =
        true;

      setStatus(
        'Identity verified. Your secure learning session is authorized.'
      );

      dispatchAuthoritativeVerification(
        status
      );

      releaseTabLock();

      await sleep(600);

      removeVerificationOverlay();
    } catch (error) {
      console.error(
        'GTA LMS Identity: Verification failed:',
        error
      );

      /*
       * First attempt to refresh authoritative state.
       *
       * The operation may have succeeded server-side even if the
       * browser experienced a transient network response failure.
       */
      try {
        const refreshed =
          await getAuthoritativeStatus();

        if (
          await handleAuthorizedStatus(
            refreshed
          )
        ) {
          return;
        }

        if (
          handleTerminalChallenge(
            refreshed.identity_challenge
          )
        ) {
          return;
        }
      } catch (refreshError) {
        console.error(
          'GTA LMS Identity: Unable to refresh authoritative state after verification error:',
          refreshError
        );
      }

      const classified =
        classifyVerificationError(
          error
        );

      if (
        classified.clearCode &&
        codeInput
      ) {
        codeInput.value = '';
      }

      setStatus(
        classified.message,
        true
      );

      codeInput?.focus();
    } finally {
      if (
        !verificationComplete
      ) {
        setBusy(false);
      }
    }
  }

  async function initializeForLearningSession(
    sessionId
  ) {
    if (
      initialized ||
      initializationInProgress
    ) {
      return;
    }

    const normalizedId =
      Number(sessionId);

    if (
      !Number.isFinite(
        normalizedId
      ) ||
      normalizedId <= 0
    ) {
      return;
    }

    initializationInProgress =
      true;

    learningSessionId =
      normalizedId;

    try {
      await confirmAal2();

      await ensureChallenge();

      initialized = true;
    } catch (error) {
      console.error(
        'GTA LMS Identity: Initialization failed:',
        error
      );

      createVerificationOverlay();

      setBusy(true);

      setStatus(
        'Secure identity verification could not be initialized.',
        true
      );

      setSupportMessage(
        'Your learning session remains protected. Return to the student dashboard and reopen the module. If the problem continues, contact GTA Driving Academy.'
      );
    } finally {
      initializationInProgress =
        false;
    }
  }

  function inspectExistingLearningSession() {
    const learningInterface =
      window.gtaLearningSession;

    if (
      !learningInterface ||
      typeof learningInterface
        .getSessionId !==
        'function'
    ) {
      return false;
    }

    const sessionId =
      learningInterface
        .getSessionId();

    if (!sessionId) {
      return false;
    }

    void initializeForLearningSession(
      sessionId
    );

    return true;
  }

  function installLearningSessionListener() {
    window.addEventListener(
      'gta:learning-session-ready',
      event => {
        const detail =
          event.detail || {};

        void initializeForLearningSession(
          detail.learningSessionId
        );
      }
    );
  }

  function installCrossTabListener() {
    if (!identityChannel) {
      return;
    }

    identityChannel.addEventListener(
      'message',
      event => {
        const message =
          event.data;

        if (
          !message ||
          message.senderTabId ===
            TAB_ID ||
          Number(
            message.learningSessionId
          ) !==
            Number(
              learningSessionId
            )
        ) {
          return;
        }

        if (
          message.type ===
          'identity-authorized'
        ) {
          /*
           * Another tab says verification completed.
           *
           * Never trust the message itself.
           * Re-read authoritative server state.
           */
          void (async () => {
            try {
              const status =
                await getAuthoritativeStatus();

              if (
                status.learning_session
                  .learning_authorization_state ===
                'authorized'
              ) {
                await handleAuthorizedStatus(
                  status
                );
              }
            } catch (error) {
              console.error(
                'GTA LMS Identity: Cross-tab authorization refresh failed:',
                error
              );
            }
          })();
        }
      }
    );
  }

  async function waitForLearningSession() {
    const startedAt =
      Date.now();

    while (
      Date.now() - startedAt <
      SESSION_WAIT_TIMEOUT_MS
    ) {
      if (
        inspectExistingLearningSession()
      ) {
        return true;
      }

      await sleep(
        SESSION_POLL_INTERVAL_MS
      );
    }

    return false;
  }

  async function initializeIdentityVerification() {
    client =
      window.gtaSupabase;

    if (!client) {
      console.error(
        'GTA LMS Identity: Supabase client is unavailable.'
      );

      return;
    }

    /*
     * Install synchronous listeners BEFORE awaiting anything.
     * This prevents the original startup race.
     */
    installLearningSessionListener();

    installCrossTabListener();

    const authenticated =
      await requireAuthenticatedSession();

    if (!authenticated) {
      return;
    }

    try {
      await confirmAal2();
    } catch {
      window.location.replace(
        'mfa.html'
      );

      return;
    }

    /*
     * Recovery path if module-progress.js already started the
     * learning session before this script finished authentication.
     */
    if (
      inspectExistingLearningSession()
    ) {
      return;
    }

    /*
     * Short controlled wait handles simultaneous startup without
     * requiring arbitrary long setTimeout chains.
     */
    const foundSession =
      await waitForLearningSession();

    if (!foundSession) {
      console.error(
        'GTA LMS Identity: Secure learning session was not available within the expected startup window.'
      );
    }
  }

  window.addEventListener(
    'pagehide',
    () => {
      releaseTabLock();

      try {
        identityChannel?.close();
      } catch {
        // No action required.
      }
    }
  );

  void initializeIdentityVerification();
})();
