(() => {
  'use strict';

  const isModule = typeof module === 'object' && typeof module.exports === 'object';

  let React;
  let PropTypes;
  let Mvc;
  let history;
  let utils;
  let asyncUtils;

  if (isModule) {
    React = require('react');
    PropTypes = require('prop-types');
    Mvc = require('crizmas-mvc');
    history = require('./history');
    utils = require('crizmas-utils');
    asyncUtils = require('crizmas-async-utils');
  } else {
    React = window.React;
    PropTypes = window.PropTypes;
    ({Mvc, history, utils, asyncUtils} = window.crizmas);
  }

  const {Component, createElement} = React;
  const {isFunc, isPromise, resolveThenable} = utils;
  const {awaitFor, awaitAll} = asyncUtils;

  const fallbackPath = '*';
  const identifierRegExp = /^\w+$/;
  const searchAndHashRegExp = /(\?|#).*/;
  const emptyPathSignal = '{*empty*}';
  // <route fragment - matching abstract route fragment> map
  const abstractRouteFragmentsMap = new WeakMap();
  // <route fragment - search change cbs> map
  const routeFragmentsSearchChangeCbsMap = new WeakMap();

  const rootController = (controller) => {
    if (Mvc.isObservedObject(controller)) {
      Mvc.root(controller);
    }
  };

  const unrootController = (controller) => {
    if (Mvc.isObservedObject(controller)) {
      Mvc.unroot(controller);
    }
  };

  const normalizePath = (path) => {
    path = path.replace(searchAndHashRegExp, '');

    if (path.endsWith('/')) {
      return path.slice(0, -1);
    }

    return path;
  };

  const normalizeAbsolutePath = (path) => path.startsWith('/')
    ? normalizePath(path)
    : normalizePath(`/${path}`);

  const getUrlFragments = (path = '') => path.split('/').filter((fragment) => fragment);

  const getRouteChildrenUrlFragments = (path = '') => {
    const urlFragments = getUrlFragments(path);

    return urlFragments.length
      ? urlFragments
      : [''];
  };

  const isParamFragment = (urlFragment) => urlFragment[0] === ':'
    && identifierRegExp.test(urlFragment.slice(1));

  const isRegExpFragment = (urlFragment) => urlFragment.length > 2 && urlFragment[0] === '^'
    && urlFragment[urlFragment.length - 1] === '$';

  function Router({basePath, routes, isCaseInsensitive}) {
    const routesMap = new Map();
    const existingRouteFragmentsMap = new WeakMap();
    const beforeChangeCbs = new Set();
    const changeCbs = new Set();
    const searchChangeCbs = new Set();
    const urlHandleCbs = new Set();
    // a weakmap used to detect refreshes that go through history.push
    // when the refresh url is different from the current url. it's meant to prevent
    // leaking internal information to other history listeners.
    const routerRefreshOptions = Object.freeze(new WeakMap());
    const refreshRouteFragmentKey = Object.freeze(Object.create(null));
    let nextTransitionUrl = null;
    let nextTransitionOptions = null;
    const router = {
      basePath: basePath = basePath && normalizeAbsolutePath(basePath),
      isCaseInsensitive,
      currentRouteFragments: [],
      isTransitioning: false,
      currentRouteFragment: null,
      targetRouteFragment: null,
      params: null,
      url: null,
      isMounted: false
    };
    const routerManager = new RouterManager(null, routesMap, router);

    router.list = routerManager.list;
    router.get = routerManager.get;
    router.has = routerManager.has;
    router.add = routerManager.add;
    router.remove = routerManager.remove;
    router.jumpToHash = history.jumpToHash;

    const init = () => {
      routes.forEach((inputRoute) => resolveInputRoute(inputRoute, null, routesMap, router));
      validateAbstractRouteFragmentsTree(routesMap, false);
    };

    router.transitionTo = (url) => {
      // since the url is converted to a string in history.push, we should make
      // sure that getFullPathUrl doesn't fail if url is not a string
      history.push(getFullPathUrl(String(url), basePath));
    };

    router.mount = () => {
      if (!router.isMounted) {
        history.on(transition);

        router.isMounted = true;

        transition(history.getUrl());
      }
    };

    // options may contain a refresh weakmap
    const transition = Mvc.observe((url, options = {}) => {
      if (router.isTransitioning) {
        nextTransitionUrl = url;
        nextTransitionOptions = options;

        return;
      }

      const transitionRefreshOptions = options.refresh;
      const refreshRouteFragment = transitionRefreshOptions === routerRefreshOptions
        ? routerRefreshOptions.get(refreshRouteFragmentKey)
        : null;

      // make sure no data is retained
      routerRefreshOptions.delete(refreshRouteFragmentKey);

      const path = getUrlPath(url, basePath);

      router.isTransitioning = true;

      return awaitFor(match(path, routesMap, router), Mvc.observe((routeFragment) => {
        // even though it's possible that in the matching process there are side effects,
        // from the routing point of view this transition was canceled if there is a
        // nextTransitionUrl (since the targetRouteFragment wasn't even set).
        if (nextTransitionUrl) {
          router.isTransitioning = false;

          return nextTransition();
        }

        const {routeFragments, remainingRouteFragments, toExitRouteFragments,
          toEnterRouteFragments} = refreshRouteFragment
          ? getRefreshRouteFragments(refreshRouteFragment, routeFragment,
            router.currentRouteFragments, existingRouteFragmentsMap)
          : getNewRouteFragments(routeFragment, router.currentRouteFragments,
            existingRouteFragmentsMap);

        const existingSearchParams = router.url && router.url.searchParams;
        const oldUrl = router.url;

        router.url = url;
        router.params = getPathParams(path, routeFragments);
        router.targetRouteFragment = routeFragment;

        const oldRouteFragment = router.currentRouteFragment;
        const isChangingRoute = toExitRouteFragments.length || toEnterRouteFragments.length;

        if (isChangingRoute) {
          beforeChangeCbs.forEach((cb) => cb({
            currentRouteFragment: router.currentRouteFragment,
            targetRouteFragment: router.targetRouteFragment,
            router
          }));
        }

        const isChangingSearchParams = !refreshRouteFragment
          && !areSearchParamsEqual(existingSearchParams, url.searchParams);

        if (isChangingSearchParams) {
          searchChangeCbs.forEach((cb) => cb({
            currentRouteFragment: router.currentRouteFragment,
            targetRouteFragment: router.targetRouteFragment,
            router,
            oldSearchParams: existingSearchParams,
            newSearchParams: url.searchParams
          }));

          remainingRouteFragments.forEach((routeFragment) => {
            const searchChangeCbs = routeFragmentsSearchChangeCbsMap.get(routeFragment);

            if (searchChangeCbs) {
              searchChangeCbs.forEach((cb) => cb({
                currentRouteFragment: router.currentRouteFragment,
                targetRouteFragment: router.targetRouteFragment,
                router,
                oldSearchParams: existingSearchParams,
                newSearchParams: url.searchParams
              }));
            }
          });
        }

        // even if there is no route change, allow the same flow so that
        // the flags are set appropriately (like targetRouteFragment).
        // it keeps the code simpler and it's also needed to trigger the urlHandle event.

        return awaitFor(
          awaitFor(exitRouteFragments(toExitRouteFragments), (result) => {
            if (nextTransitionUrl || result === false) {
              return result;
            }

            return awaitFor(enterRouteFragments(toEnterRouteFragments));
          }),

          (result) => {
            router.isTransitioning = false;
            router.targetRouteFragment = null;

            if (router.currentRouteFragment !== oldRouteFragment) {
              changeCbs.forEach((cb) => cb({
                oldRouteFragment,
                currentRouteFragment: router.currentRouteFragment,
                router
              }));
            }

            urlHandleCbs.forEach((cb) => cb({
              oldUrl,
              newUrl: url,
              router
            }));

            if (nextTransitionUrl) {
              return nextTransition();
            }

            if (result === false) {
              if (!router.currentRouteFragment) {
                const abstractRouteFragment = abstractRouteFragmentsMap.get(routeFragment);

                throw new Error('Top level route refusing to enter: '
                  + buildReadablePathBackFrom(abstractRouteFragment)
                  + `. Url: ${routeFragment.urlPath}`);
              }

              // reset the current URL.

              const relativeUrl = getRelativeUrl(router.currentRouteFragment.urlPath);

              // in case the current abstract route fragment was replaced through the manager
              // but the route fragment refuses to leave, if we weren't checking if the url
              // changed it would enter an infinite loop. or if the last route fragment
              // that needs to be entered refuses to enter and it has an empty path.
              if (!history.isCurrentUrl(relativeUrl)) {
                router.transitionTo(relativeUrl);
              }
            }
          });
      }));
    });

    const exitRouteFragments = (routeFragments) => {
      if (!routeFragments.length) {
        return;
      }

      const routeFragment = routeFragments[routeFragments.length - 1];

      return awaitFor(exitRouteFragment(routeFragment), (result) => {
        if (result === false) {
          return result;
        }

        removeRouteFragment(routeFragment);

        if (!nextTransitionUrl) {
          return exitRouteFragments(routeFragments.slice(0, -1));
        }
      });
    };

    const exitRouteFragment = (routeFragment) => {
      const controller = routeFragment.controllerObject;

      if (controller && isFunc(controller.onLeave)) {
        return awaitFor(controller.onLeave({
          router,
          routeFragment
        }), (result) => {
          if (result !== false) {
            unrootController(routeFragment.controllerObject);
          }

          return result;
        });
      }

      unrootController(routeFragment.controllerObject);
    };

    const removeRouteFragment = Mvc.observe((routeFragment) => {
      router.currentRouteFragment = routeFragment.parent;

      router.currentRouteFragments.pop();
      existingRouteFragmentsMap.delete(abstractRouteFragmentsMap.get(routeFragment));
    });

    const enterRouteFragments = (routeFragments) => {
      if (!routeFragments.length) {
        return;
      }

      const routeFragment = routeFragments[0];

      return awaitFor(enterRouteFragment(routeFragment), (result) => {
        if (result === false) {
          return result;
        }

        addRouteFragment(routeFragment);

        if (!nextTransitionUrl) {
          return enterRouteFragments(routeFragments.slice(1));
        }
      });
    };

    const enterRouteFragment = (routeFragment) => {
      const abstractRouteFragment = abstractRouteFragmentsMap.get(routeFragment);
      const controller = isFunc(routeFragment.controller)
        ? new routeFragment.controller()
        : routeFragment.controller;

      if (controller) {
        return awaitFor(controller, (controller) => {
          if (!controller) {
            // the promise is not settled with a controller
            throw new Error('Controller promise not settled with a controller: '
              + buildReadablePathBackFrom(abstractRouteFragment)
              + `. Url: ${routeFragment.urlPath}`);
          }

          routeFragment.controllerObject = controller;

          rootController(controller);

          if (isFunc(controller.onEnter)) {
            return awaitFor(controller.onEnter({
              router,
              routeFragment
            }), (result) => {
              if (result === false) {
                unrootController(controller);
              }

              return result;
            });
          }
        });
      }
    };

    const addRouteFragment = Mvc.observe((routeFragment) => {
      router.currentRouteFragment = routeFragment;

      router.currentRouteFragments.push(routeFragment);
      existingRouteFragmentsMap.set(abstractRouteFragmentsMap.get(routeFragment), routeFragment);
    });

    const nextTransition = () => {
      const url = nextTransitionUrl;
      const transitionOptions = nextTransitionOptions;

      nextTransitionUrl = null;
      nextTransitionOptions = null;

      transition(url, transitionOptions);
    };

    const getRelativeUrl = (path) => {
      return `${path}${router.url.search}${router.url.hash}`;
    };

    router.unmount = () => {
      if (router.isMounted) {
        history.off(transition);

        router.isMounted = false;
      }
    };

    router.getRootElement = () => {
      return getRootElement(router.currentRouteFragment);
    };

    const getRootElement = (routeFragment, childElement = false) => {
      if (!routeFragment) {
        return false;
      }

      const element = routeFragment.component
        ? createElement(
          routeFragment.component,
          {
            controller: routeFragment.controllerObject,
            routeFragment
          },
          childElement
        )
        : childElement;

      return routeFragment.parent
        ? getRootElement(routeFragment.parent, element)
        : element;
    };

    router.refresh = (refreshRouteFragment = router.currentRouteFragments[0]) => {
      if (!router.isMounted) {
        throw new Error('The router can not be refreshed while it\'s not mounted');
      }

      if (!router.currentRouteFragments.includes(refreshRouteFragment)) {
        throw new Error('The refresh route fragment is not part of'
          + ' router.currentRouteFragments.');
      }

      routerRefreshOptions.set(refreshRouteFragmentKey, refreshRouteFragment);

      // if the url is the same, the other history listeners shouldn't have to handle
      // the url again
      if (history.isCurrentUrl(router.url)) {
        transition(router.url, {refresh: routerRefreshOptions});
      } else {
        // in case the url is different, the other history listeners must be notified
        // and the history listeners must be called in the same order, therefore
        // in this case we can not call transition() directly from here.
        history.push(router.url, {refresh: routerRefreshOptions});
      }
    };

    router.isPathActive = (path) => {
      if (!router.currentRouteFragment) {
        return false;
      }

      const urlFragments = getUrlFragments(normalizePath(path));
      const routeFragments = getRouteFragmentsWithPath(router.currentRouteFragments);
      const lastRouteFragment = routeFragments[routeFragments.length - 1];
      let fallbackRouteFragment;
      let fallbackRouteUrlFragments;
      let noFallbackUrlFragments;
      let noFallbackRouteFragments;

      if (lastRouteFragment && lastRouteFragment.abstractPath === fallbackPath) {
        fallbackRouteFragment = lastRouteFragment;
        fallbackRouteUrlFragments = getUrlFragments(fallbackRouteFragment.path);
        noFallbackUrlFragments = urlFragments.slice(0, -fallbackRouteUrlFragments.length);
        noFallbackRouteFragments = routeFragments.slice(0, -1);
      } else {
        noFallbackUrlFragments = urlFragments;
        noFallbackRouteFragments = routeFragments;
      }

      if (noFallbackUrlFragments.length !== noFallbackRouteFragments.length) {
        return false;
      }

      if (!areUrlFragmentsMatched(noFallbackUrlFragments, noFallbackRouteFragments)) {
        return false;
      }

      if (fallbackRouteFragment) {
        return isPathMatched(urlFragments.slice(-fallbackRouteUrlFragments.length).join('/'),
          fallbackRouteFragment);
      }

      return true;
    };

    router.isDescendantPathActive = (path) => {
      if (!router.currentRouteFragment) {
        return false;
      }

      const urlFragments = getUrlFragments(normalizePath(path));
      const routeFragments = getRouteFragmentsWithPath(router.currentRouteFragments);

      if (urlFragments.length >= routeFragments.length) {
        return false;
      }

      return areUrlFragmentsMatched(urlFragments, routeFragments);
    };

    router.onBeforeChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      beforeChangeCbs.add(cb);
    };

    router.offBeforeChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      beforeChangeCbs.delete(cb);
    };

    router.onChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      changeCbs.add(cb);
    };

    router.offChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      changeCbs.delete(cb);
    };

    router.onSearchChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      searchChangeCbs.add(cb);
    };

    router.offSearchChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      searchChangeCbs.delete(cb);
    };

    router.onUrlHandle = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      urlHandleCbs.add(cb);
    };

    router.offUrlHandle = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      urlHandleCbs.delete(cb);
    };

    init();

    return router;
  }

  Router.fallbackRoute = ({to}) => {
    return {
      path: fallbackPath,
      // a fallback route must have a component
      component: () => false,
      controller: {
        onEnter({router}) {
          router.transitionTo(to);
        }
      }
    };
  };

  function AbstractRouteFragment(path, parent, component, controller, resolve, isCaseInsensitive,
    router) {
    const arf = {
      parent,
      path,
      component,
      controller,
      resolve,
      // based only on configuration, the type of fragment doesn't matter
      isCaseInsensitive: false,
      isDefined: false,
      isResolved: false,
      children: new Map(),
      // not a param fragment and not a regexp fragment (so including fallback fragments)
      isRegularFragment: false,
      lowerCasePath: null,
      isParamFragment: false,
      paramName: null,
      isRegExpFragment: false,
      regExp: null,
      isFallbackFragment: path === fallbackPath,

      get isResolvable() {
        return !!resolve && !arf.isResolved;
      }
    };

    arf.getChildFromPath = new AbstractRouteFragmentManager(arf).getChildFromPath;

    const init = () => {
      if (isDefiningFragment(component, controller, resolve, isCaseInsensitive)) {
        arf.isDefined = true;
        arf.isCaseInsensitive = getIsCaseInsensitive(isCaseInsensitive);

        updatePathDetails();
      }
    };

    const isDefiningFragment = (component, controller, resolve, isCaseInsensitive) =>
      component || controller || resolve || typeof isCaseInsensitive === 'boolean';

    const getIsCaseInsensitive = (isCaseInsensitive) => typeof isCaseInsensitive === 'boolean'
      ? isCaseInsensitive
      : !!router.isCaseInsensitive;

    const updatePathDetails = () => {
      if (isParamFragment(path)) {
        arf.isParamFragment = true;
        arf.paramName = path.slice(1);
      } else if (isRegExpFragment(path)) {
        arf.isRegExpFragment = true;
        arf.regExp = new RegExp(path, arf.isCaseInsensitive === true ? 'i' : '');
      } else {
        arf.isRegularFragment = true;
        arf.lowerCasePath = arf.path.toLowerCase();
      }
    };

    arf.update = (component, controller, resolve, isCaseInsensitive) => {
      if (!isDefiningFragment(component, controller, resolve, isCaseInsensitive)) {
        return;
      }

      if (arf.isDefined) {
        throw new Error(`Route ${buildReadablePathBackFrom(arf)} is defined more than once.`);
      }

      arf.component = component;
      arf.controller = controller;
      arf.resolve = resolve;
      arf.isCaseInsensitive = getIsCaseInsensitive(isCaseInsensitive);
      arf.isDefined = true;

      updatePathDetails();
    };

    init();

    return arf;
  }

  function AbstractRouteFragmentManager(arf, childrenMap = arf.children) {
    // if arf is falsy, childrenMap must be providded

    return {
      getChildFromPath: (path) => {
        const urlFragments = getRouteChildrenUrlFragments(path);
        let children = childrenMap;
        let abstractRouteFragment = arf;
        let childAbstractRouteFragment;

        for (const urlFragment of urlFragments) {
          childAbstractRouteFragment = children.get(urlFragment);

          if (!childAbstractRouteFragment) {
            return {
              abstractRouteFragment: null,
              stopSearchAbstractRouteFragment: abstractRouteFragment,
              stopSearchUrlFragment: urlFragment
            };
          }

          abstractRouteFragment = childAbstractRouteFragment;
          children = abstractRouteFragment.children;
        }

        return {abstractRouteFragment};
      }
    };
  }

  function RouterManager(abstractRouteFragment, childrenMap = abstractRouteFragment.children,
    router) {
    // if the abstractRouteFragment is falsy, childrenMap must be provided

    const manager = {};
    const abstractRouteFragmentManager = new AbstractRouteFragmentManager(null, childrenMap);

    manager.list = () => {
      return [...childrenMap.keys()];
    };

    manager.get = (path) => {
      const {abstractRouteFragment} = abstractRouteFragmentManager.getChildFromPath(path);

      if (abstractRouteFragment) {
        return new RouterManager(abstractRouteFragment, undefined, router);
      }
    };

    manager.has = (path) => {
      return !!abstractRouteFragmentManager.getChildFromPath(path).abstractRouteFragment;
    };

    manager.remove = (path) => {
      const abstractRouteFragment = find(path);
      const parent = abstractRouteFragment.parent;

      if (parent) {
        parent.children.delete(abstractRouteFragment.path);
        validateUnresolvedAbstractRouteFragment(parent,
          parent.parent && parent.parent.isResolvable);
      } else {
        childrenMap.delete(abstractRouteFragment.path);
      }

      return manager;
    };

    const find = (path) => {
      const {
        abstractRouteFragment,
        stopSearchAbstractRouteFragment,
        stopSearchUrlFragment
      } = abstractRouteFragmentManager.getChildFromPath(path);

      if (!abstractRouteFragment) {
        if (!stopSearchAbstractRouteFragment) {
          throw new Error(`No top level route with path ${stopSearchUrlFragment
            || emptyPathSignal} found.`);
        }

        throw new Error(`Route doesn't have a child with path ${stopSearchUrlFragment
          || emptyPathSignal}: ${buildReadablePathBackFrom(stopSearchAbstractRouteFragment)}.`);
      }

      return abstractRouteFragment;
    };

    manager.add = (path, inputRoute) => {
      let parent = abstractRouteFragment;
      let parentMap = childrenMap;

      if (inputRoute) {
        parent = find(path);
        parentMap = parent.children;
      } else {
        inputRoute = path;
      }

      resolveInputRoute(inputRoute, parent, parentMap, router);
      validateAbstractRouteFragmentsTree(parentMap, parent && parent.isResolvable);

      return manager;
    };

    return manager;
  }

  function RouteFragment(abstractRouteFragment, path, matchingParentRouteFragment, router) {
    const routeFragment = {
      path,
      normalizedPath: null,
      abstractPath: abstractRouteFragment.path,
      urlPath: null,
      normalizedUrlPath: null,
      canCaseVary: canRouteFragmentsCaseVary(abstractRouteFragment),
      component: abstractRouteFragment.component,
      controller: abstractRouteFragment.controller,
      controllerObject: null,
      parent: matchingParentRouteFragment,
      router
    };

    const init = () => {
      const normalizedPath = routeFragment.canCaseVary
        ? path.toLowerCase()
        : path;

      routeFragment.urlPath = path
        ? matchingParentRouteFragment
          ? `${normalizePath(matchingParentRouteFragment.urlPath)}/${path}`
          : normalizeAbsolutePath(path)
        : matchingParentRouteFragment
          ? matchingParentRouteFragment.urlPath
          : '/';
      routeFragment.normalizedPath = normalizedPath;
      routeFragment.normalizedUrlPath = normalizedPath
        ? matchingParentRouteFragment
          ? `${normalizePath(matchingParentRouteFragment.normalizedUrlPath)}/${normalizedPath}`
          : normalizeAbsolutePath(normalizedPath)
        : matchingParentRouteFragment
          ? matchingParentRouteFragment.normalizedUrlPath
          : '/';
    };

    routeFragment.onSearchChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      let changeCbs = routeFragmentsSearchChangeCbsMap.get(routeFragment);

      if (!changeCbs) {
        changeCbs = new Set();

        routeFragmentsSearchChangeCbsMap.set(routeFragment, changeCbs);
      }

      changeCbs.add(cb);
    };

    routeFragment.offSearchChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      const changeCbs = routeFragmentsSearchChangeCbsMap.get(routeFragment);

      if (changeCbs) {
        changeCbs.delete(cb);

        if (!changeCbs.size) {
          routeFragmentsSearchChangeCbsMap.delete(routeFragment);
        }
      }
    };

    routeFragment.refresh = () => {
      router.refresh(routeFragment);
    };

    init();
    abstractRouteFragmentsMap.set(routeFragment, abstractRouteFragment);

    return routeFragment;
  }

  const resolveInputRoute = (inputRoute, parent, parentMap, router) => {
    const urlFragments = getRouteChildrenUrlFragments(inputRoute.path);
    const lastFragmentIndex = urlFragments.length - 1;

    urlFragments.forEach((urlFragment, i) => {
      let controller;
      let component;
      let resolve;
      let isCaseInsensitive;

      if (i === lastFragmentIndex) {
        ({component, controller, resolve, isCaseInsensitive} = inputRoute);
      }

      parent = resolveAbstractRouteFragment(urlFragment, parent, parentMap,
        component, controller, resolve, isCaseInsensitive, router);
      parentMap = parent.children;
    });

    if (inputRoute.children) {
      inputRoute.children.forEach((inputRoute) =>
        resolveInputRoute(inputRoute, parent, parentMap, router));
    }
  };

  const resolveAbstractRouteFragment = (urlFragment, parent, parentMap, component,
    controller, resolve, isCaseInsensitive, router) => {
    let abstractRouteFragment = parentMap.get(urlFragment);

    if (abstractRouteFragment) {
      abstractRouteFragment.update(component, controller, resolve, isCaseInsensitive);

      return abstractRouteFragment;
    }

    abstractRouteFragment = new AbstractRouteFragment(urlFragment, parent, component,
      controller, resolve, isCaseInsensitive, router);

    parentMap.set(urlFragment, abstractRouteFragment);

    return abstractRouteFragment;
  };

  const buildReadablePathBackFrom = (abstractRouteFragment) => {
    let path = abstractRouteFragment.path || emptyPathSignal;

    abstractRouteFragment = abstractRouteFragment.parent;

    while (abstractRouteFragment) {
      path = `${abstractRouteFragment.path || emptyPathSignal}/${path}`;
      abstractRouteFragment = abstractRouteFragment.parent;
    }

    return path;
  };

  const validateAbstractRouteFragmentsTree = (abstractRouteFragmentsTree, parentIsResolvable) => {
    let foundParamAbstractRouteFragment = null;
    // <lower case path - abstract route fragment> map used to detect ambiguous route configurations
    const regularAbstractRouteFragmentsMap = new Map();

    abstractRouteFragmentsTree.forEach((abstractRouteFragment) => {
      if (abstractRouteFragment.isParamFragment) {
        if (foundParamAbstractRouteFragment) {
          if (abstractRouteFragment.parent) {
            throw new Error(`Route ${buildReadablePathBackFrom(abstractRouteFragment.parent)}`
              + ' cannot have multiple children with param paths:'
              + ` ${foundParamAbstractRouteFragment.path} and ${abstractRouteFragment.path}`);
          }

          throw new Error('Multiple top level routes with param paths are not allowed:'
            + ` ${foundParamAbstractRouteFragment.path} and ${abstractRouteFragment.path}`);
        }

        foundParamAbstractRouteFragment = abstractRouteFragment;
      } else if (abstractRouteFragment.isRegularFragment) {
        const existingAbstractRouteFragment =
          regularAbstractRouteFragmentsMap.get(abstractRouteFragment.lowerCasePath);

        if (existingAbstractRouteFragment) {
          if (existingAbstractRouteFragment.isCaseInsensitive
            || abstractRouteFragment.isCaseInsensitive) {
            if (abstractRouteFragment.parent) {
              throw new Error(`Route ${buildReadablePathBackFrom(abstractRouteFragment.parent)}`
                + ` has ambiguous children routes: ${existingAbstractRouteFragment.path},`
                + ` is case insensitive: ${existingAbstractRouteFragment.isCaseInsensitive};`
                + ` ${abstractRouteFragment.path}, is case insensitive:`
                + ` ${abstractRouteFragment.isCaseInsensitive}.`);
            }

            throw new Error(`Ambiguous top level routes: ${existingAbstractRouteFragment.path},`
              + ` is case insensitive: ${existingAbstractRouteFragment.isCaseInsensitive};`
              + ` ${abstractRouteFragment.path}, is case insensitive:`
              + ` ${abstractRouteFragment.isCaseInsensitive}.`);
          }
        } else {
          regularAbstractRouteFragmentsMap.set(abstractRouteFragment.lowerCasePath,
            abstractRouteFragment);
        }
      }

      validateUnresolvedAbstractRouteFragment(abstractRouteFragment, parentIsResolvable);
    });
  };

  const validateUnresolvedAbstractRouteFragment = (abstractRouteFragment, parentIsResolvable) => {
    const hasChildren = abstractRouteFragment.children.size;
    const isResolvable = abstractRouteFragment.isResolvable || parentIsResolvable;

    if (abstractRouteFragment.isResolvable && !hasChildren && abstractRouteFragment.component
      && abstractRouteFragment.controller) {
      throw new Error(`Route ${buildReadablePathBackFrom(abstractRouteFragment)} cannot have all`
        + ' three: component, controller and resolve, if it doesn\'t have children.');
    }

    if (abstractRouteFragment.component && !isFunc(abstractRouteFragment.component)) {
      throw new Error(`Route ${buildReadablePathBackFrom(abstractRouteFragment)} has an invalid`
        + ' component.');
    }

    if (abstractRouteFragment.resolve && !isFunc(abstractRouteFragment.resolve)) {
      throw new Error(`Route ${buildReadablePathBackFrom(abstractRouteFragment)} cannot have`
        + ' a non-function resolve.');
    }

    if (abstractRouteFragment.isFallbackFragment
      && ((!abstractRouteFragment.component && !isResolvable) || hasChildren)) {
      throw new Error(`Route ${buildReadablePathBackFrom(abstractRouteFragment)} must have at least`
        + ' a component and must not have children.');
    }

    if (!isResolvable && !abstractRouteFragment.component
      && (!hasChildren || (!abstractRouteFragment.path && !abstractRouteFragment.controller))) {
      throw new Error(`Route ${buildReadablePathBackFrom(abstractRouteFragment)} must have at least`
        + ' either a component or (a path and children) or (a controller and children).');
    }

    validateAbstractRouteFragmentsTree(abstractRouteFragment.children, isResolvable);
  };

  const getFullPathUrl = (url, basePath) => {
    if (basePath && url.startsWith('/')) {
      return basePath + url;
    }

    return url;
  };

  const getUrlPath = (url, basePath) => {
    if (basePath) {
      const slicedPath = url.pathname.slice(basePath.length);

      if (!url.pathname.startsWith(basePath) || slicedPath[0] && slicedPath[0] !== '/') {
        throw new Error(`URL doesn't start with the base path. Url: ${url}.`
          + ` Base path: ${basePath}`);
      }

      return normalizeAbsolutePath(slicedPath);
    }

    return url.pathname;
  };

  const match = (path, routesMap, router) => {
    const urlFragments = getUrlFragments(path);
    const matchingRouteFragmentsMap = new Map();

    routesMap.forEach((abstractRouteFragment) => matchAbstractRouteFragment(abstractRouteFragment,
      urlFragments, matchingRouteFragmentsMap, '', null, router));

    return awaitFor(resolveMatchingRouteFragmentsMap(matchingRouteFragmentsMap, path), () => {
      let bestRoute;
      let bestScore = '';

      matchingRouteFragmentsMap.forEach((score, routeFragment) => {
        // need to check if there is already a best route because score is not enough
        // as a fallback path route can have no score.
        // also it's important that if score equals bestScore we ignore it because
        // otherwise a fallback route could be the best even if its parent already matches
        // (this implies that the parent matches first).
        if (routeFragment.component && (!bestRoute || score > bestScore)) {
          bestRoute = routeFragment;
          bestScore = score;
        }
      });

      if (!bestRoute) {
        throw new Error(`Route ${path} not matched.`);
      }

      return bestRoute;
    });
  };

  const matchAbstractRouteFragment = (abstractRouteFragment, urlFragments,
    matchingRouteFragmentsMap, scoreString, matchingParentRouteFragment, router) => {
    const urlFragment = urlFragments[0];
    let routeFragmentScore;
    let mustAddRouteFragment;

    if (abstractRouteFragment.isFallbackFragment) {
      const routeFragment = new RouteFragment(abstractRouteFragment,
        urlFragments.length ? urlFragments.join('/') : '', matchingParentRouteFragment, router);

      matchingRouteFragmentsMap.set(routeFragment, scoreString);

      return;
    }

    if (abstractRouteFragment.path) {
      if (urlFragment) {
        routeFragmentScore = getMatchingScore(abstractRouteFragment, urlFragment);

        if (!routeFragmentScore) {
          return;
        }

        if (urlFragments.length === 1) {
          mustAddRouteFragment = true;
        }
      } else {
        return;
      }
    } else {
      routeFragmentScore = '0';

      if (!urlFragment) {
        mustAddRouteFragment = true;
      }
    }

    const routeFragment = new RouteFragment(abstractRouteFragment,
      abstractRouteFragment.path && urlFragment, matchingParentRouteFragment, router);

    const accumulatedScore = scoreString + routeFragmentScore;

    if (mustAddRouteFragment) {
      matchingRouteFragmentsMap.set(routeFragment, accumulatedScore);
    }

    if (abstractRouteFragment.children.size) {
      const urlFragmentsRest = abstractRouteFragment.path
        ? urlFragments.slice(1)
        : urlFragments;

      abstractRouteFragment.children.forEach((abstractRouteFragment) =>
        matchAbstractRouteFragment(abstractRouteFragment, urlFragmentsRest,
          matchingRouteFragmentsMap, accumulatedScore, routeFragment, router));
    }
  };

  const getMatchingScore = (abstractRouteFragment, urlFragment) => {
    if (abstractRouteFragment.isRegExpFragment) {
      if (abstractRouteFragment.regExp.test(urlFragment)) {
        return '1';
      }
    } else if (abstractRouteFragment.isParamFragment) {
      return '2';
    } else if (abstractRouteFragment.path === urlFragment
      || abstractRouteFragment.isCaseInsensitive
        && abstractRouteFragment.lowerCasePath === urlFragment.toLowerCase()) {
      return '3';
    }
  };

  const resolveMatchingRouteFragmentsMap = (matchingRouteFragmentsMap, url) => {
    const routeFragmentsTreeNodes = new Set();
    const abstractRouteFragments = new Set();

    matchingRouteFragmentsMap.forEach((score, routeFragment) => {
      while (routeFragment) {
        routeFragmentsTreeNodes.add(routeFragment);

        routeFragment = routeFragment.parent;
      }
    });

    return awaitAll(Array.from(routeFragmentsTreeNodes, (routeFragment) => {
      const abstractRouteFragment = abstractRouteFragmentsMap.get(routeFragment);

      return resolveMatchingAbstractRouteFragment(abstractRouteFragment, url);
    }), () => {
      routeFragmentsTreeNodes.forEach((routeFragment) => {
        const abstractRouteFragment = abstractRouteFragmentsMap.get(routeFragment);

        routeFragment.component = abstractRouteFragment.component;
        routeFragment.controller = abstractRouteFragment.controller;

        abstractRouteFragments.add(abstractRouteFragment);
      });

      abstractRouteFragments.forEach((abstractRouteFragment) =>
        validateResolvedAbstractRouteFragment(abstractRouteFragment, url));
    }, (errors) => {
      return Promise.reject(errors.find((error) => error));
    });
  };

  const resolveMatchingAbstractRouteFragment = (abstractRouteFragment, url) => {
    if (!abstractRouteFragment.isResolvable) {
      return;
    }

    const resolvePromise = abstractRouteFragment.resolve();

    if (!isPromise(resolvePromise)) {
      throw new Error('Route resolve() not returning a promise: '
        + buildReadablePathBackFrom(abstractRouteFragment)
        + `. Url: ${url}`);
    }

    return resolveThenable(resolvePromise).then(({component, controller, children} = {}) => {
      updateMatchingAbstractRouteFragment(abstractRouteFragment, url, component, controller,
        children);

      abstractRouteFragment.isResolved = true;
    });
  };

  const updateMatchingAbstractRouteFragment = (abstractRouteFragment, url, component, controller,
    children) => {
    if (!component && !controller && (!children || !children.length)) {
      throw new Error('Route must be resolved with at least a component,'
        + ` a controller or children: ${buildReadablePathBackFrom(abstractRouteFragment)}.`
        + ` Url: ${url}`);
    }

    if (component) {
      if (!isFunc(component)) {
        throw new Error('Route was resolved with an invalid component: '
          + `${buildReadablePathBackFrom(abstractRouteFragment)}. Url: ${url}`);
      }

      if (abstractRouteFragment.component) {
        throw new Error('Resolved route already has a component: '
          + `${buildReadablePathBackFrom(abstractRouteFragment)}. Url: ${url}`);
      }

      abstractRouteFragment.component = component;
    }

    if (controller) {
      if (abstractRouteFragment.controller) {
        throw new Error('Resolved route already has a controller: '
          + `${buildReadablePathBackFrom(abstractRouteFragment)}. Url: ${url}`);
      }

      abstractRouteFragment.controller = controller;
    }

    if (children) {
      children.forEach(({path, component, controller, children}) => {
        const {
          abstractRouteFragment: childAbstractRouteFragment,
          stopSearchAbstractRouteFragment,
          stopSearchUrlFragment
        } = abstractRouteFragment.getChildFromPath(path);

        if (!childAbstractRouteFragment) {
          throw new Error(`Resolved route doesn't have a child with path ${stopSearchUrlFragment
            || emptyPathSignal}: ${buildReadablePathBackFrom(stopSearchAbstractRouteFragment)}.`
            + ` Url: ${url}`);
        }

        updateMatchingAbstractRouteFragment(childAbstractRouteFragment, url, component,
          controller, children);
      });
    }
  };

  const validateResolvedAbstractRouteFragment = (abstractRouteFragment, url) => {
    if (!abstractRouteFragment.component) {
      if (abstractRouteFragment.isFallbackFragment) {
        throw new Error('Route must have a component: '
          + `${buildReadablePathBackFrom(abstractRouteFragment)}. Url: ${url}`);
      }

      if (!abstractRouteFragment.children.size) {
        throw new Error('Route with no children must have a component: '
          + `${buildReadablePathBackFrom(abstractRouteFragment)}. Url: ${url}`);
      }

      if (!abstractRouteFragment.path && !abstractRouteFragment.controller) {
        throw new Error('Route with no component and no path must have a controller: '
          + `${buildReadablePathBackFrom(abstractRouteFragment)}. Url: ${url}`);
      }
    }
  };

  const getRefreshRouteFragments = (refreshRouteFragment, targetRouteFragment,
    currentRouteFragments, existingRouteFragmentsMap) => {
    let foundNonRefreshDiff = false;
    // it's possible that the routeFragment is being left as the refresh transition is scheduled.
    let diffIndex = currentRouteFragments.indexOf(refreshRouteFragment);
    let hasRefreshRouteFragment = false;

    if (diffIndex === -1) {
      diffIndex = null;
    } else {
      hasRefreshRouteFragment = true;
    }

    const routeFragments = getRootRouteFragmentsArray(targetRouteFragment)
      .map((routeFragment, i) => {
        if (foundNonRefreshDiff) {
          return routeFragment;
        }

        if (hasRefreshRouteFragment && i >= diffIndex) {
          return routeFragment;
        }

        const abstractRouteFragment = abstractRouteFragmentsMap.get(routeFragment);
        const existingRouteFragment = existingRouteFragmentsMap.get(abstractRouteFragment);

        // even if hasRefreshRouteFragment it's possible that the abstract route fragments
        // were replaced using the router manager. however if they weren't removed it's not
        // possible to match them with a different routeFragment path when refreshing
        // (even in case of a fallback match).
        if (existingRouteFragment) {
          return existingRouteFragment;
        }

        foundNonRefreshDiff = true;
        diffIndex = i;

        return routeFragment;
      });

    if (diffIndex !== null) {
      const diffRouteFragment = routeFragments[diffIndex];

      if (diffRouteFragment.parent) {
        // set last common existing route fragment as parent
        diffRouteFragment.parent = routeFragments[diffIndex - 1];
      }
    } else if (currentRouteFragments.length > routeFragments.length) {
      diffIndex = routeFragments.length;
    }

    return {
      routeFragments,
      remainingRouteFragments: diffIndex === null
        ? routeFragments
        : routeFragments.slice(0, diffIndex),
      toExitRouteFragments: diffIndex === null ? [] : currentRouteFragments.slice(diffIndex),
      toEnterRouteFragments: diffIndex === null ? [] : routeFragments.slice(diffIndex)
    };
  };

  const getRootRouteFragmentsArray = (routeFragment) => {
    const routeFragments = [];

    while (routeFragment) {
      routeFragments.unshift(routeFragment);

      routeFragment = routeFragment.parent;
    }

    return routeFragments;
  };

  const getNewRouteFragments = (targetRouteFragment, currentRouteFragments,
    existingRouteFragmentsMap) => {
    let foundDiff = false;
    let diffIndex = null;

    const routeFragments = getRootRouteFragmentsArray(targetRouteFragment)
      .map((routeFragment, i) => {
        if (foundDiff) {
          return routeFragment;
        }

        const abstractRouteFragment = abstractRouteFragmentsMap.get(routeFragment);
        const existingRouteFragment = existingRouteFragmentsMap.get(abstractRouteFragment);

        if (existingRouteFragment
          && existingRouteFragment.normalizedPath === routeFragment.normalizedPath) {
          // update the path and url path of the existing route fragment with
          // the current matching path and url path
          existingRouteFragment.path = routeFragment.path;
          existingRouteFragment.urlPath = routeFragment.urlPath;

          return existingRouteFragment;
        }

        foundDiff = true;
        diffIndex = i;

        return routeFragment;
      });

    if (foundDiff) {
      const diffRouteFragment = routeFragments[diffIndex];

      if (diffRouteFragment.parent) {
        // set last common existing route fragment as parent
        diffRouteFragment.parent = routeFragments[diffIndex - 1];
      }
    } else if (currentRouteFragments.length > routeFragments.length) {
      diffIndex = routeFragments.length;
    }

    return {
      routeFragments,
      remainingRouteFragments: diffIndex === null
        ? routeFragments
        : routeFragments.slice(0, diffIndex),
      toExitRouteFragments: diffIndex === null ? [] : currentRouteFragments.slice(diffIndex),
      toEnterRouteFragments: diffIndex === null ? [] : routeFragments.slice(diffIndex)
    };
  };

  const getPathParams = (path, routeFragments) => {
    const urlFragments = getUrlFragments(path);
    const abstractRouteFragments = getAbstractRouteFragmentsWithPath(routeFragments);
    // the list of abstract route fragments can be smaller in case there is a fallback path
    const fragmentsLength = Math.min(urlFragments.length, abstractRouteFragments.length);
    const params = new URLSearchParams();

    for (let i = 0; i < fragmentsLength; i += 1) {
      const abstractRouteFragment = abstractRouteFragments[i];

      if (abstractRouteFragment.isParamFragment) {
        params.append(abstractRouteFragment.paramName, decodeURIComponent(urlFragments[i]));
      }
    }

    return params;
  };

  const getAbstractRouteFragmentsWithPath = (routeFragments) =>
    getRouteFragmentsWithPath(routeFragments)
      .map((routeFragment) => abstractRouteFragmentsMap.get(routeFragment));

  const getRouteFragmentsWithPath = (routeFragments) =>
    routeFragments.filter((routeFragment) => routeFragment.path);

  const areSearchParamsEqual = (params1, params2) => {
    if (!params1 !== !params2) {
      return false;
    }

    if (params1) {
      for (const key of params1.keys()) {
        if (!params2.has(key)) {
          return false;
        }

        const values1 = params1.getAll(key);
        const values2 = params2.getAll(key);

        if (values1.length !== values2.length) {
          return false;
        }

        if (values1.some((value, i) => value !== values2[i])) {
          return false;
        }
      }

      for (const key of params2.keys()) {
        if (!params1.has(key)) {
          return false;
        }
      }
    }

    return true;
  };

  const areUrlFragmentsMatched = (urlFragments, routeFragments) =>
    urlFragments.every((urlFragment, i) => isPathMatched(urlFragment, routeFragments[i]));

  const isPathMatched = (path, routeFragment) => (routeFragment.canCaseVary
    ? path.toLowerCase()
    : path) === routeFragment.normalizedPath;

  const canRouteFragmentsCaseVary = (abstractRouteFragment) =>
    abstractRouteFragment.isCaseInsensitive
      && (abstractRouteFragment.isRegularFragment || abstractRouteFragment.isRegExpFragment);

  class Link extends Component {
    constructor(props, context) {
      super();

      this.currentRouteFragment = context.router.currentRouteFragment;

      this.onClick = this.onClick.bind(this);
    }

    shouldComponentUpdate(nextProps) {
      const oldRouteFragment = this.currentRouteFragment;

      this.currentRouteFragment = this.context.router.currentRouteFragment;

      return nextProps.to !== this.props.to || nextProps.className !== this.props.className
        || nextProps.children !== this.props.children
        || oldRouteFragment !== this.currentRouteFragment;
    }

    onClick(e) {
      e.preventDefault();
      this.context.router.transitionTo(this.props.to);
    }

    render() {
      let className = this.props.className || '';
      const router = this.context.router;

      if (router.isPathActive(this.props.to)) {
        className += ' is-active';
      }

      if (router.isDescendantPathActive(this.props.to)) {
        className += ' is-descendant-active';
      }

      return createElement('a', {
          href: getFullPathUrl(this.props.to, router.basePath),
          onClick: this.onClick,
          // if className is the empty string set as undefined
          className: className || undefined
        },
        this.props.children
      );
    }
  }

  Link.propTypes = {
    to: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    className: PropTypes.string
  };

  Link.contextTypes = {
    router: PropTypes.object.isRequired
  };

  Router.Link = Link;

  const moduleExports = Router;

  if (isModule) {
    module.exports = moduleExports;
  } else {
    window.crizmas.Router = moduleExports;
  }
})();
