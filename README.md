# Ontario Driving School Website Package

This is a complete static website for an Ontario driving school, based on a clean education-service design style.

## Files Included
- `index.html` home page
- `about.html` about and team page
- `services.html` services page
- `pricing.html` pricing and package calculator
- `blog.html` blog hub with live search/filter
- `blog-post-template.html` individual blog template
- `videos.html` video library with category filter
- `contact.html` contact form and map placeholder
- `booking.html` step-by-step booking wizard
- `thank-you.html` confirmation page
- `css/style.css`, `css/responsive.css`, `css/dark-mode.css`
- `js/main.js`, `js/booking.js`, `js/testimonials.js`, `js/contact-form.js`, `js/filters.js`

## How to Open Locally
1. Download and unzip the folder.
2. Open `index.html` in your browser.
3. Click the navigation links to test all pages.

## How to Customize
- Replace `GTA Driving Academy` with your real business name.
- Replace `[Phone Number]`, `[Email Address]`, and placeholders.
- Add your logo to `images/logo.png` and update the header if needed.
- Replace placeholder thumbnails with real images.
- Change colors in `css/style.css` under `:root`.

## Booking System Connection
Current booking page is a demo wizard using `mailto:`. For real booking, use one of these:
- Calendly: paste your embed code into `booking.html`.
- SimplyBook: paste your widget code into `booking.html`.
- AppointmentPlus: add the booking link or widget from your provider.

## Contact Form Connection
The contact form uses a placeholder Formspree action:
`https://formspree.io/f/YOUR-ENDPOINT`
Create a free Formspree form and replace `YOUR-ENDPOINT`.

## Google Analytics
Add this before the closing `</head>` tag on every HTML page:
```html
<!-- Google tag placeholder -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-XXXXXXX');
</script>
```

## Google Maps
The contact page has a Toronto map placeholder. Replace it with your real business address embed from Google Maps.

## WhatsApp Button
Edit the number in the footer WhatsApp link:
`https://wa.me/10000000000`
Use country code, no spaces.

## Payments
Add Stripe or Square checkout buttons to `pricing.html` or `booking.html`. Use each provider's official checkout button code.

## SEO
Each page includes meta title, description, Open Graph tags, and LocalBusiness/DrivingSchool schema placeholder. Update business name, address, phone, and service area before publishing.

## Deployment
### Netlify
1. Create a Netlify account.
2. Drag and drop this folder into Netlify.
3. Add your custom domain in Site Settings.

### Vercel
1. Create a Vercel account.
2. Import the folder from GitHub or upload project files.
3. Connect your domain.

### GoDaddy / Traditional Hosting
1. Open your hosting file manager or FTP.
2. Upload all files inside `driving-school-website` to `public_html`.
3. Make sure `index.html` is in the root.

## Connect GoDaddy Domain
- If hosting on Netlify/Vercel, update DNS records at GoDaddy based on provider instructions.
- If hosting with GoDaddy, upload files to the hosting account linked with your domain.

## Maintenance Checklist
- Update prices and packages monthly.
- Add real Google reviews.
- Post at least 2 blogs per month.
- Add YouTube videos for G1/G2/Full G tips.
- Test contact and booking forms weekly.
- Check mobile layout after every major edit.
- Keep images compressed for fast loading.


## Added 3-Second Safety Video

The file `videos/gta-driving-lesson-safety-3sec.mp4` is embedded on the Home page and Videos page. It is exactly 3 seconds long and uses the generated GTA Driving Academy instructor/student driving lesson scene.
