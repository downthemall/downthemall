/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
"use strict";
// License: CC0 1.0

const {
  formatInteger, formatSize, formatSpeed, formatTimeDelta
} = require("../lib/formatters");

describe("Formatters", function() {
  it("formatInteger", function() {
    expect(formatInteger(1)).to.equal("001");
    expect(formatInteger(-1)).to.equal("-001");
    expect(formatInteger(1, 1)).to.equal("1");
    expect(formatInteger(-1, 1)).to.equal("-1");
    expect(formatInteger(1, 10)).to.equal("0000000001");
    expect(formatInteger(10, 1)).to.equal("10");
    expect(() => formatInteger(1, 0)).to.throw("Invalid digit count");
    expect(() => formatInteger(1, -1)).to.throw("Invalid digit count");
  });

  it("formatSize", function() {
    expect(formatSize(0)).to.equal("0B");
    expect(formatSize(100)).to.equal("100B");
    expect(formatSize(800)).to.equal("800B");
    expect(formatSize(900)).to.equal("0.9KB");
    expect(formatSize((2 << 20) - 1024)).to.equal("2.00MB");
    expect(formatSize((2 << 20) - 1024 * 10)).to.equal("1.99MB");
    expect(formatSize(2 << 30)).to.equal("-2.00GB");
  });

  it("formatSpeed", function() {
    expect(formatSpeed(0)).to.equal("0b/s");
    expect(formatSpeed(100)).to.equal("100b/s");
    expect(formatSpeed(800)).to.equal("800b/s");
    expect(formatSpeed(900)).to.equal("900b/s");
    expect(formatSpeed((2 << 20) - 1024)).to.equal("2.00MB/s");
    expect(formatSpeed((2 << 20) - 1024 * 10)).to.equal("1.99MB/s");
    expect(formatSpeed((2 << 24) - 1024 * 10)).to.equal("31.99MB/s");
  });

  it("formatTimeDelta", function() {
    expect(formatTimeDelta(0)).to.equal("00:00");
    expect(formatTimeDelta(59)).to.equal("00:59");
    expect(formatTimeDelta(60)).to.equal("01:00");
    expect(formatTimeDelta((60 * 60) - 1)).to.equal("59:59");
    expect(formatTimeDelta(60 * 60)).to.equal("01:00:00");
    expect(formatTimeDelta((60 * 60 * 24) - 0.1)).to.equal("23:59:59");
    expect(formatTimeDelta(60 * 60 * 24)).to.equal("1d::00:00:00");
    expect(formatTimeDelta(60 * 60 * 24 * 10)).to.equal("∞");
  });
});
