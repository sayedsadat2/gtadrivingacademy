/* ================================================================
   BOOKING WIZARD JS — 5-step form with price calculator
   ================================================================ */
(function(){
  'use strict';

  const PRICES={
    'g1-coaching':  {label:'G1 Test Coaching (1 hr)',price:45,note:'One-on-one coaching session'},
    'g2-single':    {label:'G2 Single Lesson (1 hr)',price:85,note:'In-car with certified instructor'},
    'g2-5pack':     {label:'G2 — 5-Lesson Package',  price:400,note:'Save $25 vs single lessons'},
    'g2-10pack':    {label:'G2 — 10-Lesson Package',  price:750,note:'Most popular — Save $100'},
    'g2-20pack':    {label:'G2 — 20-Lesson Package',  price:1400,note:'Best value — Save $300'},
    'full-g':       {label:'Full G Highway Training',  price:185,note:'400-series highway driving'},
    'refresher':    {label:'Refresher Lesson (1 hr)',  price:85,note:'Adults & seniors program'},
    'winter-clinic':{label:'Winter Driving Clinic',    price:120,note:'Seasonal — group session'},
  };

  let data={service:'',instructor:'',date:'',time:'',name:'',email:'',phone:'',licence:'',address:'',goals:''};
  let step=1;
  const TOTAL=5;

  function showStep(n){
    document.querySelectorAll('.booking-step').forEach((el,i)=>el.classList.toggle('active',i+1===n));
    document.querySelectorAll('.progress-step').forEach((el,i)=>{
      const circle=el.querySelector('.step-circle');
      const line=el.nextElementSibling;
      el.classList.toggle('active',i+1===n);
      if(circle){
        circle.classList.toggle('done',i+1<n);
        circle.classList.toggle('active',i+1===n);
        circle.innerHTML=i+1<n?'<i class="fa-solid fa-check"></i>':(i+1);
      }
      if(line&&line.classList.contains('step-line'))line.classList.toggle('done',i+1<n);
    });
    const prevBtn=document.getElementById('bookingPrev');
    const nextBtn=document.getElementById('bookingNext');
    const subBtn=document.getElementById('bookingSubmit');
    if(prevBtn)prevBtn.style.display=n===1?'none':'inline-flex';
    if(nextBtn)nextBtn.style.display=n===TOTAL?'none':'inline-flex';
    if(subBtn)subBtn.style.display=n===TOTAL?'inline-flex':'none';
    if(n===TOTAL)fillReview();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function validate(n){
    let ok=true;
    document.querySelectorAll('.form-error').forEach(e=>e.textContent='');
    function err(id,msg){const el=document.getElementById(id+'Error');if(el){el.textContent=msg;ok=false}}
    if(n===1&&!data.service)err('service','Please select a service.');
    if(n===2&&!data.instructor)err('instructor','Please select an instructor.');
    if(n===3){if(!data.date)err('date','Please select a date.');if(!data.time)err('time','Please select a time slot.')}
    if(n===4){
      if(!data.name)err('bName','Full name is required.');
      if(!data.email)err('bEmail','Email is required.');
      else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))err('bEmail','Enter a valid email address.');
      if(!data.phone)err('bPhone','Phone number is required.');
    }
    return ok;
  }

  function fillReview(){
    const svc=PRICES[data.service];
    const set=(id,val)=>{const el=document.getElementById('review'+id);if(el)el.textContent=val};
    set('Service',svc?svc.label:'—');
    set('Price',svc?(svc.price===0?'Free':'$'+svc.price.toLocaleString()):'—');
    set('Instructor',data.instructor||'—');
    set('DateTime',(data.date||'—')+' at '+(data.time||'—'));
    set('Name',data.name||'—');
    set('Email',data.email||'—');
    set('Phone',data.phone||'—');
    set('Licence',data.licence||'Not provided');
    set('Goals',data.goals||'Not specified');
  }

  /* ---- Step 1: Service cards ---- */
  document.querySelectorAll('.service-select-card').forEach(card=>{
    card.addEventListener('click',()=>{
      document.querySelectorAll('.service-select-card').forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
      data.service=card.dataset.service;
      const svc=PRICES[data.service];
      const disp=document.getElementById('servicePriceDisplay');
      if(disp&&svc){
        disp.innerHTML=`<strong>${svc.label}</strong><span class="text-orange" style="font-size:1.1rem;font-weight:700;margin-left:10px">$${svc.price}</span><em style="color:var(--text-muted);font-size:.83rem;margin-left:8px">${svc.note}</em>`;
        disp.style.display='flex';
      }
    });
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click()}});
  });

  /* ---- Step 2: Instructor cards ---- */
  document.querySelectorAll('.instructor-select-card').forEach(card=>{
    card.addEventListener('click',()=>{
      document.querySelectorAll('.instructor-select-card').forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
      data.instructor=card.dataset.instructor;
    });
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click()}});
  });

  /* ---- Step 3: Date + time ---- */
  const dateIn=document.getElementById('bookingDate');
  if(dateIn){
    dateIn.min=new Date().toISOString().split('T')[0];
    dateIn.addEventListener('change',()=>data.date=dateIn.value);
  }
  document.querySelectorAll('.time-slot').forEach(slot=>{
    if(!slot.disabled)slot.addEventListener('click',()=>{
      document.querySelectorAll('.time-slot').forEach(s=>s.classList.remove('selected'));
      slot.classList.add('selected');
      data.time=slot.textContent.trim();
    });
  });

  /* ---- Step 4: Student info ---- */
  [['bName','name'],['bEmail','email'],['bPhone','phone'],['bLicence','licence'],['bAddress','address'],['bGoals','goals']].forEach(([id,key])=>{
    const el=document.getElementById(id);
    if(el)el.addEventListener('input',()=>data[key]=el.value);
  });

  /* ---- Navigation ---- */
  const prevBtn=document.getElementById('bookingPrev');
  const nextBtn=document.getElementById('bookingNext');
  const subBtn=document.getElementById('bookingSubmit');
  if(nextBtn)nextBtn.addEventListener('click',()=>{if(validate(step)){step++;showStep(step)}});
  if(prevBtn)prevBtn.addEventListener('click',()=>{step--;showStep(step)});
  if(subBtn){
    subBtn.addEventListener('click',()=>{
      const terms=document.getElementById('confirmTerms');
      if(terms&&!terms.checked){alert('Please agree to the terms to proceed.');return}
      const svc=PRICES[data.service];
      const subj=encodeURIComponent(`New Booking: ${data.name} — ${svc?svc.label:''}`);
      const body=encodeURIComponent(
        `NEW DRIVING LESSON BOOKING\n\nService: ${svc?svc.label:''}\nPrice: ${svc?'$'+svc.price:''}\n`+
        `Instructor: ${data.instructor}\nDate: ${data.date}\nTime: ${data.time}\n\n`+
        `Student: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone}\n`+
        `Licence: ${data.licence}\nAddress: ${data.address}\nGoals: ${data.goals}`
      );
      window.location.href=`mailto:info@yourdrivingschool.ca?subject=${subj}&body=${body}`;
      setTimeout(()=>{window.location.href='thank-you.html'},800);
    });
  }

  /* ---- Pricing calculator (pricing.html) ---- */
  const pkgSel=document.getElementById('pkgCalculator');
  if(pkgSel){
    pkgSel.addEventListener('change',()=>{
      const svc=PRICES[pkgSel.value];
      const res=document.getElementById('calcResult');
      if(res&&svc){
        res.innerHTML=`<div style="background:var(--accent2);border-radius:var(--radius-md);padding:22px;margin-top:14px">
          <p style="margin:0;font-size:.85rem;color:var(--text-muted)">Selected Package</p>
          <p style="margin:4px 0 10px;font-family:var(--font-head);font-weight:700;font-size:1.05rem">${svc.label}</p>
          <p style="font-size:2rem;font-weight:800;font-family:var(--font-head);color:var(--secondary);margin:0">$${svc.price.toLocaleString()}</p>
          <p style="font-size:.83rem;color:var(--text-light);margin:7px 0 0">${svc.note}</p>
        </div>`;
      }
    });
  }

  /* ---- Init ---- */
  if(document.querySelector('.booking-step'))showStep(1);

})();
