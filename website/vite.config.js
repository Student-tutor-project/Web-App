// Pages: landing, booking, the team's tutor checks, the guardian's consent link, and safety/privacy/terms.
// inspect.html stays dev-only.
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        book: resolve(import.meta.dirname, "book.html"),
        admin: resolve(import.meta.dirname, "admin.html"),
        consent: resolve(import.meta.dirname, "consent.html"),
        safety: resolve(import.meta.dirname, "safety.html"),
      },
    },
  },
});
