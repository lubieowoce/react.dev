import {installWebpackGlobals} from '../shared/webpack.source';

// react-server in sandpack is hardcoded to evaluate server modules
// with `__webpack_require__` aliased to `REACT_SERVER$__webpack_require__`
// to avoid conflicts with client globals
installWebpackGlobals((specifier) => import(specifier), {
  __webpack_chunk_load__: 'REACT_SERVER$__webpack_chunk_load__',
  __webpack_require__: 'REACT_SERVER$__webpack_require__',
});

// @ts-expect-error 'module.hot' not on type definitions
if (module.hot) {
  // @ts-expect-error 'module.hot' not on type definitions
  module.hot.accept();
}
