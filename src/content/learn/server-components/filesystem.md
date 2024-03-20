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