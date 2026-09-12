const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzFpYLNWXgjLO-27Txb2E-Qi3sLSy2WcEpmnhKvq_oYdA9sbK24NbzIQ-Fu20n-X6uapw/exec";

let html5QrcodeScanner;
let isProcessing = false;

/* -----------------------------------------------------------
   Theme
----------------------------------------------------------- */
const THEME_KEY = "decrypt-theme";
const themeToggle = document.getElementById("theme-toggle");

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeToggle.setAttribute("aria-pressed", theme === "light");
  themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
    return;
  }
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(prefersLight ? "light" : "dark");
}

themeToggle.addEventListener("click", () => {
  const next = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

initTheme();

/* -----------------------------------------------------------
   Icons for the result sheet
----------------------------------------------------------- */
const ICONS = {
  success: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 8.5v5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.7" r="1.1" fill="currentColor"/><path d="M10.6 3.9a1.6 1.6 0 0 1 2.8 0l8.2 14.6a1.6 1.6 0 0 1-1.4 2.4H3.8a1.6 1.6 0 0 1-1.4-2.4L10.6 3.9Z" stroke="currentColor" stroke-width="2"/></svg>`,
  danger: `<svg viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`
};

/* -----------------------------------------------------------
   Scanner
----------------------------------------------------------- */
const viewfinder = document.getElementById("viewfinder");
const statusRow = document.querySelector(".status-row");
const statusText = document.getElementById("scanner-status");

function setStatus(text, busy) {
  statusText.textContent = text;
  statusRow.classList.toggle("is-busy", !!busy);
}

function initScanner() {
  html5QrcodeScanner = new Html5Qrcode("reader");

  const config = {
    fps: 10,
    qrbox: { width: 220, height: 220 },
    aspectRatio: 1.0
  };

  html5QrcodeScanner.start(
    { facingMode: "environment" },
    config,
    onScanSuccess
  ).catch(() => {
    setStatus("Camera access denied or unavailable", false);
  });
}

async function onScanSuccess(decodedText) {
  if (isProcessing) return;
  isProcessing = true;

  html5QrcodeScanner.pause();
  viewfinder.classList.add("is-paused");
  setStatus("Verifying with database…", true);

  try {
    const response = await fetch(`${SCRIPT_URL}?action=checkin&code=${encodeURIComponent(decodedText)}`);
    const data = await response.json();
    displayResult(data, decodedText);
  } catch (error) {
    displayResult({ status: "error", message: "Network error or script timeout." }, decodedText);
  }
}

/* -----------------------------------------------------------
   Result sheet
----------------------------------------------------------- */
const sheet = document.getElementById("result-sheet");
const backdrop = document.getElementById("sheet-backdrop");
const sheetIcon = document.getElementById("sheet-icon");
const resTitle = document.getElementById("res-title");
const resSubtitle = document.getElementById("res-subtitle");
const resName = document.getElementById("res-name");
const resCode = document.getElementById("res-code");
const resTrack = document.getElementById("res-track");
const resTime = document.getElementById("res-time");
const btnReset = document.getElementById("btn-reset");

function openSheet(kind, { title, subtitle, name, code, track, time }) {
  sheetIcon.className = `sheet-icon ${kind}`;
  sheetIcon.innerHTML = ICONS[kind];

  resTitle.textContent = title;
  resSubtitle.textContent = subtitle || "";
  resName.textContent = name;
  resCode.textContent = code;
  resTrack.textContent = track;
  resTime.textContent = time;

  sheet.classList.add("is-open");
  sheet.setAttribute("aria-hidden", "false");
  backdrop.classList.add("is-visible");
  backdrop.setAttribute("aria-hidden", "false");
}

function closeSheet() {
  sheet.classList.remove("is-open");
  sheet.setAttribute("aria-hidden", "true");
  backdrop.classList.remove("is-visible");
  backdrop.setAttribute("aria-hidden", "true");
}

function displayResult(data, scannedCode) {
  if (data.status === "success") {
    openSheet("success", {
      title: "Access granted",
      subtitle: "Attendee checked in successfully.",
      name: data.name,
      code: data.code,
      track: data.track,
      time: data.time
    });
    setStatus("Check-in complete", false);

  } else if (data.status === "already_checked_in") {
    openSheet("warning", {
      title: "Already checked in",
      subtitle: "This code has already been used.",
      name: data.name,
      code: data.code,
      track: data.track,
      time: `Previously at ${data.time}`
    });
    setStatus("Attendee was already checked in", false);

  } else if (data.status === "not_found") {
    openSheet("danger", {
      title: "Invalid code",
      subtitle: "This code isn't in the database.",
      name: "Not found",
      code: scannedCode,
      track: "—",
      time: "—"
    });
    setStatus("Unregistered access code", false);

  } else {
    openSheet("danger", {
      title: "System error",
      subtitle: data.message || "Unable to verify this code.",
      name: "—",
      code: scannedCode,
      track: "—",
      time: "—"
    });
    setStatus("Something went wrong — try again", false);
  }
}

function resetScanner() {
  closeSheet();
  viewfinder.classList.remove("is-paused");
  setStatus("Align a code inside the frame", false);
  isProcessing = false;
  html5QrcodeScanner.resume();
}

btnReset.addEventListener("click", resetScanner);
backdrop.addEventListener("click", resetScanner);

// Start scanner on load
window.addEventListener("DOMContentLoaded", initScanner);


/* -----------------------------------------------------------
   Tab Routing & Scanner Control
----------------------------------------------------------- */
const tabScan = document.getElementById('tab-scan');
const tabSearch = document.getElementById('tab-search');
const viewScan = document.getElementById('view-scan');
const viewSearch = document.getElementById('view-search');

tabScan.addEventListener('click', () => {
  tabScan.classList.add('is-active');
  tabSearch.classList.remove('is-active');
  viewScan.classList.remove('is-hidden');
  viewSearch.classList.add('is-hidden');
  
  if (html5QrcodeScanner && html5QrcodeScanner.getState() === Html5QrcodeScannerState.PAUSED && !isProcessing) {
    html5QrcodeScanner.resume();
  }
});

tabSearch.addEventListener('click', () => {
  tabSearch.classList.add('is-active');
  tabScan.classList.remove('is-active');
  viewSearch.classList.remove('is-hidden');
  viewScan.classList.add('is-hidden');
  
  if (html5QrcodeScanner && html5QrcodeScanner.getState() === Html5QrcodeScannerState.SCANNING) {
    html5QrcodeScanner.pause();
  }
});

/* -----------------------------------------------------------
   Manual Search Logic
----------------------------------------------------------- */
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  searchBtn.disabled = true;
  searchBtn.innerText = "Wait...";
  searchResults.innerHTML = `<p style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 20px;">Querying database...</p>`;

  try {
    // Requires GET to read the JSON response seamlessly
    const res = await fetch(`${SCRIPT_URL}?action=search&query=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.status === "success") {
      renderSearchResults(data.results);
    } else {
      searchResults.innerHTML = `<p style="text-align: center; color: var(--danger); font-size: 0.85rem; padding: 20px;">Error: ${data.message}</p>`;
    }
  } catch (err) {
    searchResults.innerHTML = `<p style="text-align: center; color: var(--danger); font-size: 0.85rem; padding: 20px;">Network error. Try again.</p>`;
  } finally {
    searchBtn.disabled = false;
    searchBtn.innerText = "Find";
  }
});

function renderSearchResults(results) {
  if (results.length === 0) {
    searchResults.innerHTML = `<p style="text-align: center; color: var(--text-tertiary); font-size: 0.85rem; padding: 20px;">No attendees found for this query.</p>`;
    return;
  }

  searchResults.innerHTML = results.map(user => `
    <div class="result-card">
      <div class="result-card-header">
        <div>
          <h3 class="result-card-title">${user.name}</h3>
          <p class="result-card-sub mono">${user.code} • ${user.track}</p>
          <p class="result-card-sub" style="margin-top:2px;">${user.email}</p>
        </div>
        ${user.status === "CHECKED_IN" ? `<span class="badge-checked">✓ Verified</span>` : ``}
      </div>
      ${user.status !== "CHECKED_IN" 
        ? `<button class="btn-primary btn-sm" onclick="triggerManualCheckIn('${user.code}')">Verify & Check In</button>` 
        : `<button class="btn-primary btn-sm" style="background: var(--surface-3); color: var(--text-tertiary);" disabled>Already Checked In</button>`
      }
    </div>
  `).join('');
}

// Routes manual check-in through the exact same verification endpoint as the camera
window.triggerManualCheckIn = async function(code) {
  if (isProcessing) return;
  isProcessing = true;

  // Jump back to scanner view visually so the standard Result Sheet overlays properly
  tabScan.click();
  setStatus("Verifying manual entry...", true);

  try {
    const response = await fetch(`${SCRIPT_URL}?action=checkin&code=${encodeURIComponent(code)}`);
    const data = await response.json();
    
    // Call your existing scanner result handler
    processCheckInResult(data, code); 

  } catch (error) {
    processCheckInResult({ status: 'error', message: 'Network error or timeout.' }, code);
  }
};

// Refactored from your original onScanSuccess to share logic
function processCheckInResult(data, scannedCode) {
  if (data.status === "success") {
    openSheet("success", {
      title: "Access granted",
      subtitle: "Attendee checked in successfully.",
      name: data.name,
      code: data.code,
      track: data.track,
      time: data.time
    });
    setStatus("Check-in complete", false);

  } else if (data.status === "already_checked_in") {
    openSheet("warning", {
      title: "Already checked in",
      subtitle: "This code has already been used.",
      name: data.name,
      code: data.code,
      track: data.track,
      time: `Previously at ${data.time}`
    });
    setStatus("Attendee was already checked in", false);

  } else if (data.status === "not_found") {
    openSheet("danger", {
      title: "Invalid code",
      subtitle: "This code isn't in the database.",
      name: "Not found",
      code: scannedCode,
      track: "—",
      time: "—"
    });
    setStatus("Unregistered access code", false);

  } else {
    openSheet("danger", {
      title: "System error",
      subtitle: data.message || "Unable to verify this code.",
      name: "—",
      code: scannedCode,
      track: "—",
      time: "—"
    });
    setStatus("Something went wrong — try again", false);
  }
}

// Update your onScanSuccess to use the shared handler
async function onScanSuccess(decodedText) {
  if (isProcessing) return;
  isProcessing = true;

  html5QrcodeScanner.pause();
  viewfinder.classList.add("is-paused");
  setStatus("Verifying code with database...", true);

  try {
    const response = await fetch(`${SCRIPT_URL}?action=checkin&code=${encodeURIComponent(decodedText)}`);
    const data = await response.json();
    processCheckInResult(data, decodedText);
  } catch (error) {
    processCheckInResult({ status: 'error', message: 'Network error or timeout.' }, decodedText);
  }
}