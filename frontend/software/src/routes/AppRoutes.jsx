import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

import Layout from "../layout/layout";
import { appRoutes, hiddenRoutes } from "./RouteConfig";

import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import PermissionRoute from "./PermissionRoute";
import RoleLandingRoute from "./RoleLandingRoute";

import { useAuth } from "../hooks/useAuth";
import { isRouteAllowedForUser } from "./RouteConfig";

const Login = lazy(() => import("../pages/LoginForm"));
const Unauthorized = lazy(() => import("../pages/Unauthorized"));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Loading...
    </div>
  );
}

const AppRoutes = () => {
  const { user } = useAuth();
  return (
    <Routes>
      {/* PUBLIC ROUTE */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Suspense fallback={<RouteFallback />}>
              <Login />
            </Suspense>
          </PublicRoute>
        }
      />
      <Route
        path="/unauthorized"
        element={
          <ProtectedRoute>
            <Suspense fallback={<RouteFallback />}>
              <Unauthorized />
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* PROTECTED ROUTES */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleLandingRoute />} />

        {appRoutes.map((route, i) => {
          let element = route.element;

          if (!isRouteAllowedForUser(route, user)) {
            element = (
              <Suspense fallback={<RouteFallback />}>
                <Unauthorized />
              </Suspense>
            );
          } else {
            element = <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
          }

          if (route.permission) {
            element = (
              <PermissionRoute permission={route.permission}>
                {element}
              </PermissionRoute>
            );
          }

          return (
            <Route
              key={i}
              path={route.path.substring(1)}
              element={element}
            ></Route>
          );
        })}
        {hiddenRoutes.map((route, i) => {
          let element = <Suspense fallback={<RouteFallback />}>{route.element}</Suspense>;

          if (route.permission) {
            element = (
              <PermissionRoute permission={route.permission}>
                {element}
              </PermissionRoute>
            );
          }

          return (
            <Route
              key={`hidden-${i}`}
              path={route.path.substring(1)}
              element={element}
            />
          );
        })}
      </Route>
    </Routes>
  );
};

export default AppRoutes;
