import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * React Native's Gradle plugin caches the autolinking config — the app's
 * package name included — and refreshes it only when package.json or a
 * lockfile changes. The test APK (com.amitaashitsolution) and the Play bundle
 * (com.mrpscan) are built from one android/ folder, so after a switch the
 * cache still named the other package and the generated entry point failed
 * to compile against it. The cache is dropped whenever it names a package
 * other than the one prebuild has just written; it regenerates on the build.
 */
export function clearStaleAutolinking(androidRoot) {
  const cachePath = join(androidRoot, 'build', 'generated', 'autolinking', 'autolinking.json');
  if (!existsSync(cachePath)) return;
  const gradle = readFileSync(join(androidRoot, 'app', 'build.gradle'), 'utf8');
  const target = /namespace\s+['"]([^'"]+)['"]/.exec(gradle)?.[1];
  if (!target) return;
  let cached = null;
  try {
    cached = JSON.parse(readFileSync(cachePath, 'utf8'))?.project?.android?.packageName ?? null;
  } catch {
    // An unreadable cache is as stale as a wrong one.
  }
  if (cached === target) return;
  console.log(`Autolinking cache names ${cached ?? 'no package'}; clearing it for ${target}`);
  rmSync(join(androidRoot, 'build', 'generated', 'autolinking'), { recursive: true, force: true });
  rmSync(join(androidRoot, 'app', 'build', 'generated', 'autolinking'), { recursive: true, force: true });
}
