const currentUserAgent = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);

export function isWindowsDevice(userAgent = currentUserAgent()) {
  return userAgent.includes('Windows');
}

export function multisampleDepthStencilResolveOptions(userAgent = currentUserAgent()) {
  const resolve = !isWindowsDevice(userAgent);
  return {
    resolveDepthBuffer: resolve,
    resolveStencilBuffer: resolve,
  };
}
