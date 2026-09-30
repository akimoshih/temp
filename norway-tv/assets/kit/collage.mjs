// ES-module entry: import Collage from './assets/kit/collage.mjs'
// (collage.js is a classic script that registers globalThis.Collage; this wrapper fixes the asset base URL.)
import './collage.js';
const Collage = globalThis.Collage;
Collage.setBase(new URL('.', import.meta.url).href);
export default Collage;
