import { ActivityIndicator, StyleSheet, View } from "react-native";

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#8A63D2" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F0F8FF",
  },
});
