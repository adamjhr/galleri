Auth.requireAuth();

if (Auth.isAdmin()) {
  document.getElementById("admin-link").classList.remove("hidden");
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  await Auth.logout();
  location.replace("/login.html");
});

DateField.init("up");
DateField.init("lb-edit");

// ── Gallery ────────────────────────────────────────────────────────────────────

let images = [];
const _imageUrls = {};

// Returns a sortable string key and a separator label for an image.
// Precision hierarchy: year > month > week > day.
// Images are grouped and sorted by their most specific date component.
function _dateKey(img) {
  if (!img.date_value || !img.date_precision) return null;
  const d = img.date_value.slice(0, 10);
  const [year, month, day] = d.split("-").map(Number);
  if (img.date_precision === "year")  return `${year}`;
  if (img.date_precision === "month") return `${year}-${String(month).padStart(2, "0")}`;
  if (img.date_precision === "week") {
    // Key as "YYYY-MM-Wn" for sorting within month
    const firstOfMonth = new Date(year, month - 1, 1);
    const startOfWeek1 = new Date(firstOfMonth);
    startOfWeek1.setDate(1 - ((firstOfMonth.getDay() + 6) % 7));
    const storedDate = new Date(year, month - 1, day);
    const weekNum = Math.floor(Math.round((storedDate - startOfWeek1) / 86400000) / 7) + 1;
    return `${year}-${String(month).padStart(2, "0")}-W${weekNum}`;
  }
  return d; // day: "YYYY-MM-DD"
}

function _sortImages(imgs) {
  return [...imgs].sort((a, b) => {
    const ka = _dateKey(a);
    const kb = _dateKey(b);
    if (ka && kb) return kb.localeCompare(ka); // descending
    if (ka) return -1;  // dated before undated
    if (kb) return 1;
    return 0;
  });
}

function _separatorLabel(img) {
  return DateField.format(img.date_value, img.date_precision) || "Undated";
}

function _makeSeparator(label) {
  const el = document.createElement("div");
  el.className = "gallery-separator";
  el.textContent = label;
  return el;
}

function _makeTile(img, url) {
  const tile = document.createElement("div");
  tile.className = "gallery-tile";
  tile.dataset.id = img.id;
  tile.innerHTML = `<img src="${url}" alt="${escHtml(img.name)}" loading="lazy">
                    <p class="tile-name">${escHtml(img.name)}</p>`;
  tile.addEventListener("click", () => openLightbox(img, url));
  return tile;
}

async function loadGallery() {
  const raw = await API.get("/api/images");
  images = _sortImages(raw);

  const grid = document.getElementById("gallery");
  const empty = document.getElementById("empty-msg");
  grid.innerHTML = "";

  if (images.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  // Fetch all URLs first so we can render in sorted order without interleaving
  await Promise.all(images.map(async img => {
    if (!_imageUrls[img.id]) {
      const { url } = await API.get(`/api/images/${img.id}/url`);
      _imageUrls[img.id] = url;
    }
  }));

  let currentGroup = undefined;
  let currentRow = null;  // the grid row div for the current group

  for (const img of images) {
    const groupKey = _dateKey(img) ?? "__undated__";

    if (groupKey !== currentGroup) {
      // Close previous row and open new group
      grid.appendChild(_makeSeparator(_separatorLabel(img)));
      currentRow = document.createElement("div");
      currentRow.className = "gallery-row";
      grid.appendChild(currentRow);
      currentGroup = groupKey;
    }

    currentRow.appendChild(_makeTile(img, _imageUrls[img.id]));
  }
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ── Lightbox ───────────────────────────────────────────────────────────────────

let _activeImage = null;
let _activeIndex = -1;

function openLightbox(img, url) {
  _activeImage = img;
  _activeIndex = images.findIndex(i => i.id === img.id);
  document.getElementById("lb-img").src = url;
  document.getElementById("lb-name").textContent = img.name;
  document.getElementById("lb-desc").textContent = img.description || "";
  document.getElementById("lb-date").textContent = DateField.format(img.date_value, img.date_precision);
  document.getElementById("lb-download").href = url;
  document.getElementById("lb-download").target = "_blank";
  document.getElementById("lb-download").rel = "noopener noreferrer";

  const deleteBtn = document.getElementById("lb-delete");
  deleteBtn.classList.toggle("hidden", !Auth.isAdmin() && img.uploaded_by !== null);

  document.getElementById("lightbox").classList.remove("hidden");
}

async function navigateLightbox(delta) {
  exitEditMode();
  if (images.length === 0) return;
  const next = (_activeIndex + delta + images.length) % images.length;
  const img = images[next];
  if (!_imageUrls[img.id]) {
    const { url } = await API.get(`/api/images/${img.id}/url`);
    _imageUrls[img.id] = url;
  }
  openLightbox(img, _imageUrls[img.id]);
}

document.addEventListener("keydown", e => {
  const lb = document.getElementById("lightbox");
  if (lb.classList.contains("hidden")) return;
  if (e.key === "ArrowRight") navigateLightbox(1);
  else if (e.key === "ArrowLeft") navigateLightbox(-1);
  else if (e.key === "Escape") { lb.classList.add("hidden"); _activeImage = null; }
});

document.getElementById("lb-close").addEventListener("click", () => {
  document.getElementById("lightbox").classList.add("hidden");
  _activeImage = null;
});

document.getElementById("lightbox").addEventListener("click", e => {
  if (e.target === document.getElementById("lightbox")) {
    document.getElementById("lightbox").classList.add("hidden");
    _activeImage = null;
  }
});

document.getElementById("lb-delete").addEventListener("click", async () => {
  if (!_activeImage) return;
  if (!confirm(`Delete "${_activeImage.name}"?`)) return;
  await API.delete(`/api/images/${_activeImage.id}`);
  document.getElementById("lightbox").classList.add("hidden");
  loadGallery();
});

// ── Lightbox edit mode ─────────────────────────────────────────────────────────

function enterEditMode() {
  document.getElementById("lb-edit-name").value = _activeImage.name;
  document.getElementById("lb-edit-desc").value = _activeImage.description || "";
  DateField.set("lb-edit", _activeImage);
  document.getElementById("lb-edit-error").classList.add("hidden");
  document.getElementById("lb-view-mode").classList.add("hidden");
  document.getElementById("lb-edit-mode").classList.remove("hidden");
  document.getElementById("lb-edit-name").focus();
}

function exitEditMode() {
  document.getElementById("lb-edit-mode").classList.add("hidden");
  document.getElementById("lb-view-mode").classList.remove("hidden");
}

document.getElementById("lb-edit").addEventListener("click", () => {
  if (!_activeImage) return;
  enterEditMode();
});

document.getElementById("lb-cancel-edit").addEventListener("click", exitEditMode);

document.getElementById("lb-save").addEventListener("click", async () => {
  if (!_activeImage) return;
  const name = document.getElementById("lb-edit-name").value.trim();
  const description = document.getElementById("lb-edit-desc").value.trim();
  const { date_value, date_precision } = DateField.read("lb-edit");
  const err = document.getElementById("lb-edit-error");
  err.classList.add("hidden");

  try {
    const updated = await API.patch(`/api/images/${_activeImage.id}`, { name, description, date_value, date_precision });
    _activeImage = { ..._activeImage, name: updated.name, description: updated.description, date_value: updated.date_value, date_precision: updated.date_precision };
    // Update images array so navigation reflects the change
    const idx = images.findIndex(i => i.id === _activeImage.id);
    if (idx !== -1) images[idx] = { ...images[idx], ..._activeImage };
    document.getElementById("lb-name").textContent = updated.name;
    document.getElementById("lb-desc").textContent = updated.description || "";
    document.getElementById("lb-date").textContent = DateField.format(updated.date_value, updated.date_precision);
    const tile = document.querySelector(`.gallery-tile[data-id="${_activeImage.id}"] .tile-name`);
    if (tile) tile.textContent = updated.name;
    exitEditMode();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove("hidden");
  }
});

// ── Upload modal ───────────────────────────────────────────────────────────────

document.getElementById("upload-btn").addEventListener("click", () => {
  document.getElementById("upload-modal").classList.remove("hidden");
});

document.getElementById("up-file").addEventListener("change", () => {
  const count = document.getElementById("up-file").files.length;
  const el = document.getElementById("up-file-count");
  if (count > 1) {
    el.textContent = `${count} files selected`;
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
  }
});

function _resetUploadModal() {
  document.getElementById("upload-modal").classList.add("hidden");
  document.getElementById("upload-form").reset();
  document.getElementById("up-file-count").classList.add("hidden");
  DateField.reset("up");
  document.getElementById("up-error").classList.add("hidden");
}

document.getElementById("up-cancel").addEventListener("click", _resetUploadModal);

document.getElementById("upload-form").addEventListener("submit", async e => {
  e.preventDefault();
  const err = document.getElementById("up-error");
  const btn = document.getElementById("up-submit");
  err.classList.add("hidden");
  btn.disabled = true;

  const files = Array.from(document.getElementById("up-file").files);
  const name = document.getElementById("up-name").value;
  const description = document.getElementById("up-desc").value;
  const { date_value, date_precision } = DateField.read("up");

  btn.textContent = files.length > 1 ? `Uploading 0 / ${files.length}…` : "Uploading…";

  try {
    for (let i = 0; i < files.length; i++) {
      if (files.length > 1) btn.textContent = `Uploading ${i + 1} / ${files.length}…`;

      const fileBytes = await files[i].arrayBuffer();
      const blob = new Blob([fileBytes], { type: files[i].type || "application/octet-stream" });

      const fd = new FormData();
      fd.append("file", blob, files[i].name);
      fd.append("name", name);
      fd.append("description", description);
      if (date_value) fd.append("date_value", date_value);
      if (date_precision) fd.append("date_precision", date_precision);
      await API.postForm("/api/images", fd);
    }
    _resetUploadModal();
    await loadGallery();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Upload";
  }
});

loadGallery();
