import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const rng = require("../rng.js");

function sequenceCrypto(values) {
  return {
    calls: 0,
    getRandomValues(target) {
      if (this.calls >= values.length) {
        throw new Error("随机序列已耗尽。");
      }
      target[0] = values[this.calls];
      this.calls += 1;
      return target;
    },
  };
}

test("secureInteger 拒绝非法上限", () => {
  const invalidValues = [
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    0x100000001,
    "20",
  ];

  for (const value of invalidValues) {
    assert.throws(
      () => rng.secureInteger(value, sequenceCrypto([0])),
      RangeError,
    );
  }
});

test("secureInteger 拒绝边界值并重新抽取", () => {
  const cryptoApi = sequenceCrypto([
    0xfffffff0,
    0xfffffff5,
    19,
  ]);

  assert.equal(rng.secureInteger(20, cryptoApi), 20);
  assert.equal(cryptoApi.calls, 3);
});

test("secureInteger 接受拒绝边界之前的最大值", () => {
  const cryptoApi = sequenceCrypto([0xffffffef]);

  assert.equal(rng.secureInteger(20, cryptoApi), 20);
  assert.equal(cryptoApi.calls, 1);
});

test("可整除面数不会执行拒绝重抽", () => {
  const cryptoApi = sequenceCrypto([0xffffffff]);

  assert.equal(rng.secureInteger(8, cryptoApi), 8);
  assert.equal(cryptoApi.calls, 1);
});

test("支持完整的 32 位上限", () => {
  const cryptoApi = sequenceCrypto([0xffffffff]);

  assert.equal(rng.secureInteger(0x100000000, cryptoApi), 0x100000000);
  assert.equal(cryptoApi.calls, 1);
});

test("安全随机源缺失时返回统一错误", () => {
  assert.throws(
    () => rng.secureInteger(20, null),
    (error) =>
      error instanceof Error &&
      error.code === "CRYPTO_UNAVAILABLE",
  );
});

test("安全随机源抛异常时返回统一错误", () => {
  const cryptoApi = {
    getRandomValues() {
      throw new Error("entropy unavailable");
    },
  };

  assert.throws(
    () => rng.secureInteger(20, cryptoApi),
    (error) =>
      error instanceof Error &&
      error.code === "CRYPTO_UNAVAILABLE" &&
      error.cause?.message === "entropy unavailable",
  );
});

test("probeSecure 正确识别可用与不可用状态", () => {
  assert.equal(rng.probeSecure(sequenceCrypto([0])), true);
  assert.equal(rng.probeSecure(null), false);
  assert.equal(
    rng.probeSecure({
      getRandomValues() {
        throw new Error("blocked");
      },
    }),
    false,
  );
});

test("visualInteger 仅转换动画样本", () => {
  assert.equal(rng.visualInteger(20, () => 0), 1);
  assert.equal(rng.visualInteger(20, () => 0.999999), 20);
  assert.throws(
    () => rng.visualInteger(20, () => 1),
    RangeError,
  );
  assert.throws(
    () => rng.visualInteger(20, () => Number.NaN),
    RangeError,
  );
  assert.throws(
    () => rng.visualInteger(20, null),
    TypeError,
  );
});
