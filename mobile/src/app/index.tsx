import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { requestReading } from "../lib/api";
import { setCurrentReading } from "../lib/currentReading";
import { colors } from "../lib/theme";

const AGE_KEY = "age-confirmed";

export default function CameraScreen() {
  const [ageConfirmed, setAgeConfirmed] = useState<boolean | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(AGE_KEY).then((value) => setAgeConfirmed(value === "yes"));
  }, []);

  if (ageConfirmed === null || !permission) {
    return <View style={styles.center} />;
  }

  if (!ageConfirmed) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Are you of legal drinking age where you live?</Text>
        <Button
          label="Yes, I am"
          onPress={() => {
            SecureStore.setItemAsync(AGE_KEY, "yes");
            setAgeConfirmed(true);
          }}
        />
        <Text style={styles.note}>Foam Oracle is for adults. Please drink responsibly.</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>The oracle needs to see your foam.</Text>
        <Button label="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  async function capture() {
    if (!camera.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9 });
      const reading = await requestReading(photo);
      setCurrentReading({ reading, photoUri: photo.uri });
      router.push("/reading");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
      <View style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.hint}>
          Get close to the foam, in good light.{"\n"}Several glasses? Each one gets its own reading.
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.amber} size="large" />
            <Text style={styles.hint}>The oracle is reading your foam…</Text>
          </View>
        ) : (
          <Pressable
            accessibilityLabel="Take photo"
            disabled={!ready}
            onPress={capture}
            style={({ pressed }) => [styles.shutter, (pressed || !ready) && { opacity: 0.6 }]}
          />
        )}
      </View>
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 20 },
  title: { color: colors.foam, fontSize: 22, fontWeight: "600", textAlign: "center" },
  note: { color: colors.muted, textAlign: "center" },
  button: { backgroundColor: colors.amber, borderRadius: 999, paddingHorizontal: 28, paddingVertical: 14 },
  buttonLabel: { color: colors.background, fontSize: 17, fontWeight: "700" },
  overlay: { flex: 1, justifyContent: "flex-end", alignItems: "center", padding: 24, gap: 16 },
  hint: {
    color: colors.foam,
    textAlign: "center",
    backgroundColor: "rgba(26, 18, 11, 0.6)",
    borderRadius: 12,
    padding: 10,
  },
  error: { color: colors.foam, backgroundColor: colors.danger, borderRadius: 12, padding: 10, textAlign: "center" },
  busy: { alignItems: "center", gap: 12, marginBottom: 12 },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.foam,
    borderWidth: 6,
    borderColor: colors.amber,
    marginBottom: 12,
  },
});
