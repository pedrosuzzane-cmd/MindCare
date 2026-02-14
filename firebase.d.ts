// Type declarations for Firebase Web SDK subpackages
// firebase@12.9.0 has broken typings paths — re-export from @firebase/* instead

declare module "firebase/app" {
  export * from "@firebase/app";
}

declare module "firebase/auth" {
  export * from "@firebase/auth";
}

declare module "firebase/firestore" {
  export * from "@firebase/firestore";
}
