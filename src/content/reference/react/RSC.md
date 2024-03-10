---
title: Server components
---

<Intro>

Server components are cool!


</Intro>

<InlineToc />

## Usage {/*usage*/}

<Sandpack rsc>

```json package.json hidden
{
  "dependencies": {
    "react": "canary",
    "react-dom": "canary",
    "react-server-dom-webpack": "canary"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test --env=jsdom",
    "eject": "react-scripts eject"
  }
}
```

```js src/rsc/webpack.js hidden
// console.log("installing __webpack_require__...");

const moduleCache = new Map();

const getOrImport = (/** @type {string} */ id) => {
  // in sandpack's case, modules and chunks are one and the same.
  if (!moduleCache.has(id)) {
    const promise = import(id);
    moduleCache.set(id, promise);
  }
  return moduleCache.get(id);
}

if (typeof globalThis["__webpack_require__"] !== "function") {
  globalThis["__webpack_chunk_load__"] = (/** @type {string} */ id) => {
    // console.log('__webpack_chunk_load__', id)

    // in sandpack's case, there is no concept of chunks.
    // but it's probably best that we have a preload-adjacent thing,
    // so in the client reference, we set the chunk to the same filename as the module,
    // and just import() it.
    // unlike __webpack_chunk_load__, this also evaluates the module,
    // but we don't really mind here.
    return getOrImport(id);
  }

  /** @type {Map<string, Promise<Record<string, unknown>>>} */
  globalThis["__webpack_require__"] = (/** @type {string} */ id) => {
    // console.log('__webpack_require__', id);

    return getOrImport(id);
  };
}

export {};
```

```js src/rsc/client-element.js hidden

/** @returns {ReadableStream<Uint8Array>} */
function intoStream(/** @type {string[]} */ chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        await null;
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

export function createClientElementStream(
  /** @type {{ moduleId: string; exportName: string }} */ reference,
  /** @type {Record<string, any>} */ props,
) {
  const { moduleId, exportName } = reference;
  if (!moduleId) {
    throw new Error(`createClientElementStream :: received ${moduleId} as moduleId`);
  }
  const chunkSep = "\r\n";
  return intoStream([
    `1:I[${JSON.stringify(moduleId)},[${JSON.stringify(moduleId)}],${JSON.stringify(exportName)},1]`,
    chunkSep,
    `0:["$","$L1",null,${JSON.stringify(props)}]`,
    chunkSep,
  ]);
}
```

```js src/index.js
import './rsc/webpack.js';
import * as RSDWServer from 'react-server-dom-webpack/server';

const App = RSDWServer.createClientModuleProxy('file:///src/App.js')[''];

async function handleRequest() {
  const stream = await RSDWServer.renderToReadableStream(
    <App />,
    moduleMap,
    { onError: console.error }
  );
  return stream;
};

const moduleMap = new Proxy({}, {
  get(_, key) {
    const [moduleUrl, exportName] = key.split('#');
    const moduleName = moduleUrl.replace(/^file:\/\//, '');
    // console.log('moduleMap', { moduleName, exportName });
    return { id: moduleName, chunks: [moduleName], name: exportName }
  }
});

const listener = async (event) => {
  // console.log('RSC frame got message', event)
  const { data } = event;
  if (!data.__rsc_request) {
    return
  }

  const { requestId } = data.__rsc_request;

  try {
    const stream = await handleRequest();
    // console.log('RSC frame', 'responding...', { requestId })
    window.parent.postMessage(
      { __rsc_response: { requestId, data: stream } },
      '*',
      [stream]
    );
  } catch (error) {
    window.parent.postMessage(
      { __rsc_response: { requestId, error: error.message ?? `${error}` } },
      '*',
    );
  }
}

// nastily handle hot reload
if (window.__RSC_LISTENER && window.__RSC_LISTENER !== listener) {
  window.removeEventListener(
    "message",
    window.__RSC_LISTENER,
    false,
  );
  window.__RSC_LISTENER = listener;
}

window.addEventListener(
  "message",
  listener,
  false,
);
```

```js src/App.js hidden
"use client"
import ArtistPage from './ArtistPage.js';
export default function App() {
  return <ArtistPage
    artist={{
      id: 'the-beatles',
      name: 'The Beatles',
    }}
  />
}

// import './rsc/webpack.js';
// import { createFromReadableStream } from 'react-server-dom-webpack/client.browser'
// import { createClientElementStream } from './rsc/client-element';

// const stream = createClientElementStream(
//   {
//     moduleId: "/src/ArtistPage.js",
//     // moduleId: require.resolve("./ArtistPage.js"),
//     // moduleId: await import.meta.resolve("./ArtistPage.js"),
//     exportName: "",
//     // exportName: "default",
//   },
//   {
//     artist: {
//       id: 'the-beatles',
//       name: 'The Beatles',
//     }
//   },
// );

// const rootElement = createFromReadableStream(stream, {});

// export default function Root() {
//   console.log('hi from Root')
//   return rootElement;
// }
```

```js src/ArtistPage.js active
import { Suspense } from 'react';
import Albums from './Albums.js';

export default function ArtistPage({ artist }) {
  return (
    <>
      <h1>{artist.name}</h1>
      <Suspense fallback={<Loading />}>
        <Albums artistId={artist.id} />
      </Suspense>
    </>
  );
}

function Loading() {
  return <h2>🌀 Loading...</h2>;
}
```

```js src/Albums.js hidden
import { fetchData } from './data.js';

// Note: this component is written using an experimental API
// that's not yet available in stable versions of React.

// For a realistic example you can follow today, try a framework
// that's integrated with Suspense, like Relay or Next.js.

export default function Albums({ artistId }) {
  const albums = use(fetchData(`/${artistId}/albums`));
  return (
    <ul>
      {albums.map(album => (
        <li key={album.id}>
          {album.title} ({album.year})
        </li>
      ))}
    </ul>
  );
}

// This is a workaround for a bug to get the demo running.
// TODO: replace with real implementation when the bug is fixed.
function use(promise) {
  if (promise.status === 'fulfilled') {
    return promise.value;
  } else if (promise.status === 'rejected') {
    throw promise.reason;
  } else if (promise.status === 'pending') {
    throw promise;
  } else {
    promise.status = 'pending';
    promise.then(
      result => {
        promise.status = 'fulfilled';
        promise.value = result;
      },
      reason => {
        promise.status = 'rejected';
        promise.reason = reason;
      },      
    );
    throw promise;
  }
}
```

```js src/data.js hidden
// Note: the way you would do data fetching depends on
// the framework that you use together with Suspense.
// Normally, the caching logic would be inside a framework.

let cache = new Map();

export function fetchData(url) {
  if (!cache.has(url)) {
    cache.set(url, getData(url));
  }
  return cache.get(url);
}

async function getData(url) {
  if (url === '/the-beatles/albums') {
    return await getAlbums();
  } else {
    throw Error('Not implemented');
  }
}

async function getAlbums() {
  // Add a fake delay to make waiting noticeable.
  await new Promise(resolve => {
    setTimeout(resolve, 3000);
  });

  return [{
    id: 13,
    title: 'Let It Be',
    year: 1970
  }, {
    id: 12,
    title: 'Abbey Road',
    year: 1969
  }, {
    id: 11,
    title: 'Yellow Submarine',
    year: 1969
  }, {
    id: 10,
    title: 'The Beatles',
    year: 1968
  }, {
    id: 9,
    title: 'Magical Mystery Tour',
    year: 1967
  }, {
    id: 8,
    title: 'Sgt. Pepper\'s Lonely Hearts Club Band',
    year: 1967
  }, {
    id: 7,
    title: 'Revolver',
    year: 1966
  }, {
    id: 6,
    title: 'Rubber Soul',
    year: 1965
  }, {
    id: 5,
    title: 'Help!',
    year: 1965
  }, {
    id: 4,
    title: 'Beatles For Sale',
    year: 1964
  }, {
    id: 3,
    title: 'A Hard Day\'s Night',
    year: 1964
  }, {
    id: 2,
    title: 'With The Beatles',
    year: 1963
  }, {
    id: 1,
    title: 'Please Please Me',
    year: 1963
  }];
}
```

</Sandpack>
