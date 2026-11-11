/* Isolated owner-choice preview: UI-only navigation, no file, account or network APIs. */
(() => {
  const variants = new Set(["guide", "path"]);
  const views = new Set(["resources", "error"]);
  const examples = {
    empty: ["–", "In attesa di un file", "Non hai ancora selezionato un file. Scegline uno per iniziare, quando usi lo strumento reale."],
    loading: ["…", "Elaborazione in corso", "Attendi il completamento. Nessun risultato è ancora disponibile."],
    cancelled: ["×", "Operazione annullata", "Nessun risultato è stato prodotto. Puoi correggere la selezione e riprovare."],
    error: ["!", "Archivio non leggibile", "Non è stato possibile verificare lo ZIP. Controlla che il file sia completo e riprova."],
    success: ["✓", "Elaborazione completata", "Esempio di conferma che apparirebbe solo dopo una vera elaborazione. Qui nessun file è stato prodotto."],
  };
  const query = new URLSearchParams(location.search);
  let variant = variants.has(query.get("variant")) ? query.get("variant") : "guide";
  let view = views.has(query.get("view")) ? query.get("view") : "resources";
  let state = "error";
  const prototype = document.querySelector("#prototype");
  const main = document.querySelector("#preview-main");

  function render({ moveFocus = false } = {}) {
    prototype.dataset.variant = variant;
    document.querySelectorAll("[data-variant-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.variantChoice === variant));
    });
    document.querySelectorAll("[data-view-choice]").forEach((button) => {
      const selected = button.dataset.viewChoice === view;
      if (button.closest(".side-nav")) {
        if (selected) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      } else button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-view]").forEach((screen) => {
      screen.hidden = screen.dataset.view !== view;
    });
    document.querySelectorAll("[data-state-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.stateChoice === state));
    });
    const [glyph, title, description] = examples[state];
    const result = document.querySelector(".status-result");
    result.dataset.state = state;
    result.querySelector(".status-glyph").textContent = glyph;
    result.querySelector("[data-state-title]").textContent = title;
    result.querySelector("[data-state-description]").textContent = description;

    const next = new URL(location.href);
    next.searchParams.set("variant", variant);
    next.searchParams.set("view", view);
    history.replaceState(null, "", next);
    document.querySelector("[data-home-link]").href = `?variant=${variant}&view=resources`;
    if (moveFocus) {
      main.focus({ preventScroll: true });
      main.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  document.querySelectorAll("[data-variant-choice]").forEach((button) => {
    button.addEventListener("click", () => { variant = button.dataset.variantChoice; render(); });
  });
  document.querySelectorAll("[data-view-choice]").forEach((button) => {
    button.addEventListener("click", () => { view = button.dataset.viewChoice; render(); });
  });
  document.querySelectorAll("[data-next-view]").forEach((button) => {
    button.addEventListener("click", () => { view = button.dataset.nextView; render({ moveFocus: true }); });
  });
  document.querySelectorAll("[data-state-choice]").forEach((button) => {
    button.addEventListener("click", () => { state = button.dataset.stateChoice; render(); });
  });
  document.querySelector("[data-home-link]").addEventListener("click", (event) => {
    event.preventDefault(); view = "resources"; render({ moveFocus: true });
  });
  render();
})();
