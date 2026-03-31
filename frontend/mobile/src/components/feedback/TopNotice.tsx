import { useEffect, useRef } from "react";
import { Animated, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";

type Notice = {
  title: string;
  message: string;
  tone: "success" | "error";
} | null;

export default function TopNotice({ notice, style }: { notice: Notice; style?: StyleProp<ViewStyle> }) {
  const { theme } = useAppTheme();
  const translateY = useRef(new Animated.Value(-18)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!notice) return;
    translateY.setValue(-18);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [notice, opacity, translateY]);

  if (!notice) return null;

  const isError = notice.tone === "error";

  return (
    <Animated.View
      style={[
        styles.card,
        style,
        {
          backgroundColor: isError ? theme.dangerSoft : theme.successSoft,
          borderColor: isError ? theme.dangerBorder : theme.successBorder,
          shadowColor: isError ? theme.danger : theme.text,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: isError ? theme.danger : theme.success,
            },
          ]}
        >
          <Text
            style={[
              styles.iconText,
              {
                color: isError ? theme.dangerSoft : theme.successText,
              },
            ]}
          >
            {isError ? "×" : "✓"}
          </Text>
        </View>
        <Text style={[styles.title, { color: isError ? theme.danger : theme.text }]}>{notice.title}</Text>
        <Text style={[styles.message, { color: isError ? theme.danger : theme.subText }]}>{notice.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  iconText: {
    fontSize: 22,
    fontWeight: "800",
  },
  title: {
    fontWeight: "800",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  message: {
    lineHeight: 18,
    fontSize: 13,
    textAlign: "center",
  },
});
