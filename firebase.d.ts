// Type declarations for Firebase Web SDK subpackages
// firebase@12.9.0 has broken typings paths — re-export from @firebase/* instead

declare module "firebase/app" {
  export * from "@firebase/app";
}

declare module "firebase/auth" {
  import { Persistence } from "@firebase/auth";
  export * from "@firebase/auth";
  export function getReactNativePersistence(
    storage: any,
  ): Persistence;
}

declare module "firebase/firestore" {
  export * from "@firebase/firestore";
}
