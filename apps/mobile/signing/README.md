# Test signing key

`test.keystore` is the standard public React Native/Expo **debug** keystore
(alias `androiddebugkey`, password `android`, SHA-256 `FA:C6:17:45:…:3B:9C`).
It is NOT a secret: it only keeps test APKs updatable over each other while the
app is side-loaded during testing. Store releases must be signed with a private
upload key (Google Play App Signing) kept outside the repository.

## Google Play (upload key)

Play builds come from `.github/workflows/mobile-play.yml` (run by hand). They are signed with
the private upload key `abyad-upload` (RSA 4096, PKCS12), which is never in the repository: it
lives in the repository secrets `ANDROID_UPLOAD_KEYSTORE_B64` and `ANDROID_UPLOAD_PASSWORD`,
and the owner keeps an offline backup. Google re-signs uploads with the app signing key
(Play App Signing). Upload certificate SHA-256:
`F0:C6:5E:ED:93:F9:98:42:B2:DE:CC:2D:C4:71:74:34:69:74:56:36:FE:41:1B:03:3E:9B:09:B3:39:F0:42:28`.
