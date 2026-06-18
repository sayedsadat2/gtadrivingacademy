document.addEventListener('DOMContentLoaded',()=>{
  const prices={single:85,five:400,ten:750,twenty:1400,bde:0};
  const service=document.querySelector('#bookingService');
  const priceBox=document.querySelector('#dynamicPrice');
  function updatePrice(){if(!service||!priceBox)return;const v=service.value;let text=v==='bde'?'Price to be confirmed':`$${prices[v]||0}`;priceBox.textContent=text;}
  if(service){service.addEventListener('change',updatePrice);updatePrice();}
  const steps=[...document.querySelectorAll('.step')]; const bars=[...document.querySelectorAll('.progress span')]; let current=0;
  function show(n){current=Math.max(0,Math.min(n,steps.length-1));steps.forEach((s,i)=>s.classList.toggle('active',i===current));bars.forEach((b,i)=>b.classList.toggle('active',i<=current));}
  document.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>show(current+1)));
  document.querySelectorAll('[data-prev]').forEach(b=>b.addEventListener('click',()=>show(current-1)));
  show(0);
  const calc=document.querySelector('#pricingCalculator');
  if(calc){calc.addEventListener('change',()=>{const selected=calc.value;const total=document.querySelector('#calcTotal');const savings=document.querySelector('#calcSavings');const base={single:85,five:425,ten:850,twenty:1700};const price=prices[selected];total.textContent=selected==='bde'?'Contact us':`$${price}`;savings.textContent=base[selected]&&base[selected]>price?`You save $${base[selected]-price} compared with single lessons.`:'Best for trying one lesson first.';});calc.dispatchEvent(new Event('change'));}
});
