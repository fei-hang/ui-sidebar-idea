/**
 * How a shell is named.
 *
 * A profile's executable is a path, but the table and the tabs show a name, so
 * the last path segment without its executable suffix is what they use. The Host
 * reports shells the same way, which is what keeps a discovered shell and a
 * typed one looking alike.
 */

/**
 * The last segment of a path, without the executable suffix.
 * @param path - shell executable path.
 * @returns the lower-cased executable name, or the empty string.
 */
export function shellNameOf(path: string): string {
  const segment = path.split(/[\\/]/).pop() ?? ''
  return segment.toLowerCase().replace(/\.(exe|cmd|bat)$/, '')
}
