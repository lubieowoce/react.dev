import {installWebpackGlobals} from './webpack.source';

installWebpackGlobals((specifier) => import(specifier), {
  __webpack_chunk_load__: 'REACT_SERVER$__webpack_chunk_load__',
  __webpack_require__: 'REACT_SERVER$__webpack_require__',
});

// @ts-expect-error 'module.hot' not on type definitions
if (module.hot) {
  // @ts-expect-error 'module.hot' not on type definitions
  module.hot.accept();
}
