// VOCALS — Voice -> Execution System
// Design System: Soft daylight dashboard

export const COLORS = {
  background: '#FBF6F1',
  surface: '#FFFDFC',
  card: '#FFFFFF',
  cardElevated: '#FFF7F2',
  cardBorder: '#EDE0D5',

  textPrimary: '#251B17',
  textSecondary: '#6D5B53',
  textTertiary: '#A08C81',
  textMuted: '#CABAAF',

  accent: '#6C5CE7',
  accentLight: '#8B7CFF',
  accentDim: 'rgba(108, 92, 231, 0.12)',

  urgent: '#F05D5E',
  urgentDim: 'rgba(240, 93, 94, 0.12)',
  warning: '#F5A623',
  warningDim: 'rgba(245, 166, 35, 0.14)',
  success: '#26C281',
  successDim: 'rgba(38, 194, 129, 0.14)',
  info: '#4D7CFE',
  infoDim: 'rgba(77, 124, 254, 0.12)',

  recordRed: '#F05D5E',
  recordPulse: 'rgba(240, 93, 94, 0.22)',

  gradientStart: '#FFF1E7',
  gradientEnd: '#F7F4FF',

  divider: '#F1E7DE',
  overlay: 'rgba(37, 27, 23, 0.18)',
  shimmer: 'rgba(108, 92, 231, 0.04)',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,
};

export const FONT_SIZE = {
  caption: 11,
  small: 13,
  body: 15,
  bodyLarge: 17,
  subtitle: 19,
  title: 22,
  heading: 28,
  hero: 34,
  display: 42,
};

export const FONT_WEIGHT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const SHADOWS = {
  card: {
    shadowColor: '#9F8879',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  elevated: {
    shadowColor: '#9F8879',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
  },
  glow: (color = COLORS.accent) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  }),
};

export const CARD_STYLE = {
  backgroundColor: COLORS.card,
  borderRadius: BORDER_RADIUS.lg,
  borderWidth: 1,
  borderColor: COLORS.cardBorder,
  padding: SPACING.lg,
  ...SHADOWS.card,
};
