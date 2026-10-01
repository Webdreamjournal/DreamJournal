// Minimal browser-global stubs so the app's ES modules can be imported under Node.
const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
};
globalThis.window = globalThis;
globalThis.location = { origin: 'http://localhost', pathname: '/', search: '', href: 'http://localhost/' };
const el = () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {}, addEventListener() {} });
globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: el,
    body: el(),
    documentElement: el()
};

// Silence the app's module-load logging so test output stays readable.
const origLog = console.log;
console.log = (...args) => {
    if (typeof args[0] === 'string' && /^(Loading|Cloud|Advice|Settings)/.test(args[0])) return;
    origLog(...args);
};
