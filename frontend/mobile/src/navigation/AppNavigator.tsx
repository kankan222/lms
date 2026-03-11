import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import AppShellScreen from "../screens/AppShellScreen";
import { useAuthStore } from "../store/authStore";

export type RootStackParamList = {
  Login: undefined;
  AppShell: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {accessToken ? (
        <Stack.Screen name="AppShell" component={AppShellScreen} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
