import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../theme/AppThemeProvider";

type NativeAlertButton = {
  text?: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

type AlertState = {
  title: string;
  message?: string;
  buttons: NativeAlertButton[];
  cancelable: boolean;
} | null;

type AppAlertContextValue = {
  showAlert: (title: string, message?: string, buttons?: NativeAlertButton[], options?: { cancelable?: boolean }) => void;
};

const AppAlertContext = createContext<AppAlertContextValue | null>(null);
let externalShowAlert: AppAlertContextValue["showAlert"] | null = null;
let nativeAlertInstalled = false;
const originalAlert = Alert.alert;

function normalizeButtons(buttons?: NativeAlertButton[]) {
  const rows = Array.isArray(buttons) && buttons.length ? buttons : [{ text: "OK", style: "default" as const }];
  return rows.map((button) => ({
    text: button.text || "OK",
    onPress: button.onPress,
    style: button.style || "default",
  }));
}

function installAppAlertBridge() {
  if (nativeAlertInstalled) return;
  nativeAlertInstalled = true;
  (Alert as unknown as { alert: typeof Alert.alert }).alert = (title, message, buttons, options) => {
    if (!externalShowAlert) {
      originalAlert(title, message, buttons, options);
      return;
    }
    externalShowAlert(String(title || ""), message ? String(message) : "", buttons as NativeAlertButton[] | undefined, {
      cancelable: options?.cancelable,
    });
  };
}

installAppAlertBridge();

export function AppAlertProvider({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();
  const [alertState, setAlertState] = useState<AlertState>(null);

  const value = useMemo<AppAlertContextValue>(() => ({
    showAlert: (title, message, buttons, options) => {
      setAlertState({
        title,
        message,
        buttons: normalizeButtons(buttons),
        cancelable: options?.cancelable !== false,
      });
    },
  }), []);

  externalShowAlert = value.showAlert;

  function closeAlert(button?: NativeAlertButton) {
    setAlertState(null);
    button?.onPress?.();
  }

  return (
    <AppAlertContext.Provider value={value}>
      {children}
      <Modal
        transparent
        visible={Boolean(alertState)}
        animationType="fade"
        onRequestClose={() => {
          if (alertState?.cancelable) setAlertState(null);
        }}
      >
        <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: theme.text }]}>
            <Text style={[styles.title, { color: theme.text }]}>{alertState?.title}</Text>
            {alertState?.message ? <Text style={[styles.message, { color: theme.subText }]}>{alertState.message}</Text> : null}
            <View style={styles.actions}>
              {(alertState?.buttons || []).map((button, index) => {
                const destructive = button.style === "destructive";
                const cancel = button.style === "cancel";
                return (
                  <Pressable
                    key={`${button.text}-${index}`}
                    style={[
                      styles.actionButton,
                      {
                        borderColor: destructive ? theme.dangerBorder : theme.border,
                        backgroundColor: destructive ? theme.dangerSoft : cancel ? theme.cardMuted : theme.primary,
                      },
                    ]}
                    onPress={() => closeAlert(button)}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        {
                          color: destructive ? theme.danger : cancel ? theme.text : theme.primaryText,
                        },
                      ]}
                    >
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AppAlertContext.Provider>
  );
}

export function useAppAlert() {
  const value = useContext(AppAlertContext);
  if (!value) {
    throw new Error("useAppAlert must be used within AppAlertProvider");
  }
  return value;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    marginTop: 8,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  actions: {
    marginTop: 18,
    gap: 10,
  },
  actionButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    fontWeight: "700",
  },
});
