(() => {
  'use strict';

  const client = window.gtaSupabase;
  const loading = document.getElementById('dashboardLoading');
  const content = document.getElementById('dashboardContent');

  async function loadDashboard() {
    const { data: userData, error: userError } = await client.auth.getUser();
    const user = userData && userData.user;

    if (userError || !user) {
      window.location.replace('login.html');
      return;
    }

    document.getElementById('studentEmail').textContent = user.email || '';

    const [{ data: profile }, { data: courses }] = await Promise.all([
      client.from('profiles').select('role').eq('id', user.id).maybeSingle(),
      client.from('courses').select('title,description,digital_hours').eq('active', true).limit(1)
    ]);

    if (profile && profile.role) {
      document.getElementById('studentRole').textContent =
        profile.role.charAt(0).toUpperCase() + profile.role.slice(1);
    }

    if (courses && courses.length) {
      const course = courses[0];
      document.getElementById('courseTitle').textContent = course.title;
      document.getElementById('courseDescription').textContent = course.description || '';
      document.getElementById('digitalHours').textContent = (course.digital_hours || 20) + ' hours';
    }

    loading.hidden = true;
    content.hidden = false;
  }

  document.getElementById('logoutButton').addEventListener('click', async () => {
    await client.auth.signOut();
    window.location.replace('login.html');
  });

  loadDashboard();
})();
