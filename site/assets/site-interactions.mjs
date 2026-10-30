/** Shared, dependency-free public interactions for Next.js and static previews. */
export function mountPublicInteractions(root = document) {
  const cleanups = [];
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  for (const album of root.querySelectorAll("[data-vinyl-album]")) {
    const stage = album.querySelector("[data-vinyl-stage]"),
      rotation = album.querySelector("[data-vinyl-rotation]"),
      button = album.querySelector("[data-vinyl-toggle]"),
      label = album.querySelector("[data-vinyl-button-label]");
    if (!stage || !rotation || !button || !label) continue;
    const controller = new AbortController();
    const signal = controller.signal;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
    let hovered = false,
      manual = false,
      pauseOverride = false,
      visible = true,
      target = 0,
      speed = 0,
      angle = 0,
      frame = 0,
      last = 0;
    const tick = (time) => {
      frame = 0;
      const delta = last ? Math.min(time - last, 64) : 16;
      last = time;
      speed += (target - speed) * (1 - Math.exp(-delta / 220));
      angle = (angle + (speed * delta) / 1000) % 360;
      rotation.style.transform = `rotate(${angle}deg)`;
      if (target || Math.abs(speed) > 0.03) frame = requestAnimationFrame(tick);
      else {
        speed = 0;
        last = 0;
      }
    };
    const update = () => {
      const reduced = motion.matches;
      const playing =
        !reduced &&
        visible &&
        !document.hidden &&
        (manual || (hovered && !pauseOverride));
      target = playing ? 32 : 0;
      album.dataset.playing = String(playing);
      album.dataset.reducedMotion = String(reduced);
      button.disabled = reduced;
      button.setAttribute("aria-pressed", String(playing));
      button.setAttribute(
        "aria-label",
        reduced
          ? "Rotação desativada por sua preferência de movimento reduzido"
          : playing
            ? "Pausar rotação do vinil"
            : "Iniciar rotação do vinil",
      );
      label.textContent = reduced
        ? "Movimento reduzido"
        : playing
          ? "Pausar vinil"
          : "Girar vinil";
      if (reduced || document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        speed = 0;
        last = 0;
      } else if ((target || speed) && !frame)
        frame = requestAnimationFrame(tick);
    };
    stage.addEventListener(
      "pointerenter",
      () => {
        if (canHover.matches) {
          hovered = true;
          pauseOverride = false;
          update();
        }
      },
      { signal },
    );
    stage.addEventListener(
      "pointerleave",
      () => {
        if (canHover.matches) {
          hovered = false;
          manual = false;
          pauseOverride = false;
          update();
        }
      },
      { signal },
    );
    button.addEventListener(
      "click",
      () => {
        if (motion.matches) return;
        const playing = album.dataset.playing === "true";
        manual = !playing;
        pauseOverride = playing;
        update();
      },
      { signal },
    );
    album.addEventListener(
      "focusout",
      (event) => {
        if (!album.contains(event.relatedTarget)) {
          manual = false;
          update();
        }
      },
      { signal },
    );
    document.addEventListener("visibilitychange", update, { signal });
    motion.addEventListener("change", update, { signal });
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (entries) => {
              visible = entries[0].isIntersecting;
              update();
            },
            { threshold: 0.05 },
          )
        : null;
    observer?.observe(album);
    update();
    cleanups.push(() => {
      controller.abort();
      observer?.disconnect();
      cancelAnimationFrame(frame);
      rotation.style.removeProperty("transform");
      album.dataset.playing = "false";
    });
  }
  // Content stays visible without JS. Reduced-motion users never get hidden text.
  const selector = [
    ".hero-copy h1", ".hero-copy>p", ".page-hero h1", ".page-hero>p",
    ".section h2", ".section-heading .section-index", ".section .eyebrow",
    ".section .large-copy", ".section .intro-note", ".essence-grid>div>p",
    ".manifesto-band h2", ".manifesto-band>div", ".manifesto-band>.eyebrow",
    ".service-card", ".article-card", ".featured-project", ".service-detail",
    ".partnership-band h2", ".partnership-band p", ".contact-section h2",
    ".values-grid>div", ".project-detail>div", ".prose>p", ".prose>h2",
    ".manifesto-page p", ".art", ".uploaded-cover", ".article-hero",
    ".about-ghost", ".secondary-mascot", ".giant-asterisk",
  ].join(",");
  // Animate a card as one unit; avoid stacking transforms on its child artwork.
  const targets = [...root.querySelectorAll(selector)].filter((node) =>
    !node.parentElement?.closest(".service-card,.article-card,.featured-project,.values-grid>div,.project-detail>div"),
  );
  const groups = new WeakMap();
  const kindOf = (node) =>
    node.matches(".about-ghost,.secondary-mascot,.giant-asterisk") ? "accent" :
    node.matches("h1,h2") ? "title" :
    node.matches(".art,.uploaded-cover,.article-hero") ? "image" :
    node.matches(".service-card,.article-card,.featured-project,.service-detail,.values-grid>div,.project-detail>div") ? "card" :
    node.matches(".eyebrow,.section-index,.large-copy,.page-hero>p,.hero-copy>p") ? "subtitle" : "content";
  let revealObserver;
  const reveal = (node) => {
    node.classList.remove("reveal-pending");
    node.classList.add("reveal-visible");
    revealObserver?.unobserve(node);
  };
  if (!motion.matches && "IntersectionObserver" in window) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) reveal(entry.target);
      },
      { threshold: 0, rootMargin: "0px 0px -20px 0px" },
    );
    for (const node of targets) {
      const kind = kindOf(node);
      const group = node.parentElement;
      const index = groups.get(group) || 0;
      groups.set(group, index + 1);
      node.dataset.revealKind = kind;
      const delay = kind === "title" ? 0 : kind === "card" ? Math.min(index * 65, 195) : Math.min(index * 45, 135);
      node.style.setProperty("--reveal-delay", `${delay}ms`);
      node.classList.add("reveal-ready", "reveal-pending");
      revealObserver.observe(node);
    }
  }
  const onMotion = () => {
    if (motion.matches) {
      revealObserver?.disconnect();
      targets.forEach(reveal);
    }
  };
  const onFocus = (event) => {
    const node = event.target.closest?.(".reveal-pending");
    if (node) reveal(node);
  };
  const showAll = () => targets.forEach(reveal);
  // Printing must include content that has not yet been scrolled into view.
  window.addEventListener("beforeprint", showAll);
  motion.addEventListener("change", onMotion);
  root.addEventListener("focusin", onFocus);
  cleanups.push(() => {
    revealObserver?.disconnect();
    motion.removeEventListener("change", onMotion);
    root.removeEventListener("focusin", onFocus);
    window.removeEventListener("beforeprint", showAll);
    for (const node of targets) {
      node.classList.remove("reveal-ready", "reveal-pending", "reveal-visible");
      node.style.removeProperty("--reveal-delay");
      delete node.dataset.revealKind;
    }
  });
  // Keep the floating contact clear of content and interactive controls.
  const floating = root.querySelector(".whatsapp-float");
  if (floating && "IntersectionObserver" in window) {
    let clearanceObserver,
      resizeFrame = 0;
    const blocked = new Set();
    const refreshClearance = () => {
      clearanceObserver?.disconnect();
      blocked.clear();
      floating.dataset.obscured = "false";
      const r = floating.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const margins = [
        -r.top,
        -(innerWidth - r.right),
        -(innerHeight - r.bottom),
        -r.left,
      ]
        .map((x) => x + "px")
        .join(" ");
      clearanceObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (
              e.isIntersecting &&
              e.intersectionRect.width > 0 &&
              e.intersectionRect.height > 0
            )
              blocked.add(e.target);
            else blocked.delete(e.target);
          }
          floating.dataset.obscured = String(blocked.size > 0);
        },
        { rootMargin: margins, threshold: 0 },
      );
      for (const node of root.querySelectorAll(
        "main h1,main h2,main h3,main p,main .button,main button,main input,main textarea,main select,main .text-link,main summary,.footer-links a",
      ))
        clearanceObserver.observe(node);
    };
    const resize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(refreshClearance);
    };
    refreshClearance();
    window.addEventListener("resize", resize);
    cleanups.push(() => {
      clearanceObserver?.disconnect();
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(resizeFrame);
      floating.removeAttribute("data-obscured");
    });
  }
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
