let isListening = false;
const cbs = new Set();

export const on = (cb) => {
  cbs.add(cb);

  if (!isListening) {
    listen();
  }
};

const listen = () => {
  isListening = true;

  window.addEventListener('popstate', onPopState);
};

// make sure handleUrl doesn't receive inappropriate arguments
const onPopState = () => {
  handleUrl();
};

const handleUrl = (details) => {
  const url = new URL(window.location);

  cbs.forEach((cb) => cb(url, details));
};

export const jumpToHash = () => {
  const hash = window.location.hash;

  if (hash) {
    const element = document.getElementById(hash.slice(1));

    if (element) {
      element.scrollIntoView();
    }
  }
};

export const off = (cb) => {
  cbs.delete(cb);

  if (!cbs.size) {
    unlisten();
  }
};

const unlisten = () => {
  isListening = false;

  window.removeEventListener('popstate', onPopState);
};

export const push = (url, details) => {
  // url must always be a string because otherwise it's treated differently by
  // the URL api (in isCurrentUrl) and history.pushState
  url = String(url);

  if (!isCurrentUrl(url)) {
    if (details && details.replace) {
      history.replaceState(null, '', url);
    } else {
      history.pushState(null, '', url);
    }
  }

  handleUrl(details);
};

export const isCurrentUrl = (url) => {
  // url must always be a string because otherwise it's treated differently by
  // the URL api and history.pushState (in push)
  url = new URL(String(url), window.location);

  return url.href === window.location.href;
};

export const getUrl = () => {
  return new URL(window.location);
};
