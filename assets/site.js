// Reveal sections as they enter the viewport, and show the nav hairline once
// the page has scrolled. IntersectionObserver only: no scroll listeners.
(() => {
  const items = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("in");
      reveal.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  items.forEach((el) => reveal.observe(el));

  const nav = document.getElementById("nav");
  const hero = document.querySelector(".hero, main");
  if (nav && hero) {
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:8px;height:1px;width:1px;pointer-events:none";
    document.body.prepend(sentinel);
    new IntersectionObserver(([entry]) => nav.classList.toggle("scrolled", !entry.isIntersecting)).observe(sentinel);
  }
})();
