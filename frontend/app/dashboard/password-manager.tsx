import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackgroundPattern } from '@/components/ui/BackgroundPattern';
import { PageHeader } from '@/components/ui/PageHeader';
import { BottomNav } from '@/components/dashboard/BottomNav';
import { screenStyles } from '@/constants/screenLayout';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { changeUserPassword } from '@/utils/authApi';

const BUTTON_GREEN = '#A81F17';

export default function PasswordManagerScreen() {
  const router = useRouter();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    setError(null);
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);
    const result = await changeUserPassword(currentPassword, newPassword);
    setLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Your password has been updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } else {
      setError(result.error || 'Failed to update password');
    }
  };

  return (
    <SafeAreaView style={screenStyles.safeArea} edges={['top']}>
      <BackgroundPattern />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={screenStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Password" subtitle="Settings → Password Manager" />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <Lock size={20} color={BUTTON_GREEN} />
            </View>
            <View style={styles.cardHeaderContent}>
              <Text style={styles.cardTitle}>Change Password</Text>
              <Text style={styles.cardSubtitle}>Ensure your account is using a long, random password to stay secure.</Text>
            </View>
          </View>

          <View style={styles.form}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Current Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter current password"
                  placeholderTextColor={Colors.textMuted}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showCurrent}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeBtn}>
                  {showCurrent ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
                </Pressable>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new password"
                  placeholderTextColor={Colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
                  {showNew ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
                </Pressable>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm New Password</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter new password"
                  placeholderTextColor={Colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                  {showConfirm ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={handleUpdate}
              disabled={loading}
              style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>Update Password</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <BottomNav activeRoute="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  card: {
    marginHorizontal: Spacing.screenHorizontal,
    marginTop: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  cardHeaderContent: {
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F4ECDC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
    paddingRight: 8,
  },
  form: {
    gap: Spacing.lg,
  },
  errorBox: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#F5C6C2',
    padding: Spacing.md,
    borderRadius: Radius.input,
  },
  errorText: {
    color: '#D9291F',
    fontSize: 13,
    lineHeight: 18,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    backgroundColor: '#FBF7F0',
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  eyeBtn: {
    padding: Spacing.md,
  },
  saveBtn: {
    height: Spacing.buttonHeight,
    backgroundColor: BUTTON_GREEN,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
