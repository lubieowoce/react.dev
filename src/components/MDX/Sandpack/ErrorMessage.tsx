/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 */

interface ErrorType {
  title?: string;
  message: string;
  column?: number;
  line?: number;
  path?: string;
}

export function ErrorMessage({error, ...props}: {error: ErrorType}) {
  const {message, title} = error;
  console.error('Sandpack error', error);

  return (
    <div className="bg-white border-2 border-red-40 rounded-lg p-6" {...props}>
      <h2 className="text-red-40 text-xl mb-4">{title || 'Error'}</h2>
      <pre className="text-secondary whitespace-pre-wrap break-words leading-tight">
        {message}
      </pre>
      {error.path && (
        <pre className="text-secondary whitespace-pre-wrap break-words leading-tight">
          {error.path}
          {error.line !== undefined && <>:{error.line}</>}
          {error.column !== undefined && <>:{error.column}</>}
        </pre>
      )}
    </div>
  );
}
