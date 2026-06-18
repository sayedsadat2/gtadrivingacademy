# 🚗 Your Driving School — Complete Website

**"Drive Safe. Keep Families Safe. Keep Roads Safe."**

A complete, production-ready website for an Ontario MTO-approved driving school.  
Built with pure HTML5, CSS3, and Vanilla JavaScript. No frameworks. No build tools. Deploy in minutes.

---

## 📁 Project Structure

```
driving-school-website/
├── index.html              ← Home page
├── about.html              ← About & team
├── services.html           ← All driving programs
├── pricing.html            ← Pricing & packages
├── blog.html               ← Blog hub
├── blog-post-template.html ← Individual blog post
├── videos.html             ← Free video library
├── contact.html            ← Contact form & map
├── booking.html            ← 5-step booking wizard
├── thank-you.html          ← Booking confirmation
│
├── css/
│   ├── style.css           ← Main stylesheet
│   ├── responsive.css      ← Mobile/tablet responsive
│   └── dark-mode.css       ← Dark mode toggle
│
├── js/
│   ├── main.js             ← Nav, carousel, filters, counters
│   ├── booking.js          ← Booking wizard & price calculator
│   └── contact-form.js     ← Form validation & Formspree
│
├── images/                 ← Add your own images here
│   └── trust-badges/
│
└── README.md               ← This file
```

---

## ⚡ Quick Start (Local)

1. **Download** the project folder
2. **Open** `index.html` in any modern browser
3. No server required for basic viewing

For forms to work properly, use a local server:
```bash
# Python
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code: install "Live Server" extension → right-click index.html → Open with Live Server
```

---

## 🎨 Customization

### 1. School Name & Contact Info
Search and replace `[Your Driving School]` across all HTML files with your real school name.

Update these in **every HTML file**:
- Phone: `+1 (416) 555-0100` → your number
- Email: `info@yourdrivingschool.ca` → your email
- WhatsApp: `1XXXXXXXXXX` → your WhatsApp Business number (digits only, no spaces)

### 2. Colors (css/style.css — top :root block)
```css
--primary:   #1a3c61;   /* Deep navy blue */
--secondary: #e85d04;   /* Orange CTA */
--accent:    #f4f4f4;   /* Light background */
```

### 3. Logo
Replace the car icon with your own logo:
```html
<!-- In every navbar, replace: -->
<div class="nav-logo-icon"><i class="fa-solid fa-car"></i></div>
<!-- With: -->
<img src="images/logo.png" alt="Your School Logo" width="42" height="42">
```

### 4. Images
Place your images in the `/images/` folder and update `src` attributes in HTML:
- `images/hero-bg.jpg` — hero section background
- `images/instructor1.jpg`, `instructor2.jpg`, `instructor3.jpg` — team photos
- `images/logo.png` — your logo
- `images/favicon.ico` — browser tab icon

### 5. YouTube Videos (videos.html & index.html)
Replace `VIDEO_ID` with your actual YouTube video IDs:
```html
<iframe src="https://www.youtube.com/embed/YOUR_VIDEO_ID?rel=0">
```

### 6. Google Maps (contact.html)
Replace the Maps embed URL with your actual service area:
1. Go to Google Maps → search your city
2. Click Share → Embed a map → Copy HTML
3. Replace the `<iframe src="...">` in contact.html

---

## 📬 Connect Contact Form (Formspree)

1. Go to [formspree.io](https://formspree.io) → Create free account
2. Create a new form → copy the form ID (looks like `xabc1234`)
3. Open `js/contact-form.js` and replace:
```javascript
const FORMSPREE = 'https://formspree.io/f/YOUR_FORM_ID';
// Replace with:
const FORMSPREE = 'https://formspree.io/f/xabc1234';
```
4. Done! Form submissions will arrive in your email inbox.

**Alternative — Google Forms:**
1. Create a Google Form with matching fields
2. Get the pre-fill URL
3. Replace the `mailto:` fallback in contact-form.js with a fetch to the Google Form URL

---

## 📅 Connect Live Booking (Calendly)

Option A — **Embed Calendly widget** in booking.html:
1. Sign up at [calendly.com](https://calendly.com) (free tier available)
2. Create your event types (G2 Lesson, Full G, etc.)
3. In booking.html, uncomment and update:
```html
<div class="calendly-inline-widget" data-url="https://calendly.com/YOUR_USERNAME"></div>
<script src="https://assets.calendly.com/assets/external/widget.js" async></script>
```

Option B — **SimplyBook.me:**
1. Sign up at [simplybook.me](https://simplybook.me)
2. Set up your services and staff
3. Copy their embed widget code into booking.html

---

## 💳 Connect Payments (Stripe)

1. Create account at [stripe.com](https://stripe.com)
2. Create Payment Links for each package in the Stripe dashboard
3. Replace the booking confirmation button href with your Stripe Payment Link:
```html
<a href="https://buy.stripe.com/YOUR_LINK" class="btn btn-primary">Pay Now</a>
```

---

## 📊 Add Google Analytics

1. Go to [analytics.google.com](https://analytics.google.com) → create property
2. Copy your Measurement ID (format: `G-XXXXXXXXXX`)
3. Add before `</head>` in **every HTML file**:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

---

## 💬 Add Live Chat (Tawk.to — Free)

1. Sign up at [tawk.to](https://tawk.to) (free forever)
2. Copy your widget code
3. Paste before `</body>` in every HTML file:
```html
<script type="text/javascript">
var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;s1.src='https://embed.tawk.to/YOUR_PROPERTY_ID/default';
s1.charset='UTF-8';s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);})();
</script>
```

---

## 📱 SMS Reminders (Twilio)

1. Create account at [twilio.com](https://twilio.com)
2. Get a phone number (~$1/month)
3. Use Twilio's API to send SMS on booking confirmation
4. Connect via a serverless function (Netlify Functions, Vercel Functions, or n8n)

---

## 🚀 Deployment

### Option 1 — Netlify (Recommended, Free)
1. Go to [netlify.com](https://netlify.com) → sign up free
2. Drag and drop your entire project folder onto the Netlify dashboard
3. Your site is live instantly at `https://yourname.netlify.app`
4. To add custom domain: Site Settings → Domain Management → Add domain

### Option 2 — GitHub Pages (Free)
1. Push your project to a GitHub repository
2. Go to repository Settings → Pages
3. Source: Deploy from branch → main → / (root)
4. Site live at `https://yourusername.github.io/repo-name`

### Option 3 — Vercel (Free)
```bash
npm i -g vercel
vercel deploy
```

### Option 4 — Traditional Hosting (Bluehost, SiteGround, HostGator)
1. Purchase hosting + domain
2. Access cPanel → File Manager → public_html
3. Upload all project files
4. Site is live at your domain

---

## 🌐 Custom Domain Setup

### GoDaddy / Namecheap → Netlify:
1. In Netlify: Site Settings → Domain Management → Add custom domain
2. Netlify gives you nameservers (e.g., `dns1.p01.nsone.net`)
3. In GoDaddy/Namecheap: Update nameservers to Netlify's
4. Wait 24-48 hours for DNS propagation
5. Netlify auto-provides free SSL certificate

---

## 📋 SEO Checklist (Before Launch)

- [ ] Replace all `[Your Driving School]` placeholders with your real name
- [ ] Update meta titles and descriptions on every page (unique per page)
- [ ] Add your real phone number and address to footer + contact page
- [ ] Update Google Maps embed with your real service area
- [ ] Add Google Analytics tracking ID
- [ ] Submit sitemap to Google Search Console
- [ ] Add your school to Google Business Profile
- [ ] Replace YouTube `VIDEO_ID` placeholders with real video IDs
- [ ] Add real instructor photos (replace placeholder avatars)
- [ ] Update LocalBusiness schema in index.html with real address + hours

---

## 🔧 Ongoing Maintenance

**Monthly:**
- [ ] Publish 1-2 new blog posts
- [ ] Upload 1 new driving video
- [ ] Check contact form is receiving submissions
- [ ] Review and respond to Google reviews

**Quarterly:**
- [ ] Update pricing if changed
- [ ] Review seasonal service availability (winter clinic)
- [ ] Check all links work
- [ ] Update testimonials with recent student reviews

**Annually:**
- [ ] Renew domain registration
- [ ] Review and update meta descriptions
- [ ] Update copyright year in footer (auto-handled by JS)
- [ ] Review and refresh blog content

---

## 🔐 WCAG 2.1 Accessibility Notes

This website includes:
- ARIA labels on all interactive elements
- Semantic HTML (nav, main, section, article, aside, footer)
- Skip-to-content support via `#main` anchor
- Sufficient colour contrast (4.5:1+ ratio)
- Keyboard navigation for all interactive elements
- Focus indicators on all focusable elements
- Alt text required on all `<img>` tags you add

---

## 📞 Support

For technical support customizing this website:
- Email: [your support email]
- The codebase is plain HTML/CSS/JS — any web developer can customize it

---

*Built for Ontario Driving Schools | MTO Approved | © 2025*
