import { useEffect } from 'react';

import { useRouter } from 'expo-router';

export default function EditBusinessProfileScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/business-profile');
  }, [router]);

  return null;
}
