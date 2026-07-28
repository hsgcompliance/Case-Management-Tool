// scripts/lib/domParserPolyfill.mjs
//
// Minimal DOMParser polyfill for running the report-reconciliation engine's
// XLSX reader (web/src/features/report-reconciliation/reportFilePreview.ts)
// outside the browser. That file is built entirely on standard Web APIs —
// Blob, DecompressionStream, Response, File — all native in Node 22, except
// DOMParser, which Node doesn't provide. This supplies just enough of the
// DOM API surface that file's XML parsing actually calls
// (getElementsByTagName/getElementsByTagNameNS, getAttribute, textContent)
// so the REAL zip/inflate/cell-parsing code runs unmodified — only the
// XML-DOM layer needs a stand-in.
//
// Import this module for its side effect (it installs `globalThis.DOMParser`
// if one isn't already present) before importing any bundle that uses it.

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function localNameOf(name) {
  const idx = name.indexOf(":");
  return idx === -1 ? name : name.slice(idx + 1);
}

class MiniAttr {
  constructor(name, value) {
    this.name = name;
    this.localName = localNameOf(name);
    this.value = value;
  }
}

class MiniElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.localName = localNameOf(tagName);
    this.attributes = [];
    this.children = [];
    this._text = [];
  }

  getAttribute(name) {
    const attr = this.attributes.find((a) => a.name === name);
    return attr ? attr.value : null;
  }

  get textContent() {
    let out = this._text.join("");
    for (const child of this.children) out += child.textContent;
    return out;
  }

  getElementsByTagName(name) {
    const out = [];
    const walk = (el) => {
      for (const child of el.children) {
        if (child.tagName === name) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }

  getElementsByTagNameNS(_ns, localName) {
    const out = [];
    const walk = (el) => {
      for (const child of el.children) {
        if (child.localName === localName) out.push(child);
        walk(child);
      }
    };
    walk(this);
    return out;
  }
}

// Tokenizer: tags <...>, closing tags </...>, CDATA, comments/PIs, and text runs between tags.
const TOKEN_RE = /<!\[CDATA\[([\s\S]*?)\]\]>|<\?[^>]*\?>|<!--[\s\S]*?-->|<\/([^\s>]+)\s*>|<([^\s>/][^>]*?)(\/?)>|([^<]+)/g;
const ATTR_RE = /([^\s=/]+)\s*=\s*"([^"]*)"|([^\s=/]+)\s*=\s*'([^']*)'/g;

function parseAttributes(raw) {
  const attrs = [];
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(raw))) {
    if (m[1] !== undefined) attrs.push(new MiniAttr(m[1], decodeEntities(m[2])));
    else attrs.push(new MiniAttr(m[3], decodeEntities(m[4])));
  }
  return attrs;
}

function parseXmlToTree(xml) {
  const root = new MiniElement("#document");
  const stack = [root];
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(xml))) {
    const [, cdata, closeTag, openTagRaw, selfClose, text] = m;
    if (cdata !== undefined) {
      stack[stack.length - 1]._text.push(cdata);
    } else if (closeTag !== undefined) {
      if (stack.length > 1) stack.pop();
    } else if (openTagRaw !== undefined) {
      const spaceIdx = openTagRaw.search(/\s/);
      const tagName = spaceIdx === -1 ? openTagRaw : openTagRaw.slice(0, spaceIdx);
      const attrRaw = spaceIdx === -1 ? "" : openTagRaw.slice(spaceIdx);
      const el = new MiniElement(tagName);
      el.attributes = parseAttributes(attrRaw);
      stack[stack.length - 1].children.push(el);
      if (!selfClose) stack.push(el);
    } else if (text !== undefined) {
      if (text.trim().length) stack[stack.length - 1]._text.push(decodeEntities(text));
    }
  }
  return root;
}

export class DOMParser {
  parseFromString(xml) {
    const root = parseXmlToTree(xml);
    root.getElementsByTagName = MiniElement.prototype.getElementsByTagName.bind(root);
    root.getElementsByTagNameNS = MiniElement.prototype.getElementsByTagNameNS.bind(root);
    return root;
  }
}

if (typeof globalThis.DOMParser === "undefined") {
  globalThis.DOMParser = DOMParser;
}
