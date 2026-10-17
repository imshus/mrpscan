import ForgotMpinScreen from '../login/forgot-mpin';

/**
 * The same Forgot MPIN screen the login stack has, reachable while signed in
 * from MPIN Manager's "Forgot MPIN?" link. The login group's layout sends any
 * authenticated visitor straight to the dashboard, so the link cannot open
 * the login copy; this one ends back on MPIN Manager instead of Log In.
 */
export default function DashboardForgotMpinScreen() {
  return <ForgotMpinScreen returnTo="mpin-manager" />;
}
