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

  const {Component} = React;
  const {isFunc, isPromise, resolveThenable} = utils;
  const {awaitFor, awaitAll} = asyncUtils;

  const fallbackPath = '*';
  const identifierRegExp = /^\w+$/;
  const emptyPathSignal = '{*empty*}';
  // <route fragment - matching abstract route fragment> map
  const abstractRouteFragmentsMap = new WeakMap();

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
    if (path.endsWith('/')) {
      return path.slice(0, path.length - 1);
    }

    return path;
  };

  const normalizeAbsolutePath = (path) => {
    if (path.startsWith('/')) {
      return normalizePath(path);
    }

    return normalizePath(`/${path}`);
  };

  const getUrlFragments = (path = '') => {
    return path.split('/').filter((fragment) => fragment);
  };

  const isParamFragment = (urlFragment) => {
    return urlFragment[0] === ':' && identifierRegExp.test(urlFragment.slice(1));
  };

  function Router({basePath, routes}) {
    const routesMap = new Map();
    const existingRouteFragmentsMap = new WeakMap();
    const beforeChangeCbs = new Set();
    const changeCbs = new Set();
    let nextTransitionUrl = null;

    const router = {
      basePath: basePath = basePath && normalizeAbsolutePath(basePath),
      currentRouteFragments: [],
      isTransitioning: false,
      currentRouteFragment: null,
      targetRouteFragment: null,
      params: null,
      url: null,
      isMounted: false
    };

    const init = () => {
      routes.forEach((inputRoute) => resolveInputRoute(inputRoute, null, routesMap));
      routesMap.forEach((abstractRouteFragment) =>
        validateUnresolvedAbstractRouteFragment(abstractRouteFragment));
    };

    router.transitionTo = (path) => {
      history.push(getFullPath(path, basePath));
    };

    router.mount = () => {
      if (!router.isMounted) {
        history.on(transition);

        router.isMounted = true;

        transition(history.getUrl());
      }
    };

    const transition = Mvc.observe((url) => {
      if (router.isTransitioning) {
        nextTransitionUrl = url;

        return;
      }

      const path = getUrlPath(url, basePath);

      router.isTransitioning = true;

      return awaitFor(match(path, routesMap, existingRouteFragmentsMap), (routeFragment) => {
        if (nextTransitionUrl) {
          router.isTransitioning = false;

          return nextTransition();
        }

        const routeFragments = getRootRouteFragmentsArray(routeFragment);

        router.url = url;
        router.params = getPathParams(path, routeFragments);
        router.targetRouteFragment = routeFragment;

        const routesDifference = getRoutesTailDifference(router.currentRouteFragments,
          routeFragments);
        const oldRouteFragment = router.currentRouteFragment;
        const isChangingRoute = !!routesDifference[0].length || !!routesDifference[1].length;

        if (isChangingRoute) {
          beforeChangeCbs.forEach((cb) => cb({
            currentRouteFragment: router.currentRouteFragment,
            targetRouteFragment: router.targetRouteFragment,
            router
          }));
        }

        // even if there is no route change, allow the same flow so that
        // the flags are set appropriately (like targetRouteFragment).
        // it keeps the code simpler.

        return awaitFor(awaitFor(exitRouteFragments(routesDifference[0]), (result) => {
          if (nextTransitionUrl || result === false) {
            return result;
          }

          return awaitFor(enterRouteFragments(routesDifference[1]));
        }), (result) => {
          router.isTransitioning = false;
          router.targetRouteFragment = null;

          if (router.currentRouteFragment !== oldRouteFragment) {
            changeCbs.forEach((cb) => cb({
              oldRouteFragment,
              currentRouteFragment: router.currentRouteFragment,
              router
            }));
          }

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

            // reset the current URL
            router.transitionTo(router.currentRouteFragment.urlPath);
          }
        });
      });
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

      nextTransitionUrl = null;

      transition(url);
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
        ? React.createElement(
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

    router.isPathActive = (path) => {
      return !!router.currentRouteFragment && normalizeAbsolutePath(path)
        === normalizeAbsolutePath(router.currentRouteFragment.urlPath);
    };

    router.isDescendantPathActive = (path) => {
      path = normalizeAbsolutePath(path);

      if (!router.currentRouteFragment) {
        return false;
      }

      const currentUrl = normalizeAbsolutePath(router.currentRouteFragment.urlPath);

      return currentUrl.startsWith(path)
        && currentUrl[path.length] === '/';
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

    router.jumpToHash = history.jumpToHash;

    init();

    return router;
  }

  Router.fallbackRoute = ({to}) => {
    return {
      path: fallbackPath,
      // a fallback route must have a component
      component: () => React.DOM.span(null),
      controller: {
        onEnter({router}) {
          router.transitionTo(to);
        }
      }
    };
  };

  function AbstractRouteFragment(path, parent, component, controller, resolve) {
    const arf = {
      parent,
      path,
      component,
      controller,
      resolve,
      isResolved: !resolve,
      children: new Map()
    };

    arf.getChildFromPath = (path, url) => {
      let urlFragments = getUrlFragments(path);

      if (!urlFragments.length) {
        urlFragments = [''];
      }

      let abstractRouteFragment = arf;
      let childAbstractRouteFragment;

      urlFragments.forEach((urlFragment) => {
        childAbstractRouteFragment = abstractRouteFragment.children.get(urlFragment);

        if (!childAbstractRouteFragment) {
          throw new Error(`Resolved route doesn't have a child with path ${urlFragment
            || emptyPathSignal}: ${buildReadablePathBackFrom(abstractRouteFragment)}.`
            + ` Url: ${url}`);
        }

        abstractRouteFragment = childAbstractRouteFragment;
      });

      return childAbstractRouteFragment;
    };

    return arf;
  }

  function RouteFragment(abstractRouteFragment, path, matchingParentRouteFragment) {
    const routeFragment = {
      path,
      abstractPath: abstractRouteFragment.path,
      urlPath: path
        ? matchingParentRouteFragment
          ? `${normalizePath(matchingParentRouteFragment.urlPath)}/${path}`
          : normalizeAbsolutePath(path)
        : matchingParentRouteFragment
          ? matchingParentRouteFragment.urlPath
          : '/',
      component: abstractRouteFragment.component,
      controller: abstractRouteFragment.controller,
      controllerObject: null,
      parent: matchingParentRouteFragment
    };

    abstractRouteFragmentsMap.set(routeFragment, abstractRouteFragment);

    return routeFragment;
  }

  const resolveInputRoute = (inputRoute, parent, parentMap) => {
    const urlFragments = getUrlFragments(inputRoute.path);

    if (!urlFragments.length) {
      parent = resolveAbstractRouteFragment('', parent, parentMap, inputRoute.component,
        inputRoute.controller, inputRoute.resolve);
      parentMap = parent.children;
    } else {
      const lastFragmentIndex = urlFragments.length - 1;

      urlFragments.forEach((urlFragment, i) => {
        let controller;
        let component;
        let resolve;

        if (i === lastFragmentIndex) {
          controller = inputRoute.controller;
          component = inputRoute.component;
          resolve = inputRoute.resolve;
        }

        parent = resolveAbstractRouteFragment(urlFragment, parent, parentMap,
          component, controller, resolve);
        parentMap = parent.children;
      });
    }

    if (inputRoute.children) {
      inputRoute.children.forEach((inputRoute) =>
        resolveInputRoute(inputRoute, parent, parentMap));
    }
  };

  const resolveAbstractRouteFragment = (urlFragment, parent, parentMap, component,
    controller, resolve) => {
    let abstractRouteFragment = parentMap.get(urlFragment);
    const isDefiningFragment = component || controller || resolve;

    if (abstractRouteFragment) {
      if (isDefiningFragment) {
        if (abstractRouteFragment.component || abstractRouteFragment.controller
          || abstractRouteFragment.resolve) {
          throw new Error(`Route ${buildReadablePathBackFrom(abstractRouteFragment)} is defined`
            + ' more than once.');
        }

        abstractRouteFragment.component = component;
        abstractRouteFragment.controller = controller;
        abstractRouteFragment.resolve = resolve;
        abstractRouteFragment.isResolved = !resolve;
      }

      return abstractRouteFragment;
    }

    abstractRouteFragment = new AbstractRouteFragment(urlFragment, parent, component,
      controller, resolve);

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

  const validateUnresolvedAbstractRouteFragment = (abstractRouteFragment, parentIsResolvable) => {
    const hasChildren = abstractRouteFragment.children.size;
    const isResolvable = abstractRouteFragment.resolve || parentIsResolvable;

    if (!hasChildren && abstractRouteFragment.component && abstractRouteFragment.controller
      && abstractRouteFragment.resolve) {
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

    if (abstractRouteFragment.path === fallbackPath
      && ((!abstractRouteFragment.component && !isResolvable) || hasChildren)) {
      throw new Error(`Route ${buildReadablePathBackFrom(abstractRouteFragment)} must have at least`
        + ' a component and must not have children.');
    }

    if (!isResolvable && !abstractRouteFragment.component
      && (!hasChildren || (!abstractRouteFragment.path && !abstractRouteFragment.controller))) {
      throw new Error(`Route ${buildReadablePathBackFrom(abstractRouteFragment)} must have at least`
        + ' either a component or (a path and children) or (a controller and children).');
    }

    abstractRouteFragment.children.forEach((child) =>
      validateUnresolvedAbstractRouteFragment(child, isResolvable));
  };

  const getFullPath = (path, basePath) => {
    if (basePath && path.startsWith('/')) {
      return basePath + path;
    }

    return path;
  };

  const getUrlPath = (url, basePath) => {
    if (basePath) {
      const slicedPath = url.pathname.slice(basePath.length);

      if (!url.pathname.startsWith(basePath) || slicedPath[0] && slicedPath[0] !== '/') {
        throw new Error(`URL doesn't start with the base path. Url: ${url}. `
          + `Base path: ${basePath}`);
      }

      return normalizeAbsolutePath(slicedPath);
    }

    return url.pathname;
  };

  const match = (path, routesMap, existingRouteFragmentsMap) => {
    const urlFragments = getUrlFragments(path);
    const matchingRouteFragmentsMap = new Map();

    routesMap.forEach((abstractRouteFragment) => matchAbstractRouteFragment(abstractRouteFragment,
      urlFragments, matchingRouteFragmentsMap, '', null, existingRouteFragmentsMap));

    return awaitFor(resolveMatchingRouteFragmentsMap(matchingRouteFragmentsMap, path), () => {
      let bestRoute;
      let bestScore = '';

      matchingRouteFragmentsMap.forEach((score, routeFragment) => {
        // need to check if there is already a best route because score is not enough
        // as a fallback path route can have no score
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
    matchingRouteFragmentsMap, scoreString, matchingParentRouteFragment,
    existingRouteFragmentsMap) => {
    const urlFragment = urlFragments[0];
    let routeFragmentScore;
    let mustAddRouteFragment;

    if (abstractRouteFragment.path === fallbackPath) {
      const routeFragment = getRouteFragment(abstractRouteFragment,
        urlFragments.length ? urlFragments.join('/') : '', matchingParentRouteFragment,
        existingRouteFragmentsMap);

      matchingRouteFragmentsMap.set(routeFragment, scoreString);

      return;
    }

    if (abstractRouteFragment.path) {
      if (urlFragment) {
        routeFragmentScore = getMatchingScore(abstractRouteFragment.path, urlFragment);

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

    const routeFragment = getRouteFragment(abstractRouteFragment,
      abstractRouteFragment.path && urlFragment, matchingParentRouteFragment,
      existingRouteFragmentsMap);

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
          matchingRouteFragmentsMap, accumulatedScore, routeFragment, existingRouteFragmentsMap));
    }
  };

  const getRouteFragment = (abstractRouteFragment, path, matchingParentRouteFragment,
    existingRouteFragmentsMap) => {
    const existingRouteFragment = existingRouteFragmentsMap.get(abstractRouteFragment);

    if (existingRouteFragment && existingRouteFragment.path === path) {
      return existingRouteFragment;
    }

    return new RouteFragment(abstractRouteFragment, path, matchingParentRouteFragment);
  };

  const getMatchingScore = (path, urlFragment) => {
    if (path === urlFragment) {
      return '3';
    }

    if (isParamFragment(path)) {
      return '2';
    }

    const pathRegExp = new RegExp(`^${path}$`);

    if (pathRegExp.test(urlFragment)) {
      return '1';
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
    if (abstractRouteFragment.isResolved) {
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
        updateMatchingAbstractRouteFragment(abstractRouteFragment.getChildFromPath(path, url), url,
          component, controller, children);
      });
    }
  };

  const validateResolvedAbstractRouteFragment = (abstractRouteFragment, url) => {
    if (!abstractRouteFragment.component) {
      if (abstractRouteFragment.path === fallbackPath) {
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

  const getRootRouteFragmentsArray = (routeFragment) => {
    const routeFragments = [];

    while (routeFragment) {
      routeFragments.unshift(routeFragment);

      routeFragment = routeFragment.parent;
    }

    return routeFragments;
  };

  const getPathParams = (path, routeFragments) => {
    const urlFragments = getUrlFragments(path);
    const routeUrlFragments = getRouteFragmentsPaths(routeFragments);
    // the list of route fragments can be smaller in case there is a fallback path
    const fragmentsLength = Math.min(urlFragments.length, routeUrlFragments.length);
    const params = new URLSearchParams();

    for (let i = 0; i < fragmentsLength; i += 1) {
      const routeUrlFragment = routeUrlFragments[i];

      if (isParamFragment(routeUrlFragment)) {
        params.append(routeUrlFragment.slice(1), decodeURIComponent(urlFragments[i]));
      }
    }

    return params;
  };

  const getRouteFragmentsPaths = (routeFragments) => {
    return routeFragments.map((routeFragment) => routeFragment.abstractPath)
      .filter((path) => path);
  };

  const getRoutesTailDifference = (routeFragments1, routeFragments2) => {
    const maxLength = Math.min(routeFragments1.length, routeFragments2.length);
    let diffIndex = maxLength > 0
      ? routeFragments1.length === routeFragments2.length
        ? null
        // the sets are different at least starting with maxLength index
        : maxLength
      // initially there are no route fragments so diffIndex must be 0
      : 0;

    for (let i = 0; i < maxLength; i += 1) {
      if (routeFragments1[i] !== routeFragments2[i]) {
        diffIndex = i;
        break;
      }
    }

    if (diffIndex === null) {
      // this means the sets of route fragments are the same
      return [[], []];
    }

    return [
      routeFragments1.slice(diffIndex),
      routeFragments2.slice(diffIndex)
    ];
  };

  class Link extends Component {
    constructor() {
      super();

      this.onClick = this.onClick.bind(this);
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

      return React.DOM.a({
          href: getFullPath(this.props.to, router.basePath),
          onClick: this.onClick,
          className
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
