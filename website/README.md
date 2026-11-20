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
| `src/account.js` | The Log in / Sign up panel (preview only, no backend) |
| `src/style.css` | Brand tokens (top of file) and all layout |
| `public/model/product.glb` | The lamp (Tripo H3.1, optimized to 2 MB) |
| `public/img/hero.jpg` | The poster: shows instantly, and stays if 3D can't run |
| `inspect.html` | Dev-only model review page (not part of the build) |

## Where a booking goes

**Nowhere yet.** The contact details are placeholders, so finishing a booking only shows a
confirmation on the page, with a line saying bookings are not sent. Nothing is stored or emailed.
The tutors in step 2 are sample profiles in `src/booking.js`.

**Log in, plus the top bar's Teach with us and Book a tutor** (all open `src/account.js`), work the same way: it checks the fields, then says accounts
open at launch. Nothing typed there, including passwords, is sent or stored. To make it real, swap the
submit handler for Supabase Auth (`signInWithPassword` and `signUp`).

To make bookings real, connect the submit handler in `src/booking.js` to a backend (for example
Supabase) and replace the sample tutors with verified profiles.

## Placeholders to replace before launch

- Email `hello@studenttutor.example`, WhatsApp `+65 0000 0000`, Instagram `@studenttutor`
  (in `index.html`, footer and the mailto links)
- Starting prices S$20 (primary) and S$30 (secondary), in `index.html` and the meta description
- Sample tutor profiles in `src/booking.js`

## Testing the fallback

Open `/?model=/model/missing.glb`: the page should show the hero still with all copy readable.
