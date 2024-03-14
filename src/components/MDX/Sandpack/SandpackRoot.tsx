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
import {Preview} from './Preview';
import {LintDiagnostic} from './useSandpackLint';
import {SandpackRSCContext, useSandpackRSCSetup} from './sandpack-rsc';

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
  const initialFiles = createFileMap(codeSnippets);

  initialFiles['/src/styles.css'] = {
    code: [sandboxStyle, initialFiles['/src/styles.css']?.code ?? ''].join(
      '\n\n'
    ),
    hidden: !initialFiles['/src/styles.css']?.visible,
  };

  const sandpackRSCSetup = useSandpackRSCSetup({
    isRsc,
    initialFiles,
    initialActiveFile: undefined, // CSB will find it from the `active` prop that files have
  });
  const clientFiles = React.useMemo(
    () => ({
      ...template,
      ...sandpackRSCSetup.files,
      ...sandpackRSCSetup.code.client,
    }),
    [sandpackRSCSetup.files, sandpackRSCSetup.code]
  );

  const serverFiles = React.useMemo(
    () => ({
      ...template,
      ...sandpackRSCSetup.files,
      ...sandpackRSCSetup.code.server,
    }),
    [sandpackRSCSetup.files, sandpackRSCSetup.code.server]
  );

  // const serverFiles = React.useDeferredValue(_serverFiles);

  const sharedOptions: SandpackProviderProps['options'] = {
    bundlerTimeOut: 30_000,
    autorun,
    initMode: 'user-visible',
    initModeObserverOptions: {rootMargin: '1400px 0px'},
    bundlerURL: 'http://localhost:1234/', // github.com:lubieowoce/sandpack-bundler.git 69fdda5
    // bundlerURL: 'https://786946de.sandpack-bundler-4bw.pages.dev',
    logLevel: SandpackLogLevel.None,
    activeFile: sandpackRSCSetup.activeFile,
    // logLevel: SandpackLogLevel.Debug,
  };

  return (
    <div className="sandpack sandpack--playground w-full my-8" dir="ltr">
      <SandpackRSCContext.Provider value={sandpackRSCSetup.context.client}>
        <SandpackProvider
          files={clientFiles}
          theme={CustomTheme}
          customSetup={{
            environment: 'react' as any,
          }}
          options={{...sharedOptions}}>
          <CustomPreset providedFiles={Object.keys(clientFiles)} />
        </SandpackProvider>
      </SandpackRSCContext.Provider>
      {isRsc && (
        <SandpackRSCContext.Provider value={sandpackRSCSetup.context.server}>
          <SandpackProvider
            files={serverFiles}
            theme={CustomTheme}
            customSetup={{
              environment: 'react-server' as any,
            }}
            options={{
              ...sharedOptions,
            }}>
            <Preview
              consoleOnly={true}
              className="order-last xl:order-2"
              isExpanded={false}
              title="Server Sandbox Frame"
              lintErrors={NO_LINT_ERRORS}
            />
          </SandpackProvider>
        </SandpackRSCContext.Provider>
      )}
    </div>
  );
}

const NO_LINT_ERRORS: LintDiagnostic = [];

export default SandpackRoot;
