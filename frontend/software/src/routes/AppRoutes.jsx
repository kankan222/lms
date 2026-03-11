import { Routes, Route } from "react-router-dom";

import Layout from "../layout/layout";
import { appRoutes, hiddenRoutes } from "./RouteConfig";

import ProtectedRoute from "./ProtectedRoute";
import PublicRoute from "./PublicRoute";
import PermissionRoute from "./PermissionRoute";
import RoleLandingRoute from "./RoleLandingRoute";

import Login from "../pages/LoginForm";
import Unauthorized from "../pages/Unauthorized";

const AppRoutes = () => {
  return (
    <Routes>
      {/* PUBLIC ROUTE */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/unauthorized"
        element={
          <ProtectedRoute>
            <Unauthorized />
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
          let element = route.element;

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
