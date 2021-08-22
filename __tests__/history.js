/**
 * @jest-environment jsdom
 */

import {URL, URLSearchParams} from 'url';

import * as history from '../src/history.js';

globalThis.URLSearchParams = URLSearchParams;
globalThis.URL = URL;

describe('history', () => {
  // describe('push', () => {
  //   test('needs testing', () => {
  //     expect.assertions(1);

  //   });
  // });

  // describe('isCurrentUrl', () => {
  //   test('needs testing', () => {
  //     expect.assertions(1);

  //   });
  // });

  describe('getUrl', () => {
    test('returns the current url', () => {
      expect.assertions(1);
      expect(history.getUrl().href).toBe('http://localhost/');
    });

    // test('needs testing', () => {
    //   expect.assertions(1);

    // });
  });

  // describe('jumpToHash', () => {
  //   test('needs testing', () => {
  //     expect.assertions(1);

  //   });
  // });

  // describe('on', () => {
  //   test('needs testing', () => {
  //     expect.assertions(1);

  //   });
  // });

  // describe('off', () => {
  //   test('needs testing', () => {
  //     expect.assertions(1);

  //   });
  // });
});
