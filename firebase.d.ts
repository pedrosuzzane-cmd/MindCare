// Type declarations for Firebase Web SDK subpackages
// firebase@10.14.1 — re-export from @firebase/* for module resolution

declare module "firebase/app" {
  export * from "@firebase/app";
}

declare module "firebase/auth" {
  export * from "@firebase/auth";

  export function initializeAuth(
    app: import("@firebase/app").FirebaseApp,
    deps?: { persistence?: any },
  ): import("@firebase/auth").Auth;

  export function getReactNativePersistence(
    storage: any,
  ): import("@firebase/auth").Persistence;
}

declare module "firebase/firestore" {
  export * from "@firebase/firestore";
}
