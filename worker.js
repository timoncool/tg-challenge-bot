var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// node_modules/grammy/out/web.mjs
var web_exports = {};
__export(web_exports, {
  API_CONSTANTS: () => API_CONSTANTS,
  Api: () => Api,
  Bot: () => Bot,
  BotError: () => BotError,
  Composer: () => Composer,
  Context: () => Context,
  GrammyError: () => GrammyError,
  HttpError: () => HttpError,
  InlineKeyboard: () => InlineKeyboard,
  InlineQueryResultBuilder: () => InlineQueryResultBuilder,
  InputFile: () => InputFile,
  InputMediaBuilder: () => InputMediaBuilder,
  Keyboard: () => Keyboard,
  MemorySessionStorage: () => MemorySessionStorage,
  enhanceStorage: () => enhanceStorage,
  lazySession: () => lazySession,
  matchFilter: () => matchFilter,
  session: () => session,
  webhookCallback: () => webhookCallback
});
function matchFilter(filter) {
  const queries = Array.isArray(filter) ? filter : [
    filter
  ];
  const key = queries.join(",");
  const predicate = filterQueryCache.get(key) ?? (() => {
    const parsed = parse(queries);
    const pred = compile(parsed);
    filterQueryCache.set(key, pred);
    return pred;
  })();
  return (ctx) => predicate(ctx);
}
function parse(filter) {
  return Array.isArray(filter) ? filter.map((q) => q.split(":")) : [
    filter.split(":")
  ];
}
function compile(parsed) {
  const preprocessed = parsed.flatMap((q) => check(q, preprocess(q)));
  const ltree = treeify(preprocessed);
  const predicate = arborist(ltree);
  return (ctx) => !!predicate(ctx.update, ctx);
}
function preprocess(filter) {
  const valid = UPDATE_KEYS;
  const expanded = [
    filter
  ].flatMap((q) => {
    const [l1, l2, l3] = q;
    if (!(l1 in L1_SHORTCUTS))
      return [
        q
      ];
    if (!l1 && !l2 && !l3)
      return [
        q
      ];
    const targets = L1_SHORTCUTS[l1];
    const expanded2 = targets.map((s2) => [
      s2,
      l2,
      l3
    ]);
    if (l2 === void 0)
      return expanded2;
    if (l2 in L2_SHORTCUTS && (l2 || l3))
      return expanded2;
    return expanded2.filter(([s2]) => !!valid[s2]?.[l2]);
  }).flatMap((q) => {
    const [l1, l2, l3] = q;
    if (!(l2 in L2_SHORTCUTS))
      return [
        q
      ];
    if (!l2 && !l3)
      return [
        q
      ];
    const targets = L2_SHORTCUTS[l2];
    const expanded2 = targets.map((s2) => [
      l1,
      s2,
      l3
    ]);
    if (l3 === void 0)
      return expanded2;
    return expanded2.filter(([, s2]) => !!valid[l1]?.[s2]?.[l3]);
  });
  if (expanded.length === 0) {
    throw new Error(`Shortcuts in '${filter.join(":")}' do not expand to any valid filter query`);
  }
  return expanded;
}
function check(original, preprocessed) {
  if (preprocessed.length === 0)
    throw new Error("Empty filter query given");
  const errors = preprocessed.map(checkOne).filter((r) => r !== true);
  if (errors.length === 0)
    return preprocessed;
  else if (errors.length === 1)
    throw new Error(errors[0]);
  else {
    throw new Error(`Invalid filter query '${original.join(":")}'. There are ${errors.length} errors after expanding the contained shortcuts: ${errors.join("; ")}`);
  }
}
function checkOne(filter) {
  const [l1, l2, l3, ...n] = filter;
  if (l1 === void 0)
    return "Empty filter query given";
  if (!(l1 in UPDATE_KEYS)) {
    const permitted = Object.keys(UPDATE_KEYS);
    return `Invalid L1 filter '${l1}' given in '${filter.join(":")}'. Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`;
  }
  if (l2 === void 0)
    return true;
  const l1Obj = UPDATE_KEYS[l1];
  if (!(l2 in l1Obj)) {
    const permitted = Object.keys(l1Obj);
    return `Invalid L2 filter '${l2}' given in '${filter.join(":")}'. Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`;
  }
  if (l3 === void 0)
    return true;
  const l2Obj = l1Obj[l2];
  if (!(l3 in l2Obj)) {
    const permitted = Object.keys(l2Obj);
    return `Invalid L3 filter '${l3}' given in '${filter.join(":")}'. ${permitted.length === 0 ? `No further filtering is possible after '${l1}:${l2}'.` : `Permitted values are: ${permitted.map((k) => `'${k}'`).join(", ")}.`}`;
  }
  if (n.length === 0)
    return true;
  return `Cannot filter further than three levels, ':${n.join(":")}' is invalid!`;
}
function treeify(paths) {
  const tree = {};
  for (const [l1, l2, l3] of paths) {
    const subtree = tree[l1] ??= {};
    if (l2 !== void 0) {
      const set = subtree[l2] ??= /* @__PURE__ */ new Set();
      if (l3 !== void 0)
        set.add(l3);
    }
  }
  return tree;
}
function or(left, right) {
  return (obj, ctx) => left(obj, ctx) || right(obj, ctx);
}
function concat(get, test) {
  return (obj, ctx) => {
    const nextObj = get(obj, ctx);
    return nextObj && test(nextObj, ctx);
  };
}
function leaf(pred) {
  return (obj, ctx) => pred(obj, ctx) != null;
}
function arborist(tree) {
  const l1Predicates = Object.entries(tree).map(([l1, subtree]) => {
    const l1Pred = /* @__PURE__ */ __name((obj) => obj[l1], "l1Pred");
    const l2Predicates = Object.entries(subtree).map(([l2, set]) => {
      const l2Pred = /* @__PURE__ */ __name((obj) => obj[l2], "l2Pred");
      const l3Predicates = Array.from(set).map((l3) => {
        const l3Pred = l3 === "me" ? (obj, ctx) => {
          const me = ctx.me.id;
          return testMaybeArray(obj, (u) => u.id === me);
        } : (obj) => testMaybeArray(obj, (e) => e[l3] || e.type === l3);
        return l3Pred;
      });
      return l3Predicates.length === 0 ? leaf(l2Pred) : concat(l2Pred, l3Predicates.reduce(or));
    });
    return l2Predicates.length === 0 ? leaf(l1Pred) : concat(l1Pred, l2Predicates.reduce(or));
  });
  if (l1Predicates.length === 0) {
    throw new Error("Cannot create filter function for empty query");
  }
  return l1Predicates.reduce(or);
}
function testMaybeArray(t, pred) {
  const p = /* @__PURE__ */ __name((x) => x != null && pred(x), "p");
  return Array.isArray(t) ? t.some(p) : p(t);
}
function orThrow(value, method) {
  if (value === void 0) {
    throw new Error(`Missing information for API call to ${method}`);
  }
  return value;
}
function triggerFn(trigger) {
  return toArray(trigger).map((t) => typeof t === "string" ? (txt) => txt === t ? t : null : (txt) => txt.match(t));
}
function match(ctx, content, triggers) {
  for (const t of triggers) {
    const res = t(content);
    if (res) {
      ctx.match = res;
      return true;
    }
  }
  return false;
}
function toArray(e) {
  return Array.isArray(e) ? e : [
    e
  ];
}
function generateBotErrorMessage(error) {
  let msg;
  if (error instanceof Error) {
    msg = `${error.name} in middleware: ${error.message}`;
  } else {
    const type = typeof error;
    msg = `Non-error value of type ${type} thrown in middleware`;
    switch (type) {
      case "bigint":
      case "boolean":
      case "number":
      case "symbol":
        msg += `: ${error}`;
        break;
      case "string":
        msg += `: ${String(error).substring(0, 50)}`;
        break;
      default:
        msg += "!";
        break;
    }
  }
  return msg;
}
function flatten(mw) {
  return typeof mw === "function" ? mw : (ctx, next) => mw.middleware()(ctx, next);
}
function concat1(first, andThen) {
  return async (ctx, next) => {
    let nextCalled = false;
    await first(ctx, async () => {
      if (nextCalled)
        throw new Error("`next` already called before!");
      else
        nextCalled = true;
      await andThen(ctx, next);
    });
  };
}
function pass(_ctx, next) {
  return next();
}
async function run(middleware, ctx) {
  await middleware(ctx, leaf1);
}
function parse1(str2) {
  str2 = String(str2);
  if (str2.length > 100) {
    return;
  }
  var match3 = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str2);
  if (!match3) {
    return;
  }
  var n = parseFloat(match3[1]);
  var type = (match3[2] || "ms").toLowerCase();
  switch (type) {
    case "years":
    case "year":
    case "yrs":
    case "yr":
    case "y":
      return n * y;
    case "weeks":
    case "week":
    case "w":
      return n * w;
    case "days":
    case "day":
    case "d":
      return n * d;
    case "hours":
    case "hour":
    case "hrs":
    case "hr":
    case "h":
      return n * h;
    case "minutes":
    case "minute":
    case "mins":
    case "min":
    case "m":
      return n * m;
    case "seconds":
    case "second":
    case "secs":
    case "sec":
    case "s":
      return n * s;
    case "milliseconds":
    case "millisecond":
    case "msecs":
    case "msec":
    case "ms":
      return n;
    default:
      return void 0;
  }
}
function fmtShort(ms2) {
  var msAbs = Math.abs(ms2);
  if (msAbs >= d) {
    return Math.round(ms2 / d) + "d";
  }
  if (msAbs >= h) {
    return Math.round(ms2 / h) + "h";
  }
  if (msAbs >= m) {
    return Math.round(ms2 / m) + "m";
  }
  if (msAbs >= s) {
    return Math.round(ms2 / s) + "s";
  }
  return ms2 + "ms";
}
function fmtLong(ms2) {
  var msAbs = Math.abs(ms2);
  if (msAbs >= d) {
    return plural(ms2, msAbs, d, "day");
  }
  if (msAbs >= h) {
    return plural(ms2, msAbs, h, "hour");
  }
  if (msAbs >= m) {
    return plural(ms2, msAbs, m, "minute");
  }
  if (msAbs >= s) {
    return plural(ms2, msAbs, s, "second");
  }
  return ms2 + " ms";
}
function plural(ms2, msAbs, n, name) {
  var isPlural = msAbs >= n * 1.5;
  return Math.round(ms2 / n) + " " + name + (isPlural ? "s" : "");
}
function defaultSetTimout() {
  throw new Error("setTimeout has not been defined");
}
function defaultClearTimeout() {
  throw new Error("clearTimeout has not been defined");
}
function runTimeout(fun) {
  if (cachedSetTimeout === setTimeout) {
    return setTimeout(fun, 0);
  }
  if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
    cachedSetTimeout = setTimeout;
    return setTimeout(fun, 0);
  }
  try {
    return cachedSetTimeout(fun, 0);
  } catch (e) {
    try {
      return cachedSetTimeout.call(null, fun, 0);
    } catch (e2) {
      return cachedSetTimeout.call(this, fun, 0);
    }
  }
}
function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
    return clearTimeout(marker);
  }
  if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
    cachedClearTimeout = clearTimeout;
    return clearTimeout(marker);
  }
  try {
    return cachedClearTimeout(marker);
  } catch (e) {
    try {
      return cachedClearTimeout.call(null, marker);
    } catch (e2) {
      return cachedClearTimeout.call(this, marker);
    }
  }
}
function cleanUpNextTick() {
  if (!draining || !currentQueue) {
    return;
  }
  draining = false;
  if (currentQueue.length) {
    queue = currentQueue.concat(queue);
  } else {
    queueIndex = -1;
  }
  if (queue.length) {
    drainQueue();
  }
}
function drainQueue() {
  if (draining) {
    return;
  }
  var timeout = runTimeout(cleanUpNextTick);
  draining = true;
  var len = queue.length;
  while (len) {
    currentQueue = queue;
    queue = [];
    while (++queueIndex < len) {
      if (currentQueue) {
        currentQueue[queueIndex].run();
      }
    }
    queueIndex = -1;
    len = queue.length;
  }
  currentQueue = null;
  draining = false;
  runClearTimeout(timeout);
}
function nextTick(fun) {
  var args = new Array(arguments.length - 1);
  if (arguments.length > 1) {
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
  }
  queue.push(new Item(fun, args));
  if (queue.length === 1 && !draining) {
    runTimeout(drainQueue);
  }
}
function Item(fun, array) {
  this.fun = fun;
  this.array = array;
}
function noop() {
}
function binding(name) {
  throw new Error("process.binding is not supported");
}
function cwd() {
  return "/";
}
function chdir(dir) {
  throw new Error("process.chdir is not supported");
}
function umask() {
  return 0;
}
function hrtime(previousTimestamp) {
  var clocktime = performanceNow.call(performance) * 1e-3;
  var seconds = Math.floor(clocktime);
  var nanoseconds = Math.floor(clocktime % 1 * 1e9);
  if (previousTimestamp) {
    seconds = seconds - previousTimestamp[0];
    nanoseconds = nanoseconds - previousTimestamp[1];
    if (nanoseconds < 0) {
      seconds--;
      nanoseconds += 1e9;
    }
  }
  return [
    seconds,
    nanoseconds
  ];
}
function uptime() {
  var currentTime = /* @__PURE__ */ new Date();
  var dif = currentTime - startTime;
  return dif / 1e3;
}
function createCommonjsModule(fn, basedir, module) {
  return module = {
    path: basedir,
    exports: {},
    require: function(path, base) {
      return commonjsRequire(path, base === void 0 || base === null ? module.path : base);
    }
  }, fn(module, module.exports), module.exports;
}
function commonjsRequire() {
  throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
}
function setup(env) {
  createDebug.debug = createDebug;
  createDebug.default = createDebug;
  createDebug.coerce = coerce;
  createDebug.disable = disable;
  createDebug.enable = enable;
  createDebug.enabled = enabled;
  createDebug.humanize = ms;
  createDebug.destroy = destroy2;
  Object.keys(env).forEach((key) => {
    createDebug[key] = env[key];
  });
  createDebug.names = [];
  createDebug.skips = [];
  createDebug.formatters = {};
  function selectColor(namespace) {
    let hash = 0;
    for (let i = 0; i < namespace.length; i++) {
      hash = (hash << 5) - hash + namespace.charCodeAt(i);
      hash |= 0;
    }
    return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
  }
  __name(selectColor, "selectColor");
  createDebug.selectColor = selectColor;
  function createDebug(namespace) {
    let prevTime;
    let enableOverride = null;
    let namespacesCache;
    let enabledCache;
    function debug4(...args) {
      if (!debug4.enabled) {
        return;
      }
      const self2 = debug4;
      const curr = Number(/* @__PURE__ */ new Date());
      const ms2 = curr - (prevTime || curr);
      self2.diff = ms2;
      self2.prev = prevTime;
      self2.curr = curr;
      prevTime = curr;
      args[0] = createDebug.coerce(args[0]);
      if (typeof args[0] !== "string") {
        args.unshift("%O");
      }
      let index = 0;
      args[0] = args[0].replace(/%([a-zA-Z%])/g, (match3, format) => {
        if (match3 === "%%") {
          return "%";
        }
        index++;
        const formatter = createDebug.formatters[format];
        if (typeof formatter === "function") {
          const val = args[index];
          match3 = formatter.call(self2, val);
          args.splice(index, 1);
          index--;
        }
        return match3;
      });
      createDebug.formatArgs.call(self2, args);
      const logFn = self2.log || createDebug.log;
      logFn.apply(self2, args);
    }
    __name(debug4, "debug");
    debug4.namespace = namespace;
    debug4.useColors = createDebug.useColors();
    debug4.color = createDebug.selectColor(namespace);
    debug4.extend = extend;
    debug4.destroy = createDebug.destroy;
    Object.defineProperty(debug4, "enabled", {
      enumerable: true,
      configurable: false,
      get: () => {
        if (enableOverride !== null) {
          return enableOverride;
        }
        if (namespacesCache !== createDebug.namespaces) {
          namespacesCache = createDebug.namespaces;
          enabledCache = createDebug.enabled(namespace);
        }
        return enabledCache;
      },
      set: (v) => {
        enableOverride = v;
      }
    });
    if (typeof createDebug.init === "function") {
      createDebug.init(debug4);
    }
    return debug4;
  }
  __name(createDebug, "createDebug");
  function extend(namespace, delimiter) {
    const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
    newDebug.log = this.log;
    return newDebug;
  }
  __name(extend, "extend");
  function enable(namespaces) {
    createDebug.save(namespaces);
    createDebug.namespaces = namespaces;
    createDebug.names = [];
    createDebug.skips = [];
    const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
    for (const ns of split) {
      if (ns[0] === "-") {
        createDebug.skips.push(ns.slice(1));
      } else {
        createDebug.names.push(ns);
      }
    }
  }
  __name(enable, "enable");
  function matchesTemplate(search, template) {
    let searchIndex = 0;
    let templateIndex = 0;
    let starIndex = -1;
    let matchIndex = 0;
    while (searchIndex < search.length) {
      if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
        if (template[templateIndex] === "*") {
          starIndex = templateIndex;
          matchIndex = searchIndex;
          templateIndex++;
        } else {
          searchIndex++;
          templateIndex++;
        }
      } else if (starIndex !== -1) {
        templateIndex = starIndex + 1;
        matchIndex++;
        searchIndex = matchIndex;
      } else {
        return false;
      }
    }
    while (templateIndex < template.length && template[templateIndex] === "*") {
      templateIndex++;
    }
    return templateIndex === template.length;
  }
  __name(matchesTemplate, "matchesTemplate");
  function disable() {
    const namespaces = [
      ...createDebug.names,
      ...createDebug.skips.map((namespace) => "-" + namespace)
    ].join(",");
    createDebug.enable("");
    return namespaces;
  }
  __name(disable, "disable");
  function enabled(name) {
    for (const skip of createDebug.skips) {
      if (matchesTemplate(name, skip)) {
        return false;
      }
    }
    for (const ns of createDebug.names) {
      if (matchesTemplate(name, ns)) {
        return true;
      }
    }
    return false;
  }
  __name(enabled, "enabled");
  function coerce(val) {
    if (val instanceof Error) {
      return val.stack || val.message;
    }
    return val;
  }
  __name(coerce, "coerce");
  function destroy2() {
    console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
  }
  __name(destroy2, "destroy2");
  createDebug.enable(createDebug.load());
  return createDebug;
}
function toGrammyError(err, method, payload) {
  switch (err.error_code) {
    case 401:
      debug("Error 401 means that your bot token is wrong, talk to https://t.me/BotFather to check it.");
      break;
    case 409:
      debug("Error 409 means that you are running your bot several times on long polling. Consider revoking the bot token if you believe that no other instance is running.");
      break;
  }
  return new GrammyError(`Call to '${method}' failed!`, err, method, payload);
}
function isTelegramError(err) {
  return typeof err === "object" && err !== null && "status" in err && "statusText" in err;
}
function toHttpError(method, sensitiveLogs) {
  return (err) => {
    let msg = `Network request for '${method}' failed!`;
    if (isTelegramError(err))
      msg += ` (${err.status}: ${err.statusText})`;
    if (sensitiveLogs && err instanceof Error)
      msg += ` ${err.message}`;
    throw new HttpError(msg, err);
  };
}
function checkWindows() {
  const global = globalThis;
  const os = global.Deno?.build?.os;
  return typeof os === "string" ? os === "windows" : global.navigator?.platform?.startsWith("Win") ?? global.process?.platform?.startsWith("win") ?? false;
}
function assertPath(path) {
  if (typeof path !== "string") {
    throw new TypeError(`Path must be a string, received "${JSON.stringify(path)}"`);
  }
}
function stripSuffix(name, suffix) {
  if (suffix.length >= name.length) {
    return name;
  }
  const lenDiff = name.length - suffix.length;
  for (let i = suffix.length - 1; i >= 0; --i) {
    if (name.charCodeAt(lenDiff + i) !== suffix.charCodeAt(i)) {
      return name;
    }
  }
  return name.slice(0, -suffix.length);
}
function lastPathSegment(path, isSep, start = 0) {
  let matchedNonSeparator = false;
  let end = path.length;
  for (let i = path.length - 1; i >= start; --i) {
    if (isSep(path.charCodeAt(i))) {
      if (matchedNonSeparator) {
        start = i + 1;
        break;
      }
    } else if (!matchedNonSeparator) {
      matchedNonSeparator = true;
      end = i + 1;
    }
  }
  return path.slice(start, end);
}
function assertArgs(path, suffix) {
  assertPath(path);
  if (path.length === 0)
    return path;
  if (typeof suffix !== "string") {
    throw new TypeError(`Suffix must be a string, received "${JSON.stringify(suffix)}"`);
  }
}
function assertArg(url) {
  url = url instanceof URL ? url : new URL(url);
  if (url.protocol !== "file:") {
    throw new TypeError(`URL must be a file URL: received "${url.protocol}"`);
  }
  return url;
}
function fromFileUrl(url) {
  url = assertArg(url);
  return decodeURIComponent(url.pathname.replace(/%(?![0-9A-Fa-f]{2})/g, "%25"));
}
function stripTrailingSeparators(segment, isSep) {
  if (segment.length <= 1) {
    return segment;
  }
  let end = segment.length;
  for (let i = segment.length - 1; i > 0; i--) {
    if (isSep(segment.charCodeAt(i))) {
      end = i;
    } else {
      break;
    }
  }
  return segment.slice(0, end);
}
function isPosixPathSeparator(code) {
  return code === 47;
}
function basename(path, suffix = "") {
  if (path instanceof URL) {
    path = fromFileUrl(path);
  }
  assertArgs(path, suffix);
  const lastSegment = lastPathSegment(path, isPosixPathSeparator);
  const strippedSegment = stripTrailingSeparators(lastSegment, isPosixPathSeparator);
  return suffix ? stripSuffix(strippedSegment, suffix) : strippedSegment;
}
function isPathSeparator(code) {
  return code === 47 || code === 92;
}
function isWindowsDeviceRoot(code) {
  return code >= 97 && code <= 122 || code >= 65 && code <= 90;
}
function fromFileUrl1(url) {
  url = assertArg(url);
  let path = decodeURIComponent(url.pathname.replace(/\//g, "\\").replace(/%(?![0-9A-Fa-f]{2})/g, "%25")).replace(/^\\*([A-Za-z]:)(\\|$)/, "$1\\");
  if (url.hostname !== "") {
    path = `\\\\${url.hostname}${path}`;
  }
  return path;
}
function basename1(path, suffix = "") {
  if (path instanceof URL) {
    path = fromFileUrl1(path);
  }
  assertArgs(path, suffix);
  let start = 0;
  if (path.length >= 2) {
    const drive = path.charCodeAt(0);
    if (isWindowsDeviceRoot(drive)) {
      if (path.charCodeAt(1) === 58)
        start = 2;
    }
  }
  const lastSegment = lastPathSegment(path, isPathSeparator, start);
  const strippedSegment = stripTrailingSeparators(lastSegment, isPathSeparator);
  return suffix ? stripSuffix(strippedSegment, suffix) : strippedSegment;
}
function basename2(path, suffix = "") {
  return isWindows ? basename1(path, suffix) : basename(path, suffix);
}
async function* fetchFile(url) {
  const { body } = await fetch(url);
  if (body === null) {
    throw new Error(`Download failed, no response body from '${url}'`);
  }
  yield* body;
}
function requiresFormDataUpload(payload) {
  return payload instanceof InputFile || typeof payload === "object" && payload !== null && Object.values(payload).some((v) => Array.isArray(v) ? v.some(requiresFormDataUpload) : v instanceof InputFile || requiresFormDataUpload(v));
}
function str(value) {
  return JSON.stringify(value, (_, v) => v ?? void 0);
}
function createJsonPayload(payload) {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      connection: "keep-alive"
    },
    body: str(payload)
  };
}
async function* protectItr(itr, onError) {
  try {
    yield* itr;
  } catch (err) {
    onError(err);
  }
}
function createFormDataPayload(payload, onError) {
  const boundary = createBoundary();
  const itr = payloadToMultipartItr(payload, boundary);
  const safeItr = protectItr(itr, onError);
  const stream = itrToStream(safeItr);
  return {
    method: "POST",
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
      connection: "keep-alive"
    },
    body: stream
  };
}
function createBoundary() {
  return "----------" + randomId(32);
}
function randomId(length = 16) {
  return Array.from(Array(length)).map(() => Math.random().toString(36)[2] || 0).join("");
}
async function* payloadToMultipartItr(payload, boundary) {
  const files = extractFiles(payload);
  yield enc.encode(`--${boundary}\r
`);
  const separator = enc.encode(`\r
--${boundary}\r
`);
  let first = true;
  for (const [key, value] of Object.entries(payload)) {
    if (value == null)
      continue;
    if (!first)
      yield separator;
    yield valuePart(key, typeof value === "object" ? str(value) : value);
    first = false;
  }
  for (const { id, origin, file } of files) {
    if (!first)
      yield separator;
    yield* filePart(id, origin, file);
    first = false;
  }
  yield enc.encode(`\r
--${boundary}--\r
`);
}
function extractFiles(value) {
  if (typeof value !== "object" || value === null)
    return [];
  return Object.entries(value).flatMap(([k, v]) => {
    if (Array.isArray(v))
      return v.flatMap((p) => extractFiles(p));
    else if (v instanceof InputFile) {
      const id = randomId();
      Object.assign(value, {
        [k]: `attach://${id}`
      });
      const origin = k === "media" && "type" in value && typeof value.type === "string" ? value.type : k;
      return {
        id,
        origin,
        file: v
      };
    } else
      return extractFiles(v);
  });
}
function valuePart(key, value) {
  return enc.encode(`content-disposition:form-data;name="${key}"\r
\r
${value}`);
}
async function* filePart(id, origin, input) {
  const filename = input.filename || `${origin}.${getExt(origin)}`;
  if (filename.includes("\r") || filename.includes("\n")) {
    throw new Error(`File paths cannot contain carriage-return (\\r) or newline (\\n) characters! Filename for property '${origin}' was:
"""
${filename}
"""`);
  }
  yield enc.encode(`content-disposition:form-data;name="${id}";filename=${filename}\r
content-type:application/octet-stream\r
\r
`);
  const data = await input.toRaw();
  if (data instanceof Uint8Array)
    yield data;
  else
    yield* data;
}
function getExt(key) {
  switch (key) {
    case "certificate":
      return "pem";
    case "photo":
    case "thumbnail":
      return "jpg";
    case "voice":
      return "ogg";
    case "audio":
      return "mp3";
    case "animation":
    case "video":
    case "video_note":
      return "mp4";
    case "sticker":
      return "webp";
    default:
      return "dat";
  }
}
function concatTransformer(prev, trans) {
  return (method, payload, signal) => trans(prev, method, payload, signal);
}
function createRawApi(token, options, webhookReplyEnvelope) {
  const client = new ApiClient(token, options, webhookReplyEnvelope);
  const proxyHandler = {
    get(_, m2) {
      return m2 === "toJSON" ? "__internal" : m2 === "getMe" || m2 === "getWebhookInfo" || m2 === "getForumTopicIconStickers" || m2 === "getAvailableGifts" || m2 === "logOut" || m2 === "close" || m2 === "getMyStarBalance" ? client.callApi.bind(client, m2, {}) : client.callApi.bind(client, m2);
    },
    ...proxyMethods
  };
  const raw2 = new Proxy({}, proxyHandler);
  const installedTransformers = client.installedTransformers;
  const api = {
    raw: raw2,
    installedTransformers,
    use: (...t) => {
      client.use(...t);
      return api;
    }
  };
  return api;
}
function createTimeout(controller, seconds, method) {
  let handle = void 0;
  const promise = new Promise((_, reject) => {
    handle = setTimeout(() => {
      const msg = `Request to '${method}' timed out after ${seconds} seconds`;
      reject(new Error(msg));
      controller.abort();
    }, 1e3 * seconds);
  });
  return {
    promise,
    handle
  };
}
function createStreamError(abortController) {
  let onError = /* @__PURE__ */ __name((err) => {
    throw err;
  }, "onError");
  const promise = new Promise((_, reject) => {
    onError = /* @__PURE__ */ __name((err) => {
      reject(err);
      abortController.abort();
    }, "onError");
  });
  return {
    promise,
    catch: onError
  };
}
function createAbortControllerFromSignal(signal) {
  const abortController = new AbortController();
  if (signal === void 0)
    return abortController;
  const sig = signal;
  function abort() {
    abortController.abort();
    sig.removeEventListener("abort", abort);
  }
  __name(abort, "abort");
  if (sig.aborted)
    abort();
  else
    sig.addEventListener("abort", abort);
  return {
    abort,
    signal: abortController.signal
  };
}
function validateSignal(method, payload, signal) {
  if (typeof signal?.addEventListener === "function") {
    return;
  }
  let payload0 = JSON.stringify(payload);
  if (payload0.length > 20) {
    payload0 = payload0.substring(0, 16) + " ...";
  }
  let payload1 = JSON.stringify(signal);
  if (payload1.length > 20) {
    payload1 = payload1.substring(0, 16) + " ...";
  }
  throw new Error(`Incorrect abort signal instance found! You passed two payloads to '${method}' but you should merge the second one containing '${payload1}' into the first one containing '${payload0}'! If you are using context shortcuts, you may want to use a method on 'ctx.api' instead.

If you want to prevent such mistakes in the future, consider using TypeScript. https://www.typescriptlang.org/`);
}
async function withRetries(task, signal) {
  const INITIAL_DELAY = 50;
  let lastDelay = 50;
  async function handleError(error) {
    let delay2 = false;
    let strategy = "rethrow";
    if (error instanceof HttpError) {
      delay2 = true;
      strategy = "retry";
    } else if (error instanceof GrammyError) {
      if (error.error_code >= 500) {
        delay2 = true;
        strategy = "retry";
      } else if (error.error_code === 429) {
        const retryAfter = error.parameters.retry_after;
        if (typeof retryAfter === "number") {
          await sleep(retryAfter, signal);
          lastDelay = INITIAL_DELAY;
        } else {
          delay2 = true;
        }
        strategy = "retry";
      }
    }
    if (delay2) {
      if (lastDelay !== 50) {
        await sleep(lastDelay, signal);
      }
      const TWENTY_MINUTES = 20 * 60 * 1e3;
      lastDelay = Math.min(TWENTY_MINUTES, 2 * lastDelay);
    }
    return strategy;
  }
  __name(handleError, "handleError");
  let result = {
    ok: false
  };
  while (!result.ok) {
    try {
      result = {
        ok: true,
        value: await task()
      };
    } catch (error) {
      debugErr(error);
      const strategy = await handleError(error);
      switch (strategy) {
        case "retry":
          continue;
        case "rethrow":
          throw error;
      }
    }
  }
  return result.value;
}
async function sleep(seconds, signal) {
  let handle;
  let reject;
  function abort() {
    reject?.(new Error("Aborted delay"));
    if (handle !== void 0)
      clearTimeout(handle);
  }
  __name(abort, "abort");
  try {
    await new Promise((res, rej) => {
      reject = rej;
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener("abort", abort);
      handle = setTimeout(res, 1e3 * seconds);
    });
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}
function validateAllowedUpdates(updates, allowed = DEFAULT_UPDATE_TYPES) {
  const impossible = Array.from(updates).filter((u) => !allowed.includes(u));
  if (impossible.length > 0) {
    debugWarn(`You registered listeners for the following update types, but you did not specify them in \`allowed_updates\` so they may not be received: ${impossible.map((u) => `'${u}'`).join(", ")}`);
  }
}
function noUseFunction() {
  throw new Error(`It looks like you are registering more listeners on your bot from within other listeners! This means that every time your bot handles a message like this one, new listeners will be added. This list grows until your machine crashes, so grammY throws this error to tell you that you should probably do things a bit differently. If you're unsure how to resolve this problem, you can ask in the group chat: https://telegram.me/grammyjs

On the other hand, if you actually know what you're doing and you do need to install further middleware while your bot is running, consider installing a composer instance on your bot, and in turn augment the composer after the fact. This way, you can circumvent this protection against memory leaks.`);
}
function inputMessage(queryTemplate) {
  return {
    ...queryTemplate,
    ...inputMessageMethods(queryTemplate)
  };
}
function inputMessageMethods(queryTemplate) {
  return {
    text(message_text, options = {}) {
      const content = {
        message_text,
        ...options
      };
      return {
        ...queryTemplate,
        input_message_content: content
      };
    },
    location(latitude, longitude, options = {}) {
      const content = {
        latitude,
        longitude,
        ...options
      };
      return {
        ...queryTemplate,
        input_message_content: content
      };
    },
    venue(title2, latitude, longitude, address, options) {
      const content = {
        title: title2,
        latitude,
        longitude,
        address,
        ...options
      };
      return {
        ...queryTemplate,
        input_message_content: content
      };
    },
    contact(first_name, phone_number, options = {}) {
      const content = {
        first_name,
        phone_number,
        ...options
      };
      return {
        ...queryTemplate,
        input_message_content: content
      };
    },
    invoice(title2, description, payload, provider_token, currency, prices, options = {}) {
      const content = {
        title: title2,
        description,
        payload,
        provider_token,
        currency,
        prices,
        ...options
      };
      return {
        ...queryTemplate,
        input_message_content: content
      };
    }
  };
}
function transpose(grid) {
  const transposed = [];
  for (let i = 0; i < grid.length; i++) {
    const row = grid[i];
    for (let j = 0; j < row.length; j++) {
      const button = row[j];
      (transposed[j] ??= []).push(button);
    }
  }
  return transposed;
}
function reflow(grid, columns, { fillLastRow = false }) {
  let first = columns;
  if (fillLastRow) {
    const buttonCount = grid.map((row) => row.length).reduce((a, b) => a + b, 0);
    first = buttonCount % columns;
  }
  const reflowed = [];
  for (const row of grid) {
    for (const button of row) {
      const at = Math.max(0, reflowed.length - 1);
      const max = at === 0 ? first : columns;
      let next = reflowed[at] ??= [];
      if (next.length === max) {
        next = [];
        reflowed.push(next);
      }
      next.push(button);
    }
  }
  return reflowed;
}
function session(options = {}) {
  return options.type === "multi" ? strictMultiSession(options) : strictSingleSession(options);
}
function strictSingleSession(options) {
  const { initial, storage, getSessionKey, custom } = fillDefaults(options);
  return async (ctx, next) => {
    const propSession = new PropertySession(storage, ctx, "session", initial);
    const key = await getSessionKey(ctx);
    await propSession.init(key, {
      custom,
      lazy: false
    });
    await next();
    await propSession.finish();
  };
}
function strictMultiSession(options) {
  const props = Object.keys(options).filter((k) => k !== "type");
  const defaults = Object.fromEntries(props.map((prop) => [
    prop,
    fillDefaults(options[prop])
  ]));
  return async (ctx, next) => {
    ctx.session = {};
    const propSessions = await Promise.all(props.map(async (prop) => {
      const { initial, storage, getSessionKey, custom } = defaults[prop];
      const s2 = new PropertySession(storage, ctx.session, prop, initial);
      const key = await getSessionKey(ctx);
      await s2.init(key, {
        custom,
        lazy: false
      });
      return s2;
    }));
    await next();
    if (ctx.session == null)
      propSessions.forEach((s2) => s2.delete());
    await Promise.all(propSessions.map((s2) => s2.finish()));
  };
}
function lazySession(options = {}) {
  if (options.type !== void 0 && options.type !== "single") {
    throw new Error("Cannot use lazy multi sessions!");
  }
  const { initial, storage, getSessionKey, custom } = fillDefaults(options);
  return async (ctx, next) => {
    const propSession = new PropertySession(storage, ctx, "session", initial);
    const key = await getSessionKey(ctx);
    await propSession.init(key, {
      custom,
      lazy: true
    });
    await next();
    await propSession.finish();
  };
}
function fillDefaults(opts = {}) {
  let { prefix = "", getSessionKey = defaultGetSessionKey, initial, storage } = opts;
  if (storage == null) {
    debug3("Storing session data in memory, all data will be lost when the bot restarts.");
    storage = new MemorySessionStorage();
  }
  const custom = getSessionKey !== defaultGetSessionKey;
  return {
    initial,
    storage,
    getSessionKey: async (ctx) => {
      const key = await getSessionKey(ctx);
      return key === void 0 ? void 0 : prefix + key;
    },
    custom
  };
}
function defaultGetSessionKey(ctx) {
  return ctx.chatId?.toString();
}
function undef(op, opts) {
  const { lazy = false, custom } = opts;
  const reason = custom ? "the custom `getSessionKey` function returned undefined for this update" : "this update does not belong to a chat, so the session key is undefined";
  return `Cannot ${op} ${lazy ? "lazy " : ""}session data because ${reason}!`;
}
function isEnhance(value) {
  return value === void 0 || typeof value === "object" && value !== null && "__d" in value;
}
function enhanceStorage(options) {
  let { storage, millisecondsToLive, migrations } = options;
  storage = compatStorage(storage);
  if (millisecondsToLive !== void 0) {
    storage = timeoutStorage(storage, millisecondsToLive);
  }
  if (migrations !== void 0) {
    storage = migrationStorage(storage, migrations);
  }
  return wrapStorage(storage);
}
function compatStorage(storage) {
  return {
    read: async (k) => {
      const v = await storage.read(k);
      return isEnhance(v) ? v : {
        __d: v
      };
    },
    write: (k, v) => storage.write(k, v),
    delete: (k) => storage.delete(k)
  };
}
function timeoutStorage(storage, millisecondsToLive) {
  const ttlStorage = {
    read: async (k) => {
      const value = await storage.read(k);
      if (value === void 0)
        return void 0;
      if (value.e === void 0) {
        await ttlStorage.write(k, value);
        return value;
      }
      if (value.e < Date.now()) {
        await ttlStorage.delete(k);
        return void 0;
      }
      return value;
    },
    write: async (k, v) => {
      v.e = addExpiryDate(v, millisecondsToLive).expires;
      await storage.write(k, v);
    },
    delete: (k) => storage.delete(k)
  };
  return ttlStorage;
}
function migrationStorage(storage, migrations) {
  const versions2 = Object.keys(migrations).map((v) => parseInt(v)).sort((a, b) => a - b);
  const count = versions2.length;
  if (count === 0)
    throw new Error("No migrations given!");
  const earliest = versions2[0];
  const last = count - 1;
  const latest = versions2[last];
  const index = /* @__PURE__ */ new Map();
  versions2.forEach((v, i) => index.set(v, i));
  function nextAfter(current) {
    let i = last;
    while (current <= versions2[i])
      i--;
    return i;
  }
  __name(nextAfter, "nextAfter");
  return {
    read: async (k) => {
      const val = await storage.read(k);
      if (val === void 0)
        return val;
      let { __d: value, v: current = earliest - 1 } = val;
      let i = 1 + (index.get(current) ?? nextAfter(current));
      for (; i < count; i++)
        value = migrations[versions2[i]](value);
      return {
        ...val,
        v: latest,
        __d: value
      };
    },
    write: (k, v) => storage.write(k, {
      v: latest,
      ...v
    }),
    delete: (k) => storage.delete(k)
  };
}
function wrapStorage(storage) {
  return {
    read: (k) => Promise.resolve(storage.read(k)).then((v) => v?.__d),
    write: (k, v) => storage.write(k, {
      __d: v
    }),
    delete: (k) => storage.delete(k)
  };
}
function addExpiryDate(value, ttl) {
  if (ttl !== void 0 && ttl < Infinity) {
    const now = Date.now();
    return {
      session: value,
      expires: now + ttl
    };
  } else {
    return {
      session: value
    };
  }
}
function webhookCallback(bot, adapter = defaultAdapter, onTimeout, timeoutMilliseconds, secretToken) {
  if (bot.isRunning()) {
    throw new Error("Bot is already running via long polling, the webhook setup won't receive any updates!");
  } else {
    bot.start = () => {
      throw new Error("You already started the bot via webhooks, calling `bot.start()` starts the bot with long polling and this will prevent your webhook setup from receiving any updates!");
    };
  }
  const { onTimeout: timeout = "throw", timeoutMilliseconds: ms2 = 1e4, secretToken: token } = typeof onTimeout === "object" ? onTimeout : {
    onTimeout,
    timeoutMilliseconds,
    secretToken
  };
  let initialized = false;
  const server = typeof adapter === "string" ? adapters1[adapter] : adapter;
  return async (...args) => {
    const handler = server(...args);
    if (!initialized) {
      await bot.init();
      initialized = true;
    }
    if (handler.header !== token) {
      await handler.unauthorized();
      return handler.handlerReturn;
    }
    let usedWebhookReply = false;
    const webhookReplyEnvelope = {
      async send(json) {
        usedWebhookReply = true;
        await handler.respond(json);
      }
    };
    await timeoutIfNecessary(bot.handleUpdate(await handler.update, webhookReplyEnvelope), typeof timeout === "function" ? () => timeout(...args) : timeout, ms2);
    if (!usedWebhookReply)
      handler.end?.();
    return handler.handlerReturn;
  };
}
function timeoutIfNecessary(task, onTimeout, timeout) {
  if (timeout === Infinity)
    return task;
  return new Promise((resolve, reject) => {
    const handle = setTimeout(() => {
      debugErr1(`Request timed out after ${timeout} ms`);
      if (onTimeout === "throw") {
        reject(new Error(`Request timed out after ${timeout} ms`));
      } else {
        if (typeof onTimeout === "function")
          onTimeout();
        resolve();
      }
      const now = Date.now();
      task.finally(() => {
        const diff = Date.now() - now;
        debugErr1(`Request completed ${diff} ms after timeout!`);
      });
    }, timeout);
    task.then(resolve).catch(reject).finally(() => clearTimeout(handle));
  });
}
var filterQueryCache, ENTITY_KEYS, USER_KEYS, FORWARD_ORIGIN_KEYS, STICKER_KEYS, REACTION_KEYS, COMMON_MESSAGE_KEYS, MESSAGE_KEYS, CHANNEL_POST_KEYS, BUSINESS_CONNECTION_KEYS, MESSAGE_REACTION_KEYS, MESSAGE_REACTION_COUNT_UPDATED_KEYS, CALLBACK_QUERY_KEYS, CHAT_MEMBER_UPDATED_KEYS, UPDATE_KEYS, L1_SHORTCUTS, L2_SHORTCUTS, checker, _Context, Context, BotError, leaf1, Composer, s, m, h, d, w, y, ms, cachedSetTimeout, cachedClearTimeout, globalContext, queue, draining, currentQueue, queueIndex, title, platform, browser, argv, version, versions, release, config, on, addListener, once, off, removeListener, removeAllListeners, emit, performance, performanceNow, startTime, process2, common, browser$1, itrToStream, baseFetchConfig, defaultAdapter, debug, GrammyError, HttpError, isWindows, InputFile, enc, debug1, ApiClient, defaultBuildUrl, proxyMethods, Api, debug2, debugWarn, debugErr, DEFAULT_UPDATE_TYPES, Bot, ALL_UPDATE_TYPES, ALL_CHAT_PERMISSIONS, API_CONSTANTS, InlineQueryResultBuilder, InputMediaBuilder, Keyboard, InlineKeyboard, debug3, PropertySession, MemorySessionStorage, SECRET_HEADER, SECRET_HEADER_LOWERCASE, WRONG_TOKEN_ERROR, ok, okJson, unauthorized, awsLambda, awsLambdaAsync, azure, azureV4, bun, cloudflare, cloudflareModule, express, fastify, hono, http, koa, nextJs, nhttp, oak, serveHttp, stdHttp, sveltekit, worktop, elysia, adapters, debugErr1, callbackAdapter, adapters1;
var init_web = __esm({
  "node_modules/grammy/out/web.mjs"() {
    filterQueryCache = /* @__PURE__ */ new Map();
    __name(matchFilter, "matchFilter");
    __name(parse, "parse");
    __name(compile, "compile");
    __name(preprocess, "preprocess");
    __name(check, "check");
    __name(checkOne, "checkOne");
    __name(treeify, "treeify");
    __name(or, "or");
    __name(concat, "concat");
    __name(leaf, "leaf");
    __name(arborist, "arborist");
    __name(testMaybeArray, "testMaybeArray");
    ENTITY_KEYS = {
      mention: {},
      hashtag: {},
      cashtag: {},
      bot_command: {},
      url: {},
      email: {},
      phone_number: {},
      bold: {},
      italic: {},
      underline: {},
      strikethrough: {},
      spoiler: {},
      blockquote: {},
      expandable_blockquote: {},
      code: {},
      pre: {},
      text_link: {},
      text_mention: {},
      custom_emoji: {}
    };
    USER_KEYS = {
      me: {},
      is_bot: {},
      is_premium: {},
      added_to_attachment_menu: {}
    };
    FORWARD_ORIGIN_KEYS = {
      user: {},
      hidden_user: {},
      chat: {},
      channel: {}
    };
    STICKER_KEYS = {
      is_video: {},
      is_animated: {},
      premium_animation: {}
    };
    REACTION_KEYS = {
      emoji: {},
      custom_emoji: {},
      paid: {}
    };
    COMMON_MESSAGE_KEYS = {
      forward_origin: FORWARD_ORIGIN_KEYS,
      is_topic_message: {},
      is_automatic_forward: {},
      business_connection_id: {},
      text: {},
      animation: {},
      audio: {},
      document: {},
      paid_media: {},
      photo: {},
      sticker: STICKER_KEYS,
      story: {},
      video: {},
      video_note: {},
      voice: {},
      contact: {},
      dice: {},
      game: {},
      poll: {},
      venue: {},
      location: {},
      entities: ENTITY_KEYS,
      caption_entities: ENTITY_KEYS,
      caption: {},
      link_preview_options: {
        url: {},
        prefer_small_media: {},
        prefer_large_media: {},
        show_above_text: {}
      },
      effect_id: {},
      paid_star_count: {},
      has_media_spoiler: {},
      new_chat_title: {},
      new_chat_photo: {},
      delete_chat_photo: {},
      message_auto_delete_timer_changed: {},
      pinned_message: {},
      invoice: {},
      proximity_alert_triggered: {},
      chat_background_set: {},
      giveaway_created: {},
      giveaway: {
        only_new_members: {},
        has_public_winners: {}
      },
      giveaway_winners: {
        only_new_members: {},
        was_refunded: {}
      },
      giveaway_completed: {},
      gift: {},
      unique_gift: {},
      paid_message_price_changed: {},
      video_chat_scheduled: {},
      video_chat_started: {},
      video_chat_ended: {},
      video_chat_participants_invited: {},
      web_app_data: {}
    };
    MESSAGE_KEYS = {
      ...COMMON_MESSAGE_KEYS,
      direct_messages_topic: {},
      new_chat_members: USER_KEYS,
      left_chat_member: USER_KEYS,
      group_chat_created: {},
      supergroup_chat_created: {},
      migrate_to_chat_id: {},
      migrate_from_chat_id: {},
      successful_payment: {},
      refunded_payment: {},
      users_shared: {},
      chat_shared: {},
      connected_website: {},
      write_access_allowed: {},
      passport_data: {},
      boost_added: {},
      forum_topic_created: {},
      forum_topic_edited: {
        name: {},
        icon_custom_emoji_id: {}
      },
      forum_topic_closed: {},
      forum_topic_reopened: {},
      general_forum_topic_hidden: {},
      general_forum_topic_unhidden: {},
      checklist: {
        others_can_add_tasks: {},
        others_can_mark_tasks_as_done: {}
      },
      checklist_tasks_done: {},
      checklist_tasks_added: {},
      suggested_post_info: {},
      suggested_post_approved: {},
      suggested_post_approval_failed: {},
      suggested_post_declined: {},
      suggested_post_paid: {},
      suggested_post_refunded: {},
      sender_boost_count: {}
    };
    CHANNEL_POST_KEYS = {
      ...COMMON_MESSAGE_KEYS,
      channel_chat_created: {},
      direct_message_price_changed: {},
      is_paid_post: {}
    };
    BUSINESS_CONNECTION_KEYS = {
      can_reply: {},
      is_enabled: {}
    };
    MESSAGE_REACTION_KEYS = {
      old_reaction: REACTION_KEYS,
      new_reaction: REACTION_KEYS
    };
    MESSAGE_REACTION_COUNT_UPDATED_KEYS = {
      reactions: REACTION_KEYS
    };
    CALLBACK_QUERY_KEYS = {
      data: {},
      game_short_name: {}
    };
    CHAT_MEMBER_UPDATED_KEYS = {
      from: USER_KEYS
    };
    UPDATE_KEYS = {
      message: MESSAGE_KEYS,
      edited_message: MESSAGE_KEYS,
      channel_post: CHANNEL_POST_KEYS,
      edited_channel_post: CHANNEL_POST_KEYS,
      business_connection: BUSINESS_CONNECTION_KEYS,
      business_message: MESSAGE_KEYS,
      edited_business_message: MESSAGE_KEYS,
      deleted_business_messages: {},
      inline_query: {},
      chosen_inline_result: {},
      callback_query: CALLBACK_QUERY_KEYS,
      shipping_query: {},
      pre_checkout_query: {},
      poll: {},
      poll_answer: {},
      my_chat_member: CHAT_MEMBER_UPDATED_KEYS,
      chat_member: CHAT_MEMBER_UPDATED_KEYS,
      chat_join_request: {},
      message_reaction: MESSAGE_REACTION_KEYS,
      message_reaction_count: MESSAGE_REACTION_COUNT_UPDATED_KEYS,
      chat_boost: {},
      removed_chat_boost: {},
      purchased_paid_media: {}
    };
    L1_SHORTCUTS = {
      "": [
        "message",
        "channel_post"
      ],
      msg: [
        "message",
        "channel_post"
      ],
      edit: [
        "edited_message",
        "edited_channel_post"
      ]
    };
    L2_SHORTCUTS = {
      "": [
        "entities",
        "caption_entities"
      ],
      media: [
        "photo",
        "video"
      ],
      file: [
        "photo",
        "animation",
        "audio",
        "document",
        "video",
        "video_note",
        "voice",
        "sticker"
      ]
    };
    checker = {
      filterQuery(filter) {
        const pred = matchFilter(filter);
        return (ctx) => pred(ctx);
      },
      text(trigger) {
        const hasText = checker.filterQuery([
          ":text",
          ":caption"
        ]);
        const trg = triggerFn(trigger);
        return (ctx) => {
          if (!hasText(ctx))
            return false;
          const msg = ctx.message ?? ctx.channelPost;
          const txt = msg.text ?? msg.caption;
          return match(ctx, txt, trg);
        };
      },
      command(command) {
        const hasEntities = checker.filterQuery(":entities:bot_command");
        const atCommands = /* @__PURE__ */ new Set();
        const noAtCommands = /* @__PURE__ */ new Set();
        toArray(command).forEach((cmd) => {
          if (cmd.startsWith("/")) {
            throw new Error(`Do not include '/' when registering command handlers (use '${cmd.substring(1)}' not '${cmd}')`);
          }
          const set = cmd.includes("@") ? atCommands : noAtCommands;
          set.add(cmd);
        });
        return (ctx) => {
          if (!hasEntities(ctx))
            return false;
          const msg = ctx.message ?? ctx.channelPost;
          const txt = msg.text ?? msg.caption;
          return msg.entities.some((e) => {
            if (e.type !== "bot_command")
              return false;
            if (e.offset !== 0)
              return false;
            const cmd = txt.substring(1, e.length);
            if (noAtCommands.has(cmd) || atCommands.has(cmd)) {
              ctx.match = txt.substring(cmd.length + 1).trimStart();
              return true;
            }
            const index = cmd.indexOf("@");
            if (index === -1)
              return false;
            const atTarget = cmd.substring(index + 1).toLowerCase();
            const username = ctx.me.username.toLowerCase();
            if (atTarget !== username)
              return false;
            const atCommand = cmd.substring(0, index);
            if (noAtCommands.has(atCommand)) {
              ctx.match = txt.substring(cmd.length + 1).trimStart();
              return true;
            }
            return false;
          });
        };
      },
      reaction(reaction) {
        const hasMessageReaction = checker.filterQuery("message_reaction");
        const normalized = typeof reaction === "string" ? [
          {
            type: "emoji",
            emoji: reaction
          }
        ] : (Array.isArray(reaction) ? reaction : [
          reaction
        ]).map((emoji2) => typeof emoji2 === "string" ? {
          type: "emoji",
          emoji: emoji2
        } : emoji2);
        const emoji = new Set(normalized.filter((r) => r.type === "emoji").map((r) => r.emoji));
        const customEmoji = new Set(normalized.filter((r) => r.type === "custom_emoji").map((r) => r.custom_emoji_id));
        const paid = normalized.some((r) => r.type === "paid");
        return (ctx) => {
          if (!hasMessageReaction(ctx))
            return false;
          const { old_reaction, new_reaction } = ctx.messageReaction;
          for (const reaction2 of new_reaction) {
            let isOld = false;
            if (reaction2.type === "emoji") {
              for (const old of old_reaction) {
                if (old.type !== "emoji")
                  continue;
                if (old.emoji === reaction2.emoji) {
                  isOld = true;
                  break;
                }
              }
            } else if (reaction2.type === "custom_emoji") {
              for (const old of old_reaction) {
                if (old.type !== "custom_emoji")
                  continue;
                if (old.custom_emoji_id === reaction2.custom_emoji_id) {
                  isOld = true;
                  break;
                }
              }
            } else if (reaction2.type === "paid") {
              for (const old of old_reaction) {
                if (old.type !== "paid")
                  continue;
                isOld = true;
                break;
              }
            } else {
            }
            if (isOld)
              continue;
            if (reaction2.type === "emoji") {
              if (emoji.has(reaction2.emoji))
                return true;
            } else if (reaction2.type === "custom_emoji") {
              if (customEmoji.has(reaction2.custom_emoji_id))
                return true;
            } else if (reaction2.type === "paid") {
              if (paid)
                return true;
            } else {
              return true;
            }
          }
          return false;
        };
      },
      chatType(chatType) {
        const set = new Set(toArray(chatType));
        return (ctx) => ctx.chat?.type !== void 0 && set.has(ctx.chat.type);
      },
      callbackQuery(trigger) {
        const hasCallbackQuery = checker.filterQuery("callback_query:data");
        const trg = triggerFn(trigger);
        return (ctx) => hasCallbackQuery(ctx) && match(ctx, ctx.callbackQuery.data, trg);
      },
      gameQuery(trigger) {
        const hasGameQuery = checker.filterQuery("callback_query:game_short_name");
        const trg = triggerFn(trigger);
        return (ctx) => hasGameQuery(ctx) && match(ctx, ctx.callbackQuery.game_short_name, trg);
      },
      inlineQuery(trigger) {
        const hasInlineQuery = checker.filterQuery("inline_query");
        const trg = triggerFn(trigger);
        return (ctx) => hasInlineQuery(ctx) && match(ctx, ctx.inlineQuery.query, trg);
      },
      chosenInlineResult(trigger) {
        const hasChosenInlineResult = checker.filterQuery("chosen_inline_result");
        const trg = triggerFn(trigger);
        return (ctx) => hasChosenInlineResult(ctx) && match(ctx, ctx.chosenInlineResult.result_id, trg);
      },
      preCheckoutQuery(trigger) {
        const hasPreCheckoutQuery = checker.filterQuery("pre_checkout_query");
        const trg = triggerFn(trigger);
        return (ctx) => hasPreCheckoutQuery(ctx) && match(ctx, ctx.preCheckoutQuery.invoice_payload, trg);
      },
      shippingQuery(trigger) {
        const hasShippingQuery = checker.filterQuery("shipping_query");
        const trg = triggerFn(trigger);
        return (ctx) => hasShippingQuery(ctx) && match(ctx, ctx.shippingQuery.invoice_payload, trg);
      }
    };
    _Context = class {
      update;
      api;
      me;
      match;
      constructor(update, api, me) {
        this.update = update;
        this.api = api;
        this.me = me;
      }
      get message() {
        return this.update.message;
      }
      get editedMessage() {
        return this.update.edited_message;
      }
      get channelPost() {
        return this.update.channel_post;
      }
      get editedChannelPost() {
        return this.update.edited_channel_post;
      }
      get businessConnection() {
        return this.update.business_connection;
      }
      get businessMessage() {
        return this.update.business_message;
      }
      get editedBusinessMessage() {
        return this.update.edited_business_message;
      }
      get deletedBusinessMessages() {
        return this.update.deleted_business_messages;
      }
      get messageReaction() {
        return this.update.message_reaction;
      }
      get messageReactionCount() {
        return this.update.message_reaction_count;
      }
      get inlineQuery() {
        return this.update.inline_query;
      }
      get chosenInlineResult() {
        return this.update.chosen_inline_result;
      }
      get callbackQuery() {
        return this.update.callback_query;
      }
      get shippingQuery() {
        return this.update.shipping_query;
      }
      get preCheckoutQuery() {
        return this.update.pre_checkout_query;
      }
      get poll() {
        return this.update.poll;
      }
      get pollAnswer() {
        return this.update.poll_answer;
      }
      get myChatMember() {
        return this.update.my_chat_member;
      }
      get chatMember() {
        return this.update.chat_member;
      }
      get chatJoinRequest() {
        return this.update.chat_join_request;
      }
      get chatBoost() {
        return this.update.chat_boost;
      }
      get removedChatBoost() {
        return this.update.removed_chat_boost;
      }
      get purchasedPaidMedia() {
        return this.update.purchased_paid_media;
      }
      get msg() {
        return this.message ?? this.editedMessage ?? this.channelPost ?? this.editedChannelPost ?? this.businessMessage ?? this.editedBusinessMessage ?? this.callbackQuery?.message;
      }
      get chat() {
        return (this.msg ?? this.deletedBusinessMessages ?? this.messageReaction ?? this.messageReactionCount ?? this.myChatMember ?? this.chatMember ?? this.chatJoinRequest ?? this.chatBoost ?? this.removedChatBoost)?.chat;
      }
      get senderChat() {
        return this.msg?.sender_chat;
      }
      get from() {
        return (this.businessConnection ?? this.messageReaction ?? (this.chatBoost?.boost ?? this.removedChatBoost)?.source)?.user ?? (this.callbackQuery ?? this.msg ?? this.inlineQuery ?? this.chosenInlineResult ?? this.shippingQuery ?? this.preCheckoutQuery ?? this.myChatMember ?? this.chatMember ?? this.chatJoinRequest ?? this.purchasedPaidMedia)?.from;
      }
      get msgId() {
        return this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id;
      }
      get chatId() {
        return this.chat?.id ?? this.businessConnection?.user_chat_id;
      }
      get inlineMessageId() {
        return this.callbackQuery?.inline_message_id ?? this.chosenInlineResult?.inline_message_id;
      }
      get businessConnectionId() {
        return this.msg?.business_connection_id ?? this.businessConnection?.id ?? this.deletedBusinessMessages?.business_connection_id;
      }
      entities(types) {
        const message = this.msg;
        if (message === void 0)
          return [];
        const text = message.text ?? message.caption;
        if (text === void 0)
          return [];
        let entities = message.entities ?? message.caption_entities;
        if (entities === void 0)
          return [];
        if (types !== void 0) {
          const filters = new Set(toArray(types));
          entities = entities.filter((entity) => filters.has(entity.type));
        }
        return entities.map((entity) => ({
          ...entity,
          text: text.substring(entity.offset, entity.offset + entity.length)
        }));
      }
      reactions() {
        const emoji = [];
        const emojiAdded = [];
        const emojiKept = [];
        const emojiRemoved = [];
        const customEmoji = [];
        const customEmojiAdded = [];
        const customEmojiKept = [];
        const customEmojiRemoved = [];
        let paid = false;
        let paidAdded = false;
        const r = this.messageReaction;
        if (r !== void 0) {
          const { old_reaction, new_reaction } = r;
          for (const reaction of new_reaction) {
            if (reaction.type === "emoji") {
              emoji.push(reaction.emoji);
            } else if (reaction.type === "custom_emoji") {
              customEmoji.push(reaction.custom_emoji_id);
            } else if (reaction.type === "paid") {
              paid = paidAdded = true;
            }
          }
          for (const reaction of old_reaction) {
            if (reaction.type === "emoji") {
              emojiRemoved.push(reaction.emoji);
            } else if (reaction.type === "custom_emoji") {
              customEmojiRemoved.push(reaction.custom_emoji_id);
            } else if (reaction.type === "paid") {
              paidAdded = false;
            }
          }
          emojiAdded.push(...emoji);
          customEmojiAdded.push(...customEmoji);
          for (let i = 0; i < emojiRemoved.length; i++) {
            const len = emojiAdded.length;
            if (len === 0)
              break;
            const rem = emojiRemoved[i];
            for (let j = 0; j < len; j++) {
              if (rem === emojiAdded[j]) {
                emojiKept.push(rem);
                emojiRemoved.splice(i, 1);
                emojiAdded.splice(j, 1);
                i--;
                break;
              }
            }
          }
          for (let i = 0; i < customEmojiRemoved.length; i++) {
            const len = customEmojiAdded.length;
            if (len === 0)
              break;
            const rem = customEmojiRemoved[i];
            for (let j = 0; j < len; j++) {
              if (rem === customEmojiAdded[j]) {
                customEmojiKept.push(rem);
                customEmojiRemoved.splice(i, 1);
                customEmojiAdded.splice(j, 1);
                i--;
                break;
              }
            }
          }
        }
        return {
          emoji,
          emojiAdded,
          emojiKept,
          emojiRemoved,
          customEmoji,
          customEmojiAdded,
          customEmojiKept,
          customEmojiRemoved,
          paid,
          paidAdded
        };
      }
      has(filter) {
        return _Context.has.filterQuery(filter)(this);
      }
      hasText(trigger) {
        return _Context.has.text(trigger)(this);
      }
      hasCommand(command) {
        return _Context.has.command(command)(this);
      }
      hasReaction(reaction) {
        return _Context.has.reaction(reaction)(this);
      }
      hasChatType(chatType) {
        return _Context.has.chatType(chatType)(this);
      }
      hasCallbackQuery(trigger) {
        return _Context.has.callbackQuery(trigger)(this);
      }
      hasGameQuery(trigger) {
        return _Context.has.gameQuery(trigger)(this);
      }
      hasInlineQuery(trigger) {
        return _Context.has.inlineQuery(trigger)(this);
      }
      hasChosenInlineResult(trigger) {
        return _Context.has.chosenInlineResult(trigger)(this);
      }
      hasPreCheckoutQuery(trigger) {
        return _Context.has.preCheckoutQuery(trigger)(this);
      }
      hasShippingQuery(trigger) {
        return _Context.has.shippingQuery(trigger)(this);
      }
      reply(text, other, signal) {
        const msg = this.msg;
        return this.api.sendMessage(orThrow(this.chatId, "sendMessage"), text, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      forwardMessage(chat_id, other, signal) {
        const msg = this.msg;
        return this.api.forwardMessage(chat_id, orThrow(this.chatId, "forwardMessage"), orThrow(this.msgId, "forwardMessage"), {
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      forwardMessages(chat_id, message_ids, other, signal) {
        const msg = this.msg;
        return this.api.forwardMessages(chat_id, orThrow(this.chatId, "forwardMessages"), message_ids, {
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      copyMessage(chat_id, other, signal) {
        const msg = this.msg;
        return this.api.copyMessage(chat_id, orThrow(this.chatId, "copyMessage"), orThrow(this.msgId, "copyMessage"), {
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      copyMessages(chat_id, message_ids, other, signal) {
        const msg = this.msg;
        return this.api.copyMessages(chat_id, orThrow(this.chatId, "copyMessages"), message_ids, {
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithPhoto(photo, other, signal) {
        const msg = this.msg;
        return this.api.sendPhoto(orThrow(this.chatId, "sendPhoto"), photo, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithAudio(audio, other, signal) {
        const msg = this.msg;
        return this.api.sendAudio(orThrow(this.chatId, "sendAudio"), audio, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithDocument(document1, other, signal) {
        const msg = this.msg;
        return this.api.sendDocument(orThrow(this.chatId, "sendDocument"), document1, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithVideo(video, other, signal) {
        const msg = this.msg;
        return this.api.sendVideo(orThrow(this.chatId, "sendVideo"), video, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithAnimation(animation, other, signal) {
        const msg = this.msg;
        return this.api.sendAnimation(orThrow(this.chatId, "sendAnimation"), animation, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithVoice(voice, other, signal) {
        const msg = this.msg;
        return this.api.sendVoice(orThrow(this.chatId, "sendVoice"), voice, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithVideoNote(video_note, other, signal) {
        const msg = this.msg;
        return this.api.sendVideoNote(orThrow(this.chatId, "sendVideoNote"), video_note, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithMediaGroup(media, other, signal) {
        const msg = this.msg;
        return this.api.sendMediaGroup(orThrow(this.chatId, "sendMediaGroup"), media, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithLocation(latitude, longitude, other, signal) {
        const msg = this.msg;
        return this.api.sendLocation(orThrow(this.chatId, "sendLocation"), latitude, longitude, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      editMessageLiveLocation(latitude, longitude, other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== void 0 ? this.api.editMessageLiveLocationInline(inlineId, latitude, longitude, {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal) : this.api.editMessageLiveLocation(orThrow(this.chatId, "editMessageLiveLocation"), orThrow(this.msgId, "editMessageLiveLocation"), latitude, longitude, {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal);
      }
      stopMessageLiveLocation(other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== void 0 ? this.api.stopMessageLiveLocationInline(inlineId, {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal) : this.api.stopMessageLiveLocation(orThrow(this.chatId, "stopMessageLiveLocation"), orThrow(this.msgId, "stopMessageLiveLocation"), {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal);
      }
      sendPaidMedia(star_count, media, other, signal) {
        return this.api.sendPaidMedia(orThrow(this.chatId, "sendPaidMedia"), star_count, media, {
          business_connection_id: this.businessConnectionId,
          direct_messages_topic_id: this.msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithVenue(latitude, longitude, title2, address, other, signal) {
        const msg = this.msg;
        return this.api.sendVenue(orThrow(this.chatId, "sendVenue"), latitude, longitude, title2, address, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithContact(phone_number, first_name, other, signal) {
        const msg = this.msg;
        return this.api.sendContact(orThrow(this.chatId, "sendContact"), phone_number, first_name, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithPoll(question, options, other, signal) {
        const msg = this.msg;
        return this.api.sendPoll(orThrow(this.chatId, "sendPoll"), question, options, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          ...other
        }, signal);
      }
      replyWithChecklist(checklist, other, signal) {
        return this.api.sendChecklist(orThrow(this.businessConnectionId, "sendChecklist"), orThrow(this.chatId, "sendChecklist"), checklist, other, signal);
      }
      editMessageChecklist(checklist, other, signal) {
        const msg = orThrow(this.msg, "editMessageChecklist");
        const target = msg.checklist_tasks_done?.checklist_message ?? msg.checklist_tasks_added?.checklist_message ?? msg;
        return this.api.editMessageChecklist(orThrow(this.businessConnectionId, "editMessageChecklist"), orThrow(target.chat.id, "editMessageChecklist"), orThrow(target.message_id, "editMessageChecklist"), checklist, other, signal);
      }
      replyWithDice(emoji, other, signal) {
        const msg = this.msg;
        return this.api.sendDice(orThrow(this.chatId, "sendDice"), emoji, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      replyWithChatAction(action, other, signal) {
        const msg = this.msg;
        return this.api.sendChatAction(orThrow(this.chatId, "sendChatAction"), action, {
          business_connection_id: this.businessConnectionId,
          message_thread_id: msg?.message_thread_id,
          ...other
        }, signal);
      }
      react(reaction, other, signal) {
        return this.api.setMessageReaction(orThrow(this.chatId, "setMessageReaction"), orThrow(this.msgId, "setMessageReaction"), typeof reaction === "string" ? [
          {
            type: "emoji",
            emoji: reaction
          }
        ] : (Array.isArray(reaction) ? reaction : [
          reaction
        ]).map((emoji) => typeof emoji === "string" ? {
          type: "emoji",
          emoji
        } : emoji), other, signal);
      }
      getUserProfilePhotos(other, signal) {
        return this.api.getUserProfilePhotos(orThrow(this.from, "getUserProfilePhotos").id, other, signal);
      }
      setUserEmojiStatus(other, signal) {
        return this.api.setUserEmojiStatus(orThrow(this.from, "setUserEmojiStatus").id, other, signal);
      }
      getUserChatBoosts(chat_id, signal) {
        return this.api.getUserChatBoosts(chat_id, orThrow(this.from, "getUserChatBoosts").id, signal);
      }
      getBusinessConnection(signal) {
        return this.api.getBusinessConnection(orThrow(this.businessConnectionId, "getBusinessConnection"), signal);
      }
      getFile(signal) {
        const m2 = orThrow(this.msg, "getFile");
        const file = m2.photo !== void 0 ? m2.photo[m2.photo.length - 1] : m2.animation ?? m2.audio ?? m2.document ?? m2.video ?? m2.video_note ?? m2.voice ?? m2.sticker;
        return this.api.getFile(orThrow(file, "getFile").file_id, signal);
      }
      kickAuthor(...args) {
        return this.banAuthor(...args);
      }
      banAuthor(other, signal) {
        return this.api.banChatMember(orThrow(this.chatId, "banAuthor"), orThrow(this.from, "banAuthor").id, other, signal);
      }
      kickChatMember(...args) {
        return this.banChatMember(...args);
      }
      banChatMember(user_id, other, signal) {
        return this.api.banChatMember(orThrow(this.chatId, "banChatMember"), user_id, other, signal);
      }
      unbanChatMember(user_id, other, signal) {
        return this.api.unbanChatMember(orThrow(this.chatId, "unbanChatMember"), user_id, other, signal);
      }
      restrictAuthor(permissions, other, signal) {
        return this.api.restrictChatMember(orThrow(this.chatId, "restrictAuthor"), orThrow(this.from, "restrictAuthor").id, permissions, other, signal);
      }
      restrictChatMember(user_id, permissions, other, signal) {
        return this.api.restrictChatMember(orThrow(this.chatId, "restrictChatMember"), user_id, permissions, other, signal);
      }
      promoteAuthor(other, signal) {
        return this.api.promoteChatMember(orThrow(this.chatId, "promoteAuthor"), orThrow(this.from, "promoteAuthor").id, other, signal);
      }
      promoteChatMember(user_id, other, signal) {
        return this.api.promoteChatMember(orThrow(this.chatId, "promoteChatMember"), user_id, other, signal);
      }
      setChatAdministratorAuthorCustomTitle(custom_title, signal) {
        return this.api.setChatAdministratorCustomTitle(orThrow(this.chatId, "setChatAdministratorAuthorCustomTitle"), orThrow(this.from, "setChatAdministratorAuthorCustomTitle").id, custom_title, signal);
      }
      setChatAdministratorCustomTitle(user_id, custom_title, signal) {
        return this.api.setChatAdministratorCustomTitle(orThrow(this.chatId, "setChatAdministratorCustomTitle"), user_id, custom_title, signal);
      }
      banChatSenderChat(sender_chat_id, signal) {
        return this.api.banChatSenderChat(orThrow(this.chatId, "banChatSenderChat"), sender_chat_id, signal);
      }
      unbanChatSenderChat(sender_chat_id, signal) {
        return this.api.unbanChatSenderChat(orThrow(this.chatId, "unbanChatSenderChat"), sender_chat_id, signal);
      }
      setChatPermissions(permissions, other, signal) {
        return this.api.setChatPermissions(orThrow(this.chatId, "setChatPermissions"), permissions, other, signal);
      }
      exportChatInviteLink(signal) {
        return this.api.exportChatInviteLink(orThrow(this.chatId, "exportChatInviteLink"), signal);
      }
      createChatInviteLink(other, signal) {
        return this.api.createChatInviteLink(orThrow(this.chatId, "createChatInviteLink"), other, signal);
      }
      editChatInviteLink(invite_link, other, signal) {
        return this.api.editChatInviteLink(orThrow(this.chatId, "editChatInviteLink"), invite_link, other, signal);
      }
      createChatSubscriptionInviteLink(subscription_period, subscription_price, other, signal) {
        return this.api.createChatSubscriptionInviteLink(orThrow(this.chatId, "createChatSubscriptionInviteLink"), subscription_period, subscription_price, other, signal);
      }
      editChatSubscriptionInviteLink(invite_link, other, signal) {
        return this.api.editChatSubscriptionInviteLink(orThrow(this.chatId, "editChatSubscriptionInviteLink"), invite_link, other, signal);
      }
      revokeChatInviteLink(invite_link, signal) {
        return this.api.revokeChatInviteLink(orThrow(this.chatId, "editChatInviteLink"), invite_link, signal);
      }
      approveChatJoinRequest(user_id, signal) {
        return this.api.approveChatJoinRequest(orThrow(this.chatId, "approveChatJoinRequest"), user_id, signal);
      }
      declineChatJoinRequest(user_id, signal) {
        return this.api.declineChatJoinRequest(orThrow(this.chatId, "declineChatJoinRequest"), user_id, signal);
      }
      approveSuggestedPost(other, signal) {
        return this.api.approveSuggestedPost(orThrow(this.chatId, "approveSuggestedPost"), orThrow(this.msgId, "approveSuggestedPost"), other, signal);
      }
      declineSuggestedPost(other, signal) {
        return this.api.declineSuggestedPost(orThrow(this.chatId, "declineSuggestedPost"), orThrow(this.msgId, "declineSuggestedPost"), other, signal);
      }
      setChatPhoto(photo, signal) {
        return this.api.setChatPhoto(orThrow(this.chatId, "setChatPhoto"), photo, signal);
      }
      deleteChatPhoto(signal) {
        return this.api.deleteChatPhoto(orThrow(this.chatId, "deleteChatPhoto"), signal);
      }
      setChatTitle(title2, signal) {
        return this.api.setChatTitle(orThrow(this.chatId, "setChatTitle"), title2, signal);
      }
      setChatDescription(description, signal) {
        return this.api.setChatDescription(orThrow(this.chatId, "setChatDescription"), description, signal);
      }
      pinChatMessage(message_id, other, signal) {
        return this.api.pinChatMessage(orThrow(this.chatId, "pinChatMessage"), message_id, {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal);
      }
      unpinChatMessage(message_id, other, signal) {
        return this.api.unpinChatMessage(orThrow(this.chatId, "unpinChatMessage"), message_id, {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal);
      }
      unpinAllChatMessages(signal) {
        return this.api.unpinAllChatMessages(orThrow(this.chatId, "unpinAllChatMessages"), signal);
      }
      leaveChat(signal) {
        return this.api.leaveChat(orThrow(this.chatId, "leaveChat"), signal);
      }
      getChat(signal) {
        return this.api.getChat(orThrow(this.chatId, "getChat"), signal);
      }
      getChatAdministrators(signal) {
        return this.api.getChatAdministrators(orThrow(this.chatId, "getChatAdministrators"), signal);
      }
      getChatMembersCount(...args) {
        return this.getChatMemberCount(...args);
      }
      getChatMemberCount(signal) {
        return this.api.getChatMemberCount(orThrow(this.chatId, "getChatMemberCount"), signal);
      }
      getAuthor(signal) {
        return this.api.getChatMember(orThrow(this.chatId, "getAuthor"), orThrow(this.from, "getAuthor").id, signal);
      }
      getChatMember(user_id, signal) {
        return this.api.getChatMember(orThrow(this.chatId, "getChatMember"), user_id, signal);
      }
      setChatStickerSet(sticker_set_name, signal) {
        return this.api.setChatStickerSet(orThrow(this.chatId, "setChatStickerSet"), sticker_set_name, signal);
      }
      deleteChatStickerSet(signal) {
        return this.api.deleteChatStickerSet(orThrow(this.chatId, "deleteChatStickerSet"), signal);
      }
      createForumTopic(name, other, signal) {
        return this.api.createForumTopic(orThrow(this.chatId, "createForumTopic"), name, other, signal);
      }
      editForumTopic(other, signal) {
        const message = orThrow(this.msg, "editForumTopic");
        const thread = orThrow(message.message_thread_id, "editForumTopic");
        return this.api.editForumTopic(message.chat.id, thread, other, signal);
      }
      closeForumTopic(signal) {
        const message = orThrow(this.msg, "closeForumTopic");
        const thread = orThrow(message.message_thread_id, "closeForumTopic");
        return this.api.closeForumTopic(message.chat.id, thread, signal);
      }
      reopenForumTopic(signal) {
        const message = orThrow(this.msg, "reopenForumTopic");
        const thread = orThrow(message.message_thread_id, "reopenForumTopic");
        return this.api.reopenForumTopic(message.chat.id, thread, signal);
      }
      deleteForumTopic(signal) {
        const message = orThrow(this.msg, "deleteForumTopic");
        const thread = orThrow(message.message_thread_id, "deleteForumTopic");
        return this.api.deleteForumTopic(message.chat.id, thread, signal);
      }
      unpinAllForumTopicMessages(signal) {
        const message = orThrow(this.msg, "unpinAllForumTopicMessages");
        const thread = orThrow(message.message_thread_id, "unpinAllForumTopicMessages");
        return this.api.unpinAllForumTopicMessages(message.chat.id, thread, signal);
      }
      editGeneralForumTopic(name, signal) {
        return this.api.editGeneralForumTopic(orThrow(this.chatId, "editGeneralForumTopic"), name, signal);
      }
      closeGeneralForumTopic(signal) {
        return this.api.closeGeneralForumTopic(orThrow(this.chatId, "closeGeneralForumTopic"), signal);
      }
      reopenGeneralForumTopic(signal) {
        return this.api.reopenGeneralForumTopic(orThrow(this.chatId, "reopenGeneralForumTopic"), signal);
      }
      hideGeneralForumTopic(signal) {
        return this.api.hideGeneralForumTopic(orThrow(this.chatId, "hideGeneralForumTopic"), signal);
      }
      unhideGeneralForumTopic(signal) {
        return this.api.unhideGeneralForumTopic(orThrow(this.chatId, "unhideGeneralForumTopic"), signal);
      }
      unpinAllGeneralForumTopicMessages(signal) {
        return this.api.unpinAllGeneralForumTopicMessages(orThrow(this.chatId, "unpinAllGeneralForumTopicMessages"), signal);
      }
      answerCallbackQuery(other, signal) {
        return this.api.answerCallbackQuery(orThrow(this.callbackQuery, "answerCallbackQuery").id, typeof other === "string" ? {
          text: other
        } : other, signal);
      }
      setChatMenuButton(other, signal) {
        return this.api.setChatMenuButton(other, signal);
      }
      getChatMenuButton(other, signal) {
        return this.api.getChatMenuButton(other, signal);
      }
      setMyDefaultAdministratorRights(other, signal) {
        return this.api.setMyDefaultAdministratorRights(other, signal);
      }
      getMyDefaultAdministratorRights(other, signal) {
        return this.api.getMyDefaultAdministratorRights(other, signal);
      }
      editMessageText(text, other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== void 0 ? this.api.editMessageTextInline(inlineId, text, {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal) : this.api.editMessageText(orThrow(this.chatId, "editMessageText"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "editMessageText"), text, {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal);
      }
      editMessageCaption(other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== void 0 ? this.api.editMessageCaptionInline(inlineId, {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal) : this.api.editMessageCaption(orThrow(this.chatId, "editMessageCaption"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "editMessageCaption"), {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal);
      }
      editMessageMedia(media, other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== void 0 ? this.api.editMessageMediaInline(inlineId, media, {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal) : this.api.editMessageMedia(orThrow(this.chatId, "editMessageMedia"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "editMessageMedia"), media, {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal);
      }
      editMessageReplyMarkup(other, signal) {
        const inlineId = this.inlineMessageId;
        return inlineId !== void 0 ? this.api.editMessageReplyMarkupInline(inlineId, {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal) : this.api.editMessageReplyMarkup(orThrow(this.chatId, "editMessageReplyMarkup"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "editMessageReplyMarkup"), {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal);
      }
      stopPoll(other, signal) {
        return this.api.stopPoll(orThrow(this.chatId, "stopPoll"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "stopPoll"), {
          business_connection_id: this.businessConnectionId,
          ...other
        }, signal);
      }
      deleteMessage(signal) {
        return this.api.deleteMessage(orThrow(this.chatId, "deleteMessage"), orThrow(this.msg?.message_id ?? this.messageReaction?.message_id ?? this.messageReactionCount?.message_id, "deleteMessage"), signal);
      }
      deleteMessages(message_ids, signal) {
        return this.api.deleteMessages(orThrow(this.chatId, "deleteMessages"), message_ids, signal);
      }
      deleteBusinessMessages(message_ids, signal) {
        return this.api.deleteBusinessMessages(orThrow(this.businessConnectionId, "deleteBusinessMessages"), message_ids, signal);
      }
      setBusinessAccountName(first_name, other, signal) {
        return this.api.setBusinessAccountName(orThrow(this.businessConnectionId, "setBusinessAccountName"), first_name, other, signal);
      }
      setBusinessAccountUsername(username, signal) {
        return this.api.setBusinessAccountUsername(orThrow(this.businessConnectionId, "setBusinessAccountUsername"), username, signal);
      }
      setBusinessAccountBio(bio, signal) {
        return this.api.setBusinessAccountBio(orThrow(this.businessConnectionId, "setBusinessAccountBio"), bio, signal);
      }
      setBusinessAccountProfilePhoto(photo, other, signal) {
        return this.api.setBusinessAccountProfilePhoto(orThrow(this.businessConnectionId, "setBusinessAccountProfilePhoto"), photo, other, signal);
      }
      removeBusinessAccountProfilePhoto(other, signal) {
        return this.api.removeBusinessAccountProfilePhoto(orThrow(this.businessConnectionId, "removeBusinessAccountProfilePhoto"), other, signal);
      }
      setBusinessAccountGiftSettings(show_gift_button, accepted_gift_types, signal) {
        return this.api.setBusinessAccountGiftSettings(orThrow(this.businessConnectionId, "setBusinessAccountGiftSettings"), show_gift_button, accepted_gift_types, signal);
      }
      getBusinessAccountStarBalance(signal) {
        return this.api.getBusinessAccountStarBalance(orThrow(this.businessConnectionId, "getBusinessAccountStarBalance"), signal);
      }
      transferBusinessAccountStars(star_count, signal) {
        return this.api.transferBusinessAccountStars(orThrow(this.businessConnectionId, "transferBusinessAccountStars"), star_count, signal);
      }
      getBusinessAccountGifts(other, signal) {
        return this.api.getBusinessAccountGifts(orThrow(this.businessConnectionId, "getBusinessAccountGifts"), other, signal);
      }
      convertGiftToStars(owned_gift_id, signal) {
        return this.api.convertGiftToStars(orThrow(this.businessConnectionId, "convertGiftToStars"), owned_gift_id, signal);
      }
      upgradeGift(owned_gift_id, other, signal) {
        return this.api.upgradeGift(orThrow(this.businessConnectionId, "upgradeGift"), owned_gift_id, other, signal);
      }
      transferGift(owned_gift_id, new_owner_chat_id, star_count, signal) {
        return this.api.transferGift(orThrow(this.businessConnectionId, "transferGift"), owned_gift_id, new_owner_chat_id, star_count, signal);
      }
      postStory(content, active_period, other, signal) {
        return this.api.postStory(orThrow(this.businessConnectionId, "postStory"), content, active_period, other, signal);
      }
      editStory(story_id, content, other, signal) {
        return this.api.editStory(orThrow(this.businessConnectionId, "editStory"), story_id, content, other, signal);
      }
      deleteStory(story_id, signal) {
        return this.api.deleteStory(orThrow(this.businessConnectionId, "deleteStory"), story_id, signal);
      }
      replyWithSticker(sticker, other, signal) {
        const msg = this.msg;
        return this.api.sendSticker(orThrow(this.chatId, "sendSticker"), sticker, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      getCustomEmojiStickers(signal) {
        return this.api.getCustomEmojiStickers((this.msg?.entities ?? []).filter((e) => e.type === "custom_emoji").map((e) => e.custom_emoji_id), signal);
      }
      replyWithGift(gift_id, other, signal) {
        return this.api.sendGift(orThrow(this.from, "sendGift").id, gift_id, other, signal);
      }
      giftPremiumSubscription(month_count, star_count, other, signal) {
        return this.api.giftPremiumSubscription(orThrow(this.from, "giftPremiumSubscription").id, month_count, star_count, other, signal);
      }
      replyWithGiftToChannel(gift_id, other, signal) {
        return this.api.sendGiftToChannel(orThrow(this.chat, "sendGift").id, gift_id, other, signal);
      }
      answerInlineQuery(results, other, signal) {
        return this.api.answerInlineQuery(orThrow(this.inlineQuery, "answerInlineQuery").id, results, other, signal);
      }
      savePreparedInlineMessage(result, other, signal) {
        return this.api.savePreparedInlineMessage(orThrow(this.from, "savePreparedInlineMessage").id, result, other, signal);
      }
      replyWithInvoice(title2, description, payload, currency, prices, other, signal) {
        const msg = this.msg;
        return this.api.sendInvoice(orThrow(this.chatId, "sendInvoice"), title2, description, payload, currency, prices, {
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
          ...other
        }, signal);
      }
      answerShippingQuery(ok2, other, signal) {
        return this.api.answerShippingQuery(orThrow(this.shippingQuery, "answerShippingQuery").id, ok2, other, signal);
      }
      answerPreCheckoutQuery(ok2, other, signal) {
        return this.api.answerPreCheckoutQuery(orThrow(this.preCheckoutQuery, "answerPreCheckoutQuery").id, ok2, typeof other === "string" ? {
          error_message: other
        } : other, signal);
      }
      refundStarPayment(signal) {
        return this.api.refundStarPayment(orThrow(this.from, "refundStarPayment").id, orThrow(this.msg?.successful_payment, "refundStarPayment").telegram_payment_charge_id, signal);
      }
      editUserStarSubscription(telegram_payment_charge_id, is_canceled, signal) {
        return this.api.editUserStarSubscription(orThrow(this.from, "editUserStarSubscription").id, telegram_payment_charge_id, is_canceled, signal);
      }
      verifyUser(other, signal) {
        return this.api.verifyUser(orThrow(this.from, "verifyUser").id, other, signal);
      }
      verifyChat(other, signal) {
        return this.api.verifyChat(orThrow(this.chatId, "verifyChat"), other, signal);
      }
      removeUserVerification(signal) {
        return this.api.removeUserVerification(orThrow(this.from, "removeUserVerification").id, signal);
      }
      removeChatVerification(signal) {
        return this.api.removeChatVerification(orThrow(this.chatId, "removeChatVerification"), signal);
      }
      readBusinessMessage(signal) {
        return this.api.readBusinessMessage(orThrow(this.businessConnectionId, "readBusinessMessage"), orThrow(this.chatId, "readBusinessMessage"), orThrow(this.msgId, "readBusinessMessage"), signal);
      }
      setPassportDataErrors(errors, signal) {
        return this.api.setPassportDataErrors(orThrow(this.from, "setPassportDataErrors").id, errors, signal);
      }
      replyWithGame(game_short_name, other, signal) {
        const msg = this.msg;
        return this.api.sendGame(orThrow(this.chatId, "sendGame"), game_short_name, {
          business_connection_id: this.businessConnectionId,
          ...msg?.is_topic_message ? {
            message_thread_id: msg?.message_thread_id
          } : {},
          ...other
        }, signal);
      }
    };
    Context = _Context;
    __name(Context, "Context");
    __publicField(Context, "has", checker);
    __name(orThrow, "orThrow");
    __name(triggerFn, "triggerFn");
    __name(match, "match");
    __name(toArray, "toArray");
    BotError = class extends Error {
      error;
      ctx;
      constructor(error, ctx) {
        super(generateBotErrorMessage(error));
        this.error = error;
        this.ctx = ctx;
        this.name = "BotError";
        if (error instanceof Error)
          this.stack = error.stack;
      }
    };
    __name(BotError, "BotError");
    __name(generateBotErrorMessage, "generateBotErrorMessage");
    __name(flatten, "flatten");
    __name(concat1, "concat1");
    __name(pass, "pass");
    leaf1 = /* @__PURE__ */ __name(() => Promise.resolve(), "leaf1");
    __name(run, "run");
    Composer = class {
      handler;
      constructor(...middleware) {
        this.handler = middleware.length === 0 ? pass : middleware.map(flatten).reduce(concat1);
      }
      middleware() {
        return this.handler;
      }
      use(...middleware) {
        const composer = new Composer(...middleware);
        this.handler = concat1(this.handler, flatten(composer));
        return composer;
      }
      on(filter, ...middleware) {
        return this.filter(Context.has.filterQuery(filter), ...middleware);
      }
      hears(trigger, ...middleware) {
        return this.filter(Context.has.text(trigger), ...middleware);
      }
      command(command, ...middleware) {
        return this.filter(Context.has.command(command), ...middleware);
      }
      reaction(reaction, ...middleware) {
        return this.filter(Context.has.reaction(reaction), ...middleware);
      }
      chatType(chatType, ...middleware) {
        return this.filter(Context.has.chatType(chatType), ...middleware);
      }
      callbackQuery(trigger, ...middleware) {
        return this.filter(Context.has.callbackQuery(trigger), ...middleware);
      }
      gameQuery(trigger, ...middleware) {
        return this.filter(Context.has.gameQuery(trigger), ...middleware);
      }
      inlineQuery(trigger, ...middleware) {
        return this.filter(Context.has.inlineQuery(trigger), ...middleware);
      }
      chosenInlineResult(resultId, ...middleware) {
        return this.filter(Context.has.chosenInlineResult(resultId), ...middleware);
      }
      preCheckoutQuery(trigger, ...middleware) {
        return this.filter(Context.has.preCheckoutQuery(trigger), ...middleware);
      }
      shippingQuery(trigger, ...middleware) {
        return this.filter(Context.has.shippingQuery(trigger), ...middleware);
      }
      filter(predicate, ...middleware) {
        const composer = new Composer(...middleware);
        this.branch(predicate, composer, pass);
        return composer;
      }
      drop(predicate, ...middleware) {
        return this.filter(async (ctx) => !await predicate(ctx), ...middleware);
      }
      fork(...middleware) {
        const composer = new Composer(...middleware);
        const fork = flatten(composer);
        this.use((ctx, next) => Promise.all([
          next(),
          run(fork, ctx)
        ]));
        return composer;
      }
      lazy(middlewareFactory) {
        return this.use(async (ctx, next) => {
          const middleware = await middlewareFactory(ctx);
          const arr = Array.isArray(middleware) ? middleware : [
            middleware
          ];
          await flatten(new Composer(...arr))(ctx, next);
        });
      }
      route(router, routeHandlers, fallback = pass) {
        return this.lazy(async (ctx) => {
          const route = await router(ctx);
          return (route === void 0 || !routeHandlers[route] ? fallback : routeHandlers[route]) ?? [];
        });
      }
      branch(predicate, trueMiddleware, falseMiddleware) {
        return this.lazy(async (ctx) => await predicate(ctx) ? trueMiddleware : falseMiddleware);
      }
      errorBoundary(errorHandler2, ...middleware) {
        const composer = new Composer(...middleware);
        const bound = flatten(composer);
        this.use(async (ctx, next) => {
          let nextCalled = false;
          const cont = /* @__PURE__ */ __name(() => (nextCalled = true, Promise.resolve()), "cont");
          try {
            await bound(ctx, cont);
          } catch (err) {
            nextCalled = false;
            await errorHandler2(new BotError(err, ctx), cont);
          }
          if (nextCalled)
            await next();
        });
        return composer;
      }
    };
    __name(Composer, "Composer");
    s = 1e3;
    m = s * 60;
    h = m * 60;
    d = h * 24;
    w = d * 7;
    y = d * 365.25;
    ms = /* @__PURE__ */ __name(function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse1(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
      }
      throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
    }, "ms");
    __name(parse1, "parse1");
    __name(fmtShort, "fmtShort");
    __name(fmtLong, "fmtLong");
    __name(plural, "plural");
    __name(defaultSetTimout, "defaultSetTimout");
    __name(defaultClearTimeout, "defaultClearTimeout");
    cachedSetTimeout = defaultSetTimout;
    cachedClearTimeout = defaultClearTimeout;
    if (typeof window !== "undefined") {
      globalContext = window;
    } else if (typeof self !== "undefined") {
      globalContext = self;
    } else {
      globalContext = {};
    }
    if (typeof globalContext.setTimeout === "function") {
      cachedSetTimeout = setTimeout;
    }
    if (typeof globalContext.clearTimeout === "function") {
      cachedClearTimeout = clearTimeout;
    }
    __name(runTimeout, "runTimeout");
    __name(runClearTimeout, "runClearTimeout");
    queue = [];
    draining = false;
    queueIndex = -1;
    __name(cleanUpNextTick, "cleanUpNextTick");
    __name(drainQueue, "drainQueue");
    __name(nextTick, "nextTick");
    __name(Item, "Item");
    Item.prototype.run = function() {
      this.fun.apply(null, this.array);
    };
    title = "browser";
    platform = "browser";
    browser = true;
    argv = [];
    version = "";
    versions = {};
    release = {};
    config = {};
    __name(noop, "noop");
    on = noop;
    addListener = noop;
    once = noop;
    off = noop;
    removeListener = noop;
    removeAllListeners = noop;
    emit = noop;
    __name(binding, "binding");
    __name(cwd, "cwd");
    __name(chdir, "chdir");
    __name(umask, "umask");
    performance = globalContext.performance || {};
    performanceNow = performance.now || performance.mozNow || performance.msNow || performance.oNow || performance.webkitNow || function() {
      return (/* @__PURE__ */ new Date()).getTime();
    };
    __name(hrtime, "hrtime");
    startTime = /* @__PURE__ */ new Date();
    __name(uptime, "uptime");
    process2 = {
      nextTick,
      title,
      browser,
      env: {
        NODE_ENV: "production"
      },
      argv,
      version,
      versions,
      on,
      addListener,
      once,
      off,
      removeListener,
      removeAllListeners,
      emit,
      binding,
      cwd,
      chdir,
      umask,
      hrtime,
      platform,
      release,
      config,
      uptime
    };
    __name(createCommonjsModule, "createCommonjsModule");
    __name(commonjsRequire, "commonjsRequire");
    __name(setup, "setup");
    common = setup;
    browser$1 = createCommonjsModule(function(module, exports) {
      exports.formatArgs = formatArgs2;
      exports.save = save2;
      exports.load = load2;
      exports.useColors = useColors2;
      exports.storage = localstorage();
      exports.destroy = (() => {
        let warned = false;
        return () => {
          if (!warned) {
            warned = true;
            console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
          }
        };
      })();
      exports.colors = [
        "#0000CC",
        "#0000FF",
        "#0033CC",
        "#0033FF",
        "#0066CC",
        "#0066FF",
        "#0099CC",
        "#0099FF",
        "#00CC00",
        "#00CC33",
        "#00CC66",
        "#00CC99",
        "#00CCCC",
        "#00CCFF",
        "#3300CC",
        "#3300FF",
        "#3333CC",
        "#3333FF",
        "#3366CC",
        "#3366FF",
        "#3399CC",
        "#3399FF",
        "#33CC00",
        "#33CC33",
        "#33CC66",
        "#33CC99",
        "#33CCCC",
        "#33CCFF",
        "#6600CC",
        "#6600FF",
        "#6633CC",
        "#6633FF",
        "#66CC00",
        "#66CC33",
        "#9900CC",
        "#9900FF",
        "#9933CC",
        "#9933FF",
        "#99CC00",
        "#99CC33",
        "#CC0000",
        "#CC0033",
        "#CC0066",
        "#CC0099",
        "#CC00CC",
        "#CC00FF",
        "#CC3300",
        "#CC3333",
        "#CC3366",
        "#CC3399",
        "#CC33CC",
        "#CC33FF",
        "#CC6600",
        "#CC6633",
        "#CC9900",
        "#CC9933",
        "#CCCC00",
        "#CCCC33",
        "#FF0000",
        "#FF0033",
        "#FF0066",
        "#FF0099",
        "#FF00CC",
        "#FF00FF",
        "#FF3300",
        "#FF3333",
        "#FF3366",
        "#FF3399",
        "#FF33CC",
        "#FF33FF",
        "#FF6600",
        "#FF6633",
        "#FF9900",
        "#FF9933",
        "#FFCC00",
        "#FFCC33"
      ];
      function useColors2() {
        if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
          return true;
        }
        if (typeof navigator !== "undefined" && "Cloudflare-Workers" && "Cloudflare-Workers".toLowerCase().match(/(edge|trident)\/(\d+)/)) {
          return false;
        }
        let m2;
        return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && "Cloudflare-Workers" && (m2 = "Cloudflare-Workers".toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m2[1], 10) >= 31 || typeof navigator !== "undefined" && "Cloudflare-Workers" && "Cloudflare-Workers".toLowerCase().match(/applewebkit\/(\d+)/);
      }
      __name(useColors2, "useColors2");
      function formatArgs2(args) {
        args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
        if (!this.useColors) {
          return;
        }
        const c = "color: " + this.color;
        args.splice(1, 0, c, "color: inherit");
        let index = 0;
        let lastC = 0;
        args[0].replace(/%[a-zA-Z%]/g, (match3) => {
          if (match3 === "%%") {
            return;
          }
          index++;
          if (match3 === "%c") {
            lastC = index;
          }
        });
        args.splice(lastC, 0, c);
      }
      __name(formatArgs2, "formatArgs2");
      exports.log = console.debug || console.log || (() => {
      });
      function save2(namespaces) {
        try {
          if (namespaces) {
            exports.storage.setItem("debug", namespaces);
          } else {
            exports.storage.removeItem("debug");
          }
        } catch (error) {
        }
      }
      __name(save2, "save2");
      function load2() {
        let r;
        try {
          r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
        } catch (error) {
        }
        if (!r && typeof process2 !== "undefined" && "env" in process2) {
          r = process2.env.DEBUG;
        }
        return r;
      }
      __name(load2, "load2");
      function localstorage() {
        try {
          return localStorage;
        } catch (error) {
        }
      }
      __name(localstorage, "localstorage");
      module.exports = common(exports);
      const { formatters } = module.exports;
      formatters.j = function(v) {
        try {
          return JSON.stringify(v);
        } catch (error) {
          return "[UnexpectedJSONParseError]: " + error.message;
        }
      };
    });
    browser$1.colors;
    browser$1.destroy;
    browser$1.formatArgs;
    browser$1.load;
    browser$1.log;
    browser$1.save;
    browser$1.storage;
    browser$1.useColors;
    itrToStream = /* @__PURE__ */ __name((itr) => {
      const it = itr[Symbol.asyncIterator]();
      return new ReadableStream({
        async pull(controller) {
          const chunk = await it.next();
          if (chunk.done)
            controller.close();
          else
            controller.enqueue(chunk.value);
        }
      });
    }, "itrToStream");
    baseFetchConfig = /* @__PURE__ */ __name((_apiRoot) => ({}), "baseFetchConfig");
    defaultAdapter = "cloudflare";
    debug = browser$1("grammy:warn");
    GrammyError = class extends Error {
      method;
      payload;
      ok;
      error_code;
      description;
      parameters;
      constructor(message, err, method, payload) {
        super(`${message} (${err.error_code}: ${err.description})`);
        this.method = method;
        this.payload = payload;
        this.ok = false;
        this.name = "GrammyError";
        this.error_code = err.error_code;
        this.description = err.description;
        this.parameters = err.parameters ?? {};
      }
    };
    __name(GrammyError, "GrammyError");
    __name(toGrammyError, "toGrammyError");
    HttpError = class extends Error {
      error;
      constructor(message, error) {
        super(message);
        this.error = error;
        this.name = "HttpError";
      }
    };
    __name(HttpError, "HttpError");
    __name(isTelegramError, "isTelegramError");
    __name(toHttpError, "toHttpError");
    __name(checkWindows, "checkWindows");
    isWindows = checkWindows();
    __name(assertPath, "assertPath");
    __name(stripSuffix, "stripSuffix");
    __name(lastPathSegment, "lastPathSegment");
    __name(assertArgs, "assertArgs");
    __name(assertArg, "assertArg");
    __name(fromFileUrl, "fromFileUrl");
    __name(stripTrailingSeparators, "stripTrailingSeparators");
    __name(isPosixPathSeparator, "isPosixPathSeparator");
    __name(basename, "basename");
    __name(isPathSeparator, "isPathSeparator");
    __name(isWindowsDeviceRoot, "isWindowsDeviceRoot");
    __name(fromFileUrl1, "fromFileUrl1");
    __name(basename1, "basename1");
    __name(basename2, "basename2");
    InputFile = class {
      consumed = false;
      fileData;
      filename;
      constructor(file, filename) {
        this.fileData = file;
        filename ??= this.guessFilename(file);
        this.filename = filename;
      }
      guessFilename(file) {
        if (typeof file === "string")
          return basename2(file);
        if (typeof file !== "object")
          return void 0;
        if ("url" in file)
          return basename2(file.url);
        if (!(file instanceof URL))
          return void 0;
        return basename2(file.pathname) || basename2(file.hostname);
      }
      toRaw() {
        if (this.consumed) {
          throw new Error("Cannot reuse InputFile data source!");
        }
        const data = this.fileData;
        if (data instanceof Blob)
          return data.stream();
        if (data instanceof URL)
          return fetchFile(data);
        if ("url" in data)
          return fetchFile(data.url);
        if (!(data instanceof Uint8Array))
          this.consumed = true;
        return data;
      }
    };
    __name(InputFile, "InputFile");
    __name(fetchFile, "fetchFile");
    __name(requiresFormDataUpload, "requiresFormDataUpload");
    __name(str, "str");
    __name(createJsonPayload, "createJsonPayload");
    __name(protectItr, "protectItr");
    __name(createFormDataPayload, "createFormDataPayload");
    __name(createBoundary, "createBoundary");
    __name(randomId, "randomId");
    enc = new TextEncoder();
    __name(payloadToMultipartItr, "payloadToMultipartItr");
    __name(extractFiles, "extractFiles");
    __name(valuePart, "valuePart");
    __name(filePart, "filePart");
    __name(getExt, "getExt");
    debug1 = browser$1("grammy:core");
    __name(concatTransformer, "concatTransformer");
    ApiClient = class {
      token;
      webhookReplyEnvelope;
      options;
      fetch;
      hasUsedWebhookReply;
      installedTransformers;
      constructor(token, options = {}, webhookReplyEnvelope = {}) {
        this.token = token;
        this.webhookReplyEnvelope = webhookReplyEnvelope;
        this.hasUsedWebhookReply = false;
        this.installedTransformers = [];
        this.call = async (method, p, signal) => {
          const payload = p ?? {};
          debug1(`Calling ${method}`);
          if (signal !== void 0)
            validateSignal(method, payload, signal);
          const opts = this.options;
          const formDataRequired = requiresFormDataUpload(payload);
          if (this.webhookReplyEnvelope.send !== void 0 && !this.hasUsedWebhookReply && !formDataRequired && opts.canUseWebhookReply(method)) {
            this.hasUsedWebhookReply = true;
            const config3 = createJsonPayload({
              ...payload,
              method
            });
            await this.webhookReplyEnvelope.send(config3.body);
            return {
              ok: true,
              result: true
            };
          }
          const controller = createAbortControllerFromSignal(signal);
          const timeout = createTimeout(controller, opts.timeoutSeconds, method);
          const streamErr = createStreamError(controller);
          const url = opts.buildUrl(opts.apiRoot, this.token, method, opts.environment);
          const config2 = formDataRequired ? createFormDataPayload(payload, (err) => streamErr.catch(err)) : createJsonPayload(payload);
          const sig = controller.signal;
          const options2 = {
            ...opts.baseFetchConfig,
            signal: sig,
            ...config2
          };
          const successPromise = this.fetch(url instanceof URL ? url.href : url, options2).catch(toHttpError(method, opts.sensitiveLogs));
          const operations = [
            successPromise,
            streamErr.promise,
            timeout.promise
          ];
          try {
            const res = await Promise.race(operations);
            return await res.json();
          } finally {
            if (timeout.handle !== void 0)
              clearTimeout(timeout.handle);
          }
        };
        const apiRoot = options.apiRoot ?? "https://api.telegram.org";
        const environment = options.environment ?? "prod";
        const { fetch: customFetch } = options;
        const fetchFn = customFetch ?? fetch;
        this.options = {
          apiRoot,
          environment,
          buildUrl: options.buildUrl ?? defaultBuildUrl,
          timeoutSeconds: options.timeoutSeconds ?? 500,
          baseFetchConfig: {
            ...baseFetchConfig(apiRoot),
            ...options.baseFetchConfig
          },
          canUseWebhookReply: options.canUseWebhookReply ?? (() => false),
          sensitiveLogs: options.sensitiveLogs ?? false,
          fetch: (...args) => fetchFn(...args)
        };
        this.fetch = this.options.fetch;
        if (this.options.apiRoot.endsWith("/")) {
          throw new Error(`Remove the trailing '/' from the 'apiRoot' option (use '${this.options.apiRoot.substring(0, this.options.apiRoot.length - 1)}' instead of '${this.options.apiRoot}')`);
        }
      }
      call;
      use(...transformers) {
        this.call = transformers.reduce(concatTransformer, this.call);
        this.installedTransformers.push(...transformers);
        return this;
      }
      async callApi(method, payload, signal) {
        const data = await this.call(method, payload, signal);
        if (data.ok)
          return data.result;
        else
          throw toGrammyError(data, method, payload);
      }
    };
    __name(ApiClient, "ApiClient");
    __name(createRawApi, "createRawApi");
    defaultBuildUrl = /* @__PURE__ */ __name((root, token, method, env) => {
      const prefix = env === "test" ? "test/" : "";
      return `${root}/bot${token}/${prefix}${method}`;
    }, "defaultBuildUrl");
    proxyMethods = {
      set() {
        return false;
      },
      defineProperty() {
        return false;
      },
      deleteProperty() {
        return false;
      },
      ownKeys() {
        return [];
      }
    };
    __name(createTimeout, "createTimeout");
    __name(createStreamError, "createStreamError");
    __name(createAbortControllerFromSignal, "createAbortControllerFromSignal");
    __name(validateSignal, "validateSignal");
    Api = class {
      token;
      options;
      raw;
      config;
      constructor(token, options, webhookReplyEnvelope) {
        this.token = token;
        this.options = options;
        const { raw: raw2, use, installedTransformers } = createRawApi(token, options, webhookReplyEnvelope);
        this.raw = raw2;
        this.config = {
          use,
          installedTransformers: () => installedTransformers.slice()
        };
      }
      getUpdates(other, signal) {
        return this.raw.getUpdates({
          ...other
        }, signal);
      }
      setWebhook(url, other, signal) {
        return this.raw.setWebhook({
          url,
          ...other
        }, signal);
      }
      deleteWebhook(other, signal) {
        return this.raw.deleteWebhook({
          ...other
        }, signal);
      }
      getWebhookInfo(signal) {
        return this.raw.getWebhookInfo(signal);
      }
      getMe(signal) {
        return this.raw.getMe(signal);
      }
      logOut(signal) {
        return this.raw.logOut(signal);
      }
      close(signal) {
        return this.raw.close(signal);
      }
      sendMessage(chat_id, text, other, signal) {
        return this.raw.sendMessage({
          chat_id,
          text,
          ...other
        }, signal);
      }
      forwardMessage(chat_id, from_chat_id, message_id, other, signal) {
        return this.raw.forwardMessage({
          chat_id,
          from_chat_id,
          message_id,
          ...other
        }, signal);
      }
      forwardMessages(chat_id, from_chat_id, message_ids, other, signal) {
        return this.raw.forwardMessages({
          chat_id,
          from_chat_id,
          message_ids,
          ...other
        }, signal);
      }
      copyMessage(chat_id, from_chat_id, message_id, other, signal) {
        return this.raw.copyMessage({
          chat_id,
          from_chat_id,
          message_id,
          ...other
        }, signal);
      }
      copyMessages(chat_id, from_chat_id, message_ids, other, signal) {
        return this.raw.copyMessages({
          chat_id,
          from_chat_id,
          message_ids,
          ...other
        }, signal);
      }
      sendPhoto(chat_id, photo, other, signal) {
        return this.raw.sendPhoto({
          chat_id,
          photo,
          ...other
        }, signal);
      }
      sendAudio(chat_id, audio, other, signal) {
        return this.raw.sendAudio({
          chat_id,
          audio,
          ...other
        }, signal);
      }
      sendDocument(chat_id, document1, other, signal) {
        return this.raw.sendDocument({
          chat_id,
          document: document1,
          ...other
        }, signal);
      }
      sendVideo(chat_id, video, other, signal) {
        return this.raw.sendVideo({
          chat_id,
          video,
          ...other
        }, signal);
      }
      sendAnimation(chat_id, animation, other, signal) {
        return this.raw.sendAnimation({
          chat_id,
          animation,
          ...other
        }, signal);
      }
      sendVoice(chat_id, voice, other, signal) {
        return this.raw.sendVoice({
          chat_id,
          voice,
          ...other
        }, signal);
      }
      sendVideoNote(chat_id, video_note, other, signal) {
        return this.raw.sendVideoNote({
          chat_id,
          video_note,
          ...other
        }, signal);
      }
      sendMediaGroup(chat_id, media, other, signal) {
        return this.raw.sendMediaGroup({
          chat_id,
          media,
          ...other
        }, signal);
      }
      sendLocation(chat_id, latitude, longitude, other, signal) {
        return this.raw.sendLocation({
          chat_id,
          latitude,
          longitude,
          ...other
        }, signal);
      }
      editMessageLiveLocation(chat_id, message_id, latitude, longitude, other, signal) {
        return this.raw.editMessageLiveLocation({
          chat_id,
          message_id,
          latitude,
          longitude,
          ...other
        }, signal);
      }
      editMessageLiveLocationInline(inline_message_id, latitude, longitude, other, signal) {
        return this.raw.editMessageLiveLocation({
          inline_message_id,
          latitude,
          longitude,
          ...other
        }, signal);
      }
      stopMessageLiveLocation(chat_id, message_id, other, signal) {
        return this.raw.stopMessageLiveLocation({
          chat_id,
          message_id,
          ...other
        }, signal);
      }
      stopMessageLiveLocationInline(inline_message_id, other, signal) {
        return this.raw.stopMessageLiveLocation({
          inline_message_id,
          ...other
        }, signal);
      }
      sendPaidMedia(chat_id, star_count, media, other, signal) {
        return this.raw.sendPaidMedia({
          chat_id,
          star_count,
          media,
          ...other
        }, signal);
      }
      sendVenue(chat_id, latitude, longitude, title2, address, other, signal) {
        return this.raw.sendVenue({
          chat_id,
          latitude,
          longitude,
          title: title2,
          address,
          ...other
        }, signal);
      }
      sendContact(chat_id, phone_number, first_name, other, signal) {
        return this.raw.sendContact({
          chat_id,
          phone_number,
          first_name,
          ...other
        }, signal);
      }
      sendPoll(chat_id, question, options, other, signal) {
        const opts = options.map((o) => typeof o === "string" ? {
          text: o
        } : o);
        return this.raw.sendPoll({
          chat_id,
          question,
          options: opts,
          ...other
        }, signal);
      }
      sendChecklist(business_connection_id, chat_id, checklist, other, signal) {
        return this.raw.sendChecklist({
          business_connection_id,
          chat_id,
          checklist,
          ...other
        }, signal);
      }
      editMessageChecklist(business_connection_id, chat_id, message_id, checklist, other, signal) {
        return this.raw.editMessageChecklist({
          business_connection_id,
          chat_id,
          message_id,
          checklist,
          ...other
        }, signal);
      }
      sendDice(chat_id, emoji, other, signal) {
        return this.raw.sendDice({
          chat_id,
          emoji,
          ...other
        }, signal);
      }
      setMessageReaction(chat_id, message_id, reaction, other, signal) {
        return this.raw.setMessageReaction({
          chat_id,
          message_id,
          reaction,
          ...other
        }, signal);
      }
      sendChatAction(chat_id, action, other, signal) {
        return this.raw.sendChatAction({
          chat_id,
          action,
          ...other
        }, signal);
      }
      getUserProfilePhotos(user_id, other, signal) {
        return this.raw.getUserProfilePhotos({
          user_id,
          ...other
        }, signal);
      }
      setUserEmojiStatus(user_id, other, signal) {
        return this.raw.setUserEmojiStatus({
          user_id,
          ...other
        }, signal);
      }
      getUserChatBoosts(chat_id, user_id, signal) {
        return this.raw.getUserChatBoosts({
          chat_id,
          user_id
        }, signal);
      }
      getBusinessConnection(business_connection_id, signal) {
        return this.raw.getBusinessConnection({
          business_connection_id
        }, signal);
      }
      getFile(file_id, signal) {
        return this.raw.getFile({
          file_id
        }, signal);
      }
      kickChatMember(...args) {
        return this.banChatMember(...args);
      }
      banChatMember(chat_id, user_id, other, signal) {
        return this.raw.banChatMember({
          chat_id,
          user_id,
          ...other
        }, signal);
      }
      unbanChatMember(chat_id, user_id, other, signal) {
        return this.raw.unbanChatMember({
          chat_id,
          user_id,
          ...other
        }, signal);
      }
      restrictChatMember(chat_id, user_id, permissions, other, signal) {
        return this.raw.restrictChatMember({
          chat_id,
          user_id,
          permissions,
          ...other
        }, signal);
      }
      promoteChatMember(chat_id, user_id, other, signal) {
        return this.raw.promoteChatMember({
          chat_id,
          user_id,
          ...other
        }, signal);
      }
      setChatAdministratorCustomTitle(chat_id, user_id, custom_title, signal) {
        return this.raw.setChatAdministratorCustomTitle({
          chat_id,
          user_id,
          custom_title
        }, signal);
      }
      banChatSenderChat(chat_id, sender_chat_id, signal) {
        return this.raw.banChatSenderChat({
          chat_id,
          sender_chat_id
        }, signal);
      }
      unbanChatSenderChat(chat_id, sender_chat_id, signal) {
        return this.raw.unbanChatSenderChat({
          chat_id,
          sender_chat_id
        }, signal);
      }
      setChatPermissions(chat_id, permissions, other, signal) {
        return this.raw.setChatPermissions({
          chat_id,
          permissions,
          ...other
        }, signal);
      }
      exportChatInviteLink(chat_id, signal) {
        return this.raw.exportChatInviteLink({
          chat_id
        }, signal);
      }
      createChatInviteLink(chat_id, other, signal) {
        return this.raw.createChatInviteLink({
          chat_id,
          ...other
        }, signal);
      }
      editChatInviteLink(chat_id, invite_link, other, signal) {
        return this.raw.editChatInviteLink({
          chat_id,
          invite_link,
          ...other
        }, signal);
      }
      createChatSubscriptionInviteLink(chat_id, subscription_period, subscription_price, other, signal) {
        return this.raw.createChatSubscriptionInviteLink({
          chat_id,
          subscription_period,
          subscription_price,
          ...other
        }, signal);
      }
      editChatSubscriptionInviteLink(chat_id, invite_link, other, signal) {
        return this.raw.editChatSubscriptionInviteLink({
          chat_id,
          invite_link,
          ...other
        }, signal);
      }
      revokeChatInviteLink(chat_id, invite_link, signal) {
        return this.raw.revokeChatInviteLink({
          chat_id,
          invite_link
        }, signal);
      }
      approveChatJoinRequest(chat_id, user_id, signal) {
        return this.raw.approveChatJoinRequest({
          chat_id,
          user_id
        }, signal);
      }
      declineChatJoinRequest(chat_id, user_id, signal) {
        return this.raw.declineChatJoinRequest({
          chat_id,
          user_id
        }, signal);
      }
      approveSuggestedPost(chat_id, message_id, other, signal) {
        return this.raw.approveSuggestedPost({
          chat_id,
          message_id,
          ...other
        }, signal);
      }
      declineSuggestedPost(chat_id, message_id, other, signal) {
        return this.raw.declineSuggestedPost({
          chat_id,
          message_id,
          ...other
        }, signal);
      }
      setChatPhoto(chat_id, photo, signal) {
        return this.raw.setChatPhoto({
          chat_id,
          photo
        }, signal);
      }
      deleteChatPhoto(chat_id, signal) {
        return this.raw.deleteChatPhoto({
          chat_id
        }, signal);
      }
      setChatTitle(chat_id, title2, signal) {
        return this.raw.setChatTitle({
          chat_id,
          title: title2
        }, signal);
      }
      setChatDescription(chat_id, description, signal) {
        return this.raw.setChatDescription({
          chat_id,
          description
        }, signal);
      }
      pinChatMessage(chat_id, message_id, other, signal) {
        return this.raw.pinChatMessage({
          chat_id,
          message_id,
          ...other
        }, signal);
      }
      unpinChatMessage(chat_id, message_id, other, signal) {
        return this.raw.unpinChatMessage({
          chat_id,
          message_id,
          ...other
        }, signal);
      }
      unpinAllChatMessages(chat_id, signal) {
        return this.raw.unpinAllChatMessages({
          chat_id
        }, signal);
      }
      leaveChat(chat_id, signal) {
        return this.raw.leaveChat({
          chat_id
        }, signal);
      }
      getChat(chat_id, signal) {
        return this.raw.getChat({
          chat_id
        }, signal);
      }
      getChatAdministrators(chat_id, signal) {
        return this.raw.getChatAdministrators({
          chat_id
        }, signal);
      }
      getChatMembersCount(...args) {
        return this.getChatMemberCount(...args);
      }
      getChatMemberCount(chat_id, signal) {
        return this.raw.getChatMemberCount({
          chat_id
        }, signal);
      }
      getChatMember(chat_id, user_id, signal) {
        return this.raw.getChatMember({
          chat_id,
          user_id
        }, signal);
      }
      setChatStickerSet(chat_id, sticker_set_name, signal) {
        return this.raw.setChatStickerSet({
          chat_id,
          sticker_set_name
        }, signal);
      }
      deleteChatStickerSet(chat_id, signal) {
        return this.raw.deleteChatStickerSet({
          chat_id
        }, signal);
      }
      getForumTopicIconStickers(signal) {
        return this.raw.getForumTopicIconStickers(signal);
      }
      createForumTopic(chat_id, name, other, signal) {
        return this.raw.createForumTopic({
          chat_id,
          name,
          ...other
        }, signal);
      }
      editForumTopic(chat_id, message_thread_id, other, signal) {
        return this.raw.editForumTopic({
          chat_id,
          message_thread_id,
          ...other
        }, signal);
      }
      closeForumTopic(chat_id, message_thread_id, signal) {
        return this.raw.closeForumTopic({
          chat_id,
          message_thread_id
        }, signal);
      }
      reopenForumTopic(chat_id, message_thread_id, signal) {
        return this.raw.reopenForumTopic({
          chat_id,
          message_thread_id
        }, signal);
      }
      deleteForumTopic(chat_id, message_thread_id, signal) {
        return this.raw.deleteForumTopic({
          chat_id,
          message_thread_id
        }, signal);
      }
      unpinAllForumTopicMessages(chat_id, message_thread_id, signal) {
        return this.raw.unpinAllForumTopicMessages({
          chat_id,
          message_thread_id
        }, signal);
      }
      editGeneralForumTopic(chat_id, name, signal) {
        return this.raw.editGeneralForumTopic({
          chat_id,
          name
        }, signal);
      }
      closeGeneralForumTopic(chat_id, signal) {
        return this.raw.closeGeneralForumTopic({
          chat_id
        }, signal);
      }
      reopenGeneralForumTopic(chat_id, signal) {
        return this.raw.reopenGeneralForumTopic({
          chat_id
        }, signal);
      }
      hideGeneralForumTopic(chat_id, signal) {
        return this.raw.hideGeneralForumTopic({
          chat_id
        }, signal);
      }
      unhideGeneralForumTopic(chat_id, signal) {
        return this.raw.unhideGeneralForumTopic({
          chat_id
        }, signal);
      }
      unpinAllGeneralForumTopicMessages(chat_id, signal) {
        return this.raw.unpinAllGeneralForumTopicMessages({
          chat_id
        }, signal);
      }
      answerCallbackQuery(callback_query_id, other, signal) {
        return this.raw.answerCallbackQuery({
          callback_query_id,
          ...other
        }, signal);
      }
      setMyName(name, other, signal) {
        return this.raw.setMyName({
          name,
          ...other
        }, signal);
      }
      getMyName(other, signal) {
        return this.raw.getMyName(other ?? {}, signal);
      }
      setMyCommands(commands, other, signal) {
        return this.raw.setMyCommands({
          commands,
          ...other
        }, signal);
      }
      deleteMyCommands(other, signal) {
        return this.raw.deleteMyCommands({
          ...other
        }, signal);
      }
      getMyCommands(other, signal) {
        return this.raw.getMyCommands({
          ...other
        }, signal);
      }
      setMyDescription(description, other, signal) {
        return this.raw.setMyDescription({
          description,
          ...other
        }, signal);
      }
      getMyDescription(other, signal) {
        return this.raw.getMyDescription({
          ...other
        }, signal);
      }
      setMyShortDescription(short_description, other, signal) {
        return this.raw.setMyShortDescription({
          short_description,
          ...other
        }, signal);
      }
      getMyShortDescription(other, signal) {
        return this.raw.getMyShortDescription({
          ...other
        }, signal);
      }
      setChatMenuButton(other, signal) {
        return this.raw.setChatMenuButton({
          ...other
        }, signal);
      }
      getChatMenuButton(other, signal) {
        return this.raw.getChatMenuButton({
          ...other
        }, signal);
      }
      setMyDefaultAdministratorRights(other, signal) {
        return this.raw.setMyDefaultAdministratorRights({
          ...other
        }, signal);
      }
      getMyDefaultAdministratorRights(other, signal) {
        return this.raw.getMyDefaultAdministratorRights({
          ...other
        }, signal);
      }
      getMyStarBalance(signal) {
        return this.raw.getMyStarBalance(signal);
      }
      editMessageText(chat_id, message_id, text, other, signal) {
        return this.raw.editMessageText({
          chat_id,
          message_id,
          text,
          ...other
        }, signal);
      }
      editMessageTextInline(inline_message_id, text, other, signal) {
        return this.raw.editMessageText({
          inline_message_id,
          text,
          ...other
        }, signal);
      }
      editMessageCaption(chat_id, message_id, other, signal) {
        return this.raw.editMessageCaption({
          chat_id,
          message_id,
          ...other
        }, signal);
      }
      editMessageCaptionInline(inline_message_id, other, signal) {
        return this.raw.editMessageCaption({
          inline_message_id,
          ...other
        }, signal);
      }
      editMessageMedia(chat_id, message_id, media, other, signal) {
        return this.raw.editMessageMedia({
          chat_id,
          message_id,
          media,
          ...other
        }, signal);
      }
      editMessageMediaInline(inline_message_id, media, other, signal) {
        return this.raw.editMessageMedia({
          inline_message_id,
          media,
          ...other
        }, signal);
      }
      editMessageReplyMarkup(chat_id, message_id, other, signal) {
        return this.raw.editMessageReplyMarkup({
          chat_id,
          message_id,
          ...other
        }, signal);
      }
      editMessageReplyMarkupInline(inline_message_id, other, signal) {
        return this.raw.editMessageReplyMarkup({
          inline_message_id,
          ...other
        }, signal);
      }
      stopPoll(chat_id, message_id, other, signal) {
        return this.raw.stopPoll({
          chat_id,
          message_id,
          ...other
        }, signal);
      }
      deleteMessage(chat_id, message_id, signal) {
        return this.raw.deleteMessage({
          chat_id,
          message_id
        }, signal);
      }
      deleteMessages(chat_id, message_ids, signal) {
        return this.raw.deleteMessages({
          chat_id,
          message_ids
        }, signal);
      }
      deleteBusinessMessages(business_connection_id, message_ids, signal) {
        return this.raw.deleteBusinessMessages({
          business_connection_id,
          message_ids
        }, signal);
      }
      setBusinessAccountName(business_connection_id, first_name, other, signal) {
        return this.raw.setBusinessAccountName({
          business_connection_id,
          first_name,
          ...other
        }, signal);
      }
      setBusinessAccountUsername(business_connection_id, username, signal) {
        return this.raw.setBusinessAccountUsername({
          business_connection_id,
          username
        }, signal);
      }
      setBusinessAccountBio(business_connection_id, bio, signal) {
        return this.raw.setBusinessAccountBio({
          business_connection_id,
          bio
        }, signal);
      }
      setBusinessAccountProfilePhoto(business_connection_id, photo, other, signal) {
        return this.raw.setBusinessAccountProfilePhoto({
          business_connection_id,
          photo,
          ...other
        }, signal);
      }
      removeBusinessAccountProfilePhoto(business_connection_id, other, signal) {
        return this.raw.removeBusinessAccountProfilePhoto({
          business_connection_id,
          ...other
        }, signal);
      }
      setBusinessAccountGiftSettings(business_connection_id, show_gift_button, accepted_gift_types, signal) {
        return this.raw.setBusinessAccountGiftSettings({
          business_connection_id,
          show_gift_button,
          accepted_gift_types
        }, signal);
      }
      getBusinessAccountStarBalance(business_connection_id, signal) {
        return this.raw.getBusinessAccountStarBalance({
          business_connection_id
        }, signal);
      }
      transferBusinessAccountStars(business_connection_id, star_count, signal) {
        return this.raw.transferBusinessAccountStars({
          business_connection_id,
          star_count
        }, signal);
      }
      getBusinessAccountGifts(business_connection_id, other, signal) {
        return this.raw.getBusinessAccountGifts({
          business_connection_id,
          ...other
        }, signal);
      }
      convertGiftToStars(business_connection_id, owned_gift_id, signal) {
        return this.raw.convertGiftToStars({
          business_connection_id,
          owned_gift_id
        }, signal);
      }
      upgradeGift(business_connection_id, owned_gift_id, other, signal) {
        return this.raw.upgradeGift({
          business_connection_id,
          owned_gift_id,
          ...other
        }, signal);
      }
      transferGift(business_connection_id, owned_gift_id, new_owner_chat_id, star_count, signal) {
        return this.raw.transferGift({
          business_connection_id,
          owned_gift_id,
          new_owner_chat_id,
          star_count
        }, signal);
      }
      postStory(business_connection_id, content, active_period, other, signal) {
        return this.raw.postStory({
          business_connection_id,
          content,
          active_period,
          ...other
        }, signal);
      }
      editStory(business_connection_id, story_id, content, other, signal) {
        return this.raw.editStory({
          business_connection_id,
          story_id,
          content,
          ...other
        }, signal);
      }
      deleteStory(business_connection_id, story_id, signal) {
        return this.raw.deleteStory({
          business_connection_id,
          story_id
        }, signal);
      }
      sendSticker(chat_id, sticker, other, signal) {
        return this.raw.sendSticker({
          chat_id,
          sticker,
          ...other
        }, signal);
      }
      getStickerSet(name, signal) {
        return this.raw.getStickerSet({
          name
        }, signal);
      }
      getCustomEmojiStickers(custom_emoji_ids, signal) {
        return this.raw.getCustomEmojiStickers({
          custom_emoji_ids
        }, signal);
      }
      uploadStickerFile(user_id, sticker_format, sticker, signal) {
        return this.raw.uploadStickerFile({
          user_id,
          sticker_format,
          sticker
        }, signal);
      }
      createNewStickerSet(user_id, name, title2, stickers, other, signal) {
        return this.raw.createNewStickerSet({
          user_id,
          name,
          title: title2,
          stickers,
          ...other
        }, signal);
      }
      addStickerToSet(user_id, name, sticker, signal) {
        return this.raw.addStickerToSet({
          user_id,
          name,
          sticker
        }, signal);
      }
      setStickerPositionInSet(sticker, position, signal) {
        return this.raw.setStickerPositionInSet({
          sticker,
          position
        }, signal);
      }
      deleteStickerFromSet(sticker, signal) {
        return this.raw.deleteStickerFromSet({
          sticker
        }, signal);
      }
      replaceStickerInSet(user_id, name, old_sticker, sticker, signal) {
        return this.raw.replaceStickerInSet({
          user_id,
          name,
          old_sticker,
          sticker
        }, signal);
      }
      setStickerEmojiList(sticker, emoji_list, signal) {
        return this.raw.setStickerEmojiList({
          sticker,
          emoji_list
        }, signal);
      }
      setStickerKeywords(sticker, keywords, signal) {
        return this.raw.setStickerKeywords({
          sticker,
          keywords
        }, signal);
      }
      setStickerMaskPosition(sticker, mask_position, signal) {
        return this.raw.setStickerMaskPosition({
          sticker,
          mask_position
        }, signal);
      }
      setStickerSetTitle(name, title2, signal) {
        return this.raw.setStickerSetTitle({
          name,
          title: title2
        }, signal);
      }
      deleteStickerSet(name, signal) {
        return this.raw.deleteStickerSet({
          name
        }, signal);
      }
      setStickerSetThumbnail(name, user_id, thumbnail, format, signal) {
        return this.raw.setStickerSetThumbnail({
          name,
          user_id,
          thumbnail,
          format
        }, signal);
      }
      setCustomEmojiStickerSetThumbnail(name, custom_emoji_id, signal) {
        return this.raw.setCustomEmojiStickerSetThumbnail({
          name,
          custom_emoji_id
        }, signal);
      }
      getAvailableGifts(signal) {
        return this.raw.getAvailableGifts(signal);
      }
      sendGift(user_id, gift_id, other, signal) {
        return this.raw.sendGift({
          user_id,
          gift_id,
          ...other
        }, signal);
      }
      giftPremiumSubscription(user_id, month_count, star_count, other, signal) {
        return this.raw.giftPremiumSubscription({
          user_id,
          month_count,
          star_count,
          ...other
        }, signal);
      }
      sendGiftToChannel(chat_id, gift_id, other, signal) {
        return this.raw.sendGift({
          chat_id,
          gift_id,
          ...other
        }, signal);
      }
      answerInlineQuery(inline_query_id, results, other, signal) {
        return this.raw.answerInlineQuery({
          inline_query_id,
          results,
          ...other
        }, signal);
      }
      answerWebAppQuery(web_app_query_id, result, signal) {
        return this.raw.answerWebAppQuery({
          web_app_query_id,
          result
        }, signal);
      }
      savePreparedInlineMessage(user_id, result, other, signal) {
        return this.raw.savePreparedInlineMessage({
          user_id,
          result,
          ...other
        }, signal);
      }
      sendInvoice(chat_id, title2, description, payload, currency, prices, other, signal) {
        return this.raw.sendInvoice({
          chat_id,
          title: title2,
          description,
          payload,
          currency,
          prices,
          ...other
        }, signal);
      }
      createInvoiceLink(title2, description, payload, provider_token, currency, prices, other, signal) {
        return this.raw.createInvoiceLink({
          title: title2,
          description,
          payload,
          provider_token,
          currency,
          prices,
          ...other
        }, signal);
      }
      answerShippingQuery(shipping_query_id, ok2, other, signal) {
        return this.raw.answerShippingQuery({
          shipping_query_id,
          ok: ok2,
          ...other
        }, signal);
      }
      answerPreCheckoutQuery(pre_checkout_query_id, ok2, other, signal) {
        return this.raw.answerPreCheckoutQuery({
          pre_checkout_query_id,
          ok: ok2,
          ...other
        }, signal);
      }
      getStarTransactions(other, signal) {
        return this.raw.getStarTransactions({
          ...other
        }, signal);
      }
      refundStarPayment(user_id, telegram_payment_charge_id, signal) {
        return this.raw.refundStarPayment({
          user_id,
          telegram_payment_charge_id
        }, signal);
      }
      editUserStarSubscription(user_id, telegram_payment_charge_id, is_canceled, signal) {
        return this.raw.editUserStarSubscription({
          user_id,
          telegram_payment_charge_id,
          is_canceled
        }, signal);
      }
      verifyUser(user_id, other, signal) {
        return this.raw.verifyUser({
          user_id,
          ...other
        }, signal);
      }
      verifyChat(chat_id, other, signal) {
        return this.raw.verifyChat({
          chat_id,
          ...other
        }, signal);
      }
      removeUserVerification(user_id, signal) {
        return this.raw.removeUserVerification({
          user_id
        }, signal);
      }
      removeChatVerification(chat_id, signal) {
        return this.raw.removeChatVerification({
          chat_id
        }, signal);
      }
      readBusinessMessage(business_connection_id, chat_id, message_id, signal) {
        return this.raw.readBusinessMessage({
          business_connection_id,
          chat_id,
          message_id
        }, signal);
      }
      setPassportDataErrors(user_id, errors, signal) {
        return this.raw.setPassportDataErrors({
          user_id,
          errors
        }, signal);
      }
      sendGame(chat_id, game_short_name, other, signal) {
        return this.raw.sendGame({
          chat_id,
          game_short_name,
          ...other
        }, signal);
      }
      setGameScore(chat_id, message_id, user_id, score, other, signal) {
        return this.raw.setGameScore({
          chat_id,
          message_id,
          user_id,
          score,
          ...other
        }, signal);
      }
      setGameScoreInline(inline_message_id, user_id, score, other, signal) {
        return this.raw.setGameScore({
          inline_message_id,
          user_id,
          score,
          ...other
        }, signal);
      }
      getGameHighScores(chat_id, message_id, user_id, signal) {
        return this.raw.getGameHighScores({
          chat_id,
          message_id,
          user_id
        }, signal);
      }
      getGameHighScoresInline(inline_message_id, user_id, signal) {
        return this.raw.getGameHighScores({
          inline_message_id,
          user_id
        }, signal);
      }
    };
    __name(Api, "Api");
    debug2 = browser$1("grammy:bot");
    debugWarn = browser$1("grammy:warn");
    debugErr = browser$1("grammy:error");
    DEFAULT_UPDATE_TYPES = [
      "message",
      "edited_message",
      "channel_post",
      "edited_channel_post",
      "business_connection",
      "business_message",
      "edited_business_message",
      "deleted_business_messages",
      "inline_query",
      "chosen_inline_result",
      "callback_query",
      "shipping_query",
      "pre_checkout_query",
      "purchased_paid_media",
      "poll",
      "poll_answer",
      "my_chat_member",
      "chat_join_request",
      "chat_boost",
      "removed_chat_boost"
    ];
    Bot = class extends Composer {
      token;
      pollingRunning;
      pollingAbortController;
      lastTriedUpdateId;
      api;
      me;
      mePromise;
      clientConfig;
      ContextConstructor;
      observedUpdateTypes;
      errorHandler;
      constructor(token, config2) {
        super();
        this.token = token;
        this.pollingRunning = false;
        this.lastTriedUpdateId = 0;
        this.observedUpdateTypes = /* @__PURE__ */ new Set();
        this.errorHandler = async (err) => {
          console.error("Error in middleware while handling update", err.ctx?.update?.update_id, err.error);
          console.error("No error handler was set!");
          console.error("Set your own error handler with `bot.catch = ...`");
          if (this.pollingRunning) {
            console.error("Stopping bot");
            await this.stop();
          }
          throw err;
        };
        if (!token)
          throw new Error("Empty token!");
        this.me = config2?.botInfo;
        this.clientConfig = config2?.client;
        this.ContextConstructor = config2?.ContextConstructor ?? Context;
        this.api = new Api(token, this.clientConfig);
      }
      set botInfo(botInfo) {
        this.me = botInfo;
      }
      get botInfo() {
        if (this.me === void 0) {
          throw new Error("Bot information unavailable! Make sure to call `await bot.init()` before accessing `bot.botInfo`!");
        }
        return this.me;
      }
      on(filter, ...middleware) {
        for (const [u] of parse(filter).flatMap(preprocess)) {
          this.observedUpdateTypes.add(u);
        }
        return super.on(filter, ...middleware);
      }
      reaction(reaction, ...middleware) {
        this.observedUpdateTypes.add("message_reaction");
        return super.reaction(reaction, ...middleware);
      }
      isInited() {
        return this.me !== void 0;
      }
      async init(signal) {
        if (!this.isInited()) {
          debug2("Initializing bot");
          this.mePromise ??= withRetries(() => this.api.getMe(signal), signal);
          let me;
          try {
            me = await this.mePromise;
          } finally {
            this.mePromise = void 0;
          }
          if (this.me === void 0)
            this.me = me;
          else
            debug2("Bot info was set by now, will not overwrite");
        }
        debug2(`I am ${this.me.username}!`);
      }
      async handleUpdates(updates) {
        for (const update of updates) {
          this.lastTriedUpdateId = update.update_id;
          try {
            await this.handleUpdate(update);
          } catch (err) {
            if (err instanceof BotError) {
              await this.errorHandler(err);
            } else {
              console.error("FATAL: grammY unable to handle:", err);
              throw err;
            }
          }
        }
      }
      async handleUpdate(update, webhookReplyEnvelope) {
        if (this.me === void 0) {
          throw new Error("Bot not initialized! Either call `await bot.init()`, or directly set the `botInfo` option in the `Bot` constructor to specify a known bot info object.");
        }
        debug2(`Processing update ${update.update_id}`);
        const api = new Api(this.token, this.clientConfig, webhookReplyEnvelope);
        const t = this.api.config.installedTransformers();
        if (t.length > 0)
          api.config.use(...t);
        const ctx = new this.ContextConstructor(update, api, this.me);
        try {
          await run(this.middleware(), ctx);
        } catch (err) {
          debugErr(`Error in middleware for update ${update.update_id}`);
          throw new BotError(err, ctx);
        }
      }
      async start(options) {
        const setup2 = [];
        if (!this.isInited()) {
          setup2.push(this.init(this.pollingAbortController?.signal));
        }
        if (this.pollingRunning) {
          await Promise.all(setup2);
          debug2("Simple long polling already running!");
          return;
        }
        this.pollingRunning = true;
        this.pollingAbortController = new AbortController();
        try {
          setup2.push(withRetries(async () => {
            await this.api.deleteWebhook({
              drop_pending_updates: options?.drop_pending_updates
            }, this.pollingAbortController?.signal);
          }, this.pollingAbortController?.signal));
          await Promise.all(setup2);
          await options?.onStart?.(this.botInfo);
        } catch (err) {
          this.pollingRunning = false;
          this.pollingAbortController = void 0;
          throw err;
        }
        if (!this.pollingRunning)
          return;
        validateAllowedUpdates(this.observedUpdateTypes, options?.allowed_updates);
        this.use = noUseFunction;
        debug2("Starting simple long polling");
        await this.loop(options);
        debug2("Middleware is done running");
      }
      async stop() {
        if (this.pollingRunning) {
          debug2("Stopping bot, saving update offset");
          this.pollingRunning = false;
          this.pollingAbortController?.abort();
          const offset = this.lastTriedUpdateId + 1;
          await this.api.getUpdates({
            offset,
            limit: 1
          }).finally(() => this.pollingAbortController = void 0);
        } else {
          debug2("Bot is not running!");
        }
      }
      isRunning() {
        return this.pollingRunning;
      }
      catch(errorHandler2) {
        this.errorHandler = errorHandler2;
      }
      async loop(options) {
        const limit2 = options?.limit;
        const timeout = options?.timeout ?? 30;
        let allowed_updates = options?.allowed_updates ?? [];
        try {
          while (this.pollingRunning) {
            const updates = await this.fetchUpdates({
              limit: limit2,
              timeout,
              allowed_updates
            });
            if (updates === void 0)
              break;
            await this.handleUpdates(updates);
            allowed_updates = void 0;
          }
        } finally {
          this.pollingRunning = false;
        }
      }
      async fetchUpdates({ limit: limit2, timeout, allowed_updates }) {
        const offset = this.lastTriedUpdateId + 1;
        let updates = void 0;
        do {
          try {
            updates = await this.api.getUpdates({
              offset,
              limit: limit2,
              timeout,
              allowed_updates
            }, this.pollingAbortController?.signal);
          } catch (error) {
            await this.handlePollingError(error);
          }
        } while (updates === void 0 && this.pollingRunning);
        return updates;
      }
      async handlePollingError(error) {
        if (!this.pollingRunning) {
          debug2("Pending getUpdates request cancelled");
          return;
        }
        let sleepSeconds = 3;
        if (error instanceof GrammyError) {
          debugErr(error.message);
          if (error.error_code === 401 || error.error_code === 409) {
            throw error;
          } else if (error.error_code === 429) {
            debugErr("Bot API server is closing.");
            sleepSeconds = error.parameters.retry_after ?? sleepSeconds;
          }
        } else
          debugErr(error);
        debugErr(`Call to getUpdates failed, retrying in ${sleepSeconds} seconds ...`);
        await sleep(sleepSeconds);
      }
    };
    __name(Bot, "Bot");
    __name(withRetries, "withRetries");
    __name(sleep, "sleep");
    __name(validateAllowedUpdates, "validateAllowedUpdates");
    __name(noUseFunction, "noUseFunction");
    ALL_UPDATE_TYPES = [
      ...DEFAULT_UPDATE_TYPES,
      "chat_member",
      "message_reaction",
      "message_reaction_count"
    ];
    ALL_CHAT_PERMISSIONS = {
      is_anonymous: true,
      can_manage_chat: true,
      can_delete_messages: true,
      can_manage_video_chats: true,
      can_restrict_members: true,
      can_promote_members: true,
      can_change_info: true,
      can_invite_users: true,
      can_post_stories: true,
      can_edit_stories: true,
      can_delete_stories: true,
      can_post_messages: true,
      can_edit_messages: true,
      can_pin_messages: true,
      can_manage_topics: true
    };
    API_CONSTANTS = {
      DEFAULT_UPDATE_TYPES,
      ALL_UPDATE_TYPES,
      ALL_CHAT_PERMISSIONS
    };
    Object.freeze(API_CONSTANTS);
    __name(inputMessage, "inputMessage");
    __name(inputMessageMethods, "inputMessageMethods");
    InlineQueryResultBuilder = {
      article(id, title2, options = {}) {
        return inputMessageMethods({
          type: "article",
          id,
          title: title2,
          ...options
        });
      },
      audio(id, title2, audio_url, options = {}) {
        return inputMessage({
          type: "audio",
          id,
          title: title2,
          audio_url: typeof audio_url === "string" ? audio_url : audio_url.href,
          ...options
        });
      },
      audioCached(id, audio_file_id, options = {}) {
        return inputMessage({
          type: "audio",
          id,
          audio_file_id,
          ...options
        });
      },
      contact(id, phone_number, first_name, options = {}) {
        return inputMessage({
          type: "contact",
          id,
          phone_number,
          first_name,
          ...options
        });
      },
      documentPdf(id, title2, document_url, options = {}) {
        return inputMessage({
          type: "document",
          mime_type: "application/pdf",
          id,
          title: title2,
          document_url: typeof document_url === "string" ? document_url : document_url.href,
          ...options
        });
      },
      documentZip(id, title2, document_url, options = {}) {
        return inputMessage({
          type: "document",
          mime_type: "application/zip",
          id,
          title: title2,
          document_url: typeof document_url === "string" ? document_url : document_url.href,
          ...options
        });
      },
      documentCached(id, title2, document_file_id, options = {}) {
        return inputMessage({
          type: "document",
          id,
          title: title2,
          document_file_id,
          ...options
        });
      },
      game(id, game_short_name, options = {}) {
        return {
          type: "game",
          id,
          game_short_name,
          ...options
        };
      },
      gif(id, gif_url, thumbnail_url, options = {}) {
        return inputMessage({
          type: "gif",
          id,
          gif_url: typeof gif_url === "string" ? gif_url : gif_url.href,
          thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
          ...options
        });
      },
      gifCached(id, gif_file_id, options = {}) {
        return inputMessage({
          type: "gif",
          id,
          gif_file_id,
          ...options
        });
      },
      location(id, title2, latitude, longitude, options = {}) {
        return inputMessage({
          type: "location",
          id,
          title: title2,
          latitude,
          longitude,
          ...options
        });
      },
      mpeg4gif(id, mpeg4_url, thumbnail_url, options = {}) {
        return inputMessage({
          type: "mpeg4_gif",
          id,
          mpeg4_url: typeof mpeg4_url === "string" ? mpeg4_url : mpeg4_url.href,
          thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
          ...options
        });
      },
      mpeg4gifCached(id, mpeg4_file_id, options = {}) {
        return inputMessage({
          type: "mpeg4_gif",
          id,
          mpeg4_file_id,
          ...options
        });
      },
      photo(id, photo_url, options = {
        thumbnail_url: typeof photo_url === "string" ? photo_url : photo_url.href
      }) {
        return inputMessage({
          type: "photo",
          id,
          photo_url: typeof photo_url === "string" ? photo_url : photo_url.href,
          ...options
        });
      },
      photoCached(id, photo_file_id, options = {}) {
        return inputMessage({
          type: "photo",
          id,
          photo_file_id,
          ...options
        });
      },
      stickerCached(id, sticker_file_id, options = {}) {
        return inputMessage({
          type: "sticker",
          id,
          sticker_file_id,
          ...options
        });
      },
      venue(id, title2, latitude, longitude, address, options = {}) {
        return inputMessage({
          type: "venue",
          id,
          title: title2,
          latitude,
          longitude,
          address,
          ...options
        });
      },
      videoHtml(id, title2, video_url, thumbnail_url, options = {}) {
        return inputMessageMethods({
          type: "video",
          mime_type: "text/html",
          id,
          title: title2,
          video_url: typeof video_url === "string" ? video_url : video_url.href,
          thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
          ...options
        });
      },
      videoMp4(id, title2, video_url, thumbnail_url, options = {}) {
        return inputMessage({
          type: "video",
          mime_type: "video/mp4",
          id,
          title: title2,
          video_url: typeof video_url === "string" ? video_url : video_url.href,
          thumbnail_url: typeof thumbnail_url === "string" ? thumbnail_url : thumbnail_url.href,
          ...options
        });
      },
      videoCached(id, title2, video_file_id, options = {}) {
        return inputMessage({
          type: "video",
          id,
          title: title2,
          video_file_id,
          ...options
        });
      },
      voice(id, title2, voice_url, options = {}) {
        return inputMessage({
          type: "voice",
          id,
          title: title2,
          voice_url: typeof voice_url === "string" ? voice_url : voice_url.href,
          ...options
        });
      },
      voiceCached(id, title2, voice_file_id, options = {}) {
        return inputMessage({
          type: "voice",
          id,
          title: title2,
          voice_file_id,
          ...options
        });
      }
    };
    InputMediaBuilder = {
      photo(media, options = {}) {
        return {
          type: "photo",
          media,
          ...options
        };
      },
      video(media, options = {}) {
        return {
          type: "video",
          media,
          ...options
        };
      },
      animation(media, options = {}) {
        return {
          type: "animation",
          media,
          ...options
        };
      },
      audio(media, options = {}) {
        return {
          type: "audio",
          media,
          ...options
        };
      },
      document(media, options = {}) {
        return {
          type: "document",
          media,
          ...options
        };
      }
    };
    Keyboard = class {
      keyboard;
      is_persistent;
      selective;
      one_time_keyboard;
      resize_keyboard;
      input_field_placeholder;
      constructor(keyboard = [
        []
      ]) {
        this.keyboard = keyboard;
      }
      add(...buttons) {
        this.keyboard[this.keyboard.length - 1]?.push(...buttons);
        return this;
      }
      row(...buttons) {
        this.keyboard.push(buttons);
        return this;
      }
      text(text) {
        return this.add(Keyboard.text(text));
      }
      static text(text) {
        return {
          text
        };
      }
      requestUsers(text, requestId, options = {}) {
        return this.add(Keyboard.requestUsers(text, requestId, options));
      }
      static requestUsers(text, requestId, options = {}) {
        return {
          text,
          request_users: {
            request_id: requestId,
            ...options
          }
        };
      }
      requestChat(text, requestId, options = {
        chat_is_channel: false
      }) {
        return this.add(Keyboard.requestChat(text, requestId, options));
      }
      static requestChat(text, requestId, options = {
        chat_is_channel: false
      }) {
        return {
          text,
          request_chat: {
            request_id: requestId,
            ...options
          }
        };
      }
      requestContact(text) {
        return this.add(Keyboard.requestContact(text));
      }
      static requestContact(text) {
        return {
          text,
          request_contact: true
        };
      }
      requestLocation(text) {
        return this.add(Keyboard.requestLocation(text));
      }
      static requestLocation(text) {
        return {
          text,
          request_location: true
        };
      }
      requestPoll(text, type) {
        return this.add(Keyboard.requestPoll(text, type));
      }
      static requestPoll(text, type) {
        return {
          text,
          request_poll: {
            type
          }
        };
      }
      webApp(text, url) {
        return this.add(Keyboard.webApp(text, url));
      }
      static webApp(text, url) {
        return {
          text,
          web_app: {
            url
          }
        };
      }
      persistent(isEnabled = true) {
        this.is_persistent = isEnabled;
        return this;
      }
      selected(isEnabled = true) {
        this.selective = isEnabled;
        return this;
      }
      oneTime(isEnabled = true) {
        this.one_time_keyboard = isEnabled;
        return this;
      }
      resized(isEnabled = true) {
        this.resize_keyboard = isEnabled;
        return this;
      }
      placeholder(value) {
        this.input_field_placeholder = value;
        return this;
      }
      toTransposed() {
        const original = this.keyboard;
        const transposed = transpose(original);
        return this.clone(transposed);
      }
      toFlowed(columns, options = {}) {
        const original = this.keyboard;
        const flowed = reflow(original, columns, options);
        return this.clone(flowed);
      }
      clone(keyboard = this.keyboard) {
        const clone = new Keyboard(keyboard.map((row) => row.slice()));
        clone.is_persistent = this.is_persistent;
        clone.selective = this.selective;
        clone.one_time_keyboard = this.one_time_keyboard;
        clone.resize_keyboard = this.resize_keyboard;
        clone.input_field_placeholder = this.input_field_placeholder;
        return clone;
      }
      append(...sources) {
        for (const source of sources) {
          const keyboard = Keyboard.from(source);
          this.keyboard.push(...keyboard.keyboard.map((row) => row.slice()));
        }
        return this;
      }
      build() {
        return this.keyboard;
      }
      static from(source) {
        if (source instanceof Keyboard)
          return source.clone();
        function toButton(btn) {
          return typeof btn === "string" ? Keyboard.text(btn) : btn;
        }
        __name(toButton, "toButton");
        return new Keyboard(source.map((row) => row.map(toButton)));
      }
    };
    __name(Keyboard, "Keyboard");
    InlineKeyboard = class {
      inline_keyboard;
      constructor(inline_keyboard = [
        []
      ]) {
        this.inline_keyboard = inline_keyboard;
      }
      add(...buttons) {
        this.inline_keyboard[this.inline_keyboard.length - 1]?.push(...buttons);
        return this;
      }
      row(...buttons) {
        this.inline_keyboard.push(buttons);
        return this;
      }
      url(text, url) {
        return this.add(InlineKeyboard.url(text, url));
      }
      static url(text, url) {
        return {
          text,
          url
        };
      }
      text(text, data = text) {
        return this.add(InlineKeyboard.text(text, data));
      }
      static text(text, data = text) {
        return {
          text,
          callback_data: data
        };
      }
      webApp(text, url) {
        return this.add(InlineKeyboard.webApp(text, url));
      }
      static webApp(text, url) {
        return {
          text,
          web_app: typeof url === "string" ? {
            url
          } : url
        };
      }
      login(text, loginUrl) {
        return this.add(InlineKeyboard.login(text, loginUrl));
      }
      static login(text, loginUrl) {
        return {
          text,
          login_url: typeof loginUrl === "string" ? {
            url: loginUrl
          } : loginUrl
        };
      }
      switchInline(text, query = "") {
        return this.add(InlineKeyboard.switchInline(text, query));
      }
      static switchInline(text, query = "") {
        return {
          text,
          switch_inline_query: query
        };
      }
      switchInlineCurrent(text, query = "") {
        return this.add(InlineKeyboard.switchInlineCurrent(text, query));
      }
      static switchInlineCurrent(text, query = "") {
        return {
          text,
          switch_inline_query_current_chat: query
        };
      }
      switchInlineChosen(text, query = {}) {
        return this.add(InlineKeyboard.switchInlineChosen(text, query));
      }
      static switchInlineChosen(text, query = {}) {
        return {
          text,
          switch_inline_query_chosen_chat: query
        };
      }
      copyText(text, copyText) {
        return this.add(InlineKeyboard.copyText(text, copyText));
      }
      static copyText(text, copyText) {
        return {
          text,
          copy_text: typeof copyText === "string" ? {
            text: copyText
          } : copyText
        };
      }
      game(text) {
        return this.add(InlineKeyboard.game(text));
      }
      static game(text) {
        return {
          text,
          callback_game: {}
        };
      }
      pay(text) {
        return this.add(InlineKeyboard.pay(text));
      }
      static pay(text) {
        return {
          text,
          pay: true
        };
      }
      toTransposed() {
        const original = this.inline_keyboard;
        const transposed = transpose(original);
        return new InlineKeyboard(transposed);
      }
      toFlowed(columns, options = {}) {
        const original = this.inline_keyboard;
        const flowed = reflow(original, columns, options);
        return new InlineKeyboard(flowed);
      }
      clone() {
        return new InlineKeyboard(this.inline_keyboard.map((row) => row.slice()));
      }
      append(...sources) {
        for (const source of sources) {
          const keyboard = InlineKeyboard.from(source);
          this.inline_keyboard.push(...keyboard.inline_keyboard.map((row) => row.slice()));
        }
        return this;
      }
      static from(source) {
        if (source instanceof InlineKeyboard)
          return source.clone();
        return new InlineKeyboard(source.map((row) => row.slice()));
      }
    };
    __name(InlineKeyboard, "InlineKeyboard");
    __name(transpose, "transpose");
    __name(reflow, "reflow");
    debug3 = browser$1("grammy:session");
    __name(session, "session");
    __name(strictSingleSession, "strictSingleSession");
    __name(strictMultiSession, "strictMultiSession");
    __name(lazySession, "lazySession");
    PropertySession = class {
      storage;
      obj;
      prop;
      initial;
      key;
      value;
      promise;
      fetching;
      read;
      wrote;
      constructor(storage, obj, prop, initial) {
        this.storage = storage;
        this.obj = obj;
        this.prop = prop;
        this.initial = initial;
        this.fetching = false;
        this.read = false;
        this.wrote = false;
      }
      load() {
        if (this.key === void 0) {
          return;
        }
        if (this.wrote) {
          return;
        }
        if (this.promise === void 0) {
          this.fetching = true;
          this.promise = Promise.resolve(this.storage.read(this.key)).then((val) => {
            this.fetching = false;
            if (this.wrote) {
              return this.value;
            }
            if (val !== void 0) {
              this.value = val;
              return val;
            }
            val = this.initial?.();
            if (val !== void 0) {
              this.wrote = true;
              this.value = val;
            }
            return val;
          });
        }
        return this.promise;
      }
      async init(key, opts) {
        this.key = key;
        if (!opts.lazy)
          await this.load();
        Object.defineProperty(this.obj, this.prop, {
          enumerable: true,
          get: () => {
            if (key === void 0) {
              const msg = undef("access", opts);
              throw new Error(msg);
            }
            this.read = true;
            if (!opts.lazy || this.wrote)
              return this.value;
            this.load();
            return this.fetching ? this.promise : this.value;
          },
          set: (v) => {
            if (key === void 0) {
              const msg = undef("assign", opts);
              throw new Error(msg);
            }
            this.wrote = true;
            this.fetching = false;
            this.value = v;
          }
        });
      }
      delete() {
        Object.assign(this.obj, {
          [this.prop]: void 0
        });
      }
      async finish() {
        if (this.key !== void 0) {
          if (this.read)
            await this.load();
          if (this.read || this.wrote) {
            const value = await this.value;
            if (value == null)
              await this.storage.delete(this.key);
            else
              await this.storage.write(this.key, value);
          }
        }
      }
    };
    __name(PropertySession, "PropertySession");
    __name(fillDefaults, "fillDefaults");
    __name(defaultGetSessionKey, "defaultGetSessionKey");
    __name(undef, "undef");
    __name(isEnhance, "isEnhance");
    __name(enhanceStorage, "enhanceStorage");
    __name(compatStorage, "compatStorage");
    __name(timeoutStorage, "timeoutStorage");
    __name(migrationStorage, "migrationStorage");
    __name(wrapStorage, "wrapStorage");
    MemorySessionStorage = class {
      timeToLive;
      storage;
      constructor(timeToLive) {
        this.timeToLive = timeToLive;
        this.storage = /* @__PURE__ */ new Map();
      }
      read(key) {
        const value = this.storage.get(key);
        if (value === void 0)
          return void 0;
        if (value.expires !== void 0 && value.expires < Date.now()) {
          this.delete(key);
          return void 0;
        }
        return value.session;
      }
      readAll() {
        return this.readAllValues();
      }
      readAllKeys() {
        return Array.from(this.storage.keys());
      }
      readAllValues() {
        return Array.from(this.storage.keys()).map((key) => this.read(key)).filter((value) => value !== void 0);
      }
      readAllEntries() {
        return Array.from(this.storage.keys()).map((key) => [
          key,
          this.read(key)
        ]).filter((pair) => pair[1] !== void 0);
      }
      has(key) {
        return this.storage.has(key);
      }
      write(key, value) {
        this.storage.set(key, addExpiryDate(value, this.timeToLive));
      }
      delete(key) {
        this.storage.delete(key);
      }
    };
    __name(MemorySessionStorage, "MemorySessionStorage");
    __name(addExpiryDate, "addExpiryDate");
    SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
    SECRET_HEADER_LOWERCASE = SECRET_HEADER.toLowerCase();
    WRONG_TOKEN_ERROR = "secret token is wrong";
    ok = /* @__PURE__ */ __name(() => new Response(null, {
      status: 200
    }), "ok");
    okJson = /* @__PURE__ */ __name((json) => new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    }), "okJson");
    unauthorized = /* @__PURE__ */ __name(() => new Response('"unauthorized"', {
      status: 401,
      statusText: WRONG_TOKEN_ERROR
    }), "unauthorized");
    awsLambda = /* @__PURE__ */ __name((event, _context, callback) => ({
      get update() {
        return JSON.parse(event.body ?? "{}");
      },
      header: event.headers[SECRET_HEADER],
      end: () => callback(null, {
        statusCode: 200
      }),
      respond: (json) => callback(null, {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json"
        },
        body: json
      }),
      unauthorized: () => callback(null, {
        statusCode: 401
      })
    }), "awsLambda");
    awsLambdaAsync = /* @__PURE__ */ __name((event, _context) => {
      let resolveResponse;
      return {
        get update() {
          return JSON.parse(event.body ?? "{}");
        },
        header: event.headers[SECRET_HEADER],
        end: () => resolveResponse({
          statusCode: 200
        }),
        respond: (json) => resolveResponse({
          statusCode: 200,
          headers: {
            "Content-Type": "application/json"
          },
          body: json
        }),
        unauthorized: () => resolveResponse({
          statusCode: 401
        }),
        handlerReturn: new Promise((res) => resolveResponse = res)
      };
    }, "awsLambdaAsync");
    azure = /* @__PURE__ */ __name((context, request) => ({
      get update() {
        return request.body;
      },
      header: context.res?.headers?.[SECRET_HEADER],
      end: () => context.res = {
        status: 200,
        body: ""
      },
      respond: (json) => {
        context.res?.set?.("Content-Type", "application/json");
        context.res?.send?.(json);
      },
      unauthorized: () => {
        context.res?.send?.(401, WRONG_TOKEN_ERROR);
      }
    }), "azure");
    azureV4 = /* @__PURE__ */ __name((request) => {
      let resolveResponse;
      return {
        get update() {
          return request.json();
        },
        header: request.headers.get(SECRET_HEADER) || void 0,
        end: () => resolveResponse({
          status: 204
        }),
        respond: (json) => resolveResponse({
          jsonBody: json
        }),
        unauthorized: () => resolveResponse({
          status: 401,
          body: WRONG_TOKEN_ERROR
        }),
        handlerReturn: new Promise((resolve) => resolveResponse = resolve)
      };
    }, "azureV4");
    bun = /* @__PURE__ */ __name((request) => {
      let resolveResponse;
      return {
        get update() {
          return request.json();
        },
        header: request.headers.get(SECRET_HEADER) || void 0,
        end: () => {
          resolveResponse(ok());
        },
        respond: (json) => {
          resolveResponse(okJson(json));
        },
        unauthorized: () => {
          resolveResponse(unauthorized());
        },
        handlerReturn: new Promise((res) => resolveResponse = res)
      };
    }, "bun");
    cloudflare = /* @__PURE__ */ __name((event) => {
      let resolveResponse;
      event.respondWith(new Promise((resolve) => {
        resolveResponse = resolve;
      }));
      return {
        get update() {
          return event.request.json();
        },
        header: event.request.headers.get(SECRET_HEADER) || void 0,
        end: () => {
          resolveResponse(ok());
        },
        respond: (json) => {
          resolveResponse(okJson(json));
        },
        unauthorized: () => {
          resolveResponse(unauthorized());
        }
      };
    }, "cloudflare");
    cloudflareModule = /* @__PURE__ */ __name((request) => {
      let resolveResponse;
      return {
        get update() {
          return request.json();
        },
        header: request.headers.get(SECRET_HEADER) || void 0,
        end: () => {
          resolveResponse(ok());
        },
        respond: (json) => {
          resolveResponse(okJson(json));
        },
        unauthorized: () => {
          resolveResponse(unauthorized());
        },
        handlerReturn: new Promise((res) => resolveResponse = res)
      };
    }, "cloudflareModule");
    express = /* @__PURE__ */ __name((req, res) => ({
      get update() {
        return req.body;
      },
      header: req.header(SECRET_HEADER),
      end: () => res.end(),
      respond: (json) => {
        res.set("Content-Type", "application/json");
        res.send(json);
      },
      unauthorized: () => {
        res.status(401).send(WRONG_TOKEN_ERROR);
      }
    }), "express");
    fastify = /* @__PURE__ */ __name((request, reply) => ({
      get update() {
        return request.body;
      },
      header: request.headers[SECRET_HEADER_LOWERCASE],
      end: () => reply.send(""),
      respond: (json) => reply.headers({
        "Content-Type": "application/json"
      }).send(json),
      unauthorized: () => reply.code(401).send(WRONG_TOKEN_ERROR)
    }), "fastify");
    hono = /* @__PURE__ */ __name((c) => {
      let resolveResponse;
      return {
        get update() {
          return c.req.json();
        },
        header: c.req.header(SECRET_HEADER),
        end: () => {
          resolveResponse(c.body(""));
        },
        respond: (json) => {
          resolveResponse(c.json(json));
        },
        unauthorized: () => {
          c.status(401);
          resolveResponse(c.body(""));
        },
        handlerReturn: new Promise((res) => resolveResponse = res)
      };
    }, "hono");
    http = /* @__PURE__ */ __name((req, res) => {
      const secretHeaderFromRequest = req.headers[SECRET_HEADER_LOWERCASE];
      return {
        get update() {
          return new Promise((resolve, reject) => {
            const chunks = [];
            req.on("data", (chunk) => chunks.push(chunk)).once("end", () => {
              const raw2 = Buffer.concat(chunks).toString("utf-8");
              resolve(JSON.parse(raw2));
            }).once("error", reject);
          });
        },
        header: Array.isArray(secretHeaderFromRequest) ? secretHeaderFromRequest[0] : secretHeaderFromRequest,
        end: () => res.end(),
        respond: (json) => res.writeHead(200, {
          "Content-Type": "application/json"
        }).end(json),
        unauthorized: () => res.writeHead(401).end(WRONG_TOKEN_ERROR)
      };
    }, "http");
    koa = /* @__PURE__ */ __name((ctx) => ({
      get update() {
        return ctx.request.body;
      },
      header: ctx.get(SECRET_HEADER) || void 0,
      end: () => {
        ctx.body = "";
      },
      respond: (json) => {
        ctx.set("Content-Type", "application/json");
        ctx.response.body = json;
      },
      unauthorized: () => {
        ctx.status = 401;
      }
    }), "koa");
    nextJs = /* @__PURE__ */ __name((request, response) => ({
      get update() {
        return request.body;
      },
      header: request.headers[SECRET_HEADER_LOWERCASE],
      end: () => response.end(),
      respond: (json) => response.status(200).json(json),
      unauthorized: () => response.status(401).send(WRONG_TOKEN_ERROR)
    }), "nextJs");
    nhttp = /* @__PURE__ */ __name((rev) => ({
      get update() {
        return rev.body;
      },
      header: rev.headers.get(SECRET_HEADER) || void 0,
      end: () => rev.response.sendStatus(200),
      respond: (json) => rev.response.status(200).send(json),
      unauthorized: () => rev.response.status(401).send(WRONG_TOKEN_ERROR)
    }), "nhttp");
    oak = /* @__PURE__ */ __name((ctx) => ({
      get update() {
        return ctx.request.body.json();
      },
      header: ctx.request.headers.get(SECRET_HEADER) || void 0,
      end: () => {
        ctx.response.status = 200;
      },
      respond: (json) => {
        ctx.response.type = "json";
        ctx.response.body = json;
      },
      unauthorized: () => {
        ctx.response.status = 401;
      }
    }), "oak");
    serveHttp = /* @__PURE__ */ __name((requestEvent) => ({
      get update() {
        return requestEvent.request.json();
      },
      header: requestEvent.request.headers.get(SECRET_HEADER) || void 0,
      end: () => requestEvent.respondWith(ok()),
      respond: (json) => requestEvent.respondWith(okJson(json)),
      unauthorized: () => requestEvent.respondWith(unauthorized())
    }), "serveHttp");
    stdHttp = /* @__PURE__ */ __name((req) => {
      let resolveResponse;
      return {
        get update() {
          return req.json();
        },
        header: req.headers.get(SECRET_HEADER) || void 0,
        end: () => {
          if (resolveResponse)
            resolveResponse(ok());
        },
        respond: (json) => {
          if (resolveResponse)
            resolveResponse(okJson(json));
        },
        unauthorized: () => {
          if (resolveResponse)
            resolveResponse(unauthorized());
        },
        handlerReturn: new Promise((res) => resolveResponse = res)
      };
    }, "stdHttp");
    sveltekit = /* @__PURE__ */ __name(({ request }) => {
      let resolveResponse;
      return {
        get update() {
          return request.json();
        },
        header: request.headers.get(SECRET_HEADER) || void 0,
        end: () => {
          if (resolveResponse)
            resolveResponse(ok());
        },
        respond: (json) => {
          if (resolveResponse)
            resolveResponse(okJson(json));
        },
        unauthorized: () => {
          if (resolveResponse)
            resolveResponse(unauthorized());
        },
        handlerReturn: new Promise((res) => resolveResponse = res)
      };
    }, "sveltekit");
    worktop = /* @__PURE__ */ __name((req, res) => ({
      get update() {
        return req.json();
      },
      header: req.headers.get(SECRET_HEADER) ?? void 0,
      end: () => res.end(null),
      respond: (json) => res.send(200, json),
      unauthorized: () => res.send(401, WRONG_TOKEN_ERROR)
    }), "worktop");
    elysia = /* @__PURE__ */ __name((ctx) => {
      let resolveResponse;
      return {
        get update() {
          return ctx.body;
        },
        header: ctx.headers[SECRET_HEADER_LOWERCASE],
        end() {
          resolveResponse("");
        },
        respond(json) {
          ctx.set.headers["content-type"] = "application/json";
          resolveResponse(json);
        },
        unauthorized() {
          ctx.set.status = 401;
          resolveResponse("");
        },
        handlerReturn: new Promise((res) => resolveResponse = res)
      };
    }, "elysia");
    adapters = {
      "aws-lambda": awsLambda,
      "aws-lambda-async": awsLambdaAsync,
      azure,
      "azure-v4": azureV4,
      bun,
      cloudflare,
      "cloudflare-mod": cloudflareModule,
      elysia,
      express,
      fastify,
      hono,
      http,
      https: http,
      koa,
      "next-js": nextJs,
      nhttp,
      oak,
      serveHttp,
      "std/http": stdHttp,
      sveltekit,
      worktop
    };
    debugErr1 = browser$1("grammy:error");
    callbackAdapter = /* @__PURE__ */ __name((update, callback, header, unauthorized2 = () => callback('"unauthorized"')) => ({
      update: Promise.resolve(update),
      respond: callback,
      header,
      unauthorized: unauthorized2
    }), "callbackAdapter");
    adapters1 = {
      ...adapters,
      callback: callbackAdapter
    };
    __name(webhookCallback, "webhookCallback");
    __name(timeoutIfNecessary, "timeoutIfNecessary");
  }
});

// node_modules/ms/index.js
var require_ms = __commonJS({
  "node_modules/ms/index.js"(exports, module) {
    var s2 = 1e3;
    var m2 = s2 * 60;
    var h2 = m2 * 60;
    var d2 = h2 * 24;
    var w2 = d2 * 7;
    var y2 = d2 * 365.25;
    module.exports = function(val, options) {
      options = options || {};
      var type = typeof val;
      if (type === "string" && val.length > 0) {
        return parse2(val);
      } else if (type === "number" && isFinite(val)) {
        return options.long ? fmtLong2(val) : fmtShort2(val);
      }
      throw new Error(
        "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
      );
    };
    function parse2(str2) {
      str2 = String(str2);
      if (str2.length > 100) {
        return;
      }
      var match3 = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
        str2
      );
      if (!match3) {
        return;
      }
      var n = parseFloat(match3[1]);
      var type = (match3[2] || "ms").toLowerCase();
      switch (type) {
        case "years":
        case "year":
        case "yrs":
        case "yr":
        case "y":
          return n * y2;
        case "weeks":
        case "week":
        case "w":
          return n * w2;
        case "days":
        case "day":
        case "d":
          return n * d2;
        case "hours":
        case "hour":
        case "hrs":
        case "hr":
        case "h":
          return n * h2;
        case "minutes":
        case "minute":
        case "mins":
        case "min":
        case "m":
          return n * m2;
        case "seconds":
        case "second":
        case "secs":
        case "sec":
        case "s":
          return n * s2;
        case "milliseconds":
        case "millisecond":
        case "msecs":
        case "msec":
        case "ms":
          return n;
        default:
          return void 0;
      }
    }
    __name(parse2, "parse");
    function fmtShort2(ms2) {
      var msAbs = Math.abs(ms2);
      if (msAbs >= d2) {
        return Math.round(ms2 / d2) + "d";
      }
      if (msAbs >= h2) {
        return Math.round(ms2 / h2) + "h";
      }
      if (msAbs >= m2) {
        return Math.round(ms2 / m2) + "m";
      }
      if (msAbs >= s2) {
        return Math.round(ms2 / s2) + "s";
      }
      return ms2 + "ms";
    }
    __name(fmtShort2, "fmtShort");
    function fmtLong2(ms2) {
      var msAbs = Math.abs(ms2);
      if (msAbs >= d2) {
        return plural2(ms2, msAbs, d2, "day");
      }
      if (msAbs >= h2) {
        return plural2(ms2, msAbs, h2, "hour");
      }
      if (msAbs >= m2) {
        return plural2(ms2, msAbs, m2, "minute");
      }
      if (msAbs >= s2) {
        return plural2(ms2, msAbs, s2, "second");
      }
      return ms2 + " ms";
    }
    __name(fmtLong2, "fmtLong");
    function plural2(ms2, msAbs, n, name) {
      var isPlural = msAbs >= n * 1.5;
      return Math.round(ms2 / n) + " " + name + (isPlural ? "s" : "");
    }
    __name(plural2, "plural");
  }
});

// node_modules/debug/src/common.js
var require_common = __commonJS({
  "node_modules/debug/src/common.js"(exports, module) {
    function setup2(env) {
      createDebug.debug = createDebug;
      createDebug.default = createDebug;
      createDebug.coerce = coerce;
      createDebug.disable = disable;
      createDebug.enable = enable;
      createDebug.enabled = enabled;
      createDebug.humanize = require_ms();
      createDebug.destroy = destroy;
      Object.keys(env).forEach((key) => {
        createDebug[key] = env[key];
      });
      createDebug.names = [];
      createDebug.skips = [];
      createDebug.formatters = {};
      function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
          hash = (hash << 5) - hash + namespace.charCodeAt(i);
          hash |= 0;
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
      }
      __name(selectColor, "selectColor");
      createDebug.selectColor = selectColor;
      function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug4(...args) {
          if (!debug4.enabled) {
            return;
          }
          const self2 = debug4;
          const curr = Number(/* @__PURE__ */ new Date());
          const ms2 = curr - (prevTime || curr);
          self2.diff = ms2;
          self2.prev = prevTime;
          self2.curr = curr;
          prevTime = curr;
          args[0] = createDebug.coerce(args[0]);
          if (typeof args[0] !== "string") {
            args.unshift("%O");
          }
          let index = 0;
          args[0] = args[0].replace(/%([a-zA-Z%])/g, (match3, format) => {
            if (match3 === "%%") {
              return "%";
            }
            index++;
            const formatter = createDebug.formatters[format];
            if (typeof formatter === "function") {
              const val = args[index];
              match3 = formatter.call(self2, val);
              args.splice(index, 1);
              index--;
            }
            return match3;
          });
          createDebug.formatArgs.call(self2, args);
          const logFn = self2.log || createDebug.log;
          logFn.apply(self2, args);
        }
        __name(debug4, "debug");
        debug4.namespace = namespace;
        debug4.useColors = createDebug.useColors();
        debug4.color = createDebug.selectColor(namespace);
        debug4.extend = extend;
        debug4.destroy = createDebug.destroy;
        Object.defineProperty(debug4, "enabled", {
          enumerable: true,
          configurable: false,
          get: () => {
            if (enableOverride !== null) {
              return enableOverride;
            }
            if (namespacesCache !== createDebug.namespaces) {
              namespacesCache = createDebug.namespaces;
              enabledCache = createDebug.enabled(namespace);
            }
            return enabledCache;
          },
          set: (v) => {
            enableOverride = v;
          }
        });
        if (typeof createDebug.init === "function") {
          createDebug.init(debug4);
        }
        return debug4;
      }
      __name(createDebug, "createDebug");
      function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
      }
      __name(extend, "extend");
      function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
        for (const ns of split) {
          if (ns[0] === "-") {
            createDebug.skips.push(ns.slice(1));
          } else {
            createDebug.names.push(ns);
          }
        }
      }
      __name(enable, "enable");
      function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
          if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
            if (template[templateIndex] === "*") {
              starIndex = templateIndex;
              matchIndex = searchIndex;
              templateIndex++;
            } else {
              searchIndex++;
              templateIndex++;
            }
          } else if (starIndex !== -1) {
            templateIndex = starIndex + 1;
            matchIndex++;
            searchIndex = matchIndex;
          } else {
            return false;
          }
        }
        while (templateIndex < template.length && template[templateIndex] === "*") {
          templateIndex++;
        }
        return templateIndex === template.length;
      }
      __name(matchesTemplate, "matchesTemplate");
      function disable() {
        const namespaces = [
          ...createDebug.names,
          ...createDebug.skips.map((namespace) => "-" + namespace)
        ].join(",");
        createDebug.enable("");
        return namespaces;
      }
      __name(disable, "disable");
      function enabled(name) {
        for (const skip of createDebug.skips) {
          if (matchesTemplate(name, skip)) {
            return false;
          }
        }
        for (const ns of createDebug.names) {
          if (matchesTemplate(name, ns)) {
            return true;
          }
        }
        return false;
      }
      __name(enabled, "enabled");
      function coerce(val) {
        if (val instanceof Error) {
          return val.stack || val.message;
        }
        return val;
      }
      __name(coerce, "coerce");
      function destroy() {
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
      __name(destroy, "destroy");
      createDebug.enable(createDebug.load());
      return createDebug;
    }
    __name(setup2, "setup");
    module.exports = setup2;
  }
});

// node_modules/debug/src/browser.js
var require_browser = __commonJS({
  "node_modules/debug/src/browser.js"(exports, module) {
    exports.formatArgs = formatArgs;
    exports.save = save;
    exports.load = load;
    exports.useColors = useColors;
    exports.storage = localstorage();
    exports.destroy = (() => {
      let warned = false;
      return () => {
        if (!warned) {
          warned = true;
          console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
        }
      };
    })();
    exports.colors = [
      "#0000CC",
      "#0000FF",
      "#0033CC",
      "#0033FF",
      "#0066CC",
      "#0066FF",
      "#0099CC",
      "#0099FF",
      "#00CC00",
      "#00CC33",
      "#00CC66",
      "#00CC99",
      "#00CCCC",
      "#00CCFF",
      "#3300CC",
      "#3300FF",
      "#3333CC",
      "#3333FF",
      "#3366CC",
      "#3366FF",
      "#3399CC",
      "#3399FF",
      "#33CC00",
      "#33CC33",
      "#33CC66",
      "#33CC99",
      "#33CCCC",
      "#33CCFF",
      "#6600CC",
      "#6600FF",
      "#6633CC",
      "#6633FF",
      "#66CC00",
      "#66CC33",
      "#9900CC",
      "#9900FF",
      "#9933CC",
      "#9933FF",
      "#99CC00",
      "#99CC33",
      "#CC0000",
      "#CC0033",
      "#CC0066",
      "#CC0099",
      "#CC00CC",
      "#CC00FF",
      "#CC3300",
      "#CC3333",
      "#CC3366",
      "#CC3399",
      "#CC33CC",
      "#CC33FF",
      "#CC6600",
      "#CC6633",
      "#CC9900",
      "#CC9933",
      "#CCCC00",
      "#CCCC33",
      "#FF0000",
      "#FF0033",
      "#FF0066",
      "#FF0099",
      "#FF00CC",
      "#FF00FF",
      "#FF3300",
      "#FF3333",
      "#FF3366",
      "#FF3399",
      "#FF33CC",
      "#FF33FF",
      "#FF6600",
      "#FF6633",
      "#FF9900",
      "#FF9933",
      "#FFCC00",
      "#FFCC33"
    ];
    function useColors() {
      if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
        return true;
      }
      if (typeof navigator !== "undefined" && "Cloudflare-Workers" && "Cloudflare-Workers".toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
      }
      let m2;
      return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
      typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
      // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
      typeof navigator !== "undefined" && "Cloudflare-Workers" && (m2 = "Cloudflare-Workers".toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m2[1], 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
      typeof navigator !== "undefined" && "Cloudflare-Workers" && "Cloudflare-Workers".toLowerCase().match(/applewebkit\/(\d+)/);
    }
    __name(useColors, "useColors");
    function formatArgs(args) {
      args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
      if (!this.useColors) {
        return;
      }
      const c = "color: " + this.color;
      args.splice(1, 0, c, "color: inherit");
      let index = 0;
      let lastC = 0;
      args[0].replace(/%[a-zA-Z%]/g, (match3) => {
        if (match3 === "%%") {
          return;
        }
        index++;
        if (match3 === "%c") {
          lastC = index;
        }
      });
      args.splice(lastC, 0, c);
    }
    __name(formatArgs, "formatArgs");
    exports.log = console.debug || console.log || (() => {
    });
    function save(namespaces) {
      try {
        if (namespaces) {
          exports.storage.setItem("debug", namespaces);
        } else {
          exports.storage.removeItem("debug");
        }
      } catch (error) {
      }
    }
    __name(save, "save");
    function load() {
      let r;
      try {
        r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
      } catch (error) {
      }
      if (!r && typeof process !== "undefined" && "env" in process) {
        r = process.env.DEBUG;
      }
      return r;
    }
    __name(load, "load");
    function localstorage() {
      try {
        return localStorage;
      } catch (error) {
      }
    }
    __name(localstorage, "localstorage");
    module.exports = require_common()(exports);
    var { formatters } = module.exports;
    formatters.j = function(v) {
      try {
        return JSON.stringify(v);
      } catch (error) {
        return "[UnexpectedJSONParseError]: " + error.message;
      }
    };
  }
});

// node_modules/@grammyjs/auto-retry/out/platform.node.js
var require_platform_node = __commonJS({
  "node_modules/@grammyjs/auto-retry/out/platform.node.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.HttpError = exports.debug = void 0;
    var debug_1 = require_browser();
    Object.defineProperty(exports, "debug", { enumerable: true, get: function() {
      return debug_1.debug;
    } });
    var grammy_1 = (init_web(), __toCommonJS(web_exports));
    Object.defineProperty(exports, "HttpError", { enumerable: true, get: function() {
      return grammy_1.HttpError;
    } });
  }
});

// node_modules/@grammyjs/auto-retry/out/mod.js
var require_mod = __commonJS({
  "node_modules/@grammyjs/auto-retry/out/mod.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.autoRetry = autoRetry2;
    var platform_node_js_1 = require_platform_node();
    var debug4 = (0, platform_node_js_1.debug)("grammy:auto-retry");
    var ONE_HOUR = 3600;
    var INITIAL_LAST_DELAY = 3;
    function pause(seconds, signal) {
      return new Promise((resolve, reject) => {
        const handle = setTimeout(() => {
          signal === null || signal === void 0 ? void 0 : signal.removeEventListener("abort", abort);
          resolve();
        }, 1e3 * seconds);
        signal === null || signal === void 0 ? void 0 : signal.addEventListener("abort", abort);
        function abort() {
          clearTimeout(handle);
          signal === null || signal === void 0 ? void 0 : signal.removeEventListener("abort", abort);
          reject(new Error("Request aborted while waiting between retries"));
        }
        __name(abort, "abort");
      });
    }
    __name(pause, "pause");
    function autoRetry2(options) {
      var _a, _b, _c, _d;
      const maxDelay = (_a = options === null || options === void 0 ? void 0 : options.maxDelaySeconds) !== null && _a !== void 0 ? _a : Infinity;
      const maxRetries = (_b = options === null || options === void 0 ? void 0 : options.maxRetryAttempts) !== null && _b !== void 0 ? _b : Infinity;
      const rethrowInternalServerErrors = (_c = options === null || options === void 0 ? void 0 : options.rethrowInternalServerErrors) !== null && _c !== void 0 ? _c : false;
      const rethrowHttpErrors = (_d = options === null || options === void 0 ? void 0 : options.rethrowHttpErrors) !== null && _d !== void 0 ? _d : false;
      return async (prev, method, payload, signal) => {
        var _a2;
        let remainingAttempts = maxRetries;
        let nextDelay = INITIAL_LAST_DELAY;
        async function backoff() {
          await pause(nextDelay, signal);
          nextDelay = Math.min(ONE_HOUR, nextDelay + nextDelay);
        }
        __name(backoff, "backoff");
        async function call() {
          let res = void 0;
          while (res === void 0) {
            try {
              res = await prev(method, payload, signal);
            } catch (e) {
              if ((signal === void 0 || !signal.aborted) && !rethrowHttpErrors && e instanceof platform_node_js_1.HttpError) {
                debug4(`HttpError thrown, will retry '${method}' after ${nextDelay} seconds (${e.message})`);
                await backoff();
                continue;
              } else {
                throw e;
              }
            }
          }
          return res;
        }
        __name(call, "call");
        let result = void 0;
        do {
          let retry = false;
          result = await call();
          if (typeof ((_a2 = result.parameters) === null || _a2 === void 0 ? void 0 : _a2.retry_after) === "number" && result.parameters.retry_after <= maxDelay) {
            debug4(`Hit rate limit, will retry '${method}' after ${result.parameters.retry_after} seconds`);
            await pause(result.parameters.retry_after, signal);
            nextDelay = INITIAL_LAST_DELAY;
            retry = true;
          } else if (result.error_code >= 500 && !rethrowInternalServerErrors) {
            debug4(`Hit internal server error, will retry '${method}' after ${nextDelay} seconds`);
            await backoff();
            retry = true;
          }
          if (!retry)
            return result;
        } while (!result.ok && remainingAttempts-- > 0);
        return result;
      };
    }
    __name(autoRetry2, "autoRetry");
  }
});

// node_modules/@grammyjs/ratelimiter/out/platform.node.js
var require_platform_node2 = __commonJS({
  "node_modules/@grammyjs/ratelimiter/out/platform.node.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.unref = void 0;
    var unref = /* @__PURE__ */ __name((interval) => {
      interval.unref();
    }, "unref");
    exports.unref = unref;
  }
});

// node_modules/@grammyjs/ratelimiter/out/memoryStore.js
var require_memoryStore = __commonJS({
  "node_modules/@grammyjs/ratelimiter/out/memoryStore.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MemoryStore = void 0;
    var platform_node_js_1 = require_platform_node2();
    var MemoryStore = class {
      constructor(timeFrame) {
        this.hits = /* @__PURE__ */ new Map();
        (0, platform_node_js_1.unref)(setInterval(() => {
          this.hits.clear();
        }, timeFrame));
      }
      increment(key) {
        var _a;
        let counter = (_a = this.hits.get(key)) !== null && _a !== void 0 ? _a : 0;
        counter++;
        this.hits.set(key, counter);
        return counter;
      }
    };
    __name(MemoryStore, "MemoryStore");
    exports.MemoryStore = MemoryStore;
  }
});

// node_modules/@grammyjs/ratelimiter/out/typesAndDefaults.js
var require_typesAndDefaults = __commonJS({
  "node_modules/@grammyjs/ratelimiter/out/typesAndDefaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.defaultOptions = void 0;
    exports.defaultOptions = {
      timeFrame: 1e3,
      limit: 1,
      onLimitExceeded: (_ctx, _next) => {
      },
      storageClient: "MEMORY_STORE",
      keyGenerator: (ctx) => {
        var _a;
        return (_a = ctx.from) === null || _a === void 0 ? void 0 : _a.id.toString();
      },
      keyPrefix: "RATE_LIMITER"
    };
  }
});

// node_modules/@grammyjs/ratelimiter/out/redisStore.js
var require_redisStore = __commonJS({
  "node_modules/@grammyjs/ratelimiter/out/redisStore.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.RedisStore = void 0;
    var RedisStore = class {
      constructor(client, timeFrame) {
        this.client = client;
        this.timeFrame = timeFrame;
      }
      async increment(key) {
        const counter = await this.client.incr(key);
        if (counter === 1) {
          await this.client.pexpire(key, this.timeFrame);
        }
        return counter;
      }
    };
    __name(RedisStore, "RedisStore");
    exports.RedisStore = RedisStore;
  }
});

// node_modules/@grammyjs/ratelimiter/out/rateLimiter.js
var require_rateLimiter = __commonJS({
  "node_modules/@grammyjs/ratelimiter/out/rateLimiter.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.limit = void 0;
    var memoryStore_js_1 = require_memoryStore();
    var typesAndDefaults_js_1 = require_typesAndDefaults();
    var redisStore_js_1 = require_redisStore();
    var limit2 = /* @__PURE__ */ __name((userOptions) => {
      var _a;
      const options = { ...typesAndDefaults_js_1.defaultOptions, ...userOptions };
      const store = options.storageClient === "MEMORY_STORE" ? new memoryStore_js_1.MemoryStore(options.timeFrame) : new redisStore_js_1.RedisStore(options.storageClient, options.timeFrame);
      const keyPrefix = (_a = userOptions === null || userOptions === void 0 ? void 0 : userOptions.keyPrefix) !== null && _a !== void 0 ? _a : typesAndDefaults_js_1.defaultOptions.keyPrefix;
      const middlewareFunc = /* @__PURE__ */ __name(async (ctx, next) => {
        const key = options.keyGenerator(ctx);
        if (!key) {
          return await next();
        }
        const hits = await store.increment(keyPrefix + key);
        if (hits === options.limit + 1 || options.alwaysReply && hits > options.limit) {
          return options.onLimitExceeded(ctx, next);
        }
        if (hits <= options.limit) {
          return await next();
        }
      }, "middlewareFunc");
      return middlewareFunc;
    }, "limit");
    exports.limit = limit2;
  }
});

// node_modules/@grammyjs/ratelimiter/out/mod.js
var require_mod2 = __commonJS({
  "node_modules/@grammyjs/ratelimiter/out/mod.js"(exports) {
    "use strict";
    var __createBinding = exports && exports.__createBinding || (Object.create ? function(o, m2, k, k2) {
      if (k2 === void 0)
        k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m2, k);
      if (!desc || ("get" in desc ? !m2.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function() {
          return m2[k];
        } };
      }
      Object.defineProperty(o, k2, desc);
    } : function(o, m2, k, k2) {
      if (k2 === void 0)
        k2 = k;
      o[k2] = m2[k];
    });
    var __exportStar = exports && exports.__exportStar || function(m2, exports2) {
      for (var p in m2)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p))
          __createBinding(exports2, m2, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(require_rateLimiter(), exports);
  }
});

// src/index.ts
init_web();
var import_auto_retry = __toESM(require_mod(), 1);
var import_ratelimiter = __toESM(require_mod2(), 1);

// node_modules/hono/dist/compose.js
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match3, index) => {
    const mark = `@${index}`;
    groups.push([mark, match3]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match3 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match3) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match3[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match3[1], new RegExp(`^${match3[2]}(?=/${next})`)] : [label, match3[1], new RegExp(`^${match3[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match3[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str2, decoder) => {
  try {
    return decoder(str2);
  } catch {
    return str2.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match3) => {
      try {
        return decoder(match3);
      } catch {
        return match3;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str2) => tryDecode(str2, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const path = url.slice(start, queryIndex === -1 ? void 0 : queryIndex);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str2) => tryDecode(str2, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = /* @__PURE__ */ __name(class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return this.bodyCache.parsedBody ??= await parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
}, "HonoRequest");

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str2, phase, preserveCallbacks, context, buffer) => {
  if (typeof str2 === "object" && !(str2 instanceof String)) {
    if (!(str2 instanceof Promise)) {
      str2 = str2.toString();
    }
    if (str2 instanceof Promise) {
      str2 = await str2;
    }
  }
  const callbacks = str2.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str2);
  }
  if (buffer) {
    buffer[0] += str2;
  } else {
    buffer = [str2];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str22) => resolveCallback(str22, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var Context2 = /* @__PURE__ */ __name(class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= new Response(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = new Response(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = new Response(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return new Response(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => new Response();
    return this.#notFoundHandler(this);
  };
}, "Context");

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = /* @__PURE__ */ __name(class extends Error {
}, "UnsupportedPathError");

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = /* @__PURE__ */ __name(class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m2 of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m2.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context2(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
}, "_Hono");

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match2(method, path) {
  const matchers = this.buildAllMatchers();
  const match22 = /* @__PURE__ */ __name((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }, "match2");
  this.match = match22;
  return match22(method, path);
}
__name(match2, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = /* @__PURE__ */ __name(class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
}, "_Node");

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = /* @__PURE__ */ __name(class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m2) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m2];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
}, "Trie");

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h2]) => [h2, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h2, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h2, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = /* @__PURE__ */ __name(class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m2) => {
          middleware[m2][path] ||= findMiddleware(middleware[m2], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m2) => {
        if (method === METHOD_NAME_ALL || method === m2) {
          Object.keys(middleware[m2]).forEach((p) => {
            re.test(p) && middleware[m2][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m2) => {
        if (method === METHOD_NAME_ALL || method === m2) {
          Object.keys(routes[m2]).forEach(
            (p) => re.test(p) && routes[m2][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m2) => {
        if (method === METHOD_NAME_ALL || method === m2) {
          routes[m2][path2] ||= [
            ...findMiddleware(middleware[m2], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m2][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match2;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
}, "RegExpRouter");

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = /* @__PURE__ */ __name(class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
}, "SmartRouter");

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var Node2 = /* @__PURE__ */ __name(class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m2 = /* @__PURE__ */ Object.create(null);
      m2[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m2];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #getHandlerSets(node, method, nodeParams, params) {
    const handlerSets = [];
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m2 = node.#methods[i];
      const handlerSet = m2[method] || m2[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
    return handlerSets;
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              handlerSets.push(
                ...this.#getHandlerSets(nextNode.#children["*"], method, node.#params)
              );
            }
            handlerSets.push(...this.#getHandlerSets(nextNode, method, node.#params));
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              handlerSets.push(...this.#getHandlerSets(astNode, method, node.#params));
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          const restPathString = parts.slice(i).join("/");
          if (matcher instanceof RegExp) {
            const m2 = matcher.exec(restPathString);
            if (m2) {
              params[name] = m2[0];
              handlerSets.push(...this.#getHandlerSets(child, method, node.#params, params));
              if (Object.keys(child.#children).length) {
                child.#params = params;
                const componentCount = m2[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              handlerSets.push(...this.#getHandlerSets(child, method, params, node.#params));
              if (child.#children["*"]) {
                handlerSets.push(
                  ...this.#getHandlerSets(child.#children["*"], method, params, node.#params)
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      curNodes = tempNodes.concat(curNodesQueue.shift() ?? []);
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
}, "_Node");

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = /* @__PURE__ */ __name(class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
}, "TrieRouter");

// node_modules/hono/dist/hono.js
var Hono2 = /* @__PURE__ */ __name(class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
}, "Hono");

// src/services/storage.ts
var MAX_RETRIES = 3;
var RETRY_DELAY_MS = 50;
var delay = /* @__PURE__ */ __name((ms2) => new Promise((resolve) => setTimeout(resolve, ms2)), "delay");
var StorageService = class {
  constructor(kv) {
    this.kv = kv;
  }
  // ============================================
  // Safe KV Operations (with error handling)
  // ============================================
  async safeGet(key) {
    try {
      const data = await this.kv.get(key, "json");
      return data;
    } catch (error) {
      console.error(`KV get error for ${key}:`, error);
      return null;
    }
  }
  async safePut(key, value) {
    try {
      await this.kv.put(key, value);
      return true;
    } catch (error) {
      console.error(`KV put error for ${key}:`, error);
      return false;
    }
  }
  async safeDelete(key) {
    try {
      await this.kv.delete(key);
      return true;
    } catch (error) {
      console.error(`KV delete error for ${key}:`, error);
      return false;
    }
  }
  // ============================================
  // Challenge Management
  // ============================================
  async getChallenge(type) {
    return this.safeGet(`challenge:${type}`);
  }
  async saveChallenge(challenge) {
    return this.safePut(
      `challenge:${challenge.type}`,
      JSON.stringify(challenge)
    );
  }
  async getNextChallengeId(type) {
    const now = /* @__PURE__ */ new Date();
    const datePrefix = now.getFullYear() * 1e4 + (now.getMonth() + 1) * 100 + now.getDate();
    const key = `challenge:${type}:counter`;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const current = await this.kv.get(key);
        const currentNum = parseInt(current || "0", 10) || 0;
        const currentDate = Math.floor(currentNum / 1e3);
        const next = currentDate === datePrefix ? currentNum + 1 : datePrefix * 1e3 + 1;
        await this.kv.put(key, String(next));
        return next;
      } catch (error) {
        console.error(`getNextChallengeId attempt ${attempt + 1} failed:`, error);
        if (attempt < MAX_RETRIES - 1) {
          await delay(RETRY_DELAY_MS * (attempt + 1));
        }
      }
    }
    return Date.now();
  }
  // ============================================
  // Poll Management
  // ============================================
  async getPoll(type) {
    return this.safeGet(`poll:${type}`);
  }
  async savePoll(poll) {
    return this.safePut(`poll:${poll.type}`, JSON.stringify(poll));
  }
  async deletePoll(type) {
    return this.safeDelete(`poll:${type}`);
  }
  // ============================================
  // Submissions Management (with retry for race conditions)
  // ============================================
  async getSubmissions(type, challengeId) {
    const data = await this.safeGet(
      `submissions:${type}:${challengeId}`
    );
    return data || [];
  }
  async addSubmission(type, challengeId, submission) {
    const key = `submissions:${type}:${challengeId}`;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const submissions = await this.getSubmissions(type, challengeId);
        if (submissions.some((s2) => s2.messageId === submission.messageId)) {
          return true;
        }
        submissions.push(submission);
        const success = await this.safePut(key, JSON.stringify(submissions));
        if (success) {
          return true;
        }
      } catch (error) {
        console.error(`addSubmission attempt ${attempt + 1} failed:`, error);
      }
      if (attempt < MAX_RETRIES - 1) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }
    console.error(`addSubmission failed after ${MAX_RETRIES} attempts`);
    return false;
  }
  async updateSubmissionScore(type, challengeId, messageId, score) {
    const key = `submissions:${type}:${challengeId}`;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const submissions = await this.getSubmissions(type, challengeId);
        const submission = submissions.find((s2) => s2.messageId === messageId);
        if (!submission) {
          return false;
        }
        if (submission.score === score) {
          return true;
        }
        submission.score = score;
        const success = await this.safePut(key, JSON.stringify(submissions));
        if (success) {
          return true;
        }
      } catch (error) {
        console.error(`updateSubmissionScore attempt ${attempt + 1} failed:`, error);
      }
      if (attempt < MAX_RETRIES - 1) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }
    console.error(`updateSubmissionScore failed after ${MAX_RETRIES} attempts`);
    return false;
  }
  async clearSubmissions(type, challengeId) {
    return this.safeDelete(`submissions:${type}:${challengeId}`);
  }
  // ============================================
  // Leaderboard Management (with retry for race conditions)
  // ============================================
  async getLeaderboard(type) {
    const data = await this.safeGet(
      `leaderboard:${type}`
    );
    const map = data || {};
    return Object.values(map).sort((a, b) => b.wins - a.wins);
  }
  async addWin(type, userId, username) {
    const key = `leaderboard:${type}`;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const data = await this.safeGet(key);
        const map = data || {};
        const userKey = String(userId);
        if (!map[userKey]) {
          map[userKey] = { userId, username, wins: 0 };
        }
        map[userKey].wins += 1;
        map[userKey].lastWin = Date.now();
        if (username) {
          map[userKey].username = username;
        }
        const success = await this.safePut(key, JSON.stringify(map));
        if (success) {
          return true;
        }
      } catch (error) {
        console.error(`addWin attempt ${attempt + 1} failed:`, error);
      }
      if (attempt < MAX_RETRIES - 1) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }
    console.error(`addWin failed after ${MAX_RETRIES} attempts`);
    return false;
  }
  async getUserStats(type, userId) {
    const leaderboard = await this.getLeaderboard(type);
    const index = leaderboard.findIndex((e) => e.userId === userId);
    if (index === -1) {
      return { wins: 0, rank: leaderboard.length + 1 };
    }
    return { wins: leaderboard[index].wins, rank: index + 1 };
  }
  // ============================================
  // Active Topics Tracking
  // ============================================
  async getActiveTopics() {
    const data = await this.safeGet(
      "active_topics"
    );
    return data || {};
  }
  async setActiveTopics(topics) {
    return this.safePut("active_topics", JSON.stringify(topics));
  }
  async isActiveTopic(threadId) {
    const topics = await this.getActiveTopics();
    return topics[threadId] || null;
  }
  // ============================================
  // Theme History (to avoid repetition)
  // ============================================
  MAX_THEME_HISTORY = 10;
  async getThemeHistory(type) {
    const data = await this.safeGet(`theme_history:${type}`);
    return data || [];
  }
  async addThemeToHistory(type, theme) {
    const history = await this.getThemeHistory(type);
    history.unshift(theme);
    const trimmed = history.slice(0, this.MAX_THEME_HISTORY);
    return this.safePut(`theme_history:${type}`, JSON.stringify(trimmed));
  }
};
__name(StorageService, "StorageService");

// src/handlers/submissions.ts
async function handleSubmission(ctx, env, config2) {
  const hasPhoto = ctx.message?.photo && ctx.message.photo.length > 0;
  const hasImageDoc = ctx.message?.document?.mime_type?.startsWith("image/");
  if (!hasPhoto && !hasImageDoc) {
    return;
  }
  if (ctx.message?.forward_origin) {
    console.log("Rejected forwarded submission from user:", ctx.message?.from?.id);
    return;
  }
  const chatId = ctx.message?.chat?.id;
  if (chatId !== config2.chatId) {
    return;
  }
  const threadId = ctx.message?.message_thread_id || 0;
  const storage = new StorageService(env.CHALLENGE_KV);
  const challengeType = await storage.isActiveTopic(threadId);
  if (!challengeType) {
    return;
  }
  const challenge = await storage.getChallenge(challengeType);
  if (!challenge || challenge.status !== "active") {
    return;
  }
  const now = Date.now();
  if (now > challenge.endsAt) {
    return;
  }
  const userId = ctx.message?.from?.id;
  const username = ctx.message?.from?.username || ctx.message?.from?.first_name;
  const messageId = ctx.message?.message_id;
  if (!userId || !messageId) {
    return;
  }
  await storage.addSubmission(challengeType, challenge.id, {
    messageId,
    userId,
    username,
    score: 0,
    timestamp: now
  });
  console.log(
    `Submission registered: user=${userId}, message=${messageId}, challenge=${challengeType}#${challenge.id}`
  );
}
__name(handleSubmission, "handleSubmission");

// src/handlers/reactions.ts
var EXCLUDED_EMOJI = "\u{1F31A}";
async function handleReactionCount(ctx, env, config2) {
  const update = ctx.messageReactionCount;
  if (!update) {
    return;
  }
  const chatId = update.chat.id;
  if (chatId !== config2.chatId) {
    return;
  }
  const messageId = update.message_id;
  const reactions = update.reactions;
  let totalScore = 0;
  for (const reaction of reactions) {
    if (reaction.type.type === "emoji") {
      const emoji = reaction.type.emoji;
      if (emoji !== EXCLUDED_EMOJI) {
        totalScore += reaction.total_count;
      }
    } else if (reaction.type.type === "custom_emoji") {
      totalScore += reaction.total_count;
    } else if (reaction.type.type === "paid") {
      totalScore += reaction.total_count;
    }
  }
  const storage = new StorageService(env.CHALLENGE_KV);
  const types = ["daily", "weekly", "monthly"];
  for (const type of types) {
    const challenge = await storage.getChallenge(type);
    if (!challenge || challenge.status !== "active") {
      continue;
    }
    await storage.updateSubmissionScore(
      type,
      challenge.id,
      messageId,
      totalScore
    );
  }
  console.log(`Reaction update: message=${messageId}, score=${totalScore}`);
}
__name(handleReactionCount, "handleReactionCount");

// src/localization.ts
var ru = {
  challengeTypes: {
    daily: "\u0427\u0435\u043B\u043B\u0435\u043D\u0434\u0436 \u0434\u043D\u044F",
    weekly: "\u0427\u0435\u043B\u043B\u0435\u043D\u0434\u0436 \u043D\u0435\u0434\u0435\u043B\u0438",
    monthly: "\u0427\u0435\u043B\u043B\u0435\u043D\u0434\u0436 \u043C\u0435\u0441\u044F\u0446\u0430"
  },
  pollQuestion: (type) => {
    const labels = {
      daily: "\u0434\u043D\u0435\u0432\u043D\u043E\u0433\u043E",
      weekly: "\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E",
      monthly: "\u043C\u0435\u0441\u044F\u0447\u043D\u043E\u0433\u043E"
    };
    return `\u{1F5F3}\uFE0F \u0413\u043E\u043B\u043E\u0441\u0443\u0435\u043C \u0437\u0430 \u0442\u0435\u043C\u0443 ${labels[type]} \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0430!`;
  },
  challengeAnnouncement: (type, topic, endTime) => {
    const labels = {
      daily: "\u{1F3AF} \u0427\u0415\u041B\u041B\u0415\u041D\u0414\u0416 \u0414\u041D\u042F",
      weekly: "\u{1F3AF} \u0427\u0415\u041B\u041B\u0415\u041D\u0414\u0416 \u041D\u0415\u0414\u0415\u041B\u0418",
      monthly: "\u{1F3AF} \u0427\u0415\u041B\u041B\u0415\u041D\u0414\u0416 \u041C\u0415\u0421\u042F\u0426\u0410"
    };
    return `${labels[type]}

\u{1F3A8} \u0422\u0435\u043C\u0430: ${topic}

\u23F0 \u0414\u043E: ${endTime}

\u{1F4F8} \u0414\u043B\u044F \u0443\u0447\u0430\u0441\u0442\u0438\u044F \u2014 \u043F\u0440\u043E\u0441\u0442\u043E \u043E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0432 \u044D\u0442\u0443 \u0442\u0435\u043C\u0443!
\u2764\uFE0F \u0421\u0442\u0430\u0432\u044C\u0442\u0435 \u0440\u0435\u0430\u043A\u0446\u0438\u0438 \u043F\u043E\u043D\u0440\u0430\u0432\u0438\u0432\u0448\u0438\u043C\u0441\u044F \u0440\u0430\u0431\u043E\u0442\u0430\u043C
\u{1F31A} \u0420\u0435\u0430\u043A\u0446\u0438\u044F \xAB\u043B\u0443\u043D\u0430\xBB \u043D\u0435 \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442\u0441\u044F

\u0423\u0434\u0430\u0447\u0438! \u{1F340}`;
  },
  winnerAnnouncement: (username, score, type) => {
    const labels = {
      daily: "\u0434\u043D\u0435\u0432\u043D\u043E\u0433\u043E",
      weekly: "\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E",
      monthly: "\u043C\u0435\u0441\u044F\u0447\u043D\u043E\u0433\u043E"
    };
    return `\u{1F3C6} \u041F\u041E\u0411\u0415\u0414\u0418\u0422\u0415\u041B\u042C ${labels[type].toUpperCase()} \u0427\u0415\u041B\u041B\u0415\u041D\u0414\u0416\u0410!

\u{1F464} ${username}
\u2B50 \u041D\u0430\u0431\u0440\u0430\u043D\u043E \u0440\u0435\u0430\u043A\u0446\u0438\u0439: ${score}

\u041F\u043E\u0437\u0434\u0440\u0430\u0432\u043B\u044F\u0435\u043C! \u{1F389}`;
  },
  noSubmissions: "\u{1F614} \u041A \u0441\u043E\u0436\u0430\u043B\u0435\u043D\u0438\u044E, \u0432 \u044D\u0442\u043E\u043C \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0435 \u043D\u0438\u043A\u0442\u043E \u043D\u0435 \u0443\u0447\u0430\u0441\u0442\u0432\u043E\u0432\u0430\u043B.",
  statsMessage: (wins, rank) => `\u{1F4CA} \u0412\u0430\u0448\u0430 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430:

\u{1F3C6} \u041F\u043E\u0431\u0435\u0434: ${wins}
\u{1F4CD} \u041C\u0435\u0441\u0442\u043E \u0432 \u0440\u0435\u0439\u0442\u0438\u043D\u0433\u0435: ${rank}`,
  leaderboardTitle: (type) => {
    const labels = {
      daily: "\u0434\u043D\u0435\u0432\u043D\u044B\u0445",
      weekly: "\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0445",
      monthly: "\u043C\u0435\u0441\u044F\u0447\u043D\u044B\u0445"
    };
    return `\u{1F3C6} \u0422\u041E\u041F-10 \u043F\u043E\u0431\u0435\u0434\u0438\u0442\u0435\u043B\u0435\u0439 ${labels[type]} \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0435\u0439:`;
  },
  helpMessage: `\u{1F916} \u0411\u043E\u0442 \u0434\u043B\u044F \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0435\u0439

\u{1F4CB} \u041A\u0430\u043A \u0443\u0447\u0430\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C:
1. \u0414\u043E\u0436\u0434\u0438\u0442\u0435\u0441\u044C \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u0442\u0435\u043C\u044B
2. \u041E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0432 \u0442\u0435\u043C\u0443 \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0430
3. \u0421\u0442\u0430\u0432\u044C\u0442\u0435 \u0440\u0435\u0430\u043A\u0446\u0438\u0438 \u0440\u0430\u0431\u043E\u0442\u0430\u043C \u0434\u0440\u0443\u0433\u0438\u0445 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432
4. \u041F\u043E\u0431\u0435\u0436\u0434\u0430\u0435\u0442 \u0440\u0430\u0431\u043E\u0442\u0430 \u0441 \u043D\u0430\u0438\u0431\u043E\u043B\u044C\u0448\u0438\u043C \u0447\u0438\u0441\u043B\u043E\u043C \u0440\u0435\u0430\u043A\u0446\u0438\u0439

\u26A0\uFE0F \u0420\u0435\u0430\u043A\u0446\u0438\u044F \u{1F31A} \u043D\u0435 \u0443\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442\u0441\u044F (\u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0435\u0451 \u0434\u043B\u044F \u0440\u0430\u0431\u043E\u0442 \u043D\u0435 \u043F\u043E \u0442\u0435\u043C\u0435)

\u{1F4CA} \u041A\u043E\u043C\u0430\u043D\u0434\u044B:
/stats \u2014 \u0432\u0430\u0448\u0430 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430
/leaderboard \u2014 \u0442\u043E\u043F \u043F\u043E\u0431\u0435\u0434\u0438\u0442\u0435\u043B\u0435\u0439
/current \u2014 \u0442\u0435\u043A\u0443\u0449\u0438\u0435 \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0438
/help \u2014 \u044D\u0442\u0430 \u0441\u043F\u0440\u0430\u0432\u043A\u0430`
};
var en = {
  challengeTypes: {
    daily: "Daily Challenge",
    weekly: "Weekly Challenge",
    monthly: "Monthly Challenge"
  },
  pollQuestion: (type) => `\u{1F5F3}\uFE0F Vote for the ${type} challenge theme!`,
  challengeAnnouncement: (type, topic, endTime) => {
    const labels = {
      daily: "\u{1F3AF} DAILY CHALLENGE",
      weekly: "\u{1F3AF} WEEKLY CHALLENGE",
      monthly: "\u{1F3AF} MONTHLY CHALLENGE"
    };
    return `${labels[type]}

\u{1F3A8} Theme: ${topic}

\u23F0 Until: ${endTime}

\u{1F4F8} To participate \u2014 just send an image to this topic!
\u2764\uFE0F React to submissions you like
\u{1F31A} Moon reaction doesn't count

Good luck! \u{1F340}`;
  },
  winnerAnnouncement: (username, score, type) => `\u{1F3C6} ${type.toUpperCase()} CHALLENGE WINNER!

\u{1F464} ${username}
\u2B50 Reactions: ${score}

Congratulations! \u{1F389}`,
  noSubmissions: "\u{1F614} Unfortunately, no one participated in this challenge.",
  statsMessage: (wins, rank) => `\u{1F4CA} Your stats:

\u{1F3C6} Wins: ${wins}
\u{1F4CD} Rank: ${rank}`,
  leaderboardTitle: (type) => `\u{1F3C6} TOP-10 ${type} challenge winners:`,
  helpMessage: `\u{1F916} Challenge Bot

\u{1F4CB} How to participate:
1. Wait for the theme announcement
2. Send an image to the challenge topic
3. React to other participants' work
4. The entry with most reactions wins

\u26A0\uFE0F \u{1F31A} reaction doesn't count (use it for off-topic submissions)

\u{1F4CA} Commands:
/stats \u2014 your statistics
/leaderboard \u2014 top winners
/current \u2014 active challenges
/help \u2014 this help message`
};
function getLocalization(lang) {
  return lang === "en" ? en : ru;
}
__name(getLocalization, "getLocalization");

// src/handlers/commands.ts
async function handleStart(ctx, env, config2) {
  const l = getLocalization(config2.language);
  await ctx.reply(l.helpMessage);
}
__name(handleStart, "handleStart");
async function handleHelp(ctx, env, config2) {
  const l = getLocalization(config2.language);
  await ctx.reply(l.helpMessage);
}
__name(handleHelp, "handleHelp");
async function handleStats(ctx, env, config2) {
  const userId = ctx.from?.id;
  if (!userId)
    return;
  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config2.language);
  const dailyStats = await storage.getUserStats("daily", userId);
  const weeklyStats = await storage.getUserStats("weekly", userId);
  const monthlyStats = await storage.getUserStats("monthly", userId);
  const totalWins = dailyStats.wins + weeklyStats.wins + monthlyStats.wins;
  const message = config2.language === "ru" ? `\u{1F4CA} \u0412\u0430\u0448\u0430 \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430:

\u{1F3C6} \u0412\u0441\u0435\u0433\u043E \u043F\u043E\u0431\u0435\u0434: ${totalWins}

\u{1F4C5} \u0414\u043D\u0435\u0432\u043D\u044B\u0435 \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0438:
   \u041F\u043E\u0431\u0435\u0434: ${dailyStats.wins} | \u041C\u0435\u0441\u0442\u043E: #${dailyStats.rank}

\u{1F4C6} \u041D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0438:
   \u041F\u043E\u0431\u0435\u0434: ${weeklyStats.wins} | \u041C\u0435\u0441\u0442\u043E: #${weeklyStats.rank}

\u{1F4C6} \u041C\u0435\u0441\u044F\u0447\u043D\u044B\u0435 \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0438:
   \u041F\u043E\u0431\u0435\u0434: ${monthlyStats.wins} | \u041C\u0435\u0441\u0442\u043E: #${monthlyStats.rank}` : `\u{1F4CA} Your statistics:

\u{1F3C6} Total wins: ${totalWins}

\u{1F4C5} Daily challenges:
   Wins: ${dailyStats.wins} | Rank: #${dailyStats.rank}

\u{1F4C6} Weekly challenges:
   Wins: ${weeklyStats.wins} | Rank: #${weeklyStats.rank}

\u{1F4C6} Monthly challenges:
   Wins: ${monthlyStats.wins} | Rank: #${monthlyStats.rank}`;
  await ctx.reply(message);
}
__name(handleStats, "handleStats");
async function handleLeaderboard(ctx, env, config2) {
  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config2.language);
  const type = "daily";
  const leaderboard = await storage.getLeaderboard(type);
  if (leaderboard.length === 0) {
    await ctx.reply(
      config2.language === "ru" ? "\u{1F3C6} \u0420\u0435\u0439\u0442\u0438\u043D\u0433 \u043F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442. \u0421\u0442\u0430\u043D\u044C\u0442\u0435 \u043F\u0435\u0440\u0432\u044B\u043C \u043F\u043E\u0431\u0435\u0434\u0438\u0442\u0435\u043B\u0435\u043C!" : "\u{1F3C6} Leaderboard is empty. Be the first winner!"
    );
    return;
  }
  const top10 = leaderboard.slice(0, 10);
  const medals = ["\u{1F947}", "\u{1F948}", "\u{1F949}"];
  let message = l.leaderboardTitle(type) + "\n\n";
  top10.forEach((entry, index) => {
    const medal = medals[index] || `${index + 1}.`;
    const name = entry.username || `User ${entry.userId}`;
    message += `${medal} ${name} \u2014 ${entry.wins} \u{1F3C6}
`;
  });
  await ctx.reply(message);
}
__name(handleLeaderboard, "handleLeaderboard");
async function handleCurrent(ctx, env, config2) {
  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config2.language);
  const daily = await storage.getChallenge("daily");
  const weekly = await storage.getChallenge("weekly");
  const monthly = await storage.getChallenge("monthly");
  const formatChallenge = /* @__PURE__ */ __name((challenge, type) => {
    if (!challenge || challenge.status !== "active") {
      return config2.language === "ru" ? `${l.challengeTypes[type]}: \u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0433\u043E` : `${l.challengeTypes[type]}: None active`;
    }
    const endDate = new Date(challenge.endsAt);
    const timeLeft = challenge.endsAt - Date.now();
    const hoursLeft = Math.max(0, Math.floor(timeLeft / (1e3 * 60 * 60)));
    return config2.language === "ru" ? `${l.challengeTypes[type]}:
   \u{1F3A8} "${challenge.topic}"
   \u23F0 \u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C: ${hoursLeft} \u0447.` : `${l.challengeTypes[type]}:
   \u{1F3A8} "${challenge.topic}"
   \u23F0 Time left: ${hoursLeft} h.`;
  }, "formatChallenge");
  const message = config2.language === "ru" ? `\u{1F4CB} \u0422\u0435\u043A\u0443\u0449\u0438\u0435 \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0438:

${formatChallenge(daily, "daily")}

${formatChallenge(weekly, "weekly")}

${formatChallenge(monthly, "monthly")}` : `\u{1F4CB} Current challenges:

${formatChallenge(daily, "daily")}

${formatChallenge(weekly, "weekly")}

${formatChallenge(monthly, "monthly")}`;
  await ctx.reply(message);
}
__name(handleCurrent, "handleCurrent");

// src/services/ai.ts
var GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
var AIService = class {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  async generateThemes(type, language = "ru", previousThemes = []) {
    const complexity = {
      daily: language === "ru" ? "\u043F\u0440\u043E\u0441\u0442\u044B\u0435, \u0437\u0430\u0431\u0430\u0432\u043D\u044B\u0435, \u043C\u043E\u0436\u043D\u043E \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u0437\u0430 5-10 \u043C\u0438\u043D\u0443\u0442 \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0438" : "simple, fun, can be done in 5-10 minutes of generation",
      weekly: language === "ru" ? "\u0438\u043D\u0442\u0435\u0440\u0435\u0441\u043D\u044B\u0435, \u0442\u0440\u0435\u0431\u0443\u044E\u0449\u0438\u0435 \u043A\u0440\u0435\u0430\u0442\u0438\u0432\u0430 \u0438 \u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u043E\u0432 \u0441\u043E \u0441\u0442\u0438\u043B\u044F\u043C\u0438" : "interesting, requiring creativity and style experimentation",
      monthly: language === "ru" ? "\u0441\u043B\u043E\u0436\u043D\u044B\u0435, \u0430\u043C\u0431\u0438\u0446\u0438\u043E\u0437\u043D\u044B\u0435, \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0438\u0439 \u0432\u044B\u0437\u043E\u0432 \u0434\u043B\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u0442\u0432\u0430" : "complex, ambitious, a real challenge for mastery"
    };
    const exclusionNote = previousThemes.length > 0 ? language === "ru" ? `

\u0412\u0410\u0416\u041D\u041E: \u041D\u0415 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0439 \u0442\u0435\u043C\u044B \u043F\u043E\u0445\u043E\u0436\u0438\u0435 \u043D\u0430 \u044D\u0442\u0438 (\u0443\u0436\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043D\u044B\u0435):
${previousThemes.map((t, i) => `- ${t}`).join("\n")}` : `

IMPORTANT: DO NOT suggest themes similar to these (already used):
${previousThemes.map((t, i) => `- ${t}`).join("\n")}` : "";
    const prompt = language === "ru" ? `\u0422\u044B \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0448\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u0441\u0442\u0432\u0443 \u043D\u0435\u0439\u0440\u043E-\u0430\u0440\u0442 \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0438 (Midjourney, Stable Diffusion, DALL-E, Flux \u0438 \u0442.\u0434.).

\u041F\u0440\u0438\u0434\u0443\u043C\u0430\u0439 4 \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u0442\u0435\u043C\u044B \u0434\u043B\u044F ${type === "daily" ? "\u0435\u0436\u0435\u0434\u043D\u0435\u0432\u043D\u043E\u0433\u043E" : type === "weekly" ? "\u0435\u0436\u0435\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E" : "\u0435\u0436\u0435\u043C\u0435\u0441\u044F\u0447\u043D\u043E\u0433\u043E"} \u0447\u0435\u043B\u043B\u0435\u043D\u0434\u0436\u0430.

\u0421\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C: ${complexity[type]}.

\u0422\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F:
- \u0422\u0435\u043C\u044B \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u041A\u041E\u041D\u041A\u0420\u0415\u0422\u041D\u042B\u041C\u0418 (\u043D\u0435 "\u043F\u0440\u0438\u0440\u043E\u0434\u0430", \u0430 "\u0417\u0430\u0431\u0440\u043E\u0448\u0435\u043D\u043D\u044B\u0439 \u043C\u0430\u044F\u043A \u043D\u0430 \u0437\u0430\u043A\u0430\u0442\u0435 \u0432 \u0441\u0442\u0438\u043B\u0435 \u0425\u0430\u044F\u043E \u041C\u0438\u044F\u0434\u0437\u0430\u043A\u0438")
- \u0412\u0434\u043E\u0445\u043D\u043E\u0432\u043B\u044F\u044E\u0449\u0438\u043C\u0438 \u0434\u043B\u044F AI-\u0430\u0440\u0442\u0430
- \u0420\u0430\u0437\u043D\u043E\u043E\u0431\u0440\u0430\u0437\u043D\u044B\u043C\u0438 \u043F\u043E \u0441\u0442\u0438\u043B\u044F\u043C \u0438 \u0441\u044E\u0436\u0435\u0442\u0430\u043C
- \u041D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C \u044F\u0437\u044B\u043A\u0435
- \u0411\u0435\u0437 \u043D\u0443\u043C\u0435\u0440\u0430\u0446\u0438\u0438 \u0438 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0439${exclusionNote}

\u041E\u0442\u0432\u0435\u0442\u044C \u0422\u041E\u041B\u042C\u041A\u041E \u0441\u043F\u0438\u0441\u043A\u043E\u043C \u0438\u0437 4 \u0442\u0435\u043C, \u043F\u043E \u043E\u0434\u043D\u043E\u0439 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0443.` : `You help an AI art generation community (Midjourney, Stable Diffusion, DALL-E, Flux, etc.).

Create 4 unique themes for a ${type} challenge.

Difficulty: ${complexity[type]}.

Requirements:
- Themes must be SPECIFIC (not "nature" but "Abandoned lighthouse at sunset in Hayao Miyazaki style")
- Inspiring for AI art
- Diverse in styles and subjects
- In English
- No numbering or explanations${exclusionNote}

Reply with ONLY a list of 4 themes, one per line.`;
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 1,
            maxOutputTokens: 500
          }
        })
      });
      if (!response.ok) {
        console.error(`Gemini API error: ${response.status}`);
        return this.getFallbackThemes(type, language);
      }
      const data = await response.json();
      if (data.error) {
        console.error(`Gemini error: ${data.error.message}`);
        return this.getFallbackThemes(type, language);
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const themes = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 5 && !line.match(/^\d+[\.\)]/)).slice(0, 4);
      if (themes.length < 4) {
        return this.getFallbackThemes(type, language);
      }
      return themes;
    } catch (error) {
      console.error("AI generation failed:", error);
      return this.getFallbackThemes(type, language);
    }
  }
  getFallbackThemes(type, language) {
    const fallbacks = {
      ru: {
        daily: [
          "\u0423\u044E\u0442\u043D\u0430\u044F \u043A\u043E\u0444\u0435\u0439\u043D\u044F \u0432 \u0434\u043E\u0436\u0434\u043B\u0438\u0432\u044B\u0439 \u0434\u0435\u043D\u044C",
          "\u041A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043A\u043E\u0442-\u043F\u0443\u0442\u0435\u0448\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u0438\u043A",
          "\u0412\u043E\u043B\u0448\u0435\u0431\u043D\u044B\u0439 \u043B\u0435\u0441 \u0441 \u0441\u0432\u0435\u0442\u044F\u0449\u0438\u043C\u0438\u0441\u044F \u0433\u0440\u0438\u0431\u0430\u043C\u0438",
          "\u0420\u0435\u0442\u0440\u043E-\u0444\u0443\u0442\u0443\u0440\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0433\u043E\u0440\u043E\u0434"
        ],
        weekly: [
          "\u041F\u043E\u0434\u0432\u043E\u0434\u043D\u044B\u0439 \u043C\u0438\u0440 \u0433\u043B\u0430\u0437\u0430\u043C\u0438 \u0440\u044B\u0431\u044B",
          "\u0417\u0430\u0431\u0440\u043E\u0448\u0435\u043D\u043D\u0430\u044F \u043A\u043E\u0441\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u044F",
          "\u0421\u044E\u0440\u0440\u0435\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u044B\u0439 \u043D\u0430\u0442\u044E\u0440\u043C\u043E\u0440\u0442 \u0441 \u0447\u0430\u0441\u0430\u043C\u0438",
          "\u041A\u0438\u0431\u0435\u0440\u043F\u0430\u043D\u043A-\u0432\u0435\u0440\u0441\u0438\u044F \u0441\u043A\u0430\u0437\u043A\u0438"
        ],
        monthly: [
          "\u042D\u043F\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0431\u0438\u0442\u0432\u0430 \u0441\u0442\u0438\u0445\u0438\u0439",
          "\u041F\u0430\u0440\u0430\u043B\u043B\u0435\u043B\u044C\u043D\u0430\u044F \u0432\u0441\u0435\u043B\u0435\u043D\u043D\u0430\u044F, \u0433\u0434\u0435 \u0432\u0441\u0451 \u043D\u0430\u043E\u0431\u043E\u0440\u043E\u0442",
          "\u0421\u0438\u043C\u0431\u0438\u043E\u0437 \u043F\u0440\u0438\u0440\u043E\u0434\u044B \u0438 \u0442\u0435\u0445\u043D\u043E\u043B\u043E\u0433\u0438\u0439 \u0431\u0443\u0434\u0443\u0449\u0435\u0433\u043E",
          "\u041C\u0438\u0440 \u0433\u043B\u0430\u0437\u0430\u043C\u0438 \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E \u0438\u043D\u0442\u0435\u043B\u043B\u0435\u043A\u0442\u0430"
        ]
      },
      en: {
        daily: [
          "Cozy coffee shop on a rainy day",
          "Space traveling cat",
          "Magical forest with glowing mushrooms",
          "Retro-futuristic city"
        ],
        weekly: [
          "Underwater world through a fish's eyes",
          "Abandoned space station",
          "Surrealistic still life with clocks",
          "Cyberpunk fairy tale version"
        ],
        monthly: [
          "Epic battle of elements",
          "Parallel universe where everything is opposite",
          "Symbiosis of nature and future technology",
          "World through the eyes of AI"
        ]
      }
    };
    return fallbacks[language][type];
  }
};
__name(AIService, "AIService");

// src/cron/challenges.ts
async function generatePoll(bot, env, config2, type) {
  const storage = new StorageService(env.CHALLENGE_KV);
  const ai = new AIService(env.GEMINI_API_KEY);
  const l = getLocalization(config2.language);
  const existingPoll = await storage.getPoll(type);
  if (existingPoll) {
    console.log(`Poll for ${type} already exists, skipping generation`);
    return;
  }
  const topicId = config2.topics[type];
  const previousThemes = await storage.getThemeHistory(type);
  console.log(`Previous themes for ${type}:`, previousThemes);
  console.log(`Generating themes for ${type} challenge...`);
  const themes = await ai.generateThemes(type, config2.language, previousThemes);
  console.log(`Generated themes:`, themes);
  let pollMessage;
  try {
    pollMessage = await bot.api.sendPoll(
      config2.chatId,
      l.pollQuestion(type),
      themes,
      {
        message_thread_id: topicId || void 0,
        is_anonymous: false,
        allows_multiple_answers: false
      }
    );
  } catch (error) {
    console.error(`Failed to send poll for ${type}:`, error);
    return;
  }
  await storage.savePoll({
    type,
    pollId: pollMessage.poll.id,
    messageId: pollMessage.message_id,
    options: themes,
    createdAt: Date.now(),
    topicThreadId: topicId
  });
  console.log(`Poll created for ${type}: message_id=${pollMessage.message_id}`);
}
__name(generatePoll, "generatePoll");
async function startChallenge(bot, env, config2, type) {
  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config2.language);
  await finishChallenge(bot, env, config2, type);
  const poll = await storage.getPoll(type);
  if (!poll) {
    console.log(`No poll found for ${type}, using fallback theme`);
    await startChallengeWithTheme(bot, env, config2, type, "\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u0430\u044F \u0442\u0435\u043C\u0430");
    return;
  }
  try {
    const stoppedPoll = await bot.api.stopPoll(config2.chatId, poll.messageId);
    let maxVotes = 0;
    let winningTheme = poll.options[0];
    for (const option of stoppedPoll.options) {
      if (option.voter_count > maxVotes) {
        maxVotes = option.voter_count;
        winningTheme = option.text;
      }
    }
    console.log(`Winning theme for ${type}: "${winningTheme}" with ${maxVotes} votes`);
    await storage.deletePoll(type);
    await startChallengeWithTheme(bot, env, config2, type, winningTheme);
  } catch (error) {
    console.error(`Error stopping poll:`, error);
    await startChallengeWithTheme(bot, env, config2, type, poll.options[0]);
    await storage.deletePoll(type);
  }
}
__name(startChallenge, "startChallenge");
async function startChallengeWithTheme(bot, env, config2, type, theme) {
  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config2.language);
  const topicId = config2.topics[type];
  const now = Date.now();
  const durations = {
    daily: 24 * 60 * 60 * 1e3,
    // 24 hours
    weekly: 7 * 24 * 60 * 60 * 1e3,
    // 7 days
    monthly: 28 * 24 * 60 * 60 * 1e3
    // ~28 days (will be adjusted by cron)
  };
  const endsAt = now + durations[type];
  const endDate = new Date(endsAt + config2.timezoneOffset * 60 * 60 * 1e3);
  const endTimeStr = endDate.toLocaleString(
    config2.language === "ru" ? "ru-RU" : "en-US",
    {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
  const challengeId = await storage.getNextChallengeId(type);
  const challenge = {
    id: challengeId,
    type,
    topic: theme,
    status: "active",
    startedAt: now,
    endsAt,
    topicThreadId: topicId
  };
  try {
    const announcement = await bot.api.sendMessage(
      config2.chatId,
      l.challengeAnnouncement(type, theme, endTimeStr),
      {
        message_thread_id: topicId || void 0
      }
    );
    challenge.announcementMessageId = announcement.message_id;
  } catch (error) {
    console.error(`Failed to send challenge announcement for ${type}:`, error);
  }
  await storage.saveChallenge(challenge);
  const activeTopics = await storage.getActiveTopics();
  activeTopics[topicId] = type;
  await storage.setActiveTopics(activeTopics);
  await storage.addThemeToHistory(type, theme);
  console.log(`Challenge started: ${type} #${challengeId} - "${theme}"`);
}
__name(startChallengeWithTheme, "startChallengeWithTheme");
async function finishChallenge(bot, env, config2, type) {
  const storage = new StorageService(env.CHALLENGE_KV);
  const l = getLocalization(config2.language);
  const challenge = await storage.getChallenge(type);
  if (!challenge || challenge.status !== "active") {
    console.log(`No active ${type} challenge to finish`);
    return;
  }
  const submissions = await storage.getSubmissions(type, challenge.id);
  if (submissions.length === 0) {
    try {
      await bot.api.sendMessage(config2.chatId, l.noSubmissions, {
        message_thread_id: challenge.topicThreadId || void 0
      });
    } catch (error) {
      console.error(`Failed to send 'no submissions' message:`, error);
    }
    challenge.status = "finished";
    await storage.saveChallenge(challenge);
    const activeTopics2 = await storage.getActiveTopics();
    delete activeTopics2[challenge.topicThreadId];
    await storage.setActiveTopics(activeTopics2);
    return;
  }
  const sorted = [...submissions].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  console.log(`Winner of ${type} #${challenge.id}: user=${winner.userId}, score=${winner.score}`);
  const winnerName = winner.username ? `@${winner.username}` : `User #${winner.userId}`;
  try {
    await bot.api.sendMessage(
      config2.chatId,
      l.winnerAnnouncement(winnerName, winner.score, type),
      {
        message_thread_id: challenge.topicThreadId || void 0,
        reply_to_message_id: winner.messageId
      }
    );
  } catch (error) {
    console.error(`Failed to announce winner for ${type}:`, error);
  }
  if (config2.topics.winners) {
    try {
      await bot.api.forwardMessage(
        config2.chatId,
        config2.chatId,
        winner.messageId,
        {
          message_thread_id: config2.topics.winners
        }
      );
      await bot.api.sendMessage(
        config2.chatId,
        config2.language === "ru" ? `\u{1F3C6} \u041F\u043E\u0431\u0435\u0434\u0438\u0442\u0435\u043B\u044C ${l.challengeTypes[type]} #${challenge.id}
\u{1F464} ${winnerName}
\u{1F3A8} \u0422\u0435\u043C\u0430: "${challenge.topic}"
\u2B50 \u0420\u0435\u0430\u043A\u0446\u0438\u0439: ${winner.score}` : `\u{1F3C6} Winner of ${l.challengeTypes[type]} #${challenge.id}
\u{1F464} ${winnerName}
\u{1F3A8} Theme: "${challenge.topic}"
\u2B50 Reactions: ${winner.score}`,
        {
          message_thread_id: config2.topics.winners
        }
      );
    } catch (error) {
      console.error("Error forwarding to winners topic:", error);
    }
  }
  await storage.addWin(type, winner.userId, winner.username);
  challenge.status = "finished";
  await storage.saveChallenge(challenge);
  const activeTopics = await storage.getActiveTopics();
  delete activeTopics[challenge.topicThreadId];
  await storage.setActiveTopics(activeTopics);
  console.log(`Challenge ${type} #${challenge.id} finished`);
}
__name(finishChallenge, "finishChallenge");
async function handleCron(bot, env, config2, cron) {
  const [minute, hour, day, month, weekday] = cron.split(" ");
  const hourNum = parseInt(hour, 10);
  const dayNum = parseInt(day, 10);
  const weekdayNum = parseInt(weekday, 10);
  console.log(`Cron triggered: ${cron}`);
  if (hourNum === 5 && day === "*" && weekday === "*") {
    await generatePoll(bot, env, config2, "daily");
    return;
  }
  if (hourNum === 17 && day === "*" && weekday === "*") {
    await startChallenge(bot, env, config2, "daily");
    return;
  }
  if (hourNum === 10 && weekdayNum === 6) {
    await generatePoll(bot, env, config2, "weekly");
    return;
  }
  if (hourNum === 17 && weekdayNum === 0) {
    await startChallenge(bot, env, config2, "weekly");
    return;
  }
  if (hourNum === 10 && dayNum === 28) {
    await generatePoll(bot, env, config2, "monthly");
    return;
  }
  if (hourNum === 17 && dayNum === 1) {
    await startChallenge(bot, env, config2, "monthly");
    return;
  }
  console.log(`Unknown cron pattern: ${cron}`);
}
__name(handleCron, "handleCron");

// src/index.ts
function getConfig(env) {
  return {
    chatId: parseInt(env.CHAT_ID, 10) || 0,
    topics: {
      daily: parseInt(env.TOPIC_DAILY, 10) || 0,
      weekly: parseInt(env.TOPIC_WEEKLY, 10) || 0,
      monthly: parseInt(env.TOPIC_MONTHLY, 10) || 0,
      winners: parseInt(env.TOPIC_WINNERS, 10) || 0
    },
    timezoneOffset: parseInt(env.TIMEZONE_OFFSET, 10) || 0,
    language: env.BOT_LANGUAGE === "en" ? "en" : "ru"
  };
}
__name(getConfig, "getConfig");
function createBot(env) {
  const bot = new Bot(env.BOT_TOKEN);
  const config2 = getConfig(env);
  bot.api.config.use(
    (0, import_auto_retry.autoRetry)({
      maxRetryAttempts: 3,
      maxDelaySeconds: 10,
      rethrowInternalServerErrors: false,
      // retry on 500 errors too
      rethrowHttpErrors: false
      // retry on network errors
    })
  );
  bot.use(
    (0, import_ratelimiter.limit)({
      timeFrame: 2e3,
      // 2 seconds
      limit: 3,
      // allow 3 messages per timeFrame
      onLimitExceeded: async (ctx) => {
        console.log(`Rate limit exceeded for user: ${ctx.from?.id}`);
      },
      keyGenerator: (ctx) => {
        return ctx.from?.id?.toString();
      }
    })
  );
  const submissionComposer = new Composer();
  submissionComposer.on("message:photo", (ctx) => handleSubmission(ctx, env, config2));
  submissionComposer.on("message:document", (ctx) => handleSubmission(ctx, env, config2));
  bot.errorBoundary(
    (err) => {
      console.error("Submission handler error:", err.message);
    }
  ).use(submissionComposer);
  const reactionComposer = new Composer();
  reactionComposer.on(
    "message_reaction_count",
    (ctx) => handleReactionCount(ctx, env, config2)
  );
  bot.errorBoundary(
    (err) => {
      console.error("Reaction handler error:", err.message);
    }
  ).use(reactionComposer);
  const commandComposer = new Composer();
  commandComposer.command("start", (ctx) => handleStart(ctx, env, config2));
  commandComposer.command("help", (ctx) => handleHelp(ctx, env, config2));
  commandComposer.command("stats", (ctx) => handleStats(ctx, env, config2));
  commandComposer.command("leaderboard", (ctx) => handleLeaderboard(ctx, env, config2));
  commandComposer.command("current", (ctx) => handleCurrent(ctx, env, config2));
  bot.errorBoundary(
    async (err) => {
      console.error("Command handler error:", err.message);
      try {
        await err.ctx.reply("An error occurred. Please try again later.");
      } catch {
      }
    }
  ).use(commandComposer);
  bot.catch((err) => {
    console.error("Unhandled bot error:", err);
  });
  return bot;
}
__name(createBot, "createBot");
var app = new Hono2();
app.get("/", (c) => {
  return c.json({
    status: "ok",
    bot: "TG Challenge Bot",
    version: "1.0.0"
  });
});
app.post("/webhook", async (c) => {
  const env = c.env;
  if (!env.BOT_TOKEN) {
    return c.json({ error: "BOT_TOKEN not configured" }, 500);
  }
  try {
    const bot = createBot(env);
    const handler = webhookCallback(bot, "hono");
    return await handler(c);
  } catch (error) {
    console.error("Webhook error:", error);
    return c.json({ error: "Webhook processing failed" }, 500);
  }
});
app.get("/setup", async (c) => {
  const env = c.env;
  if (!env.BOT_TOKEN) {
    return c.json({ error: "BOT_TOKEN not configured" }, 500);
  }
  const bot = new Bot(env.BOT_TOKEN);
  const url = new URL(c.req.url);
  const webhookUrl = `${url.origin}/webhook`;
  try {
    await bot.api.setWebhook(webhookUrl, {
      allowed_updates: [
        "message",
        "message_reaction",
        "message_reaction_count",
        "poll",
        "poll_answer"
      ]
    });
    return c.json({
      success: true,
      webhook_url: webhookUrl,
      message: "Webhook registered successfully!"
    });
  } catch (error) {
    console.error("Setup error:", error);
    return c.json({ error: "Failed to set webhook" }, 500);
  }
});
app.get("/info", (c) => {
  const env = c.env;
  const config2 = getConfig(env);
  return c.json({
    configured: !!env.BOT_TOKEN,
    chat_id: config2.chatId,
    topics: config2.topics,
    timezone_offset: config2.timezoneOffset,
    language: config2.language,
    gemini_configured: !!env.GEMINI_API_KEY
  });
});
var src_default = {
  // HTTP fetch handler
  fetch: app.fetch,
  // Cron trigger handler
  async scheduled(event, env, ctx) {
    if (!env.BOT_TOKEN || !env.CHAT_ID) {
      console.error("Bot not configured: missing BOT_TOKEN or CHAT_ID");
      return;
    }
    const bot = createBot(env);
    const config2 = getConfig(env);
    try {
      await handleCron(bot, env, config2, event.cron);
    } catch (error) {
      console.error("Cron error:", error);
    }
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
