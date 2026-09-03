const express = require("express");
const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

const app = express();
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

app.use(express.json({ limit: "100kb" }));
app.use(express.static("public"));

function ref() {
  return `RC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function requireDb(res) {
  if (!sql) {
    res.status(500).json({ error: "DATABASE_URL is not configured." });
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token || req.headers["x-admin-token"] !== token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function initDb() {
  if (!sql) return;

  await sql`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      issue TEXT NOT NULL,
      network TEXT DEFAULT '',
      wallet_address TEXT DEFAULT '',
      tx_hash TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      account_name TEXT DEFAULT '',
      account_number TEXT DEFAULT '',
      bank_country TEXT DEFAULT '',
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Submitted',
      status_message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS case_updates (
      id BIGSERIAL PRIMARY KEY,
      case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    )
  `;
}

app.get("/api/health", async (_req, res) => {
  try {
    if (!requireDb(res)) return;
    await initDb();
    await sql`SELECT 1`;
    res.json({ ok: true, database: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Database connection failed." });
  }
});

app.post("/api/cases", async (req, res) => {
  try {
    if (!requireDb(res)) return;
    await initDb();

    const {
      name,
      email,
      issue,
      network,
      walletAddress,
      txHash,
      bankName,
      accountName,
      accountNumber,
      bankCountry,
      description
    } = req.body;

    if (!name || !email || !issue || !description) {
      return res.status(400).json({ error: "Required fields are missing." });
    }

    const id = ref();
    const now = new Date();
    const status = "Submitted";
    const message = "Your case has been received and is awaiting review.";

    await sql`
      INSERT INTO cases
        (id, name, email, issue, network, wallet_address, tx_hash,
         bank_name, account_name, account_number, bank_country,
         description, status, status_message, created_at, updated_at)
      VALUES
        (${id}, ${name.trim()}, ${email.trim()}, ${issue.trim()},
         ${network || ""}, ${walletAddress || ""}, ${txHash || ""},
         ${bankName || ""}, ${accountName || ""}, ${accountNumber || ""},
         ${bankCountry || ""}, ${description.trim()}, ${status},
         ${message}, ${now}, ${now})
    `;

    await sql`
      INSERT INTO case_updates (case_id, status, message, created_at)
      VALUES (${id}, ${status}, 'Case received.', ${now})
    `;

    res.status(201).json({ id });
  } catch (err) {
    console.error("Create case error:", err);
    res.status(500).json({ error: "Unable to create case." });
  }
});

app.get("/api/cases/:id", async (req, res) => {
  try {
    if (!requireDb(res)) return;
    await initDb();

    const id = req.params.id.toUpperCase();

    const rows = await sql`
      SELECT id, name, issue, network, status, status_message,
             created_at, updated_at
      FROM cases
      WHERE UPPER(id) = ${id}
      LIMIT 1
    `;

    if (!rows.length) return res.status(404).json({ error: "Case not found." });

    const item = rows[0];

    const updates = await sql`
      SELECT status, message, created_at
      FROM case_updates
      WHERE case_id = ${item.id}
      ORDER BY created_at ASC
    `;

    res.json({
      id: item.id,
      name: item.name,
      issue: item.issue,
      network: item.network,
      status: item.status,
      statusMessage: item.status_message,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      updates
    });
  } catch (err) {
    console.error("Lookup error:", err);
    res.status(500).json({ error: "Unable to retrieve case." });
  }
});

app.get("/api/cases", requireAdmin, async (_req, res) => {
  try {
    if (!requireDb(res)) return;
    await initDb();

    const rows = await sql`
      SELECT id, name, email, issue, network, wallet_address,
             tx_hash, description, status, status_message,
             created_at, updated_at
      FROM cases
      ORDER BY created_at DESC
    `;

    res.json(rows);
  } catch (err) {
    console.error("Admin list error:", err);
    res.status(500).json({ error: "Unable to retrieve cases." });
  }
});

app.patch("/api/cases/:id/status", requireAdmin, async (req, res) => {
  try {
    if (!requireDb(res)) return;
    await initDb();

    const allowed = [
      "Submitted",
      "Under Review",
      "Processing",
      "Completed",
      "Failed",
      "Cancelled"
    ];

    const { status, message } = req.body;

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    const id = req.params.id.toUpperCase();
    const existing = await sql`
      SELECT id FROM cases WHERE UPPER(id) = ${id} LIMIT 1
    `;

    if (!existing.length) return res.status(404).json({ error: "Case not found." });

    const now = new Date();
    const statusMessage = (message || `Case status updated to ${status}.`).trim();

    await sql`
      UPDATE cases
      SET status = ${status},
          status_message = ${statusMessage},
          updated_at = ${now}
      WHERE id = ${existing[0].id}
    `;

    await sql`
      INSERT INTO case_updates (case_id, status, message, created_at)
      VALUES (${existing[0].id}, ${status}, ${statusMessage}, ${now})
    `;

    res.json({ ok: true });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ error: "Unable to update case." });
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(require("path").join(__dirname, "public", "index.html"));
});

module.exports = app;
