document.addEventListener('DOMContentLoaded',()=>{
  const items=[...document.querySelectorAll('.testimonial')];
  const dots=[...document.querySelectorAll('.dot')];
  if(!items.length)return;let i=0;
  function show(n){items.forEach(x=>x.classList.remove('active'));dots.forEach(x=>x.classList.remove('active'));i=(n+items.length)%items.length;items[i].classList.add('active');if(dots[i])dots[i].classList.add('active');}
  dots.forEach((d,idx)=>d.addEventListener('click',()=>show(idx)));
  setInterval(()=>show(i+1),5500);
});
