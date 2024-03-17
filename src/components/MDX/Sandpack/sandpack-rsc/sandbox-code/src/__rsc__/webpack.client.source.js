import {installWebpackGlobals} from './webpack.source.js';

installWebpackGlobals((specifier) => import(specifier), {
  __webpack_chunk_load__: 'REACT_CLIENT$__webpack_chunk_load__',
  __webpack_require__: 'REACT_CLIENT$__webpack_require__',
});

// @ts-expect-error 'module.hot' not on type definitions
if (module.hot) {
  // @ts-expect-error 'module.hot' not on type definitions
  module.hot.accept();
}
