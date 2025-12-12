// Modern Collaborative Theme (Neutral + Presence-Driven)
// Best for: Professional, B2B, Notion/Figma-like experience

// Light Theme
export const lightTheme = {
  // Core Palette
  colors: {
    primary: '#4F6BED',           // Slate Blue
    background: '#F8FAFC',         // Soft Off-White
    surface: '#EEF2F7',           // Light Grey (Panels)
    textPrimary: '#1F2937',       // Charcoal
    textSecondary: '#6B7280',     // Muted Grey
    border: '#D1D5DB',            // Cool Grey
  },

  // Collaboration / Live Indicators
  collaboration: {
    activeUser: '#14B8A6',        // Teal (Active User Cursor)
    userAmber: '#F59E0B',         // Amber (Another User)
    userPurple: '#A855F7',        // Purple (Another User)
    liveEditing: '#22C55E',       // Emerald (Live Editing Pulse)
  },

  // Status Colors
  status: {
    success: '#16A34A',           // Success
    warning: '#FACC15',           // Warning
    error: '#DC2626',             // Error
  },

  // Extended Palette (derived)
  extended: {
    primaryHover: '#3E56D1',      // Darker primary for hover
    primaryLight: '#E8EDFF',      // Light primary for backgrounds
    surfaceDark: '#E1E7F0',       // Darker surface
    textTertiary: '#9CA3AF',      // Even lighter text
  }
};

// Dark Theme - Matte Neutral (from Extension UI)
export const darkTheme = {
  // Core Palette
  colors: {
    primary: '#5B6B9E',           // Muted Slate Blue
    background: '#1C1C1E',        // Dark Neutral Grey
    surface: '#2C2C2E',           // Medium Neutral Grey (Panels)
    textPrimary: '#E5E5EA',       // Soft White (not bright)
    textSecondary: '#8E8E93',     // Muted Grey
    border: '#3A3A3C',            // Subtle Grey Border
  },

  // Collaboration / Live Indicators
  collaboration: {
    activeUser: '#94C9B8',        // Muted Teal/Sage
    userAmber: '#D9B68A',         // Muted Amber/Sand
    userPurple: '#B5A1C7',        // Muted Purple/Lavender
    liveEditing: '#7DD89F',       // Muted Green
  },

  // Status Colors
  status: {
    success: '#52C17C',           // Muted Sage Green (icon)
    successText: '#7DD89F',       // Lighter Sage (text)
    warning: '#D9B68A',           // Muted Amber
    error: '#D17C7C',             // Muted Dusty Rose (icon)
    errorText: '#E39999',         // Lighter Rose (text)
    idle: '#636366',              // Neutral Grey
    idleText: '#8E8E93',          // Muted Grey Text
  },

  // Extended Palette (derived)
  extended: {
    primaryHover: '#6575A8',      // Lighter slate for hover
    primaryBorder: '#4A5887',     // Darker slate for border
    surfaceDark: '#161618',       // Very dark grey (header/footer)
    surfaceLight: '#3A3A3C',      // Lighter surface
    textTertiary: '#636366',      // Darker muted text
    textLabel: '#AEAEB2',         // Light label text
    textTitle: '#D1D1D6',         // Title text
    borderHover: '#48484A',       // Hover border
    borderFocus: '#636366',       // Focus border
  },

  // Button Colors
  buttons: {
    startBg: '#5B6B9E',
    startHover: '#6575A8',
    startBorder: '#4A5887',
    startText: '#E5E5EA',
    stopBg: '#2C2C2E',
    stopHover: '#3A3A3C',
    stopBorder: '#3A3A3C',
    stopBorderHover: '#48484A',
    stopText: '#8E8E93',
    stopTextHover: '#AEAEB2',
    stopTextDisabled: '#48484A',
  },

  // Special Elements
  special: {
    autoSaveText: '#94C9B8',      // Muted teal for info
    codeBg: '#3A3A3C',            // Code block background
    codeText: '#AEAEB2',          // Code text
    codeBorder: '#48484A',        // Code border
  }
};

// Utility function to get color with opacity
export const withOpacity = (color, opacity) => {
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
};

// CSS Variables generator
export const generateCSSVariables = (themeToUse = lightTheme) => {
  return `
    :root {
      /* Core Colors */
      --color-primary: ${themeToUse.colors.primary};
      --color-background: ${themeToUse.colors.background};
      --color-surface: ${themeToUse.colors.surface};
      --color-text-primary: ${themeToUse.colors.textPrimary};
      --color-text-secondary: ${themeToUse.colors.textSecondary};
      --color-border: ${themeToUse.colors.border};

      /* Collaboration */
      --color-active-user: ${themeToUse.collaboration.activeUser};
      --color-user-amber: ${themeToUse.collaboration.userAmber};
      --color-user-purple: ${themeToUse.collaboration.userPurple};
      --color-live-editing: ${themeToUse.collaboration.liveEditing};

      /* Status */
      --color-success: ${themeToUse.status.success};
      --color-success-text: ${themeToUse.status.successText || themeToUse.status.success};
      --color-warning: ${themeToUse.status.warning};
      --color-error: ${themeToUse.status.error};
      --color-error-text: ${themeToUse.status.errorText || themeToUse.status.error};
      --color-idle: ${themeToUse.status.idle || themeToUse.colors.border};
      --color-idle-text: ${themeToUse.status.idleText || themeToUse.colors.textSecondary};

      /* Extended */
      --color-primary-hover: ${themeToUse.extended.primaryHover};
      --color-primary-border: ${themeToUse.extended.primaryBorder || themeToUse.colors.primary};
      --color-primary-light: ${themeToUse.extended.primaryLight};
      --color-surface-dark: ${themeToUse.extended.surfaceDark};
      --color-surface-light: ${themeToUse.extended.surfaceLight || themeToUse.colors.surface};
      --color-text-tertiary: ${themeToUse.extended.textTertiary};
      --color-text-label: ${themeToUse.extended.textLabel || themeToUse.colors.textSecondary};
      --color-text-title: ${themeToUse.extended.textTitle || themeToUse.colors.textPrimary};
      --color-border-hover: ${themeToUse.extended.borderHover || themeToUse.colors.border};
      --color-border-focus: ${themeToUse.extended.borderFocus || themeToUse.colors.primary};

      /* Buttons (if available) */
      ${themeToUse.buttons ? `
      --color-btn-start-bg: ${themeToUse.buttons.startBg};
      --color-btn-start-hover: ${themeToUse.buttons.startHover};
      --color-btn-start-border: ${themeToUse.buttons.startBorder};
      --color-btn-start-text: ${themeToUse.buttons.startText};
      --color-btn-stop-bg: ${themeToUse.buttons.stopBg};
      --color-btn-stop-hover: ${themeToUse.buttons.stopHover};
      --color-btn-stop-border: ${themeToUse.buttons.stopBorder};
      --color-btn-stop-border-hover: ${themeToUse.buttons.stopBorderHover};
      --color-btn-stop-text: ${themeToUse.buttons.stopText};
      --color-btn-stop-text-hover: ${themeToUse.buttons.stopTextHover};
      --color-btn-stop-text-disabled: ${themeToUse.buttons.stopTextDisabled};
      ` : ''}

      /* Special Elements (if available) */
      ${themeToUse.special ? `
      --color-auto-save-text: ${themeToUse.special.autoSaveText};
      --color-code-bg: ${themeToUse.special.codeBg};
      --color-code-text: ${themeToUse.special.codeText};
      --color-code-border: ${themeToUse.special.codeBorder};
      ` : ''}
    }
  `;
};

// Default export (dark matte theme - matches extension UI)
export const theme = darkTheme;
export default darkTheme;

