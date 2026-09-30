(() => {
  'use strict';

  const match = window.location.pathname.match(/session-(\d+)\.html$/i);

  if (!match) {
    console.error('GTA LMS: Could not determine module number.');
    return;
  }

  const moduleNumber = parseInt(match[1], 10);

  let client;
  let progressId = null;
  let activeSeconds = 0;
  let unsavedSeconds = 0;
  let lastTick = Date.now();
  let saveInProgress = false;

  // Save accumulated active time to Supabase.
  async function saveProgress() {
    if (!client || !progressId || unsavedSeconds <= 0 || saveInProgress) {
      return;
    }

    saveInProgress = true;

    const secondsToSave = unsavedSeconds;
    unsavedSeconds = 0;

    const newTotal = activeSeconds;

    const { error } = await client
      .from('module_progress')
      .update({
        active_seconds: newTotal,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', progressId);

    if (error) {
      console.error('GTA LMS: Could not save active time:', error);
      unsavedSeconds += secondsToSave;
    } else {
      console.log(
        `GTA LMS: Module ${moduleNumber} active time saved: ${newTotal} seconds.`
      );
    }

    saveInProgress = false;
  }

  // Count time only while the page is visible.
  function updateActiveTime() {
    const now = Date.now();
    const elapsed = Math.floor((now - lastTick) / 1000);
    lastTick = now;

    if (!document.hidden && elapsed > 0 && elapsed <= 5) {
      activeSeconds += elapsed;
      unsavedSeconds += elapsed;
    }
  }

  function startTimer() {
    lastTick = Date.now();

    setInterval(() => {
      updateActiveTime();

      // Save roughly every 15 active seconds.
      if (unsavedSeconds >= 15) {
        saveProgress();
      }
    }, 1000);

    document.addEventListener('visibilitychange', () => {
      updateActiveTime();

      if (document.hidden) {
        saveProgress();
      }

      lastTick = Date.now();
    });

    window.addEventListener('pagehide', () => {
      updateActiveTime();
      saveProgress();
    });
  }

  async function startModuleProgress() {
    client = window.gtaSupabase;

    if (!client) {
      console.error('GTA LMS: Supabase client is not available.');
      return;
    }

    const { data: userData, error: userError } =
      await client.auth.getUser();

    const user = userData?.user;

    if (userError || !user) {
      console.error('GTA LMS: Student is not authenticated.');
      window.location.replace('login.html');
      return;
    }

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

    const { data: existingProgress, error: progressError } =
      await client
        .from('module_progress')
        .select('id,status,started_at,active_seconds')
        .eq('student_id', user.id)
        .eq('module_id', module.id)
        .maybeSingle();

    if (progressError) {
      console.error('GTA LMS: Progress lookup failed:', progressError);
      return;
    }

    const now = new Date().toISOString();

    if (!existingProgress) {
      const { data: newProgress, error: insertError } = await client
        .from('module_progress')
        .insert({
          student_id: user.id,
          module_id: module.id,
          status: 'in_progress',
          active_seconds: 0,
          started_at: now,
          last_activity_at: now
        })
        .select('id,active_seconds')
        .single();

      if (insertError || !newProgress) {
        console.error(
          'GTA LMS: Could not create module progress:',
          insertError
        );
        return;
      }

      progressId = newProgress.id;
      activeSeconds = newProgress.active_seconds || 0;

    } else {
      progressId = existingProgress.id;
      activeSeconds = existingProgress.active_seconds || 0;

      if (existingProgress.status !== 'completed') {
        const { error: updateError } = await client
          .from('module_progress')
          .update({
            status: 'in_progress',
            last_activity_at: now
          })
          .eq('id', progressId);

        if (updateError) {
          console.error(
            'GTA LMS: Could not update module progress:',
            updateError
          );
          return;
        }
      }
    }

    console.log(
      `GTA LMS: Module ${moduleNumber} loaded with ${activeSeconds} active seconds.`
    );

    startTimer();
  }

  if (document.readyState === 'complete') {
    startModuleProgress();
  } else {
    window.addEventListener('load', startModuleProgress);
  }
})();
