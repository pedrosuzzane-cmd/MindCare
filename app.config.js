const dotenv = require("dotenv");

dotenv.config({ path: ".env" });

module.exports = ({ config }) => {
  // config is already the Expo configuration loaded from app.json.
  // Extend it here; never wrap it in a new `expo` object.
  const domain = process.env.APP_DOMAIN || "example.com";
  const aiBackendUrl = process.env.AI_BACKEND_URL || "http://localhost:3000";
  const easProjectId =
    process.env.EAS_PROJECT_ID || "ca3225f1-2645-409c-8c8c-6394926367cc";

  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      "expo-font",
    ],
    scheme: config.scheme || "mindcarev2",
    ios: {
      ...(config.ios || {}),
      associatedDomains: [`applinks:${domain}`],
    },
    android: {
      ...(config.android || {}),
      package: config.android?.package || "com.nervachan.MindCareV2",
      intentFilters: [
        {
          action: "VIEW",
          data: [
            { scheme: "https", host: domain, pathPrefix: "/" },
            { scheme: "https", host: `www.${domain}`, pathPrefix: "/" },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    extra: {
      ...(config.extra || {}),
      aiBackendUrl,
      eas: {
        ...(config.extra?.eas || {}),
        projectId: easProjectId,
      },
    },
  };
};
