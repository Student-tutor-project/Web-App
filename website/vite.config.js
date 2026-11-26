// Two pages: the landing page and the booking page. inspect.html stays dev-only.
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        book: resolve(import.meta.dirname, "book.html"),
      },
    },
  },
});
