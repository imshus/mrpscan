import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { basename, dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const androidRoot = join(projectRoot, 'android');
const distRoot = join(projectRoot, 'dist', 'ui-debug');
const screenshotRoot = join(distRoot, 'screenshots');
const logRoot = join(distRoot, 'logs');

const appConfig = JSON.parse(readFileSync(join(projectRoot, 'app.json'), 'utf8'));
const APP_ID = appConfig.expo?.android?.package;
if (typeof APP_ID !== 'string' || APP_ID.trim().length === 0) {
  throw new Error('app.json must define expo.android.package for the mobile UI debugger.');
}
const METRO_PORT = 8081;
const DEBUG_APK_SOURCE = join(androidRoot, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const DEBUG_APK = join(distRoot, 'pratham-ui-debugger-arm64-v8a.apk');

const isWindows = process.platform === 'win32';
const gradleCommand = join(androidRoot, isWindows ? 'gradlew.bat' : 'gradlew');
const expoCli = join(projectRoot, 'node_modules', 'expo', 'bin', 'cli');

function firstExisting(paths) {
  return paths.find((candidate) => candidate && existsSync(candidate));
}

function readSdkFromLocalProperties() {
  const file = join(androidRoot, 'local.properties');
  if (!existsSync(file)) return undefined;

  const match = readFileSync(file, 'utf8').match(/^sdk\.dir=(.+)$/m);
  if (!match) return undefined;

  return match[1]
    .trim()
    .replaceAll('\\:', ':')
    .replaceAll('\\\\', '\\');
}

const androidSdk = firstExisting([
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  readSdkFromLocalProperties(),
  isWindows ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : undefined,
  !isWindows ? join(process.env.HOME ?? '', 'Android', 'Sdk') : undefined,
]);

const javaHome = firstExisting([
  process.env.JAVA_HOME,
  isWindows ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : undefined,
  isWindows ? 'C:\\Program Files\\Java\\jdk-21' : undefined,
]);

const adbCommand = androidSdk
  ? join(androidSdk, 'platform-tools', isWindows ? 'adb.exe' : 'adb')
  : undefined;

function commandLabel(command, args) {
  return [command, ...args].map((part) => (part.includes(' ') ? `"${part}"` : part)).join(' ');
}

function run(command, args, options = {}) {
  console.log(`\n> ${commandLabel(command, args)}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${basename(command)} exited with status ${result.status}`);
  }
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    encoding: 'utf8',
    shell: false,
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    throw new Error(`${basename(command)} exited with status ${result.status}${detail ? `: ${detail}` : ''}`);
  }

  return result.stdout;
}

function requireToolchain({ requireAdb = false } = {}) {
  const missing = [];
  if (!androidSdk) missing.push('Android SDK');
  if (!javaHome || !existsSync(join(javaHome, 'bin', isWindows ? 'java.exe' : 'java'))) {
    missing.push('Java 21 / Android Studio JBR');
  }
  if (requireAdb && (!adbCommand || !existsSync(adbCommand))) missing.push('Android platform-tools (adb)');

  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(', ')}. Run \"npm run setup:android\" and install Android SDK Platform-Tools.`,
    );
  }
}

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function connectedDevices() {
  requireToolchain({ requireAdb: true });
  const output = capture(adbCommand, ['devices', '-l']);
  return output
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state, ...details] = line.split(/\s+/);
      return { serial, state, details: details.join(' ') };
    });
}

function selectedDevice() {
  const devices = connectedDevices();
  const requestedSerial = getOption('--serial') ?? process.env.ANDROID_SERIAL;
  const authorized = devices.filter((device) => device.state === 'device');

  if (requestedSerial) {
    const matched = authorized.find((device) => device.serial === requestedSerial);
    if (!matched) {
      throw new Error(`Android device ${requestedSerial} is not connected and authorized.`);
    }
    return matched;
  }

  if (authorized.length === 1) return authorized[0];
  if (authorized.length > 1) {
    throw new Error('Multiple Android devices are connected. Pass --serial <device-id>.');
  }

  const unauthorized = devices.find((device) => device.state === 'unauthorized');
  if (unauthorized) {
    throw new Error(`Authorize USB debugging on device ${unauthorized.serial}, then retry.`);
  }

  throw new Error('No Android device found. Connect the phone by USB and enable USB debugging.');
}

function adb(device, args, options = {}) {
  return capture(adbCommand, ['-s', device.serial, ...args], options);
}

function syncAndroidProject() {
  if (!existsSync(expoCli)) throw new Error('Expo CLI is missing. Run npm install first.');

  run(process.execPath, [expoCli, 'prebuild', '--platform', 'android', '--no-install'], {
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? 'development',
      ...(androidSdk ? { ANDROID_HOME: androidSdk, ANDROID_SDK_ROOT: androidSdk } : {}),
      ...(javaHome ? { JAVA_HOME: javaHome } : {}),
    },
  });

  if (!existsSync(gradleCommand)) {
    throw new Error('Expo prebuild completed without generating the Android Gradle wrapper.');
  }
}

function buildDebuggerApk() {
  requireToolchain();
  syncAndroidProject();

  const buildEnvironment = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    ANDROID_HOME: androidSdk,
    ANDROID_SDK_ROOT: androidSdk,
    JAVA_HOME: javaHome,
  };

  if (isWindows) {
    run(process.env.ComSpec ?? 'cmd.exe', [
      '/d',
      '/s',
      '/c',
      `""${gradleCommand}" :app:assembleDebug --no-daemon -PreactNativeArchitectures=arm64-v8a"`,
    ], {
      cwd: androidRoot,
      env: buildEnvironment,
      windowsVerbatimArguments: true,
    });
  } else {
    run(gradleCommand, [
      ':app:assembleDebug',
      '--no-daemon',
      '-PreactNativeArchitectures=arm64-v8a',
    ], {
      cwd: androidRoot,
      env: buildEnvironment,
    });
  }

  if (!existsSync(DEBUG_APK_SOURCE)) {
    throw new Error(`Gradle completed without creating ${DEBUG_APK_SOURCE}`);
  }

  mkdirSync(distRoot, { recursive: true });
  copyFileSync(DEBUG_APK_SOURCE, DEBUG_APK);
  const hash = createHash('sha256').update(readFileSync(DEBUG_APK)).digest('hex');
  writeFileSync(`${DEBUG_APK}.sha256`, `${hash}  ${basename(DEBUG_APK)}\n`);

  console.log(`\nUI debugger APK: ${DEBUG_APK}`);
  console.log(`SHA-256: ${hash}`);
  return DEBUG_APK;
}

function installDebuggerApk() {
  const device = selectedDevice();
  if (!existsSync(DEBUG_APK)) buildDebuggerApk();

  console.log(`Installing UI debugger on ${device.serial}...`);
  run(adbCommand, ['-s', device.serial, 'install', '-r', '-d', DEBUG_APK]);
  adb(device, ['reverse', `tcp:${METRO_PORT}`, `tcp:${METRO_PORT}`]);
  console.log('Installed. Run \"npm run ui:debug:start\" to begin Fast Refresh.');
}

function launchApp(device) {
  adb(device, ['shell', 'am', 'force-stop', APP_ID]);
  const output = adb(device, ['shell', 'am', 'start', '-n', `${APP_ID}/.MainActivity`]);
  if (output.trim()) console.log(output.trim());
}

function waitForPort(port, timeoutMs = 120_000) {
  const startedAt = Date.now();

  return new Promise((resolvePort, rejectPort) => {
    const attempt = () => {
      const socket = createConnection({ host: '127.0.0.1', port });
      socket.setTimeout(1_000);
      socket.once('connect', () => {
        socket.destroy();
        resolvePort();
      });
      const retry = () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          rejectPort(new Error(`Metro did not start on port ${port} within ${timeoutMs / 1000}s.`));
          return;
        }
        setTimeout(attempt, 500);
      };
      socket.once('error', retry);
      socket.once('timeout', retry);
    };
    attempt();
  });
}

async function startDebugger() {
  const device = selectedDevice();
  if (!existsSync(expoCli)) throw new Error('Expo CLI is missing. Run npm install first.');

  adb(device, ['reverse', `tcp:${METRO_PORT}`, `tcp:${METRO_PORT}`]);
  console.log(`Starting local UI debugger for ${device.serial}...`);
  console.log('Keep this terminal open. Saved UI changes will Fast Refresh on the phone.\n');

  const metro = spawn(process.execPath, [
    expoCli,
    'start',
    '--localhost',
    '--port',
    String(METRO_PORT),
    '--clear',
  ], {
    cwd: projectRoot,
    env: { ...process.env, EXPO_OFFLINE: '1', NODE_ENV: 'development' },
    stdio: 'inherit',
    shell: false,
  });

  metro.once('error', (error) => {
    console.error(`Unable to start Metro: ${error.message}`);
  });

  try {
    await waitForPort(METRO_PORT);
    adb(device, ['reverse', `tcp:${METRO_PORT}`, `tcp:${METRO_PORT}`]);
    launchApp(device);
    console.log('\nUI debugger connected. Fast Refresh is active.');
  } catch (error) {
    metro.kill();
    throw error;
  }

  const stop = () => metro.kill('SIGINT');
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  const exitCode = await new Promise((resolveExit) => {
    metro.once('exit', (code) => resolveExit(code ?? 0));
  });
  process.exitCode = exitCode;
}

function artifactTimestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function screenshotDevice(device = selectedDevice()) {
  const requestedOutput = getOption('--output');
  const outputPath = requestedOutput
    ? resolve(projectRoot, requestedOutput)
    : join(screenshotRoot, `screen-${artifactTimestamp()}.png`);

  const result = spawnSync(adbCommand, ['-s', device.serial, 'exec-out', 'screencap', '-p'], {
    cwd: projectRoot,
    env: process.env,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    throw new Error(`Unable to capture the screen from ${device.serial}.`);
  }
  if (result.stdout.length < 8 || result.stdout.subarray(1, 4).toString('ascii') !== 'PNG') {
    throw new Error('ADB returned an invalid screenshot. Unlock the phone and retry.');
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, result.stdout);
  console.log(`Screenshot: ${outputPath}`);
  return outputPath;
}

function captureDeviceLogs(device = selectedDevice()) {
  const pid = adb(device, ['shell', 'pidof', APP_ID]).trim().split(/\s+/)[0];
  if (!pid) throw new Error(`Start ${APP_ID} before capturing its logs.`);

  const outputPath = join(logRoot, `app-${artifactTimestamp()}.log`);
  const output = adb(device, ['logcat', '--pid', pid, '-d', '-v', 'threadtime', '-t', '500']);
  mkdirSync(logRoot, { recursive: true });
  writeFileSync(outputPath, output);
  console.log(`App logs: ${outputPath}`);
  return outputPath;
}

function inspectDevice() {
  const device = selectedDevice();
  const screenshotPath = screenshotDevice(device);
  let logPath;

  try {
    logPath = captureDeviceLogs(device);
  } catch (error) {
    console.warn(`Logs unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\nInspection bundle ready:');
  console.log(`  screen: ${screenshotPath}`);
  if (logPath) console.log(`  logs:   ${logPath}`);
}

function reloadDevice() {
  const device = selectedDevice();
  adb(device, ['reverse', `tcp:${METRO_PORT}`, `tcp:${METRO_PORT}`]);
  launchApp(device);
  console.log(`Reloaded ${APP_ID} on ${device.serial}.`);
}

function doctor() {
  const devices = adbCommand && existsSync(adbCommand) ? connectedDevices() : [];
  console.log('Mobile UI debugger');
  console.log(`Android SDK: ${androidSdk ?? 'missing'}`);
  console.log(`Java: ${javaHome ?? 'missing'}`);
  console.log(`ADB: ${adbCommand ?? 'missing'}`);
  console.log(`Debugger APK: ${existsSync(DEBUG_APK) ? DEBUG_APK : 'not built'}`);
  console.log('Devices:');
  if (devices.length === 0) console.log('  none');
  for (const device of devices) {
    console.log(`  ${device.serial}  ${device.state}${device.details ? `  ${device.details}` : ''}`);
  }
}

function help() {
  console.log(`Local mobile UI debugger (no AI or cloud service)

Usage:
  node scripts/mobile-ui-debugger.mjs doctor
  node scripts/mobile-ui-debugger.mjs build
  node scripts/mobile-ui-debugger.mjs install [--serial DEVICE]
  node scripts/mobile-ui-debugger.mjs start [--serial DEVICE]
  node scripts/mobile-ui-debugger.mjs inspect [--serial DEVICE]
  node scripts/mobile-ui-debugger.mjs screenshot [--serial DEVICE] [--output FILE]
  node scripts/mobile-ui-debugger.mjs logs [--serial DEVICE]
  node scripts/mobile-ui-debugger.mjs reload [--serial DEVICE]
`);
}

const command = process.argv[2] ?? 'help';

try {
  if (command === 'doctor') doctor();
  else if (command === 'build') buildDebuggerApk();
  else if (command === 'install') installDebuggerApk();
  else if (command === 'start') await startDebugger();
  else if (command === 'inspect') inspectDevice();
  else if (command === 'screenshot') screenshotDevice();
  else if (command === 'logs') captureDeviceLogs();
  else if (command === 'reload') reloadDevice();
  else help();
} catch (error) {
  console.error(`\nUI debugger error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
