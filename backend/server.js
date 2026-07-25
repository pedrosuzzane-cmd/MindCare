const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const cors = require("cors"); // <--- 1. Import cors

// 1. Load dotenv FIRST so environment variables are available immediately
dotenv.config();

const { Ollama } = require("ollama");
const { Buffer } = require("buffer");
const multer = require("multer");
const Groq = require("groq-sdk");

// 2. Initialize Groq AFTER dotenv.config()
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

// <--- 2. Enable CORS so your frontend (localhost:8081) can talk to ngrok/backend
app.use(cors());
const port = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Lets the mobile app and deployment checks confirm that this exact backend is
// online before attempting a document upload.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "mindcare-backend" });
});

// Initialize Ollama client (connects to local Ollama instance)
const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
});

// Initialize Firebase Admin (for auth user deletion)
let admin;
try {
  admin = require("firebase-admin");
  const serviceAccount = require(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./service-account.json",
  );

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: "mindcare-8801e",
    });
  }
} catch (err) {
  console.warn(
    "firebase-admin not available. Auth user deletion will be skipped.",
  );
}

app.use(bodyParser.json({ limit: "10mb" }));

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

// ── Unified Document Upload & Groq Vision Verification Route ──
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

      // 2. Verify document using Groq's Vision AI model
      console.log("Starting Groq AI verification...");

      const groqSystemPrompt = `
        You are an AI assistant tasked with verifying official documents for a student support app.
        You will be given an image or document (via a URL).
        Your goal is to determine if this document is likely a valid PWD (Person with Disability) ID,
        a medical certificate indicating special needs, or a student special needs accommodation ID.
        
        CRITICAL: Respond ONLY with valid JSON. No markdown, no code fences.

        Respond with this exact JSON schema:
        {
          "is_valid": true,
          "confidence": "high" | "medium" | "low",
          "reasoning": "A brief sentence explaining why it is valid or invalid"
        }
      `;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: groqSystemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Verify this document." },
              {
                type: "image_url",
                image_url: { url: uploadedImageUrl },
              },
            ],
          },
        ],
        model: "llama-3.2-11b-vision-preview",
        temperature: 0,
      });

      const groqResponseText = chatCompletion.choices[0]?.message?.content;
      console.log("Groq Raw Response:", groqResponseText);

      let verificationResult;
      try {
        const cleanJson = groqResponseText.match(/\{[\s\S]*\}/);
        verificationResult = cleanJson
          ? JSON.parse(cleanJson[0])
          : { is_valid: false };
      } catch (parseError) {
        console.error("Error parsing Groq JSON:", parseError);
        throw new Error("Failed to parse AI verification result.");
      }

      // 3. Handle Verification Outcome
      if (!verificationResult.is_valid) {
        // Delete invalid/fake images from Cloudinary immediately
        try {
          await cloudinary.uploader.destroy(result.public_id);
          console.log(
            "Deleted invalid document from Cloudinary:",
            result.public_id,
          );
        } catch (delErr) {
          console.error(
            "Error deleting invalid image from Cloudinary:",
            delErr,
          );
        }

        return res.status(400).json({
          error: "AI Verification Failed",
          details:
            verificationResult.reasoning ||
            "Document does not appear to be a valid ID/certificate.",
        });
      }

      // 4. Success Response
      console.log("Document verified as valid by Groq.");
      return res.json({
        success: true,
        message: "Document uploaded and verified successfully.",
        secureUrl: uploadedImageUrl,
        publicId: result.public_id,
        ai_verification: verificationResult,
      });
    } catch (error) {
      console.error("Upload/Verification error:", error.message);
      return res
        .status(500)
        .json({ error: `Upload and verification failed: ${error.message}` });
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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
