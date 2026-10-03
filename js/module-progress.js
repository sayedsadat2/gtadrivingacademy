(() => {
  'use strict';

  /*
   * ============================================================
   * GTA Driving Academy LMS
   * Secure Digital Learning Session Client
   * ============================================================
   *
   * SECURITY MODEL
   *
   * - Browser does NOT award instructional time.
   * - Browser does NOT authorize learning.
   * - Browser events are evidence only.
   * - Server RPCs determine trusted session state.
   * - Identity authorization is confirmed through
   *   get_learning_identity_status().
   * - Activity evidence is sent only while the authoritative
   *   learning authorization state is "authorized".
   * - Events are serialized to preserve client sequence order.
   * - Any uncertain authorization condition fails closed.
   * ============================================================
   */

  const COURSE_ID = 1;

  const HEARTBEAT_INTERVAL_MS = 30_000;

  const AUTHORIZED_STATE = 'authorized';

  const BLOCKED_AUTHORIZATION_STATES = new Set([
    'initial_verification_required',
    'reauthentication_required',
    'random_identity_check_required',
    'assessment_verification_required',
    'blocked'
  ]);

  const match = window.location.pathname.match(
    /session-(\d+)\.html$/i
  );

  if (!match) {
    return;
  }

  const MODULE_ID = Number.parseInt(
    match[1],
    10
  );

  if (
    !Number.isInteger(MODULE_ID) ||
    MODULE_ID < 1 ||
    MODULE_ID > 10
  ) {
    console.error(
      'GTA LMS Session: Invalid module number.'
    );
    return;
  }

  let client = null;

  let learningSessionId = null;

  let authorizationState = null;

  let authorizationGeneration = 0;

  let lastClientSequence = 0;

  let heartbeatTimer = null;

  let activityEnabled = false;

  let sessionStarted = false;

  let initializationInProgress = false;

  let pageIsUnloading = false;

  /*
   * All activity RPC calls pass through this queue.
   *
   * This prevents overlapping browser requests from producing
   * sequence-number races.
   */
  let activityQueue = Promise.resolve();

  function getNextSequence() {
    lastClientSequence += 1;

    return lastClientSequence;
  }

  function isPagePotentiallyActive() {
    return (
      document.visibilityState === 'visible' &&
      document.hasFocus()
    );
  }

  function isAuthorizedState(state) {
    return state === AUTHORIZED_STATE;
  }

  function setActivityEnabled(enabled) {
    activityEnabled =
      enabled === true;

    if (activityEnabled) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }
  }

  function startHeartbeat() {
    if (
      heartbeatTimer !== null ||
      !activityEnabled
    ) {
      return;
    }

    heartbeatTimer =
      window.setInterval(() => {
        if (
          pageIsUnloading ||
          !activityEnabled ||
          !isPagePotentiallyActive()
        ) {
          return;
        }

        void recordActivity(
          'heartbeat',
          'active'
        );
      }, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer !== null) {
      window.clearInterval(
        heartbeatTimer
      );

      heartbeatTimer = null;
    }
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

  async function requireAal2() {
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
      data.currentLevel !== 'aal2'
    ) {
      throw new Error(
        'aal2_required'
      );
    }

    return true;
  }

  async function startSecureLearningSession() {
    const {
      data,
      error
    } =
      await client.rpc(
        'start_digital_learning_session',
        {
          p_course_id: COURSE_ID,
          p_module_id: MODULE_ID
        }
      );

    if (error) {
      throw error;
    }

    const session =
      Array.isArray(data)
        ? data[0]
        : data;

    if (
      !session ||
      !session.id
    ) {
      throw new Error(
        'learning_session_not_created'
      );
    }

    learningSessionId =
      Number(session.id);

    authorizationState =
      session.learning_authorization_state ||
      null;

    authorizationGeneration =
      Number(
        session.authorization_generation ||
        0
      );

    lastClientSequence =
      Number(
        session.last_client_sequence ||
        0
      );

    sessionStarted = true;

    /*
     * IMPORTANT:
     *
     * Even if start_digital_learning_session() returns "authorized",
     * we still perform an authoritative status read below before
     * enabling browser activity evidence.
     */
    setActivityEnabled(false);

    return session;
  }

  async function getAuthoritativeIdentityStatus() {
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

  function applyAuthoritativeAuthorization(status) {
    if (
      !status ||
      !status.learning_session
    ) {
      setActivityEnabled(false);

      throw new Error(
        'invalid_authorization_status'
      );
    }

    const serverSession =
      status.learning_session;

    const serverSessionId =
      Number(serverSession.id);

    if (
      serverSessionId !==
      Number(learningSessionId)
    ) {
      setActivityEnabled(false);

      throw new Error(
        'learning_session_identity_mismatch'
      );
    }

    authorizationState =
      serverSession.learning_authorization_state ||
      null;

    authorizationGeneration =
      Number(
        serverSession.authorization_generation ||
        0
      );

    const sessionIsActive =
      serverSession.status === 'active';

    const serverAuthorized =
      sessionIsActive &&
      isAuthorizedState(
        authorizationState
      );

    /*
     * If an authorization expiry exists, the browser may use it
     * only to become MORE restrictive.
     *
     * It never uses a timestamp to grant authorization.
     */
    let authorizationNotExpired = true;

    if (
      serverSession.learning_authorization_expires_at
    ) {
      const expiresAt =
        Date.parse(
          serverSession.learning_authorization_expires_at
        );

      if (
        !Number.isNaN(expiresAt) &&
        expiresAt <= Date.now()
      ) {
        authorizationNotExpired = false;
      }
    }

    const canSendActivityEvidence =
      serverAuthorized &&
      authorizationNotExpired;

    setActivityEnabled(
      canSendActivityEvidence
    );

    return canSendActivityEvidence;
  }

  async function refreshAuthoritativeAuthorization() {
    /*
     * Fail closed while the server is being checked.
     */
    setActivityEnabled(false);

    const status =
      await getAuthoritativeIdentityStatus();

    applyAuthoritativeAuthorization(
      status
    );

    return status;
  }

  function dispatchLearningSessionReady() {
    window.dispatchEvent(
      new CustomEvent(
        'gta:learning-session-ready',
        {
          detail: {
            learningSessionId,
            courseId: COURSE_ID,
            moduleId: MODULE_ID,
            authorizationState,
            authorizationGeneration
          }
        }
      )
    );
  }

  async function sendActivityEvent(
    eventType,
    activityState = null,
    options = {}
  ) {
    if (
      !learningSessionId ||
      pageIsUnloading
    ) {
      return null;
    }

    /*
     * Ordinary instructional evidence is never sent while the
     * browser does not have server-confirmed authorization.
     */
    const permittedWithoutAuthorization =
      new Set([
        'identity_required',
        'identity_verified',
        'session_signed_out',
        'session_timed_out'
      ]);

    if (
      !activityEnabled &&
      !permittedWithoutAuthorization.has(
        eventType
      )
    ) {
      return null;
    }

    const sequence =
      getNextSequence();

    const payload = {
      p_learning_session_id:
        learningSessionId,

      p_event_type:
        eventType,

      p_client_sequence:
        sequence,

      p_activity_state:
        activityState,

      p_lesson_id:
        options.lessonId ?? null,

      p_page_reference:
        options.pageReference ??
        window.location.pathname,

      p_client_reported_at:
        new Date().toISOString()
    };

    const {
      data,
      error
    } =
      await client.rpc(
        'record_learning_activity_event',
        payload
      );

    if (error) {
      /*
       * Do not decrement the sequence.
       *
       * The backend owns sequence reconciliation and retry/conflict
       * semantics. Reusing a sequence locally could make evidence
       * ambiguous.
       */
      throw error;
    }

    /*
     * If the backend returns a newer authoritative sequence,
     * preserve it.
     */
    if (
      data &&
      Number.isFinite(
        Number(
          data.last_client_sequence
        )
      )
    ) {
      lastClientSequence =
        Math.max(
          lastClientSequence,
          Number(
            data.last_client_sequence
          )
        );
    }

    return data;
  }

  function enqueueActivity(
    eventType,
    activityState = null,
    options = {}
  ) {
    activityQueue =
      activityQueue
        .then(() =>
          sendActivityEvent(
            eventType,
            activityState,
            options
          )
        )
        .catch(error => {
          console.error(
            `GTA LMS Session: Activity event "${eventType}" failed:`,
            error
          );

          /*
           * If trusted activity recording fails, stop producing
           * potentially creditable evidence until authorization
           * and session state are checked again.
           */
          setActivityEnabled(false);

          void recoverAfterActivityFailure();
        });

    return activityQueue;
  }

  function recordActivity(
    eventType,
    activityState = null,
    options = {}
  ) {
    return enqueueActivity(
      eventType,
      activityState,
      options
    );
  }

  async function recoverAfterActivityFailure() {
    if (
      !learningSessionId ||
      pageIsUnloading
    ) {
      return;
    }

    try {
      await refreshAuthoritativeAuthorization();
    } catch (error) {
      console.error(
        'GTA LMS Session: Authorization recovery failed:',
        error
      );

      setActivityEnabled(false);
    }
  }

  async function handleIdentityVerifiedEvent(
    event
  ) {
    if (
      !learningSessionId ||
      pageIsUnloading
    ) {
      return;
    }

    const detail =
      event?.detail || {};

    /*
     * Ignore events for another learning session.
     */
    if (
      detail.learningSessionId &&
      Number(
        detail.learningSessionId
      ) !==
        Number(
          learningSessionId
        )
    ) {
      return;
    }

    /*
     * CRITICAL SECURITY RULE:
     *
     * We do NOT do this:
     *
     * authorizationState = 'authorized';
     * activityEnabled = true;
     *
     * A CustomEvent is browser-controlled and therefore cannot be
     * trusted as authorization evidence.
     *
     * Instead, disable activity and independently ask the server.
     */
    setActivityEnabled(false);

    try {
      const status =
        await refreshAuthoritativeAuthorization();

      if (
        status.learning_session
          .learning_authorization_state !==
        AUTHORIZED_STATE
      ) {
        console.warn(
          'GTA LMS Session: Identity event received, but server did not authorize learning.'
        );

        return;
      }

      /*
       * This event is evidence that the browser observed a completed
       * identity flow. The backend still decides whether/how it is
       * trusted and whether it affects instructional time.
       */
      await recordActivity(
        'identity_verified',
        'active'
      );

      /*
       * Re-check after recording the event because server-side
       * processing may alter session state.
       */
      await refreshAuthoritativeAuthorization();
    } catch (error) {
      console.error(
        'GTA LMS Session: Authoritative identity confirmation failed:',
        error
      );

      setActivityEnabled(false);
    }
  }

  async function handleVisibilityChange() {
    if (
      !learningSessionId ||
      pageIsUnloading
    ) {
      return;
    }

    if (
      document.visibilityState ===
      'hidden'
    ) {
      if (activityEnabled) {
        await recordActivity(
          'page_hidden',
          'inactive'
        );
      }

      return;
    }

    /*
     * Returning to the page is a security boundary.
     *
     * Re-check authorization before producing new active evidence.
     */
    try {
      await refreshAuthoritativeAuthorization();

      if (
        activityEnabled &&
        document.hasFocus()
      ) {
        await recordActivity(
          'page_visible',
          'active'
        );
      }
    } catch (error) {
      console.error(
        'GTA LMS Session: Visibility authorization check failed:',
        error
      );

      setActivityEnabled(false);
    }
  }

  async function handleWindowFocus() {
    if (
      !learningSessionId ||
      pageIsUnloading
    ) {
      return;
    }

    try {
      await refreshAuthoritativeAuthorization();

      if (
        activityEnabled &&
        document.visibilityState ===
          'visible'
      ) {
        await recordActivity(
          'activity_resumed',
          'active'
        );
      }
    } catch (error) {
      console.error(
        'GTA LMS Session: Focus authorization check failed:',
        error
      );

      setActivityEnabled(false);
    }
  }

  function handleWindowBlur() {
    /*
     * Stop heartbeats immediately.
     *
     * The browser losing focus must never continue producing
     * potentially-active heartbeat evidence.
     */
    stopHeartbeat();
  }

  function installRuntimeListeners() {
    window.addEventListener(
      'gta:identity-verified',
      event => {
        void handleIdentityVerifiedEvent(
          event
        );
      }
    );

    document.addEventListener(
      'visibilitychange',
      () => {
        void handleVisibilityChange();
      }
    );

    window.addEventListener(
      'focus',
      () => {
        void handleWindowFocus();
      }
    );

    window.addEventListener(
      'blur',
      handleWindowBlur
    );

    window.addEventListener(
      'pagehide',
      () => {
        pageIsUnloading = true;

        setActivityEnabled(false);
      }
    );
  }

  function exposeControlledLearningInterface() {
    /*
     * This interface exposes identifiers/state needed by the identity
     * client.
     *
     * It exposes NO method capable of granting authorization or
     * awarding instructional time.
     */
    const learningInterface = {
      getSessionId() {
        return learningSessionId;
      },

      getAuthorizationState() {
        return authorizationState;
      },

      getAuthorizationGeneration() {
        return authorizationGeneration;
      },

      getModuleId() {
        return MODULE_ID;
      },

      recordInteraction(options = {}) {
        if (!activityEnabled) {
          return Promise.resolve(
            null
          );
        }

        return recordActivity(
          'interaction',
          'active',
          options
        );
      },

      async refreshAuthorization() {
        if (!learningSessionId) {
          return null;
        }

        return refreshAuthoritativeAuthorization();
      }
    };

    Object.defineProperty(
      window,
      'gtaLearningSession',
      {
        value:
          Object.freeze(
            learningInterface
          ),

        writable: false,
        configurable: false,
        enumerable: false
      }
    );
  }

  async function initializeSecureLearningSession() {
    if (initializationInProgress) {
      return;
    }

    initializationInProgress = true;

    try {
      client =
        window.gtaSupabase;

      if (!client) {
        throw new Error(
          'supabase_client_unavailable'
        );
      }

      const authenticated =
        await requireAuthenticatedSession();

      if (!authenticated) {
        return;
      }

      try {
        await requireAal2();
      } catch {
        window.location.replace(
          'mfa.html'
        );

        return;
      }

      /*
       * Start or recover the student's secure server-side learning
       * session.
       */
      await startSecureLearningSession();

      /*
       * Expose the session ID immediately so identity-verification.js
       * can recover it even if the ready event timing is missed.
       */
      exposeControlledLearningInterface();

      /*
       * Independently read authoritative authorization state.
       *
       * Initial verification sessions should remain non-creditable
       * until identity verification succeeds.
       */
      try {
        await refreshAuthoritativeAuthorization();
      } catch (error) {
        console.error(
          'GTA LMS Session: Initial authorization status check failed:',
          error
        );

        setActivityEnabled(false);
      }

      /*
       * Notify the identity client.
       *
       * This event communicates session availability only.
       * It is NOT itself an authorization grant.
       */
      dispatchLearningSessionReady();

      /*
       * If already authorized because an existing valid session was
       * recovered, activity can begin only because the authoritative
       * server check above confirmed it.
       */
      if (
        activityEnabled &&
        isPagePotentiallyActive()
      ) {
        await recordActivity(
          'page_visible',
          'active'
        );
      } else if (
        BLOCKED_AUTHORIZATION_STATES.has(
          authorizationState
        )
      ) {
        /*
         * identity_required is non-creditable evidence.
         * Failure to record it must not unlock learning.
         */
        try {
          await recordActivity(
            'identity_required',
            'inactive'
          );
        } catch (error) {
          console.warn(
            'GTA LMS Session: Unable to record identity-required evidence:',
            error
          );
        }
      }

      console.info(
        'GTA LMS Session: Secure learning session initialized.'
      );
    } catch (error) {
      console.error(
        'GTA LMS Session: Secure session initialization failed:',
        error
      );

      setActivityEnabled(false);
    } finally {
      initializationInProgress =
        false;
    }
  }

  installRuntimeListeners();

  void initializeSecureLearningSession();
})();
