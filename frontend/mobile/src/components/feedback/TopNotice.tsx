import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";

type Notice = {
  title: string;
  message: string;
  tone: "success" | "error";
} | null;

export default function TopNotice({ notice }: { notice: Notice }) {
  const { theme } = useAppTheme();

  if (!notice) return null;

  const isError = notice.tone === "error";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isError ? "#fef2f2" : "#f0fdf4",
          borderColor: isError ? "#fecaca" : "#bbf7d0",
        },
      ]}
    >
      <Text style={[styles.title, { color: isError ? "#991b1b" : theme.text }]}>{notice.title}</Text>
      <Text style={[styles.message, { color: isError ? "#b91c1c" : theme.subText }]}>{notice.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  title: {
    fontWeight: "800",
    marginBottom: 2,
  },
  message: {
    lineHeight: 18,
  },
});
