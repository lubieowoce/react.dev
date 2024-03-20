import {installWebpackGlobals} from '../shared/webpack.source.js';

// react-server in sandpack is hardcoded to evaluate client modules
// with `__webpack_require__` aliased to `REACT_CLIENT$__webpack_require__`
// to avoid conflicts with server globals
installWebpackGlobals((specifier) => import(specifier), {
  __webpack_chunk_load__: 'REACT_CLIENT$__webpack_chunk_load__',
  __webpack_require__: 'REACT_CLIENT$__webpack_require__',
});

// @ts-expect-error 'module.hot' not on type definitions
if (module.hot) {
  // @ts-expect-error 'module.hot' not on type definitions
  module.hot.accept();
}
