import { Image, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { GradientView } from '@/components/ui/GradientView';
import { Colors, Fonts, Gradients } from '@/constants/theme';

interface BusinessProfileBannerProps {
  businessName: string;
  secondaryText?: string;
  logoUri?: string | null;
  showChevron?: boolean;
}

export function BusinessProfileBanner({
  businessName,
  secondaryText,
  logoUri,
  showChevron = true,
}: BusinessProfileBannerProps) {
  const initial = businessName.trim().charAt(0).toUpperCase() || 'B';

  return (
    <GradientView
      colors={Gradients.trial}
      borderRadius={20}
      style={styles.profileCard}
    >
      <View style={styles.avatarWrap}>
        {logoUri ? (
          <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="cover" />
        ) : (
          <Text style={styles.avatarText}>{initial}</Text>
        )}
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.profileName} numberOfLines={2}>
          {businessName}
        </Text>
        {secondaryText ? (
          <Text style={styles.profileMeta} numberOfLines={1}>
            {secondaryText}
          </Text>
        ) : null}
      </View>

      {showChevron ? (
        <ChevronRight size={18} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
      ) : null}
    </GradientView>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 94,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 18,
    gap: 14,
    shadowColor: '#3C140F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 6,
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 22.4,
    fontWeight: '800',
    fontFamily: Fonts.display,
    color: Colors.brandDeep,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
    color: Colors.white,
  },
  profileMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
});
