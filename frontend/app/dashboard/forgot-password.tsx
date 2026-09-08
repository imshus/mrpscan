/**
 * The same OTP reset flow the login stack has, reachable while signed in.
 * Password Manager links here: the login group's layout redirects any
 * authenticated visitor straight to the dashboard, so linking to the login
 * copy of this screen bounced people to the home page instead.
 */
export { default } from '../login/forgot-password';
