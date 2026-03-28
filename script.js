const STORAGE_KEY = "wine-cellar-app";

const form = document.querySelector("#wine-form");
const wineList = document.querySelector("#wine-list");
const searchInput = document.querySelector("#search");
const filterType = document.querySelector("#filter-type");
const filterTag = document.querySelector("#filter-tag");
const template = document.querySelector("#wine-card-template");
const imageInput = document.querySelector("#image");
const imagePreview = document.querySelector("#image-preview");
const previewImage = document.querySelector("#preview-image");
const scanButton = document.querySelector("#scan-button");
const barcodeInput = document.querySelector("#barcode");
const scannerDialog = document.querySelector("#scanner-dialog");
const scannerVideo = document.querySelector("#scanner-video");
const scannerStatus = document.querySelector("#scanner-status");
const topCountry = document.querySelector("#top-country");
const topType = document.querySelector("#top-type");
const avgVintage = document.querySelector("#avg-vintage");
const countryBreakdown = document.querySelector("#country-breakdown");
const typeBreakdown = document.querySelector("#type-breakdown");
const drinkWindowBreakdown = document.querySelector("#drink-window-breakdown");

const totalBottles = document.querySelector("#total-bottles");
const totalWines = document.querySelector("#total-wines");
const drinkSoon = document.querySelector("#drink-soon");

let wines = loadWines();
let scannerStream = null;
let barcodeDetector = null;
let scanTimer = null;

form.addEventListener("submit", handleSubmit);
searchInput.addEventListener("input", render);
filterType.addEventListener("change", render);
filterTag.addEventListener("input", render);
wineList.addEventListener("click", handleListActions);
imageInput.addEventListener("change", handleImagePreview);
scanButton.addEventListener("click", handleScanButton);
scannerDialog.addEventListener("close", stopScanner);

render();

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(form);
  let image = "";

  try {
    image = await fileToDataUrl(imageInput.files?.[0]);
  } catch {
    image = "";
  }

  const wine = {
    id: crypto.randomUUID(),
    name: requiredString(formData.get("name")),
    producer: optionalString(formData.get("producer")),
    country: optionalString(formData.get("country")),
    region: optionalString(formData.get("region")),
    vintage: optionalNumber(formData.get("vintage")),
    quantity: Math.max(1, Number(formData.get("quantity")) || 1),
    type: optionalString(formData.get("type")) || "Rött",
    drinkBy: optionalNumber(formData.get("drinkBy")),
    barcode: optionalString(formData.get("barcode")),
    location: optionalString(formData.get("location")),
    tags: parseTags(formData.get("tags")),
    image,
    notes: optionalString(formData.get("notes")),
    createdAt: Date.now()
  };

  wines.unshift(wine);
  persist();
  form.reset();
  form.quantity.value = 1;
  form.type.value = "Rött";
  imagePreview.hidden = true;
  previewImage.removeAttribute("src");
  render();
}

function handleListActions(event) {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const card = button.closest("[data-id]");
  const wineId = card?.dataset.id;

  if (!wineId) {
    return;
  }

  if (button.dataset.action === "delete") {
    wines = wines.filter((wine) => wine.id !== wineId);
  }

  if (button.dataset.action === "decrement") {
    wines = wines
      .map((wine) => {
        if (wine.id !== wineId) {
          return wine;
        }

        return { ...wine, quantity: wine.quantity - 1 };
      })
      .filter((wine) => wine.quantity > 0);
  }

  persist();
  render();
}

function render() {
  const filteredWines = wines.filter(matchesFilters).sort(sortWines);

  totalBottles.textContent = String(
    wines.reduce((sum, wine) => sum + wine.quantity, 0)
  );
  totalWines.textContent = String(wines.length);
  drinkSoon.textContent = String(
    wines.filter((wine) => shouldDrinkSoon(wine.drinkBy)).reduce((sum, wine) => sum + wine.quantity, 0)
  );
  renderStatistics();

  wineList.innerHTML = "";

  if (filteredWines.length === 0) {
    wineList.innerHTML =
      '<p class="empty-state">Inga viner matchar just nu. Lägg till en flaska eller ändra filtret.</p>';
    return;
  }

  for (const wine of filteredWines) {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".wine-card");
    const details = fragment.querySelector(".wine-details");
    const tags = fragment.querySelector(".tag-list");
    const visual = fragment.querySelector(".wine-visual");
    const image = fragment.querySelector(".wine-image");

    card.dataset.id = wine.id;
    fragment.querySelector(".wine-type").textContent = wine.type;
    fragment.querySelector(".wine-name").textContent = wine.name;
    fragment.querySelector(".wine-meta").textContent = buildMeta(wine);
    fragment.querySelector(".quantity-badge").textContent = `${wine.quantity} st`;
    fragment.querySelector(".wine-notes").textContent =
      wine.notes || "Ingen anteckning ännu.";

    if (wine.image) {
      visual.hidden = false;
      image.src = wine.image;
    }

    if (wine.tags.length > 0) {
      for (const tag of wine.tags) {
        const pill = document.createElement("span");
        pill.className = "tag";
        pill.textContent = tag;
        tags.append(pill);
      }
    }

    for (const [label, value] of [
      ["Producent", wine.producer],
      ["Årgång", wine.vintage],
      ["Region", joinValues(wine.country, wine.region)],
      ["Streckkod", wine.barcode],
      ["Plats", wine.location],
      ["Drick senast", wine.drinkBy]
    ]) {
      if (!value) {
        continue;
      }

      const wrapper = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = String(value);
      wrapper.append(dt, dd);
      details.append(wrapper);
    }

    wineList.append(card);
  }
}

function matchesFilters(wine) {
  const search = searchInput.value.trim().toLowerCase();
  const matchesSearch =
    search.length === 0 ||
    [wine.name, wine.producer, wine.region, wine.country, wine.location, wine.barcode, ...wine.tags]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(search));

  const selectedType = filterType.value;
  const matchesType = selectedType === "Alla" || wine.type === selectedType;
  const selectedTag = filterTag.value.trim().toLowerCase();
  const matchesTag =
    selectedTag.length === 0 ||
    wine.tags.some((tag) => tag.toLowerCase().includes(selectedTag));

  return matchesSearch && matchesType && matchesTag;
}

function sortWines(a, b) {
  if (a.drinkBy && b.drinkBy) {
    return a.drinkBy - b.drinkBy;
  }

  if (a.drinkBy) {
    return -1;
  }

  if (b.drinkBy) {
    return 1;
  }

  return b.createdAt - a.createdAt;
}

function buildMeta(wine) {
  return [
    wine.producer,
    wine.vintage,
    joinValues(wine.country, wine.region),
    wine.barcode ? `Kod ${wine.barcode}` : ""
  ]
    .filter(Boolean)
    .join(" • ") || "Lägg gärna till mer info";
}

function joinValues(...values) {
  return values.filter(Boolean).join(", ");
}

function shouldDrinkSoon(drinkBy) {
  if (!drinkBy) {
    return false;
  }

  return drinkBy <= new Date().getFullYear() + 1;
}

function renderStatistics() {
  const byCountry = aggregateBy(wines, (wine) => wine.country || "Okänt");
  const byType = aggregateBy(wines, (wine) => wine.type || "Okänd");
  const byDrinkWindow = aggregateDrinkWindows(wines);
  const vintageValues = wines.map((wine) => wine.vintage).filter(Boolean);

  const topCountryEntry = byCountry[0];
  const topTypeEntry = byType[0];

  topCountry.textContent = topCountryEntry ? `${topCountryEntry.label} (${topCountryEntry.value})` : "Ingen data";
  topType.textContent = topTypeEntry ? `${topTypeEntry.label} (${topTypeEntry.value})` : "Ingen data";
  avgVintage.textContent = vintageValues.length > 0
    ? String(Math.round(vintageValues.reduce((sum, value) => sum + value, 0) / vintageValues.length))
    : "-";

  renderBreakdown(countryBreakdown, byCountry, "Ingen landstatistik ännu.");
  renderBreakdown(typeBreakdown, byType, "Ingen typstatistik ännu.");
  renderBreakdown(drinkWindowBreakdown, byDrinkWindow, "Ingen drickfönsterstatistik ännu.");
}

function aggregateBy(items, getLabel) {
  const totals = new Map();

  for (const item of items) {
    const label = getLabel(item);
    totals.set(label, (totals.get(label) || 0) + item.quantity);
  }

  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function aggregateDrinkWindows(items) {
  const currentYear = new Date().getFullYear();
  const buckets = new Map([
    ["Redo nu", 0],
    ["Inom 1 år", 0],
    ["2+ år kvar", 0],
    ["Ingen uppgift", 0]
  ]);

  for (const item of items) {
    if (!item.drinkBy) {
      buckets.set("Ingen uppgift", buckets.get("Ingen uppgift") + item.quantity);
      continue;
    }

    if (item.drinkBy <= currentYear) {
      buckets.set("Redo nu", buckets.get("Redo nu") + item.quantity);
      continue;
    }

    if (item.drinkBy <= currentYear + 1) {
      buckets.set("Inom 1 år", buckets.get("Inom 1 år") + item.quantity);
      continue;
    }

    buckets.set("2+ år kvar", buckets.get("2+ år kvar") + item.quantity);
  }

  return [...buckets.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter((entry) => entry.value > 0);
}

function renderBreakdown(container, entries, emptyText) {
  container.innerHTML = "";

  if (entries.length === 0) {
    container.innerHTML = `<p class="breakdown-empty">${emptyText}</p>`;
    return;
  }

  const maxValue = Math.max(...entries.map((entry) => entry.value), 1);

  for (const entry of entries) {
    const item = document.createElement("div");
    item.className = "breakdown-item";

    const label = document.createElement("div");
    label.className = "breakdown-label";

    const left = document.createElement("span");
    left.textContent = entry.label;

    const right = document.createElement("span");
    right.textContent = String(entry.value);

    label.append(left, right);

    const bar = document.createElement("div");
    bar.className = "breakdown-bar";

    const fill = document.createElement("div");
    fill.className = "breakdown-fill";
    fill.style.width = `${(entry.value / maxValue) * 100}%`;

    bar.append(fill);
    item.append(label, bar);
    container.append(item);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wines));
}

function loadWines() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return [];
  }

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.map(normalizeWine) : [];
  } catch {
    return [];
  }
}

function requiredString(value) {
  return String(value || "").trim();
}

function optionalString(value) {
  const normalized = String(value || "").trim();
  return normalized || "";
}

function optionalNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function normalizeWine(wine) {
  return {
    id: wine.id || crypto.randomUUID(),
    name: optionalString(wine.name),
    producer: optionalString(wine.producer),
    country: optionalString(wine.country),
    region: optionalString(wine.region),
    vintage: optionalNumber(wine.vintage),
    quantity: Math.max(1, Number(wine.quantity) || 1),
    type: optionalString(wine.type) || "Rött",
    drinkBy: optionalNumber(wine.drinkBy),
    barcode: optionalString(wine.barcode),
    location: optionalString(wine.location),
    tags: Array.isArray(wine.tags) ? wine.tags.map((tag) => optionalString(tag)).filter(Boolean) : [],
    image: optionalString(wine.image),
    notes: optionalString(wine.notes),
    createdAt: Number(wine.createdAt) || Date.now()
  };
}

function parseTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function fileToDataUrl(file) {
  if (!file) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Kunde inte läsa bilden."));
    reader.readAsDataURL(file);
  });
}

function handleImagePreview() {
  const file = imageInput.files?.[0];

  if (!file) {
    imagePreview.hidden = true;
    previewImage.removeAttribute("src");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    previewImage.src = String(reader.result);
    imagePreview.hidden = false;
  };
  reader.readAsDataURL(file);
}

async function handleScanButton() {
  if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
    scannerStatus.textContent = "Din webblasare saknar kameraskanning just nu. Skriv in streckkoden manuellt.";
    scannerDialog.showModal();
    return;
  }

  barcodeDetector = new window.BarcodeDetector({
    formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]
  });

  scannerDialog.showModal();
  scannerStatus.textContent = "Startar kamera...";

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });

    scannerVideo.srcObject = scannerStream;
    await scannerVideo.play();
    scannerStatus.textContent = "Letar efter streckkod...";
    scanLoop();
  } catch {
    scannerStatus.textContent = "Kunde inte starta kameran. Kontrollera kamerabehorighet eller skriv in koden manuellt.";
  }
}

async function scanLoop() {
  if (!barcodeDetector || !scannerVideo.srcObject) {
    return;
  }

  try {
    const codes = await barcodeDetector.detect(scannerVideo);
    const match = codes[0]?.rawValue;

    if (match) {
      barcodeInput.value = match;
      scannerStatus.textContent = `Hittade kod: ${match}`;
      scannerDialog.close();
      return;
    }
  } catch {
    scannerStatus.textContent = "Forsoker igen...";
  }

  scanTimer = window.setTimeout(scanLoop, 350);
}

function stopScanner() {
  if (scanTimer) {
    window.clearTimeout(scanTimer);
    scanTimer = null;
  }

  scannerVideo.pause();
  scannerVideo.srcObject = null;

  if (scannerStream) {
    for (const track of scannerStream.getTracks()) {
      track.stop();
    }

    scannerStream = null;
  }
}
