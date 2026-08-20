/* GTA Driving Academy — Site Chat Widget
   Self-contained, no external API. Injects its own styles and markup. */
(function () {
  'use strict';

  var NAVY = '#0B1F3A';
  var NAVY_DEEP = '#081729';
  var ORANGE = '#F07E1D';
  var PAPER = '#FCFBF8';

  var css = `
  #gda-chat-bubble {
    position: fixed; bottom: 22px; right: 22px; width: 64px; height: 64px;
    border-radius: 50%; background: ${NAVY}; border: 3px solid #fff;
    box-shadow: 0 6px 20px rgba(11,31,58,0.35); cursor: pointer; z-index: 9999;
    display: flex; align-items: center; justify-content: center; padding: 0;
    transition: transform .2s ease; overflow: visible;
  }
  #gda-chat-bubble:hover { transform: scale(1.06); }
  #gda-chat-bubble img {
    width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;
  }
  #gda-chat-bubble .gda-pulse-ring {
    position: absolute; inset: -3px; border-radius: 50%;
    border: 2px solid ${ORANGE}; animation: gda-pulse 2.2s ease-out infinite;
    pointer-events: none;
  }
  @keyframes gda-pulse {
    0% { transform: scale(1); opacity: .8; }
    100% { transform: scale(1.45); opacity: 0; }
  }
  #gda-chat-bubble .gda-dot {
    position: absolute; top: 2px; right: 2px; width: 14px; height: 14px;
    background: ${ORANGE}; border-radius: 50%; border: 2px solid #fff; z-index: 2;
  }
  #gda-preview-bubble {
    position: fixed; bottom: 96px; right: 22px; max-width: 240px;
    background: #fff; border-radius: 14px; border-bottom-right-radius: 3px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.22); padding: 13px 16px; z-index: 9998;
    font-family: 'Inter', 'Poppins', Arial, sans-serif; font-size: 0.86rem; color: #1A2333;
    display: none; align-items: flex-start; gap: 8px; line-height: 1.4;
    animation: gda-preview-in .4s ease;
  }
  #gda-preview-bubble.gda-show { display: flex; }
  #gda-preview-bubble .gda-preview-close {
    position: absolute; top: -8px; right: -8px; width: 22px; height: 22px;
    background: ${NAVY}; color: #fff; border-radius: 50%; border: 2px solid #fff;
    display: flex; align-items: center; justify-content: center; font-size: 13px;
    cursor: pointer; line-height: 1;
  }
  @keyframes gda-preview-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  #gda-chat-window {
    position: fixed; bottom: 96px; right: 22px; width: 340px; max-width: 90vw;
    height: 460px; max-height: 70vh; background: ${PAPER}; border-radius: 14px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25); display: none; flex-direction: column;
    overflow: hidden; z-index: 9999; font-family: 'Inter', 'Poppins', Arial, sans-serif;
  }
  #gda-chat-window.gda-open { display: flex; }
  #gda-chat-header {
    background: ${NAVY}; color: #fff; padding: 16px 18px; display: flex;
    align-items: center; justify-content: space-between;
  }
  #gda-chat-header .gda-header-left { display: flex; align-items: center; gap: 10px; }
  #gda-chat-avatar {
    width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
    border: 2px solid rgba(255,255,255,0.25); flex-shrink: 0;
  }
  #gda-chat-header .gda-title { font-weight: 700; font-size: 0.98rem; }
  #gda-chat-header .gda-sub { font-size: 0.76rem; color: rgba(255,255,255,0.7); margin-top: 2px; }
  #gda-chat-close {
    background: none; border: none; color: #fff; font-size: 20px; cursor: pointer;
    opacity: 0.8; line-height: 1;
  }
  #gda-chat-close:hover { opacity: 1; }
  #gda-chat-messages {
    flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px;
    background: ${PAPER};
  }
  .gda-msg { max-width: 82%; padding: 10px 13px; border-radius: 12px; font-size: 0.88rem; line-height: 1.45; }
  .gda-msg.bot { background: #fff; border: 1px solid #E3DED2; color: #1A2333; align-self: flex-start; border-bottom-left-radius: 3px; }
  .gda-msg.user { background: ${ORANGE}; color: #fff; align-self: flex-end; border-bottom-right-radius: 3px; }
  .gda-msg a { color: ${NAVY}; font-weight: 700; }
  .gda-msg.bot a { color: ${ORANGE}; }
  #gda-quick-replies { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px; }
  .gda-chip {
    background: #fff; border: 1px solid ${NAVY}; color: ${NAVY}; font-size: 0.76rem;
    padding: 6px 11px; border-radius: 20px; cursor: pointer; transition: background .15s;
  }
  .gda-chip:hover { background: #EFF3F8; }
  #gda-chat-input-row {
    display: flex; gap: 8px; padding: 12px; border-top: 1px solid #E3DED2; background: #fff;
  }
  #gda-chat-input {
    flex: 1; border: 1px solid #E3DED2; border-radius: 20px; padding: 10px 14px;
    font-size: 0.88rem; outline: none; font-family: inherit;
  }
  #gda-chat-input:focus { border-color: ${ORANGE}; }
  #gda-chat-send {
    background: ${ORANGE}; color: #fff; border: none; border-radius: 50%;
    width: 38px; height: 38px; cursor: pointer; font-size: 16px; flex-shrink: 0;
  }
  #gda-chat-send:hover { background: #d96e10; }
  @media (max-width: 420px) {
    #gda-chat-window { right: 10px; left: 10px; width: auto; bottom: 88px; }
    #gda-chat-bubble { right: 16px; bottom: 16px; }
  }
  `;

  var styleTag = document.createElement('style');
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  var bubble = document.createElement('button');
  bubble.id = 'gda-chat-bubble';
  bubble.setAttribute('aria-label', 'Chat with GTA Driving Academy');
  bubble.innerHTML = '<span class="gda-pulse-ring"></span><img src="images/headshots/chat-avatar.jpg" alt="Chat with us"><span class="gda-dot"></span>';
  document.body.appendChild(bubble);

  var preview = document.createElement('div');
  preview.id = 'gda-preview-bubble';
  preview.innerHTML = '<span class="gda-preview-close" id="gda-preview-close" aria-label="Dismiss">&times;</span><span>👋 Hi! Questions about lessons or pricing? I\'m here to help.</span>';
  document.body.appendChild(preview);

  var win = document.createElement('div');
  win.id = 'gda-chat-window';
  win.innerHTML =
    '<div id="gda-chat-header">' +
      '<div class="gda-header-left"><img id="gda-chat-avatar" src="images/headshots/chat-avatar.jpg" alt="Chat support"><div><div class="gda-title">GTA Driving Academy</div><div class="gda-sub">We usually reply in a few minutes</div></div></div>' +
      '<button id="gda-chat-close" aria-label="Close chat">&times;</button>' +
    '</div>' +
    '<div id="gda-chat-messages"></div>' +
    '<div id="gda-quick-replies"></div>' +
    '<div id="gda-chat-input-row">' +
      '<input id="gda-chat-input" type="text" placeholder="Ask about lessons, pricing, booking..." />' +
      '<button id="gda-chat-send" aria-label="Send">&#10148;</button>' +
    '</div>';
  document.body.appendChild(win);

  var messagesEl = document.getElementById('gda-chat-messages');
  var quickRepliesEl = document.getElementById('gda-quick-replies');
  var inputEl = document.getElementById('gda-chat-input');

  function addMessage(text, sender) {
    var el = document.createElement('div');
    el.className = 'gda-msg ' + sender;
    el.innerHTML = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  var QUICK_REPLIES = ['Pricing', 'BDE Program', 'Book a Lesson', 'Mock Test'];

  function renderQuickReplies() {
    quickRepliesEl.innerHTML = '';
    QUICK_REPLIES.forEach(function (label) {
      var chip = document.createElement('button');
      chip.className = 'gda-chip';
      chip.textContent = label;
      chip.onclick = function () { handleUserMessage(label); };
      quickRepliesEl.appendChild(chip);
    });
  }

  // Simple keyword-matched knowledge base.
  var RULES = [
    {
      keywords: ['price', 'pricing', 'cost', 'how much', 'rate', 'fee'],
      reply: 'A single G2 lesson is <strong>$55</strong>. Packages bring that down further — the 10-Lesson Package is our most popular at <strong>$500</strong> ($50/lesson). See the full breakdown on our <a href="pricing.html">Pricing page</a>.'
    },
    {
      keywords: ['package', '5 lesson', '5-lesson', '10 lesson', '10-lesson', '20 lesson', '20-lesson'],
      reply: '5-Lesson: $260 ($52/lesson) · 10-Lesson: $500 ($50/lesson, most popular) · 20-Lesson: $900 ($45/lesson, best value). All include a certified instructor and dual-brake vehicle. <a href="pricing.html">Compare packages</a>.'
    },
    {
      keywords: ['bde', 'beginner driver'],
      reply: 'Yes — our Beginner Driver Education (BDE) program is <strong>MTO-approved and currently running</strong>. It combines classroom and in-car training and can reduce your G2 wait time and insurance costs. <a href="contact.html">Contact us</a> for enrollment details.'
    },
    {
      keywords: ['mock test', 'mock exam', 'practice test'],
      reply: 'Yes — a Mock Test is <strong>$55</strong> and gives you an examiner-style practice run before your actual road test. <a href="booking.html">Book one here</a>.'
    },
    {
      keywords: ['refresher', 'nervous', 'havent driven', "haven't driven", 'rusty'],
      reply: 'Our Refresher Lessons are built for adults, seniors, and newcomers rebuilding confidence — patient, judgment-free, at your own pace. $55/hour or a 5-Pack for $395. <a href="services.html#refresher">Learn more</a>.'
    },
    {
      keywords: ['winter'],
      reply: 'We run both a group Winter Driving Clinic ($120, skid recovery & black ice) and a private 1-on-1 winter session ($185). <a href="services.html">See details</a>.'
    },
    {
      keywords: ['book', 'booking', 'schedule', 'appointment', 'reserve'],
      reply: 'You can book directly right here: <a href="booking.html">Go to Booking</a>. Want help picking the right package first?'
    },
    {
      keywords: ['discount', 'referral', 'student id', 'family'],
      reply: 'We offer a Refer-a-Friend discount ($10 off both sides), a Family Package discount (10% off when two family members book together), and a Student ID discount ($5–15 off). <a href="pricing.html">See all discounts</a>.'
    },
    {
      keywords: ['contact', 'phone', 'email', 'address', 'location', 'where are you'],
      reply: 'You can reach us through our <a href="contact.html">Contact page</a> — happy to answer anything else here in the meantime too.'
    },
    {
      keywords: ['hi', 'hello', 'hey'],
      reply: 'Hi there! 👋 Ask me about lessons, pricing, the BDE program, or booking — or use one of the quick options below.'
    }
  ];

  var FALLBACK = 'Good question — for anything that specific, our <a href="contact.html">team can help directly</a>, or you can browse full details on our <a href="services.html">Services page</a>.';

  function findReply(message) {
    var lower = message.toLowerCase();
    for (var i = 0; i < RULES.length; i++) {
      var rule = RULES[i];
      for (var j = 0; j < rule.keywords.length; j++) {
        if (lower.indexOf(rule.keywords[j]) !== -1) {
          return rule.reply;
        }
      }
    }
    return FALLBACK;
  }

  function handleUserMessage(text) {
    if (!text || !text.trim()) return;
    addMessage(escapeHtml(text), 'user');
    inputEl.value = '';
    setTimeout(function () {
      addMessage(findReply(text), 'bot');
    }, 380);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  document.getElementById('gda-chat-send').addEventListener('click', function () {
    handleUserMessage(inputEl.value);
  });
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') handleUserMessage(inputEl.value);
  });

  var opened = false;
  function openChat() {
    win.classList.add('gda-open');
    preview.classList.remove('gda-show');
    if (!opened) {
      opened = true;
      addMessage('Hi! 👋 I\'m here to help with anything about our driving lessons — pricing, the BDE program, booking, or which package fits you best. What can I get you?', 'bot');
      renderQuickReplies();
    }
  }
  bubble.addEventListener('click', function () {
    if (win.classList.contains('gda-open')) {
      win.classList.remove('gda-open');
    } else {
      openChat();
    }
  });
  document.getElementById('gda-chat-close').addEventListener('click', function () {
    win.classList.remove('gda-open');
  });

  // Auto-pop the preview bubble on its own after a few seconds — no click needed.
  // Only once per browser session, and only if the visitor hasn't already opened the chat.
  var previewShown = false;
  function autoShowPreview() {
    if (previewShown || opened || win.classList.contains('gda-open')) return;
    try {
      if (sessionStorage.getItem('gdaPreviewShown')) return;
      sessionStorage.setItem('gdaPreviewShown', '1');
    } catch (e) { /* sessionStorage unavailable — show anyway */ }
    previewShown = true;
    preview.classList.add('gda-show');
  }
  setTimeout(autoShowPreview, 4000);

  // Clicking the preview text opens the full chat window.
  preview.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'gda-preview-close') return;
    openChat();
  });
  document.getElementById('gda-preview-close').addEventListener('click', function (e) {
    e.stopPropagation();
    preview.classList.remove('gda-show');
  });
})();
