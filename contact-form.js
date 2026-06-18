document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('form[data-validate="true"]').forEach(form=>{
    form.addEventListener('submit',e=>{
      const required=[...form.querySelectorAll('[required]')];
      let ok=true;required.forEach(field=>{field.style.borderColor='';if(!field.value.trim()){field.style.borderColor='#e85d04';ok=false;}});
      const email=form.querySelector('input[type="email"]');
      if(email&&email.value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)){email.style.borderColor='#e85d04';ok=false;}
      if(!ok){e.preventDefault();alert('Please complete all required fields correctly.');}
    });
  });
});
