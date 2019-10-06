/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
"use strict";
// License: CC0 1.0

const {BatchGenerator} = require("../lib/batches");

describe("BatchGenerator", function() {
  it("numeric", function() {
    const gen = new BatchGenerator("abc[1:10].lol[1].b");
    const items = Array.from(gen);
    expect(items).to.deep.equal([
      "abc1.lol[1].b",
      "abc2.lol[1].b",
      "abc3.lol[1].b",
      "abc4.lol[1].b",
      "abc5.lol[1].b",
      "abc6.lol[1].b",
      "abc7.lol[1].b",
      "abc8.lol[1].b",
      "abc9.lol[1].b",
      "abc10.lol[1].b",
    ]);
    expect(items.length).to.equal(gen.length);
    expect(items[0]).to.equal(gen.preview);
  });
  it("numeric two", function() {
    const gen = new BatchGenerator("ab[0:2]c[1:2].lol[1].b");
    const items = Array.from(gen);
    expect(items).to.deep.equal([
      "ab0c1.lol[1].b",
      "ab0c2.lol[1].b",
      "ab1c1.lol[1].b",
      "ab1c2.lol[1].b",
      "ab2c1.lol[1].b",
      "ab2c2.lol[1].b",
    ]);
    expect(items.length).to.equal(gen.length);
    expect(items[0]).to.equal(gen.preview);
  });

  it("numeric digits", function() {
    const gen = new BatchGenerator("abc[001:10].lol[1].b");
    const items = Array.from(gen);
    expect(items).to.deep.equal([
      "abc001.lol[1].b",
      "abc002.lol[1].b",
      "abc003.lol[1].b",
      "abc004.lol[1].b",
      "abc005.lol[1].b",
      "abc006.lol[1].b",
      "abc007.lol[1].b",
      "abc008.lol[1].b",
      "abc009.lol[1].b",
      "abc010.lol[1].b",
    ]);
    expect(items.length).to.equal(gen.length);
    expect(items[0]).to.equal(gen.preview);
    expect(gen.hasInvalid).to.be.false;
  });

  it("numeric digits step", function() {
    const gen = new BatchGenerator("abc[001:10:2].lol[1].b");
    const items = Array.from(gen);
    expect(items).to.deep.equal([
      "abc001.lol[1].b",
      "abc003.lol[1].b",
      "abc005.lol[1].b",
      "abc007.lol[1].b",
      "abc009.lol[1].b",
    ]);
    expect(items.length).to.equal(gen.length);
    expect(items[0]).to.equal(gen.preview);
    expect(gen.hasInvalid).to.be.false;
  });

  it("numeric digits step back", function() {
    const gen = new BatchGenerator("abc[10:001:-2].lol[1].b");
    const items = Array.from(gen);
    expect(items).to.deep.equal([
      "abc010.lol[1].b",
      "abc008.lol[1].b",
      "abc006.lol[1].b",
      "abc004.lol[1].b",
      "abc002.lol[1].b",
    ]);
    expect(items.length).to.equal(gen.length);
    expect(items[0]).to.equal(gen.preview);
    expect(gen.hasInvalid).to.be.false;
  });

  it("numeric w/ invalid", function() {
    const gen = new BatchGenerator("abc[10:001:-2].lol[1:0].b");
    const items = Array.from(gen);
    expect(items).to.deep.equal([
      "abc010.lol[1:0].b",
      "abc008.lol[1:0].b",
      "abc006.lol[1:0].b",
      "abc004.lol[1:0].b",
      "abc002.lol[1:0].b",
    ]);
    expect(items.length).to.equal(gen.length);
    expect(items[0]).to.equal(gen.preview);
    expect(gen.hasInvalid).to.be.true;
  });
  it("numeric w/ only invalid", function() {
    const gen = new BatchGenerator("abc[10:101:-2].lol[1:0].b");
    const items = Array.from(gen);
    expect(items).to.deep.equal([
      "abc[10:101:-2].lol[1:0].b",
    ]);
    expect(items.length).to.equal(gen.length);
    expect(items[0]).to.equal(gen.preview);
    expect(gen.hasInvalid).to.be.true;
  });

  it("characters", function() {
    const gen = new BatchGenerator("abc[a:c].lol[1].b");
    const items = Array.from(gen);
    expect(items).to.deep.equal([
      "abca.lol[1].b",
      "abcb.lol[1].b",
      "abcc.lol[1].b",
    ]);
    expect(items.length).to.equal(gen.length);
    expect(items[0]).to.equal(gen.preview);
  });

  it("characters two", function() {
    const gen = new BatchGenerator("abc[D:G].lol[1].b");
    const items = Array.from(gen);
    expect(items).to.deep.equal([
      "abcD.lol[1].b",
      "abcE.lol[1].b",
      "abcF.lol[1].b",
      "abcG.lol[1].b",
    ]);
    expect(items.length).to.equal(gen.length);
    expect(items[0]).to.equal(gen.preview);
  });
});
