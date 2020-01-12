'use strict';

const history = require('../src/history.js');
const url = require('url');

global.URLSearchParams = url.URLSearchParams;
global.URL = url.URL;

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
      expect(history.getUrl().href).toBe('https://localhost/');
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
