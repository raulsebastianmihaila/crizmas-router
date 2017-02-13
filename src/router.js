(() => {
  'use strict';

  const isModule = typeof module === 'object' && typeof module.exports === 'object';

  let React;
  let Mvc;
  let history;
  let utils;
  let asyncUtils;

  if (isModule) {
    React = require('react');
    Mvc = require('crizmas-mvc');
    history = require('./history');
    utils = require('crizmas-utils');
    asyncUtils = require('crizmas-async-utils');
  } else {
    React = window.React;
    ({Mvc, history, utils, asyncUtils} = window.crizmas);
  }

  const {Component, PropTypes} = React;
  const {isFunc, isPromise} = utils;
  const {awaitFor, awaitAll} = asyncUtils;

  const fallbackPath = '*';
  const identifierRegExp = /^\w+$/;
  const emptyPathSignal = '{*empty*}';
  // matching route fragment - route fragment map
  const abstractRouteFragmentsMap = new WeakMap();

  function normalizePath(path) {
    if (path.endsWith('/')) {
      return path.slice(0, path.length - 1);
    }

    return path;
  }

  function normalizeAbsolutePath(path) {
    if (path.startsWith('/')) {
      return normalizePath(path);
    }

    return normalizePath(`/${path}`);
  }

  function getUrlFragments(path = '') {
    return path.split('/').filter(fragment => fragment);
  }

  function isParamFragment(urlFragment) {
    return urlFragment[0] === ':' && identifierRegExp.test(urlFragment.slice(1));
  }

  function buildReadablePathBackFrom(abstractRouteFragment) {
    let path = abstractRouteFragment.path || emptyPathSignal;

    abstractRouteFragment = abstractRouteFragment.parent;

    while (abstractRouteFragment) {
      path = `${abstractRouteFragment.path || emptyPathSignal}/${path}`;
      abstractRouteFragment = abstractRouteFragment.parent;
    }

    return path;
  }

  function rootController(controller) {
    if (Mvc.isObservedObject(controller)) {
      Mvc.root(controller);
    }
  }

  function unrootController(controller) {
    if (Mvc.isObservedObject(controller)) {
      Mvc.unroot(controller);
    }
  }

  function AbstractRouteFragment(path, parent, component, controller, resolve) {
    this.parent = parent;
    this.path = path;
    this.component = component;
    this.controller = controller;
    this.resolve = resolve;
    this.isResolved = !resolve;
    this.children = new Map();
  }

  AbstractRouteFragment.prototype.getResolvedChildFromPath = function (path, url) {
    let urlFragments = getUrlFragments(path);

    if (!urlFragments.length) {
      urlFragments = [''];
    }

    let abstractRouteFragment = this;
    let childAbstractRouteFragment;

    urlFragments.forEach(urlFragment => {
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

  function RouteFragment(abstractRouteFragment, path, parentMatchingRouteFragment) {
    abstractRouteFragmentsMap.set(this, abstractRouteFragment);

    path = path || null;

    this.path = path;
    this.abstractPath = abstractRouteFragment.path;
    this.urlPath = path
      ? parentMatchingRouteFragment
        ? `${normalizePath(parentMatchingRouteFragment.urlPath)}/${path}`
        : normalizeAbsolutePath(path)
      : parentMatchingRouteFragment
        ? parentMatchingRouteFragment.urlPath
        : '/';
    this.component = abstractRouteFragment.component;
    this.controller = abstractRouteFragment.controller;
    this.controllerObject = null;
    this.parent = parentMatchingRouteFragment;
  }

  function resolveAbstractRouteFragment(urlFragment, parent, parentMap, component,
    controller, resolve) {
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
  }

  function resolveInputRoute(inputRoute, parent, parentMap) {
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
      inputRoute.children.forEach(inputRoute =>
        resolveInputRoute(inputRoute, parent, parentMap));
    }
  }

  function matchRouteFragment(abstractRouteFragment, urlFragments, matchingFragmentsMap,
    scoreString, matchingParentFragment) {
    const urlFragment = urlFragments[0];
    let routeFragmentScore;
    let mustAddRouteFragment;

    if (abstractRouteFragment.path === fallbackPath) {
      const routeFragment = new RouteFragment(abstractRouteFragment,
        urlFragments.length && urlFragments.join('/'), matchingParentFragment);

      matchingFragmentsMap.set(routeFragment, scoreString);

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

    const routeFragment = new RouteFragment(abstractRouteFragment,
      abstractRouteFragment.path && urlFragment, matchingParentFragment);

    const accumulatedScore = scoreString + routeFragmentScore;

    if (mustAddRouteFragment) {
      matchingFragmentsMap.set(routeFragment, accumulatedScore);
    }

    if (abstractRouteFragment.children.size) {
      const urlFragmentsRest = abstractRouteFragment.path
        ? urlFragments.slice(1)
        : urlFragments;

      abstractRouteFragment.children.forEach(abstractRouteFragment =>
        matchRouteFragment(abstractRouteFragment, urlFragmentsRest, matchingFragmentsMap,
          accumulatedScore, routeFragment));
    }
  }

  function getMatchingScore(path, urlFragment) {
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
  }

  function resolveMatchingFragment(abstractRouteFragment, url) {
    if (abstractRouteFragment.isResolved) {
      return;
    }

    const resolvePromise = abstractRouteFragment.resolve();

    if (!isPromise(resolvePromise)) {
      throw new Error('Route resolve() not returning a promise: '
        + buildReadablePathBackFrom(abstractRouteFragment)
        + `. Url: ${url}`);
    }

    return Promise.resolve(resolvePromise).then(({component, controller, children} = {}) => {
      updateMatchingFragment(abstractRouteFragment, url, component, controller, children);

      abstractRouteFragment.isResolved = true;
    });
  }

  function updateMatchingFragment(abstractRouteFragment, url, component, controller, children) {
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
        updateMatchingFragment(abstractRouteFragment.getResolvedChildFromPath(path, url), url,
          component, controller, children);
      });
    }
  }

  function validateResolvedAbstractRouteFragment(abstractRouteFragment, url) {
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
  }

  function validateUnresolvedAbstractRouteFragment(abstractRouteFragment, parentIsResolvable) {
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

    abstractRouteFragment.children.forEach(child =>
      validateUnresolvedAbstractRouteFragment(child, isResolvable));
  }

  function resolveMatchingFragmentsMap(matchingFragmentsMap, url) {
    const routeFragmentsTreeNodes = new Set();
    const abstractRouteFragments = new Set();

    matchingFragmentsMap.forEach((score, routeFragment) => {
      while (routeFragment) {
        routeFragmentsTreeNodes.add(routeFragment);

        routeFragment = routeFragment.parent;
      }
    });

    return awaitAll(Array.from(routeFragmentsTreeNodes).map(routeFragment => {
      const abstractRouteFragment = abstractRouteFragmentsMap.get(routeFragment);

      return resolveMatchingFragment(abstractRouteFragment, url);
    }), () => {
      routeFragmentsTreeNodes.forEach(routeFragment => {
        const abstractRouteFragment = abstractRouteFragmentsMap.get(routeFragment);

        routeFragment.component = abstractRouteFragment.component;
        routeFragment.controller = abstractRouteFragment.controller;

        abstractRouteFragments.add(abstractRouteFragment);
      });

      abstractRouteFragments.forEach(abstractRouteFragment =>
        validateResolvedAbstractRouteFragment(abstractRouteFragment, url));
    }, (errors) => {
      return Promise.reject(errors.find(error => error));
    });
  }

  function match(path, routesMap) {
    const urlFragments = getUrlFragments(path);
    const matchingFragmentsMap = new Map();

    routesMap.forEach(abstractRouteFragment => matchRouteFragment(abstractRouteFragment,
      urlFragments, matchingFragmentsMap, '', null));

    return awaitFor(resolveMatchingFragmentsMap(matchingFragmentsMap, path), () => {
      let bestRoute;
      let bestScore = '';

      matchingFragmentsMap.forEach((score, abstractRouteFragment) => {
        // need to check if there is already a best route because score is not enough
        // as a fallback path route can have no score
        if (abstractRouteFragment.component && (!bestRoute || score > bestScore)) {
          bestRoute = abstractRouteFragment;
          bestScore = score;
        }
      });

      if (!bestRoute) {
        throw new Error(`Route ${path} not matched.`);
      }

      return bestRoute;
    });
  }

  function getPathParams(path, routeFragments) {
    const urlFragments = getUrlFragments(path);
    const routeUrlFragments = getRouteFragmentsPaths(routeFragments);
    // the list of route fragments can be smaller in case there is a fallback path
    const fragmentsLength = Math.min(urlFragments.length, routeUrlFragments.length);
    const params = new URLSearchParams();

    for (let i = 0; i < fragmentsLength; i += 1) {
      const routeUrlFragment = routeUrlFragments[i];

      if (isParamFragment(routeUrlFragment)) {
        params.append(routeUrlFragment.slice(1), urlFragments[i]);
      }
    }

    return params;
  }

  function getRootRoutesArray(routeFragment) {
    const routes = [];

    while (routeFragment) {
      routes.unshift(routeFragment);

      routeFragment = routeFragment.parent;
    }

    return routes;
  }

  function isRouteFragmentEqual(routeFragment1, routeFragment2) {
    // if their truthiness is different
    if (!routeFragment1 !== !routeFragment2) {
      return false;
    }

    // if none of them is truthy
    if (!routeFragment1) {
      return true;
    }

    return routeFragment1.path === routeFragment2.path
      && abstractRouteFragmentsMap.get(routeFragment1)
        === abstractRouteFragmentsMap.get(routeFragment2);
  }

  function getRoutesTailDifference(routeFragments1, routeFragments2) {
    const maxLength = Math.min(routeFragments1.length, routeFragments2.length);
    let diffIndex = maxLength > 0
      ? routeFragments1.length === routeFragments2.length
        ? null
        // the sets are different at least starting with maxLength index
        : maxLength
      // initially there are no route fragments so diffIndex must be 0
      : 0;

    for (let i = 0; i < maxLength; i += 1) {
      if (!isRouteFragmentEqual(routeFragments1[i], routeFragments2[i])) {
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
  }

  function getRouteFragmentsPaths(routeFragments) {
    return routeFragments.map(routeFragment => routeFragment.abstractPath)
      .filter(path => path);
  }

  function getUrlPath(url, basePath) {
    if (basePath) {
      const slicedPath = url.pathname.slice(basePath.length);

      if (!url.pathname.startsWith(basePath) || slicedPath[0] && slicedPath[0] !== '/') {
        throw new Error(`URL doesn't start with the base path. Url: ${url}. `
          + `Base path: ${basePath}`);
      }

      return normalizeAbsolutePath(slicedPath);
    }

    return url.pathname;
  }

  function getFullPath(path, basePath) {
    if (basePath && path.startsWith('/')) {
      return basePath + path;
    }

    return path;
  }

  function Router({basePath, routes}) {
    if (!new.target) {
      throw new Error('The function must be called as a constructor.');
    }

    const routesMap = new Map();
    const beforeChangeCbs = new Set();
    const changeCbs = new Set();
    let nextTransitionUrl = null;

    routes.forEach(inputRoute => resolveInputRoute(inputRoute, null, routesMap));
    routesMap.forEach(abstractRouteFragment =>
      validateUnresolvedAbstractRouteFragment(abstractRouteFragment));

    this.basePath = basePath = basePath && normalizeAbsolutePath(basePath);
    this.currentRouteFragments = [];
    this.isTransitioning = false;
    this.currentRouteFragment = null;
    this.targetRouteFragment = null;
    this.params = null;
    this.url = null;
    this.isMounted = false;

    const transition = Mvc.observe((url) => {
      if (this.isTransitioning) {
        nextTransitionUrl = url;

        return;
      }

      const path = getUrlPath(url, basePath);

      this.isTransitioning = true;

      return awaitFor(match(path, routesMap), (routeFragment) => {
        const routeFragments = getRootRoutesArray(routeFragment);

        this.url = url;
        this.params = getPathParams(path, routeFragments);
        this.targetRouteFragment = routeFragment;

        const routesDifference = getRoutesTailDifference(this.currentRouteFragments, routeFragments);
        const oldRouteFragment = this.currentRouteFragment;
        const isChangingRoute = !!routesDifference[0].length || !!routesDifference[1].length;

        if (isChangingRoute) {
          beforeChangeCbs.forEach(cb => cb({
            currentRouteFragment: this.currentRouteFragment,
            targetRouteFragment: this.targetRouteFragment,
            router: this
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
        }), result => {
          this.isTransitioning = false;
          this.targetRouteFragment = null;

          if (!isRouteFragmentEqual(this.currentRouteFragment, oldRouteFragment)) {
            changeCbs.forEach(cb => cb({
              oldRouteFragment,
              currentRouteFragment: this.currentRouteFragment,
              router: this
            }));
          }

          if (nextTransitionUrl) {
            return nextTransition();
          }

          if (result === false) {
            if (!this.currentRouteFragment) {
              const abstractRouteFragment = abstractRouteFragmentsMap.get(routeFragment);

              throw new Error('Top level route refusing to enter: '
                + buildReadablePathBackFrom(abstractRouteFragment)
                + `. Url: ${routeFragment.urlPath}`);
            }

            this.transitionTo(this.currentRouteFragment.urlPath);
          }
        });
      });
    });

    function nextTransition() {
      const url = nextTransitionUrl;

      nextTransitionUrl = null;

      transition(url);
    }

    const addRouteFragment = Mvc.observe((routeFragment) => {
      this.currentRouteFragment = routeFragment;

      this.currentRouteFragments.push(routeFragment);
    });

    const removeRouteFragment = Mvc.observe((routeFragment) => {
      this.currentRouteFragment = routeFragment.parent;

      this.currentRouteFragments.pop();
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
          router: this,
          routeFragment
        }), result => {
          if (result !== false) {
            unrootController(routeFragment.controllerObject);
          }

          return result;
        });
      }

      unrootController(routeFragment.controllerObject);
    };

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
              router: this,
              routeFragment
            }), result => {
              if (result === false) {
                unrootController(controller);
              }

              return result;
            });
          }
        });
      }
    };

    const transitionTo = (path) => {
      history.push(getFullPath(path, basePath));
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

    const isPathActive = path => {
      return !!this.currentRouteFragment
        && normalizeAbsolutePath(path) === normalizeAbsolutePath(this.currentRouteFragment.urlPath);
    };

    const isDescendantPathActive = path => {
      path = normalizeAbsolutePath(path);

      if (!this.currentRouteFragment) {
        return false;
      }

      const currentUrl = normalizeAbsolutePath(this.currentRouteFragment.urlPath);

      return currentUrl.startsWith(path)
        && currentUrl[path.length] === '/';
    };

    this.mount = () => {
      if (!this.isMounted) {
        history.on(transition);

        this.isMounted = true;

        transition(history.getUrl());
      }
    };

    this.unmount = () => {
      if (this.isMounted) {
        history.off(transition);

        this.isMounted = false;
      }
    };

    this.onBeforeChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      beforeChangeCbs.add(cb);
    };

    this.offBeforeChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      beforeChangeCbs.delete(cb);
    };

    this.onChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      changeCbs.add(cb);
    };

    this.offChange = (cb) => {
      if (!isFunc(cb)) {
        throw new Error('The event listener must be a function.');
      }

      changeCbs.delete(cb);
    };

    this.getRootElement = () => {
      return getRootElement(this.currentRouteFragment);
    };

    this.transitionTo = transitionTo;
    this.isPathActive = isPathActive;
    this.isDescendantPathActive = isDescendantPathActive;
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

  Router.prototype.jumpToHash = history.jumpToHash;

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
        className += 'is-active ';
      }

      if (router.isDescendantPathActive(this.props.to)) {
        className += 'is-descendant-active';
      }

      return React.DOM.a(
        {
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
