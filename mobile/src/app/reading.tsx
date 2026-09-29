import { Redirect } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { getCurrentReading } from "../lib/currentReading";
import { colors } from "../lib/theme";
import type { Glass } from "../lib/types";

export default function ReadingScreen() {
  const current = getCurrentReading();
  if (!current) return <Redirect href="/" />;
  const { reading, photoUri } = current;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={{ uri: photoUri }} style={styles.photo} />
      {reading.repeat && (
        <Text style={styles.banner}>
          I've read this glass already. The foam doesn't change its mind: here's the same reading.
        </Text>
      )}
      {reading.message && <Text style={styles.message}>{reading.message}</Text>}
      {reading.glasses.map((glass, i) => (
        <GlassCard key={i} glass={glass} />
      ))}
      <Text style={styles.disclaimer}>
        For entertainment only. The foam knows many things, but not the future. Please drink responsibly.
      </Text>
    </ScrollView>
  );
}

function GlassCard({ glass }: { glass: Glass }) {
  const { foam, reading } = glass;
  const confidence = `${Math.round(glass.beer_confidence * 100)}% sure it's beer`;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        {glass.position} · {glass.vessel}
      </Text>
      <Text style={styles.meta}>
        {glass.is_beer ? `${glass.style_guess} · ${confidence}` : "Not beer, as far as I can tell"}
      </Text>

      {reading ? (
        <>
          <Text style={styles.headline}>{reading.headline}</Text>
          {reading.timeline.map((segment) => (
            <View key={segment.hours} style={styles.segment}>
              <Text style={styles.hours}>Hours {segment.hours}</Text>
              <Text style={styles.body}>{segment.prediction}</Text>
              <Text style={styles.sign}>Read from: {segment.foam_sign}</Text>
            </View>
          ))}
          <Text style={styles.body}>🍀 Lucky: {reading.lucky_thing}</Text>
          <Text style={styles.body}>⚠️ Beware: {reading.beware}</Text>
          <Text style={styles.sign}>
            Foam: {foam.head_thickness} head, {foam.bubble_size} bubbles, {foam.density}
            {foam.shapes_seen.length > 0 ? ` · ${foam.shapes_seen.join(" · ")}` : ""}
          </Text>
        </>
      ) : (
        <Text style={styles.body}>{glass.beer_evidence}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 48 },
  photo: { width: "100%", aspectRatio: 3 / 4, borderRadius: 16 },
  banner: { color: colors.background, backgroundColor: colors.amber, borderRadius: 12, padding: 12, fontWeight: "600" },
  message: { color: colors.foam, fontSize: 17, textAlign: "center" },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { color: colors.foam, fontSize: 18, fontWeight: "700", textTransform: "capitalize" },
  meta: { color: colors.muted },
  headline: { color: colors.amber, fontSize: 20, fontWeight: "700", marginTop: 4 },
  segment: { borderLeftWidth: 3, borderLeftColor: colors.amber, paddingLeft: 12, gap: 2 },
  hours: { color: colors.amber, fontWeight: "700" },
  body: { color: colors.foam, fontSize: 16, lineHeight: 22 },
  sign: { color: colors.muted, fontStyle: "italic" },
  disclaimer: { color: colors.muted, textAlign: "center", fontSize: 13 },
});
