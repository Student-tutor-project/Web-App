# Student Tutor website

A landing page with a live 3D conference room above a futuristic city (three.js), where visitors take a seat to sign up or log in, and a plain, fast three-step booking flow.

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
| `src/main.js` | Smooth scroll; starts the account panel and the 3D room |
| `src/room.js` | The 3D room: layout, daylight, the ten chairs, the three choices and their floating signs, the scroll camera beats, the camera glide when a seat is chosen |
| `src/city.js` | The futuristic city outside the glass, built in code: towers, halo rings, sky bridges, gliding craft, clouds |
| `src/particles.js` | Dust in the sunlight |
| `src/account.js` | The Log in / Sign up panel, using Supabase Auth |
| `src/supabase.js` | The shared Supabase client (reads `.env`) |
| `src/style.css` | Brand tokens (top of file) and all layout |
| `public/model/room.glb` | Table, laptop and window frames, modelled in Blender by `../assets/blender/build_room.py` |
| `public/model/chair.glb` | The chair (Tripo H3.1 from a generated studio photo, simplified to 76k triangles, 0.7 MB), used for all ten seats |
| `public/img/hero.jpg` | The poster, a render of the room's first frame: shows instantly, and stays if 3D can't run |
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

Every Book button on the homepage opens `book.html`. Parents log in there and book a real tutor's
open hour, which is saved in Supabase (`book_slot` / `cancel_booking`). There are no booking
emails yet.

## Placeholders to replace before launch

- Email `hello@studenttutor.example`, WhatsApp `+65 0000 0000`, Instagram `@studenttutor`
  (in `index.html`, footer and the mailto links)
- Starting prices S$20 (primary) and S$30 (secondary), in `index.html` and the meta description

## Testing the fallback

Open `/?nostage`: the page shows the poster with all copy readable, and the seat signs are hidden (the bar's buttons still open sign-up and log in).

## Rebuilding the room pieces

```bash
"C:/Program Files/Blender Foundation/Blender 5.3/blender.exe" -b -P ../assets/blender/build_room.py
```

The plan for the rest of the site and the hero animation is in `../copy/site-plan.md`.
