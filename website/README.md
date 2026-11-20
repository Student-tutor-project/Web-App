# Student Tutor website

A landing page with a live 3D study lamp (three.js) and a plain, fast three-step booking flow.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/, relative paths, works on any host
npm run preview    # check the built site over HTTP (never open dist/index.html as a file)
```

## Where things live

| Path | What it is |
|---|---|
| `index.html` | All page copy and sections |
| `src/main.js` | Smooth scroll, the booking flow, and every 3D setting: camera beats, hotspots, light modes, lamp light |
| `src/stage.js` | The 3D scene: lamp, lights, beam, dust, scroll camera, drag to spin, fallback |
| `src/particles.js` | Dust motes and glow textures |
| `src/booking.js` | The booking steps, sample tutors, validation |
| `src/account.js` | The Log in / Sign up panel, using Supabase Auth |
| `src/supabase.js` | The shared Supabase client (reads `.env`) |
| `src/style.css` | Brand tokens (top of file) and all layout |
| `public/model/product.glb` | The lamp (Tripo H3.1, optimized to 2 MB) |
| `public/img/hero.jpg` | The poster: shows instantly, and stays if 3D can't run |
| `inspect.html` | Dev-only model review page (not part of the build) |

## Accounts (Supabase Auth)

Log in, and the top bar's Teach with us and Book a tutor (which open sign-up with the role preselected),
use Supabase Auth with email and password, in the **Student Tutors** project (`jyznsezzathcxoutpglt`).
Sign-up saves the name and role (`parent` or `tutor`) in the user's metadata. When someone is signed in,
the bar shows Log out, and the two bar buttons go straight to booking or the tutor section.

Setup: copy `.env.example` to `.env` and fill in the project URL and publishable key
(Project Settings > API Keys). `.env` is not committed. On Vercel, add the same two variables.

In the Supabase dashboard (Authentication):
- **Email confirmation is on**, so new users must click a link before they can log in.
- **URL Configuration:** set the Site URL to the live site and add `http://localhost:5173` to Redirect
  URLs, so the confirmation link brings people back to the right place.
- **Email (SMTP):** the built-in sender is for testing only, with tight limits. Add your own SMTP
  provider before launch so confirmation emails reach parents reliably.

## Where a booking goes

**Nowhere yet.** The contact details are placeholders, so finishing a booking only shows a
confirmation on the page, with a line saying bookings are not sent. Nothing is stored or emailed.
The tutors in step 2 are sample profiles in `src/booking.js`.

To make bookings real, connect the submit handler in `src/booking.js` to a backend (for example
Supabase) and replace the sample tutors with verified profiles.

## Placeholders to replace before launch

- Email `hello@studenttutor.example`, WhatsApp `+65 0000 0000`, Instagram `@studenttutor`
  (in `index.html`, footer and the mailto links)
- Starting prices S$20 (primary) and S$30 (secondary), in `index.html` and the meta description
- Sample tutor profiles in `src/booking.js`

## Testing the fallback

Open `/?model=/model/missing.glb`: the page should show the hero still with all copy readable.
