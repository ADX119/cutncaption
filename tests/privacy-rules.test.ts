import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, privacyViolation } from './e2e/support/privacy-rules';

const SITE = 'https://cutncaption.example';
const req = (url: string, method = 'GET', bodyBytes: number | null = 0) => ({
  url,
  method,
  bodyBytes,
});

describe('privacyViolation', () => {
  it.each([
    req(`${SITE}/tools/trim-video/`),
    req(`${SITE}/assets/ffmpeg/0.12.10/mt/ffmpeg-core.wasm`),
    req(`blob:${SITE}/d63dab90-d089-478b-b721-b075b14e3ef9`),
    req('data:image/png;base64,AAAA'),
    req('https://static.cloudflareinsights.com/beacon.min.js'),
    req('https://cloudflareinsights.com/cdn-cgi/rum', 'POST', 836),
  ])('allows $method $url', (request) => {
    expect(privacyViolation(request, SITE)).toBeNull();
  });

  it('flags a body over the limit, even to our own site', () => {
    const violation = privacyViolation(req(`${SITE}/api/e`, 'POST', MAX_BODY_BYTES + 1), SITE);
    expect(violation).toContain('sends 2049 bytes');
  });

  it('flags a sending request whose body the browser hides', () => {
    expect(privacyViolation(req(`${SITE}/api/x`, 'POST', null), SITE)).toContain('does not reveal');
    expect(privacyViolation(req(`${SITE}/api/x`, 'PUT', null), SITE)).not.toBeNull();
  });

  it('accepts an analytics report whose size the browser hides', () => {
    expect(
      privacyViolation(req('https://cloudflareinsights.com/cdn-cgi/rum', 'POST', null), SITE),
    ).toBeNull();
  });

  it('flags an oversized analytics report', () => {
    expect(
      privacyViolation(req('https://cloudflareinsights.com/cdn-cgi/rum', 'POST', 50_000), SITE),
    ).not.toBeNull();
  });

  it.each([
    req('https://example.com/upload', 'POST', 10),
    req('https://www.youtube.com/watch?v=x'),
    req('https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js'),
    req('https://huggingface.co/onnx-community/whisper-base/resolve/main/config.json'),
    req('https://cloudflareinsights.com/other-path', 'POST', 10),
    req('https://static.cloudflareinsights.com/beacon.min.js', 'POST', 10),
  ])('flags $method $url', (request) => {
    expect(privacyViolation(request, SITE)).toContain('not allowed');
  });

  it('treats a lookalike host as a different site', () => {
    expect(privacyViolation(req('https://cutncaption.example.evil.test/'), SITE)).not.toBeNull();
  });
});
