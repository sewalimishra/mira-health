let allPatients = [];
let deleteTargetId = null;

document.addEventListener("DOMContentLoaded", () => {
  loadPatients();
  bindEvents();
});

function bindEvents() {
  document.getElementById("btnAddNew").onclick   = () => openModal();
  document.getElementById("modalClose").onclick  = closeModal;
  document.getElementById("cancelBtn").onclick   = closeModal;
  document.getElementById("remarksClose").onclick = closeRemarks;
  document.getElementById("remarksOk").onclick    = closeRemarks;
  document.getElementById("deleteCancelBtn").onclick = closeDelete;
  document.getElementById("deleteConfirmBtn").onclick = confirmDelete;
  document.getElementById("patientForm").onsubmit = handleSubmit;

  let searchTimer;
  document.getElementById("searchInput").oninput = (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderTable(e.target.value), 300);
  };

  ["modalOverlay", "remarksOverlay", "deleteOverlay"].forEach(id => {
    document.getElementById(id).addEventListener("click", (e) => {
      if (e.target.id === id) {
        if (id === "modalOverlay")   closeModal();
        if (id === "remarksOverlay") closeRemarks();
        if (id === "deleteOverlay")  closeDelete();
      }
    });
  });
}

async function loadPatients() {
  try {
    const res  = await fetch("/api/patients");
    allPatients = await res.json();
    renderTable();
    updateStats();
  } catch {
    showToast("Failed to load patients.", "error");
  }
}

function renderTable(search = "") {
  const q = search.toLowerCase().trim();
  const filtered = q
    ? allPatients.filter(p => p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
    : allPatients;

  const tbody = document.getElementById("patientBody");
  document.getElementById("recordCount").textContent =
    `${filtered.length} record${filtered.length !== 1 ? "s" : ""}`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">${q ? "No matching patients found." : "No patients yet. Add one to get started."}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((p, i) => `
    <tr data-id="${p.id}">
      <td>${i + 1}</td>
      <td><div class="cell-name">${esc(p.full_name)}</div></td>
      <td>${formatDate(p.dob)}</td>
      <td><span class="cell-email">${esc(p.email)}</span></td>
      <td>${badge(p.glucose, 70, 100)}</td>
      <td>${badge(p.haemoglobin, 12, 17.5)}</td>
      <td>${badge(p.cholesterol, 0, 199)}</td>
      <td class="remarks-cell" title="Click to view full remarks" onclick="showRemarks('${esc(p.full_name)}','${escAttr(p.remarks || "")}')">${esc(p.remarks || "–")}</td>
      <td>
        <div class="actions">
          <button class="btn-icon" title="Edit" onclick="openModal(${p.id})">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
          </button>
          <button class="btn-icon danger" title="Delete" onclick="openDelete(${p.id},'${escAttr(p.full_name)}')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5.5 3.5V2h3v1.5M3.5 3.5l.7 8h5.6l.7-8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </td>
    </tr>`).join("");
}

function updateStats() {
  document.getElementById("totalCount").textContent = allPatients.length;
  const highGlucose = allPatients.filter(p => p.glucose > 100).length;
  document.getElementById("highRiskCount").textContent = highGlucose;
  if (allPatients.length) {
    const avg = allPatients.reduce((s, p) => s + p.cholesterol, 0) / allPatients.length;
    document.getElementById("avgCholesterol").textContent = avg.toFixed(0);
  }
}

function badge(val, lo, hi) {
  const v = parseFloat(val).toFixed(1);
  if (val < lo) return `<span class="badge badge-low">${v}</span>`;
  if (val > hi) return `<span class="badge badge-high">${v}</span>`;
  return `<span class="badge badge-normal">${v}</span>`;
}

async function openModal(id = null) {
  document.getElementById("patientForm").reset();
  document.getElementById("formErrors").style.display = "none";
  document.getElementById("patientId").value = "";

  if (id) {
    document.getElementById("modalTitle").textContent = "Edit Patient";
    document.getElementById("submitText").textContent = "Update Patient";
    try {
      const res = await fetch(`/api/patients/${id}`);
      const p   = await res.json();
      document.getElementById("patientId").value   = p.id;
      document.getElementById("fullName").value    = p.full_name;
      document.getElementById("dob").value         = p.dob;
      document.getElementById("email").value       = p.email;
      document.getElementById("glucose").value     = p.glucose;
      document.getElementById("haemoglobin").value = p.haemoglobin;
      document.getElementById("cholesterol").value = p.cholesterol;
    } catch { showToast("Failed to load patient.", "error"); return; }
  } else {
    document.getElementById("modalTitle").textContent = "Add Patient";
    document.getElementById("submitText").textContent = "Save Patient";
  }

  document.getElementById("modalOverlay").classList.add("open");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
}

async function handleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("patientId").value;
  const payload = {
    full_name:   document.getElementById("fullName").value.trim(),
    dob:         document.getElementById("dob").value,
    email:       document.getElementById("email").value.trim(),
    glucose:     document.getElementById("glucose").value,
    haemoglobin: document.getElementById("haemoglobin").value,
    cholesterol: document.getElementById("cholesterol").value,
  };

  setSubmitting(true);
  try {
    const url    = id ? `/api/patients/${id}` : "/api/patients";
    const method = id ? "PUT" : "POST";
    const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data   = await res.json();

    if (!res.ok) {
      showFormErrors(data.errors || [data.error || "An error occurred."]);
    } else {
      closeModal();
      showToast(data.message, "success");
      await loadPatients();
    }
  } catch {
    showFormErrors(["Network error. Please try again."]);
  }
  setSubmitting(false);
}

function setSubmitting(on) {
  document.getElementById("submitBtn").disabled = on;
  document.getElementById("submitSpinner").style.display = on ? "inline-block" : "none";
  document.getElementById("submitText").textContent = on ? "Analysing…" : (document.getElementById("patientId").value ? "Update Patient" : "Save Patient");
}

function showFormErrors(errors) {
  const box = document.getElementById("formErrors");
  box.innerHTML = `<ul>${errors.map(e => `<li>${esc(e)}</li>`).join("")}</ul>`;
  box.style.display = "block";
}

function showRemarks(name, remarks) {
  document.getElementById("remarksPatientName").textContent = name;
  document.getElementById("remarksBody").textContent = remarks || "No remarks generated yet.";
  document.getElementById("remarksOverlay").classList.add("open");
}

function closeRemarks() {
  document.getElementById("remarksOverlay").classList.remove("open");
}

function openDelete(id, name) {
  deleteTargetId = id;
  document.getElementById("deletePatientName").textContent = name;
  document.getElementById("deleteOverlay").classList.add("open");
}

function closeDelete() {
  document.getElementById("deleteOverlay").classList.remove("open");
  deleteTargetId = null;
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  try {
    const res  = await fetch(`/api/patients/${deleteTargetId}`, { method: "DELETE" });
    const data = await res.json();
    closeDelete();
    if (res.ok) {
      showToast(data.message, "success");
      await loadPatients();
    } else {
      showToast(data.error || "Delete failed.", "error");
    }
  } catch { showToast("Network error.", "error"); }
}

let toastTimer;
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3500);
}

function esc(str)   { return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function escAttr(s) { return String(s).replace(/'/g, "\\'").replace(/"/g,"&quot;"); }
function formatDate(d) {
  if (!d) return "–";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
