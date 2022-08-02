/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
"use strict";
// License: CC0 1.0

const DownloadState = require("../lib/manager/state");
const Renamer = require("../lib/manager/renamer");
const {BaseDownload} = require("../lib/manager/basedownload");


const OPTS = {
  /* eslint-disable max-len */
  url: "https://www.example.co.uk/test/path/dir/filen%C3%A4me.extension?q=1&d=a/b#ref",
  usable: "https://www.example.co.uk/test/path/dir/filenäme.extension?q=1&d=a/b#ref",
  referrer: "https://www2.example.net/ref/path/dir/rfilename.rextension?r=1&d=2#rref",
  usableReferrer: "https://www2.example.net/ref/path/dir/rfilename.rextension?r=1&d=2#rref",
  /* eslint-enable max-len */
  startDate: 1530439872000,
  state: DownloadState.QUEUED,
  batch: 42,
  idx: 23,
  mask: "*name*.*ext*",
  description: "desc / ript.ion .",
  title: " *** TITLE *** ",
  pageTitle: " *** PAGE TITLE *** "
};

const dl = new BaseDownload(OPTS);

function makeOne(mask) {
  dl.mask = mask;
  const {dest} = dl;
  return dest;
}

describe("Renamer", function() {
  it("SUPPORTED", function() {
    expect(Array.isArray(Renamer.SUPPORTED)).to.be.true;
    expect(Renamer.SUPPORTED).to.have.lengthOf.above(0);
  });

  for (let i = 0; i < 3; ++i) {
    it("*name*", function() {
      const dest = makeOne("*name*");
      expect(dest.full).to.equal("filenäme");
      expect(dest.name).to.equal("filenäme");
      expect(dest.base).to.equal("filenäme");
      expect(dest.ext).to.equal("");
      expect(dest.path).to.equal("");
    });

    it("*name*.*ext*", function() {
      const dest = makeOne("*name*.*ext*");
      expect(dest.full).to.equal("filenäme.extension");
      expect(dest.name).to.equal("filenäme.extension");
      expect(dest.base).to.equal("filenäme");
      expect(dest.ext).to.equal("extension");
      expect(dest.path).to.equal("");
    });

    it("*name*.*ext* (mime override)", function() {
      const {dest} = new BaseDownload(
        Object.assign({}, OPTS, {
          mask: "*name* *batch*.*ext*",
          mime: "image/jpeg"
        }));
      expect(dest.full).to.equal("filenäme 042.jpg");
      expect(dest.name).to.equal("filenäme 042.jpg");
      expect(dest.base).to.equal("filenäme 042");
      expect(dest.ext).to.equal("jpg");
      expect(dest.path).to.equal("");
    });

    it("*name*.*ext* (mime no override)", function() {
      const {dest} = new BaseDownload(
        Object.assign({}, OPTS, {
          mask: "*name* *batch*.*ext*",
          mime: "image/jpeg",
          url: "https://www.example.co.uk/filen%C3%A4me.JPe",
          usable: "https://www.example.co.uk/filenäme.JPe",
        }));
      expect(dest.full).to.equal("filenäme 042.JPe");
      expect(dest.name).to.equal("filenäme 042.JPe");
      expect(dest.base).to.equal("filenäme 042");
      expect(dest.ext).to.equal("JPe");
      expect(dest.path).to.equal("");
    });

    it("*name*.*ext* (mime override; missing ext)", function() {
      const {dest} = new BaseDownload(
        Object.assign({}, OPTS, {
          mask: "*name* *batch*.*ext*",
          mime: "application/json",
          url: "https://www.example.co.uk/filen%C3%A4me",
          usable: "https://www.example.co.uk/filenäme",
        }));
      expect(dest.full).to.equal("filenäme 042.json");
      expect(dest.name).to.equal("filenäme 042.json");
      expect(dest.base).to.equal("filenäme 042");
      expect(dest.ext).to.equal("json");
      expect(dest.path).to.equal("");
    });

    it("*text*", function() {
      const dest = makeOne("*text*");
      expect(dest.full).to.equal("desc/ript.ion");
      expect(dest.name).to.equal("ript.ion");
      expect(dest.base).to.equal("ript");
      expect(dest.ext).to.equal("ion");
      expect(dest.path).to.equal("desc");
    });

    it("*flattext*", function() {
      const dest = makeOne("*flattext*");
      expect(dest.full).to.equal("desc - ript.ion");
      expect(dest.name).to.equal("desc - ript.ion");
      expect(dest.base).to.equal("desc - ript");
      expect(dest.ext).to.equal("ion");
      expect(dest.path).to.equal("");
    });

    it("*title*", function() {
      const dest = makeOne("*title*");
      expect(dest.full).to.equal("_ TITLE _");
      expect(dest.name).to.equal("_ TITLE _");
      expect(dest.base).to.equal("_ TITLE _");
      expect(dest.ext).to.equal("");
      expect(dest.path).to.equal("");
    });

    it("*host*", function() {
      const dest = makeOne("*host*");
      expect(dest.full).to.equal("www.example.co.uk");
      expect(dest.name).to.equal("www.example.co.uk");
      expect(dest.base).to.equal("www.example.co");
      expect(dest.ext).to.equal("uk");
      expect(dest.path).to.equal("");
    });

    it("*domain*", function() {
      const dest = makeOne("*domain*");
      expect(dest.full).to.equal("example.co.uk");
      expect(dest.name).to.equal("example.co.uk");
      expect(dest.base).to.equal("example.co");
      expect(dest.ext).to.equal("uk");
      expect(dest.path).to.equal("");
    });

    it("*subdirs*", function() {
      const dest = makeOne("*subdirs*");
      expect(dest.full).to.equal("test/path/dir");
      expect(dest.name).to.equal("dir");
      expect(dest.base).to.equal("dir");
      expect(dest.ext).to.equal("");
      expect(dest.path).to.equal("test/path");
    });

    it("*flatsubdirs*", function() {
      const dest = makeOne("*flatsubdirs*");
      expect(dest.full).to.equal("test-path-dir");
      expect(dest.name).to.equal("test-path-dir");
      expect(dest.base).to.equal("test-path-dir");
      expect(dest.ext).to.equal("");
      expect(dest.path).to.equal("");
    });

    it("*qstring*", function() {
      const dest = makeOne("*qstring*");
      expect(dest.full).to.equal("q=1&d=a-b");
      expect(dest.name).to.equal("q=1&d=a-b");
      expect(dest.base).to.equal("q=1&d=a-b");
      expect(dest.ext).to.equal("");
      expect(dest.path).to.equal("");
    });

    it("*url*", function() {
      const dest = makeOne("*url*");
      expect(dest.full).to.equal(
        "www.example.co.uk/test/path/dir/filenäme.extension_q=1&d=a/b#ref");
      expect(dest.name).to.equal("b#ref");
      expect(dest.base).to.equal("b#ref");
      expect(dest.ext).to.equal("");
      expect(dest.path).to.equal(
        "www.example.co.uk/test/path/dir/filenäme.extension_q=1&d=a");
    });

    it("*flaturl*", function() {
      const dest = makeOne("*flaturl*");
      expect(dest.full).to.equal(
        "www.example.co.uk-test-path-dir-filenäme.extension_q=1&d=a-b#ref");
      expect(dest.name).to.equal(
        "www.example.co.uk-test-path-dir-filenäme.extension_q=1&d=a-b#ref");
      expect(dest.base).to.equal("www.example.co.uk-test-path-dir-filenäme");
      expect(dest.ext).to.equal("extension_q=1&d=a-b#ref");
      expect(dest.path).to.equal("");
    });

    it("*refhost*", function() {
      const dest = makeOne("*refhost*");
      expect(dest.full).to.equal("www2.example.net");
      expect(dest.name).to.equal("www2.example.net");
      expect(dest.base).to.equal("www2.example");
      expect(dest.ext).to.equal("net");
      expect(dest.path).to.equal("");
    });

    it("*refdomain*", function() {
      const dest = makeOne("*refdomain*");
      expect(dest.full).to.equal("example.net");
      expect(dest.name).to.equal("example.net");
      expect(dest.base).to.equal("example");
      expect(dest.ext).to.equal("net");
      expect(dest.path).to.equal("");
    });

    it("*refsubdirs*", function() {
      const dest = makeOne("*refsubdirs*");
      expect(dest.full).to.equal("ref/path/dir");
      expect(dest.name).to.equal("dir");
      expect(dest.base).to.equal("dir");
      expect(dest.ext).to.equal("");
      expect(dest.path).to.equal("ref/path");
    });

    it("*refqstring*", function() {
      const dest = makeOne("*refqstring*");
      expect(dest.full).to.equal("r=1&d=2");
      expect(dest.name).to.equal("r=1&d=2");
      expect(dest.base).to.equal("r=1&d=2");
      expect(dest.ext).to.equal("");
      expect(dest.path).to.equal("");
    });

    it("*refurl*", function() {
      const dest = makeOne("*refurl*");
      expect(dest.full).to.equal(
        "www2.example.net/ref/path/dir/rfilename.rextension_r=1&d=2#rref");
      expect(dest.name).to.equal("rfilename.rextension_r=1&d=2#rref");
      expect(dest.base).to.equal("rfilename");
      expect(dest.ext).to.equal("rextension_r=1&d=2#rref");
      expect(dest.path).to.equal("www2.example.net/ref/path/dir");
    });

    it("*flatrefurl*", function() {
      const dest = makeOne("*flatrefurl*");
      expect(dest.full).to.equal(
        "www2.example.net-ref-path-dir-rfilename.rextension_r=1&d=2#rref");
      expect(dest.name).to.equal(
        "www2.example.net-ref-path-dir-rfilename.rextension_r=1&d=2#rref");
      expect(dest.base).to.equal("www2.example.net-ref-path-dir-rfilename");
      expect(dest.ext).to.equal("rextension_r=1&d=2#rref");
      expect(dest.path).to.equal("");
    });

    it("*batch*\\*idx*.*batch*", function() {
      const dest = makeOne("*batch*\\*idx*.*batch*");
      expect(dest.full).to.equal("042/023.042");
      expect(dest.name).to.equal("023.042");
      expect(dest.base).to.equal("023");
      expect(dest.ext).to.equal("042");
      expect(dest.path).to.equal("042");
    });

    it("*y**m**d*/*hh**mm*.*ss*", function() {
      const dest = makeOne("*y**m**d*/*hh**mm*.*ss*");
      expect(dest.full).to.equal("20180701/1211.12");
      expect(dest.name).to.equal("1211.12");
      expect(dest.base).to.equal("1211");
      expect(dest.ext).to.equal("12");
      expect(dest.path).to.equal("20180701");
    });

    it("*date*", function() {
      const dest = makeOne("*date*");
      expect(dest.full).to.equal("20180701T121112");
      expect(dest.name).to.equal("20180701T121112");
      expect(dest.base).to.equal("20180701T121112");
      expect(dest.ext).to.equal("");
      expect(dest.path).to.equal("");
    });

    it("*host*/*pagetitle*/*name*.*ext*", function() {
      const dest = makeOne("*host*/*pagetitle*/*name*.*ext*");
      expect(dest.full).to.equal(
        "www.example.co.uk/_ PAGE TITLE _/filenäme.extension");
      expect(dest.name).to.equal("filenäme.extension");
      expect(dest.base).to.equal("filenäme");
      expect(dest.ext).to.equal("extension");
      expect(dest.path).to.equal("www.example.co.uk/_ PAGE TITLE _");
    });
  }
});
