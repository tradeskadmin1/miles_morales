const STREAK_LIMIT = 3;
const STREAK_WINDOW_MS = 10 * 1000;

const streaks = new Map();
const bannedIps = new Set();

function getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) return forwarded.split(",")[0].trim();
    return req.socket.remoteAddress;
}

function isBanned(ip) {
    return bannedIps.has(ip);
}

function banIp(ip) {
    bannedIps.add(ip);
    streaks.delete(ip);
}

function unbanIp(ip) {
    bannedIps.delete(ip);
}

function recordSend(ip) {
    const now = Date.now();
    const existing = streaks.get(ip);

    if (existing && now - existing.lastSentAt <= STREAK_WINDOW_MS) {
        existing.count += 1;
        existing.lastSentAt = now;
    } else {
        streaks.set(ip, { count: 1, lastSentAt: now });
    }

    const streak = streaks.get(ip);

    if (streak.count >= STREAK_LIMIT) {
        banIp(ip);
        return true;
    }

    return false;
}

function resetStreak(ip) {
    streaks.delete(ip);
}

function banGuardMiddleware(req, res, next) {
    const ip = getClientIp(req);
    req.clientIp = ip;

    if (isBanned(ip)) {
        return res.status(403).json({ error: "Your IP has been banned for repeated sends." });
    }

    next();
}

function listBannedIps() {
    return Array.from(bannedIps);
}

module.exports = {
    banGuardMiddleware,
    recordSend,
    resetStreak,
    isBanned,
    banIp,
    unbanIp,
    listBannedIps,
    getClientIp,
    STREAK_LIMIT,
    STREAK_WINDOW_MS,
};