# Changelog

## [0.4.0](https://github.com/PhyberApex/kuroshiro/compare/kuroshiro-v0.3.2...kuroshiro-v0.4.0) (2025-06-20)


### Features

* **device:** Allow changing of name ([#49](https://github.com/PhyberApex/kuroshiro/issues/49)) ([a98afcb](https://github.com/PhyberApex/kuroshiro/commit/a98afcb2442b2a16b58100c6ef6efd3ae4ea31bc))


### Bug Fixes

* **deps:** update dependency @vueuse/core to v13.4.0 ([#66](https://github.com/PhyberApex/kuroshiro/issues/66)) ([51bf575](https://github.com/PhyberApex/kuroshiro/commit/51bf575298c14c44a6fd5af26a4b635dffb92b34))
* **deps:** update dependency pg to v8.16.1 ([#56](https://github.com/PhyberApex/kuroshiro/issues/56)) ([ff1919a](https://github.com/PhyberApex/kuroshiro/commit/ff1919aee7988e1ef6a435e11f7dd1ad3eb61d44))
* **deps:** update dependency pg to v8.16.2 ([#67](https://github.com/PhyberApex/kuroshiro/issues/67)) ([f5201ca](https://github.com/PhyberApex/kuroshiro/commit/f5201cac42cac90937c20f4cf37034b97ca502ce))
* **deps:** update dependency typeorm to v0.3.25 ([#68](https://github.com/PhyberApex/kuroshiro/issues/68)) ([58e2b25](https://github.com/PhyberApex/kuroshiro/commit/58e2b25f7d04440fbd00f7dd9ebcbf56ccc1e34d))
* **deps:** update dependency vue to v3.5.17 ([#57](https://github.com/PhyberApex/kuroshiro/issues/57)) ([4260d68](https://github.com/PhyberApex/kuroshiro/commit/4260d689ab5fb2dc4ae6cfe9ca0db36d218b17c0))
* **deps:** update dependency vuetify to v3.8.10 ([#61](https://github.com/PhyberApex/kuroshiro/issues/61)) ([577b964](https://github.com/PhyberApex/kuroshiro/commit/577b964993dc6997017ec9ad3a7010ad97fca0d6))
* **devices:** Current screen and screen list not updating on device switch ([254a962](https://github.com/PhyberApex/kuroshiro/commit/254a96235a3a192cc755e4adcd452f0d32539fe3)), closes [#42](https://github.com/PhyberApex/kuroshiro/issues/42)
* **display:** Change post-fix to iso date string ([#50](https://github.com/PhyberApex/kuroshiro/issues/50)) ([7db241a](https://github.com/PhyberApex/kuroshiro/commit/7db241aed0bdf2ea0759b70546cb88379ea87b1f))
* **docker:** Fix pupeteer not working in docker ([#48](https://github.com/PhyberApex/kuroshiro/issues/48)) ([f0e694d](https://github.com/PhyberApex/kuroshiro/commit/f0e694d8cc49e4522d58bf620a46a7f0422269ba)), closes [#45](https://github.com/PhyberApex/kuroshiro/issues/45)
* **mirror:** Fixing DeviceDetailsView not working if no screen added but mirroring enabled ([#64](https://github.com/PhyberApex/kuroshiro/issues/64)) ([611a4c6](https://github.com/PhyberApex/kuroshiro/commit/611a4c6ce06b1196b7b8fbc5418bc33b8a24e4e6)), closes [#43](https://github.com/PhyberApex/kuroshiro/issues/43)
* **mirror:** Fixing proxy not working ([#59](https://github.com/PhyberApex/kuroshiro/issues/59)) ([7b27f6a](https://github.com/PhyberApex/kuroshiro/commit/7b27f6a24412cef9800f496afefd71a70639b503)), closes [#44](https://github.com/PhyberApex/kuroshiro/issues/44)
* **screens:** Fixed the preview of the HTML render screens in all places ([5030d29](https://github.com/PhyberApex/kuroshiro/commit/5030d291eaf6bb0d27941007f9732cc2c5ca0886))
* **ui:** Fix for flash screen ([a1286e8](https://github.com/PhyberApex/kuroshiro/commit/a1286e8f4d0935db168ee52bc292b5903d633deb)), closes [#46](https://github.com/PhyberApex/kuroshiro/issues/46)

## [0.3.2](https://github.com/PhyberApex/kuroshiro/compare/kuroshiro-v0.3.1...kuroshiro-v0.3.2) (2025-06-17)


### Bug Fixes

* **mirror:** Fetching correct filename ([9dfbe42](https://github.com/PhyberApex/kuroshiro/commit/9dfbe42ad17bcd72bbd6dc0113f22930c83dccc4))

## [0.3.1](https://github.com/PhyberApex/kuroshiro/compare/kuroshiro-v0.3.0...kuroshiro-v0.3.1) (2025-06-17)


### Bug Fixes

* **mirror:** Use proper casing for headers on sending to TRMNL server for proxy device ([a0e0e98](https://github.com/PhyberApex/kuroshiro/commit/a0e0e98adec7a8688f91bf63b591fa440c7635ba))
* **screens:** Make filename change on new render ([#37](https://github.com/PhyberApex/kuroshiro/issues/37)) ([7bfd125](https://github.com/PhyberApex/kuroshiro/commit/7bfd12592ebfef55414cc20ac481443257eff3f3)), closes [#34](https://github.com/PhyberApex/kuroshiro/issues/34)

## [0.3.0](https://github.com/PhyberApex/kuroshiro/compare/kuroshiro-v0.2.0...kuroshiro-v0.3.0) (2025-06-15)


### Features

* Added demo mode ([48a95c8](https://github.com/PhyberApex/kuroshiro/commit/48a95c85e766a9fc3327df0431b999a02508b587))
* **mirror:** Use different endpoints depending on MAC matching or not (proxy vs. mirror) ([2507ea2](https://github.com/PhyberApex/kuroshiro/commit/2507ea23068fa2eb1ad2010c424c7287877d8675))
* **ui:** Better UX for entering of refresh rate ([75c7d72](https://github.com/PhyberApex/kuroshiro/commit/75c7d72c9c35ea1b297d9267be9d313e2d37c399))
* **virtual-device:** Take header attributes from real device on selection in dropdown ([9e70815](https://github.com/PhyberApex/kuroshiro/commit/9e7081558ca5962d961329e0a572bcc7668342aa))


### Bug Fixes

* **api/display:** Switched to waitFor - load for headless render to boost performance ([ce32c21](https://github.com/PhyberApex/kuroshiro/commit/ce32c21cb2c7e535615dc55d544cadddd7f692a6))
* **deps:** Remove unused dependency (jest) ([#24](https://github.com/PhyberApex/kuroshiro/issues/24)) ([9af9886](https://github.com/PhyberApex/kuroshiro/commit/9af988671a2d33b73b4e194f2550e9c897efdba5)), closes [#23](https://github.com/PhyberApex/kuroshiro/issues/23)
* **deps:** update dependency puppeteer to v24.10.1 ([#28](https://github.com/PhyberApex/kuroshiro/issues/28)) ([4d7bdf5](https://github.com/PhyberApex/kuroshiro/commit/4d7bdf5a11c7709f7bb5baa59d4031c5d79abdba))
* **deps:** update dependency vuetify to v3.8.9 ([#27](https://github.com/PhyberApex/kuroshiro/issues/27)) ([0f1ccdb](https://github.com/PhyberApex/kuroshiro/commit/0f1ccdb66e71e87641357b1b8e78cb0e135059d2))
* **deps:** update nest monorepo to v11.1.3 ([#15](https://github.com/PhyberApex/kuroshiro/issues/15)) ([7989375](https://github.com/PhyberApex/kuroshiro/commit/7989375b67684f6fc3c993d84b0f9698eebcf24a))
* **screens:** Change HTML render to align more with plugins from TRMNL ([17cb214](https://github.com/PhyberApex/kuroshiro/commit/17cb21473cd110a7599a8c688bf8505251fcb2ba))
* **virtual-device:** Fix header pass through to TRMNL server ([7579731](https://github.com/PhyberApex/kuroshiro/commit/7579731f3ec0afcf0ddc1e608906e248dda68872))

## [0.2.0](https://github.com/PhyberApex/kuroshiro/compare/kuroshiro-v0.1.1...kuroshiro-v0.2.0) (2025-06-04)


### Features

* **screens:** Add functionality to render html with the TRMNL framework ([9a31305](https://github.com/PhyberApex/kuroshiro/commit/9a313054ceb52b5dfe1e6dbf2d6dc3bc5da7fc01))
* **tools:** Added new tool "HTML preview" to help create HTML screens ([487463c](https://github.com/PhyberApex/kuroshiro/commit/487463c0f2ba0ecb08c27a21cd6455f4fac7658e))


### Bug Fixes

* **deps:** update dependency pinia to v3.0.3 ([#8](https://github.com/PhyberApex/kuroshiro/issues/8)) ([02a0875](https://github.com/PhyberApex/kuroshiro/commit/02a08755d464c2f0164ac05669ee6473be7aa0a1))
* **deps:** update dependency vuetify to v3.8.8 ([#9](https://github.com/PhyberApex/kuroshiro/issues/9)) ([9826963](https://github.com/PhyberApex/kuroshiro/commit/9826963bd41e838f1195e22c51b55a09c8f5c3b8))

## [0.1.1](https://github.com/PhyberApex/kuroshiro/compare/kuroshiro-v0.1.0...kuroshiro-v0.1.1) (2025-06-01)


### Bug Fixes

* **config:** Fix .env.example with proper values ([61a8a9c](https://github.com/PhyberApex/kuroshiro/commit/61a8a9cf1fd1473b58c6b7049975a141e064c5d2))
* **screens:** Fix paths not working in built image and removing unused dependencies ([a555b72](https://github.com/PhyberApex/kuroshiro/commit/a555b72a6666f4158a528f53dc557759d975711b))

## [0.1.0](https://github.com/PhyberApex/kuroshiro/compare/kuroshiro-v0.0.1...kuroshiro-v0.1.0) (2025-05-31)


### Features

* Initial commit ([d9427da](https://github.com/PhyberApex/kuroshiro/commit/d9427da67ccb14b7ab8fb6ae3a6d28c84d63c73c))

## [0.0.1](https://github.com/PhyberApex/kuroshiro_internal/compare/kuroshiro-v0.0.1...kuroshiro-v0.0.1) (2025-05-28)


### Features

* Add version docker ([d2ba247](https://github.com/PhyberApex/kuroshiro_internal/commit/d2ba2472d1ef0e622fc510aacb2f8ecf245031fe))
* Add version docker ([4728c5a](https://github.com/PhyberApex/kuroshiro_internal/commit/4728c5a5d2fe5fc0dc19a6e23a468509aa85e9d7))
* Add version docker ([5daf38f](https://github.com/PhyberApex/kuroshiro_internal/commit/5daf38f4c0960ce07a7ed3d649203c20fe778e2f))
* Add version docker ([6797f73](https://github.com/PhyberApex/kuroshiro_internal/commit/6797f73947e92e294996447463cc8bf3cda40fec))
* Add version docker ([b984bd1](https://github.com/PhyberApex/kuroshiro_internal/commit/b984bd13dcbce6514fbd6d74975e357b2374fedb))
* Add version docker ([cf6e1a3](https://github.com/PhyberApex/kuroshiro_internal/commit/cf6e1a33c5bcd8b9791eab76abe1b971f372bb3b))
* Added version info ([a0356b5](https://github.com/PhyberApex/kuroshiro_internal/commit/a0356b56b2a21fcf69f952d0d343fe454bc6bb4e))


### Bug Fixes

* Add caching to ci/cd ([24191b5](https://github.com/PhyberApex/kuroshiro_internal/commit/24191b5e1c5b49f0ecefbf74875f3a357922bbbd))
* Added dummy tests ([ea0da2f](https://github.com/PhyberApex/kuroshiro_internal/commit/ea0da2fdc6cb019767e17a83883400f83b30f965))
* **deps:** update dependency @vueuse/core to v13.3.0 ([#13](https://github.com/PhyberApex/kuroshiro_internal/issues/13)) ([8b376d9](https://github.com/PhyberApex/kuroshiro_internal/commit/8b376d96600d755225d8f17bda90388b38a0129c))
* **deps:** update dependency vue to v3.5.15 ([#6](https://github.com/PhyberApex/kuroshiro_internal/issues/6)) ([df113b8](https://github.com/PhyberApex/kuroshiro_internal/commit/df113b8d314f7fb90f62539917c54b8103f257b3))
* **deps:** update dependency vuetify to v3.8.7 ([#12](https://github.com/PhyberApex/kuroshiro_internal/issues/12)) ([bf96158](https://github.com/PhyberApex/kuroshiro_internal/commit/bf96158683d299f2d2afd7ef457be81eaa477db0))
* **deps:** update nest monorepo to v11.1.2 ([#7](https://github.com/PhyberApex/kuroshiro_internal/issues/7)) ([726ddcf](https://github.com/PhyberApex/kuroshiro_internal/commit/726ddcf9e15cf3f039d493360cca3afcfd65c5be))
* Fix version not being published ([0c1a169](https://github.com/PhyberApex/kuroshiro_internal/commit/0c1a169d9796ed8d70fa373e7be9109fcdb77c07))
* Github workflow ([ef3c6ad](https://github.com/PhyberApex/kuroshiro_internal/commit/ef3c6ad3b85913bd50b6dbd29102c03ec71a1967))
* Monorepo? ([d99d4fe](https://github.com/PhyberApex/kuroshiro_internal/commit/d99d4fe018e7f359c3a4b6a268fd933e19127c8b))
* Monorepo? ([6937425](https://github.com/PhyberApex/kuroshiro_internal/commit/6937425f91c02976db3124b04c2c98198e1f1c8a))
* Monorepo? ([b5b1788](https://github.com/PhyberApex/kuroshiro_internal/commit/b5b1788dc515715d68f1f4cde5ed5dacd07f8f68))
* More CI/CD ([5179a25](https://github.com/PhyberApex/kuroshiro_internal/commit/5179a25dd02d276ccc2b5beabc043f9e74f09440))
* More CI/CD ([274790f](https://github.com/PhyberApex/kuroshiro_internal/commit/274790fb4943c01d06afb0bb7cc686b06787ce70))
* More CI/CD ([c7ab039](https://github.com/PhyberApex/kuroshiro_internal/commit/c7ab0391b4ad39ceb0375cbc7a70442033dd4975))
* New work on how to release ([4e369a3](https://github.com/PhyberApex/kuroshiro_internal/commit/4e369a3eda995664366cb6b4afd9d1a66f08dd24))
* New work on how to release ([3936dd1](https://github.com/PhyberApex/kuroshiro_internal/commit/3936dd1e2dd55bcc48e91edc3ca27abdb138610a))
* New work on how to release ([bb54c07](https://github.com/PhyberApex/kuroshiro_internal/commit/bb54c07d6e2be8e999e871a4ee452af5a0d9ea12))
* New work on how to release ([d58e0e4](https://github.com/PhyberApex/kuroshiro_internal/commit/d58e0e40a99885ff8be45a88d07c61072abd26f9))
* Remove unused plugin ([971a29e](https://github.com/PhyberApex/kuroshiro_internal/commit/971a29e1a9d1ad5fc6c2d271316b43bcdc478ba2))
* Try something Else ([3faf609](https://github.com/PhyberApex/kuroshiro_internal/commit/3faf609492aefb30910ecab233c3dd7a9c729984))
* Workflow ([ac17aec](https://github.com/PhyberApex/kuroshiro_internal/commit/ac17aec8511da66066fbb7490321a5dfd9dc2de5))

## 0.0.1 (2025-05-28)


### Features

* Add version docker ([d2ba247](https://github.com/PhyberApex/kuroshiro_internal/commit/d2ba2472d1ef0e622fc510aacb2f8ecf245031fe))
* Add version docker ([4728c5a](https://github.com/PhyberApex/kuroshiro_internal/commit/4728c5a5d2fe5fc0dc19a6e23a468509aa85e9d7))
* Add version docker ([5daf38f](https://github.com/PhyberApex/kuroshiro_internal/commit/5daf38f4c0960ce07a7ed3d649203c20fe778e2f))
* Add version docker ([6797f73](https://github.com/PhyberApex/kuroshiro_internal/commit/6797f73947e92e294996447463cc8bf3cda40fec))
* Add version docker ([b984bd1](https://github.com/PhyberApex/kuroshiro_internal/commit/b984bd13dcbce6514fbd6d74975e357b2374fedb))
* Add version docker ([cf6e1a3](https://github.com/PhyberApex/kuroshiro_internal/commit/cf6e1a33c5bcd8b9791eab76abe1b971f372bb3b))
* Added version info ([a0356b5](https://github.com/PhyberApex/kuroshiro_internal/commit/a0356b56b2a21fcf69f952d0d343fe454bc6bb4e))


### Bug Fixes

* Add caching to ci/cd ([24191b5](https://github.com/PhyberApex/kuroshiro_internal/commit/24191b5e1c5b49f0ecefbf74875f3a357922bbbd))
* Added dummy tests ([ea0da2f](https://github.com/PhyberApex/kuroshiro_internal/commit/ea0da2fdc6cb019767e17a83883400f83b30f965))
* **deps:** update dependency @vueuse/core to v13.3.0 ([#13](https://github.com/PhyberApex/kuroshiro_internal/issues/13)) ([8b376d9](https://github.com/PhyberApex/kuroshiro_internal/commit/8b376d96600d755225d8f17bda90388b38a0129c))
* **deps:** update dependency vue to v3.5.15 ([#6](https://github.com/PhyberApex/kuroshiro_internal/issues/6)) ([df113b8](https://github.com/PhyberApex/kuroshiro_internal/commit/df113b8d314f7fb90f62539917c54b8103f257b3))
* **deps:** update dependency vuetify to v3.8.7 ([#12](https://github.com/PhyberApex/kuroshiro_internal/issues/12)) ([bf96158](https://github.com/PhyberApex/kuroshiro_internal/commit/bf96158683d299f2d2afd7ef457be81eaa477db0))
* **deps:** update nest monorepo to v11.1.2 ([#7](https://github.com/PhyberApex/kuroshiro_internal/issues/7)) ([726ddcf](https://github.com/PhyberApex/kuroshiro_internal/commit/726ddcf9e15cf3f039d493360cca3afcfd65c5be))
* Fix version not being published ([0c1a169](https://github.com/PhyberApex/kuroshiro_internal/commit/0c1a169d9796ed8d70fa373e7be9109fcdb77c07))
* Github workflow ([ef3c6ad](https://github.com/PhyberApex/kuroshiro_internal/commit/ef3c6ad3b85913bd50b6dbd29102c03ec71a1967))
* Monorepo? ([d99d4fe](https://github.com/PhyberApex/kuroshiro_internal/commit/d99d4fe018e7f359c3a4b6a268fd933e19127c8b))
* Monorepo? ([6937425](https://github.com/PhyberApex/kuroshiro_internal/commit/6937425f91c02976db3124b04c2c98198e1f1c8a))
* Monorepo? ([b5b1788](https://github.com/PhyberApex/kuroshiro_internal/commit/b5b1788dc515715d68f1f4cde5ed5dacd07f8f68))
* More CI/CD ([5179a25](https://github.com/PhyberApex/kuroshiro_internal/commit/5179a25dd02d276ccc2b5beabc043f9e74f09440))
* More CI/CD ([274790f](https://github.com/PhyberApex/kuroshiro_internal/commit/274790fb4943c01d06afb0bb7cc686b06787ce70))
* More CI/CD ([c7ab039](https://github.com/PhyberApex/kuroshiro_internal/commit/c7ab0391b4ad39ceb0375cbc7a70442033dd4975))
* New work on how to release ([4e369a3](https://github.com/PhyberApex/kuroshiro_internal/commit/4e369a3eda995664366cb6b4afd9d1a66f08dd24))
* New work on how to release ([3936dd1](https://github.com/PhyberApex/kuroshiro_internal/commit/3936dd1e2dd55bcc48e91edc3ca27abdb138610a))
* New work on how to release ([bb54c07](https://github.com/PhyberApex/kuroshiro_internal/commit/bb54c07d6e2be8e999e871a4ee452af5a0d9ea12))
* New work on how to release ([d58e0e4](https://github.com/PhyberApex/kuroshiro_internal/commit/d58e0e40a99885ff8be45a88d07c61072abd26f9))
* Remove unused plugin ([971a29e](https://github.com/PhyberApex/kuroshiro_internal/commit/971a29e1a9d1ad5fc6c2d271316b43bcdc478ba2))
* Try something Else ([3faf609](https://github.com/PhyberApex/kuroshiro_internal/commit/3faf609492aefb30910ecab233c3dd7a9c729984))
* Workflow ([ac17aec](https://github.com/PhyberApex/kuroshiro_internal/commit/ac17aec8511da66066fbb7490321a5dfd9dc2de5))

## [0.3.0](https://github.com/PhyberApex/kuroshiro_internal/compare/kuroshiro-v0.2.0...kuroshiro-v0.3.0) (2025-05-27)


### Features

* Add version docker ([b984bd1](https://github.com/PhyberApex/kuroshiro_internal/commit/b984bd13dcbce6514fbd6d74975e357b2374fedb))

## [0.2.0](https://github.com/PhyberApex/kuroshiro_internal/compare/kuroshiro-v0.1.0...kuroshiro-v0.2.0) (2025-05-27)


### Features

* Add version docker ([cf6e1a3](https://github.com/PhyberApex/kuroshiro_internal/commit/cf6e1a33c5bcd8b9791eab76abe1b971f372bb3b))

## [0.1.0](https://github.com/PhyberApex/kuroshiro_internal/compare/kuroshiro-v0.0.1...kuroshiro-v0.1.0) (2025-05-27)


### Features

* Added version info ([a0356b5](https://github.com/PhyberApex/kuroshiro_internal/commit/a0356b56b2a21fcf69f952d0d343fe454bc6bb4e))


### Bug Fixes

* Try something Else ([3faf609](https://github.com/PhyberApex/kuroshiro_internal/commit/3faf609492aefb30910ecab233c3dd7a9c729984))

## 0.0.1 (2025-05-27)


### Bug Fixes

* Add caching to ci/cd ([24191b5](https://github.com/PhyberApex/kuroshiro_internal/commit/24191b5e1c5b49f0ecefbf74875f3a357922bbbd))
* Added dummy tests ([ea0da2f](https://github.com/PhyberApex/kuroshiro_internal/commit/ea0da2fdc6cb019767e17a83883400f83b30f965))
* **deps:** update dependency @vueuse/core to v13.3.0 ([#13](https://github.com/PhyberApex/kuroshiro_internal/issues/13)) ([8b376d9](https://github.com/PhyberApex/kuroshiro_internal/commit/8b376d96600d755225d8f17bda90388b38a0129c))
* **deps:** update dependency vue to v3.5.15 ([#6](https://github.com/PhyberApex/kuroshiro_internal/issues/6)) ([df113b8](https://github.com/PhyberApex/kuroshiro_internal/commit/df113b8d314f7fb90f62539917c54b8103f257b3))
* **deps:** update dependency vuetify to v3.8.7 ([#12](https://github.com/PhyberApex/kuroshiro_internal/issues/12)) ([bf96158](https://github.com/PhyberApex/kuroshiro_internal/commit/bf96158683d299f2d2afd7ef457be81eaa477db0))
* **deps:** update nest monorepo to v11.1.2 ([#7](https://github.com/PhyberApex/kuroshiro_internal/issues/7)) ([726ddcf](https://github.com/PhyberApex/kuroshiro_internal/commit/726ddcf9e15cf3f039d493360cca3afcfd65c5be))
* Fix version not being published ([0c1a169](https://github.com/PhyberApex/kuroshiro_internal/commit/0c1a169d9796ed8d70fa373e7be9109fcdb77c07))
* Github workflow ([ef3c6ad](https://github.com/PhyberApex/kuroshiro_internal/commit/ef3c6ad3b85913bd50b6dbd29102c03ec71a1967))
* Monorepo? ([d99d4fe](https://github.com/PhyberApex/kuroshiro_internal/commit/d99d4fe018e7f359c3a4b6a268fd933e19127c8b))
* Monorepo? ([6937425](https://github.com/PhyberApex/kuroshiro_internal/commit/6937425f91c02976db3124b04c2c98198e1f1c8a))
* Monorepo? ([b5b1788](https://github.com/PhyberApex/kuroshiro_internal/commit/b5b1788dc515715d68f1f4cde5ed5dacd07f8f68))
* More CI/CD ([5179a25](https://github.com/PhyberApex/kuroshiro_internal/commit/5179a25dd02d276ccc2b5beabc043f9e74f09440))
* More CI/CD ([274790f](https://github.com/PhyberApex/kuroshiro_internal/commit/274790fb4943c01d06afb0bb7cc686b06787ce70))
* More CI/CD ([c7ab039](https://github.com/PhyberApex/kuroshiro_internal/commit/c7ab0391b4ad39ceb0375cbc7a70442033dd4975))
* New work on how to release ([4e369a3](https://github.com/PhyberApex/kuroshiro_internal/commit/4e369a3eda995664366cb6b4afd9d1a66f08dd24))
* New work on how to release ([3936dd1](https://github.com/PhyberApex/kuroshiro_internal/commit/3936dd1e2dd55bcc48e91edc3ca27abdb138610a))
* New work on how to release ([bb54c07](https://github.com/PhyberApex/kuroshiro_internal/commit/bb54c07d6e2be8e999e871a4ee452af5a0d9ea12))
* New work on how to release ([d58e0e4](https://github.com/PhyberApex/kuroshiro_internal/commit/d58e0e40a99885ff8be45a88d07c61072abd26f9))
* Remove unused plugin ([971a29e](https://github.com/PhyberApex/kuroshiro_internal/commit/971a29e1a9d1ad5fc6c2d271316b43bcdc478ba2))
* Workflow ([ac17aec](https://github.com/PhyberApex/kuroshiro_internal/commit/ac17aec8511da66066fbb7490321a5dfd9dc2de5))
