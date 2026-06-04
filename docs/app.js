 (function () {
   const THEME_KEY = "capsla-theme";
   const LANGUAGE_KEY = "capsla-language";
   const SUPPORTED_LANGUAGES = ["en", "ru", "de"];

   function getSavedTheme() {
     return localStorage.getItem(THEME_KEY) || "system";
   }

   function applyTheme(theme) {
     const root = document.documentElement;

     if (theme === "system") {
       root.removeAttribute("data-theme");
     } else {
       root.setAttribute("data-theme", theme);
     }

     localStorage.setItem(THEME_KEY, theme);
     updateThemeButtons(theme);
   }

   function updateThemeButtons(activeTheme) {
     document.querySelectorAll("[data-theme-value]").forEach((button) => {
       button.classList.toggle(
         "is-active",
         button.dataset.themeValue === activeTheme
       );
     });
   }

   function setupThemeSwitcher() {
     const savedTheme = getSavedTheme();
     applyTheme(savedTheme);

     document.querySelectorAll("[data-theme-value]").forEach((button) => {
       button.addEventListener("click", () => {
         applyTheme(button.dataset.themeValue);
       });
     });
   }

   function detectPreferredLanguage() {
     const saved = localStorage.getItem(LANGUAGE_KEY);

     if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
       return saved;
     }

     const browserLanguages =
       navigator.languages && navigator.languages.length
         ? navigator.languages
         : [navigator.language || "en"];

     for (const lang of browserLanguages) {
       const normalized = lang.toLowerCase();

       if (normalized.startsWith("ru")) return "ru";
       if (normalized.startsWith("de")) return "de";
       if (normalized.startsWith("en")) return "en";
     }

     return "en";
   }

   function markActiveLanguage() {
     const pageLang = document.body.dataset.pageLang;

     if (!pageLang) return;

     localStorage.setItem(LANGUAGE_KEY, pageLang);

     document.querySelectorAll("[data-lang-link]").forEach((link) => {
       link.classList.toggle("is-active", link.dataset.langLink === pageLang);
     });
   }

   function redirectFromRootIfNeeded() {
     const path = window.location.pathname;

     const isLanguagePage =
       path.includes("/en/") ||
       path.includes("/ru/") ||
       path.includes("/de/");

     if (isLanguagePage) return;

     const isRootIndex =
       path.endsWith("/") ||
       path.endsWith("/index.html") ||
       path.endsWith("/docs/") ||
       path.endsWith("/docs/index.html");

     if (!isRootIndex) return;

     const preferredLanguage = detectPreferredLanguage();

     const target =
       preferredLanguage === "ru"
         ? "./ru/"
         : preferredLanguage === "de"
           ? "./de/"
           : "./en/";

     window.location.replace(target);
   }

   document.addEventListener("DOMContentLoaded", () => {
     setupThemeSwitcher();
     markActiveLanguage();
     redirectFromRootIfNeeded();
   });
 })();
