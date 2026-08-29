import { Redirect } from 'expo-router';

/**
 * Mockup onboarding starts directly at Login (Splash → Login) —
 * the old "Get Started Now" landing screen was removed.
 */
export default function Index() {
  return <Redirect href="/login" />;
}
