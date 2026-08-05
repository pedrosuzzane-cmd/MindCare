const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const cors = require("cors"); // <--- 1. Import cors

// 1. Load dotenv FIRST so environment variables are available immediately
dotenv.config();

const { Ollama } = require("ollama");
const { Buffer } = require("buffer");
const multer = require("multer");

let cloudinary;
try {
  cloudinary = require("cloudinary").v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log("Cloudinary initialized successfully.");
} catch (err) {
  console.warn("Cloudinary configuration failed:", err);
}

// Multer configuration for handling file uploads in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

const app = express();

// <--- 2. Enable CORS so your frontend can talk to the backend
app.use(cors());
const port = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Lets the mobile app
//  and deployment checks confirm that this exact backend is
// online before attempting a document upload.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "mindcare-backend" });
});

// Initialize Ollama client (connects to local Ollama instance)
const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
});

// Initialize Firebase Admin (for auth user deletion, OTP storage, admin ops)
let admin;
try {
  admin = require("firebase-admin");
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    serviceAccount = require(
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./service-account.json",
    );
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: "mindcare-8801e",
    });
  }
  console.log("Firebase Admin initialized.");
} catch (err) {
  console.warn(
    "firebase-admin initialization failed. Endpoints that need it " +
      "(OTP, delete-student, create-admin) will return errors.",
    err.message,
  );
}

app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Middleware to verify Firebase ID token and check for admin claims
const checkAdmin = async (req, res, next) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    return res.status(403).json({ error: "Unauthorized: No token provided." });
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    if (decodedToken.admin === true) {
      req.user = decodedToken;
      return next();
    }
    return res
      .status(403)
      .json({ error: "Unauthorized: Admin privileges required." });
  } catch (error) {
    return res.status(403).json({ error: "Unauthorized: Invalid token." });
  }
};

// Endpoint to grant admin privileges to a user (Super Admin only)
app.post("/api/grant-admin", checkSuperAdmin, async (req, res) => {
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).json({ error: "UID is required." });
  }
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    return res.json({
      message: `Successfully granted admin privileges to user ${uid}.`,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: `Failed to set custom claims: ${error.message}` });
  }
});

// ── AI Reflection Card endpoint (uses local Ollama gemma3:4b) ──
app.post("/api/ai-reflection", async (req, res) => {
  const { title, thoughts, mood, category } = req.body;

  if (!thoughts || typeof thoughts !== "string") {
    return res.status(400).json({ error: "Missing journal thoughts." });
  }

  const moodEmojiMap = {
    happy: "😄",
    calm: "😊",
    relaxed: "😌",
    good: "🙂",
    neutral: "😐",
    worried: "😟",
    sad: "😞",
    overwhelmed: "😣",
    exhausted: "😫",
    stressed: "😓",
    burnout: "😤",
    "very-upset": "😢",
  };

  const moodEmoji = moodEmojiMap[mood] || "";
  const categoryLabel = category || "general";

  const systemPrompt = `You are Mindy, a compassionate AI wellness companion for students. Your role is to provide gentle, supportive reflections on journal entries. You are NOT a therapist or doctor.

CRITICAL: Respond ONLY with valid JSON. No markdown, no code fences, no extra text.

Respond with this exact JSON schema:
{
  "summary": "A 2-3 sentence compassionate summary of what the student shared, acknowledging both challenges and strengths.",
  "positiveMoment": "A specific positive observation from their entry, or a gentle reframe if the entry is mostly negative.",
  "stressors": ["List", "of", "key", "stressors", "or", "themes", "identified"],
  "recommendations": ["2-3 specific, actionable suggestions for well-being"],
  "encouragement": "A warm, uplifting closing message."
}

Guidelines:
- Keep the tone warm, supportive, and non-judgmental
- Use simple, clear language appropriate for students
- If the entry mentions self-harm or crisis, include a gentle crisis resource reminder
- Always validate their feelings first before offering suggestions`;

  const userPrompt = `Here is a student's journal entry:

Title: ${title || "Untitled"}
Mood: ${moodEmoji} ${mood || "not specified"}
Category: ${categoryLabel}

Journal Content:
${thoughts.substring(0, 3000)}

Please provide a compassionate AI reflection following the JSON schema.`;

  try {
    const response = await ollama.chat({
      model: "gemma3:4b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      options: {
        temperature: 0.7,
        max_tokens: 800,
      },
    });

    const text = response.message?.content || "";

    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      jsonMatch = text.match(/\{[\s\S]*"summary"[\s\S]*\}/);
    }

    if (!jsonMatch) {
      console.error("Ollama returned non-JSON:", text.substring(0, 500));
      return res.status(500).json({ error: "Failed to parse AI response." });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const requiredFields = [
      "summary",
      "positiveMoment",
      "stressors",
      "recommendations",
      "encouragement",
    ];
    for (const field of requiredFields) {
      if (!parsed[field]) {
        parsed[field] =
          field === "stressors" || field === "recommendations"
            ? []
            : "Reflection available.";
      }
    }

    return res.json(parsed);
  } catch (error) {
    console.error("Ollama reflection error:", error);
    return res
      .status(500)
      .json({ error: "AI reflection failed. Please try again." });
  }
});

// ── Journal AI Insight (Gemini-based wellness reflection) ──
const JOURNAL_INSIGHT_SYSTEM_PROMPT = `You are a compassionate mental health assistant for university students. Your role is to provide a brief, constructive, and uplifting wellness reflection based on a student's journal entry.

CRITICAL: Respond ONLY with valid JSON. No markdown, no code fences, no extra text.

Respond with this exact JSON schema:
{
  "aiInsight": "A 2-4 sentence supportive, empathetic wellness reflection. Acknowledge their feelings, highlight any strengths you observe, and offer a gentle, actionable suggestion for well-being. Keep the tone warm and non-judgmental."
}

Guidelines:
- Keep the tone warm, supportive, and non-judgmental
- Use simple, clear language appropriate for students
- If the entry mentions self-harm or crisis, include a gentle crisis resource reminder
- Always validate their feelings first
- Do NOT diagnose or claim to be a licensed professional
- Do NOT prescribe medication`;

app.post("/api/journal/analyze", async (req, res) => {
  const { journalText } = req.body;

  if (!journalText || typeof journalText !== "string") {
    return res.status(400).json({ error: "Missing journalText." });
  }

  if (!GEMINI_API_KEY) {
    return res
      .status(500)
      .json({ error: "Gemini API key is not configured on the server." });
  }

  try {
    const modelName = "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: `System instruction: ${JOURNAL_INSIGHT_SYSTEM_PROMPT}` },
              ],
            },
            {
              role: "model",
              parts: [
                {
                  text: "Understood. I will provide supportive wellness reflections in the specified JSON format.",
                },
              ],
            },
            {
              role: "user",
              parts: [
                {
                  text: `Please provide a wellness reflection for this journal entry:\n\n"${journalText.substring(0, 3000)}"`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini journal analyze error:",
        data.error?.message || response.status,
      );
      return res
        .status(500)
        .json({ error: data.error?.message || "Gemini request failed." });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: "Invalid Gemini response." });
    }

    // Parse JSON from response (strip markdown fences if present)
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/```(?:json)?\n?/g, "").trim();
    }

    const parsed = JSON.parse(cleaned);

    if (!parsed.aiInsight || typeof parsed.aiInsight !== "string") {
      return res.status(500).json({ error: "Invalid insight format." });
    }

    return res.json({ aiInsight: parsed.aiInsight });
  } catch (err) {
    console.error("Journal analyze route error:", err.message || err);
    // Try a simpler fallback prompt with a different model
    try {
      const fallbackModel = "gemini-1.5-flash";
      const fallbackResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `You are a supportive wellness companion. Respond with valid JSON only: {"aiInsight": "A 2-3 sentence compassionate reflection on this journal entry"}.\n\nJournal: "${journalText.substring(0, 1500)}"`,
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
          }),
        },
      );
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        const fallbackText = fallbackData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        let cleaned = fallbackText.trim().replace(/^```(?:json)?\n?/g, "").replace(/```$/g, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.aiInsight && typeof parsed.aiInsight === "string") {
          return res.json({ aiInsight: parsed.aiInsight });
        }
      }
    } catch (fallbackErr) {
      console.error("Fallback analysis also failed:", fallbackErr.message || fallbackErr);
    }
    return res
      .status(500)
      .json({ error: "Journal analysis failed. Please try again." });
  }
});

// ── PWD Document Upload (Cloudinary) ──
app.post(
  "/api/upload-pwd-document",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      if (!cloudinary) {
        throw new Error("Cloudinary not configured on backend.");
      }

      // 1. Upload to Cloudinary first to obtain a public secure URL
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

      const result = await cloudinary.uploader.upload(dataURI, {
        resource_type: "auto",
        folder: "mindcare-pwd-documents",
      });

      const uploadedImageUrl = result.secure_url;
      console.log("Cloudinary Upload Successful. URL:", uploadedImageUrl);

      return res.json({
        success: true,
        message: "Document uploaded successfully.",
        secureUrl: uploadedImageUrl,
        publicId: result.public_id,
      });
    } catch (error) {
      console.error("Upload/Verification error:", error.message);
      return res
        .status(500)
        .json({ error: `Upload and verification failed: ${error.message}` });
    }
  },
);

// ── Profile Avatar Upload (Cloudinary) ──
app.post(
  "/api/users/upload-avatar",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      if (!cloudinary) {
        throw new Error("Cloudinary not configured on backend.");
      }

      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

      const result = await cloudinary.uploader.upload(dataURI, {
        resource_type: "image",
        folder: "mindcare-avatars",
        transformation: [
          { width: 300, height: 300, crop: "fill", gravity: "face" },
        ],
      });

      return res.json({
        success: true,
        secureUrl: result.secure_url,
        publicId: result.public_id,
      });
    } catch (error) {
      console.error("Avatar upload error:", error.message);
      return res
        .status(500)
        .json({ error: `Avatar upload failed: ${error.message}` });
    }
  },
);

// ── LSN Registration (Register with Special Needs Document) ──
app.post(
  "/api/register-lsn",
  upload.single("file"),
  async (req, res) => {
    try {
      // 1. Validate required fields
      const { email, password, fullName, department, yearLevel, schoolId, contactNo, specialNeedsType } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "No verification document uploaded." });
      }
      if (!email || !password || !fullName) {
        return res.status(400).json({ error: "Missing required fields: email, password, fullName." });
      }
      if (!cloudinary) {
        throw new Error("Cloudinary not configured on backend.");
      }
      if (!admin) {
        throw new Error("Firebase Admin not configured on backend.");
      }

      // 2. Upload document to Cloudinary
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        resource_type: "auto",
        folder: "mindcare-lsn-documents",
      });

      const secureUrl = uploadResult.secure_url;
      const publicId = uploadResult.public_id;
      console.log("LSN Document uploaded to Cloudinary:", secureUrl);

      // 3. Create Firebase Auth user and Firestore document
      console.log("LSN document uploaded. Creating user...");

      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: fullName,
        emailVerified: false,
      });

      const lsnData = {
        fullName,
        email,
        schoolId: schoolId || "",
        department: department || "",
        yearLevel: yearLevel || "",
        contactNo: contactNo || "",
        isLSN: true,
        specialNeedsType: specialNeedsType || "Not specified",
        lsnDocument: {
          fileName: req.file.originalname,
          secureUrl,
          publicId,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        role: "student",
      };

      await admin.firestore().collection("users").doc(userRecord.uid).set(lsnData);

      console.log("LSN user created successfully:", userRecord.uid);

      return res.status(201).json({
        success: true,
        message: "LSN registration successful.",
        uid: userRecord.uid,
        email: userRecord.email,
      });

    } catch (error) {
      console.error("LSN Registration error:", error.message);
      return res
        .status(500)
        .json({ error: `LSN registration failed: ${error.message}` });
    }
  },
);

// ── Delete Student Account (Firebase Auth + Firestore) ──
app.post("/api/delete-student", async (req, res) => {
  const { uid } = req.body;

  if (!uid || typeof uid !== "string") {
    return res.status(400).json({ error: "Missing student UID." });
  }

  try {
    await admin.auth().deleteUser(uid);
    console.log(`Deleted auth user: ${uid}`);
    return res.json({
      authDeleted: true,
      message: "Student auth account deleted successfully.",
    });
  } catch (err) {
    console.error(`Error deleting auth user ${uid}:`, err.message);
    return res
      .status(500)
      .json({ error: `Failed to delete auth user: ${err.message}` });
  }
});

// ── Forgot Password (secure OTP + reset session) ──
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const PASSWORD_RESET_COLLECTION = "passwordReset";
const PASSWORD_RESET_META_COLLECTION = "passwordResetMeta";
const RESET_SESSION_COLLECTION = "passwordResetSessions";
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5; // max incorrect attempts before lockout
const OTP_LOCK_MS = 15 * 60 * 1000; // 15 minute lockout
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 second resend cooldown
const OTP_MAX_RESENDS_PER_HOUR = 3; // max resends per rolling hour
const RESET_SESSION_EXPIRY_MS = 10 * 60 * 1000; // reset session: 10 minutes
const PASSWORD_MIN_LENGTH = 12;

// Common/weak passwords rejected outright.
const COMMON_PASSWORDS = new Set([
  "password", "password123", "password1234", "123456", "12345678",
  "123456789", "1234567890", "qwerty", "qwerty123", "abc123",
  "letmein", "admin", "admin123", "welcome", "welcome123", "iloveyou",
  "monkey", "dragon", "football", "baseball", "111111", "000000",
  "mindcare", "mindcare123",
]);

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// Stable per-email key so we can look up OTPs without composite indexes.
function emailKey(email) {
  return crypto
    .createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex")
    .slice(0, 24);
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      reason: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, reason: "Password must include an uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, reason: "Password must include a lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, reason: "Password must include a number." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      ok: false,
      reason: "Password must include a special character.",
    };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return {
      ok: false,
      reason: "This password is too common. Please choose a stronger one.",
    };
  }
  return { ok: true };
}

function getClientIp(req) {
  return (req.headers["x-forwarded-for"] || req.ip || "unknown")
    .split(",")[0]
    .trim();
}

function getUserAgent(req) {
  return String(req.headers["user-agent"] || "unknown").slice(0, 200);
}

// In-memory sliding window: max 5 reset requests per IP per hour.
const otpRequestTracker = new Map();
function isOtpRateLimited(ip) {
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const times = (otpRequestTracker.get(ip) || []).filter(
    (t) => t > windowStart,
  );
  if (times.length >= 5) {
    otpRequestTracker.set(ip, times);
    return true;
  }
  times.push(now);
  otpRequestTracker.set(ip, times);
  return false;
}

// Appends a security event to the user's activity log (securityLogs/{uid}/events).
async function logSecurityEvent(uid, type, details) {
  if (!admin) return;
  try {
    await admin
      .firestore()
      .collection("securityLogs")
      .doc(uid)
      .collection("events")
      .add({
        type,
        details: details || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (err) {
    console.warn("Failed to log security event:", err.message);
  }
}

// Sender address used for all outgoing email (EMAIL_FROM takes precedence).
const SMTP_FROM_ADDRESS =
  process.env.EMAIL_FROM ||
  process.env.SMTP_FROM ||
  "MindCare <noreply@mindcare.app>";

let otpTransporter = null;
try {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
    // Gmail conventions: 465 = implicit TLS (secure:true), 587 = STARTTLS (secure:false).
    let secure = smtpPort === 465;
    if (process.env.SMTP_SECURE !== undefined) {
      const envSecure = process.env.SMTP_SECURE === "true";
      if (envSecure !== secure) {
        console.warn(
          `[SMTP] SMTP_SECURE=${process.env.SMTP_SECURE} conflicts with SMTP_PORT=${smtpPort}; ` +
            `using secure=${secure} (Gmail 587 requires STARTTLS).`
        );
      }
      // Only honor SMTP_SECURE when no port is given to force it.
      if (process.env.SMTP_PORT === undefined) {
        secure = envSecure;
      }
    }
    otpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: smtpPort,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log(
      `[SMTP] Transporter initialized for ${process.env.SMTP_USER} ` +
        `(host=${process.env.SMTP_HOST || "smtp.gmail.com"}, port=${smtpPort}, secure=${secure}).`
    );

    // Verify the SMTP connection at startup (fails fast if App Password is wrong).
    otpTransporter
      .verify()
      .then(() => {
        console.log("[SMTP] Verified: connection to Gmail SMTP succeeded.");
      })
      .catch((err) => {
        console.error(
          "[SMTP] verify() failed. Check SMTP_HOST/PORT, SMTP_USER, and that the App Password is correct."
        );
        console.error(err.stack || err.message);
      });
  } else {
    console.warn(
      "[SMTP] TEST MODE: SMTP_USER/SMTP_PASS not set on this server — OTP emails will be logged to console only and NOT delivered. " +
        "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM in the environment to enable email delivery."
    );
  }
} catch (err) {
  console.warn("[SMTP] Failed to create transporter:", err.message);
}

// Sends mail via the configured transporter with stage logging.
// Falls back to TEST MODE (console only) when SMTP is not configured.
function sendMailWithLogging({ to, subject, html, label }) {
  const mailOptions = { from: SMTP_FROM_ADDRESS, to, subject, html };
  if (otpTransporter) {
    console.log(`[EMAIL] ${label} → ${to} ...`);
    return otpTransporter
      .sendMail(mailOptions)
      .then((info) => {
        console.log(
          `[EMAIL] ${label} → ${to} delivered. MessageId: ${info.messageId}`
        );
        return info;
      })
      .catch((err) => {
        console.error(`[EMAIL] ${label} → ${to} FAILED.`);
        console.error(err.stack || err.message);
        throw err;
      });
  }
  console.log(`[TEST MODE] ${label} → ${to} (SMTP not configured)`);
  return Promise.resolve();
}

function sendOtpEmail(email, otp) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#8A63D2;">MindCare Password Reset Verification Code</h2>
      <p>Hello,</p>
      <p>We received a request to reset your MindCare password.</p>
      <div style="background:#F3EAFF;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
        <p style="font-size:14px;color:#666;margin:0 0 8px;">Your verification code is</p>
        <p style="font-size:40px;font-weight:bold;color:#8A63D2;letter-spacing:10px;margin:0;">${otp}</p>
      </div>
      <p style="color:#666;font-size:14px;">This code will expire in <strong>5 minutes</strong>.</p>
      <p style="color:#666;font-size:14px;">If you did not request this reset, please ignore this email. Your account will remain secure.</p>
      <p style="color:#666;font-size:14px;font-weight:600;">For security reasons:</p>
      <ul style="color:#666;font-size:13px;line-height:20px;padding-left:20px;">
        <li>Never share this code.</li>
        <li>MindCare staff will never ask for it.</li>
        <li>This code can only be used once.</li>
      </ul>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#999;font-size:12px;">MindCare Security Team</p>
    </div>
  `;
  const mailOptions = {
    from: SMTP_FROM_ADDRESS,
    to: email,
    subject: "MindCare Password Reset Verification Code",
    html,
  };
  if (otpTransporter) {
    console.log(`[EMAIL] Sending password reset email to ${email}...`);
    return otpTransporter
      .sendMail(mailOptions)
      .then((info) => {
        console.log(
          `[EMAIL] Sent successfully to ${email}. MessageId: ${info.messageId}`
        );
        return info;
      })
      .catch((err) => {
        console.error(`[EMAIL] Failed to send to ${email}.`);
        console.error(err.stack || err.message);
        throw err;
      });
  }
  console.log(`[OTP TEST MODE] Code for ${email}: ${otp}`);
  return Promise.resolve();
}

// POST /api/auth/forgot-password/request — generate OTP, store its hash, send email.
// Always returns the same response whether or not the email exists (no enumeration).
app.post("/api/auth/forgot-password/request", async (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const emailClean = normalizeEmail(email);
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);
  console.log(
    `[FORGOT] Password reset requested. Student email received: ${emailClean} (ip=${ipAddress}).`
  );

  // Coarse per-IP throttle to blunt OTP abuse / spam.
  if (isOtpRateLimited(ipAddress)) {
    return res.status(429).json({
      error: "Too many reset requests. Please try again later.",
    });
  }

  try {
    // Look up the user by email — do NOT reveal whether the account exists.
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(emailClean);
    } catch {
      console.log(
        `[FORGOT] No Firebase Auth account found for ${emailClean}; returning generic success (no email sent).`
      );
      return res.json({
        success: true,
        message:
          "If an account with that email exists, a reset code has been sent.",
      });
    }

    const db = admin.firestore();
    const now = Date.now();
    const metaRef = db
      .collection(PASSWORD_RESET_META_COLLECTION)
      .doc(emailKey(emailClean));
    const metaSnap = await metaRef.get();
    const meta = metaSnap.exists ? metaSnap.data() : {};

    // Administrator accounts must use the Super Admin approval workflow.
    const adminDoc = await db.collection("admins").doc(userRecord.uid).get();
    if (adminDoc.exists) {
      return res.json({
        success: true,
        status: "admin",
        message:
          "Administrator accounts are reset through the Super Administrator approval flow.",
      });
    }

    // Resend cooldown — at least 60s between requests.
    if (meta.lastSentMs && now - meta.lastSentMs < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS - (now - meta.lastSentMs)) / 1000,
      );
      return res.status(429).json({
        error: `Please wait ${waitSec}s before requesting another code.`,
      });
    }

    // Max resends per rolling hour (initial request + 3 resends).
    const requestTimes = (meta.requestTimes || []).filter(
      (t) => now - t < 60 * 60 * 1000,
    );
    if (requestTimes.length >= 1 + OTP_MAX_RESENDS_PER_HOUR) {
      return res.status(429).json({
        error: "Too many reset requests. Please try again in an hour.",
      });
    }

    const otp = generateOtp();
    console.log(
      `[FORGOT] Student account found (uid=${userRecord.uid}). OTP generated + hashed (hash=${hashValue(otp).slice(0, 12)}...).`
    );

    // Only one active code per email — invalidate any previous one.
    if (meta.currentOtpId) {
      try {
        await db
          .collection(PASSWORD_RESET_COLLECTION)
          .doc(meta.currentOtpId)
          .delete();
        console.log(`[FORGOT] Invalidated previous OTP ${meta.currentOtpId}.`);
      } catch {}
    }

    // Store only the OTP hash (never plain text).
    const otpRef = await db.collection(PASSWORD_RESET_COLLECTION).add({
      email: emailClean,
      uid: userRecord.uid,
      otpHash: hashValue(otp),
      expiresAt: now + OTP_EXPIRY_MS,
      createdAtMs: now,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      used: false,
      lastSentMs: now,
      lastSent: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress,
      userAgent,
    });

    await metaRef.set({
      currentOtpId: otpRef.id,
      lastSentMs: now,
      requestTimes: [...requestTimes, now],
    });
    console.log(`[FORGOT] OTP hash saved to Firestore (id=${otpRef.id}, expires in 5m).`);

    // Stage log: explicit SMTP readiness check before sending.
    if (otpTransporter) {
      console.log(`[SMTP] Connecting to Gmail SMTP (${process.env.SMTP_HOST || "smtp.gmail.com"}:${process.env.SMTP_PORT || "587"}) to deliver OTP to ${emailClean}.`);
    } else {
      console.warn(
        "[SMTP] TEST MODE: no transporter configured on this server. The OTP email will NOT be delivered; the code is logged to the console only. Set SMTP_USER/SMTP_PASS in this server's environment."
      );
    }

    await sendOtpEmail(emailClean, otp);
    await logSecurityEvent(userRecord.uid, "password_reset_requested", {
      ipAddress,
      userAgent,
    });

    console.log(`[FORGOT] Password reset request completed for ${emailClean}.`);
    return res.json({
      success: true,
      message:
        "If an account with that email exists, a reset code has been sent.",
    });
  } catch (err) {
    console.error("Password reset request error:", err);
    return res
      .status(500)
      .json({ error: "Unable to process password reset request." });
  }
});

// POST /api/auth/forgot-password/verify — verify OTP, then issue a short-lived reset session.
app.post("/api/auth/forgot-password/verify", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res
      .status(400)
      .json({ error: "Email and verification code are required." });
  }

  const emailClean = normalizeEmail(email);
  const otpClean = String(otp).trim();

  try {
    const db = admin.firestore();
    const metaSnap = await db
      .collection(PASSWORD_RESET_META_COLLECTION)
      .doc(emailKey(emailClean))
      .get();

    if (!metaSnap.exists || !metaSnap.data().currentOtpId) {
      return res.status(400).json({ error: "Invalid or expired reset code." });
    }

    const otpDoc = await db
      .collection(PASSWORD_RESET_COLLECTION)
      .doc(metaSnap.data().currentOtpId)
      .get();

    if (!otpDoc.exists) {
      return res.status(400).json({ error: "Invalid or expired reset code." });
    }

    const otpData = otpDoc.data();
    const now = Date.now();

    if (otpData.used) {
      return res.status(400).json({ error: "This code has already been used." });
    }

    if (now > otpData.expiresAt) {
      await otpDoc.ref.delete();
      await metaSnap.ref.delete();
      return res
        .status(400)
        .json({ error: "This code has expired. Please request a new one." });
    }

    if (otpData.lockedUntil && now < otpData.lockedUntil) {
      const lockMin = Math.ceil((otpData.lockedUntil - now) / 60000);
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${lockMin} minute(s).`,
        attemptsRemaining: 0,
      });
    }

    const attempts = otpData.attempts || 0;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await otpDoc.ref.update({
        lockedUntil: now + OTP_LOCK_MS,
      });
      return res.status(429).json({
        error: "Too many failed attempts. Try again in 15 minutes.",
        attemptsRemaining: 0,
      });
    }

    // Wrong code — increment attempts and lock after the limit.
    if (hashValue(otpClean) !== otpData.otpHash) {
      const newAttempts = attempts + 1;
      const update = { attempts: newAttempts };
      if (newAttempts >= OTP_MAX_ATTEMPTS) {
        update.lockedUntil = now + OTP_LOCK_MS;
      }
      await otpDoc.ref.update(update);
      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - newAttempts);
      return res.status(400).json({
        error:
          remaining > 0
            ? `Incorrect code. ${remaining} attempt(s) remaining.`
            : "Too many failed attempts. Try again in 15 minutes.",
        attemptsRemaining: remaining,
      });
    }

    // Correct code — single use. Delete the OTP and issue a reset session.
    const resetToken = crypto.randomBytes(32).toString("hex");
    await db.collection(RESET_SESSION_COLLECTION).doc(hashValue(resetToken)).set({
      uid: otpData.uid,
      email: emailClean,
      expiresAt: now + RESET_SESSION_EXPIRY_MS,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      used: false,
    });

    await otpDoc.ref.delete();
    await metaSnap.ref.delete();

    return res.json({
      success: true,
      resetToken,
      message: "Code verified. You can now create a new password.",
    });
  } catch (err) {
    console.error("Password reset verify error:", err);
    return res
      .status(500)
      .json({ error: "Unable to verify code. Please try again." });
  }
});

// POST /api/auth/forgot-password/reset — validate reset session, update password, revoke sessions.
app.post("/api/auth/forgot-password/reset", async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res
      .status(400)
      .json({ error: "Reset token and new password are required." });
  }

  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.ok) {
    return res.status(400).json({ error: passwordCheck.reason });
  }

  try {
    const db = admin.firestore();
    const sessionRef = db
      .collection(RESET_SESSION_COLLECTION)
      .doc(hashValue(String(resetToken)));
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return res
        .status(400)
        .json({ error: "Invalid or expired reset session." });
    }

    const sessionData = sessionSnap.data();
    const now = Date.now();

    if (sessionData.used) {
      return res
        .status(400)
        .json({ error: "This reset session has already been used." });
    }

    if (now > sessionData.expiresAt) {
      await sessionRef.delete();
      return res
        .status(400)
        .json({ error: "Reset session has expired. Please start over." });
    }

    // Update the password and revoke all refresh tokens (signs out every device).
    await admin.auth().updateUser(sessionData.uid, { password: newPassword });
    await admin.auth().revokeRefreshTokens(sessionData.uid);

    await sessionRef.delete();
    await logSecurityEvent(sessionData.uid, "password_changed", {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });

    console.log(
      `Password updated for ${sessionData.email} (all sessions revoked)`
    );
    return res.json({
      success: true,
      message: "Password updated. All previous sessions have been signed out.",
    });
  } catch (err) {
    console.error("Password reset error:", err);
    return res
      .status(500)
      .json({ error: "Unable to reset password. Please try again." });
  }
});

// POST /api/security/log — record a security event for the authenticated user.
app.post("/api/security/log", async (req, res) => {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  const { type, details } = req.body;

  if (!idToken) {
    return res.status(401).json({ error: "Unauthorized: No token provided." });
  }
  if (!type || typeof type !== "string") {
    return res.status(400).json({ error: "Event type is required." });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    await logSecurityEvent(decodedToken.uid, type, {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      ...(details || {}),
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("Security log error:", err.message);
    return res.status(401).json({ error: "Invalid token." });
  }
});

// ── Administrator Password Reset (Super Admin approval workflow) ──
const ADMIN_RESET_REQUEST_COLLECTION = "adminPasswordResetRequests";
const AUDIT_LOG_COLLECTION = "auditLogs";
const ADMIN_OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const ADMIN_OTP_MAX_ATTEMPTS = 5;
const ADMIN_OTP_LOCK_MS = 15 * 60 * 1000; // 15 minute lockout
const ADMIN_RESET_SESSION_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Super Admins may also be granted via the custom claim `superAdmin: true`.
// This env list is the bootstrap fallback so the first Super Admin can approve.
const SUPER_ADMIN_EMAILS = (
  process.env.SUPER_ADMIN_EMAILS || "mindcare932@gmail.com"
)
  .split(",")
  .map((e) => normalizeEmail(e))
  .filter(Boolean);

// Middleware: only Super Admins (custom claim OR configured email list) may pass.
async function checkSuperAdmin(req, res, next) {
  const idToken = req.headers.authorization?.split("Bearer ")[1];
  if (!idToken) {
    return res.status(403).json({ error: "Unauthorized: No token provided." });
  }
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const isClaimSuperAdmin = decodedToken.superAdmin === true;
    const isListedSuperAdmin =
      decodedToken.email && SUPER_ADMIN_EMAILS.includes(normalizeEmail(decodedToken.email));
    if (isClaimSuperAdmin || isListedSuperAdmin) {
      req.user = decodedToken;
      return next();
    }
    return res.status(403).json({
      error: "Only Super Admins can perform this action.",
    });
  } catch (error) {
    return res.status(403).json({ error: "Unauthorized: Invalid token." });
  }
};

// Appends an entry to the top-level auditLogs collection.
async function logAuditEvent({ action, actor, target, req, status, requestId }) {
  if (!admin) return;
  try {
    await admin.firestore().collection(AUDIT_LOG_COLLECTION).add({
      action,
      actorUid: actor?.uid || null,
      actorEmail: actor?.email || null,
      targetUid: target?.uid || null,
      targetEmail: target?.email || null,
      status: status || null,
      requestId: requestId || null,
      ipAddress: getClientIp(req),
      device: getUserAgent(req),
      createdAtMs: Date.now(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("Failed to write audit log:", err.message);
  }
}

function sendAdminApprovalEmail(email, otp) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#8A63D2;">Your password reset request has been approved.</h2>
      <div style="background:#F3EAFF;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
        <p style="font-size:14px;color:#666;margin:0 0 8px;">Verification Code</p>
        <p style="font-size:40px;font-weight:bold;color:#8A63D2;letter-spacing:10px;margin:0;">${otp}</p>
      </div>
      <p style="color:#666;font-size:14px;">Expires in <strong>5 minutes</strong>. Enter this code to create your new password.</p>
      <p style="color:#666;font-size:14px;">If you did not request this reset, please contact the MindCare System Administrator.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#999;font-size:12px;">MindCare Security Team</p>
    </div>
  `;
  if (otpTransporter) {
    return sendMailWithLogging({
      to: email,
      subject: "MindCare Password Reset Request Approved",
      html,
      label: "Admin OTP",
    });
  }
  console.log(`[ADMIN OTP TEST MODE] Code for ${email}: ${otp}`);
  return Promise.resolve();
}

function sendAdminRejectionEmail(email) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#8A63D2;">MindCare Password Reset Request</h2>
      <p>Hello,</p>
      <p>Your administrator password reset request was <strong>not approved</strong>.</p>
      <p>If you believe this is an error, please contact the MindCare System Administrator.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#999;font-size:12px;">MindCare Security Team</p>
    </div>
  `;
  if (otpTransporter) {
    return sendMailWithLogging({
      to: email,
      subject: "MindCare Password Reset Request",
      html,
      label: "Admin Rejection",
    });
  }
  console.log(`[ADMIN REJECT TEST MODE] Rejection email for ${email}`);
  return Promise.resolve();
}

function notifySuperAdmins(adminEmail, adminName) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#8A63D2;">MindCare Password Reset Request</h2>
      <p>Hello,</p>
      <p>An administrator has requested a password reset and is waiting for your approval.</p>
      <div style="background:#F3EAFF;border-radius:12px;padding:20px;margin:24px 0;">
        <p style="font-size:14px;color:#666;margin:0 0 4px;">Name</p>
        <p style="font-size:18px;font-weight:bold;color:#24113F;margin:0 0 14px;">${adminName || "—"}</p>
        <p style="font-size:14px;color:#666;margin:0 0 4px;">Email</p>
        <p style="font-size:18px;font-weight:bold;color:#24113F;margin:0;">${adminEmail}</p>
      </div>
      <p style="color:#666;font-size:14px;">Log in to the MindCare admin dashboard to approve or reject this request.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#999;font-size:12px;">MindCare Security Team</p>
    </div>
  `;
  if (otpTransporter) {
    return sendMailWithLogging({
      to: SUPER_ADMIN_EMAILS.join(", "),
      subject: "MindCare Password Reset Request",
      html,
      label: "SuperAdmin Notification",
    });
  }
  console.log(`[ADMIN REQUEST TEST MODE] Notification for ${adminEmail}`);
  return Promise.resolve();
}

// POST /api/admin/request-password-reset — create (or return) a pending request.
app.post("/api/admin/request-password-reset", async (req, res) => {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const emailClean = normalizeEmail(email);

  if (isOtpRateLimited(getClientIp(req))) {
    return res.status(429).json({
      error: "Too many reset requests. Please try again later.",
    });
  }

  try {
    // Do not reveal whether the account exists or is an admin.
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(emailClean);
    } catch {
      return res.json({
        success: true,
        status: "pending",
        message:
          "If an account with that email exists, your request has been sent.",
      });
    }

    const db = admin.firestore();
    const requestRef = db
      .collection(ADMIN_RESET_REQUEST_COLLECTION)
      .doc(emailKey(emailClean));
    const requestSnap = await requestRef.get();
    const existing = requestSnap.exists ? requestSnap.data() : null;

    // An active request already exists — return it instead of creating a duplicate.
    if (existing && existing.status === "pending") {
      return res.json({
        success: true,
        requestId: requestRef.id,
        status: existing.status,
        otpExpiresAtMs: null,
        message: "Your request is still pending approval.",
      });
    }

    // An approved request whose OTP has expired must be re-approved.
    if (
      existing &&
      existing.status === "approved" &&
      !existing.completed &&
      existing.otpExpiresAtMs &&
      Date.now() > existing.otpExpiresAtMs
    ) {
      await requestRef.update({
        status: "pending",
        approvedBy: null,
        approvedAtMs: null,
        otpSent: false,
        otpHash: null,
        otpExpiresAtMs: null,
        otpAttempts: 0,
        otpLockedUntilMs: null,
      });
      await notifySuperAdmins(emailClean, existing.adminName || "");
      await logAuditEvent({
        action: "Admin Password Reset Re-Requested",
        actor: null,
        target: { uid: existing.adminUid, email: emailClean },
        req,
        status: "Pending",
        requestId: requestRef.id,
      });
      return res.json({
        success: true,
        requestId: requestRef.id,
        status: "pending",
        message: "Your previous code expired. A new approval has been requested.",
      });
    }

    // A still-valid approved request — send the admin straight to the OTP screen.
    if (existing && existing.status === "approved" && !existing.completed) {
      return res.json({
        success: true,
        requestId: requestRef.id,
        status: "approved",
        otpExpiresAtMs: existing.otpExpiresAtMs || null,
        message: "Your request has been approved. Enter the code from your email.",
      });
    }

    // Only university admins may request a reset.
    const adminDoc = await db.collection("admins").doc(userRecord.uid).get();
    if (!adminDoc.exists) {
      return res.json({
        success: true,
        status: "pending",
        message:
          "If an account with that email exists, your request has been sent.",
      });
    }

    const adminData = adminDoc.data();
    const now = Date.now();

    await requestRef.set({
      adminUid: userRecord.uid,
      email: emailClean,
      adminName: adminData.displayName || userRecord.displayName || "",
      status: "pending",
      requestedAtMs: now,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedBy: null,
      approvedAtMs: null,
      rejectedBy: null,
      rejectedAtMs: null,
      otpSent: false,
      otpHash: null,
      otpExpiresAtMs: null,
      otpAttempts: 0,
      otpLockedUntilMs: null,
      completed: false,
      completedAtMs: null,
      requestedIp: getClientIp(req),
      requestedDevice: getUserAgent(req),
    });

    await notifySuperAdmins(emailClean, adminData.displayName || "");
    await logAuditEvent({
      action: "Admin Password Reset Requested",
      actor: null,
      target: { uid: userRecord.uid, email: emailClean },
      req,
      status: "Pending",
      requestId: requestRef.id,
    });

    console.log(`Admin password reset requested for ${emailClean}`);
    return res.json({
      success: true,
      requestId: requestRef.id,
      status: "pending",
      message: "Your request has been sent to the Super Administrator.",
    });
  } catch (err) {
    console.error("Admin password reset request error:", err);
    return res.status(500).json({ error: "Unable to process the request." });
  }
});

// GET /api/superadmin/password-reset-requests — list requests for the dashboard.
app.get("/api/superadmin/password-reset-requests", checkSuperAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const snap = await db.collection(ADMIN_RESET_REQUEST_COLLECTION).get();
    const requests = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      requests.push({
        requestId: docSnap.id,
        adminUid: data.adminUid,
        email: data.email,
        adminName: data.adminName,
        status: data.status,
        requestedAtMs: data.requestedAtMs,
        requestedAt: data.requestedAt?.toDate?.()?.toISOString() || null,
        approvedBy: data.approvedBy,
        approvedAtMs: data.approvedAtMs,
        rejectedBy: data.rejectedBy,
        rejectedAtMs: data.rejectedAtMs,
        otpSent: data.otpSent,
        otpExpiresAtMs: data.otpExpiresAtMs,
        completed: data.completed,
        completedAtMs: data.completedAtMs,
      });
    });
    // Newest first.
    requests.sort((a, b) => (b.requestedAtMs || 0) - (a.requestedAtMs || 0));
    return res.json({ requests });
  } catch (err) {
    console.error("List password reset requests error:", err);
    return res.status(500).json({ error: "Unable to load requests." });
  }
});

// POST /api/superadmin/approve-password-reset — approve + generate/send OTP.
app.post("/api/superadmin/approve-password-reset", checkSuperAdmin, async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: "Request ID is required." });
  }

  try {
    const db = admin.firestore();
    const requestRef = db
      .collection(ADMIN_RESET_REQUEST_COLLECTION)
      .doc(String(requestId));
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      return res.status(404).json({ error: "Request not found." });
    }

    const requestData = requestSnap.data();
    if (requestData.status !== "pending") {
      return res.status(400).json({
        error:
          requestData.status === "approved"
            ? "This request has already been approved."
            : "This request can no longer be approved.",
      });
    }

    const now = Date.now();
    const otp = generateOtp();

    await requestRef.update({
      status: "approved",
      approvedBy: req.user.uid,
      approvedAtMs: now,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      otpSent: true,
      otpHash: hashValue(otp),
      otpExpiresAtMs: now + ADMIN_OTP_EXPIRY_MS,
      otpAttempts: 0,
      otpLockedUntilMs: null,
    });

    await sendAdminApprovalEmail(requestData.email, otp);
    await logAuditEvent({
      action: "Admin Password Reset Approved",
      actor: req.user,
      target: { uid: requestData.adminUid, email: requestData.email },
      req,
      status: "Approved",
      requestId: requestRef.id,
    });

    console.log(`Admin password reset approved for ${requestData.email}`);
    return res.json({
      success: true,
      status: "approved",
      message: "Request approved. The OTP has been sent to the administrator.",
    });
  } catch (err) {
    console.error("Approve password reset error:", err);
    return res.status(500).json({ error: "Unable to approve the request." });
  }
});

// POST /api/superadmin/reject-password-reset — reject a request.
app.post("/api/superadmin/reject-password-reset", checkSuperAdmin, async (req, res) => {
  const { requestId } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: "Request ID is required." });
  }

  try {
    const db = admin.firestore();
    const requestRef = db
      .collection(ADMIN_RESET_REQUEST_COLLECTION)
      .doc(String(requestId));
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      return res.status(404).json({ error: "Request not found." });
    }

    const requestData = requestSnap.data();
    if (requestData.status !== "pending") {
      return res.status(400).json({
        error:
          requestData.status === "approved"
            ? "This request has already been approved."
            : "This request can no longer be rejected.",
      });
    }

    const now = Date.now();
    await requestRef.update({
      status: "rejected",
      rejectedBy: req.user.uid,
      rejectedAtMs: now,
      rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await sendAdminRejectionEmail(requestData.email);
    await logAuditEvent({
      action: "Admin Password Reset Rejected",
      actor: req.user,
      target: { uid: requestData.adminUid, email: requestData.email },
      req,
      status: "Rejected",
      requestId: requestRef.id,
    });

    console.log(`Admin password reset rejected for ${requestData.email}`);
    return res.json({
      success: true,
      status: "rejected",
      message: "Request rejected. The administrator has been notified.",
    });
  } catch (err) {
    console.error("Reject password reset error:", err);
    return res.status(500).json({ error: "Unable to reject the request." });
  }
});

// POST /api/admin/verify-reset-otp — verify the OTP for an approved request.
app.post("/api/admin/verify-reset-otp", async (req, res) => {
  const { requestId, otp } = req.body;

  if (!requestId || !otp) {
    return res.status(400).json({ error: "Request ID and code are required." });
  }

  const requestIdClean = String(requestId);
  const otpClean = String(otp).trim();

  try {
    const db = admin.firestore();
    const requestRef = db
      .collection(ADMIN_RESET_REQUEST_COLLECTION)
      .doc(requestIdClean);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      return res.status(404).json({ error: "Request not found." });
    }

    const requestData = requestSnap.data();
    const now = Date.now();

    if (requestData.status !== "approved" || !requestData.otpHash) {
      return res.status(400).json({
        error: "This request has not been approved yet.",
      });
    }

    if (requestData.completed) {
      return res.status(400).json({
        error: "This password reset has already been completed.",
      });
    }

    if (now > requestData.otpExpiresAtMs) {
      return res.status(400).json({
        error: "This code has expired. Please request a new one.",
      });
    }

    if (requestData.otpLockedUntilMs && now < requestData.otpLockedUntilMs) {
      const lockMin = Math.ceil(
        (requestData.otpLockedUntilMs - now) / 60000,
      );
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${lockMin} minute(s).`,
        attemptsRemaining: 0,
      });
    }

    const attempts = requestData.otpAttempts || 0;
    if (attempts >= ADMIN_OTP_MAX_ATTEMPTS) {
      await requestRef.update({ otpLockedUntilMs: now + ADMIN_OTP_LOCK_MS });
      return res.status(429).json({
        error: "Too many failed attempts. Try again in 15 minutes.",
        attemptsRemaining: 0,
      });
    }

    if (hashValue(otpClean) !== requestData.otpHash) {
      const newAttempts = attempts + 1;
      const update = { otpAttempts: newAttempts };
      if (newAttempts >= ADMIN_OTP_MAX_ATTEMPTS) {
        update.otpLockedUntilMs = now + ADMIN_OTP_LOCK_MS;
      }
      await requestRef.update(update);
      const remaining = Math.max(
        0,
        ADMIN_OTP_MAX_ATTEMPTS - newAttempts,
      );
      return res.status(400).json({
        error:
          remaining > 0
            ? `Incorrect code. ${remaining} attempt(s) remaining.`
            : "Too many failed attempts. Try again in 15 minutes.",
        attemptsRemaining: remaining,
      });
    }

    // Correct code — single use. Issue a short-lived reset session.
    const resetToken = crypto.randomBytes(32).toString("hex");
    await db.collection(RESET_SESSION_COLLECTION).doc(hashValue(resetToken)).set({
      uid: requestData.adminUid,
      email: requestData.email,
      requestId: requestRef.id,
      expiresAt: now + ADMIN_RESET_SESSION_EXPIRY_MS,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      used: false,
    });

    // Invalidate the OTP so it cannot be reused.
    await requestRef.update({
      otpHash: null,
      otpExpiresAtMs: null,
    });

    await logAuditEvent({
      action: "Admin Password Reset Code Verified",
      actor: null,
      target: { uid: requestData.adminUid, email: requestData.email },
      req,
      status: "Verified",
      requestId: requestRef.id,
    });

    return res.json({
      success: true,
      resetToken,
      message: "Code verified. You can now create a new password.",
    });
  } catch (err) {
    console.error("Admin verify OTP error:", err);
    return res.status(500).json({ error: "Unable to verify code." });
  }
});

// POST /api/admin/reset-password — validate reset session, update password, revoke sessions.
app.post("/api/admin/reset-password", async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return res
      .status(400)
      .json({ error: "Reset token and new password are required." });
  }

  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.ok) {
    return res.status(400).json({ error: passwordCheck.reason });
  }

  try {
    const db = admin.firestore();
    const sessionRef = db
      .collection(RESET_SESSION_COLLECTION)
      .doc(hashValue(String(resetToken)));
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return res
        .status(400)
        .json({ error: "Invalid or expired reset session." });
    }

    const sessionData = sessionSnap.data();
    const now = Date.now();

    if (sessionData.used) {
      return res
        .status(400)
        .json({ error: "This reset session has already been used." });
    }

    if (now > sessionData.expiresAt) {
      await sessionRef.delete();
      return res
        .status(400)
        .json({ error: "Reset session has expired. Please start over." });
    }

    await admin.auth().updateUser(sessionData.uid, { password: newPassword });
    await admin.auth().revokeRefreshTokens(sessionData.uid);

    if (sessionData.requestId) {
      const requestRef = db
        .collection(ADMIN_RESET_REQUEST_COLLECTION)
        .doc(String(sessionData.requestId));
      try {
        const requestSnap = await requestRef.get();
        if (requestSnap.exists) {
          await requestRef.update({
            status: "completed",
            completed: true,
            completedAtMs: now,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn("Failed to mark request completed:", err.message);
      }
    }

    await sessionRef.delete();
    await logSecurityEvent(sessionData.uid, "admin_password_changed", {
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
    });
    await logAuditEvent({
      action: "Admin Password Reset Completed",
      actor: null,
      target: { uid: sessionData.uid, email: sessionData.email },
      req,
      status: "Completed",
      requestId: sessionData.requestId || null,
    });

    console.log(
      `Admin password updated for ${sessionData.email} (all sessions revoked)`
    );
    return res.json({
      success: true,
      message: "Password updated. All administrator sessions have been signed out.",
    });
  } catch (err) {
    console.error("Admin password reset error:", err);
    return res.status(500).json({ error: "Unable to reset password." });
  }
});

// POST /api/superadmin/promote — grant the superAdmin custom claim (bootstrap).
app.post("/api/superadmin/promote", checkSuperAdmin, async (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }
  const emailClean = normalizeEmail(email);
  if (!SUPER_ADMIN_EMAILS.includes(emailClean)) {
    return res.status(403).json({
      error: "This email is not in the configured Super Admin list.",
    });
  }
  try {
    const userRecord = await admin.auth().getUserByEmail(emailClean);
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      admin: true,
      superAdmin: true,
    });
    await logAuditEvent({
      action: "Super Admin Promoted",
      actor: req.user,
      target: { uid: userRecord.uid, email: emailClean },
      req,
      status: "Promoted",
    });
    return res.json({
      success: true,
      message: `Super Admin privileges granted to ${emailClean}.`,
    });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to grant Super Admin privileges: ${error.message}`,
    });
  }
});

// ── Super Admin: Administrator Management ──

// GET /api/superadmin/admins — list all administrators with their role/claims.
app.get("/api/superadmin/admins", checkSuperAdmin, async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection("admins").get();
    const docs = [];
    snapshot.forEach((d) => docs.push({ uid: d.id, ...d.data() }));

    // Enrich with Auth custom claims so role shown reflects reality.
    let claims = {};
    const uids = docs.map((d) => d.uid);
    if (uids.length > 0) {
      try {
        const result = await admin.auth().getUsers(uids.map((uid) => ({ uid })));
        result.users.forEach((u) => {
          claims[u.uid] = u.customClaims || {};
        });
      } catch (err) {
        console.warn("Failed to load admin claims:", err.message);
      }
    }

    const admins = docs
      .map((d) => {
        const claim = claims[d.uid] || {};
        const isSuperAdmin = claim.superAdmin === true;
        return {
          ...d,
          role: d.role || (isSuperAdmin ? "superAdmin" : "admin"),
          isSuperAdmin,
          hasAdminClaim: claim.admin === true,
          createdAtMs: d.createdAtMs || null,
        };
      })
      .sort(
        (a, b) =>
          (b.createdAtMs || 0) - (a.createdAtMs || 0) ||
          (a.email || "").localeCompare(b.email || ""),
      );

    return res.json({ success: true, admins });
  } catch (err) {
    console.error("List admins error:", err);
    return res.status(500).json({ error: "Unable to load administrators." });
  }
});

// POST /api/superadmin/update-admin — edit admin profile fields and/or Super Admin status.
app.post("/api/superadmin/update-admin", checkSuperAdmin, async (req, res) => {
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).json({ error: "Admin UID is required." });
  }
  if (String(uid) === req.user.uid) {
    return res.status(400).json({
      error: "You cannot edit your own Super Admin account from this screen.",
    });
  }
  try {
    const db = admin.firestore();
    const docRef = db.collection("admins").doc(String(uid));
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Administrator not found." });
    }
    const current = snap.data();

    const profileUpdates = {};
    for (const field of [
      "displayName",
      "position",
      "contactNo",
      "college",
      "schoolId",
      "genderIdentity",
      "nationality",
      "address",
    ]) {
      if (req.body[field] !== undefined) {
        profileUpdates[field] = req.body[field];
      }
    }

    let claimsChanged = false;
    if (typeof req.body.isSuperAdmin === "boolean") {
      if (req.body.isSuperAdmin) {
        await admin.auth().setCustomUserClaims(uid, {
          admin: true,
          superAdmin: true,
        });
        profileUpdates.role = "superAdmin";
        profileUpdates.isSuperAdmin = true;
      } else {
        await admin.auth().setCustomUserClaims(uid, { admin: true });
        profileUpdates.role = "admin";
        profileUpdates.isSuperAdmin = false;
      }
      claimsChanged = true;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await docRef.update(profileUpdates);
    }

    await logAuditEvent({
      action: claimsChanged ? "Admin Updated" : "Admin Profile Updated",
      actor: req.user,
      target: { uid, email: current.email },
      req,
      status: "Updated",
    });

    return res.json({ success: true, message: "Administrator updated." });
  } catch (err) {
    console.error("Update admin error:", err);
    return res.status(500).json({ error: "Unable to update the administrator." });
  }
});

// POST /api/superadmin/revoke-admin — remove admin claims and the admins doc.
app.post("/api/superadmin/revoke-admin", checkSuperAdmin, async (req, res) => {
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).json({ error: "Admin UID is required." });
  }
  if (String(uid) === req.user.uid) {
    return res.status(400).json({ error: "You cannot revoke your own access." });
  }
  try {
    const db = admin.firestore();
    const docRef = db.collection("admins").doc(String(uid));
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Administrator not found." });
    }
    const email = snap.data().email;

    await admin.auth().setCustomUserClaims(String(uid), {});
    await docRef.delete();

    // Clean up any pending reset request tied to this admin.
    try {
      const reqDoc = db
        .collection(ADMIN_RESET_REQUEST_COLLECTION)
        .doc(emailKey(email));
      const rsnap = await reqDoc.get();
      if (rsnap.exists && rsnap.data().status === "pending") {
        await reqDoc.delete();
      }
    } catch {}

    await logAuditEvent({
      action: "Admin Revoked",
      actor: req.user,
      target: { uid, email },
      req,
      status: "Revoked",
    });

    return res.json({
      success: true,
      message: `Admin access revoked for ${email}.`,
    });
  } catch (err) {
    console.error("Revoke admin error:", err);
    return res.status(500).json({ error: "Unable to revoke the administrator." });
  }
});

// POST /api/superadmin/delete-admin — permanently delete the admin account.
app.post("/api/superadmin/delete-admin", checkSuperAdmin, async (req, res) => {
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).json({ error: "Admin UID is required." });
  }
  if (String(uid) === req.user.uid) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }
  try {
    const db = admin.firestore();
    const docRef = db.collection("admins").doc(String(uid));
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Administrator not found." });
    }
    const email = snap.data().email;

    await admin.auth().deleteUser(String(uid));
    await docRef.delete();

    // Clean up any reset request tied to this admin.
    try {
      const reqDoc = db
        .collection(ADMIN_RESET_REQUEST_COLLECTION)
        .doc(emailKey(email));
      const rsnap = await reqDoc.get();
      if (rsnap.exists) {
        await reqDoc.delete();
      }
    } catch {}

    await logAuditEvent({
      action: "Admin Deleted",
      actor: req.user,
      target: { uid, email },
      req,
      status: "Deleted",
    });

    return res.json({
      success: true,
      message: `Administrator ${email} was deleted.`,
    });
  } catch (err) {
    console.error("Delete admin error:", err);
    return res.status(500).json({ error: "Unable to delete the administrator." });
  }
});

// ── Registration OTP (email verification for new sign-ups) ──
const REGISTRATION_OTP_COLLECTION = "registrationOtps";
const REGISTRATION_OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// POST /api/auth/register-otp/request — generate OTP for a new account email
app.post("/api/auth/register-otp/request", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required." });
  }

  const emailClean = email.trim().toLowerCase();

  try {
    // Reject if the email is already registered
    let userExists = false;
    try {
      await admin.auth().getUserByEmail(emailClean);
      userExists = true;
    } catch (err) {
      if (err && err.code === "auth/user-not-found") {
        userExists = false;
      } else {
        console.warn("Failed to check email existence:", err.message);
      }
    }

    if (userExists) {
      return res.status(409).json({
        error: "This email address is already in use by another account.",
      });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + REGISTRATION_OTP_EXPIRY_MS;

    const db = admin.firestore();
    await db.collection(REGISTRATION_OTP_COLLECTION).doc(emailClean).set({
      otp,
      email: emailClean,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      verified: false,
    });

    if (otpTransporter) {
      await sendMailWithLogging({
        to: emailClean,
        subject: "MindCare — Verify Your Email",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#8A63D2;">Verify Your Email</h2>
            <p>Welcome to MindCare! Use the code below to verify your email and finish creating your account.</p>
            <div style="background:#F3EAFF;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
              <p style="font-size:14px;color:#666;margin:0 0 8px;">Your 6-digit code:</p>
              <p style="font-size:36px;font-weight:bold;color:#8A63D2;letter-spacing:8px;margin:0;">${otp}</p>
            </div>
            <p style="color:#666;font-size:14px;">This code expires in <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="color:#999;font-size:12px;">MindCare Student Wellness App</p>
          </div>
        `,
        label: "Registration OTP",
      });
    } else {
      console.log(
        `[OTP TEST MODE] Registration code for ${emailClean}: ${otp}`
      );
    }

    return res.json({
      success: true,
      message: "Verification code sent to your email.",
    });
  } catch (err) {
    console.error("Registration OTP request error:", err);
    return res
      .status(500)
      .json({ error: "Unable to send verification code." });
  }
});

// POST /api/auth/register-otp/verify — verify OTP before account creation
app.post("/api/auth/register-otp/verify", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res
      .status(400)
      .json({ error: "Email and OTP code are required." });
  }

  const emailClean = email.trim().toLowerCase();
  const otpClean = otp.trim();

  try {
    const db = admin.firestore();
    const otpDoc = await db
      .collection(REGISTRATION_OTP_COLLECTION)
      .doc(emailClean)
      .get();

    if (!otpDoc.exists) {
      return res
        .status(400)
        .json({ error: "Invalid or expired verification code." });
    }

    const otpData = otpDoc.data();

    // Idempotent — allow retrying account creation with an already-verified code
    if (otpData.verified) {
      return res.json({ success: true, message: "Email already verified." });
    }

    if (Date.now() > otpData.expiresAt) {
      return res.status(400).json({
        error: "Verification code has expired. Please request a new one.",
      });
    }

    if (otpData.otp !== otpClean) {
      return res
        .status(400)
        .json({ error: "Incorrect verification code. Please try again." });
    }

    await db.collection(REGISTRATION_OTP_COLLECTION).doc(emailClean).update({
      verified: true,
    });

    console.log(`Email verified for ${emailClean}`);
    return res.json({
      success: true,
      message: "Email verified successfully.",
    });
  } catch (err) {
    console.error("Registration OTP verify error:", err);
    return res
      .status(500)
      .json({ error: "Unable to verify code. Please try again." });
  }
});

// ── Mindy Chat (Gemini multi-turn with system instruction) ──
const MINDY_SYSTEM_INSTRUCTION = `You are Mindy, a supportive wellness companion for university students. Respond with empathy, encouragement, and practical coping strategies. Do not diagnose medical or mental health conditions, prescribe medication, or claim to be a licensed professional. If the user expresses thoughts of self-harm, suicide, or harming others, respond calmly, encourage them to seek immediate help from trusted people or local emergency services, and recommend professional support. Keep responses concise (under 200 words), warm, and conversational.`;

app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing message." });
  }

  if (!GEMINI_API_KEY) {
    return res
      .status(500)
      .json({ error: "Gemini API key is not configured on the server." });
  }

  try {
    // Build contents array: system instruction as user/model turn + history + new message
    const contents = [];

    // Prepend system instruction as a "user" + "model" turn so Gemini respects it
    contents.push({
      role: "user",
      parts: [{ text: `System instruction: ${MINDY_SYSTEM_INSTRUCTION}` }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "Understood. I will follow these guidelines." }],
    });

    // Add conversation history
    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role && msg.content) {
          contents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }],
          });
        }
      }
    }

    // Add the new user message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini chat error:", data.error?.message || response.status);
      return res
        .status(500)
        .json({ error: data.error?.message || "Gemini request failed." });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: "Invalid Gemini response." });
    }

    return res.json({ reply: text });
  } catch (err) {
    console.error("Chat route error:", err.message || err);
    return res.status(500).json({ error: "Chat request failed." });
  }
});

// ── Content Moderation for Peer Messaging (Gemini classification) ──
const MODERATION_SYSTEM_PROMPT = `You are a content moderation system for a school wellness messaging app. Your job is to classify student messages as safe, flagged, or blocked.

Classification rules:
- "safe": Normal, respectful conversation. Friendly, supportive, or neutral messages.
- "flagged": Potentially inappropriate — mild bullying, insensitive language, passive-aggressive tone, or mild profanity. May need attention but not necessarily harmful.
- "blocked": Clearly inappropriate — threats, harassment, explicit content, hate speech, self-harm references, or severe bullying.

CRITICAL: Respond ONLY with valid JSON. No markdown, no code fences, no extra text.

Respond with this exact JSON schema:
{
  "status": "safe" | "flagged" | "blocked",
  "reason": "Brief explanation if not safe, empty string if safe"
}`;

app.post("/api/moderate", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text." });
  }

  if (!GEMINI_API_KEY) {
    // If Gemini is not configured, fail open — return safe
    return res.json({ status: "safe", reason: "" });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `System instruction: ${MODERATION_SYSTEM_PROMPT}` }],
            },
            {
              role: "model",
              parts: [{ text: "Understood. I will classify messages accordingly." }],
            },
            {
              role: "user",
              parts: [{ text: `Classify this message: "${text.substring(0, 500)}"` }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 256,
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Moderation error:", data.error?.message || response.status);
      // Fail open
      return res.json({ status: "safe", reason: "" });
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      return res.json({ status: "safe", reason: "" });
    }

    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { status: "safe", reason: "" };
    } catch {
      parsed = { status: "safe", reason: "" };
    }

    // Validate status value
    if (!["safe", "flagged", "blocked"].includes(parsed.status)) {
      parsed.status = "safe";
    }

    return res.json(parsed);
  } catch (err) {
    console.error("Moderation route error:", err.message || err);
    // Fail open
    return res.json({ status: "safe", reason: "" });
  }
});

app.post("/api/ai-proxy", async (req, res) => {
  const { prompt, provider } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing prompt." });
  }

  if (provider === "gemini") {
    if (!GEMINI_API_KEY) {
      return res
        .status(500)
        .json({ error: "Gemini API key is not configured." });
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        return res
          .status(500)
          .json({ error: data.error?.message || "Gemini request failed." });
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        return res.status(500).json({ error: "Invalid Gemini response." });
      }

      let parsed;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { suggestions: [text] };
      } catch (parseError) {
        return res
          .status(500)
          .json({ error: "Failed to parse Gemini response." });
      }

      return res.json(parsed);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Gemini request failed." });
    }
  }

  if (provider === "openai") {
    if (!OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ error: "OpenAI API key is not configured." });
    }

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are Mindy, the supportive AI wellness companion for the Mind Care student app.`,
              },
              { role: "user", content: prompt },
            ],
            max_tokens: 500,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        return res
          .status(500)
          .json({ error: data.error?.message || "OpenAI request failed." });
      }

      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        return res.status(500).json({ error: "Invalid OpenAI response." });
      }

      let parsed;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { suggestions: [text] };
      } catch (parseError) {
        return res
          .status(500)
          .json({ error: "Failed to parse OpenAI response." });
      }

      return res.json(parsed);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "OpenAI request failed." });
    }
  }

  return res.status(400).json({ error: "Unsupported AI provider." });
});

// 3. Keep app.listen at the very bottom of the file
app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
