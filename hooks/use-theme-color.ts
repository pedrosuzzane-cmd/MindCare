/**
 * Returns a theme color from the legacy Colors palette.
 *
 * Resolution follows the active MindCare theme mode (including the
 * user's persisted Light/Dark override) rather than the raw system
 * color scheme, so `ThemedView` / `ThemedText` stay in sync with the
 * rest of the app when the user toggles the theme manually.
 */

import { Colors } from '@/constants/theme';
import { useMindCareTheme } from '@/contexts/ThemeContext';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const { mode } = useMindCareTheme();
  const theme = mode ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
