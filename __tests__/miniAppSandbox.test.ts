import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSandboxedMiniAppHtml,
  isAllowedMiniAppNavigation,
  parseMiniAppMessage,
} from '../components/miniAppSandbox.ts';

test('wraps HTML with a deny-by-default CSP and the bounded Canopy bridge', () => {
  const html = buildSandboxedMiniAppHtml('<button>Quiz</button>');
  assert.match(html, /default-src 'none'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /form-action 'none'/);
  assert.match(html, /window\.ReactNativeWebView\.postMessage/);
  assert.match(html, /<button>Quiz<\/button>/);
});

test('accepts only structured, bounded mini-app actions', () => {
  assert.deepEqual(
    parseMiniAppMessage(JSON.stringify({
      type: 'canopy_action',
      action: 'quiz.answer',
      data: { answer: 'B' },
    })),
    { action: 'quiz.answer', data: { answer: 'B' } },
  );
  assert.equal(parseMiniAppMessage('{"type":"other"}'), null);
  assert.equal(parseMiniAppMessage(JSON.stringify({
    type: 'canopy_action',
    action: 'bad action with spaces',
  })), null);
});

test('blocks external navigation from sandboxed apps', () => {
  assert.equal(isAllowedMiniAppNavigation('about:blank'), true);
  assert.equal(isAllowedMiniAppNavigation('about:blank#screen-2'), true);
  assert.equal(isAllowedMiniAppNavigation('https://example.com'), false);
  assert.equal(isAllowedMiniAppNavigation('file:///etc/passwd'), false);
});
