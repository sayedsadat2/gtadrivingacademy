/* ================================================================
   YOUR DRIVING SCHOOL — Main JS
   Nav | Dark Mode | Scroll animations | Carousel | Counters
   Accordion | Blog/Video filter | Newsletter | Search
   ================================================================ */
(function(){
  'use strict';

  /* ---- Dark Mode ---- */
  const body=document.body;
  const dmBtn=document.getElementById('darkModeToggle');
  function applyDark(on){body.classList.toggle('dark-mode',on);if(dmBtn)dmBtn.title=on?'Switch to Light Mode':'Switch to Dark Mode'}
  applyDark(localStorage.getItem('darkMode')==='true');
  if(dmBtn)dmBtn.addEventListener('click',()=>{const d=!body.classList.contains('dark-mode');applyDark(d);localStorage.setItem('darkMode',d)});

  /* ---- Navbar scroll shadow ---- */
  const navbar=document.querySelector('.navbar');
  if(navbar)window.addEventListener('scroll',()=>navbar.classList.toggle('scrolled',scrollY>20),{passive:true});

  /* ---- Mobile hamburger ---- */
  const ham=document.querySelector('.hamburger');
  const menu=document.querySelector('.nav-menu');
  function closeMenu(){
    if(!menu)return;
    menu.classList.remove('open');
    if(ham){ham.setAttribute('aria-expanded','false');ham.querySelectorAll('span').forEach(s=>{s.style.transform='';s.style.opacity=''})}
  }
  if(ham&&menu){
    ham.addEventListener('click',()=>{
      const open=menu.classList.toggle('open');
      ham.setAttribute('aria-expanded',open);
      const sp=ham.querySelectorAll('span');
      if(open){sp[0].style.transform='rotate(45deg) translate(5px,5px)';sp[1].style.opacity='0';sp[2].style.transform='rotate(-45deg) translate(5px,-5px)'}
      else closeMenu();
    });
    document.addEventListener('click',e=>{if(!ham.contains(e.target)&&!menu.contains(e.target))closeMenu()});
    menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  }

  /* ---- Active nav link ---- */
  const cur=(location.pathname.split('/').pop()||'index.html');
  document.querySelectorAll('.nav-menu a').forEach(a=>{
    const h=a.getAttribute('href');
    if(h===cur||(cur===''&&h==='index.html')||(cur==='index.html'&&h==='index.html'))a.classList.add('active');
  });

  /* ---- Scroll fade-in ---- */
  const fades=document.querySelectorAll('.fade-in');
  if(fades.length){
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{
      if(e.isIntersecting){
        const idx=Array.from(e.target.parentElement.querySelectorAll('.fade-in')).indexOf(e.target);
        e.target.style.transitionDelay=(idx*.08)+'s';
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    }),{threshold:.1,rootMargin:'0px 0px -30px 0px'});
    fades.forEach(el=>io.observe(el));
  }

  /* ---- Testimonial Carousel ---- */
  const track=document.querySelector('.testimonial-track');
  const dots=document.querySelectorAll('.carousel-dot');
  const prev=document.querySelector('.carousel-arrow.prev');
  const next=document.querySelector('.carousel-arrow.next');
  if(track){
    let cur=0,timer;
    const total=track.children.length;
    function goTo(i){
      cur=(i+total)%total;
      track.style.transform=`translateX(-${cur*100}%)`;
      dots.forEach((d,j)=>d.classList.toggle('active',j===cur));
    }
    function start(){timer=setInterval(()=>goTo(cur+1),5000)}
    function stop(){clearInterval(timer)}
    if(prev)prev.addEventListener('click',()=>{stop();goTo(cur-1);start()});
    if(next)next.addEventListener('click',()=>{stop();goTo(cur+1);start()});
    dots.forEach((d,i)=>d.addEventListener('click',()=>{stop();goTo(i);start()}));
    let sx=0;
    track.addEventListener('touchstart',e=>sx=e.touches[0].clientX,{passive:true});
    track.addEventListener('touchend',e=>{const d=sx-e.changedTouches[0].clientX;if(Math.abs(d)>50){stop();goTo(cur+(d>0?1:-1));start()}});
    goTo(0);start();
  }

  /* ---- Animated counters ---- */
  document.querySelectorAll('[data-counter]').forEach(el=>{
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{
      if(e.isIntersecting){
        const target=parseInt(el.dataset.target||el.textContent.replace(/\D/g,''),10);
        const suffix=el.dataset.suffix||'';
        const step=target/(1800/16);
        let val=0;
        function tick(){val=Math.min(val+step,target);el.textContent=Math.round(val).toLocaleString()+suffix;if(val<target)requestAnimationFrame(tick)}
        requestAnimationFrame(tick);
        io.unobserve(el);
      }
    }),{threshold:.5});
    io.observe(el);
  });

  /* ---- Accordion ---- */
  document.querySelectorAll('.accordion-header').forEach(h=>{
    h.addEventListener('click',()=>{
      const open=h.classList.contains('open');
      document.querySelectorAll('.accordion-header').forEach(x=>{x.classList.remove('open');x.nextElementSibling.classList.remove('open')});
      if(!open){h.classList.add('open');h.nextElementSibling.classList.add('open')}
    });
  });

  /* ---- Newsletter ---- */
  const nl=document.getElementById('newsletterForm');
  if(nl){
    nl.addEventListener('submit',e=>{
      e.preventDefault();
      const em=nl.querySelector('[type="email"]').value.trim();
      if(!em||!em.includes('@')){alert('Please enter a valid email.');return}
      let subs=JSON.parse(localStorage.getItem('ds_subs')||'[]');
      if(!subs.includes(em)){subs.push(em);localStorage.setItem('ds_subs',JSON.stringify(subs))}
      nl.innerHTML='<p style="color:#22c55e;font-weight:600;text-align:center"><i class="fa-solid fa-circle-check"></i> Subscribed! Welcome aboard.</p>';
    });
  }

  /* ---- Filter Tabs (blog + video) ---- */
  document.querySelectorAll('.filter-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      const parent=tab.closest('section')||document;
      parent.querySelectorAll('.filter-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const cat=tab.dataset.category||'all';
      document.querySelectorAll('.blog-card,.video-card').forEach(item=>{
        const show=cat==='all'||item.dataset.category===cat;
        item.style.display=show?'':'none';
      });
    });
  });

  /* ---- Sidebar category buttons (blog page) ---- */
  document.querySelectorAll('.sidebar-cat').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const cat=btn.dataset.category;
      const tab=document.querySelector(`.filter-tab[data-category="${cat}"]`);
      if(tab)tab.click();
      document.querySelectorAll('.sidebar-cat').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ---- Blog search ---- */
  const bs=document.getElementById('blogSearch');
  if(bs){
    bs.addEventListener('input',()=>{
      const q=bs.value.toLowerCase().trim();
      document.querySelectorAll('.blog-card').forEach(c=>{
        const t=(c.querySelector('h3')?.textContent||'').toLowerCase();
        const p=(c.querySelector('p')?.textContent||'').toLowerCase();
        c.style.display=(!q||t.includes(q)||p.includes(q))?'':'none';
      });
    });
  }

  /* ---- Smooth scroll anchor links ---- */
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const t=document.querySelector(a.getAttribute('href'));
      if(t){e.preventDefault();window.scrollTo({top:t.getBoundingClientRect().top+scrollY-82,behavior:'smooth'})}
    });
  });

  /* ---- Footer year ---- */
  const yr=document.getElementById('year');
  if(yr)yr.textContent=new Date().getFullYear();

})();
