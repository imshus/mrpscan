import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';

import { BottomNav } from '@/components/dashboard/BottomNav';
import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { screenStyles } from '@/constants/screenLayout';
import { SUPPORT_EMAIL, openSupportEmail, talkToAgent } from '@/constants/support';
import { Colors } from '@/constants/theme';
import { useAuthStore } from '@/store/authStore';
import { getBusinessProfile } from '@/utils/businessProfile';

interface ContactRow {
  id: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

/** Laid out like Masters: the same header, list rows and bottom bar. */
export default function ContactUsScreen() {
  const registration = useAuthStore((s) => s.registration);
  const profile = getBusinessProfile(registration);

  const rows: ContactRow[] = [
    {
      id: 'email',
      title: 'Email Us',
      subtitle: SUPPORT_EMAIL,
      onPress: () => void openSupportEmail(profile.businessName),
    },
    {
      id: 'call',
      title: 'Talk to Our Agent',
      subtitle: 'Customer care voice agent',
      onPress: () => void talkToAgent(),
    },
  ];

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />
      <PageHeader title="Contact Us" subtitle="Settings → Contact Us" />
      <View style={screenStyles.screenBody}>
        <View style={screenStyles.list}>
          {rows.map((row) => (
            <Pressable
              key={row.id}
              onPress={row.onPress}
              accessibilityRole="button"
              style={screenStyles.listRow}
            >
              <View style={screenStyles.listRowText}>
                <Text style={screenStyles.listRowTitle}>{row.title}</Text>
                {row.subtitle ? (
                  <Text style={screenStyles.listRowSubtitle}>{row.subtitle}</Text>
                ) : null}
              </View>
              <ChevronRight size={18} color={Colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>
      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}
