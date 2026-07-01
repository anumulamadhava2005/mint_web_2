// @ts-nocheck
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MintProvider } from "../lib/MintProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <MintProvider>
        <Stack screenOptions={{ headerStyle: { backgroundColor: "#0B0B0F" }, headerTintColor: "#fff", contentStyle: { backgroundColor: "#0B0B0F" } }}>
          <Stack.Screen name="index" options={{ title: "Login" }} />
          <Stack.Screen name="sign-up" options={{ title: "Sign Up" }} />
          <Stack.Screen name="dashboard" options={{ title: "Dashboard" }} />
          <Stack.Screen name="new-expense" options={{ title: "New Expense" }} />
        </Stack>
      </MintProvider>
    </SafeAreaProvider>
  );
}
