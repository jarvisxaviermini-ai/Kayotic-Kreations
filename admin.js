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

function renderField(key, item, index, field) {
  const value = item[field] || "";

  if (field === "description" || field === "alt") {
    return `<textarea data-repeat="${key}" data-index="${index}" data-field="${field}" rows="3">${value}</textarea>`;
  }

  if (["heroSlides", "gallery"].includes(key) && field === "image") {
    const uploadId = `${key}-upload-${index}`;
    const uploadLabel = key === "heroSlides" ? "Upload hero photo" : "Upload portfolio photo";

    return `
      <input data-repeat="${key}" data-index="${index}" data-field="${field}" value="${value}" placeholder="Paste an image URL or upload a file">
      <div class="upload-row">
        <input class="image-upload-input" id="${uploadId}" type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-upload="${key}" data-index="${index}" data-field="${field}">
        <label class="upload-button" for="${uploadId}">${uploadLabel}</label>
      </div>
      ${value ? `<img class="image-preview" src="${value}" alt="">` : ""}
    `;
  }

  return `<input data-repeat="${key}" data-index="${index}" data-field="${field}" value="${value}">`;
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
            <div class="repeat-field">
              <span>${field}</span>
              ${renderField(key, item, index, field)}
            </div>
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

async function uploadImage(field) {
  const file = field.files?.[0];
  if (!file) return;

  setStatus("Uploading image...");
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    setStatus("Upload failed");
    return;
  }

  const result = await response.json();
  const key = field.dataset.upload;
  const index = Number(field.dataset.index);
  const prop = field.dataset.field;
  content[key][index][prop] = result.url;
  renderRepeatList(key);
  setStatus("Image uploaded. Save changes to publish it.");
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
    if (event.target.matches("input:not([type='file']), textarea")) setStatus("Unsaved changes");
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-upload]")) uploadImage(event.target);
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
