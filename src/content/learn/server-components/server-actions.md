## Server actions (WIP) {/*server-actions-1*/}

Current limitations of this sandbox:

- changes to `posts.json` done via `fs.writeFileSync` will not be visible in the editor
- editing a `"use server"` file will do a full reload of the sandbox, HMR is not supported yet

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

```js src/App.js
import * as fs from 'node:fs'
import Post from './Post.js'
import BlogLayout from './BlogLayout.js'

export default function Blog() {
  const postsFile = fs.readFileSync('/src/posts.json', 'utf-8');
  const { posts } = JSON.parse(postsFile);
  return (
    <BlogLayout>
      {Object.keys(posts).sort().map((id) =>
        <Post key={id} id={id} post={posts[id]} />
      )}
    </BlogLayout>
  );
}
```

```js src/Post.js active
import ResetPost from './ResetPost.js'
import { updatePost } from './actions.js';
import { formatTimestamp } from './time-utils.js'

export default function Post({ id, post }) {
  const addContent = async () => {
    "use server";
    return updatePost(id, {
      content: post.content + '\n' + 'New content added!'
    });
  }
  return (
    <article style={{ border: '1px solid lightgrey', padding: '1em' }}>
      <h2 style={{ marginTop: 'unset' }}>{post.title}</h2>
      <div style={{ display: 'flex', gap: '1ch'}}>
        <form>
          <button formAction={addContent}>Update post</button>
        </form>
        <ResetPost id={id} />
      </div>
      {post.lastModified
        ? <em>last modified: {formatTimestamp(post.lastModified)}</em>
        : null
      }
      <p>{post.content}</p>
    </article>
  )
}

```
```js src/BlogLayout.js hidden
import { ClientRefetch } from './refetch.js'

export default function BlogLayout({ children }) {
  return (
    <div style={{fontFamily: 'sans-serif'}}>
      <ClientRefetch /> Press to refresh after editing <code>posts.json</code>.
      <header>
        <h1>🌐 My blog</h1>
      </header>
      <div>
        {children}
      </div>
    </div>
  );
}

```

```js src/actions.js
"use server"
import * as fs from 'node:fs'

export async function updatePost(id, update) {
  console.log('[server] updating post', id, JSON.stringify(update));
  
  const data = JSON.parse(
    fs.readFileSync('/src/posts.json', 'utf-8')
  );
  if (!id in data.posts) {
    throw new Error(`No post with id ${JSON.stringify(id)}`);
  }

  const timestamp = Date.now();
  data.posts[id] = {...data.posts[id], ...update, lastModified: timestamp}
  
  fs.writeFileSync(
    '/src/posts.json',
    JSON.stringify(data, null, 2), 'utf-8'
  );

  return data.posts[id];
}
```

```js src/ResetPost.js
"use client"
import { useState } from 'react';
import { updatePost } from './actions.js';

// no real need for a client component here,
// this is just a test if action imports work right

export default function ResetPost({ id }) {
  useState("");
  return (
    <form>
      <button formAction={updatePost.bind(null, id, { content: "" })}>
        Reset post
      </button>
    </form>
  );
};
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

```js src/time-utils.js hidden
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const str = date.toTimeString();
  const tzIndex = str.indexOf(' GMT')
  return tzIndex !== -1 ? str.slice(0, tzIndex) : str
}
```

```js src/refetch.js hidden
"use client"
export function ClientRefetch() {
  return <button onClick={() => window.__RSC_REFETCH__()}>Refetch data</button>
}
```

</Sandpack>
