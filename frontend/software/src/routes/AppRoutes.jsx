import { Routes, Route } from "react-router-dom";

import Layout from "../layout/layout";
import { appRoutes } from "./RouteConfig";

import ProtectedRoute from "./ProtectedRoute";
import PermissionRoute from "./PermissionRoute";

import Login from "../pages/LoginForm";

const AppRoutes = () => {
  return (
    <Routes>

      {/* PUBLIC ROUTE */}
      <Route path="/login" element={<Login />} />

      {/* PROTECTED ROUTES */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >

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
              path={route.path === "/" ? undefined : route.path.substring(1)}
              index={route.path === "/"}
              element={element}
            >
              {route.children?.map((child, ci) => (
                <Route
                  key={ci}
                  path={child.path}
                  element={child.element}
                />
              ))}
            </Route>
          );
        })}

      </Route>

    </Routes>
  );
};

export default AppRoutes;