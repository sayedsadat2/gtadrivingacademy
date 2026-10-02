(() => {
  'use strict';

  const form = document.getElementById('resetPasswordForm');
  const passwordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const updateButton = document.getElementById('updatePasswordButton');
  const message = document.getElementById('resetPasswordMessage');

  if (
    !form ||
    !passwordInput ||
    !confirmPasswordInput ||
    !updateButton ||
    !message
  ) {
    console.error('GTA LMS: Reset password page elements are missing.');
    return;
  }

  const client = window.gtaSupabase;

  if (!client) {
    console.error('GTA LMS: Supabase client is unavailable.');
    showMessage(
      'Password recovery is temporarily unavailable. Please try again later.',
      'error'
    );
    disableForm();
    return;
  }

  let requestInProgress = false;
  let recoveryAuthorized = false;

  function showMessage(text, type = 'info') {
    message.textContent = text;
    message.dataset.type = type;

    if (type === 'error') {
      message.setAttribute('role', 'alert');
    } else {
      message.setAttribute('role', 'status');
    }
  }

  function clearMessage() {
    message.textContent = '';
    message.removeAttribute('data-type');
  }

  function setLoading(isLoading) {
    updateButton.disabled = isLoading;
    passwordInput.disabled = isLoading;
    confirmPasswordInput.disabled = isLoading;

    updateButton.textContent = isLoading
      ? 'Updating password...'
      : 'Update password';

    updateButton.setAttribute(
      'aria-busy',
      isLoading ? 'true' : 'false'
    );
  }

  function disableForm() {
    passwordInput.disabled = true;
    confirmPasswordInput.disabled = true;
    updateButton.disabled = true;
  }

  function enableForm() {
    passwordInput.disabled = false;
    confirmPasswordInput.disabled = false;
    updateButton.disabled = false;
  }

  function validatePassword(password) {
    if (password.length < 12) {
      return 'Password must contain at least 12 characters.';
    }

    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter.';
    }

    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter.';
    }

    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number.';
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Password must contain at least one special character.';
    }

    return null;
  }

  async function verifyRecoverySession() {
    disableForm();

    try {
      /*
       * Supabase recovery links establish an authenticated recovery
       * session. We verify that a valid authenticated session exists
       * before enabling password modification.
       */
      const {
        data: { session },
        error
      } = await client.auth.getSession();

      if (error) {
        console.error(
          'GTA LMS: Could not verify password recovery session:',
          error
        );

        showMessage(
          'We could not verify this password reset request. Please request a new reset link.',
          'error'
        );

        return;
      }

      if (session && session.user) {
        recoveryAuthorized = true;
        enableForm();
        clearMessage();
        passwordInput.focus();
        return;
      }

      /*
       * Supabase may still be processing the recovery URL.
       * The auth state listener below provides a second opportunity
       * to recognize PASSWORD_RECOVERY.
       */
      showMessage(
        'Verifying your password reset link...',
        'info'
      );

    } catch (error) {
      console.error(
        'GTA LMS: Unexpected recovery verification error:',
        error
      );

      showMessage(
        'We could not verify this password reset request. Please request a new reset link.',
        'error'
      );
    }
  }

  const {
    data: authListener
  } = client.auth.onAuthStateChange((event, session) => {

    if (
      event === 'PASSWORD_RECOVERY' &&
      session &&
      session.user
    ) {
      recoveryAuthorized = true;
      enableForm();
      clearMessage();
      passwordInput.focus();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (requestInProgress) {
      return;
    }

    clearMessage();

    if (!recoveryAuthorized) {
      showMessage(
        'This password reset session is not valid or has expired. Please request a new reset link.',
        'error'
      );
      return;
    }

    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    const validationError = validatePassword(password);

    if (validationError) {
      showMessage(validationError, 'error');
      passwordInput.focus();
      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        'The passwords do not match.',
        'error'
      );

      confirmPasswordInput.focus();
      return;
    }

    requestInProgress = true;
    setLoading(true);

    try {
      const {
        data,
        error
      } = await client.auth.updateUser({
        password
      });

      if (error) {
        console.error(
          'GTA LMS: Password update failed:',
          error
        );

        showMessage(
          'We could not update your password. Your reset link may have expired. Please request a new password reset link.',
          'error'
        );

        return;
      }

      if (!data || !data.user) {
        throw new Error(
          'Supabase did not return the updated user.'
        );
      }

      passwordInput.value = '';
      confirmPasswordInput.value = '';

      showMessage(
        'Password updated successfully. You will now be returned to the student login.',
        'success'
      );

      /*
       * End the recovery session so the reset browser session
       * cannot continue accessing the student account.
       */
      const { error: signOutError } =
        await client.auth.signOut();

      if (signOutError) {
        console.error(
          'GTA LMS: Recovery-session sign-out failed:',
          signOutError
        );
      }

      recoveryAuthorized = false;

      window.setTimeout(() => {
        window.location.replace('login.html');
      }, 1800);

    } catch (error) {
      console.error(
        'GTA LMS: Unexpected password update error:',
        error
      );

      showMessage(
        'We could not update your password. Please request a new password reset link and try again.',
        'error'
      );

    } finally {
      requestInProgress = false;

      if (recoveryAuthorized) {
        setLoading(false);
      } else {
        disableForm();
      }
    }
  });

  window.addEventListener('pagehide', () => {
    if (
      authListener &&
      authListener.subscription
    ) {
      authListener.subscription.unsubscribe();
    }
  });

  verifyRecoverySession();
})();
