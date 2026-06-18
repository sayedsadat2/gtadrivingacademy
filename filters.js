document.addEventListener('DOMContentLoaded',()=>{
  const search=document.querySelector('[data-filter-search]'); const category=document.querySelector('[data-filter-category]'); const cards=[...document.querySelectorAll('[data-card]')];
  function filter(){const q=(search?.value||'').toLowerCase();const c=category?.value||'all';cards.forEach(card=>{const text=card.textContent.toLowerCase();const cat=card.dataset.category;card.classList.toggle('hidden',!(text.includes(q)&&(c==='all'||cat===c)));});}
  if(search)search.addEventListener('input',filter); if(category)category.addEventListener('change',filter); filter();
});
