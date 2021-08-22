/**
 * @jest-environment jsdom
 */

import {URL, URLSearchParams} from 'url';
import {jest} from '@jest/globals';
import Mvc, {observe, isObservedObject} from 'crizmas-mvc';

import Router from '../src/router.js';
import * as history from '../src/history.js';

globalThis.URLSearchParams = URLSearchParams;
globalThis.URL = URL;

describe('router', () => {
  describe('Router', () => {
    // test('needs testing', () => {
    //   expect.assertions(1);

    // });

    test('fragment path can appear in two different places', () => {
      expect.assertions(1);
      expect(() => {
        new Router({
          routes: [
            {
              component: () => false
            },
            {}
          ]
        });
      }).not.toThrow();
    });

    test('fragment path refers to the same route fragment in two different places', () => {
      expect.assertions(10);

      const parentControllerObservation = jest.fn();
      const childComponentObservation = jest.fn();
      const router = new Router({
        routes: [
          {
            component: () => false
          },
          {
            path: 'parent',
            controller: {
              onEnter() {
                parentControllerObservation();
              }
            }
          },
          {
            path: 'parent/child',
            component: () => {
              childComponentObservation();

              return false;
            }
          }
        ]
      });

      expect(router.currentRouteFragments.length).toBe(0);
      expect(router.currentRouteFragment).toBe(null);

      const mvc = new Mvc({
        router,
        domElement: document.createElement('div')
      });

      expect(parentControllerObservation.mock.calls.length).toBe(0);
      expect(parentControllerObservation.mock.calls.length).toBe(0);
      expect(router.currentRouteFragments.length).toBe(1);
      expect(router.currentRouteFragment.abstractPath).toBe('');
      router.transitionTo('parent/child');
      expect(parentControllerObservation.mock.calls.length).toBe(1);
      expect(parentControllerObservation.mock.calls.length).toBe(1);
      expect(router.currentRouteFragments.length).toBe(2);
      expect(router.currentRouteFragment.abstractPath).toBe('child');
      mvc.unmount();
      history.push('/');
    });

    test('fragment path can not be defined in two different places', () => {
      expect.assertions(1);
      expect(() => {
        new Router({
          routes: [
            {
              component: () => false
            },
            {
              controller: {}
            }
          ]
        });
      }).toThrowError(new Error('Route {*empty*} is defined more than once.'));
    });

    test('the controller is passed to the component as prop', () => {
      expect.assertions(1);

      const controller = {};
      const mvc = new Mvc({
        router: new Router({
          routes: [
            {
              controller,
              component: ({controller: controller_}) => {
                expect(controller_).toBe(controller);

                return false;
              }
            }
          ]
        }),
        domElement: document.createElement('div')
      });

      mvc.unmount();
    });

    describe('transitionTo', () => {
      test('matching route', () => {
        expect.assertions(12);

        const controllerObservation = jest.fn();
        const componentObservation = jest.fn();

        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);

        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'test',
              controller: {
                onEnter() {
                  controllerObservation();
                }
              },
              component: () => {
                componentObservation();

                return false;
              }
            }
          ]
        });

        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        router.transitionTo('test');
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(componentObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('test');
        mvc.unmount();
        history.push('/');
      });

      test('matching parent route and child route', () => {
        expect.assertions(18);

        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();

        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(0);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);

        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              controller: {
                onEnter() {
                  parentControllerObservation();
                }
              },
              component: ({children}) => {
                parentComponentObservation();

                return children;
              },
              children: [
                {
                  path: 'child',
                  controller: {
                    onEnter() {
                      childControllerObservation();
                    }
                  },
                  component: () => {
                    childComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(0);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        router.transitionTo('parent/child');
        expect(parentControllerObservation.mock.calls.length).toBe(1);
        expect(parentComponentObservation.mock.calls.length).toBe(1);
        expect(childControllerObservation.mock.calls.length).toBe(1);
        expect(childComponentObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(2);
        expect(router.currentRouteFragment.abstractPath).toBe('child');
        mvc.unmount();
        history.push('/');
      });

      test('matching parent component\'s children is the child\'s component', () => {
        expect.assertions(16);

        const parentComponentObservation = jest.fn();
        const childComponentObservation = jest.fn();

        let renderChildren = false;

        expect(parentComponentObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);

        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              component: ({children}) => {
                parentComponentObservation();

                return renderChildren && children;
              },
              children: [
                {
                  path: 'child',
                  component: () => {
                    childComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentComponentObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        router.transitionTo('parent/child');
        expect(parentComponentObservation.mock.calls.length).toBe(1);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(2);
        expect(router.currentRouteFragment.abstractPath).toBe('child');
        mvc.unmount();

        renderChildren = true;

        mvc.mount();
        expect(parentComponentObservation.mock.calls.length).toBe(2);
        expect(childComponentObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(2);
        expect(router.currentRouteFragment.abstractPath).toBe('child');
        mvc.unmount();
        history.push('/');
      });

      test('matching child route even if parent doesn\'t have a component', () => {
        expect.assertions(15);

        const parentControllerObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();

        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);

        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              controller: {
                onEnter() {
                  parentControllerObservation();
                }
              },
              children: [
                {
                  path: 'child',
                  controller: {
                    onEnter() {
                      childControllerObservation();
                    }
                  },
                  component: () => {
                    childComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        router.transitionTo('parent/child');
        expect(parentControllerObservation.mock.calls.length).toBe(1);
        expect(childControllerObservation.mock.calls.length).toBe(1);
        expect(childComponentObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(2);
        expect(router.currentRouteFragment.abstractPath).toBe('child');
        mvc.unmount();
        history.push('/');
      });

      test('the url must contain the base path even if fallback exists', () => {
        expect.assertions(1);

        const router = new Router({
          basePath: 'base-path',
          routes: [
            {
              component: () => false
            },
            {
              path: 'test',
              component: () => false
            },
            {
              path: '*',
              component: () => false
            }
          ]
        });

        history.push('http://localhost/base-path');
        router.mount();
        expect(() => router.transitionTo('http://localhost/test'))
          .toThrowError(new Error('URL doesn\'t start with the base path. Url: '
          + 'http://localhost/test. Base path: /base-path'));
        router.unmount();
        history.push('/');
      });

      test('url with base path is matched', () => {
        expect.assertions(10);

        const controllerObservation = jest.fn();
        const componentObservation = jest.fn();

        history.push('http://localhost/base-path');

        const router = new Router({
          basePath: 'base-path',
          routes: [
            {
              component: () => false
            },
            {
              path: 'test',
              controller: {
                onEnter() {
                  controllerObservation();
                }
              },
              component: () => {
                componentObservation();

                return false;
              }
            }
          ]
        });

        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        router.transitionTo('http://localhost/base-path/test');
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(componentObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('test');
        mvc.unmount();
        history.push('/');
      });

      test('fallback route is matched if no other route matches', () => {
        expect.assertions(10);

        const controllerObservation = jest.fn();
        const componentObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: '*',
              controller: {
                onEnter() {
                  controllerObservation();
                }
              },
              component: () => {
                componentObservation();

                return false;
              }
            }
          ]
        });

        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        router.transitionTo('test');
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(componentObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('*');
        mvc.unmount();
        history.push('/');
      });

      test('child fallback route is matched if parent matches, instead of superior level fallback,'
        + ' if no other child route matches', () => {
        expect.assertions(16);

        const firstLevelFallbackControllerObservation = jest.fn();
        const firstLevelFallbackComponentObservation = jest.fn();
        const parentControllerObservation = jest.fn();
        const secondLevelFallbackControllerObservation = jest.fn();
        const secondLevelFallbackComponentObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: '*',
              controller: {
                onEnter() {
                  firstLevelFallbackControllerObservation();
                }
              },
              component: () => {
                firstLevelFallbackComponentObservation();

                return false;
              }
            },
            {
              path: 'parent',
              controller: {
                onEnter() {
                  parentControllerObservation();
                }
              },
              children: [
                {
                  path: '*',
                  controller: {
                    onEnter() {
                      secondLevelFallbackControllerObservation();
                    }
                  },
                  component: () => {
                    secondLevelFallbackComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(firstLevelFallbackControllerObservation.mock.calls.length).toBe(0);
        expect(firstLevelFallbackComponentObservation.mock.calls.length).toBe(0);
        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(secondLevelFallbackControllerObservation.mock.calls.length).toBe(0);
        expect(secondLevelFallbackComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        router.transitionTo('parent/test');
        expect(firstLevelFallbackControllerObservation.mock.calls.length).toBe(0);
        expect(firstLevelFallbackComponentObservation.mock.calls.length).toBe(0);
        expect(parentControllerObservation.mock.calls.length).toBe(1);
        expect(secondLevelFallbackControllerObservation.mock.calls.length).toBe(1);
        expect(secondLevelFallbackComponentObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(2);
        expect(router.currentRouteFragment.abstractPath).toBe('*');
        mvc.unmount();
        history.push('/');
      });

      test('fallback route not entered if the url is matched by parent and there are no other'
        + ' children routes', () => {
        expect.assertions(14);

        const controllerObservation = jest.fn();
        const componentObservation = jest.fn();
        const fallbackControllerObservation = jest.fn();
        const fallbackComponentObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'test',
              controller: {
                onEnter() {
                  controllerObservation();
                }
              },
              component: ({children}) => {
                componentObservation();

                return children;
              },
              children: [
                {
                  path: '*',
                  controller: {
                    onEnter() {
                      fallbackControllerObservation();
                    }
                  },
                  component: () => {
                    fallbackComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(fallbackControllerObservation.mock.calls.length).toBe(0);
        expect(fallbackComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        router.transitionTo('test');
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(componentObservation.mock.calls.length).toBe(1);
        expect(fallbackControllerObservation.mock.calls.length).toBe(0);
        expect(fallbackComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('test');
        mvc.unmount();
        history.push('/');
      });

      test('matching is greedy w.r.t. empty abstract paths', () => {
        expect.assertions(18);

        const ascendantControllerObservation = jest.fn();
        const ascendantComponentObservation = jest.fn();
        const descendantControllerObservation = jest.fn();
        const descendantComponentObservation = jest.fn();
        const lastControllerObservation = jest.fn();
        const lastComponentObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'ascendant',
              controller: {
                onEnter() {
                  ascendantControllerObservation();
                }
              },
              component: ({children}) => {
                ascendantComponentObservation();

                return children;
              },
              children: [
                {
                  controller: {},
                  children: [
                    {
                      controller: {},
                      children: [
                        {
                          path: 'descendant',
                          controller: {
                            onEnter() {
                              descendantControllerObservation();
                            }
                          },
                          component: ({children}) => {
                            descendantComponentObservation();

                            return children;
                          },
                          children: [
                            {
                              controller: {},
                              children: [
                                {
                                  controller: {},
                                  children: [
                                    {
                                      controller: {
                                        onEnter() {
                                          lastControllerObservation();
                                        }
                                      },
                                      component: () => {
                                        lastComponentObservation();

                                        return false;
                                      }
                                    }
                                  ]
                                }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        });

        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(ascendantControllerObservation.mock.calls.length).toBe(0);
        expect(ascendantComponentObservation.mock.calls.length).toBe(0);
        expect(descendantControllerObservation.mock.calls.length).toBe(0);
        expect(descendantComponentObservation.mock.calls.length).toBe(0);
        expect(lastControllerObservation.mock.calls.length).toBe(0);
        expect(lastComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        router.transitionTo('ascendant/descendant');
        expect(ascendantControllerObservation.mock.calls.length).toBe(1);
        expect(ascendantComponentObservation.mock.calls.length).toBe(1);
        expect(descendantControllerObservation.mock.calls.length).toBe(1);
        expect(descendantComponentObservation.mock.calls.length).toBe(1);
        expect(lastControllerObservation.mock.calls.length).toBe(1);
        expect(lastComponentObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(7);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        mvc.unmount();
        history.push('/');
      });

      test('a URL instance is set on the router representing the current window url', () => {
        expect.assertions(2);

        const router = new Router({
          routes: [
            {
              path: '*',
              component: () => false
            }
          ]
        });

        history.push('/path1/path2?queryParam1=queryValue1#fragment');
        router.mount();
        expect(router.url instanceof URL).toBe(true);
        expect(router.url.href)
          .toBe('http://localhost/path1/path2?queryParam1=queryValue1#fragment');
        router.unmount();
        history.push('/');
      });

      test('params are set', () => {
        expect.assertions(3);

        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: '/test/:x',
              controller: {
                onEnter() {
                  expect(router.url.href).toBe('http://localhost/test/1234?y=100');
                  expect(router.params.get('x')).toBe('1234');
                  expect(router.url.searchParams.get('y')).toBe('100');
                }
              },
              component: () => false
            }
          ]
        });

        router.mount();
        router.transitionTo('/test/1234?y=100');
        router.unmount();
        history.push('/');
      });

      test('params are decoded', () => {
        expect.assertions(3);

        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: '/test/:x',
              controller: {
                onEnter() {
                  expect(router.url.href)
                    .toBe('http://localhost/test/with%20space?y=with%20space');
                  expect(router.params.get('x')).toBe('with space');
                  expect(router.url.searchParams.get('y')).toBe('with space');
                }
              },
              component: () => false
            }
          ]
        });

        router.mount();
        router.transitionTo('/test/with%20space?y=with%20space');
        router.unmount();
        history.push('/');
      });

      test('route is resolved in the matching process', () => {
        expect.assertions(33);

        const resolveObservation = jest.fn();
        const controllerObservation = jest.fn();
        const componentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: '/test',
              resolve: () => {
                resolveObservation();

                return Promise.resolve({
                  component: () => {
                    componentObservation();

                    return false;
                  },
                  controller: {
                    onEnter() {
                      expect(router.currentRouteFragments.length).toBe(0);
                      expect(router.currentRouteFragment).toBe(null);
                      expect(router.url.href).toBe('http://localhost/test');
                      expect(router.isTransitioning).toBe(true);
                      controllerObservation();
                    }
                  }
                });
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(resolveObservation.mock.calls.length).toBe(0);
        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('test');
        expect(resolveObservation.mock.calls.length).toBe(1);
        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(resolveObservation.mock.calls.length).toBe(1);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(componentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('test');
            expect(router.url.href).toBe('http://localhost/test');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            mvc.unmount();
            history.push('/');
          });
      });

      test('route can be resolved only once', () => {
        expect.assertions(35);

        const resolveObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: '/test',
              resolve: () => {
                resolveObservation();

                return Promise.resolve({
                  component: () => false
                });
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(resolveObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('test');
        expect(resolveObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(resolveObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('test');
            expect(router.url.href).toBe('http://localhost/test');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            router.transitionTo('/');
            expect(resolveObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('');
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(3);
            router.transitionTo('test');
            expect(resolveObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('test');
            expect(router.url.href).toBe('http://localhost/test');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(4);
            mvc.unmount();
            history.push('/');
          });
      });

      test('route resolution can not be initiated multiple times until the first resolution is'
        + ' finished', () => {
        expect.assertions(41);

        const resolveObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: '/test',
              resolve: () => {
                resolveObservation();

                return Promise.resolve({
                  component: () => false
                });
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(resolveObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('test');
        expect(resolveObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('test');
        expect(resolveObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(resolveObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('test');
            expect(router.url.href).toBe('http://localhost/test');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            router.transitionTo('/');
            expect(resolveObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('');
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(3);
            router.transitionTo('test');
            expect(resolveObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('test');
            expect(router.url.href).toBe('http://localhost/test');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(4);
            mvc.unmount();
            history.push('/');
          });
      });

      test('route can be resolved even when it is referred to in two different places', () => {
        expect.assertions(29);

        const resolveObservation = jest.fn();
        const parentControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              resolve() {
                resolveObservation();

                return Promise.resolve({
                  controller: {
                    onEnter() {
                      parentControllerObservation();
                    }
                  }
                });
              }
            },
            {
              path: 'parent/child',
              component: () => {
                childComponentObservation();

                return false;
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(resolveObservation.mock.calls.length).toBe(0);
        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('parent/child');
        expect(resolveObservation.mock.calls.length).toBe(1);
        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(resolveObservation.mock.calls.length).toBe(1);
            expect(parentControllerObservation.mock.calls.length).toBe(1);
            expect(childComponentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(2);
            expect(router.currentRouteFragment.abstractPath).toBe('child');
            expect(router.url.href).toBe('http://localhost/parent/child');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            mvc.unmount();
            history.push('/');
          });
      });

      test('route is resolved in the matching process even if it\'s not entered', () => {
        expect.assertions(26);

        const resolveObservation = jest.fn();
        const componentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: '/test',
              children: [
                {
                  component: () => {
                    componentObservation();

                    return false;
                  }
                },
                {
                  path: '*',
                  resolve: () => {
                    resolveObservation();

                    return Promise.resolve({
                      component: () => false
                    });
                  }
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(resolveObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('test');
        expect(resolveObservation.mock.calls.length).toBe(1);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(resolveObservation.mock.calls.length).toBe(1);
            expect(componentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(2);
            expect(router.currentRouteFragment.abstractPath).toBe('');
            expect(router.url.href).toBe('http://localhost/test');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            mvc.unmount();
            history.push('/');
          });
      });

      test('route is not resolved if it doesn\'t match', () => {
        expect.assertions(19);

        const resolveObservation = jest.fn();
        const componentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => {
                componentObservation();

                return false;
              }
            },
            {
              path: '/test',
              component: () => {
                componentObservation();

                return false;
              }
            },
            {
              path: '/bad-path',
              resolve: () => {
                resolveObservation();

                return Promise.resolve();
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(resolveObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('/test');
        expect(resolveObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(2);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('test');
        expect(router.url.href).toBe('http://localhost/test');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(2);
        mvc.unmount();
        history.push('/');
      });

      test('a resolve function can provide components and controllers for the route itself and its'
        + ' children', () => {
        expect.assertions(31);

        const parentResolveObservation = jest.fn();
        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              resolve: () => {
                parentResolveObservation();

                return Promise.resolve({
                  controller: {
                    onEnter() {
                      parentControllerObservation();
                    }
                  },
                  component: ({children}) => {
                    parentComponentObservation();

                    return children;
                  },
                  children: [
                    {
                      path: 'child',
                      controller: {
                        onEnter() {
                          childControllerObservation();
                        }
                      },
                      component: () => {
                        childComponentObservation();

                        return false;
                      }
                    }
                  ]
                });
              },
              children: [
                {
                  path: 'child'
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentResolveObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('parent/child');
        expect(parentResolveObservation.mock.calls.length).toBe(1);
        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(0);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(parentResolveObservation.mock.calls.length).toBe(1);
            expect(parentControllerObservation.mock.calls.length).toBe(1);
            expect(parentComponentObservation.mock.calls.length).toBe(1);
            expect(childControllerObservation.mock.calls.length).toBe(1);
            expect(childComponentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(2);
            expect(router.currentRouteFragment.abstractPath).toBe('child');
            expect(router.url.href).toBe('http://localhost/parent/child');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            mvc.unmount();
            history.push('/');
          });
      });

      test('parent and child are resolved and entered', () => {
        expect.assertions(34);

        const parentResolveObservation = jest.fn();
        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childResolveObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              resolve: () => {
                parentResolveObservation();

                return Promise.resolve({
                  controller: {
                    onEnter() {
                      parentControllerObservation();
                    }
                  },
                  component: ({children}) => {
                    parentComponentObservation();

                    return children;
                  }
                });
              },
              children: [
                {
                  path: 'child',
                  resolve: () => {
                    childResolveObservation();

                    return Promise.resolve({
                      controller: {
                        onEnter() {
                          childControllerObservation();
                        }
                      },
                      component: () => {
                        childComponentObservation();

                        return false;
                      }
                    });
                  }
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentResolveObservation.mock.calls.length).toBe(0);
        expect(childResolveObservation.mock.calls.length).toBe(0);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('parent/child');
        expect(parentResolveObservation.mock.calls.length).toBe(1);
        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(0);
        expect(childResolveObservation.mock.calls.length).toBe(1);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(parentResolveObservation.mock.calls.length).toBe(1);
            expect(parentControllerObservation.mock.calls.length).toBe(1);
            expect(parentComponentObservation.mock.calls.length).toBe(1);
            expect(childResolveObservation.mock.calls.length).toBe(1);
            expect(childControllerObservation.mock.calls.length).toBe(1);
            expect(childComponentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(2);
            expect(router.currentRouteFragment.abstractPath).toBe('child');
            expect(router.url.href).toBe('http://localhost/parent/child');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            mvc.unmount();
            history.push('/');
          });
      });

      test('child is also resolved even if only parent is entered', () => {
        expect.assertions(32);

        const parentResolveObservation = jest.fn();
        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childResolveObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              resolve: () => {
                parentResolveObservation();

                return Promise.resolve({
                  controller: {
                    onEnter() {
                      parentControllerObservation();
                    }
                  },
                  component: ({children}) => {
                    parentComponentObservation();

                    return children;
                  }
                });
              },
              children: [
                {
                  resolve: () => {
                    childResolveObservation();

                    return Promise.resolve({
                      controller: {
                        onEnter() {
                          // not going to be entered when the route is 'parent' because it doesn't
                          // have a component
                          childControllerObservation();
                        }
                      }
                    });
                  },
                  children: [
                    {
                      path: 'grand-child',
                      component: () => false
                    }
                  ]
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentResolveObservation.mock.calls.length).toBe(0);
        expect(childResolveObservation.mock.calls.length).toBe(0);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('parent');
        expect(parentResolveObservation.mock.calls.length).toBe(1);
        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(0);
        expect(childResolveObservation.mock.calls.length).toBe(1);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(parentResolveObservation.mock.calls.length).toBe(1);
            expect(parentControllerObservation.mock.calls.length).toBe(1);
            expect(parentComponentObservation.mock.calls.length).toBe(1);
            expect(childResolveObservation.mock.calls.length).toBe(1);
            expect(childControllerObservation.mock.calls.length).toBe(0);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('parent');
            expect(router.url.href).toBe('http://localhost/parent');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            mvc.unmount();
            history.push('/');
          });
      });

      test('parent can not resolve child with a resolve function right before child is'
        + ' entered', () => {
        expect.assertions(41);

        const parentResolveObservation = jest.fn();
        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childResolveObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              resolve: () => {
                parentResolveObservation();

                return Promise.resolve({
                  controller: {
                    onEnter() {
                      parentControllerObservation();
                    }
                  },
                  component: ({children}) => {
                    parentComponentObservation();

                    return children;
                  },
                  children: [
                    {
                      path: 'child',
                      resolve: () => {
                        childResolveObservation();

                        return Promise.resolve({
                          controller: {
                            onEnter() {
                              childControllerObservation();
                            }
                          },
                          component: () => {
                            childComponentObservation();

                            return false;
                          }
                        });
                      }
                    }
                  ]
                });
              },
              children: [
                {
                  path: 'child'
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentResolveObservation.mock.calls.length).toBe(0);
        expect(childResolveObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('parent/child');
        expect(parentResolveObservation.mock.calls.length).toBe(1);
        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(0);
        expect(childResolveObservation.mock.calls.length).toBe(0);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.onAsyncError((error) => {
          expect(error).toEqual(new Error('Route must be resolved with at least a component,'
            + ' a controller or children: parent/child. Url: /parent/child'));
          expect(router.currentRouteFragments.length).toBe(1);
          expect(router.currentRouteFragment.abstractPath).toBe('');
          expect(router.url.href).toBe('http://localhost/');
          expect(router.isTransitioning).toBe(true);
          expect(urlHandleObservation.mock.calls.length).toBe(1);
          asyncErrorHandlerObservation();
        });

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then()
          // wait in order to make sure that the async error callback is called before this callback
          .then(() => {
            expect(parentResolveObservation.mock.calls.length).toBe(1);
            expect(parentControllerObservation.mock.calls.length).toBe(0);
            expect(parentComponentObservation.mock.calls.length).toBe(0);
            expect(childResolveObservation.mock.calls.length).toBe(0);
            expect(childControllerObservation.mock.calls.length).toBe(0);
            expect(childComponentObservation.mock.calls.length).toBe(0);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('');
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(true);
            expect(urlHandleObservation.mock.calls.length).toBe(1);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(1);
            mvc.unmount();
            history.push('/');
          });
      });

      test('the controller constructor can return a promise which is awaited', () => {
        expect.assertions(44);

        const controllerObservation = jest.fn();
        const controllerEnterObservation = jest.fn();
        const componentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: '/test',
              component: () => {
                componentObservation();

                return false;
              },
              controller: function Controller() {
                controllerObservation();
                expect(new.target).toBe(Controller);
                expect(controllerEnterObservation.mock.calls.length).toBe(0);
                expect(componentObservation.mock.calls.length).toBe(0);
                expect(router.currentRouteFragments.length).toBe(0);
                expect(router.currentRouteFragment).toBe(null);
                expect(router.url.href).toBe('http://localhost/test');
                expect(router.isTransitioning).toBe(true);
                expect(urlHandleObservation.mock.calls.length).toBe(1);

                return Promise.resolve().then(() => {
                  return {
                    onEnter() {
                      controllerEnterObservation();
                      expect(controllerObservation.mock.calls.length).toBe(1);
                      expect(router.currentRouteFragments.length).toBe(0);
                      expect(componentObservation.mock.calls.length).toBe(0);
                      expect(router.currentRouteFragment).toBe(null);
                      expect(router.url.href).toBe('http://localhost/test');
                      expect(router.isTransitioning).toBe(true);
                      expect(urlHandleObservation.mock.calls.length).toBe(1);
                    }
                  };
                });
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(controllerEnterObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('test');
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(controllerEnterObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/test');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then(() => {
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(controllerEnterObservation.mock.calls.length).toBe(1);
            expect(componentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('test');
            expect(router.url.href).toBe('http://localhost/test');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            mvc.unmount();
            history.push('/');
          });
      });

      test('the controller promise is awaited', () => {
        expect.assertions(32);

        const controllerObservation = jest.fn();
        const componentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: '/test',
              component: () => {
                componentObservation();

                return false;
              },
              controller: Promise.resolve({
                onEnter() {
                  controllerObservation();
                  expect(componentObservation.mock.calls.length).toBe(0);
                  expect(router.currentRouteFragments.length).toBe(0);
                  expect(router.currentRouteFragment).toBe(null);
                  expect(router.url.href).toBe('http://localhost/test');
                  expect(router.isTransitioning).toBe(true);
                  expect(urlHandleObservation.mock.calls.length).toBe(1);
                }
              })
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('test');
        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/test');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then(() => {
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(componentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('test');
            expect(router.url.href).toBe('http://localhost/test');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            mvc.unmount();
            history.push('/');
          });
      });

      test('if the controller is not an observed object it\'s not rooted', () => {
        expect.assertions(5);

        const componentObservation = jest.fn();
        const controller = {
          method() {}
        };

        expect(isObservedObject(controller)).toBe(false);

        const mvc = new Mvc({
          router: new Router({
            routes: [
              {
                component: () => {
                  componentObservation();

                  return false;
                },
                controller
              }
            ]
          }),
          domElement: document.createElement('div')
        });

        expect(componentObservation.mock.calls.length).toBe(1);
        controller.method();
        expect(isObservedObject(controller)).toBe(false);
        expect(controller.hasOwnProperty('isPending')).toBe(false);
        expect(componentObservation.mock.calls.length).toBe(1);
        mvc.unmount();
      });

      test('if the controller object that the controller promise is fulfilled with is not'
        + ' an observed object, it\'s not rooted', () => {
        expect.assertions(24);

        const controllerObservation = jest.fn();
        const componentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        let controller;
        const router = new Router({
          routes: [
            {
              component: ({controller: controller_}) => {
                componentObservation();

                controller = controller_;

                return false;
              },
              controller: Promise.resolve({
                onEnter() {
                  controllerObservation();
                },

                method() {}
              })
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then()
          .then()
          .then(() => {
            expect(isObservedObject(controller)).toBe(false);
            expect(controller.hasOwnProperty('isPending')).toBe(false);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(componentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('');
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(1);
            controller.method();
            expect(isObservedObject(controller)).toBe(false);
            expect(controller.hasOwnProperty('isPending')).toBe(false);
            expect(componentObservation.mock.calls.length).toBe(1);
            mvc.unmount();
          });
      });

      test('if the controller object returned from the controller constructor is not an observed'
        + ' object, it\'s not rooted', () => {
        expect.assertions(5);

        const componentObservation = jest.fn();
        let controllerObject;

        function Controller() {
          return {
            method() {}
          };
        }

        const mvc = new Mvc({
          router: new Router({
            routes: [
              {
                component: ({controller}) => {
                  componentObservation();

                  controllerObject = controller;

                  return false;
                },
                controller: Controller
              }
            ]
          }),
          domElement: document.createElement('div')
        });

        expect(componentObservation.mock.calls.length).toBe(1);
        expect(isObservedObject(controllerObject)).toBe(false);
        controllerObject.method();
        expect(isObservedObject(controllerObject)).toBe(false);
        expect(controllerObject.hasOwnProperty('isPending')).toBe(false);
        expect(componentObservation.mock.calls.length).toBe(1);
        mvc.unmount();
      });

      test('if the controller object that the promise returned from the controller constructor'
        + ' is fulfilled with is not an observed object, it\'s not rooted', () => {
        expect.assertions(49);

        const controllerObservation = jest.fn();
        const controllerEnterObservation = jest.fn();
        const componentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const controller = {
          onEnter() {
            controllerEnterObservation();
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(0);
            expect(componentObservation.mock.calls.length).toBe(0);
            expect(router.currentRouteFragment).toBe(null);
            expect(router.url.href).toBe('http://localhost/test');
            expect(router.isTransitioning).toBe(true);
            expect(urlHandleObservation.mock.calls.length).toBe(1);
          },

          method() {}
        };
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: '/test',
              component: () => {
                componentObservation();

                return false;
              },
              controller: function Controller() {
                controllerObservation();
                expect(new.target).toBe(Controller);
                expect(controllerEnterObservation.mock.calls.length).toBe(0);
                expect(componentObservation.mock.calls.length).toBe(0);
                expect(router.currentRouteFragments.length).toBe(0);
                expect(router.currentRouteFragment).toBe(null);
                expect(router.url.href).toBe('http://localhost/test');
                expect(router.isTransitioning).toBe(true);
                expect(urlHandleObservation.mock.calls.length).toBe(1);

                return Promise.resolve().then(() => {
                  return controller;
                });
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(controllerEnterObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('test');
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(controllerEnterObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/test');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then(() => {
            expect(isObservedObject(controller)).toBe(false);
            expect(controller.hasOwnProperty('isPending')).toBe(false);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(controllerEnterObservation.mock.calls.length).toBe(1);
            expect(componentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('test');
            expect(router.url.href).toBe('http://localhost/test');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            controller.method();
            expect(isObservedObject(controller)).toBe(false);
            expect(controller.hasOwnProperty('isPending')).toBe(false);
            expect(componentObservation.mock.calls.length).toBe(1);
            mvc.unmount();
            history.push('/');
          });
      });

      test('if the controller is an observed object, it\'s rooted before it\'s'
        + ' entered', () => {
        expect.assertions(45);

        const controllerObservation = jest.fn();
        const componentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const controller = observe({
          onEnter: () => {
            controllerObservation();
            expect(controller.isPending).toBe(false);
            expect(controller.pending.has('onEnter')).toBe(false);
            expect(controller.pending.has('method')).toBe(false);
            expect(router.currentRouteFragments.length).toBe(0);
            expect(router.currentRouteFragment).toBe(null);
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(true);
            expect(urlHandleObservation.mock.calls.length).toBe(0);

            return controller.method();
          },

          method: () => Promise.resolve()
        });
        const router = new Router({
          routes: [
            {
              controller,
              component: () => {
                componentObservation();

                return false;
              }
            }
          ]
        });

        expect(isObservedObject(controller)).toBe(true);
        expect(controller.isPending).toBe(false);
        expect(controller.pending.has('onEnter')).toBe(false);
        expect(controller.pending.has('method')).toBe(false);
        router.onUrlHandle(urlHandleObservation);
        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(controller.isPending).toBe(true);
        expect(controller.pending.has('onEnter')).toBe(true);
        expect(controller.pending.has('method')).toBe(true);
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then(() => {
            expect(controller.isPending).toBe(false);
            expect(controller.pending.has('onEnter')).toBe(false);
            expect(controller.pending.has('method')).toBe(false);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(componentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('');
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(1);

            const promise = controller.method().then(() => {
              expect(controller.isPending).toBe(false);
              expect(controller.pending.has('onEnter')).toBe(false);
              expect(controller.pending.has('method')).toBe(false);
              mvc.unmount();
              history.push('/');
            });

            expect(controller.isPending).toBe(true);
            expect(controller.pending.has('onEnter')).toBe(false);
            expect(controller.pending.has('method')).toBe(true);

            return promise;
          });
      });

      test('if the controller object that the controller promise is fulfilled with is'
        + ' an observed object, it\'s rooted before it\'s entered', () => {
        expect.assertions(51);

        const controllerObservation = jest.fn();
        const componentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const controller = observe({
          onEnter: () => {
            controllerObservation();
            expect(controller.isPending).toBe(false);
            expect(controller.pending.has('onEnter')).toBe(false);
            expect(controller.pending.has('method')).toBe(false);
            expect(router.currentRouteFragments.length).toBe(0);
            expect(router.currentRouteFragment).toBe(null);
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(true);
            expect(urlHandleObservation.mock.calls.length).toBe(0);

            return controller.method();
          },

          method: () => Promise.resolve()
        });
        const router = new Router({
          routes: [
            {
              controller: Promise.resolve(controller),
              component: () => {
                componentObservation();

                return false;
              }
            }
          ]
        });

        expect(isObservedObject(controller)).toBe(true);
        expect(controller.isPending).toBe(false);
        expect(controller.pending.has('onEnter')).toBe(false);
        expect(controller.pending.has('method')).toBe(false);
        router.onUrlHandle(urlHandleObservation);
        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(controller.isPending).toBe(false);
        expect(controller.pending.has('onEnter')).toBe(false);
        expect(controller.pending.has('method')).toBe(false);
        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(componentObservation.mock.calls.length).toBe(0);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then(() => {
            expect(controller.isPending).toBe(true);
            expect(controller.pending.has('onEnter')).toBe(true);
            expect(controller.pending.has('method')).toBe(true);
          })
          .then(() => {
            expect(controller.isPending).toBe(false);
            expect(controller.pending.has('onEnter')).toBe(false);
            expect(controller.pending.has('method')).toBe(false);
          })
          .then()
          .then()
          .then()
          .then(() => {
            expect(controller.isPending).toBe(false);
            expect(controller.pending.has('onEnter')).toBe(false);
            expect(controller.pending.has('method')).toBe(false);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(componentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('');
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(1);

            const promise = controller.method().then(() => {
              expect(controller.isPending).toBe(false);
              expect(controller.pending.has('onEnter')).toBe(false);
              expect(controller.pending.has('method')).toBe(false);
              mvc.unmount();
              history.push('/');
            });

            expect(controller.isPending).toBe(true);
            expect(controller.pending.has('onEnter')).toBe(false);
            expect(controller.pending.has('method')).toBe(true);

            return promise;
          });
      });

      // test('if the controller object returned from the controller constructor is an observed'
      //   + ' object, it\'s rooted before it\'s entered', () => {
      //   expect.assertions(1);
      // });

      // test('if the controller object that the promise returned from the controller constructor'
      //   + ' is fulfilled with is an observed object, it\'s rooted before it\'s entered', () => {
      //   expect.assertions(1);
      // });

      // test('if the controller is an observed object, it\'s unrooted after it\'s left', () => {
      //   expect.assertions(1);
      // });

      // test('if the controller object that the controller promise is fulfilled with is'
      //   + ' an observed object, it\'s unrooted after it\'s left', () => {
      //   expect.assertions(1);
      // });

      // test('if the controller object returned from the controller constructor is an observed'
      //   + ' object, it\'s unrooted after it\'s left', () => {
      //   expect.assertions(1);
      // });

      // test('if the controller object that the promise returned from the controller constructor'
      //   + ' is fulfilled with is an observed object, it\'s unrooted after it\'s left', () => {
      //   expect.assertions(1);
      // });

      // test('needs testing', () => {
      //   expect.assertions(1);

      // });
    });

    describe('mount', () => {
      test('automatically transitions to the current url', () => {
        expect.assertions(7);

        const observation = jest.fn();
        const router = new Router({
          routes: [
            {
              controller: {
                onEnter: observation
              },
              component: () => false
            }
          ]
        });

        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        router.mount();
        expect(observation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        router.unmount();
      });

      // test('needs testing', () => {
      //   expect.assertions(1);

      // });
    });

  //   describe('unmount', () => {
  //     test('needs-testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('refresh', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('onBeforeChange', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('offBeforeChange', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('onSearchChange', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('offSearchChange', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('onChange', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('offChange', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('onUrlHandle', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('offUrlHandle', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

    describe('onAsyncError', () => {
      test('throws if the handler is not a function', () => {
        expect.assertions(1);

        const router = new Router({routes: []});

        expect(router.onAsyncError)
          .toThrowError(new Error('The event listener must be a function.'));
      });

      test('the handler receives the error as an argument', () => {
        expect.assertions(21);

        const controllerObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false,
              controller: {
                onEnter() {
                  controllerObservation();

                  return Promise.reject(new Error('onEnter reject'));
                }
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError((error) => {
          expect(error).toEqual(new Error('onEnter reject'));
          asyncErrorHandlerObservation();
        });
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          // wait in order to make sure that the async error callback is called before this callback
          .then(() => {
            expect(router.currentRouteFragments.length).toBe(0);
            expect(router.currentRouteFragment).toBe(null);
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(true);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(urlHandleObservation.mock.calls.length).toBe(0);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(1);
            router.unmount();
          });
      });

      test('multiple handlers can be added', () => {
        expect.assertions(22);

        const controllerObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false,
              controller: {
                onEnter() {
                  controllerObservation();

                  return Promise.reject(new Error('onEnter reject'));
                }
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError((error) => {
          expect(error).toEqual(new Error('onEnter reject'));
          asyncErrorHandlerObservation();
        });
        router.onAsyncError((error) => {
          expect(error).toEqual(new Error('onEnter reject'));
          asyncErrorHandlerObservation();
        });
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          // wait in order to make sure that the async error callback is called before this callback
          .then(() => {
            expect(router.currentRouteFragments.length).toBe(0);
            expect(router.currentRouteFragment).toBe(null);
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(true);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(urlHandleObservation.mock.calls.length).toBe(0);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(2);
            router.unmount();
          });
      });

      test('a handler can be added only once', () => {
        expect.assertions(21);

        const controllerObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false,
              controller: {
                onEnter() {
                  controllerObservation();

                  return Promise.reject(new Error('onEnter reject'));
                }
              }
            }
          ]
        });
        const asyncErrorHandler = (error) => {
          expect(error).toEqual(new Error('onEnter reject'));
          asyncErrorHandlerObservation();
        };

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError(asyncErrorHandler);
        router.onAsyncError(asyncErrorHandler);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          // wait in order to make sure that the async error callback is called before this callback
          .then(() => {
            expect(router.currentRouteFragments.length).toBe(0);
            expect(router.currentRouteFragment).toBe(null);
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(true);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(urlHandleObservation.mock.calls.length).toBe(0);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(1);
            router.unmount();
          });
      });

      test('handler is not called on sync error', () => {
        expect.assertions(14);

        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false,
              controller: {
                onEnter() {
                  throw new Error('onEnter error');
                }
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError(asyncErrorHandlerObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        expect(router.mount).toThrowError(new Error('onEnter error'));
        expect(router.isMounted).toBe(true);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.unmount();
      });

      test('handler is not called on sync transition with no error', () => {
        expect.assertions(14);

        const urlHandleObservation = jest.fn();
        const contrllerObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false,
              controller: {
                onEnter() {
                  contrllerObservation();
                }
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError(asyncErrorHandlerObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(contrllerObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        expect(contrllerObservation.mock.calls.length).toBe(1);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.unmount();
      });

      test('handler is not called on async transition with no error', () => {
        expect.assertions(20);

        const controllerObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false,
              controller: {
                onEnter() {
                  controllerObservation();

                  return Promise.resolve();
                }
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError(asyncErrorHandlerObservation);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then()
          .then()
          .then(() => {
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('');
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(1);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
            router.unmount();
          });
      });

      test('handler is called if error is thrown from controller constructor during async'
        + ' transition', () => {
        expect.assertions(21);

        const controllerObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false,
              controller: function () {
                controllerObservation();

                return Promise.reject(new Error('controller constructor reject'));
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError((error) => {
          expect(error).toEqual(new Error('controller constructor reject'));
          asyncErrorHandlerObservation();
        });
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          // wait in order to make sure that the async error callback is called before this callback
          .then(() => {
            expect(router.currentRouteFragments.length).toBe(0);
            expect(router.currentRouteFragment).toBe(null);
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(true);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(urlHandleObservation.mock.calls.length).toBe(0);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(1);
            router.unmount();
          });
      });

      test('handler is called if error is thrown from resolve', () => {
        expect.assertions(21);

        const resolveObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              resolve() {
                resolveObservation();

                return Promise.reject(new Error('resolve reject'));
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError((error) => {
          expect(error).toEqual(new Error('resolve reject'));
          asyncErrorHandlerObservation();
        });
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(true);
        expect(resolveObservation.mock.calls.length).toBe(1);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then()
          // wait in order to make sure that the async error callback is called before this callback
          .then(() => {
            expect(router.currentRouteFragments.length).toBe(0);
            expect(router.currentRouteFragment).toBe(null);
            expect(router.url).toBe(null);
            expect(router.isTransitioning).toBe(true);
            expect(resolveObservation.mock.calls.length).toBe(1);
            expect(urlHandleObservation.mock.calls.length).toBe(0);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(1);
            router.unmount();
          });
      });

      test('the handler is called if error is thrown from onEnter during async transition', () => {
        expect.assertions(21);

        const controllerObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false,
              controller: {
                onEnter() {
                  controllerObservation();

                  return Promise.reject(new Error('onEnter reject'));
                }
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError((error) => {
          expect(error).toEqual(new Error('onEnter reject'));
          asyncErrorHandlerObservation();
        });
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          // wait in order to make sure that the async error callback is called before this callback
          .then(() => {
            expect(router.currentRouteFragments.length).toBe(0);
            expect(router.currentRouteFragment).toBe(null);
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(true);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(urlHandleObservation.mock.calls.length).toBe(0);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(1);
            router.unmount();
          });
      });

      test('handler is called if error is thrown from onLeave during async transition', () => {
        expect.assertions(28);

        const controllerObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false,
              controller: {
                onLeave() {
                  controllerObservation();

                  return Promise.reject(new Error('onLeave reject'));
                }
              }
            },
            {
              path: 'sibling',
              component: () => false
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError((error) => {
          expect(error).toEqual(new Error('onLeave reject'));
          asyncErrorHandlerObservation();
        });
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(controllerObservation.mock.calls.length).toBe(0);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.transitionTo('sibling');
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/sibling');
        expect(router.isTransitioning).toBe(true);
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then()
          // wait in order to make sure that the async error callback is called before this callback
          .then(() => {
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('');
            expect(router.url.href).toBe('http://localhost/sibling');
            expect(router.isTransitioning).toBe(true);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(urlHandleObservation.mock.calls.length).toBe(1);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(1);
            router.unmount();
            history.push('/');
          });
      });

      test('handler is called if error is thrown from sync step during async transition'
        + ' caused by another route fragment', () => {
        expect.assertions(23);

        const parentControllerObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              controller: {
                onEnter() {
                  parentControllerObservation();

                  return Promise.resolve();
                }
              },
              children: [
                {
                  component: () => false,
                  controller: {
                    onEnter() {
                      childControllerObservation();

                      throw new Error('child onEnter');
                    }
                  }
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError((error) => {
          expect(error).toEqual(new Error('child onEnter'));
          asyncErrorHandlerObservation();
        });
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(parentControllerObservation.mock.calls.length).toBe(1);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          // wait in order to make sure that the async error callback is called before this callback
          .then(() => {
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('');
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(true);
            expect(parentControllerObservation.mock.calls.length).toBe(1);
            expect(childControllerObservation.mock.calls.length).toBe(1);
            expect(urlHandleObservation.mock.calls.length).toBe(0);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(1);
            router.unmount();
          });
      });

      test('handlers can be added after the transition started', () => {
        expect.assertions(21);

        const controllerObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false,
              controller: function () {
                controllerObservation();

                return Promise.reject(new Error('controller constructor reject'));
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.onAsyncError((error) => {
          expect(error).toEqual(new Error('controller constructor reject'));
          asyncErrorHandlerObservation();
        });

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          // wait in order to make sure that the async error callback is called before this callback
          .then(() => {
            expect(router.currentRouteFragments.length).toBe(0);
            expect(router.currentRouteFragment).toBe(null);
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(true);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(urlHandleObservation.mock.calls.length).toBe(0);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(1);
            router.unmount();
          });
      });
    });

    describe('offAsyncError', () => {
      test('throws if the handler is not a function', () => {
        expect.assertions(1);

        const router = new Router({routes: []});

        expect(router.offAsyncError)
          .toThrowError(new Error('The event listener must be a function.'));
      });

      test('removes the handler', () => {
        expect.assertions(20);

        const controllerObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const asyncErrorHandlerObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false,
              controller: {
                onEnter() {
                  controllerObservation();

                  return Promise.reject(new Error('onEnter reject'));
                }
              }
            }
          ]
        });
        const asyncErrorHandler = () => {
          asyncErrorHandlerObservation();
        };

        router.onUrlHandle(urlHandleObservation);
        router.onAsyncError(asyncErrorHandler);
        // add a second handler so that we don't get an 'unhandledrejection' event
        router.onAsyncError(() => {});
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.mount();
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(controllerObservation.mock.calls.length).toBe(1);
        expect(urlHandleObservation.mock.calls.length).toBe(0);
        expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
        router.offAsyncError(asyncErrorHandler);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          // wait in order to make sure that the async error callback
          // got the chance to be called before this callback
          .then(() => {
            expect(router.currentRouteFragments.length).toBe(0);
            expect(router.currentRouteFragment).toBe(null);
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(true);
            expect(controllerObservation.mock.calls.length).toBe(1);
            expect(urlHandleObservation.mock.calls.length).toBe(0);
            expect(asyncErrorHandlerObservation.mock.calls.length).toBe(0);
            router.unmount();
          });
      });
    });

  //   describe('isPathActive', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('isDescendantPathActive', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('list', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('get', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('has', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('add', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('remove', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });
  // });

  // describe('controllerObject', () => {
  //   test('needs testing', () => {
  //     expect.assertions(1);

  //   });

    describe('onEnter', () => {
      test('if onEnter returns a promise it is awaited', () => {
        expect.assertions(44);

        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              controller: {
                onEnter() {
                  parentControllerObservation();

                  return Promise.resolve().then(() => {
                    expect(parentComponentObservation.mock.calls.length).toBe(0);
                    expect(childControllerObservation.mock.calls.length).toBe(0);
                    expect(childComponentObservation.mock.calls.length).toBe(0);
                    expect(router.currentRouteFragments.length).toBe(0);
                    expect(router.currentRouteFragment).toBe(null);
                    expect(router.url.href).toBe('http://localhost/parent/child');
                    expect(router.isTransitioning).toBe(true);
                    expect(urlHandleObservation.mock.calls.length).toBe(1);
                  });
                }
              },
              component: ({children}) => {
                parentComponentObservation();

                return children;
              },
              children: [
                {
                  path: 'child',
                  controller: {
                    onEnter() {
                      childControllerObservation();
                      expect(parentControllerObservation.mock.calls.length).toBe(1);
                      expect(parentComponentObservation.mock.calls.length).toBe(1);
                      expect(childComponentObservation.mock.calls.length).toBe(0);
                      expect(router.currentRouteFragments.length).toBe(1);
                      expect(router.currentRouteFragment.abstractPath).toBe('parent');
                      expect(router.url.href).toBe('http://localhost/parent/child');
                      expect(router.isTransitioning).toBe(true);
                      expect(urlHandleObservation.mock.calls.length).toBe(1);
                    }
                  },
                  component: () => {
                    childComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('parent/child');
        expect(parentControllerObservation.mock.calls.length).toBe(1);
        expect(parentComponentObservation.mock.calls.length).toBe(0);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/parent/child');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then(() => {
            expect(parentControllerObservation.mock.calls.length).toBe(1);
            expect(parentComponentObservation.mock.calls.length).toBe(2);
            expect(childControllerObservation.mock.calls.length).toBe(1);
            expect(childComponentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(2);
            expect(router.currentRouteFragment.abstractPath).toBe('child');
            expect(router.url.href).toBe('http://localhost/parent/child');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            mvc.unmount();
            history.push('/');
          });
      });

      test('if onEnter returns false the route fragment is not entered and'
        + ' the transition stops', () => {
        expect.assertions(39);

        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              controller: {
                onEnter() {
                  parentControllerObservation();
                  expect(parentComponentObservation.mock.calls.length).toBe(0);
                  expect(childControllerObservation.mock.calls.length).toBe(0);
                  expect(childComponentObservation.mock.calls.length).toBe(0);
                  expect(router.currentRouteFragments.length).toBe(0);
                  expect(router.currentRouteFragment).toBe(null);
                  expect(router.url.href).toBe('http://localhost/parent/child');
                  expect(router.isTransitioning).toBe(true);
                  expect(urlHandleObservation.mock.calls.length).toBe(1);
                }
              },
              component: ({children}) => {
                parentComponentObservation();

                return children;
              },
              children: [
                {
                  path: 'child',
                  controller: {
                    onEnter() {
                      childControllerObservation();
                      expect(parentControllerObservation.mock.calls.length).toBe(1);
                      expect(parentComponentObservation.mock.calls.length).toBe(0);
                      expect(childComponentObservation.mock.calls.length).toBe(0);
                      expect(router.currentRouteFragments.length).toBe(1);
                      expect(router.currentRouteFragment.abstractPath).toBe('parent');
                      expect(router.url.href).toBe('http://localhost/parent/child');
                      expect(router.isTransitioning).toBe(true);
                      expect(urlHandleObservation.mock.calls.length).toBe(1);

                      return false;
                    }
                  },
                  component: () => {
                    childComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(0);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('parent/child');
        expect(parentControllerObservation.mock.calls.length).toBe(1);
        expect(parentComponentObservation.mock.calls.length).toBe(1);
        expect(childControllerObservation.mock.calls.length).toBe(1);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('parent');
        expect(router.url.href).toBe('http://localhost/parent');
        expect(router.isTransitioning).toBe(false);
        // the url was overwritten so there was a new change that was handled
        expect(urlHandleObservation.mock.calls.length).toBe(3);
        mvc.unmount();
        history.push('/');
      });

      test('if onEnter returns false after awaiting parent\'s onEnter, the route fragment'
        + ' is not entered and the transition stops', () => {
        expect.assertions(44);

        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              controller: {
                onEnter() {
                  parentControllerObservation();

                  return Promise.resolve().then(() => {
                    expect(parentComponentObservation.mock.calls.length).toBe(0);
                    expect(childControllerObservation.mock.calls.length).toBe(0);
                    expect(childComponentObservation.mock.calls.length).toBe(0);
                    expect(router.currentRouteFragments.length).toBe(0);
                    expect(router.currentRouteFragment).toBe(null);
                    expect(router.url.href).toBe('http://localhost/parent/child');
                    expect(router.isTransitioning).toBe(true);
                    expect(urlHandleObservation.mock.calls.length).toBe(1);
                  });
                }
              },
              component: ({children}) => {
                parentComponentObservation();

                return children;
              },
              children: [
                {
                  path: 'child',
                  controller: {
                    onEnter() {
                      childControllerObservation();
                      expect(parentControllerObservation.mock.calls.length).toBe(1);
                      expect(parentComponentObservation.mock.calls.length).toBe(1);
                      expect(childComponentObservation.mock.calls.length).toBe(0);
                      expect(router.currentRouteFragments.length).toBe(1);
                      expect(router.currentRouteFragment.abstractPath).toBe('parent');
                      expect(router.url.href).toBe('http://localhost/parent/child');
                      expect(router.isTransitioning).toBe(true);
                      expect(urlHandleObservation.mock.calls.length).toBe(1);

                      return false;
                    }
                  },
                  component: () => {
                    childComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('parent/child');
        expect(parentControllerObservation.mock.calls.length).toBe(1);
        expect(parentComponentObservation.mock.calls.length).toBe(0);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(router.url.href).toBe('http://localhost/parent/child');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then(() => {
            expect(parentControllerObservation.mock.calls.length).toBe(1);
            expect(parentComponentObservation.mock.calls.length).toBe(2);
            expect(childControllerObservation.mock.calls.length).toBe(1);
            expect(childComponentObservation.mock.calls.length).toBe(0);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('parent');
            expect(router.url.href).toBe('http://localhost/parent');
            expect(router.isTransitioning).toBe(false);
            // the url was overwritten so there was a new change that was handled
            expect(urlHandleObservation.mock.calls.length).toBe(3);
            mvc.unmount();
            history.push('/');
          });
      });

      test('if onEnter returns a promise fulfilled with false, the route fragment'
        + ' is not entered and the transition stops', () => {
        expect.assertions(44);

        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              controller: {
                onEnter() {
                  parentControllerObservation();
                  expect(parentComponentObservation.mock.calls.length).toBe(0);
                  expect(childControllerObservation.mock.calls.length).toBe(0);
                  expect(childComponentObservation.mock.calls.length).toBe(0);
                  expect(router.currentRouteFragments.length).toBe(0);
                  expect(router.currentRouteFragment).toBe(null);
                  expect(router.url.href).toBe('http://localhost/parent/child');
                  expect(router.isTransitioning).toBe(true);
                  expect(urlHandleObservation.mock.calls.length).toBe(1);
                }
              },
              component: ({children}) => {
                parentComponentObservation();

                return children;
              },
              children: [
                {
                  path: 'child',
                  controller: {
                    onEnter() {
                      childControllerObservation();

                      return Promise.resolve().then(() => {
                        expect(parentControllerObservation.mock.calls.length).toBe(1);
                        expect(parentComponentObservation.mock.calls.length).toBe(1);
                        expect(childComponentObservation.mock.calls.length).toBe(0);
                        expect(router.currentRouteFragments.length).toBe(1);
                        expect(router.currentRouteFragment.abstractPath).toBe('parent');
                        expect(router.url.href).toBe('http://localhost/parent/child');
                        expect(router.isTransitioning).toBe(true);
                        expect(urlHandleObservation.mock.calls.length).toBe(1);

                        return false;
                      });
                    }
                  },
                  component: () => {
                    childComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('parent/child');
        expect(parentControllerObservation.mock.calls.length).toBe(1);
        expect(parentComponentObservation.mock.calls.length).toBe(1);
        expect(childControllerObservation.mock.calls.length).toBe(1);
        expect(childComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('parent');
        expect(router.url.href).toBe('http://localhost/parent/child');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then(() => {
            expect(parentControllerObservation.mock.calls.length).toBe(1);
            expect(parentComponentObservation.mock.calls.length).toBe(2);
            expect(childControllerObservation.mock.calls.length).toBe(1);
            expect(childComponentObservation.mock.calls.length).toBe(0);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('parent');
            expect(router.url.href).toBe('http://localhost/parent');
            expect(router.isTransitioning).toBe(false);
            // the url was overwritten so there was a new change that was handled
            expect(urlHandleObservation.mock.calls.length).toBe(3);
            mvc.unmount();
            history.push('/');
          });
      });

      // test('needs testing', () => {
      //   expect.assertions(1);

      // });
    });

    describe('onLeave', () => {
      test('if onLeave returns a promise it is awaited', () => {
        expect.assertions(48);

        const firstControllerObservation = jest.fn();
        const firstComponentObservation = jest.fn();
        const secondControllerObservation = jest.fn();
        const secondComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();
        const router = new Router({
          routes: [
            {
              controller: {
                onLeave() {
                  firstControllerObservation();

                  return Promise.resolve().then(() => {
                    expect(firstComponentObservation.mock.calls.length).toBe(2);
                    expect(secondControllerObservation.mock.calls.length).toBe(0);
                    expect(secondComponentObservation.mock.calls.length).toBe(0);
                    expect(router.currentRouteFragments.length).toBe(1);
                    expect(router.currentRouteFragment.abstractPath).toBe('');
                    expect(router.url.href).toBe('http://localhost/second');
                    expect(router.isTransitioning).toBe(true);
                    expect(urlHandleObservation.mock.calls.length).toBe(1);
                  });
                }
              },
              component: () => {
                firstComponentObservation();

                return false;
              }
            },
            {
              path: 'second',
              controller: {
                onEnter() {
                  secondControllerObservation();
                  expect(firstControllerObservation.mock.calls.length).toBe(1);
                  expect(firstComponentObservation.mock.calls.length).toBe(2);
                  expect(secondComponentObservation.mock.calls.length).toBe(0);
                  expect(router.currentRouteFragments.length).toBe(0);
                  expect(router.currentRouteFragment).toBe(null);
                  expect(router.url.href).toBe('http://localhost/second');
                  expect(router.isTransitioning).toBe(true);
                  expect(urlHandleObservation.mock.calls.length).toBe(1);
                }
              },
              component: () => {
                secondComponentObservation();

                return false;
              }
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(firstControllerObservation.mock.calls.length).toBe(0);
        expect(firstComponentObservation.mock.calls.length).toBe(1);
        expect(secondControllerObservation.mock.calls.length).toBe(0);
        expect(secondComponentObservation.mock.calls.length).toBe(0);
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('second');
        expect(firstControllerObservation.mock.calls.length).toBe(1);
        expect(firstComponentObservation.mock.calls.length).toBe(2);
        expect(secondControllerObservation.mock.calls.length).toBe(0);
        expect(secondComponentObservation.mock.calls.length).toBe(0);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('');
        expect(router.url.href).toBe('http://localhost/second');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(firstControllerObservation.mock.calls.length).toBe(1);
            expect(firstComponentObservation.mock.calls.length).toBe(2);
            expect(secondControllerObservation.mock.calls.length).toBe(1);
            expect(secondComponentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('second');
            expect(router.url.href).toBe('http://localhost/second');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            mvc.unmount();
            history.push('/');
          });
      });

      test('parent is left after child\'s promise returned from onLeave is awaited', () => {
        expect.assertions(48);

        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();

        history.push('parent/child');

        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              controller: {
                onLeave() {
                  parentControllerObservation();
                  expect(parentComponentObservation.mock.calls.length).toBe(3);
                  expect(childControllerObservation.mock.calls.length).toBe(1);
                  expect(childComponentObservation.mock.calls.length).toBe(2);
                  expect(router.currentRouteFragments.length).toBe(1);
                  expect(router.currentRouteFragment.abstractPath).toBe('parent');
                  expect(router.url.href).toBe('http://localhost/');
                  expect(router.isTransitioning).toBe(true);
                  expect(urlHandleObservation.mock.calls.length).toBe(1);
                }
              },
              component: ({children}) => {
                parentComponentObservation();

                return children;
              },
              children: [
                {
                  path: 'child',
                  controller: {
                    onLeave() {
                      childControllerObservation();

                      return Promise.resolve().then(() => {
                        expect(parentControllerObservation.mock.calls.length).toBe(0);
                        expect(parentComponentObservation.mock.calls.length).toBe(2);
                        expect(childComponentObservation.mock.calls.length).toBe(2);
                        expect(router.currentRouteFragments.length).toBe(2);
                        expect(router.currentRouteFragment.abstractPath).toBe('child');
                        expect(router.url.href).toBe('http://localhost/');
                        expect(router.isTransitioning).toBe(true);
                        expect(urlHandleObservation.mock.calls.length).toBe(1);
                      });
                    }
                  },
                  component: () => {
                    childComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(1);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(1);
        expect(router.url.href).toBe('http://localhost/parent/child');
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(2);
        expect(router.currentRouteFragment.abstractPath).toBe('child');
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('/');
        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(2);
        expect(childControllerObservation.mock.calls.length).toBe(1);
        expect(childComponentObservation.mock.calls.length).toBe(2);
        expect(router.currentRouteFragments.length).toBe(2);
        expect(router.currentRouteFragment.abstractPath).toBe('child');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(parentControllerObservation.mock.calls.length).toBe(1);
            expect(parentComponentObservation.mock.calls.length).toBe(3);
            expect(childControllerObservation.mock.calls.length).toBe(1);
            expect(childComponentObservation.mock.calls.length).toBe(2);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('');
            expect(router.url.href).toBe('http://localhost/');
            expect(router.isTransitioning).toBe(false);
            expect(urlHandleObservation.mock.calls.length).toBe(2);
            mvc.unmount();
          });
      });

      test('if onLeave returns false the route fragment is not left and'
        + ' the transition stops', () => {
        expect.assertions(39);

        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();

        history.push('parent/child');

        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              controller: {
                onLeave() {
                  parentControllerObservation();
                  expect(parentComponentObservation.mock.calls.length).toBe(1);
                  expect(childControllerObservation.mock.calls.length).toBe(1);
                  expect(childComponentObservation.mock.calls.length).toBe(1);
                  expect(router.currentRouteFragments.length).toBe(1);
                  expect(router.currentRouteFragment.abstractPath).toBe('parent');
                  expect(router.url.href).toBe('http://localhost/');
                  expect(router.isTransitioning).toBe(true);
                  expect(urlHandleObservation.mock.calls.length).toBe(1);

                  return false;
                }
              },
              component: ({children}) => {
                parentComponentObservation();

                return children;
              },
              children: [
                {
                  path: 'child',
                  controller: {
                    onLeave() {
                      childControllerObservation();
                      expect(parentControllerObservation.mock.calls.length).toBe(0);
                      expect(parentComponentObservation.mock.calls.length).toBe(1);
                      expect(childComponentObservation.mock.calls.length).toBe(1);
                      expect(router.currentRouteFragments.length).toBe(2);
                      expect(router.currentRouteFragment.abstractPath).toBe('child');
                      expect(router.url.href).toBe('http://localhost/');
                      expect(router.isTransitioning).toBe(true);
                      expect(urlHandleObservation.mock.calls.length).toBe(1);
                    }
                  },
                  component: () => {
                    childComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(1);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(1);
        expect(router.url.href).toBe('http://localhost/parent/child');
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(2);
        expect(router.currentRouteFragment.abstractPath).toBe('child');
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('/');
        expect(parentControllerObservation.mock.calls.length).toBe(1);
        expect(parentComponentObservation.mock.calls.length).toBe(2);
        expect(childControllerObservation.mock.calls.length).toBe(1);
        expect(childComponentObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('parent');
        expect(router.url.href).toBe('http://localhost/parent');
        expect(router.isTransitioning).toBe(false);
        // the url was overwritten so there was a new change that was handled
        expect(urlHandleObservation.mock.calls.length).toBe(3);
        mvc.unmount();
        history.push('/');
      });

      test('if onLeave returns false after awaiting child\'s onLeave, the route fragment'
        + ' is not left and the transition stops', () => {
        expect.assertions(48);

        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();

        history.push('parent/child');

        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              controller: {
                onLeave() {
                  parentControllerObservation();
                  expect(parentComponentObservation.mock.calls.length).toBe(3);
                  expect(childControllerObservation.mock.calls.length).toBe(1);
                  expect(childComponentObservation.mock.calls.length).toBe(2);
                  expect(router.currentRouteFragments.length).toBe(1);
                  expect(router.currentRouteFragment.abstractPath).toBe('parent');
                  expect(router.url.href).toBe('http://localhost/');
                  expect(router.isTransitioning).toBe(true);
                  expect(urlHandleObservation.mock.calls.length).toBe(1);

                  return false;
                }
              },
              component: ({children}) => {
                parentComponentObservation();

                return children;
              },
              children: [
                {
                  path: 'child',
                  controller: {
                    onLeave() {
                      childControllerObservation();

                      return Promise.resolve().then(() => {
                        expect(parentControllerObservation.mock.calls.length).toBe(0);
                        expect(parentComponentObservation.mock.calls.length).toBe(2);
                        expect(childComponentObservation.mock.calls.length).toBe(2);
                        expect(router.currentRouteFragments.length).toBe(2);
                        expect(router.currentRouteFragment.abstractPath).toBe('child');
                        expect(router.url.href).toBe('http://localhost/');
                        expect(router.isTransitioning).toBe(true);
                        expect(urlHandleObservation.mock.calls.length).toBe(1);
                      });
                    }
                  },
                  component: () => {
                    childComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(1);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(1);
        expect(router.url.href).toBe('http://localhost/parent/child');
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(2);
        expect(router.currentRouteFragment.abstractPath).toBe('child');
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('/');
        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(2);
        expect(childControllerObservation.mock.calls.length).toBe(1);
        expect(childComponentObservation.mock.calls.length).toBe(2);
        expect(router.currentRouteFragments.length).toBe(2);
        expect(router.currentRouteFragment.abstractPath).toBe('child');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(parentControllerObservation.mock.calls.length).toBe(1);
            expect(parentComponentObservation.mock.calls.length).toBe(4);
            expect(childControllerObservation.mock.calls.length).toBe(1);
            expect(childComponentObservation.mock.calls.length).toBe(2);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('parent');
            expect(router.url.href).toBe('http://localhost/parent');
            expect(router.isTransitioning).toBe(false);
            // the url was overwritten so there was a new change that was handled
            expect(urlHandleObservation.mock.calls.length).toBe(3);
            mvc.unmount();
            history.push('/');
          });
      });

      test('if onLeave returns a promise fulfilled with false, the route fragment'
        + ' is not left and the transition stops', () => {
        expect.assertions(48);

        const parentControllerObservation = jest.fn();
        const parentComponentObservation = jest.fn();
        const childControllerObservation = jest.fn();
        const childComponentObservation = jest.fn();
        const urlHandleObservation = jest.fn();

        history.push('parent/child');

        const router = new Router({
          routes: [
            {
              component: () => false
            },
            {
              path: 'parent',
              controller: {
                onLeave() {
                  parentControllerObservation();

                  return Promise.resolve().then(() => {
                    expect(parentComponentObservation.mock.calls.length).toBe(2);
                    expect(childControllerObservation.mock.calls.length).toBe(1);
                    expect(childComponentObservation.mock.calls.length).toBe(1);
                    expect(router.currentRouteFragments.length).toBe(1);
                    expect(router.currentRouteFragment.abstractPath).toBe('parent');
                    expect(router.url.href).toBe('http://localhost/');
                    expect(router.isTransitioning).toBe(true);
                    expect(urlHandleObservation.mock.calls.length).toBe(1);

                    return false;
                  });
                }
              },
              component: ({children}) => {
                parentComponentObservation();

                return children;
              },
              children: [
                {
                  path: 'child',
                  controller: {
                    onLeave() {
                      childControllerObservation();
                      expect(parentControllerObservation.mock.calls.length).toBe(0);
                      expect(parentComponentObservation.mock.calls.length).toBe(1);
                      expect(childComponentObservation.mock.calls.length).toBe(1);
                      expect(router.currentRouteFragments.length).toBe(2);
                      expect(router.currentRouteFragment.abstractPath).toBe('child');
                      expect(router.url.href).toBe('http://localhost/');
                      expect(router.isTransitioning).toBe(true);
                      expect(urlHandleObservation.mock.calls.length).toBe(1);
                    }
                  },
                  component: () => {
                    childComponentObservation();

                    return false;
                  }
                }
              ]
            }
          ]
        });

        router.onUrlHandle(urlHandleObservation);
        expect(router.url).toBe(null);
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(0);
        expect(router.currentRouteFragment).toBe(null);
        expect(urlHandleObservation.mock.calls.length).toBe(0);

        const mvc = new Mvc({
          router,
          domElement: document.createElement('div')
        });

        expect(parentControllerObservation.mock.calls.length).toBe(0);
        expect(parentComponentObservation.mock.calls.length).toBe(1);
        expect(childControllerObservation.mock.calls.length).toBe(0);
        expect(childComponentObservation.mock.calls.length).toBe(1);
        expect(router.url.href).toBe('http://localhost/parent/child');
        expect(router.isTransitioning).toBe(false);
        expect(router.currentRouteFragments.length).toBe(2);
        expect(router.currentRouteFragment.abstractPath).toBe('child');
        expect(urlHandleObservation.mock.calls.length).toBe(1);
        router.transitionTo('/');
        expect(parentControllerObservation.mock.calls.length).toBe(1);
        expect(parentComponentObservation.mock.calls.length).toBe(2);
        expect(childControllerObservation.mock.calls.length).toBe(1);
        expect(childComponentObservation.mock.calls.length).toBe(1);
        expect(router.currentRouteFragments.length).toBe(1);
        expect(router.currentRouteFragment.abstractPath).toBe('parent');
        expect(router.url.href).toBe('http://localhost/');
        expect(router.isTransitioning).toBe(true);
        expect(urlHandleObservation.mock.calls.length).toBe(1);

        return Promise.resolve()
          .then()
          .then()
          .then()
          .then()
          .then(() => {
            expect(parentControllerObservation.mock.calls.length).toBe(1);
            expect(parentComponentObservation.mock.calls.length).toBe(3);
            expect(childControllerObservation.mock.calls.length).toBe(1);
            expect(childComponentObservation.mock.calls.length).toBe(1);
            expect(router.currentRouteFragments.length).toBe(1);
            expect(router.currentRouteFragment.abstractPath).toBe('parent');
            expect(router.url.href).toBe('http://localhost/parent');
            expect(router.isTransitioning).toBe(false);
            // the url was overwritten so there was a new change that was handled
            expect(urlHandleObservation.mock.calls.length).toBe(3);
            mvc.unmount();
            history.push('/');
          });
      });

      // test('needs testing', () => {
      //   expect.assertions(1);

      // });
    });
  });

  // describe('routeFragment', () => {
  //   test('needs testing', () => {
  //     expect.assertions(1);

  //   });

  //   describe('onSearchChange', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('offSearchChange', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('refresh', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });
  // });

  // describe('routerManager', () => {
  //   test('needs testing', () => {
  //     expect.assertions(1);

  //   });

  //   describe('list', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('get', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('has', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('add', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });

  //   describe('remove', () => {
  //     test('needs testing', () => {
  //       expect.assertions(1);

  //     });
  //   });
  // });

  // describe('Link', () => {
  //   test('needs testing', () => {
  //     expect.assertions(1);

  //   });
//   });
});
