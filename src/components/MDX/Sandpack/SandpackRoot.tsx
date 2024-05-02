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
import {REACT_PRESET_OPTIONS, getSandpackRSCSetup} from './sandpack-rsc';

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

const sandpackOptionsBase: SandpackProviderProps['options'] = {
  bundlerTimeOut: 30_000,
  initMode: 'user-visible',
  initModeObserverOptions: {rootMargin: '1400px 0px'},
  bundlerURL: 'https://786946de.sandpack-bundler-4bw.pages.dev',
  ...(process.env.NODE_ENV === 'development'
    ? {
        recompileMode: 'delayed',
        recompileDelay: 300, // in dev mode, the recompiles can get slow.
      }
    : undefined),
  logLevel: SandpackLogLevel.None,
};

const sandpackOptionsRsc: SandpackProviderProps['options'] = {
  ...sandpackOptionsBase,
  bundlerTimeOut: 2 * 60 * 1000, // temporary workaround to reduce flakiness -- multiple RSC sandboxes on one page are slow
  // bundlerURL: 'http://localhost:1234/',
  bundlerURL: 'https://944ff2a2.fruit-flavored-sandpack-bundler.pages.dev', // https://github.com/lubieowoce/sandpack-bundler/commit/894944b364f90178318259c92be67ab54470c9f4
  logLevel:
    process.env.NODE_ENV === 'development'
      ? SandpackLogLevel.Debug
      : SandpackLogLevel.None,
};

function SandpackRoot(props: SandpackProps) {
  let {children, autorun = true, rsc: isRSC = false} = props;
  if (isRSC) {
    return <SandpackRSCRoot {...props} />;
  }

  const files = createFilesFromChildren(children);

  const options = {
    ...sandpackOptionsBase,
    autorun,
  };

  const filesWithSetup = {
    ...template,
    ...files,
  };

  return (
    <div className="sandpack sandpack--playground w-full my-8" dir="ltr">
      <SandpackProvider
        files={filesWithSetup}
        theme={CustomTheme}
        customSetup={{
          // @ts-expect-error not on the official type definitons, but it's just passed through to sandpack-bundler
          environment: 'react',
        }}
        options={options}>
        <CustomPreset providedFiles={Object.keys(filesWithSetup)} />
      </SandpackProvider>
    </div>
  );
}

function SandpackRSCRoot(props: SandpackProps) {
  let {children, autorun = true} = props;
  const files = createFilesFromChildren(children);

  const options = {
    ...sandpackOptionsRsc,
    autorun,
  };

  const sandpackRSCSetup = getSandpackRSCSetup();
  const filesWithSetup = {
    ...template,
    ...files,
    ...sandpackRSCSetup.code,
  };

  return (
    <div className="sandpack sandpack--playground w-full my-8" dir="ltr">
      <SandpackProvider
        files={filesWithSetup}
        theme={CustomTheme}
        customSetup={{
          // @ts-expect-error not on the official type definitons, but it's just passed through to sandpack-bundler
          environment: ['react', REACT_PRESET_OPTIONS],
          dependencies: sandpackRSCSetup.dependencies,
        }}
        options={options}>
        <CustomPreset providedFiles={Object.keys(filesWithSetup)} isRSC />
      </SandpackProvider>
    </div>
  );
}

function createFilesFromChildren(children: React.ReactNode) {
  const codeSnippets = Children.toArray(children) as React.ReactElement[];
  const files = createFileMap(codeSnippets);

  files['/src/styles.css'] = {
    code: [sandboxStyle, files['/src/styles.css']?.code ?? ''].join('\n\n'),
    hidden: !files['/src/styles.css']?.visible,
  };
  return files;
}

export default SandpackRoot;
