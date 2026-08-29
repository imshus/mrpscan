import { StyleSheet } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export const Layout = {
  screenPaddingBottom: Spacing.screenBottom,
  sectionGap: Spacing.sectionGap,
  listGap: Spacing.listGap,
} as const;

export const screenStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Layout.screenPaddingBottom,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 10,
    paddingHorizontal: Spacing.screenHorizontal,
    paddingTop: 14,
    paddingBottom: 18,
  },
  // Mockup .rev-back-btn: 32px circle, bg-alt, 1px border.
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 18.4,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  pageSubtitle: {
    width: '100%',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  screenSection: {
    marginHorizontal: Spacing.screenHorizontal,
    gap: Layout.sectionGap,
  },
  screenBody: {
    marginHorizontal: Spacing.screenHorizontal,
  },
  list: {
    gap: Layout.listGap,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.white,
  },
  listRowText: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  listRowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  listRowSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    lineHeight: 16,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: Spacing.lg,
    backgroundColor: Colors.white,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.3,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  textInput: {
    minHeight: Spacing.inputHeight,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.inputPaddingX,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  primaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: Radius.button,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    padding: Spacing.lg,
  },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundAlt,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  tableCell: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  tableRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
