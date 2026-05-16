
import { AppTheme } from './types';

// The Main Background and Text Colors
export const THEME_CLASSES = {
  [AppTheme.MINIMAL]: 'bg-minimal-bg text-minimal-text',
  [AppTheme.SERENITY]: 'bg-serenity-bg text-serenity-text',
  [AppTheme.EMBER]: 'bg-ember-bg text-ember-text',
  [AppTheme.BREEZE]: 'bg-breeze-bg text-breeze-text',
  [AppTheme.LAVENDER]: 'bg-lavender-bg text-lavender-text',
};

// Accents (Buttons, Highlights)
export const THEME_ACCENTS = {
  [AppTheme.MINIMAL]: 'bg-minimal-accent text-white',
  [AppTheme.SERENITY]: 'bg-serenity-accent text-white',
  [AppTheme.EMBER]: 'bg-ember-accent text-white',
  [AppTheme.BREEZE]: 'bg-breeze-accent text-white',
  [AppTheme.LAVENDER]: 'bg-lavender-accent text-white',
};

// Secondary (Cards, Inputs)
export const THEME_SECONDARY = {
  [AppTheme.MINIMAL]: 'bg-white border-minimal-secondary',
  [AppTheme.SERENITY]: 'bg-white border-serenity-secondary',
  [AppTheme.EMBER]: 'bg-white border-ember-secondary',
  [AppTheme.BREEZE]: 'bg-white border-breeze-secondary',
  [AppTheme.LAVENDER]: 'bg-white border-lavender-secondary',
};

// Soft Gradients for UI elements
export const GRADIENTS = {
  [AppTheme.MINIMAL]: 'from-gray-900 to-gray-600',
  [AppTheme.SERENITY]: 'from-green-600 to-emerald-400',
  [AppTheme.EMBER]: 'from-red-600 to-orange-500',
  [AppTheme.BREEZE]: 'from-sky-600 to-blue-400',
  [AppTheme.LAVENDER]: 'from-purple-600 to-pink-500',
};
