import { createHash } from 'node:crypto';
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { applyUploadSigning } from './apply-upload-signing.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const androidRoot = join(projectRoot, 'android');
const isWindows = process.platform === 'win32';
const supportedArchitectures = new Set(['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64']);
const architectures = (process.env.REACT_NATIVE_ARCHITECTURES ?? 'armeabi-v7a,arm64-v8a,x86,x86_64')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (architectures.length === 0 || architectures.some((value) => !supportedArchitectures.has(value))) {
  throw new Error(
    `Invalid REACT_NATIVE_ARCHITECTURES. Supported values: ${[...supportedArchitectures].join(', ')}`,
  );
}

process.env.NODE_ENV ??= 'production';

// Metro and Gradle write to fixed release-bundle paths. Two simultaneous APK
// builds can corrupt the bundle or source map, so fail early with a clear error.
const buildLockPath = join(projectRoot, 'android', '.build-aab.lock');

function processIsRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireBuildLock() {
  mkdirSync(androidRoot, { recursive: true });

  try {
    const lockHandle = openSync(buildLockPath, 'wx');
    writeFileSync(lockHandle, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    closeSync(lockHandle);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;

    let owner = null;
    try {
      owner = JSON.parse(readFileSync(buildLockPath, 'utf8'));
    } catch {
      // An unreadable lock cannot identify a live owner and is safe to replace.
    }

    if (processIsRunning(Number(owner?.pid))) {
      throw new Error(
        `Another APK build is already running (PID ${owner.pid}). Wait for it to finish before retrying.`,
      );
    }

    unlinkSync(buildLockPath);
    const lockHandle = openSync(buildLockPath, 'wx');
    writeFileSync(lockHandle, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    closeSync(lockHandle);
  }
}

function releaseBuildLock() {
  try {
    const owner = JSON.parse(readFileSync(buildLockPath, 'utf8'));
    if (Number(owner?.pid) === process.pid) unlinkSync(buildLockPath);
  } catch {
    // The lock may already be gone after an interrupted or externally cleaned build.
  }
}

acquireBuildLock();
process.on('exit', releaseBuildLock);

function firstExisting(paths) {
  return paths.find((candidate) => candidate && existsSync(candidate));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

function toGradlePath(path) {
  return path.replaceAll('\\', '/').replaceAll(':', '\\:');
}

const javaHome = firstExisting([
  process.env.JAVA_HOME,
  isWindows ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : undefined,
  isWindows ? 'C:\\Program Files\\Java\\jdk-21' : undefined,
]);

if (!javaHome || !existsSync(join(javaHome, 'bin', isWindows ? 'java.exe' : 'java'))) {
  throw new Error('Java 21 was not found. Set JAVA_HOME or install Android Studio with its bundled JDK.');
}

const androidSdk = firstExisting([
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  isWindows && process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
    : undefined,
  !isWindows ? join(homedir(), 'Android', 'Sdk') : undefined,
]);

if (!androidSdk) {
  throw new Error('Android SDK was not found. Set ANDROID_HOME to the SDK directory.');
}

const requiredSdkDirectories = [
  join(androidSdk, 'platforms', 'android-36'),
  join(androidSdk, 'build-tools', '36.0.0'),
  join(androidSdk, 'ndk', '27.1.12297006'),
];
const missingSdkDirectories = requiredSdkDirectories.filter((path) => !existsSync(path));

if (missingSdkDirectories.length > 0) {
  throw new Error(
    [
      'The Android SDK is incomplete. Install these packages with Android Studio SDK Manager:',
      '  Android SDK Platform 36',
      '  Android SDK Build-Tools 36.0.0',
      '  NDK (Side by side) 27.1.12297006',
      `SDK directory: ${androidSdk}`,
    ].join('\n'),
  );
}

process.env.JAVA_HOME = javaHome;
process.env.ANDROID_HOME = androidSdk;
process.env.ANDROID_SDK_ROOT = androidSdk;

const expoCli = join(projectRoot, 'node_modules', 'expo', 'bin', 'cli');
run(process.execPath, [expoCli, 'prebuild', '--platform', 'android', '--no-install']);

writeFileSync(join(androidRoot, 'local.properties'), `sdk.dir=${toGradlePath(androidSdk)}\n`);

applyUploadSigning(projectRoot, { required: true });

// Always regenerate the files that were left partially written by the failed
// concurrent builds reported by Metro's source-map composer.
const generatedBundleFiles = [
  join(androidRoot, 'app', 'build', 'generated', 'assets', 'createBundleReleaseJsAndAssets', 'index.android.bundle'),
  join(androidRoot, 'app', 'build', 'intermediates', 'sourcemaps', 'react', 'release', 'index.android.bundle.packager.map'),
  join(androidRoot, 'app', 'build', 'intermediates', 'sourcemaps', 'react', 'release', 'index.android.bundle.compiler.map'),
];
generatedBundleFiles.forEach((path) => rmSync(path, { force: true }));

if (isWindows) {
  // Absolute path: with NoDefaultCurrentDirectoryInExePath set, cmd won't resolve a bare gradlew.bat from cwd.
  run(process.env.ComSpec ?? 'cmd.exe', [
    '/d',
    '/s',
    '/c',
    `""${join(androidRoot, 'gradlew.bat')}" :app:bundleRelease --no-daemon -PreactNativeArchitectures=${architectures.join(',')}"`,
  ], { cwd: androidRoot, windowsVerbatimArguments: true });
} else {
  run(join(androidRoot, 'gradlew'), [
    ':app:bundleRelease',
    '--no-daemon',
    `-PreactNativeArchitectures=${architectures.join(',')}`,
  ], { cwd: androidRoot });
}

const sourceApk = join(androidRoot, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
if (!existsSync(sourceApk)) {
  throw new Error(`Gradle completed without producing ${sourceApk}`);
}

const appConfig = JSON.parse(readFileSync(join(projectRoot, 'app.json'), 'utf8'));
const appName = String(appConfig.expo?.slug ?? appConfig.expo?.name ?? 'app')
  .trim()
  .replace(/[^a-z0-9._-]+/gi, '-');
const version = String(appConfig.expo?.version ?? 'local');
const artifactDir = join(projectRoot, 'dist', 'android');
const artifactPath = join(artifactDir, `${appName}-${version}-release.aab`);

mkdirSync(artifactDir, { recursive: true });
copyFileSync(sourceApk, artifactPath);

const sha256 = createHash('sha256').update(readFileSync(artifactPath)).digest('hex');
writeFileSync(`${artifactPath}.sha256`, `${sha256}  ${artifactPath.split(/[\\/]/).at(-1)}\n`);

console.log(`\nAAB: ${artifactPath}`);
console.log(`SHA-256: ${sha256}`);
