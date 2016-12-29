(() => {
  'use strict';

  const isModule = typeof module === 'object' && typeof module.exports === 'object';

  let isListening = false;
  const cbs = new Set();

  function on(cb) {
    cbs.add(cb);

    if (!isListening) {
      listen();
    }
  }

  function off(cb) {
    cbs.delete(cb);

    if (!cbs.size) {
      unlisten();
    }
  }

  function onChange() {
    const url = new URL(window.location);

    cbs.forEach(cb => cb(url));

    // chrome has a bug where going back and forward in the history
    // it doesn't jump to the hash
    jumpToHash();
  }

  function jumpToHash() {
    const hash = window.location.hash;

    if (hash) {
      const element = document.getElementById(hash.slice(1));

      if (element) {
        element.scrollIntoView();
      }
    }
  }

  function listen() {
    isListening = true;

    window.addEventListener('popstate', onChange);
  }

  function unlisten() {
    isListening = false;

    window.removeEventListener('popstate', onChange);
  }

  function push(path) {
    const url = new URL(path, window.location);

    if (url.toString() === window.location.toString()) {
      return;
    }

    history.pushState(null, '', path);
    onChange();
  }

  function getUrl() {
    return new URL(window.location);
  }

  const moduleExports = {
    on,
    off,
    push,
    getUrl,
    jumpToHash
  };

  if (isModule) {
    module.exports = moduleExports;
  } else {
    window.crizmas = window.crizmas || {};
    window.crizmas.history = moduleExports;
  }
})();
