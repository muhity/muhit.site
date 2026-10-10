// Reveal sections as they enter the viewport, count the numbers up, light the
// nav's glass, and move its selection on a spring. No scroll listeners.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Count a number like "48,000+" up from zero once it is revealed.
  const fmt = new Intl.NumberFormat("en-US");
  const countUp = (b) => {
    const m = /^([\d,]+)(\D*)$/.exec(b.textContent);
    if (!m || reduced) return;
    const end = Number(m[1].replace(/,/g, "")), t0 = performance.now();
    const tick = (now) => {
      const t = Math.min((now - t0) / 1600, 1);
      b.textContent = fmt.format(Math.round(end * (1 - (1 - t) ** 4))) + m[2];
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const items = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("in");
      if (entry.target.matches(".numbers li")) countUp(entry.target.querySelector("b"));
      reveal.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  items.forEach((el) => reveal.observe(el));
  root.classList.add("io");

  // Liquid Glass refraction. Chromium can run an SVG filter as a backdrop-filter;
  // Safari and Firefox can't, and keep the frosted blur from style.css.
  const refracts = navigator.userAgentData?.brands?.some((b) => b.brand === "Chromium")
    && !matchMedia("(prefers-reduced-transparency: reduce), (prefers-contrast: more)").matches;
  const glasses = document.querySelectorAll(".glass");
  if (refracts && glasses.length) {
    const NS = "http://www.w3.org/2000/svg";
    const defs = document.createElementNS(NS, "svg");
    defs.setAttribute("aria-hidden", "true");
    defs.setAttribute("width", "0");
    defs.setAttribute("height", "0");
    defs.style.position = "absolute";
    document.body.append(defs);
    glasses.forEach((el, i) => {
      defs.insertAdjacentHTML("beforeend", `<filter id="lg-${i}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="soft"/>
        <feImage result="map" preserveAspectRatio="none"/>
        <feDisplacementMap in="soft" in2="map" scale="34" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`);
      const filter = defs.lastElementChild, image = filter.querySelector("feImage");
      new ResizeObserver(() => {
        const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
        if (!w || !h) return;
        const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, h / 2, w / 2);
        for (const node of [filter, image]) {
          node.setAttribute("x", 0); node.setAttribute("y", 0);
          node.setAttribute("width", w); node.setAttribute("height", h);
        }
        image.setAttribute("href", refractionMap(w, h, r, Math.max(8, r * 0.6)));
        el.style.backdropFilter = `url(#lg-${i}) saturate(185%) brightness(0.92)`;
      }).observe(el);
    });
  }

  // The rim catches light where the pointer is.
  glasses.forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
    el.addEventListener("pointerleave", () => { el.style.removeProperty("--mx"); el.style.removeProperty("--my"); });
  });

  // The nav's selection lens: follows the pointer or keyboard focus, otherwise
  // rests on the section in view (home) or the current page (guides).
  const list = document.querySelector(".nav-links");
  if (!list) return;
  const lens = document.createElement("span");
  lens.className = "lens";
  lens.setAttribute("aria-hidden", "true");
  list.prepend(lens);
  const links = [...list.querySelectorAll("a")];
  let hover = null, active = links.find((a) => a.pathname !== "/" && !a.hash && a.origin === location.origin && location.pathname.startsWith(a.pathname)) || null;
  const X = spring(), W = spring();
  let raf = 0, last = 0, shown = false;
  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    X.step(dt); W.step(dt);
    const swell = 1 + Math.min(Math.abs(X.v) / 9000, 0.14);
    lens.style.width = `${W.x}px`;
    lens.style.transform = `translateX(${X.x}px) scale(${swell})`;
    raf = X.settled() && W.settled() ? 0 : requestAnimationFrame(tick);
  };
  const place = () => {
    const a = hover || active;
    links.forEach((l) => l.toggleAttribute("aria-current", l === active));
    if (active?.pathname !== "/" && !active?.hash) active?.setAttribute("aria-current", "page");
    if (!a || !a.offsetParent) { lens.style.opacity = "0"; shown = false; return; }
    const r = a.getBoundingClientRect(), p = list.getBoundingClientRect();
    X.to = r.left - p.left; W.to = r.width;
    if (!shown || reduced) { X.jump(); W.jump(); }
    shown = true;
    lens.style.opacity = "1";
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  };
  list.addEventListener("pointerover", (e) => { const a = e.target.closest("a"); if (a) { hover = a; place(); } });
  list.addEventListener("pointerleave", () => { hover = null; place(); });
  list.addEventListener("focusin", (e) => { hover = e.target.closest("a"); place(); });
  list.addEventListener("focusout", () => { hover = null; place(); });
  addEventListener("resize", place);

  const sections = new Map(links.filter((a) => a.hash && a.pathname === location.pathname).map((a) => [a.hash.slice(1), a]));
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const a = sections.get(e.target.id);
      if (e.isIntersecting) active = a;
      else if (active === a) active = null;
    }
    place();
  }, { rootMargin: "-40% 0px -55% 0px" });
  sections.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  place();

  // Apple's spring parameters: response (s) and damping ratio, mass 1.
  function spring(response = 0.38, damping = 0.78) {
    const k = (2 * Math.PI / response) ** 2, c = 4 * Math.PI * damping / response;
    return {
      x: 0, v: 0, to: 0,
      step(dt) { this.v += (-k * (this.x - this.to) - c * this.v) * dt; this.x += this.v * dt; },
      jump() { this.x = this.to; this.v = 0; },
      settled() { return Math.abs(this.x - this.to) < 0.1 && Math.abs(this.v) < 1; },
    };
  }

  // Displacement map for a rounded rectangle of glass: flat in the middle, the
  // surface curving down over the last `rim` px, so the backdrop bends most at
  // the edge and is pulled in from further inside (a convex lens). Red/green
  // hold the x/y offset around 128.
  function refractionMap(w, h, r, rim) {
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d"), img = ctx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + 0.5, py = y + 0.5;
        const dx = px - Math.min(Math.max(px, r), w - r), dy = py - Math.min(Math.max(py, r), h - r);
        const dist = Math.hypot(dx, dy);
        const t = Math.min(Math.max((r - dist) / rim, 0), 1);
        const bend = dist ? (1 - t) ** 2.4 / dist : 0;
        const i = (y * w + x) * 4;
        d[i] = 128 - dx * bend * 127; d[i + 1] = 128 - dy * bend * 127; d[i + 2] = 128; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }
})();
