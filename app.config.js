const dotenv = require("dotenv");

dotenv.config({ path: ".env" });

module.exports = ({ config }) => {
  // Set APP_DOMAIN in your environment for production (e.g. example.com)
  const domain = process.env.APP_DOMAIN || "example.com";

  return {
    ...config,
    expo: {
      ...config.expo,
      plugins: [
        ...(config.expo?.plugins || []),
        "expo-font",
        [
          "expo-build-properties",
          {
            android: {
              compileSdkVersion: 34,
              targetSdkVersion: 34,
              buildToolsVersion: "34.0.0",
              minSdkVersion: 23,
              kotlinVersion: "1.9.24",
            },
          },
        ],
      ],
      scheme: config.expo?.scheme || "mindcarev2",
      ios: {
        ...(config.expo?.ios || {}),
        associatedDomains: [`applinks:${domain}`],
      },
      android: {
        ...(config.expo?.android || {}),
        package: config.expo?.android?.package || "com.nervachan.MindCareV2",
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
        eas: {
          projectId: "ca3225f1-2645-409c-8c8c-6394926367cc",
        },
      },
    },
  };
};
