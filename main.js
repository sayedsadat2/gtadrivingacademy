// Dark mode
const darkBtn = document.getElementById('darkModeToggle');
if (darkBtn) {
  if (localStorage.getItem('dark') === '1') document.body.classList.add('dark');
  darkBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('dark', document.body.classList.contains('dark') ? '1' : '0');
    darkBtn.querySelector('i').className = document.body.classList.contains('dark') ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  });
}

// Newsletter
document.querySelectorAll('#newsletterForm').forEach(f => {
  f.addEventListener('submit', e => { e.preventDefault(); alert('Thanks for subscribing!'); f.reset(); });
});

// Mobile toggle close on link click
document.querySelectorAll('.nav-menu a').forEach(a => {
  a.addEventListener('click', () => document.querySelector('.nav-menu').classList.remove('open'));
});
