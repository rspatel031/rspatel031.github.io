const THEME_KEY = "profile-theme";
const root = document.documentElement;
const toggleButton = document.getElementById("theme-toggle");
const toggleLabel = toggleButton.querySelector(".toggle-label");
const yearElement = document.getElementById("year");
const siteHeader = document.querySelector(".site-header");
const menuToggleButton = document.getElementById("menu-toggle");
const headerNav = document.getElementById("header-nav");
const headerNavLinks = headerNav
  ? Array.from(headerNav.querySelectorAll('a[href^="#"]'))
  : [];
const inPageLinks = document.querySelectorAll('a[href^="#"]');
const revealTargets = document.querySelectorAll(
  ".hero, .fact-strip, .content-grid .card"
);
const supportsMatchMedia = typeof window.matchMedia === "function";
const systemThemeMedia = supportsMatchMedia
  ? window.matchMedia("(prefers-color-scheme: dark)")
  : null;
const reducedMotionMedia = supportsMatchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)")
  : null;
const compactMenuMedia = supportsMatchMedia
  ? window.matchMedia("(max-width: 920px)")
  : null;
const SCROLL_DURATION_MS = 560;
const SCROLL_TOP_OFFSET = 12;
let activeScrollAnimationId = null;

function isValidTheme(theme) {
  return theme === "light" || theme === "dark";
}

function setTheme(theme) {
  root.setAttribute("data-theme", theme);
  const darkModeEnabled = theme === "dark";
  toggleButton.setAttribute("aria-pressed", String(darkModeEnabled));
  toggleLabel.textContent = darkModeEnabled ? "Light mode" : "Dark mode";
}

function systemPreferredTheme() {
  return systemThemeMedia && systemThemeMedia.matches ? "dark" : "light";
}

function prefersReducedMotion() {
  return reducedMotionMedia ? reducedMotionMedia.matches : false;
}

function storedTheme() {
  try {
    return window.localStorage.getItem(THEME_KEY);
  } catch (error) {
    return null;
  }
}

function saveTheme(theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    // Ignore storage failures in restricted browser modes.
  }
}

function cancelActiveScrollAnimation() {
  if (
    activeScrollAnimationId !== null &&
    typeof window.cancelAnimationFrame === "function"
  ) {
    window.cancelAnimationFrame(activeScrollAnimationId);
  }
  activeScrollAnimationId = null;
}

function easeInOutCubic(progress) {
  if (progress < 0.5) {
    return 4 * progress * progress * progress;
  }
  return 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function animateWindowScroll(targetY, durationMs) {
  const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
  const maxY = Math.max(
    0,
    (document.documentElement.scrollHeight || document.body.scrollHeight) -
      window.innerHeight
  );
  const destinationY = Math.max(0, Math.min(targetY, maxY));

  if (Math.abs(destinationY - startY) < 1) {
    window.scrollTo(0, destinationY);
    return;
  }

  const startTime =
    typeof window.performance !== "undefined" &&
    typeof window.performance.now === "function"
      ? window.performance.now()
      : Date.now();

  cancelActiveScrollAnimation();

  function step(now) {
    const currentTime = typeof now === "number" ? now : Date.now();
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    const easedProgress = easeInOutCubic(progress);
    const nextY = startY + (destinationY - startY) * easedProgress;
    window.scrollTo(0, nextY);

    if (progress < 1) {
      activeScrollAnimationId = window.requestAnimationFrame(step);
    } else {
      activeScrollAnimationId = null;
      window.scrollTo(0, destinationY);
    }
  }

  if (typeof window.requestAnimationFrame === "function") {
    activeScrollAnimationId = window.requestAnimationFrame(step);
  } else {
    window.scrollTo(0, destinationY);
  }
}

function getTargetScrollTop(target) {
  const currentY = window.pageYOffset || document.documentElement.scrollTop || 0;
  const targetTop = target.getBoundingClientRect().top + currentY;
  const headerHeight = siteHeader ? siteHeader.getBoundingClientRect().height : 0;
  return targetTop - headerHeight - SCROLL_TOP_OFFSET;
}

function smoothScrollToTarget(target) {
  const targetY = getTargetScrollTop(target);
  if (prefersReducedMotion()) {
    cancelActiveScrollAnimation();
    window.scrollTo(0, Math.max(0, targetY));
    return;
  }
  animateWindowScroll(targetY, SCROLL_DURATION_MS);
}

function isCompactMenuViewport() {
  return compactMenuMedia ? compactMenuMedia.matches : window.innerWidth <= 920;
}

function setMenuOpenState(isOpen) {
  if (!siteHeader || !menuToggleButton) {
    return;
  }
  const shouldOpen = Boolean(isOpen) && isCompactMenuViewport();
  siteHeader.classList.toggle("menu-open", shouldOpen);
  menuToggleButton.setAttribute("aria-expanded", String(shouldOpen));
  menuToggleButton.setAttribute(
    "aria-label",
    shouldOpen ? "Close menu" : "Open menu"
  );
}

function closeMenu() {
  setMenuOpenState(false);
}

function setActiveNavById(sectionId) {
  if (!headerNavLinks.length) {
    return;
  }

  headerNavLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const isActive = href === "#" + sectionId;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function setupSmoothAnchors() {
  inPageLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href === "#") {
        return;
      }

      const targetId = href.slice(1);
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) {
        return;
      }

      event.preventDefault();
      smoothScrollToTarget(target);
      setActiveNavById(targetId);
      closeMenu();

      if (window.history && typeof window.history.pushState === "function") {
        window.history.pushState(null, "", href);
      }
    });
  });
}

function setupActiveNavState() {
  if (!headerNavLinks.length) {
    return;
  }

  const trackedSections = headerNavLinks
    .map((link) => {
      const targetId = (link.getAttribute("href") || "").replace("#", "");
      return targetId ? document.getElementById(targetId) : null;
    })
    .filter(Boolean);

  if (!trackedSections.length) {
    return;
  }

  let ticking = false;

  function updateActiveSection() {
    const offset = siteHeader
      ? siteHeader.getBoundingClientRect().height + 26
      : 96;
    let currentSectionId = trackedSections[0].id;

    trackedSections.forEach((section) => {
      const sectionTop = section.getBoundingClientRect().top;
      if (sectionTop - offset <= 0) {
        currentSectionId = section.id;
      }
    });

    setActiveNavById(currentSectionId);
    ticking = false;
  }

  function onScrollOrResize() {
    if (ticking) {
      return;
    }
    ticking = true;
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(updateActiveSection);
    } else {
      updateActiveSection();
    }
  }

  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize);
  updateActiveSection();
}

function setupScrollReveal() {
  revealTargets.forEach((element) => {
    element.classList.add("reveal");
  });

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    revealTargets.forEach((element) => {
      element.classList.add("is-visible");
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries, revealObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -8% 0px",
    }
  );

  revealTargets.forEach((element) => {
    observer.observe(element);
  });
}

function setupHeaderScrollState() {
  if (!siteHeader) {
    return;
  }

  let isTicking = false;

  function updateHeaderState() {
    const shouldExpand = window.scrollY > 14;
    siteHeader.classList.toggle("is-scrolled", shouldExpand);
    isTicking = false;
  }

  function onScroll() {
    if (isTicking) {
      return;
    }
    isTicking = true;
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(updateHeaderState);
    } else {
      updateHeaderState();
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  updateHeaderState();
}

function setupCollapsedMenu() {
  if (!siteHeader || !menuToggleButton || !headerNav) {
    return;
  }

  menuToggleButton.addEventListener("click", () => {
    const isOpen = siteHeader.classList.contains("menu-open");
    setMenuOpenState(!isOpen);
  });

  document.addEventListener("click", (event) => {
    if (!isCompactMenuViewport()) {
      return;
    }
    if (!(event.target instanceof Element)) {
      return;
    }
    if (!siteHeader.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  function syncMenuStateForViewport() {
    if (!isCompactMenuViewport()) {
      closeMenu();
    }
  }

  if (compactMenuMedia) {
    if (typeof compactMenuMedia.addEventListener === "function") {
      compactMenuMedia.addEventListener("change", syncMenuStateForViewport);
    } else if (typeof compactMenuMedia.addListener === "function") {
      compactMenuMedia.addListener(syncMenuStateForViewport);
    }
  } else {
    window.addEventListener("resize", syncMenuStateForViewport);
  }

  syncMenuStateForViewport();
}

const preloadedTheme = root.getAttribute("data-theme");
const savedTheme = storedTheme();
const initialTheme = isValidTheme(preloadedTheme)
  ? preloadedTheme
  : isValidTheme(savedTheme)
  ? savedTheme
  : systemPreferredTheme();
setTheme(initialTheme);

toggleButton.addEventListener("click", () => {
  const currentTheme = root.getAttribute("data-theme");
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(nextTheme);
  saveTheme(nextTheme);
});

function onSystemThemeChange(event) {
  if (!isValidTheme(storedTheme())) {
    setTheme(event.matches ? "dark" : "light");
  }
}

if (systemThemeMedia) {
  if (typeof systemThemeMedia.addEventListener === "function") {
    systemThemeMedia.addEventListener("change", onSystemThemeChange);
  } else if (typeof systemThemeMedia.addListener === "function") {
    systemThemeMedia.addListener(onSystemThemeChange);
  }
}

setupSmoothAnchors();
setupActiveNavState();
setupScrollReveal();
setupHeaderScrollState();
setupCollapsedMenu();

yearElement.textContent = new Date().getFullYear();
