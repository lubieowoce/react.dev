/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 */

import {Children} from 'react';
import * as React from 'react';
import {
  SandpackProvider,
  SandpackProviderProps,
} from '@codesandbox/sandpack-react/unstyled';
import {SandpackLogLevel} from '@codesandbox/sandpack-client';
import {CustomPreset} from './CustomPreset';
import {createFileMap} from './createFileMap';
import {CustomTheme} from './Themes';
import {template} from './template';
import {useSandpackRSCSetup} from './sandpack-rsc';

type SandpackProps = {
  children: React.ReactNode;
  autorun?: boolean;
  rsc?: boolean;
};

const sandboxStyle = `
* {
  box-sizing: border-box;
}

body {
  font-family: sans-serif;
  margin: 20px;
  padding: 0;
}

h1 {
  margin-top: 0;
  font-size: 22px;
}

h2 {
  margin-top: 0;
  font-size: 20px;
}

h3 {
  margin-top: 0;
  font-size: 18px;
}

h4 {
  margin-top: 0;
  font-size: 16px;
}

h5 {
  margin-top: 0;
  font-size: 14px;
}

h6 {
  margin-top: 0;
  font-size: 12px;
}

code {
  font-size: 1.2em;
}

ul {
  padding-inline-start: 20px;
}
`.trim();

function SandpackRoot(props: SandpackProps) {
  let {children, autorun = true, rsc: isRsc = false} = props;
  const codeSnippets = Children.toArray(children) as React.ReactElement[];
  const files = createFileMap(codeSnippets);

  files['/src/styles.css'] = {
    code: [sandboxStyle, files['/src/styles.css']?.code ?? ''].join('\n\n'),
    hidden: !files['/src/styles.css']?.visible,
  };

  const sandpackRSCSetup = useSandpackRSCSetup({
    isRsc,
  });
  const filesWithSetup = React.useMemo(
    () => ({
      ...template,
      ...files,
      ...sandpackRSCSetup.code,
    }),
    [files, sandpackRSCSetup.code]
  );

  // const serverFiles = React.useDeferredValue(_serverFiles);

  const sharedOptions: SandpackProviderProps['options'] = {
    bundlerTimeOut: 30_000,
    autorun,
    initMode: 'user-visible',
    initModeObserverOptions: {rootMargin: '1400px 0px'},
    // bundlerURL: 'http://localhost:1234/',
    bundlerURL: 'https://fe3dce42.fruit-flavored-sandpack-bundler.pages.dev', // https://github.com/lubieowoce/sandpack-bundler/commit/e5d1195066a6db59b0e8710f4a80d441ff0f5320
    // bundlerURL: 'https://786946de.sandpack-bundler-4bw.pages.dev',
    // logLevel: SandpackLogLevel.None,
    logLevel:
      process.env.NODE_ENV === 'development' && isRsc
        ? SandpackLogLevel.Debug
        : SandpackLogLevel.None,
  };

  return (
    <div className="sandpack sandpack--playground w-full my-8" dir="ltr">
      <SandpackProvider
        files={filesWithSetup}
        theme={CustomTheme}
        customSetup={{
          // @ts-expect-error not on the official type definitons, but it's just passed through to sandpack-bundler
          environment: isRsc ? 'react-server' : 'react',
        }}
        options={{...sharedOptions}}>
        <CustomPreset providedFiles={Object.keys(filesWithSetup)} />
      </SandpackProvider>
    </div>
  );
}

export default SandpackRoot;
