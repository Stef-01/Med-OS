/* plugin-serializable.mjs: throws when a move or hook leaves G holding something JSON cannot carry (outside
   production).
   Ported from boardgame.io src/plugins/plugin-serializable.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io
   Authors; the licence is ../LICENSE). Changed: types removed; lodash.isplainobject is replaced by the few lines of
   isPlainObject below; process.env is read through globalThis.process, so in a browser with no bundler (no process)
   the check always runs, as it does outside production. */

/* lodash.isplainobject 4.0.6, line for line: an object whose prototype is null, or is a realm's Object.prototype (or
   the prototype of something whose constructor's source reads like Object's), and that is not a host object. */
const objectCtorString = Function.prototype.toString.call(Object);
function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Object.prototype.toString.call(value) !== '[object Object]') return false;
  if (typeof value.toString !== 'function') {
    try {
      if (value + '') return false; // a host object: coerces to a string despite having no toString method
    } catch {
      // not a host object
    }
  }
  const proto = Object.getPrototypeOf(value);
  if (proto === null) return true;
  const Ctor = Object.prototype.hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor === 'function' && Ctor instanceof Ctor && Function.prototype.toString.call(Ctor) === objectCtorString;
}

/* Check if a value can be serialized (e.g. using `JSON.stringify`).
   Adapted from: https://stackoverflow.com/a/30712764/3829557 */
function isSerializable(value) {
  // Primitives are OK.
  if (
    value === undefined ||
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return true;
  }

  // A non-primitive value that is neither a POJO or an array cannot be serialized.
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return false;
  }

  // Recurse entries if the value is an object or array.
  for (const key in value) {
    if (!isSerializable(value[key])) return false;
  }

  return true;
}

/* Plugin that checks whether state is serializable, in order to avoid network serialization bugs. */
const SerializablePlugin = {
  name: 'plugin-serializable',

  fnWrap:
    (move) =>
    (context, ...args) => {
      const result = move(context, ...args);
      // Check state in non-production environments.
      if (globalThis.process?.env?.NODE_ENV !== 'production' && !isSerializable(result)) {
        throw new Error(
          'Move state is not JSON-serialiazable.\n' +
            'See https://boardgame.io/documentation/#/?id=state for more information.',
        );
      }
      return result;
    },
};

export { isPlainObject, isSerializable };
export default SerializablePlugin;
