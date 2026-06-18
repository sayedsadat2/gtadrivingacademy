/* ================================================================
   CONTACT FORM JS — real-time validation + Formspree submission
   Replace FORMSPREE_ID with your actual Formspree form ID
   ================================================================ */
(function(){
  'use strict';
  const FORMSPREE='https://formspree.io/f/YOUR_FORM_ID';
  const form=document.getElementById('contactForm');
  if(!form)return;

  const rules={
    contactName:   {required:true, label:'Full Name'},
    contactEmail:  {required:true, label:'Email', pattern:/^[^\s@]+@[^\s@]+\.[^\s@]+$/},
    contactPhone:  {required:false,label:'Phone',  pattern:/^[\d\s\+\-\(\)]{7,15}$/},
    contactMessage:{required:true, label:'Message',minLen:10},
  };

  Object.keys(rules).forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.addEventListener('blur',()=>vf(id));
    el.addEventListener('input',()=>{if(el.classList.contains('error'))vf(id)});
  });

  function vf(id){
    const r=rules[id];const el=document.getElementById(id);const err=document.getElementById(id+'Error');
    if(!el)return true;
    const val=el.value.trim();let msg='';
    if(r.required&&!val)msg=`${r.label} is required.`;
    else if(val&&r.pattern&&!r.pattern.test(val))msg=`Please enter a valid ${r.label.toLowerCase()}.`;
    else if(val&&r.minLen&&val.length<r.minLen)msg=`${r.label} must be at least ${r.minLen} characters.`;
    el.classList.toggle('error',!!msg);
    if(err)err.textContent=msg;
    return!msg;
  }

  function vAll(){return Object.keys(rules).map(vf).every(Boolean)}

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!vAll())return;
    const btn=form.querySelector('[type="submit"]');
    const orig=btn.innerHTML;
    btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
    const payload={
      name:document.getElementById('contactName')?.value.trim(),
      email:document.getElementById('contactEmail')?.value.trim(),
      phone:document.getElementById('contactPhone')?.value.trim(),
      service:document.getElementById('contactService')?.value,
      date:document.getElementById('contactDate')?.value,
      message:document.getElementById('contactMessage')?.value.trim(),
      sms_optin:document.getElementById('smsOptin')?.checked?'Yes':'No',
    };
    if(FORMSPREE.includes('YOUR_FORM_ID')){
      // Demo fallback — mailto
      const s=encodeURIComponent(`Contact from ${payload.name}`);
      const b=encodeURIComponent(`Name: ${payload.name}\nEmail: ${payload.email}\nPhone: ${payload.phone}\nService: ${payload.service}\nDate: ${payload.date}\n\nMessage:\n${payload.message}\n\nSMS opt-in: ${payload.sms_optin}`);
      window.location.href=`mailto:info@yourdrivingschool.ca?subject=${s}&body=${b}`;
      btn.disabled=false;btn.innerHTML=orig;showOk();return;
    }
    try{
      const res=await fetch(FORMSPREE,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(res.ok){form.reset();showOk()}
      else{const j=await res.json();showErr(j.error||'Something went wrong.')}
    }catch{showErr('Network error. Please call us directly.')}
    finally{btn.disabled=false;btn.innerHTML=orig}
  });

  function showOk(){const m=document.getElementById('formSuccess');if(m){m.style.display='block';m.scrollIntoView({behavior:'smooth'});setTimeout(()=>m.style.display='none',8000)}}
  function showErr(t){const m=document.getElementById('formError');if(m){m.textContent=t;m.style.display='block';setTimeout(()=>m.style.display='none',6000)}}
})();
