// 1. Load dotenv FIRST so environment variables are available immediately
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors"); // <--- 1. Import cors

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

// Endpoint to grant admin privileges to a user
app.post("/api/grant-admin", checkAdmin, async (req, res) => {
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

// ── Forgot Password OTP (custom 6-digit code via Gmail SMTP) ──
const crypto = require("crypto");
const { sendOtpEmail } = require("./services/emailService");

const OTP_COLLECTION = "passwordResets";
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

// POST /api/auth/forgot-password/request — generate OTP, store in Firestore, send email
app.post("/api/auth/forgot-password/request", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required." });
  }

  const emailClean = email.trim().toLowerCase();

  try {
    // Look up user by email
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(emailClean);
    } catch {
      // Don't reveal whether the email exists — pretend success
      return res.json({
        success: true,
        message:
          "If an account exists, a reset code has been sent to that email.",
      });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    // Store OTP in Firestore
    const db = admin.firestore();
    await db.collection(OTP_COLLECTION).doc(userRecord.uid).set({
      otp,
      email: emailClean,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      verified: false,
    });

    // Send OTP email
    const mailOptions = {
      from: process.env.SMTP_FROM || "MindCare <noreply@mindcare.app>",
      to: emailClean,
      subject: "MindCare — Password Reset Code",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#8A63D2;">Password Reset Code</h2>
          <p>You requested a password reset for your MindCare account.</p>
          <div style="background:#F3EAFF;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
            <p style="font-size:14px;color:#666;margin:0 0 8px;">Your 6-digit code:</p>
            <p style="font-size:36px;font-weight:bold;color:#8A63D2;letter-spacing:8px;margin:0;">${otp}</p>
          </div>
          <p style="color:#666;font-size:14px;">This code expires in <strong>10 minutes</strong>. If you didn't request this, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="color:#999;font-size:12px;">MindCare Student Wellness App</p>
        </div>
      `,
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await sendOtpEmail({
        to: emailClean,
        subject: mailOptions.subject,
        html: mailOptions.html,
      });
      console.log(`OTP email sent to ${emailClean}`);
    } else {
      // Fallback: log OTP to console for testing
      console.log(`[OTP TEST MODE] Code for ${emailClean}: ${otp}`);
    }

    return res.json({
      success: true,
      message:
        "If an account exists, a reset code has been sent to that email.",
    });
  } catch (err) {
    console.error("OTP request error:", err);
    return res
      .status(500)
      .json({ error: "Unable to process password reset request." });
  }
});

// POST /api/auth/forgot-password/verify-and-reset — verify OTP + set new password
app.post("/api/auth/forgot-password/verify-and-reset", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res
      .status(400)
      .json({ error: "Email, OTP code, and new password are required." });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters." });
  }

  const emailClean = email.trim().toLowerCase();
  const otpClean = otp.trim();

  try {
    const db = admin.firestore();

    // Find user by email
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(emailClean);
    } catch {
      return res.status(400).json({ error: "Invalid or expired reset code." });
    }

    // Get stored OTP record
    const otpDoc = await db.collection(OTP_COLLECTION).doc(userRecord.uid).get();

    if (!otpDoc.exists) {
      return res.status(400).json({ error: "Invalid or expired reset code." });
    }

    const otpData = otpDoc.data();

    // Check if OTP was already used
    if (otpData.verified) {
      return res.status(400).json({ error: "Reset code has already been used." });
    }

    // Check expiry
    if (Date.now() > otpData.expiresAt) {
      return res.status(400).json({ error: "Reset code has expired. Please request a new one." });
    }

    // Verify OTP
    if (otpData.otp !== otpClean) {
      return res.status(400).json({ error: "Incorrect reset code. Please try again." });
    }

    // All checks passed — update password
    await admin.auth().updateUser(userRecord.uid, {
      password: newPassword,
    });

    // Mark OTP as used
    await db.collection(OTP_COLLECTION).doc(userRecord.uid).update({
      verified: true,
    });

    console.log(`Password updated for ${emailClean}`);
    return res.json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (err) {
    console.error("OTP verify-and-reset error:", err);
    return res
      .status(500)
      .json({ error: "Unable to reset password. Please try again." });
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

    const mailOptions = {
      from: process.env.SMTP_FROM || "MindCare <noreply@mindcare.app>",
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
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await sendOtpEmail({
        to: emailClean,
        subject: mailOptions.subject,
        html: mailOptions.html,
      });
      console.log(`Registration OTP email sent to ${emailClean}`);
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
