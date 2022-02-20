<a name="2.0.4"></a>
# [2.0.4](https://github.com/raulsebastianmihaila/crizmas-router/compare/v2.0.3...v2.0.4) (2022-02-27)

### Updates
- Added ability to reenter leaf route fragments when transitioning (without refreshing).
- Mark fallback routes as leaf-reenterable.
- Updated crizmas-mvc and prop-types peer dependencies.
- Updated crizmas-mvc, prop-types and jest dev dependencies.
- Configure npm to use legacy peer dependency behavior.

<a name="2.0.3"></a>
# [2.0.3](https://github.com/raulsebastianmihaila/crizmas-router/compare/v2.0.1...v2.0.3) (2021-08-22)

### Updates
- Updated crizmas-mvc, prop-types and react peer dependencies.
- Updated crizmas-mvc, jest, react and react-dom dev dependencies.

<a name="2.0.1"></a>
# [2.0.1](https://github.com/raulsebastianmihaila/crizmas-router/compare/v2.0.0...v2.0.1) (2021-01-03)

### Updates
- Added support for React 17.
- Updated prop-types dev dependency.

<a name="2.0.0"></a>
# [2.0.0](https://github.com/raulsebastianmihaila/crizmas-router/compare/v1.2.0...v2.0.0) (2021-01-01)

### Breaking changes
- Dropped support for non-module script tags.
- Moved from commonjs modules to standard ES modules, which means the structure of the exports changed: Link is not a property of Router anymore.

### Updates
- Updated crizmas-mvc peer dependency.
- Updated jest and crizmas-mvc dev dependencies.
- Improve error message used when entering a route fragment.
- Small refactoring.

<a name="1.2.0"></a>
# [1.2.0](https://github.com/raulsebastianmihaila/crizmas-router/compare/v1.1.0...v1.2.0) (2019-01-23)

### Updates
- Update fallbackRoute to receive a matching path that triggers the fallback.

<a name="1.1.0"></a>
# [1.1.0](https://github.com/raulsebastianmihaila/crizmas-router/compare/v1.0.2...v1.1.0) (2018-12-08)

### Updates
- Use the new react context API (from v16).
- Update crizmas-mvc, crizmas-utils, crizmas-async-utils, react and prop-types peer dependencies.
- Replace Promise.reject with throwing to decrease the number of jobs involved.
- Improve some comments.
- Add tests.
- Stop awaiting for enterRouteFragments because there's no associated handler.
- Add onAsyncError.

### Fixes
- Fix defining routes that didn't have own configurations but only children configurations, both in terms of matching and checking ambiguities.
- Fix resolving input route fragments that are specified in multiple locations in the configuration.
- Fix reusing targetRouteFragment.

<a name="1.0.2"></a>
# [1.0.2](https://github.com/raulsebastianmihaila/crizmas-router/compare/v1.0.1...v1.0.2) (2018-04-21)

### Updates
- Updated the versions of crizmas-mvc, crizmas-async-utils and crizmas-utils peer dependencies.
- Add MIT license in package.json.

<a name="1.0.1"></a>
# [1.0.1](https://github.com/raulsebastianmihaila/crizmas-router/compare/v1.0.0...v1.0.1) (2017-11-18)

### Updates
- Updated the versions of crizmas-mvc and react peer dependencies.

<a name="1.0.0"></a>
# [1.0.0](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.4.0...v1.0.0) (2017-07-30)

### Updates
- Updated the versions of crizmas-mvc, crizmas-utils and crizmas-async-utils peer dependencies.

<a name="0.4.0"></a>
# [0.4.0](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.3.0...v0.4.0) (2017-07-12)

### Breaking changes
- The signature for `refresh` was changed to receive an options object.

### Updates
- Replace option for `transitionTo`, `refresh`, `Link` and `fallbackRoute`.

<a name="0.3.0"></a>
# [0.3.0](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.12...v0.3.0) (2017-07-06)

### Breaking changes
- Matching paths using regular expressions now requires wrapping route paths between `^` and `$`.
- Route fragments' path and urlPath properties are now updated when they are case insensitive and they are matching a new url path with different case.

### Fixes
- Fix `isPathActive` and `isDescendantPathActive` for fallback matches.

### Updates
- Refresh API.
- Routes manager.
- `isCaseInsensitive` option.
- `onUrlHandle` API.
- `router` property on route fragments.
- Validation against multiple param paths at a certain level.
- Updated the version of crizmas-mvc peer dependency.
- Refactoring

<a name="0.2.12"></a>
# [0.2.12](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.11...v0.2.12) (2017-06-23)

### Updates
- Avoid using `React.DOM`.
- Small refactoring.

<a name="0.2.11"></a>
# [0.2.11](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.10...v0.2.11) (2017-06-22)

### Fixes
- Fix isPathActive and isDescendantPathActive.
- Fix routes diff.

### Updates
- Add support for search change handlers.

<a name="0.2.10"></a>
# [0.2.10](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.9...v0.2.10) (2017-06-04)

### Updates
- Updated the version of crizmas-mvc peer dependency.

<a name="0.2.9"></a>
# [0.2.9](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.8...v0.2.9) (2017-05-31)

### Fixes
- Fix reusing route fragments.

### Updates
- Small refactoring.

<a name="0.2.8"></a>
# [0.2.8](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.7...v0.2.8) (2017-05-28)

### Fixes
- Fix reusing route fragments when the abstract path is empty.

### Updates
- Decode path params.
- Small refactoring.

<a name="0.2.7"></a>
# [0.2.7](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.6...v0.2.7) (2017-05-14)

### Fixes
- Fix the `is-active` and `is-descendant-active` link classes.
- Fix reusing of route fragments when they are not left during transition.

### Updates
- Allow replacing the transition destination while the abstract route fragments are being resolved.
- Small refactoring.
- Add prop-types as a peer dependency.
- Update versions of crizmas-mvc and react peer dependencies.

<a name="0.2.6"></a>
# [0.2.6](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.5...v0.2.6) (2017-05-07)

### Updates
- Refactoring.
- Update versions of dependencies.

<a name="0.2.5"></a>
# [0.2.5](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.4...v0.2.5) (2017-04-29)

### Updates
- Ensure that functions that should not be constructed are not constructors.
- Update versions of dependencies.

<a name="0.2.4"></a>
# [0.2.4](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.3...v0.2.4) (2017-04-21)

### Updates
- Updated the versions of peer dependencies.

<a name="0.2.3"></a>
# [0.2.3](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.2...v0.2.3) (2017-02-14)

### Updates
- Allow Router to be applied. Removed the new.target check that was crashing the build when using the uglify plugin from webpack.
- Updated the peer dependencies versions.

<a name="0.2.2"></a>
# [0.2.2](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.1...v0.2.2) (2017-02-13)

### Fixes
- Prevent Router from being applied.

### Updates
- Update the peer dependencies versions.

<a name="0.2.1"></a>
# [0.2.1](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.2.0...v0.2.1) (2016-12-30)

### Fixes
- Fix the peer dependencies versions.

<a name="0.2.0"></a>
# [0.2.0](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.1.1...v0.2.0) (2016-12-29)

### Breaking changes
- Add the `crizmas` namespace as a prop on `window`.

<a name="0.1.1"></a>
# [0.1.1](https://github.com/raulsebastianmihaila/crizmas-router/compare/v0.1.0...v0.1.1) (2016-12-22)

### Fixes
- Fix the links href values.

<a name="0.1.0"></a>
# 0.1.0 (2016-12-21)

- Init
