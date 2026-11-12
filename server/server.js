
const path = require("path");

// Pastikan .env selalu dibaca dari folder server
require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Static website
app.use(express.static(path.join(__dirname, "..")));
app.use(express.static(path.join(__dirname, "../everafter_updated")));

// ==========================================
// HEALTH CHECK
// ==========================================
app.get("/api/health", (req, res) => {
    res.json({
        status: "online",
        message: "EverAfter Backend aktif!"
    });
});

// ==========================================
// N8N WEBHOOK DISPATCH
// ==========================================
app.post("/api/n8n/dispatch", async (req, res) => {
    try {
        const webhookUrl = process.env.N8N_WEBHOOK_URL;
        const apiKey = process.env.N8N_WEBHOOK_KEY || process.env.N8N_WEBHOOK_API_KEY;
        const headerName = process.env.N8N_WEBHOOK_HEADER_NAME || "x-api-key";

        // Periksa konfigurasi
        if (!webhookUrl) {
            return res.status(503).json({
                success: false,
                error: "N8N_WEBHOOK_URL belum diatur di server/.env."
            });
        }

        const {
            action,
            category,
            record,
            source,
            occurredAt
        } = req.body || {};

        // Validasi payload
        if (!action || !category || !record) {
            return res.status(400).json({
                success: false,
                error: "Action, category, dan record wajib diisi."
            });
        }

        const flatRecord = (typeof record === "object" && record !== null) ? record : {};

        // Payload yang diperkaya: memuat field datar (English & Bahasa Indonesia)
        // agar node Google Sheets di n8n dapat memetakan kolom secara otomatis.
        const payload = {
            action,
            category,
            source: source || "EverAfter Wedding Organizer",
            occurredAt: occurredAt || new Date().toISOString(),

            // Top-level fields (English)
            id: flatRecord.id || "",
            name: flatRecord.name || flatRecord.title || flatRecord.client || "",
            client: flatRecord.client || flatRecord.name || "",
            phone: flatRecord.phone || "",
            email: flatRecord.email || "",
            date: flatRecord.date || "",
            package: flatRecord.package || "",
            status: flatRecord.status || "",
            amount: flatRecord.amount !== undefined ? flatRecord.amount : (flatRecord.price !== undefined ? flatRecord.price : ""),
            price: flatRecord.price !== undefined ? flatRecord.price : "",
            venue: flatRecord.venue || "",
            title: flatRecord.title || "",
            method: flatRecord.method || "",
            description: flatRecord.description || "",
            completion: flatRecord.completion || "",

            // Top-level fields (Bahasa Indonesia untuk header spreadsheet lokal)
            nama: flatRecord.name || flatRecord.title || flatRecord.client || "",
            klien: flatRecord.client || flatRecord.name || "",
            telepon: flatRecord.phone || "",
            tanggal: flatRecord.date || "",
            paket: flatRecord.package || "",
            jumlah: flatRecord.amount !== undefined ? flatRecord.amount : (flatRecord.price !== undefined ? flatRecord.price : ""),
            lokasi: flatRecord.venue || "",
            metode: flatRecord.method || "",
            deskripsi: flatRecord.description || "",
            kategori: category,
            aksi: action,
            waktu: occurredAt || new Date().toISOString(),

            // Nested record utuh
            record: flatRecord
        };

        console.log("Mengirim data ke n8n:", {
            action,
            category,
            recordId: flatRecord.id || "-"
        });

        // Kirim request ke n8n dengan Header API Key yang sesuai
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
            console.error(
                "n8n Webhook Error:",
                n8nResponse.status,
                responseText
            );

            return res.status(502).json({
                success: false,
                error: `n8n merespons dengan status ${n8nResponse.status}.`,
                status: n8nResponse.status,
                details: responseText
            });
        }

        console.log("Berhasil mengirim data ke n8n!");

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
        const webhookUrl = process.env.N8N_WEBHOOK_URL;
        const apiKey = process.env.N8N_WEBHOOK_KEY || process.env.N8N_WEBHOOK_API_KEY;
        const headerName = process.env.N8N_WEBHOOK_HEADER_NAME || "x-api-key";

        if (!webhookUrl) {
            return res.status(503).json({ success: false, error: "N8N_WEBHOOK_URL belum diatur di server/.env." });
        }

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
app.post("/api/chat", async (req, res) => {
    try {
        const { message, history = [] } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                error: "Pesan tidak boleh kosong."
            });
        }

        if (!process.env.HERMES_API_KEY ||
            !process.env.HERMES_API_URL) {
            return res.status(503).json({
                error: "Konfigurasi Hermes AI belum lengkap."
            });
        }

        const messages = [
            {
                role: "system",
                content: `Kamu adalah EverAfter AI Assistant,
asisten virtual profesional untuk website Wedding Organizer EverAfter.

Bantu administrator mengelola:
- Data klien dan calon pengantin
- Wedding dan booking
- Konsep dan paket pernikahan
- Vendor dan estimasi biaya
- Pembayaran dan anggaran
- Checklist persiapan acara
- Analisis dan funneling calon klien

Gunakan Bahasa Indonesia yang ramah,
profesional, jelas, dan mudah dipahami.

Jangan mengarang data klien atau transaksi.
Jika membutuhkan data aktual website, jelaskan
bahwa kamu belum menerima akses ke database.`
            },
            ...history.filter(item =>
                ["user", "assistant"].includes(item.role)
            ),
            {
                role: "user",
                content: message
            }
        ];

        const response = await fetch(
            `${process.env.HERMES_API_URL}/chat/completions`,
            {
                method: "POST",
                headers: {
                    "Authorization":
                        `Bearer ${process.env.HERMES_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "hermes-agent",
                    messages,
                    stream: false
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("Hermes API Error:", data);

            return res.status(response.status).json({
                error: data.error?.message ||
                    "Hermes AI gagal merespons."
            });
        }

        const answer = data.choices?.[0]?.message?.content;

        return res.json({
            success: true,
            reply: answer || "Hermes belum memberikan jawaban."
        });

    } catch (error) {
        console.error("Hermes Server Error:", error);

        return res.status(500).json({
            error: "Tidak dapat terhubung ke Hermes AI."
        });
    }
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, "127.0.0.1", () => {
    console.log("------------------------------------");
    console.log("EverAfter Backend aktif!");
    console.log(`URL: http://127.0.0.1:${PORT}`);
    console.log("n8n integration: configured");
    console.log("------------------------------------");
});
