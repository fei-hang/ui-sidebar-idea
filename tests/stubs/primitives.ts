/**
 * Stand-in for the design system in unit tests. The real package draws icons,
 * menus, and code highlighting from a large dependency tree that a Node test
 * process has no business loading; the services under test only need the names
 * this plugin imports to resolve.
 */
const Null = (): null => null
const noop = (): void => {}

/** Every name this plugin imports from the design system, stubbed. */
export const FishLogo = Null
export const IconAppsAddOutlineRegular = Null
export const IconNewChatOutlineMedium = Null
export const IconNewChatOutlineRegular = Null
export const IconPanelLeftOutlineRegular = Null
export const IconPinFillRegular = Null
export const Menu = Null
export const ShortcutKeys = Null
export const Toast = Null
export const Tooltip = Null
export const focusWithoutRing = noop
export const isBehindModal = (): boolean => false
export const isDarwinDesktop = (): boolean => false
export const useModalLayer = noop
export const writeClipboard = noop
