import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="check-email" />
      <Stack.Screen name="otp-verification" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="password-success" />
      <Stack.Screen name="admin-request-reset" />
      <Stack.Screen name="admin-request-submitted" />
      <Stack.Screen name="admin-verify-otp" />
      <Stack.Screen name="admin-new-password" />
      <Stack.Screen name="admin-password-success" />
    </Stack>
  );
}
