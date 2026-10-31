/* Isolated preview navigation. No file APIs, network calls, storage or product routing. */
(() => {
  const variants = new Set(["minimal", "editorial", "workspace"]);
  const screens = new Set(["home", "tool", "result", "account"]);
  const params = new URLSearchParams(location.search);
  let variant = variants.has(params.get("variant")) ? params.get("variant") : "minimal";
  let screen = screens.has(params.get("view")) ? params.get("view") : "home";
  let theme = params.get("theme") === "dark" ? "dark" : "light";

  const prototype = document.getElementById("prototype");
  const content = document.getElementById("preview-content");

  function render({ moveFocus = false } = {}) {
    prototype.dataset.variant = variant;
    document.documentElement.dataset.theme = theme;
    for (const button of document.querySelectorAll("[data-variant-choice]")) {
      button.setAttribute("aria-pressed", String(button.dataset.variantChoice === variant));
    }
    for (const button of document.querySelectorAll("[data-screen-choice]")) {
      const selected = button.dataset.screenChoice === screen;
      button.setAttribute("aria-pressed", String(selected));
      if (button.closest(".rail-links")) {
        if (selected) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    }
    for (const section of document.querySelectorAll("[data-screen]")) {
      section.hidden = section.dataset.screen !== screen;
    }
    const themeButton = document.querySelector("[data-theme-toggle]");
    themeButton.textContent = "Tema: " + (theme === "light" ? "chiaro" : "scuro");
    themeButton.setAttribute("aria-label", "Passa al tema " + (theme === "light" ? "scuro" : "chiaro"));
    themeButton.setAttribute("aria-pressed", String(theme === "dark"));
    const themeValue = document.querySelector("[data-current-theme]");
    themeValue.textContent = theme === "light" ? "Chiaro" : "Scuro";

    const next = new URL(location.href);
    next.searchParams.set("variant", variant);
    next.searchParams.set("view", screen);
    next.searchParams.set("theme", theme);
    history.replaceState(null, "", next);
    document.querySelector("[data-home-link]").href = next.pathname + "?variant=" + variant + "&view=home&theme=" + theme;
    if (moveFocus) {
      content.focus({ preventScroll: true });
      content.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  for (const button of document.querySelectorAll("[data-variant-choice]")) {
    button.addEventListener("click", () => {
      variant = button.dataset.variantChoice;
      render();
    });
  }
  for (const button of document.querySelectorAll("[data-screen-choice]")) {
    button.addEventListener("click", () => {
      screen = button.dataset.screenChoice;
      render();
    });
  }
  for (const button of document.querySelectorAll("[data-next-screen]")) {
    button.addEventListener("click", () => {
      screen = button.dataset.nextScreen;
      render({ moveFocus: true });
    });
  }
  document.querySelector("[data-home-link]").addEventListener("click", (event) => {
    event.preventDefault();
    screen = "home";
    render({ moveFocus: true });
  });
  document.querySelector("[data-theme-toggle]").addEventListener("click", () => {
    theme = theme === "light" ? "dark" : "light";
    render();
  });
  render();
})();
