/** UI preference keys allowed in the settings table (not auth secrets). */
export const UI_SETTING_KEYS = ['theme']

export function isAllowedUiSettingKey(key) {
  return typeof key === 'string' && UI_SETTING_KEYS.includes(key)
}
