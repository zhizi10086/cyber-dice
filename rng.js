(function (root, factory) {
  "use strict";

  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.CyberDiceRandom = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const RANDOM_RANGE = 0x100000000;

  function validateMaximum(max) {
    if (!Number.isInteger(max) || max < 1 || max > RANDOM_RANGE) {
      throw new RangeError(
        `max 必须是 1 到 ${RANDOM_RANGE} 之间的整数。`,
      );
    }
  }

  function createCryptoError(cause) {
    const error = new Error("安全随机源不可用。");
    error.code = "CRYPTO_UNAVAILABLE";
    if (cause !== undefined) {
      error.cause = cause;
    }
    return error;
  }

  function secureInteger(
    max,
    cryptoApi = root.crypto || root.msCrypto,
  ) {
    validateMaximum(max);
    if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
      throw createCryptoError();
    }

    const values = new Uint32Array(1);
    const upperBound = Math.floor(RANDOM_RANGE / max) * max;

    try {
      let value;
      do {
        cryptoApi.getRandomValues(values);
        value = values[0];
      } while (value >= upperBound);

      return (value % max) + 1;
    } catch (error) {
      throw createCryptoError(error);
    }
  }

  function probeSecure(cryptoApi = root.crypto || root.msCrypto) {
    try {
      secureInteger(2, cryptoApi);
      return true;
    } catch {
      return false;
    }
  }

  function visualInteger(max, randomFn = Math.random) {
    validateMaximum(max);
    if (typeof randomFn !== "function") {
      throw new TypeError("randomFn 必须是函数。");
    }

    const sample = Number(randomFn());
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError("动画随机值必须位于 [0, 1) 区间。");
    }

    return Math.floor(sample * max) + 1;
  }

  return Object.freeze({
    probeSecure,
    secureInteger,
    visualInteger,
  });
});
