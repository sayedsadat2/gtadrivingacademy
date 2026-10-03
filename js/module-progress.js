(() => {
  'use strict';

  /*
   * GTA Driving Academy
   * Secure Digital Learning Session Client
   *
   * SECURITY PRINCIPLES
   * ------------------------------------------------------------
   * - Browser does NOT award training time.
   * - Browser does NOT write active_seconds.
   * - Browser does NOT write module_progress.
   * - Browser does NOT authorize learning.
   * - Browser reports activity evidence only.
   * - Server-side functions remain authoritative.
   */

  const COURSE_ID = 1;
  const HEARTBEAT_INTERVAL_MS = 30_000;
  const INTERACTION_THROTTLE_MS = 15_000;

  const match = window.location.pathname.match(
    /session-(\d+)\.html$/i
  );

  if (!match) {
    console.error(
      'GTA LMS: Could not determine module number.'
    );
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
   * Current verified curriculum mapping:
   *
   * session-01.html -> module ID 1
   * ...
   * session-10.html -> module ID 10
   *
   * Database inspection confirmed course_id = 1 and
   * module IDs 1–10 correspond to module numbers 1–10.
   */
  const MODULE_ID = moduleNumber;

  let client = null;
  let learningSessionId = null;
  let authorizationState = null;
  let authorizationGeneration = 0;

  let clientSequence = 0;

  let initialized = false;
  let activityEnabled = false;

  let heartbeatTimer = null;

  let lastInteractionSentAt = 0;

  /*
   * Promise chain used to serialize evidence events.
   *
   * This prevents two browser events from accidentally using the
   * same client sequence number.
   */
  let eventQueue = Promise.resolve();

  function pageReference() {
    return (
      window.location.pathname.split('/').pop() ||
      window.location.pathname
    );
  }

  function stopHeartbeat() {
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function disableActivityEvidence() {
    activityEnabled = false;
    stopHeartbeat();
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

    const {
      data: aalData,
      error: aalError
    } =
      await client.auth.mfa
        .getAuthenticatorAssuranceLevel();

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
    const { data, error } = await client.rpc(
      'start_digital_learning_session',
      {
        p_course_id: COURSE_ID,
        p_module_id: MODULE_ID
      }
    );

    if (error) {
      console.error(
        'GTA LMS: Unable to start secure learning session:',
        error
      );

      throw error;
    }

    const row = Array.isArray(data)
      ? data[0]
      : data;

    if (!row || !row.id) {
      throw new Error(
        'Learning-session RPC did not return a valid session.'
      );
    }

    learningSessionId = Number(row.id);

    authorizationState =
      row.learning_authorization_state || null;

    authorizationGeneration =
      Number(row.authorization_generation || 0);

    const serverSequence =
      Number(row.last_client_sequence || 0);

    if (
      Number.isFinite(serverSequence) &&
      serverSequence >= 0
    ) {
      clientSequence = serverSequence;
    }

    return row;
  }

  function dispatchLearningSessionReady(sessionRow) {
    /*
     * identity-verification.js listens for this event.
     *
     * Only identifiers and authorization state are exposed.
     * No secrets, TOTP codes, tokens, or authentication credentials
     * are placed into the event.
     */
    window.dispatchEvent(
      new CustomEvent(
        'gta:learning-session-ready',
        {
          detail: {
            learningSessionId:
              learningSessionId,

            courseId:
              COURSE_ID,

            moduleId:
              MODULE_ID,

            moduleNumber:
              moduleNumber,

            authorizationState:
              authorizationState,

            authorizationGeneration:
              authorizationGeneration,

            curriculumVersionId:
              sessionRow.curriculum_version_id || null
          }
        }
      )
    );
  }

  function handleServerEventResult(result) {
    if (!result || typeof result !== 'object') {
      return;
    }

    /*
     * Preserve any authoritative state information returned by the
     * server without allowing the browser to manufacture state.
     */
    if (result.learning_authorization_state) {
      authorizationState =
        result.learning_authorization_state;
    }

    if (
      result.authorization_generation !== undefined &&
      result.authorization_generation !== null
    ) {
      authorizationGeneration =
        Number(result.authorization_generation);
    }

    /*
     * If the server reports that learning is no longer authorized,
     * stop sending evidence until the appropriate verification flow
     * restores authorization.
     */
    const blockedStates = new Set([
      'reauthentication_required',
      'random_identity_check_required',
      'assessment_verification_required',
      'blocked'
    ]);

    if (blockedStates.has(authorizationState)) {
      disableActivityEvidence();

      window.dispatchEvent(
        new CustomEvent(
          'gta:learning-authorization-required',
          {
            detail: {
              learningSessionId,
              authorizationState,
              authorizationGeneration
            }
          }
        )
      );
    }
  }

  async function sendActivityEvent(
    eventType,
    activityState = null
  ) {
    if (!learningSessionId) {
      return null;
    }

    const sequence =
      clientSequence + 1;

    const { data, error } = await client.rpc(
      'record_learning_activity_event',
      {
        p_learning_session_id:
          learningSessionId,

        p_event_type:
          eventType,

        p_client_sequence:
          sequence,

        p_activity_state:
          activityState,

        p_lesson_id:
          null,

        p_page_reference:
          pageReference(),

        p_client_reported_at:
          new Date().toISOString()
      }
    );

    if (error) {
      console.error(
        `GTA LMS: Activity event "${eventType}" failed:`,
        error
      );

      return null;
    }

    /*
     * Sequence advances only after the trusted database function
     * accepts the event.
     */
    clientSequence = sequence;

    handleServerEventResult(data);

    return data;
  }

  function queueActivityEvent(
    eventType,
    activityState = null
  ) {
    if (!learningSessionId) {
      return Promise.resolve(null);
    }

    /*
     * Evidence calls are serialized.
     *
     * A failed event does not break the queue for subsequent events.
     */
    eventQueue = eventQueue
      .catch(() => null)
      .then(() =>
        sendActivityEvent(
          eventType,
          activityState
        )
      );

    return eventQueue;
  }

  function beginHeartbeat() {
    stopHeartbeat();

    heartbeatTimer = window.setInterval(
      () => {
        if (
          !initialized ||
          !activityEnabled ||
          document.visibilityState !== 'visible' ||
          !document.hasFocus()
        ) {
          return;
        }

        void queueActivityEvent(
          'heartbeat',
          'active'
        );
      },
      HEARTBEAT_INTERVAL_MS
    );
  }

  function enableActivityEvidence() {
    activityEnabled = true;
    beginHeartbeat();
  }

  function installActivityListeners() {
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!initialized) {
          return;
        }

        if (
          document.visibilityState ===
          'visible'
        ) {
          if (activityEnabled) {
            void queueActivityEvent(
              'page_visible',
              'active'
            );
          }
        } else {
          /*
           * page_hidden is useful evidence even when subsequent
           * heartbeat evidence is suspended.
           */
          void queueActivityEvent(
            'page_hidden',
            'inactive'
          );
        }
      }
    );

    window.addEventListener(
      'focus',
      () => {
        if (
          !initialized ||
          !activityEnabled
        ) {
          return;
        }

        void queueActivityEvent(
          'activity_resumed',
          'active'
        );
      }
    );

    const interactionHandler = () => {
      if (
        !initialized ||
        !activityEnabled ||
        document.visibilityState !==
          'visible'
      ) {
        return;
      }

      const now = Date.now();

      if (
        now - lastInteractionSentAt <
        INTERACTION_THROTTLE_MS
      ) {
        return;
      }

      lastInteractionSentAt = now;

      void queueActivityEvent(
        'interaction',
        'active'
      );
    };

    document.addEventListener(
      'click',
      interactionHandler,
      { passive: true }
    );

    document.addEventListener(
      'keydown',
      interactionHandler
    );

    document.addEventListener(
      'scroll',
      interactionHandler,
      { passive: true }
    );

    document.addEventListener(
      'pointerdown',
      interactionHandler,
      { passive: true }
    );
  }

  function installIdentityVerifiedListener() {
    window.addEventListener(
      'gta:identity-verified',
      event => {
        const detail =
          event.detail || {};

        if (
          Number(detail.learningSessionId) !==
          learningSessionId
        ) {
          return;
        }

        /*
         * Identity authorization itself was performed by the trusted
         * database function. The browser merely resumes evidence
         * reporting after receiving the successful frontend flow.
         */
        authorizationState =
          'authorized';

        enableActivityEvidence();

        void queueActivityEvent(
          'page_visible',
          'active'
        );
      }
    );
  }

  async function initializeSecureLearning() {
    client = window.gtaSupabase;

    if (!client) {
      console.error(
        'GTA LMS: Supabase client is unavailable.'
      );
      return;
    }

    const aal2Verified =
      await requireAal2();

    if (!aal2Verified) {
      return;
    }

    try {
      const sessionRow =
        await startLearningSession();

      initialized = true;

      installActivityListeners();
      installIdentityVerifiedListener();

      /*
       * IMPORTANT:
       *
       * Dispatch session information only AFTER the identity listener
       * infrastructure is ready.
       */
      dispatchLearningSessionReady(
        sessionRow
      );

      /*
       * session_started is already inserted by the trusted
       * start_digital_learning_session() function.
       *
       * Do not duplicate it from the browser.
       */

      if (
        authorizationState ===
        'authorized'
      ) {
        enableActivityEvidence();

        if (
          document.visibilityState ===
          'visible'
        ) {
          await queueActivityEvent(
            'page_visible',
            'active'
          );
        }
      } else {
        /*
         * A session requiring identity verification exists, but active
         * learning evidence is deliberately suspended until the trusted
         * identity flow authorizes it.
         */
        disableActivityEvidence();
      }

      console.info(
        'GTA LMS: Secure learning session initialized.',
        {
          learningSessionId,
          moduleId: MODULE_ID,
          authorizationState
        }
      );
    } catch (error) {
      disableActivityEvidence();

      console.error(
        'GTA LMS: Secure learning initialization failed:',
        error
      );

      /*
       * There is deliberately NO fallback to browser-side timing.
       */
    }
  }

  /*
   * Do not attempt asynchronous Supabase RPC calls during pagehide.
   * Browsers are permitted to terminate those requests.
   *
   * Server-side inactivity/session controls remain authoritative.
   */
  window.addEventListener(
    'pagehide',
    () => {
      stopHeartbeat();
    }
  );

  /*
   * Small controlled interface for later assessment integration.
   * It exposes no authentication credentials and cannot award time.
   */
  window.gtaLearningSession = {
    getSessionId() {
      return learningSessionId;
    },

    getAuthorizationState() {
      return authorizationState;
    },

    getModuleId() {
      return MODULE_ID;
    },

    recordInteraction() {
      if (
        !initialized ||
        !activityEnabled
      ) {
        return Promise.resolve(null);
      }

      return queueActivityEvent(
        'interaction',
        'active'
      );
    }
  };

  void initializeSecureLearning();
})();
