/**
 * What a bullion house is called, and whether a name is one on the list.
 *
 * Every house on the live feed can be followed, by its `source` key, and the
 * feed names it. The server names the house it priced on (bhawSource.name,
 * the feed's name too). The names below only stand in while neither has
 * answered — a cold start with the feed out — so a house the feed adds is
 * named by the feed with no change here.
 *
 * No imports on purpose: node loads this file as-is (type stripping) for
 * utils/__tests__/bullionNames.test.mjs.
 */

/** The houses the feed carried on 19 Oct 2026, by its own names. */
export const KNOWN_HOUSE_NAMES: Readonly<Record<string, string>> = {
  jmd_patil: 'JMD Patil',
  mega_bullion: 'Mega Bullion',
  shri_sai: 'Shri Sai Jewels',
  shri_ganesh: 'Shri Ganesh Bullion',
  smd_bullion: 'SMD Bullion',
  shree_ram: 'Shree Ram Jewellers',
  kp_bullion: 'KP Bullion',
  vijaylaxmi_bullion: 'Vijaylaxmi Bullion',
  kj_bullion: 'KJ Bullion',
  sms_bullion: 'SMS Bullion',
  sln_bullion: 'SLN Bullion',
};

/** How two names are compared: case and spaces aside, as the server does. */
export function houseNameKey(value: string | null | undefined): string {
  return String(value ?? '').toLowerCase().replace(/\s+/g, '');
}

/**
 * A house's name for the screen: the name the server gave (the feed's), the
 * known name while it has given none, else the key made readable
 * ("new_house" is "New House") — never a bare key.
 */
export function houseNameFor(key: string, serverName?: string | null): string {
  const named = serverName?.trim();
  if (named && named !== key) return named;
  const known = KNOWN_HOUSE_NAMES[key];
  if (known) return known;
  return key
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Whether `name` is one of `houses` already — by its name or its key, case
 * and spaces aside — or one of the names the shop has asked for.
 */
export function isHouseOnList(
  name: string,
  houses: readonly { key: string; label: string }[],
  requestedNames: readonly string[] = [],
): boolean {
  const wanted = houseNameKey(name);
  if (!wanted) return false;
  return (
    houses.some((house) => house.key === wanted || houseNameKey(house.label) === wanted) ||
    requestedNames.some((requested) => houseNameKey(requested) === wanted)
  );
}
