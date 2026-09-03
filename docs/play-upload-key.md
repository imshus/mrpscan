# Play upload key for com.mrpscan

Play Console already holds an upload key for `com.mrpscan` from an earlier upload:

```
expected  SHA1: 0C:13:BA:3E:88:A0:DB:7B:4C:B6:7C:47:DD:85:6C:2B:EE:32:89:AA
```

The key generated on 3 Sep 2026 in `frontend/credentials/upload.keystore` has a different fingerprint (`SHA1 …A1:88:9A:D7`), so bundles signed with it are rejected. There are two ways forward; do A if the original key can be found, B otherwise.

## A. Sign with the original key

The project is linked to the Expo account `prathamtest` (see `owner` in `app.json`) and was first built by the previous developer. EAS keeps the Android keystore it generated for a project and lets an account member download it.

1. Log in to expo.dev as the `prathamtest` owner, or have that owner add you to the account. (The machine's `eas-cli` is currently logged in as `imshu`, which has no access to that project.)
2. In `frontend/`, run `npx eas credentials --platform android`, choose the project and the production profile, then **Download credentials**. You get the keystore file plus its store password, key alias and key password.
3. Put the keystore in `frontend/credentials/` and write `frontend/credentials/upload-keystore.properties`:

   ```
   storeFile=<keystore file name>
   storePassword=<store password>
   keyAlias=<key alias>
   keyPassword=<key password>
   ```

4. Confirm it is the right key before building:

   ```
   keytool -list -v -keystore frontend/credentials/<keystore file name>
   ```

   The `SHA1` line must read `0C:13:BA:3E:…:89:AA`.
5. `npm run build:aab` and upload. Keep the folder backed up; it is git-ignored.

If the previous developer still has the keystore on their machine instead of EAS, the same steps apply from step 3.

## B. Register the new key with Play (upload key reset)

If the original key cannot be found, Play can switch the app to the new key because Play App Signing holds the real signing key.

1. Play Console → the app → Setup → App integrity → App signing → **Request upload key reset**.
2. Reason: lost upload key. Upload the certificate file `MRPscan-upload_certificate.pem` (on the Desktop; also at `frontend/credentials/upload_certificate.pem`). It contains only the public certificate of the new key, fingerprint `SHA1 08:F0:0F:AE:D0:7C:33:8B:ED:55:7F:57:80:38:3E:C3:A1:88:9A:D7`.
3. Google confirms by email, usually within two working days, and tells you when the new key becomes active. Until then uploads are rejected.
4. After activation, the existing bundle `MRPscan-1.0.161-release.aab` uploads as is; nothing needs rebuilding.

Never share a keystore file or its passwords in chat; the `.pem` certificate is public and safe to upload or send.
