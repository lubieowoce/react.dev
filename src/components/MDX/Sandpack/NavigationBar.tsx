/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 */

import {
  useRef,
  useInsertionEffect,
  useCallback,
  useState,
  useEffect,
  Fragment,
} from 'react';
import cn from 'classnames';
import {
  SandpackState,
  useSandpack,
  useSandpackNavigation,
} from '@codesandbox/sandpack-react/unstyled';
import {OpenInCodeSandboxButton} from './OpenInCodeSandboxButton';
import {ResetButton} from './ResetButton';
import {DownloadButton} from './DownloadButton';
import {IconChevron} from '../../Icon/IconChevron';
import {Listbox} from '@headlessui/react';
import {OpenInTypeScriptPlaygroundButton} from './OpenInTypeScriptPlayground';

const getFileName = (filePath: string): string => {
  const lastIndexOfSlash = filePath.lastIndexOf('/');
  return filePath.slice(lastIndexOfSlash + 1);
};

const NO_FILES: string[] = [];

export function NavigationBar({
  providedFiles,
  showSubgraphs = false,
}: {
  providedFiles: Array<string>;
  showSubgraphs?: boolean;
}) {
  const {sandpack} = useSandpack();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  // By default, show the dropdown because all tabs may not fit.
  // We don't know whether they'll fit or not until after hydration:
  const [showDropdown, setShowDropdown] = useState(true);
  const {activeFile, setActiveFile, visibleFiles, clients} = sandpack;
  const clientId = Object.keys(clients)[0];
  const {refresh} = useSandpackNavigation(clientId);
  const isMultiFile = visibleFiles.length > 1;
  const hasJustToggledDropdown = useRef(false);

  const _subgraphsByModule = useModuleSubgraphs(
    showSubgraphs ? providedFiles : NO_FILES
  );
  const subgraphsByModule = showSubgraphs ? _subgraphsByModule : undefined;

  const getSubgraphClassnamesForFile = useCallback(
    (filePath: string, active = true) => {
      const subgraphs = subgraphsByModule?.[filePath] ?? 'unknown';
      return getSubgraphClassnames(subgraphs, active);
    },
    [subgraphsByModule]
  );

  // Keep track of whether we can show all tabs or just the dropdown.
  const onContainerResize = useEvent((containerWidth: number) => {
    if (hasJustToggledDropdown.current === true) {
      // Ignore changes likely caused by ourselves.
      hasJustToggledDropdown.current = false;
      return;
    }
    if (tabsRef.current === null) {
      // Some ResizeObserver calls come after unmount.
      return;
    }
    const tabsWidth = tabsRef.current.getBoundingClientRect().width;
    const needsDropdown = tabsWidth >= containerWidth;
    if (needsDropdown !== showDropdown) {
      hasJustToggledDropdown.current = true;
      setShowDropdown(needsDropdown);
    }
  });

  useEffect(() => {
    if (isMultiFile) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentBoxSize) {
            const contentBoxSize = Array.isArray(entry.contentBoxSize)
              ? entry.contentBoxSize[0]
              : entry.contentBoxSize;
            const width = contentBoxSize.inlineSize;
            onContainerResize(width);
          }
        }
      });
      const container = containerRef.current!;
      resizeObserver.observe(container);
      return () => resizeObserver.unobserve(container);
    } else {
      return;
    }

    // Note: in a real useEvent, onContainerResize would be omitted.
  }, [isMultiFile, onContainerResize]);

  const handleReset = () => {
    /**
     * resetAllFiles must come first, otherwise
     * the previous content will appear for a second
     * when the iframe loads.
     *
     * Plus, it should only prompt if there's any file changes
     */
    if (
      sandpack.editorState === 'dirty' &&
      confirm('Reset all your edits too?')
    ) {
      sandpack.resetAllFiles();
    }

    refresh();
  };

  return (
    <div className="bg-wash dark:bg-card-dark flex justify-between items-center relative z-10 border-b border-border dark:border-border-dark rounded-t-lg text-lg">
      <div className="flex-1 grow min-w-0 px-4 lg:px-6">
        <Listbox value={activeFile} onChange={setActiveFile}>
          <div ref={containerRef}>
            <div className="relative overflow-hidden">
              <div
                ref={tabsRef}
                className={cn(
                  // The container for all tabs is always in the DOM, but
                  // not always visible. This lets us measure how much space
                  // the tabs would take if displayed. We use this to decide
                  // whether to keep showing the dropdown, or show all tabs.
                  'w-[fit-content]',
                  showDropdown ? 'invisible' : ''
                )}>
                <FileTabs subgraphsByModule={subgraphsByModule} />
              </div>
              <Listbox.Button as={Fragment}>
                {({open}) => (
                  // If tabs don't fit, display the dropdown instead.
                  // The dropdown is absolutely positioned inside the
                  // space that's taken by the (invisible) tab list.
                  <button
                    className={cn(
                      'absolute top-0 start-[2px]',
                      !showDropdown && 'invisible'
                    )}>
                    <span
                      className={cn(
                        'h-full py-2 px-1 mt-px -mb-px flex border-b',
                        !showSubgraphs &&
                          'text-link dark:text-link-dark border-link dark:border-link-dark',
                        showDropdown &&
                          showSubgraphs && [
                            getSubgraphClassnamesForFile(activeFile, true),
                            'border-[var(--sp-rsc-active-color)]',
                          ],
                        'items-center text-md leading-tight truncate'
                      )}
                      style={{maxWidth: '160px'}}>
                      {getFileName(activeFile)}
                      {isMultiFile && (
                        <span className="ms-2">
                          <IconChevron
                            displayDirection={open ? 'up' : 'down'}
                          />
                        </span>
                      )}
                    </span>
                  </button>
                )}
              </Listbox.Button>
            </div>
          </div>
          {isMultiFile && showDropdown && (
            <Listbox.Options className="absolute mt-0.5 bg-card dark:bg-card-dark px-2 inset-x-0 mx-0 rounded-b-lg border-1 border-border dark:border-border-dark rounded-sm shadow-md">
              {visibleFiles.map((filePath: string) => (
                <Listbox.Option key={filePath} value={filePath} as={Fragment}>
                  {({active}) => (
                    <li
                      className={cn([
                        'text-md mx-2 my-4 cursor-pointer',
                        !showSubgraphs &&
                          active &&
                          'text-link dark:text-link-dark',
                        showDropdown &&
                          showSubgraphs &&
                          getSubgraphClassnamesForFile(filePath, active),
                      ])}>
                      {getFileName(filePath)}
                    </li>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          )}
        </Listbox>
      </div>
      <div
        className="px-3 flex items-center justify-end text-start"
        translate="yes">
        <DownloadButton providedFiles={providedFiles} />
        <ResetButton onReset={handleReset} />
        <OpenInCodeSandboxButton />
        {activeFile.endsWith('.tsx') && (
          <OpenInTypeScriptPlaygroundButton
            content={sandpack.files[activeFile]?.code || ''}
          />
        )}
      </div>
    </div>
  );
}

/** Mirror <FileTabs> from 'sandpack-react/unstyled' */
function FileTabs({
  subgraphsByModule,
}: {
  subgraphsByModule: ModuleSubgraphMap | undefined;
}) {
  // TODO: this should use something like Tab from headless-ui to be more accessible
  const {sandpack} = useSandpack();
  const {activeFile, setActiveFile, visibleFiles} = sandpack;
  return (
    <div className="sp-tabs" translate="no">
      <div className="sp-tabs-scrollable-container">
        {visibleFiles.map((filePath: string) => (
          <FileButton
            key={filePath}
            file={filePath}
            isActive={filePath === activeFile}
            onClick={() => setActiveFile(filePath)}
            subgraph={
              subgraphsByModule
                ? subgraphsByModule[filePath] ?? 'unknown'
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

/** Mirror the button rendered by <FileTabs> from 'sandpack-react/unstyled' */
function FileButton({
  file,
  isActive = false,
  subgraph,
  onClick,
}: {
  file: string;
  isActive?: boolean;
  subgraph?: SubgraphInfo | 'unknown';
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      data-active={isActive}
      className={cn(
        'sp-tab-button',
        subgraph && [getSubgraphClassnames(subgraph, true)]
      )}>
      {getFileName(file)}
    </button>
  );
}

const ENABLE_CLIENT_SERVER_BADGES = true;

const getSubgraphClassnames = (
  subgraphs: SubgraphInfo | 'unknown',
  active = true
) => {
  let variant: keyof typeof MODULE_SUBGRAPH_CLASSNAMES;
  if (!subgraphs) {
    variant = 'unknown';
  } else if (Array.isArray(subgraphs)) {
    if (subgraphs.includes('client') && subgraphs.includes('server')) {
      variant = 'shared';
    } else {
      variant = 'unknown';
    }
  } else {
    variant = subgraphs;
  }

  return MODULE_SUBGRAPH_CLASSNAMES[variant][active ? 'default' : 'muted'];
};

const BADGE_TEXT_COLOR = ['before:text-white', 'before:dark:text-black'];

const SERVER_CLIENT_BADGE_BASE = [
  'text-[var(--sp-rsc-active-color)]',
  '[--sp-colors-accent:var(--sp-rsc-active-color)]',
  'flex',
  'items-center',
  '!px-2',
  'before:mr-[0.5ch]',
  'before:opacity-[0.33]',
  'before:inline-block',
  'before:rounded-sm',
  'before:bg-[var(--sp-rsc-active-color)]',
  'before:font-bold',
  'before:text-sm',
  'before:leading-tight',
  'before:w-[calc(1ch+0.6em)]',
  'before:px-[0.3em]',
  'before:align-middle',
  'before:text-center',
];

const BADGES = ENABLE_CLIENT_SERVER_BADGES
  ? {
      server: [
        "before:content-['S']",
        ...BADGE_TEXT_COLOR,
        ...SERVER_CLIENT_BADGE_BASE,
      ],
      client: [
        "before:content-['C']",
        ...BADGE_TEXT_COLOR,
        ...SERVER_CLIENT_BADGE_BASE,
      ],
      shared: [
        "before:content-['U']",
        ...BADGE_TEXT_COLOR,
        ...SERVER_CLIENT_BADGE_BASE,
      ],
      unknown: [
        "before:content-['-']",
        '!before:text-transparent',
        '!before:dark:text-transparent',
        ...SERVER_CLIENT_BADGE_BASE,
      ],
    }
  : {
      server: [],
      client: [],
      shared: [],
      unknown: [],
    };

const MODULE_SUBGRAPH_CLASSNAMES = {
  server: {
    default: [
      '[--sp-rsc-active-color:var(--sp-rsc-color-server)]', // yellow
      ...BADGES.server,
    ],
    muted: [
      '[--sp-rsc-active-color:var(--sp-rsc-color-server-muted)]', // yellow
      ...BADGES.server,
    ],
  },
  client: {
    default: [
      '[--sp-rsc-active-color:var(--sp-rsc-color-client)]', // blue
      ...BADGES.client,
    ],
    muted: [
      '[--sp-rsc-active-color:var(--sp-rsc-color-client-muted)]', // blue
      ...BADGES.client,
    ],
  },
  shared: {
    default: [
      '[--sp-rsc-active-color:var(--sp-rsc-color-universal)]', // violet
      ...BADGES.shared,
    ],
    muted: [
      '[--sp-rsc-active-color:var(--sp-rsc-color-universal-muted)]', // violet
      ...BADGES.shared,
    ],
  },
  unknown: {
    default: [
      '[--sp-rsc-active-color:var(--sp-rsc-color-unknown)]', // grey
      ...BADGES.unknown,
    ],
    muted: [
      '[--sp-rsc-active-color:var(--sp-rsc-color-unknown-muted)]', // grey
      ...BADGES.unknown,
    ],
  },
};

type ModuleSubgraphMap = Record<string, SubgraphInfo | null>;

function useModuleSubgraphs(files: string[]) {
  const {listen, sandpack} = useSandpack();
  const {clients} = sandpack;
  const clientId = Object.keys(clients)[0];
  const hasFiles = files.length > 0;

  const [subgraphs, setSubgraphs] = useState(() =>
    sandpack.bundlerState && hasFiles
      ? getModuleSubgraphsFromState(sandpack.bundlerState, files)
      : undefined
  );
  useEffect(() => {
    if (!clientId || !hasFiles) return;
    return listen((message) => {
      if (message.type === 'state') {
        const subgraphs = getModuleSubgraphsFromState(message.state, files);
        setSubgraphs(subgraphs);
      }
    }, clientId);
  }, [clientId, listen, files, hasFiles]);
  return hasFiles ? subgraphs : undefined;
}

type SandpackBundlerState = NonNullable<SandpackState['bundlerState']>;
type SubgraphId = 'client' | 'server';
type SubgraphInfo = SubgraphId | SubgraphId[];
function getModuleSubgraphsFromState(
  state: SandpackBundlerState,
  files: string[]
): ModuleSubgraphMap | undefined {
  const {transpiledModules} = state;
  if (!transpiledModules) {
    return;
  }
  return Object.fromEntries(
    Object.values(transpiledModules)
      .filter(
        (info) =>
          info.source &&
          info.source.fileName &&
          files.includes(info.source.fileName)
      )
      .map((info) => info.source!)
      .map((info) => {
        const {
          fileName,
          // @ts-expect-error added in sandpack fork, not present on type definitions
          subgraphs = null,
        } = info;
        return [fileName, subgraphs as SubgraphInfo | null];
      })
  );
}

/** A janky useEffectEvent reimplementation */
function useEvent(fn: any): any {
  const ref = useRef(null);
  useInsertionEffect(() => {
    ref.current = fn;
  }, [fn]);
  return useCallback((...args: any) => {
    const f = ref.current!;
    // @ts-ignore
    return f(...args);
  }, []);
}
