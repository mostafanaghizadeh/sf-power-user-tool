/**
 * Central configuration and storage keys.
 * Single source of truth — no magic strings scattered across modules.
 */
export const CONFIG = Object.freeze({
  STATE_KEY: 'sf_plugin_state_v1',
  FEATURE_KEY: 'sf_feature_states_v1',
  SETTINGS_KEY: 'sf_settings_v1',
  ENV_OVERRIDE_KEY: 'sf_env_overrides_v1', // hostname -> {code} manual env tags
  USAGE_KEY: 'sf_usage_v1', // {favorites:[], recent:[], counts:{}} for Launcher 2.0
  KEEP_ALIVE_ALARM: 'sf-keep-alive',
  KEEP_ALIVE_PERIOD_MIN: 1, // chrome.alarms minimum granularity is 1 minute
  SCHEMA_VERSION: 2,
});

/** Runtime messaging channel names used between content script, popup and worker. */
export const MSG = Object.freeze({
  RUN_COMMAND: 'sf:run-command',
  TOGGLE_DIALOG: 'sf:toggle-dialog',
  TOGGLE_FEATURE: 'sf:toggle-feature',
  STATE_CHANGED: 'sf:state-changed',
  GET_STATE: 'sf:get-state',
  KEEP_ALIVE_TICK: 'sf:keep-alive-tick',
  PING: 'sf:ping',
});

/** SuccessFactors host patterns used for adapter-level detection. */
export const SF_HOST_PATTERNS = Object.freeze([
  /\.successfactors\.(com|eu)$/i,
  /\.sapsf\.(com|eu|cn)$/i,
  /\.hr\.cloud\.sap$/i,
  /\.hr\.sapcloud\.cn$/i,
]);
