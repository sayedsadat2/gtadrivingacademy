(() => {
  'use strict';

  // Detect module number from:
  // session-01.html, session-02.html, etc.
  const match = window.location.pathname.match(/session-(\d+)\.html$/i);

  if (!match) {
    console.error('GTA LMS: Could not determine module number.');
    return;
  }

  const moduleNumber = parseInt(match[1], 10);

  async function startModuleProgress() {
    const client = window.gtaSupabase;

    // Make sure Supabase was initialized.
    if (!client) {
      console.error('GTA LMS: Supabase client is not available.');
      return;
    }

    // Confirm student authentication.
    const { data: userData, error: userError } =
      await client.auth.getUser();

    const user = userData?.user;

    if (userError || !user) {
      console.error('GTA LMS: Student is not authenticated.');
      window.location.replace('login.html');
      return;
    }

    // Find this module in the database.
    const { data: module, error: moduleError } = await client
      .from('modules')
      .select('id')
      .eq('course_id', 1)
      .eq('module_number', moduleNumber)
      .single();

    if (moduleError || !module) {
      console.error('GTA LMS: Module lookup failed:', moduleError);
      return;
    }

    // Check existing progress.
    const { data: existingProgress, error: progressError } =
      await client
        .from('module_progress')
        .select('id,status,started_at')
        .eq('student_id', user.id)
        .eq('module_id', module.id)
        .maybeSingle();

    if (progressError) {
      console.error('GTA LMS: Progress lookup failed:', progressError);
      return;
    }

    const now = new Date().toISOString();

    // First visit to this module.
    if (!existingProgress) {
      const { error: insertError } = await client
        .from('module_progress')
        .insert({
          student_id: user.id,
          module_id: module.id,
          status: 'in_progress',
          started_at: now,
          last_activity_at: now
        });

      if (insertError) {
        console.error(
          'GTA LMS: Could not create module progress:',
          insertError
        );
        return;
      }

      console.log(
        `GTA LMS: Module ${moduleNumber} progress started successfully.`
      );

      return;
    }

    // Update an existing module unless already completed.
    if (existingProgress.status !== 'completed') {
      const { error: updateError } = await client
        .from('module_progress')
        .update({
          status: 'in_progress',
          last_activity_at: now
        })
        .eq('id', existingProgress.id);

      if (updateError) {
        console.error(
          'GTA LMS: Could not update module progress:',
          updateError
        );
        return;
      }
    }

    console.log(
      `GTA LMS: Module ${moduleNumber} progress loaded successfully.`
    );
  }

  // Wait until the page and its scripts have completely loaded.
  window.addEventListener('load', () => {
    startModuleProgress();
  });
})();
