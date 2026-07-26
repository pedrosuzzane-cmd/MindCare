const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });

module.exports = ({ config }) => {
  // Set APP_DOMAIN in your environment for production (e.g. example.com)
  const domain = process.env.APP_DOMAIN || "example.com";

  return {
    ...config,
    expo: {
      ...config.expo,
      plugins: [
        ...(config.expo?.plugins || []),
      ],
      scheme: config.expo?.scheme || "mindcarev2",
      ios: {
        ...(config.expo?.ios || {}),
        associatedDomains: [`applinks:${domain}`],
      },
      android: {
        ...(config.expo?.android || {}),
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
        ...(config.expo?.extra || {}),
        aiBackendUrl: process.env.AI_BACKEND_URL || "http://localhost:3000",
      },
    },
  };
};
