import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#ffffff',
          },
          headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Login', headerShown: false }} />
        <Stack.Screen name="home" options={{ title: 'Dashboard', headerShown: false }} />
        <Stack.Screen name="scan" options={{ title: 'Scan VIN', presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="details" options={{ title: 'Inspection Details' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
