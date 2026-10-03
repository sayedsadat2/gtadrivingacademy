(() => {
  'use strict';

  /*
   * GTA Driving Academy — Secure Digital Learning Client
   *
   * IMPORTANT:
   * - The browser does NOT award training time.
   * - The browser does NOT write module_progress.
   * - The browser reports activity evidence only.
   * - Authoritative time credit is determined server-side.
   */

  const COURSE_ID = 1;
  const HEARTBEAT_INTERVAL_MS = 30_000;

  const match = window.location.pathname.match(/session-(\d+)\.html$/i);

  if (!match) {
    console.error('GTA LMS: Could not determine module number.');
    return;
  }

  const moduleNumber = Number.parseInt(match[1], 10);

  if (
    !Number.isInteger(moduleNumber) ||
    moduleNumber < 1 ||
    moduleNumber > 10
  ) {
    console.error('GTA LMS: Invalid module number.');
    return;
  }

  /*
   * Verified against the current modules table:
   * module IDs 1–10 correspond to module numbers 1–10.
   */
  const MODULE_ID = moduleNumber;

  let client = null;
  let learningSessionId = null;
  let clientSequence = 0;
  let initialized = false;
  let heartbeatTimer = null;
  let eventInFlight = false;
  let lastInteractionSentAt = 0;

  function pageReference() {
    return window.location.pathname.split('/').pop() || window.location.pathname;
  }

  function stopHeartbeat() {
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  async function redirectToLogin() {
    stopHeartbeat();

    try {
      if (client) {
        await client.auth.signOut();
      }
    } catch (error) {
      console.error('GTA LMS: Sign-out error:', error);
    }

    window.location.replace('login.html');
  }

  async function requireAal2() {
    const {
      data: { session },
      error: sessionError
    } = await client.auth.getSession();

    if (sessionError || !session) {
      window.location.replace('login.html');
      return false;
    }

    const { data: aalData, error: aalError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();

    if (
      aalError ||
      !aalData ||
      aalData.currentLevel !== 'aal2'
    ) {
      window.location.replace('mfa.html');
      return false;
    }

    return true;
  }

  async function startLearningSession() {
    /*
     * This RPC is authoritative.
     *
     * Server-side controls already verify:
     * - authenticated user
     * - AAL2
     * - auth session
     * - student role
     * - enrollment
     * - active course/module
     * - concurrent session rules
     * - curriculum version binding
     */
    const { data, error } = await client.rpc(
      'start_digital_learning_session',
      {
        p_course_id: COURSE_ID,
        p_module_id: MODULE_ID
      }
    );

    if (error) {
      console.error(
        'GTA LMS: Unable to start digital learning session:',
        error
      );
      throw error;
    }

    /*
     * The function returns digital_learning_sessions.
     * Depending on PostgREST serialization this may be a row object
     * or a one-element array, so safely support both.
     */
    const row = Array.isArray(data) ? data[0] : data;

    if (!row || !row.id) {
      throw new Error(
        'GTA LMS: Learning session RPC did not return a session ID.'
      );
    }

    learningSessionId = row.id;

    /*
     * A newly created session may require identity verification before
     * learning becomes authorized. The browser must not change that state.
     */
    return row;
  }

  async function recordActivityEvent(
    eventType,
    activityState = null
  ) {
    if (!learningSessionId) {
      return null;
    }

    /*
     * Serialize browser evidence events.
     * This avoids accidental overlapping sequence numbers.
     */
    if (eventInFlight) {
      return null;
    }

    eventInFlight = true;

    const sequence = clientSequence + 1;

    try {
      const { data, error } = await client.rpc(
        'record_learning_activity_event',
        {
          p_learning_session_id: learningSessionId,
          p_event_type: eventType,
          p_client_sequence: sequence,
          p_activity_state: activityState,
          p_lesson_id: null,
          p_page_reference: pageReference(),
          p_client_reported_at: new Date().toISOString()
        }
      );

      if (error) {
        console.error(
          `GTA LMS: Activity event "${eventType}" failed:`,
          error
        );

        /*
         * Do not advance the sequence when the server rejected the event.
         */
        return null;
      }

      clientSequence = sequence;

      return data;
    } finally {
      eventInFlight = false;
    }
  }

  async function sendHeartbeat() {
    if (
      document.visibilityState !== 'visible' ||
      !document.hasFocus()
    ) {
      return;
    }

    await recordActivityEvent('heartbeat', 'active');
  }

  function beginHeartbeat() {
    stopHeartbeat();

    heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  function installActivityListeners() {
    document.addEventListener('visibilitychange', () => {
      if (!initialized) {
        return;
      }

      if (document.visibilityState === 'visible') {
        void recordActivityEvent('page_visible', 'active');
      } else {
        void recordActivityEvent('page_hidden', 'inactive');
      }
    });

    window.addEventListener('focus', () => {
      if (!initialized) {
        return;
      }

      void recordActivityEvent('activity_resumed', 'active');
    });

    /*
     * Meaningful user interaction is rate-limited so normal scrolling,
     * clicking, or typing does not flood the audit/event table.
     */
    const interactionHandler = () => {
      if (!initialized || document.visibilityState !== 'visible') {
        return;
      }

      const now = Date.now();

      if (now - lastInteractionSentAt < 15_000) {
        return;
      }

      lastInteractionSentAt = now;

      void recordActivityEvent('interaction', 'active');
    };

    document.addEventListener('click', interactionHandler, {
      passive: true
    });

    document.addEventListener('keydown', interactionHandler);

    document.addEventListener('scroll', interactionHandler, {
      passive: true
    });

    document.addEventListener('pointerdown', interactionHandler, {
      passive: true
    });
  }

  async function initializeSecureLearning() {
    client = window.gtaSupabase;

    if (!client) {
      console.error('GTA LMS: Supabase client is unavailable.');
      return;
    }

    const aal2Verified = await requireAal2();

    if (!aal2Verified) {
      return;
    }

    try {
      const sessionRow = await startLearningSession();

      /*
       * Synchronize the first client sequence with the session row when
       * available. This matters if start_digital_learning_session()
       * returned an existing idempotent active session.
       */
      if (
        Number.isInteger(Number(sessionRow.last_client_sequence)) &&
        Number(sessionRow.last_client_sequence) >= 0
      ) {
        clientSequence = Number(sessionRow.last_client_sequence);
      }

      initialized = true;

      installActivityListeners();

      /*
       * session_started is already inserted by the trusted
       * start_digital_learning_session() database function.
       * Do not duplicate it from the browser.
       */
      if (document.visibilityState === 'visible') {
        await recordActivityEvent('page_visible', 'active');
      }

      beginHeartbeat();

      console.info(
        `GTA LMS: Secure learning session ${learningSessionId} initialized for module ${MODULE_ID}.`
      );
    } catch (error) {
      stopHeartbeat();

      console.error(
        'GTA LMS: Secure learning initialization failed:',
        error
      );

      /*
       * Do not fall back to browser-side timing.
       * If the authoritative session cannot start, no training time
       * should be credited.
       */
    }
  }

  /*
   * Do not attempt asynchronous RPC calls during beforeunload.
   * Browsers may terminate them before delivery. Server-side inactivity
   * controls and subsequent trusted events handle stale sessions.
   */
  window.addEventListener('pagehide', () => {
    stopHeartbeat();
  });

  void initializeSecureLearning();
})();
