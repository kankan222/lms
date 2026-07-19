import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import AppShellScreen from "../screens/AppShellScreen";
import MoreScreen from "../screens/MoreScreen";
import TeacherDetailsScreen from "../screens/TeacherDetailsScreen";
import MessagingComposeScreen, { type MessagingComposeResult } from "../screens/MessagingComposeScreen";
import MessagingPhotoPreviewScreen from "../screens/MessagingPhotoPreviewScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import { useAuthStore } from "../store/authStore";

export type RootStackParamList = {
  Login: undefined;
  AppShell: { tab?: string; composeTarget?: MessagingComposeResult } | undefined;
  More: undefined;
  TeacherDetails: { teacherId: number; teacherName?: string };
  MessagingCompose: undefined;
  MessagingPhotoPreview: { uri: string; title?: string };
  Notifications: undefined;
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
          <Stack.Screen name="MessagingCompose" component={MessagingComposeScreen} />
          <Stack.Screen name="MessagingPhotoPreview" component={MessagingPhotoPreviewScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
