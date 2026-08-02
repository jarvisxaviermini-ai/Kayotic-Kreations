let siteContent;
let activeSlide = 0;
let slideTimer;
let lastScrollY = window.scrollY;
let heroTitleTyped = false;
const carouselDelay = 6500;

const qs = (selector) => document.querySelector(selector);

async function loadContent() {
  const response = await fetch("/api/content");
  if (!response.ok) {
    throw new Error("Could not load site content");
  }
  return response.json();
}

function setText(selector, value) {
  const el = qs(selector);
  if (el) el.textContent = value || "";
}

function renderHero() {
  const track = qs("#hero-track");
  const dots = qs("#hero-dots");
  if (!track || !dots) return;

  track.innerHTML = siteContent.heroSlides
    .map((slide, index) => `
      <article class="hero-slide ${index === activeSlide ? "is-active" : ""}" style="background-image: url('${slide.image}')">
        <span class="slide-label">${slide.label}</span>
      </article>
    `)
    .join("");

  dots.innerHTML = siteContent.heroSlides
    .map((_, index) => `<button type="button" class="${index === activeSlide ? "is-active" : ""}" aria-label="Show slide ${index + 1}"></button>`)
    .join("");

  setText("#hero-kicker", siteContent.heroSlides[activeSlide]?.label);
  setText("#hero-description", siteContent.heroDescription);

  if (!heroTitleTyped) {
    typeHeroTitle(siteContent.heroTitle);
  }

  dots.querySelectorAll("button").forEach((button, index) => {
    button.addEventListener("click", () => goToSlide(index));
  });

  restartProgress();
}

function typeHeroTitle(text) {
  const title = qs("#hero-title");
  if (!title) return;

  heroTitleTyped = true;
  title.setAttribute("aria-label", text);
  title.dataset.fullText = text;
  reserveHeroTitleSpace(title, text);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    title.textContent = text;
    return;
  }

  title.textContent = "";
  title.classList.add("is-typing");

  let index = 0;
  const typeNext = () => {
    title.textContent = text.slice(0, index);
    index += 1;

    if (index <= text.length) {
      const char = text[index - 2] || "";
      const delay = [",", ".", "-"].includes(char) ? 230 : 58 + Math.random() * 42;
      window.setTimeout(typeNext, delay);
      return;
    }

    window.setTimeout(() => title.classList.remove("is-typing"), 900);
  };

  window.setTimeout(typeNext, 260);
}

function reserveHeroTitleSpace(title, text) {
  const originalText = title.textContent;
  const originalVisibility = title.style.visibility;
  const wasTyping = title.classList.contains("is-typing");

  title.classList.remove("is-typing");
  title.style.visibility = "hidden";
  title.textContent = text;
  title.style.minHeight = "auto";
  const height = Math.ceil(title.getBoundingClientRect().height);
  title.style.minHeight = `${height}px`;
  title.textContent = originalText;
  title.style.visibility = originalVisibility;
  title.classList.toggle("is-typing", wasTyping);
}

function goToSlide(index) {
  activeSlide = (index + siteContent.heroSlides.length) % siteContent.heroSlides.length;
  renderHero();
  restartCarousel();
}

function restartCarousel() {
  window.clearInterval(slideTimer);
  slideTimer = window.setInterval(() => goToSlide(activeSlide + 1), carouselDelay);
}

function restartProgress() {
  const bar = qs("#hero-progress-bar");
  if (!bar) return;
  bar.classList.remove("is-running");
  void bar.offsetWidth;
  bar.classList.add("is-running");
}

function renderStory() {
  setText("#story-title", siteContent.storyTitle);
  setText("#story-body", siteContent.storyBody);

  const stats = qs("#stats");
  if (!stats) return;
  stats.innerHTML = siteContent.stats
    .map((stat) => `
      <div>
        <dt data-stat-value="${stat.value}">${stat.value}</dt>
        <dd>${stat.label}</dd>
      </div>
    `)
    .join("");
}

function renderGallery() {
  const grid = qs("#gallery-grid");
  if (!grid) return;
  grid.innerHTML = siteContent.gallery
    .map((item, index) => `
      <article class="gallery-card ${index === 0 ? "feature" : ""}">
        <img src="${item.image}" alt="${item.alt}" loading="${index < 2 ? "eager" : "lazy"}">
        <div>
          <span>${item.category}</span>
          <h3>${item.title}</h3>
        </div>
      </article>
    `)
    .join("");
}

function renderServices() {
  const list = qs("#service-list");
  if (!list) return;
  list.innerHTML = siteContent.services
    .map((service) => `
      <article class="service-card">
        <span>${service.number}</span>
        <h3>${service.title}</h3>
        <p>${service.description}</p>
      </article>
    `)
    .join("");
}

function renderQuoteAndContact() {
  setText("#quote-text", siteContent.quoteText);
  setText("#quote-credit", siteContent.quoteCredit);
  setText("#contact-title", siteContent.contactTitle);
  setText("#contact-body", siteContent.contactBody);
  setText("#footer-tagline", siteContent.footerTagline);

  const form = qs("#contact-form");
  if (form && siteContent.contactEmail) {
    form.action = `mailto:${siteContent.contactEmail}`;
  }
}

function wireControls() {
  qs("#prev-slide")?.addEventListener("click", () => goToSlide(activeSlide - 1));
  qs("#next-slide")?.addEventListener("click", () => goToSlide(activeSlide + 1));
}

function wireHeroParallax() {
  const hero = qs(".hero");
  if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 18;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 12;
    hero.style.setProperty("--hero-x", `${x}px`);
    hero.style.setProperty("--hero-y", `${y}px`);
  });

  hero.addEventListener("pointerleave", () => {
    hero.style.setProperty("--hero-x", "0px");
    hero.style.setProperty("--hero-y", "0px");
  });
}

function wireHeaderDepth() {
  const header = qs(".site-header");
  if (!header) return;

  const updateHeader = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 18);
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });
}

function wireHeroTitleResize() {
  let resizeTimer;

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const title = qs("#hero-title");
      if (!title?.dataset.fullText) return;
      reserveHeroTitleSpace(title, title.dataset.fullText);
    }, 120);
  });
}

function wireScrollReveals() {
  const targets = document.querySelectorAll(".section, .quote-section, .gallery-card, .service-card");
  if (!targets.length) return;

  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
  );

  targets.forEach((target, index) => {
    target.style.transitionDelay = `${Math.min(index * 45, 240)}ms`;
    observer.observe(target);
  });
}

function wireScrollDirection() {
  let ticking = false;

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        document.body.classList.toggle("is-scrolling-up", currentY < lastScrollY);
        document.body.classList.toggle("is-scrolling-down", currentY >= lastScrollY);
        lastScrollY = currentY;
        ticking = false;
      });
      ticking = true;
    },
    { passive: true }
  );
}

function parseStatValue(value) {
  const match = String(value).match(/^(\d+)(.*)$/);
  if (!match) return null;
  return {
    number: Number(match[1]),
    suffix: match[2] || "",
  };
}

function animateStat(el) {
  if (el.dataset.counted === "true") return;
  const parsed = parseStatValue(el.dataset.statValue);
  if (!parsed) return;

  el.dataset.counted = "true";
  const duration = 900;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = `${Math.round(parsed.number * eased)}${parsed.suffix}`;
    if (progress < 1) window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}

function wireStatCountUp() {
  const stats = document.querySelectorAll("[data-stat-value]");
  if (!stats.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) animateStat(entry.target);
      });
    },
    { threshold: 0.8 }
  );

  stats.forEach((stat) => observer.observe(stat));
}

async function boot() {
  try {
    siteContent = await loadContent();
    renderHero();
    renderStory();
    renderGallery();
    renderServices();
    renderQuoteAndContact();
    wireControls();
    wireHeaderDepth();
    wireHeroTitleResize();
    wireHeroParallax();
    wireScrollDirection();
    wireScrollReveals();
    wireStatCountUp();
    restartCarousel();
  } catch (error) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div class="load-error">Content could not be loaded. Start the Node server with <code>node server.js</code>.</div>`
    );
  }
}

boot();
