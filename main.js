const $ = (s) => document.querySelector(s);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  let data;
  try {
    data = await response.json();
  } catch {
    data = { error: "Unexpected server response." };
  }
  return { response, data };
}

$("#caseForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));

  const { response, data } = await jsonRequest("/api/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  $("#caseResult").innerHTML = response.ok
    ? `<div class="success">Case created: <b>${esc(data.id)}</b>. Save this reference.</div>`
    : `<div class="error">${esc(data.error)}</div>`;

  if (response.ok) e.target.reset();
});

async function lookup() {
  const id = $("#caseId").value.trim();
  if (!id) return;

  const { response, data } = await jsonRequest(
    `/api/cases/${encodeURIComponent(id)}`
  );

  if (!response.ok) {
    $("#statusResult").innerHTML =
      `<div class="error">${esc(data.error)}</div>`;
    return;
  }

  const updates = (data.updates || []).slice().reverse().map((u) => `
    <div class="update">
      <b>${esc(u.status)}</b>
      <small>${new Date(u.created_at).toLocaleString()}</small>
      <div>${esc(u.message)}</div>
    </div>
  `).join("");

  $("#statusResult").innerHTML = `
    <div class="status">
      <h3>${esc(data.status)}</h3>
      <p>${esc(data.statusMessage)}</p>
      <h4>Updates</h4>
      ${updates || "<p>No updates yet.</p>"}
    </div>
  `;
}
