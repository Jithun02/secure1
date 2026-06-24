import { createBrowserRouter } from "react-router";
import { AutofillSettingsScreen } from "./screens/AutofillSettingsScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { SignUpScreen } from "./screens/SignUpScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { AddPasswordScreen } from "./screens/AddPasswordScreen";
import { PasswordDetailsScreen } from "./screens/PasswordDetailsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { PasswordGeneratorScreen } from "./screens/PasswordGeneratorScreen";
import { BackupRecoveryScreen } from "./screens/BackupRecoveryScreen";
import { AuditDashboardScreen } from "./screens/AuditDashboardScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LoginScreen,
  },
  {
    path: "/signup",
    Component: SignUpScreen,
  },
  {
    path: "/dashboard",
    Component: DashboardScreen,
  },
  {
    path: "/add-password",
    Component: AddPasswordScreen,
  },
  {
    path: "/password/:id",
    Component: PasswordDetailsScreen,
  },
  {
    path: "/settings",
    Component: SettingsScreen,
  },
  {
    path: "/generator",
    Component: PasswordGeneratorScreen,
  },
  {
    path: "/backup",
    Component: BackupRecoveryScreen,
  },
  {
    path: "/audit",
    Component: AuditDashboardScreen,
  },
    {
      path: "/autofill-settings",
      Component: AutofillSettingsScreen,
    },
]);