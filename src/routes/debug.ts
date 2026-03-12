import crypto from "crypto";
import { Router } from "express";
import { getMeetingByKey } from "../services/supabase.js";
import { getConfig } from "../config.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.get("/api/meeting/:meetInstanceKey", async (req, res) => {
  try {
    const { meetInstanceKey } = req.params;
    const data = await getMeetingByKey(meetInstanceKey!);
    res.json(data);
  } catch (err) {
    logger.error("Debug endpoint error", { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/debug/sa-check", (req, res) => {
  try {
    const cfg = getConfig();
    let raw = cfg.googleSaCredentials || "(empty)";
    const startsWithBrace = raw.trimStart().startsWith("{");

    let decoded = "";
    let parseError = "";
    let keyInfo = "";
    let cryptoError = "";

    if (!startsWithBrace && raw !== "(empty)") {
      const cleaned = raw.replace(/\s/g, "");
      decoded = Buffer.from(cleaned, "base64").toString("utf-8");
    } else {
      decoded = raw;
    }

    try {
      const creds = JSON.parse(decoded);
      let pk = creds.private_key || "(no private_key)";
      pk = pk.replace(/\\n/g, "\n");
      keyInfo = `starts=${pk.substring(0, 30)}... ends=...${pk.substring(pk.length - 30)} length=${pk.length}`;

      try {
        crypto.createPrivateKey(pk);
        cryptoError = "OK - key parsed successfully";
      } catch (e: any) {
        cryptoError = `crypto.createPrivateKey failed: ${e.message}`;
      }
    } catch (e: any) {
      parseError = `JSON.parse failed: ${e.message}`;
    }

    res.json({
      envLength: raw.length,
      startsWithBrace,
      first20: raw.substring(0, 20),
      decodedFirst50: decoded.substring(0, 50),
      parseError: parseError || "none",
      keyInfo,
      cryptoError,
      nodeVersion: process.version,
      opensslVersion: process.versions.openssl,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
