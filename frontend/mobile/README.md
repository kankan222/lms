# LMS Mobile (Expo + React Native)

Production-ready mobile scaffold for the existing LMS backend (`Node/Express/MySQL/JWT/RBAC`).

## Stack

- Expo + React Native + TypeScript
- React Navigation (native stack)
- Axios (with auth + refresh interceptors)
- Zustand (auth state)
- Expo Secure Store (token persistence)
- dotenv (`app.config.ts`) + `EXPO_PUBLIC_*` env pattern

## Environment

1. Copy env template:

```bash
cp .env.example .env
```

2. Set API URL in `.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

## Run

```bash
npm install
npx expo start
```

Shortcuts from terminal:

- `a`: Android emulator
- `i`: iOS simulator (macOS only)
- Scan QR with Expo Go for physical device

## API URL Rules

- Android emulator -> use host machine as `10.0.2.2`:
  - `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:5000/api/v1`
- iOS simulator -> can use `http://localhost:5000/api/v1`
- Physical device -> use machine LAN IP:
  - `http://192.168.x.x:5000/api/v1`

## Current Base Flow

- `LoginScreen` -> `POST /auth/login`
- Tokens stored in `SecureStore`
- Access token auto-attached to all requests
- On `401`, refresh via `POST /auth/refresh`
- If refresh fails, user is logged out

## Folder Structure

```txt
src/
  components/
  constants/
    env.ts
  hooks/
  navigation/
    AppNavigator.tsx
  screens/
    LoginScreen.tsx
    DashboardScreen.tsx
  services/
    api.ts
    authService.ts
  store/
    authStore.ts
  types/
    auth.ts
  utils/
```

