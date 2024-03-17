---
title: Server components
---

<Intro>

Server components are cool!


</Intro>

<InlineToc />

## Kitchen sink {/*kitchen-sink*/}

<Sandpack rsc>

```json package.json hidden
{
  "dependencies": {
    "react": "canary",
    "react-dom": "canary",
    "react-server-dom-webpack": "canary"
  }
}
```

```js src/App.js hidden
import ArtistPage from './ArtistPage.js';

export default function App() {
  return <ArtistPage
    artist={{
      id: 'the-beatles',
      name: 'The Beatles',
    }}
  />
}
```

```js src/ArtistPage.js
import { Suspense } from 'react';
import Albums from './Albums.js';
import { ClientRefetch, StatefulInput } from './ClientTest.js'
import { Wrapper } from './Shared';

export default function ArtistPage({ artist }) {
  return (
    <>
      <h1>{artist.name}</h1>
      <Wrapper>
        <StatefulInput />
        <input type="text" placeholder="Reconcilliation test" />
        <br />
        <ClientRefetch />
      </Wrapper>
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

```js src/Albums.js active
import { fetchData } from './data.js';

export default async function Albums({ artistId }) {
  const albums = await fetchData(`/${artistId}/albums`);
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
```

```js src/ClientTest.js
"use client"
import { useState } from 'react'
import { TransitivelyClient } from './TransitivelyClient.js'
import { Wrapper } from './Shared.js'

export function ClientRefetch({ artistId }) {
  return <button onClick={() => window.__RSC_REFETCH__()}>Refetch data</button>
}

export function StatefulInput() {
  const [value, setValue] = useState('');
  return (
    <Wrapper inline>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Client state test"
      />
      <TransitivelyClient />
    </Wrapper>
  );
}

function Beep() { return null }
export default Beep;

export { ClientRefetch as AliasedClientRefetch }
```

```js src/TransitivelyClient.js
import { useState } from 'react'
export function TransitivelyClient() {
  useState('whatever');
  return null;
}
```

```js src/Shared.js
export function Wrapper({ children, inline = false }) {
  return <div style={{ display: inline ? 'inline-block' : 'block' }}>{children}</div>
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

## Filesystem example {/*filesystem-example*/}

<Sandpack rsc>

```json package.json hidden
{
  "dependencies": {
    "react": "canary",
    "react-dom": "canary",
    "react-server-dom-webpack": "canary"
  }
}
```

```js src/App.js active
import * as fs from 'node:fs'
import { ClientRefetch } from './refetch'

export default function Blog() {
  const postsFile = fs.readFileSync('/src/posts.json', 'utf-8')
  const { posts } = JSON.parse(postsFile);
  return (
    <div style={{fontFamily: 'sans-serif'}}>
      <ClientRefetch /> Press to refresh after editing <code>posts.json</code>.
      <header>
        <h1>🌐 My blog</h1>
      </header>
      <div>
        {Object.keys(posts).sort().map((id) => {
          const post = posts[id];
          return (
            <article key={id}>
              <h2>{post.title}</h2>
              <p>{post.content}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
```

```json src/posts.json
{
  "posts": {
    "0": {
      "title": "Hello, world!",
      "content": "This is the first post."
    },
    "1": {
      "title": "Lorem ipsum!",
      "content": "This is the second post. Dolor sit amet."
    }
  }
}
```

```js src/refetch.js hidden
"use client"
export function ClientRefetch() {
  return <button onClick={() => window.__RSC_REFETCH__()}>Refetch data</button>
}
```

</Sandpack>
