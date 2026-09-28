(() => {
  'use strict';

  const client = window.gtaSupabase;

  // Module number for this page.
  // session-01.html -> 1, session-02.html -> 2, etc.
  const match = window.location.pathname.match(/session-(\d+)\.html$/i);
  if (!match || !client) return;

  const moduleNumber = parseInt(match[1], 10);

  async function startModuleProgress() {
    // Confirm the student is signed in.
    const { data: userData, error: userError } =
      await client.auth.getUser();

    const user = userData?.user;

    if (userError || !user) {
      window.location.replace('login.html');
      return;
    }

    // Find the module in Supabase.
    const { data: module, error: moduleError } = await client
      .from('modules')
      .select('id')
      .eq('course_id', 1)
      .eq('module_number', moduleNumber)
      .single();

    if (moduleError || !module) {
      console.error('Module lookup failed:', moduleError);
      return;
    }

    // Check whether progress already exists.
    const { data: existingProgress, error: progressError } = await client
      .from('module_progress')
      .select('id,status,started_at')
      .eq('student_id', user.id)
      .eq('module_id', module.id)
      .maybeSingle();

    if (progressError) {
      console.error('Progress lookup failed:', progressError);
      return;
    }

    const now = new Date().toISOString();

    if (!existingProgress) {
      // First time the student opens this module.
      const { error } = await client
        .from('module_progress')
        .insert({
          student_id: user.id,
          module_id: module.id,
          status: 'in_progress',
          started_at: now,
          last_activity_at: now
        });

      if (error) {
        console.error('Could not create module progress:', error);
      }

      return;
    }

    // Do not overwrite a completed module.
    if (existingProgress.status !== 'completed') {
      const { error } = await client
        .from('module_progress')
        .update({
          status: 'in_progress',
          last_activity_at: now
        })
        .eq('id', existingProgress.id);

      if (error) {
        console.error('Could not update module progress:', error);
      }
    }
  }

  startModuleProgress();
})();
