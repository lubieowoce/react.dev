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
  FileTabs,
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

export function useEvent(fn: any): any {
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

  const subgraphs = useModuleSubgraphs(
    showSubgraphs ? providedFiles : NO_FILES
  );

  const [tabsElement, setTabsElement] = useState<HTMLDivElement | null>(null);

  const onTabs = useCallback(
    (tabs: HTMLDivElement | null) => {
      // This is a horribly nasty hack to change the styling of tab buttons
      // depending on if the module is server or client.
      if (!showSubgraphs) return;
      if (!tabs) return;

      const buttons = tabs.querySelectorAll('button');
      if (!buttons.length) return;

      const cleanups: (() => void)[] = [];
      buttons.forEach((button) => {
        const filePath = button.title;
        if (!filePath) return;
        const primarySubgraph = subgraphs?.[filePath] ?? 'unknown';
        // if (!primarySubgraph) return;

        const classNames = MODULE_SUBGRAPH_CLASSNAMES[primarySubgraph];
        button.classList.add(...classNames);
        cleanups.push(() => button.classList.remove(...classNames));
      });
      return () =>
        cleanups.forEach((cleanup) => {
          try {
            cleanup();
          } catch (_err) {}
        });
    },
    [showSubgraphs, subgraphs]
  );

  useEffect(() => {
    return onTabs(tabsElement);
  }, [onTabs, tabsElement]);

  const combinedTabsRef = useCallback((tabs: HTMLDivElement | null) => {
    tabsRef.current = tabs;
    setTabsElement(tabs); // this feels gross...
  }, []);

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
                ref={combinedTabsRef}
                className={cn(
                  // The container for all tabs is always in the DOM, but
                  // not always visible. This lets us measure how much space
                  // the tabs would take if displayed. We use this to decide
                  // whether to keep showing the dropdown, or show all tabs.
                  'w-[fit-content]',
                  showDropdown ? 'invisible' : ''
                )}>
                <FileTabs />
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
                        'h-full py-2 px-1 mt-px -mb-px flex border-b text-link dark:text-link-dark border-link dark:border-link-dark items-center text-md leading-tight truncate'
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
                      className={cn(
                        'text-md mx-2 my-4 cursor-pointer',
                        active && 'text-link dark:text-link-dark'
                      )}>
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

const ENABLE_CLIENT_SERVER_BADGES = true;

const SERVER_CLIENT_BADGE_BASE = [
  'flex',
  'items-center',
  '!px-[0.5em]',
  'gap-[0.5ch]',
  'before:opacity-[0.33]',
  'before:inline-block',
  'before:rounded-sm',
  'before:bg-[var(--sp-colors-accent)]',
  'before:font-bold',
  // 'before:font-mono',
  // 'before:text-black',
  'before:text-black',
  'before:text-sm',
  'before:leading-tight',
  'before:w-[calc(1ch+0.6em)]',
  'before:px-[0.3em]',
  'before:align-middle',
  'before:text-center',
];

const MODULE_SUBGRAPH_CLASSNAMES = {
  server: [
    '[--sp-colors-accent:var(--sp-syntax-color-tag)]', // yellow
    ...(ENABLE_CLIENT_SERVER_BADGES
      ? ["before:content-['S']", ...SERVER_CLIENT_BADGE_BASE]
      : []),
  ],
  client: [
    // '!text-[var(--sp-colors-accent)]' // just use the default color, which happens to be blue.
    ...(ENABLE_CLIENT_SERVER_BADGES
      ? ["before:content-['C']", ...SERVER_CLIENT_BADGE_BASE]
      : []),
  ],
  unknown: [
    '[--sp-colors-accent:var(--sp-colors-clickable)]', // grey
    ...(ENABLE_CLIENT_SERVER_BADGES
      ? ["before:content-['?']", ...SERVER_CLIENT_BADGE_BASE]
      : []),
  ],
};

type ModuleSubgraphMap = Record<string, 'client' | 'server' | null>;

function useModuleSubgraphs(files: string[]) {
  const {listen, sandpack} = useSandpack();
  const {clients} = sandpack;
  const clientId = Object.keys(clients)[0];

  const [subgraphs, setSubgraphs] = useState(() =>
    sandpack.bundlerState
      ? getModuleSubgraphsFromState(sandpack.bundlerState, files)
      : undefined
  );
  useEffect(() => {
    if (!clientId) return;
    return listen((message) => {
      if (message.type === 'state') {
        const subgraphs = getModuleSubgraphsFromState(message.state, files);
        setSubgraphs(subgraphs);
      }
    }, clientId);
  }, [clientId, listen, files]);
  return subgraphs;
}

type SandpackBundlerState = NonNullable<SandpackState['bundlerState']>;

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
          primarySubgraph = null,
        } = info;
        return [fileName, primarySubgraph as 'client' | 'server' | null];
      })
  );
}
