import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import AppShellScreen from "../screens/AppShellScreen";
import MoreScreen from "../screens/MoreScreen";
import TeacherDetailsScreen from "../screens/TeacherDetailsScreen";
import { useAuthStore } from "../store/authStore";

export type RootStackParamList = {
  Login: undefined;
  AppShell: { tab?: string } | undefined;
  More: undefined;
  TeacherDetails: { teacherId: number; teacherName?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {accessToken ? (
        <>
          <Stack.Screen name="AppShell" component={AppShellScreen} />
          <Stack.Screen name="More" component={MoreScreen} />
          <Stack.Screen name="TeacherDetails" component={TeacherDetailsScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
