/* eslint-env node */
/* eslint-disable @typescript-eslint/no-var-requires */
"use strict";
/*! License: CC0 1.0 */

const {getTextLinks, FakeLink} = require("../lib/textlinks");

// Adopted from dta-legacy tests

function deepEqual(a, b) {
  expect(a).to.deep.equal(b);
}

function equal(a, b) {
  expect(a).to.equal(b);
}

const strictEqual = equal;

describe("TextLinks", function() {
  it("regular", function() {
    deepEqual(
      getTextLinks("http://downthemall.net/"), ["http://downthemall.net/"]);
    deepEqual(
      getTextLinks("https://downthemall.net/"), ["https://downthemall.net/"]);
    deepEqual(
      getTextLinks("ftp://downthemall.net/"), ["ftp://downthemall.net/"]);
    deepEqual(
      getTextLinks("http://localhost/"), ["http://localhost/"]);
    deepEqual(
      getTextLinks("ftp://localhost/"), ["ftp://localhost/"]);
    deepEqual(
      getTextLinks("http://127.0.0.1/"), ["http://127.0.0.1/"]);
    deepEqual(
      getTextLinks("ftp://127.0.0.1/"), ["ftp://127.0.0.1/"]);
    deepEqual(getTextLinks("http://localhost/somefile.ext"), [
      "http://localhost/somefile.ext"]);
  });

  it("www", function() {
    deepEqual(
      getTextLinks("www.downthemall.net"), ["https://www.downthemall.net/"]);
    deepEqual(getTextLinks("downthemall.net/"), []);
  });

  it("hxp", function() {
    deepEqual(
      getTextLinks("hp://downthemall.net/"), ["http://downthemall.net/"]);
    deepEqual(
      getTextLinks("hxp://downthemall.net/"), ["http://downthemall.net/"]);
    deepEqual(
      getTextLinks("hxxp://downthemall.net/"), ["http://downthemall.net/"]);
    deepEqual(
      getTextLinks("hxxxps://downthemall.net/"), ["https://downthemall.net/"]);
    deepEqual(
      getTextLinks("fxp://downthemall.net/"), ["ftp://downthemall.net/"]);
  });

  it("$", function() {
    deepEqual(
      getTextLinks(
        "www.example.com/folder$file1\nwww.example.com/folder$file2"),
      [
        "https://www.example.com/folder$file1",
        "https://www.example.com/folder$file2"
      ]
    );
  });

  it("3dots", function() {
    deepEqual(getTextLinks("http://downthemall.net/crop...ped"), []);
    deepEqual(getTextLinks("http://downthemall.net/crop.....ped"), []);
  });

  it("sanitize", function() {
    deepEqual(
      getTextLinks("<http://downthemall.net/>"), ["http://downthemall.net/"]);
    deepEqual(
      getTextLinks("http://downthemall.net/#foo"), ["http://downthemall.net/"]);
    deepEqual(
      getTextLinks("<http://downthemall.net/#foo>"),
      ["http://downthemall.net/"]);
  });

  it("FakeLink", function() {
    let l = new FakeLink("http://downthemall.net/");
    equal(l.href, "http://downthemall.net/", "href");
    equal(l.toString(), "http://downthemall.net/", "toString");
    strictEqual(l.title, undefined, "title1");
    deepEqual(l.childNodes, [], "childNodes");
    equal(typeof l.hasAttribute, "function", "hasAttribute");
    equal(l.hasAttribute("foo"), false, "hasAttribute foo");
    equal(l.hasAttribute("href"), true, "hasAttribute href");
    equal(l.hasAttribute("title"), false, "hasAttribute title");

    equal(typeof l.getAttribute, "function", "hasAttribute");
    equal(l.getAttribute("href"), l.href, "getAttribute href");

    l = new FakeLink("http://downthemall.net/", "title");
    equal(l.hasAttribute("title"), true, "hasAttribute title2");
    equal(l.getAttribute("title"), l.title, "getAttribute title");
  });
});
