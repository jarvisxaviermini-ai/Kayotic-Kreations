let content = {};

const $ = (selector) => document.querySelector(selector);
const repeatFields = {
  stats: ["value", "label"],
  heroSlides: ["label", "image"],
  gallery: ["category", "title", "alt", "image"],
  services: ["number", "title", "description"],
};

function setStatus(message) {
  const status = $("#save-status");
  if (status) status.textContent = message;
}

async function fetchContent() {
  const response = await fetch("/api/content");
  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }
  if (!response.ok) throw new Error("Unable to load content");
  content = await response.json();
  renderForm();
}

function fillSimpleFields() {
  document.querySelectorAll("[name]").forEach((field) => {
    if (field.dataset.repeat) return;
    field.value = content[field.name] || "";
  });
}

function renderRepeatList(key) {
  const list = $(`#${key}-list`);
  if (!list) return;

  list.innerHTML = (content[key] || [])
    .map((item, index) => `
      <article class="repeat-card" data-key="${key}" data-index="${index}">
        <div class="repeat-card-head">
          <strong>${key} ${index + 1}</strong>
          <button class="remove-button" type="button" data-remove="${key}" data-index="${index}">Remove</button>
        </div>
        <div class="field-grid">
          ${repeatFields[key].map((field) => `
            <label>
              ${field}
              ${field === "description" || field === "alt" ? `<textarea data-repeat="${key}" data-index="${index}" data-field="${field}" rows="3">${item[field] || ""}</textarea>` : `<input data-repeat="${key}" data-index="${index}" data-field="${field}" value="${item[field] || ""}">`}
            </label>
          `).join("")}
        </div>
      </article>
    `)
    .join("");
}

function renderForm() {
  fillSimpleFields();
  Object.keys(repeatFields).forEach(renderRepeatList);
  setStatus("Ready");
}

function collectSimpleFields() {
  document.querySelectorAll("[name]").forEach((field) => {
    if (field.dataset.repeat) return;
    content[field.name] = field.value;
  });
}

function collectRepeatFields() {
  Object.keys(repeatFields).forEach((key) => {
    content[key] = content[key] || [];
  });

  document.querySelectorAll("[data-repeat]").forEach((field) => {
    const key = field.dataset.repeat;
    const index = Number(field.dataset.index);
    const prop = field.dataset.field;
    content[key][index][prop] = field.value;
  });
}

async function saveContent(event) {
  event.preventDefault();
  collectSimpleFields();
  collectRepeatFields();
  setStatus("Saving...");

  const response = await fetch("/api/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });

  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    setStatus("Save failed");
    return;
  }

  setStatus("Saved");
}

function addItem(key) {
  const defaults = {
    stats: { value: "New", label: "Statistic" },
    heroSlides: { label: "New slide", image: "" },
    gallery: { category: "New", title: "New image", alt: "", image: "" },
    services: { number: String((content.services || []).length + 1).padStart(2, "0"), title: "New service", description: "" },
  };

  content[key] = content[key] || [];
  content[key].push(defaults[key]);
  renderRepeatList(key);
  setStatus("Unsaved changes");
}

function removeItem(key, index) {
  content[key].splice(index, 1);
  renderRepeatList(key);
  setStatus("Unsaved changes");
}

function wireTabs() {
  document.querySelectorAll("[data-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-panel]").forEach((tab) => tab.classList.remove("is-active"));
      document.querySelectorAll(".editor-panel").forEach((panel) => panel.classList.remove("is-active"));
      button.classList.add("is-active");
      $(`#panel-${button.dataset.panel}`).classList.add("is-active");
    });
  });
}

function wireEvents() {
  $("#editor-form").addEventListener("submit", saveContent);
  $("#reset-button").addEventListener("click", fetchContent);

  document.addEventListener("input", (event) => {
    if (event.target.matches("input, textarea")) setStatus("Unsaved changes");
  });

  document.addEventListener("click", (event) => {
    const addKey = event.target.dataset.add;
    const removeKey = event.target.dataset.remove;
    if (addKey) addItem(addKey);
    if (removeKey) removeItem(removeKey, Number(event.target.dataset.index));
  });
}

wireTabs();
wireEvents();
fetchContent().catch(() => setStatus("Could not load content"));
