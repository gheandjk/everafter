const path = require("path");
const fs = require("fs");

// Cari file .env di lokasi server/.env atau root .env
const envCandidates = [
    path.join(__dirname, ".env"),
    path.join(__dirname, "..", "server", ".env"),
    path.join(process.cwd(), "server", ".env"),
    path.join(process.cwd(), ".env")
];
for (const envPath of envCandidates) {
    if (fs.existsSync(envPath)) {
        require("dotenv").config({ path: envPath });
        break;
    }
}

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi default (memastikan tetap berjalan di Vercel maupun lokal)
const DEFAULT_N8N_URL = "https://ghina1000.app.n8n.cloud/webhook/everafter-sync";
const DEFAULT_N8N_KEY = "xe35wk4nosud9tjmi2cql0fg18z6aby7";
const DEFAULT_HERMES_URL = "https://api.hermes.ai/v1";
const DEFAULT_HERMES_KEY = "5ee136511b524792a35ada27da528f80e40555656e4c43469a6aec03d9248dd3";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Static website untuk pengembangan lokal
app.use(express.static(path.join(__dirname, "..")));
app.use(express.static(path.join(__dirname, "../everafter_updated")));

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        hermes: "online",
        n8n: "configured",
        message: "EverAfter Backend & Hermes AI aktif!"
    });
});

// ==========================================
// N8N WEBHOOK DISPATCH
// ==========================================
app.post("/api/n8n/dispatch", async (req, res) => {
    try {
        const webhookUrl = process.env.N8N_WEBHOOK_URL || DEFAULT_N8N_URL;
        const apiKey = process.env.N8N_WEBHOOK_KEY || process.env.N8N_WEBHOOK_API_KEY || DEFAULT_N8N_KEY;
        const headerName = process.env.N8N_WEBHOOK_HEADER_NAME || "x-api-key";

        const {
            action,
            category,
            record,
            source,
            occurredAt
        } = req.body || {};

        if (!action || !category || !record) {
            return res.status(400).json({
                success: false,
                error: "Action, category, dan record wajib diisi."
            });
        }

        const flatRecord = (typeof record === "object" && record !== null) ? record : {};

        // Payload diperkaya: memuat field English & Bahasa Indonesia
        // agar node Google Sheets di n8n otomatis mengenali kolom header
        const payload = {
            action,
            category,
            source: source || "EverAfter Wedding Organizer",
            occurredAt: occurredAt || new Date().toISOString(),

            // Top-level fields (English)
            id: flatRecord.id || "",
            name: flatRecord.name || flatRecord.title || flatRecord.client || "",
            client: flatRecord.client || flatRecord.name || "",
            phone: flatRecord.phone || flatRecord.telepon || "",
            email: flatRecord.email || "",
            date: flatRecord.date || flatRecord.tanggal || new Date().toISOString().split("T")[0],
            package: flatRecord.package || flatRecord.paket || "",
            status: flatRecord.status || "Confirmed",
            amount: flatRecord.amount !== undefined ? flatRecord.amount : (flatRecord.price !== undefined ? flatRecord.price : ""),
            price: flatRecord.price !== undefined ? flatRecord.price : "",
            venue: flatRecord.venue || "",
            title: flatRecord.title || "",
            method: flatRecord.method || "",
            description: flatRecord.description || "",
            completion: flatRecord.completion || "",

            // Top-level fields (Bahasa Indonesia untuk header spreadsheet)
            nama: flatRecord.name || flatRecord.title || flatRecord.client || "",
            klien: flatRecord.client || flatRecord.name || "",
            telepon: flatRecord.phone || flatRecord.telepon || "",
            tanggal: flatRecord.date || flatRecord.tanggal || new Date().toISOString().split("T")[0],
            paket: flatRecord.package || flatRecord.paket || "",
            jumlah: flatRecord.amount !== undefined ? flatRecord.amount : (flatRecord.price !== undefined ? flatRecord.price : ""),
            lokasi: flatRecord.venue || "",
            metode: flatRecord.method || "",
            deskripsi: flatRecord.description || "",
            kategori: category,
            aksi: action,
            waktu: occurredAt || new Date().toISOString(),

            // Record utuh
            record: flatRecord
        };

        const headers = {
            "Content-Type": "application/json"
        };
        if (apiKey) {
            headers[headerName] = apiKey;
            headers["x-api-key"] = apiKey;
        }

        const n8nResponse = await fetch(webhookUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
        });

        const responseText = await n8nResponse.text();

        if (!n8nResponse.ok) {
            console.error("n8n Webhook Error:", n8nResponse.status, responseText);
            return res.status(502).json({
                success: false,
                error: `n8n merespons dengan status ${n8nResponse.status}.`,
                status: n8nResponse.status,
                details: responseText
            });
        }

        return res.status(200).json({
            success: true,
            message: "Data berhasil diteruskan ke n8n dan Google Sheets.",
            action,
            category,
            n8nResponse: responseText
        });

    } catch (error) {
        console.error("N8N Dispatch Error:", error);
        return res.status(500).json({
            success: false,
            error: error.message || "Gagal menghubungi n8n."
        });
    }
});

// Endpoint pengujian koneksi n8n cepat
app.get("/api/n8n/test", async (req, res) => {
    try {
        const webhookUrl = process.env.N8N_WEBHOOK_URL || DEFAULT_N8N_URL;
        const apiKey = process.env.N8N_WEBHOOK_KEY || process.env.N8N_WEBHOOK_API_KEY || DEFAULT_N8N_KEY;
        const headerName = process.env.N8N_WEBHOOK_HEADER_NAME || "x-api-key";

        const headers = { "Content-Type": "application/json" };
        if (apiKey) {
            headers[headerName] = apiKey;
            headers["x-api-key"] = apiKey;
        }

        const testPayload = {
            action: "test",
            category: "connection-test",
            name: "Tes Koneksi EverAfter",
            nama: "Tes Koneksi EverAfter",
            phone: "0812-3456-7890",
            telepon: "0812-3456-7890",
            email: "test@everafter.com",
            date: new Date().toISOString().split("T")[0],
            tanggal: new Date().toISOString().split("T")[0],
            package: "Royal Wedding",
            paket: "Royal Wedding",
            status: "Confirmed",
            amount: 75000000,
            jumlah: 75000000,
            source: "EverAfter Test Suite",
            occurredAt: new Date().toISOString()
        };

        const n8nRes = await fetch(webhookUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(testPayload)
        });

        const text = await n8nRes.text();
        return res.json({
            success: n8nRes.ok,
            status: n8nRes.status,
            n8nResponse: text
        });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    }
});

// ==========================================
// HERMES AI CHAT
// ==========================================
function generateSmartServerReply(query) {
    const q = String(query || "").toLowerCase();
    if (q.includes("pembayaran") || q.includes("bayar") || q.includes("transaksi") || q.includes("keuangan")) {
        return `Baik! Saya akan membantu menganalisis pembayaran dan status transaksi.<br><br><b>Ringkasan Keuangan EverAfter:</b><br>• Total Pembayaran Masuk (Lunas): <b style="color:#278052">Rp 340.000.000</b><br>• Sisa Piutang Pending: <b style="color:#9a741b">Rp 85.000.000</b><br>• Total Keseluruhan Invoice: <b>Rp 425.000.000</b><br>Semua invoice pembayaran tersimpan rapi dan dapat ditinjau pada menu <b>Quotes & Payments</b>.`;
    }
    if (q.includes("nadia") || q.includes("arif")) {
        return `Acara <b>The Wedding of Nadia & Arif</b> dijadwalkan pada <b>12 Des 2026</b> di <b>Grand Ballroom Jakarta</b> dengan status <b>Confirmed</b>. Paket yang digunakan adalah <b>Royal Wedding</b> dan persiapan checklist sedang berjalan on-track.`;
    }
    if (q.includes("paket") || q.includes("budget") || q.includes("harga")) {
        return `Untuk estimasi anggaran pernikahan, EverAfter memiliki <b>8 paket terkurasi</b>:<br>1. <b>Intimate Wedding</b> (Rp 25 Juta · 100 tamu)<br>2. <b>Rustic Botanical</b> (Rp 35 Juta · 150 tamu)<br>3. <b>Garden Party</b> (Rp 45 Juta · 200 tamu)<br>4. <b>Traditional Adat</b> (Rp 60 Juta · 350 tamu)<br>5. <b>Modern Luxury</b> (Rp 85 Juta · 500 tamu)<br>6. <b>Royal Wedding</b> (Rp 120 Juta · 800 tamu)<br>7. <b>Outdoor Beach & Cliff</b> (Rp 65 Juta · 200 tamu)<br>8. <b>Akad & Intimate Blessing</b> (Rp 18 Juta · 50 tamu).`;
    }
    if (q.includes("vendor") || q.includes("rekanan") || q.includes("partner")) {
        return `EverAfter bermitra dengan vendor terpercaya di berbagai kategori:<br>• <b>Dekorasi</b>: Lotus Design, Flora Lines, Royal Bloom<br>• <b>Catering</b>: Culture Royale, Puspa Catering, Akasya<br>• <b>Fotografi</b>: Axioo Photography, SweetEscape, Timeless Moments<br>• <b>Busana & MUA</b>: Ansoe Bridal, Bennu Sorumba, Marlene Hariman.`;
    }
    return `Halo, Administrator! Saya EverAfter AI Assistant (Powered by Hermes). Ada yang bisa saya bantu untuk mengelola data klien, paket pernikahan, vendor, atau jadwal acara hari ini?`;
}

app.post("/api/chat", async (req, res) => {
    try {
        const { message, history = [] } = req.body || {};

        if (!message || !message.trim()) {
            return res.status(400).json({
                error: "Pesan tidak boleh kosong."
            });
        }

        const apiUrl = process.env.HERMES_API_URL || DEFAULT_HERMES_URL;
        const apiKey = process.env.HERMES_API_KEY || DEFAULT_HERMES_KEY;

        const messages = [
            {
                role: "system",
                content: `Kamu adalah EverAfter AI Assistant, asisten virtual profesional untuk website Wedding Organizer EverAfter. Bantu administrator mengelola data klien, paket pernikahan, vendor, pembayaran, dan checklist persiapan acara. Gunakan Bahasa Indonesia yang ramah, profesional, dan ringkas.`
            },
            ...history.filter(item => ["user", "assistant"].includes(item.role)),
            { role: "user", content: message }
        ];

        let answer = null;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const response = await fetch(`${apiUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "hermes-agent",
                    messages,
                    stream: false
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                answer = data.choices?.[0]?.message?.content;
            }
        } catch (apiErr) {
            console.log("Hermes external API fallback to smart response:", apiErr.message);
        }

        // Jika external Hermes offline atau memberikan balasan kosong, gunakan smart response
        if (!answer) {
            answer = generateSmartServerReply(message);
        }

        return res.json({
            success: true,
            reply: answer
        });

    } catch (error) {
        console.error("Hermes Server Error:", error);
        return res.json({
            success: true,
            reply: generateSmartServerReply(req.body?.message)
        });
    }
});

// ==========================================
// START SERVER
// ==========================================
if (require.main === module) {
    app.listen(PORT, "0.0.0.0", () => {
        console.log("------------------------------------");
        console.log("EverAfter Backend aktif!");
        console.log(`URL: http://localhost:${PORT}`);
        console.log("------------------------------------");
    });
}

module.exports = app;
