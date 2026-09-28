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

  

  const [{ data: profile }, { data: courses }, { data: modules }] = await Promise.all([
     client.from('profiles').select('first_name, role').eq('id', user.id).maybeSingle(),
      client.from('courses').select('title,description,digital_hours').eq('active', true).limit(1),
    client.from('modules').select('module_number,title,required_minutes,content_url').eq('course_id', 1).eq('active', true).order('module_number')
    ]);
    if (profile && profile.first_name) {
  document.getElementById('studentName').textContent =
    'Welcome back, ' + profile.first_name;
}

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
