(() => {
  'use strict';

  const form = document.getElementById('forgotPasswordForm');
  const emailInput = document.getElementById('email');
  const resetButton = document.getElementById('resetButton');
  const message = document.getElementById('resetMessage');

  if (!form || !emailInput || !resetButton || !message) {
    console.error('GTA LMS: Password recovery form elements are missing.');
    return;
  }

  let requestInProgress = false;

  function showMessage(text) {
    message.textContent = text;
  }

  function setLoading(isLoading) {
    resetButton.disabled = isLoading;
    resetButton.textContent = isLoading
      ? 'Sending...'
      : 'Send reset link';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (requestInProgress) {
      return;
    }

    const client = window.gtaSupabase;
    const email = emailInput.value.trim().toLowerCase();

    if (!client) {
      console.error('GTA LMS: Supabase client is unavailable.');

      showMessage(
        'Password recovery is temporarily unavailable. Please contact GTA Driving Academy.'
      );
      return;
    }

    if (!email) {
      showMessage('Please enter your email address.');
      emailInput.focus();
      return;
    }

    requestInProgress = true;
    setLoading(true);
    showMessage('');

    try {
      const redirectTo =
        `${window.location.origin}/reset-password.html`;

      const { error } = await client.auth.resetPasswordForEmail(
        email,
        {
          redirectTo
        }
      );

      if (error) {
        console.error(
          'GTA LMS: Password reset request failed:',
          error
        );

        showMessage(
          'We could not process the request right now. Please try again later.'
        );

        return;
      }

      // Privacy-safe response:
      // Do not reveal whether the email belongs to a student account.
      showMessage(
        'If an account exists for that email address, a password reset link will be sent. Please check your inbox and spam folder.'
      );

      emailInput.value = '';

    } catch (error) {
      console.error(
        'GTA LMS: Unexpected password recovery error:',
        error
      );

      showMessage(
        'We could not process the request right now. Please try again later.'
      );

    } finally {
      requestInProgress = false;
      setLoading(false);
    }
  });
})();
