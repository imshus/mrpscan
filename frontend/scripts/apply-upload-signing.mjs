import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Signs release builds with the Play upload key in <project>/credentials when it
 * exists. Expo's prebuild regenerates android/app/build.gradle with the debug
 * keystore for the release variant, so this is re-applied after every prebuild.
 * Sideloaded APKs and the Play bundle then carry the same signature, which lets
 * a phone update from one to the other. Returns true when the upload key was
 * wired in, false when no credentials exist (debug signing stays).
 */
export function applyUploadSigning(projectRoot, { required = false } = {}) {
  const credentialsDir = join(projectRoot, 'credentials');
  const uploadProps = join(credentialsDir, 'upload-keystore.properties');
  const hasKey = existsSync(uploadProps) && existsSync(join(credentialsDir, 'upload.keystore'));
  if (!hasKey) {
    if (required) {
      throw new Error(
        `Missing upload key. Expected credentials/upload.keystore and credentials/upload-keystore.properties under ${projectRoot}`,
      );
    }
    console.log('Release signing: no upload key in credentials/, using the debug keystore');
    return false;
  }
  // Play pins the upload key per app. When credentials/expected-upload-sha1.txt
  // holds the fingerprint Play expects, refuse to sign with any other key: a
  // bundle signed with the wrong key is rejected at upload, after a long build.
  const expectedPath = join(credentialsDir, 'expected-upload-sha1.txt');
  if (existsSync(expectedPath)) {
    const expected = readFileSync(expectedPath, 'utf8').trim().toUpperCase();
    const props = Object.fromEntries(
      readFileSync(uploadProps, 'utf8')
        .split(/?
/)
        .filter((line) => line.includes('='))
        .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
    );
    const javaHome = process.env.JAVA_HOME || '';
    const keytool = javaHome ? join(javaHome, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool') : 'keytool';
    const listed = spawnSync(
      keytool,
      ['-list', '-v', '-keystore', join(credentialsDir, props.storeFile || 'upload.keystore'), '-storepass', props.storePassword || '', '-alias', props.keyAlias || 'upload'],
      { encoding: 'utf8' },
    );
    const match = /SHA1:\s*([0-9A-F:]+)/i.exec(String(listed.stdout || ''));
    const actual = match ? match[1].toUpperCase() : '(unreadable)';
    if (actual !== expected) {
      throw new Error(
        `Upload key mismatch. Play expects SHA1 ${expected}; credentials/${props.storeFile || 'upload.keystore'} has SHA1 ${actual}. ` +
          'Place the keystore Play expects in frontend/credentials/ (see docs/play-upload-key.md) or, after a Play upload-key reset, update expected-upload-sha1.txt.',
      );
    }
    console.log(`Release signing: upload key fingerprint verified (${actual})`);
  }
  const buildGradlePath = join(projectRoot, 'android', 'app', 'build.gradle');
  let buildGradle = readFileSync(buildGradlePath, 'utf8');
  const marker = '// upload-key signing (apply-upload-signing.mjs)';
  if (buildGradle.includes(marker) || buildGradle.includes('// upload-key signing (build-aab.mjs)')) {
    console.log('Release signing: upload key already wired');
    return true;
  }
  const releaseSigning = [
    `        ${marker}`,
    '        release {',
    "            def uploadPropsFile = rootProject.file('../credentials/upload-keystore.properties')",
    '            def uploadProps = new Properties()',
    '            uploadPropsFile.withInputStream { uploadProps.load(it) }',
    "            storeFile rootProject.file('../credentials/' + uploadProps['storeFile'])",
    "            storePassword uploadProps['storePassword']",
    "            keyAlias uploadProps['keyAlias']",
    "            keyPassword uploadProps['keyPassword']",
    '        }',
  ].join('\n');
  const signingBlock = buildGradle.indexOf('signingConfigs {');
  const debugBlockEnd = buildGradle.indexOf('        }\n', signingBlock);
  if (signingBlock < 0 || debugBlockEnd < 0) throw new Error('Could not find signingConfigs in build.gradle');
  const insertAt = debugBlockEnd + '        }\n'.length;
  buildGradle = buildGradle.slice(0, insertAt) + releaseSigning + '\n' + buildGradle.slice(insertAt);
  const releaseType = buildGradle.indexOf('release {', buildGradle.indexOf('buildTypes {'));
  const debugSigningInRelease = buildGradle.indexOf('signingConfig signingConfigs.debug', releaseType);
  if (releaseType < 0 || debugSigningInRelease < 0) throw new Error('Could not find the release buildType signing line');
  buildGradle =
    buildGradle.slice(0, debugSigningInRelease) +
    'signingConfig signingConfigs.release' +
    buildGradle.slice(debugSigningInRelease + 'signingConfig signingConfigs.debug'.length);
  writeFileSync(buildGradlePath, buildGradle);
  console.log('Release signing: upload key wired into android/app/build.gradle');
  return true;
}
