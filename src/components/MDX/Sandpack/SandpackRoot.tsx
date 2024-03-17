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
  let {children, autorun = true, rsc: isRSC = false} = props;
  const codeSnippets = Children.toArray(children) as React.ReactElement[];
  const files = createFileMap(codeSnippets);

  files['/src/styles.css'] = {
    code: [sandboxStyle, files['/src/styles.css']?.code ?? ''].join('\n\n'),
    hidden: !files['/src/styles.css']?.visible,
  };

  const sandpackRSCSetup = useSandpackRSCSetup({
    isRSC,
  });
  const filesWithSetup = React.useMemo(
    () => ({
      ...template,
      ...files,
      ...sandpackRSCSetup.code,
    }),
    [files, sandpackRSCSetup.code]
  );

  const sharedOptions: SandpackProviderProps['options'] = {
    bundlerTimeOut: 30_000,
    autorun,
    initMode: 'user-visible',
    initModeObserverOptions: {rootMargin: '1400px 0px'},
    // bundlerURL: 'http://localhost:1234/',
    bundlerURL: 'https://2b4b8ba5.fruit-flavored-sandpack-bundler.pages.dev', // https://github.com/lubieowoce/sandpack-bundler/commit/2df20b5262544b43dbf83f31c0be795f5e6e87d2
    // bundlerURL: 'https://786946de.sandpack-bundler-4bw.pages.dev',
    logLevel:
      process.env.NODE_ENV === 'development' && isRSC
        ? SandpackLogLevel.Debug
        : SandpackLogLevel.None,
    ...(process.env.NODE_ENV === 'development'
      ? {
          recompileMode: 'delayed',
          recompileDelay: 300, // in dev mode, the recompiles can get slow.
        }
      : undefined),
  };

  return (
    <div className="sandpack sandpack--playground w-full my-8" dir="ltr">
      <SandpackProvider
        files={filesWithSetup}
        theme={CustomTheme}
        customSetup={{
          // @ts-expect-error not on the official type definitons, but it's just passed through to sandpack-bundler
          // environment: isRSC ? 'react-server' : 'react',
          environment: isRSC ? ['react', {type: 'server'}] : 'react',
          dependencies: sandpackRSCSetup.dependencies,
        }}
        options={{...sharedOptions}}>
        <CustomPreset
          providedFiles={Object.keys(filesWithSetup)}
          isRSC={isRSC}
        />
      </SandpackProvider>
    </div>
  );
}

export default SandpackRoot;
