# Test signing key

`test.keystore` is the standard public React Native/Expo **debug** keystore
(alias `androiddebugkey`, password `android`, SHA-256 `FA:C6:17:45:…:3B:9C`).
It is NOT a secret: it only keeps test APKs updatable over each other while the
app is side-loaded during testing. Store releases must be signed with a private
upload key (Google Play App Signing) kept outside the repository.
