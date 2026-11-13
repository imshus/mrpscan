/**
 * Pins the capture screen's optimistic capture and its early scan session
 * (utils/captureFlow.ts, utils/scanSessionSlot.ts):
 *
 *  - a side is held the moment the camera answers, and its cut to the frame
 *    lands behind it; the thumbnail (uri), the upload (onReady) and
 *    Calculate (whenReady) each wait for that cut;
 *  - the shutter is held until the camera answers, so one press is one photo;
 *  - a cut that fails drops the side for a retake, and Calculate stops;
 *  - nothing on its way for a discarded or replaced side lands;
 *  - the scan session is opened once per jewellery type and account, reused
 *    when the screen comes back, and let go after a discard only when a
 *    photo was already sent to it.
 *
 * Both modules have no imports, so node loads the app's own files directly
 * (type stripping, Node 22.18+ / 24) — no mirrored copy to drift.
 *
 * Run with:  node --test utils/__tests__/captureFlow.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createCaptureFlow } from '../captureFlow.ts';
import { createScanSessionSlot } from '../scanSessionSlot.ts';

/** A promise the test settles by hand: a cut to the frame still running. */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets every pending promise reaction run. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

function recordingFlow() {
  const ready = [];
  const failed = [];
  const flow = createCaptureFlow({
    onReady: (capture) => ready.push(capture),
    onFailed: (capture, error) => failed.push({ capture, error }),
  });
  return { flow, ready, failed };
}

/** One full shutter press: hold, camera answers with a cut still running, release. */
function press(flow, cut) {
  const ticket = flow.beginShutter();
  assert.ok(ticket, 'the shutter should be free');
  const capture = flow.confirm(ticket.side, 'camera', cut, ticket);
  flow.endShutter(ticket);
  return capture;
}

test('shutter: held from the press until the camera answers; a second tap is ignored', () => {
  const { flow } = recordingFlow();
  const ticket = flow.beginShutter();
  assert.deepEqual(ticket && ticket.side, 'front');
  assert.equal(flow.getState().shutterBusy, true);
  assert.equal(flow.beginShutter(), null, 'no double capture while the camera is answering');

  flow.endShutter(ticket);
  assert.equal(flow.getState().shutterBusy, false);
  const again = flow.beginShutter();
  assert.ok(again, 'free again once the camera answered');
  flow.endShutter(again);
});

test('front: held at once and the screen moves on; uri and upload wait for the cut', async () => {
  const { flow, ready } = recordingFlow();
  const cut = deferred();
  const seen = [];
  flow.subscribe((state) => seen.push(state));

  const front = press(flow, cut.promise);
  assert.ok(front);
  const held = flow.getState();
  assert.equal(held.step, 'second', 'the back is asked for before the cut lands');
  assert.equal(held.front.id, front.id);
  assert.equal(held.front.uri, null, 'no thumbnail before the cut');
  assert.equal(ready.length, 0, 'no upload before the cut');

  cut.resolve('file://front-framed.jpg');
  await flush();
  assert.equal(flow.getState().front.uri, 'file://front-framed.jpg');
  assert.equal(ready.length, 1);
  assert.equal(ready[0].side, 'front');
  assert.equal(ready[0].uri, 'file://front-framed.jpg');
  assert.ok(seen.length >= 3, 'listeners hear the hold, the release and the landed cut');
});

test('Calculate: waits for both cuts, then starts with the framed files', async () => {
  const { flow } = recordingFlow();
  const frontCut = deferred();
  const backCut = deferred();
  press(flow, frontCut.promise);
  press(flow, backCut.promise);
  assert.equal(flow.getState().back.side, 'back');

  let settled = null;
  const waiting = flow.whenReady().then((sides) => {
    settled = sides;
  });
  await flush();
  assert.equal(settled, null, 'nothing starts on a side still being cut');

  backCut.resolve('file://back-framed.jpg');
  await flush();
  assert.equal(settled, null);
  frontCut.resolve('file://front-framed.jpg');
  await waiting;
  assert.deepEqual(settled, {
    front: 'file://front-framed.jpg',
    back: 'file://back-framed.jpg',
    source: 'camera',
  });
});

test('Calculate: a press still waiting on the camera is waited for, and its side included', async () => {
  const { flow } = recordingFlow();
  press(flow, Promise.resolve('file://front.jpg'));

  const ticket = flow.beginShutter();
  const waiting = flow.whenReady();
  await flush();
  flow.confirm(ticket.side, 'camera', Promise.resolve('file://back.jpg'), ticket);
  flow.endShutter(ticket);

  assert.deepEqual(await waiting, {
    front: 'file://front.jpg',
    back: 'file://back.jpg',
    source: 'camera',
  });
});

test('failed cut, back: the back is dropped for a retake, the front kept, Calculate stops', async () => {
  const { flow, failed, ready } = recordingFlow();
  press(flow, Promise.resolve('file://front.jpg'));
  const backCut = deferred();
  press(flow, backCut.promise);

  const waiting = flow.whenReady();
  backCut.reject(new Error('crop failed'));
  assert.equal(await waiting, null);

  const state = flow.getState();
  assert.equal(state.back, null);
  assert.equal(state.front.uri, 'file://front.jpg');
  assert.equal(state.step, 'second', 'still asking for the back');
  assert.equal(failed.length, 1);
  assert.equal(failed[0].capture.side, 'back');
  assert.deepEqual(
    ready.map((capture) => capture.side),
    ['front'],
    'the failed side never uploads',
  );

  // Retaken: the scan carries on with the new back.
  press(flow, Promise.resolve('file://back-retake.jpg'));
  assert.deepEqual(await flow.whenReady(), {
    front: 'file://front.jpg',
    back: 'file://back-retake.jpg',
    source: 'camera',
  });
});

test('failed cut, front: the scan goes back to its start', async () => {
  const { flow, failed } = recordingFlow();
  const frontCut = deferred();
  press(flow, frontCut.promise);
  press(flow, deferred().promise);

  frontCut.reject(new Error('crop failed'));
  await flush();
  const state = flow.getState();
  assert.equal(state.step, 'first');
  assert.equal(state.front, null);
  assert.equal(state.back, null);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].capture.side, 'front');
  assert.equal(await flow.whenReady(), null, 'no front, nothing to calculate');
});

test('discard while the camera answers: the late photo is refused, its cut lands nowhere', async () => {
  const { flow, ready } = recordingFlow();
  press(flow, Promise.resolve('file://front.jpg'));
  await flush();

  const ticket = flow.beginShutter();
  flow.discard();
  const refused = flow.confirm(ticket.side, 'camera', Promise.resolve('file://late.jpg'), ticket);
  flow.endShutter(ticket);
  await flush();

  assert.equal(refused, null);
  const state = flow.getState();
  assert.equal(state.step, 'first');
  assert.equal(state.front, null);
  assert.equal(state.back, null);
  assert.equal(state.shutterBusy, false);
  assert.deepEqual(
    ready.map((capture) => capture.uri),
    ['file://front.jpg'],
  );
});

test('discard before the cut lands: no thumbnail, no upload for the dropped side', async () => {
  const { flow, ready, failed } = recordingFlow();
  const cut = deferred();
  const lateFail = deferred();
  press(flow, cut.promise);
  press(flow, lateFail.promise);
  flow.discard();

  cut.resolve('file://front.jpg');
  lateFail.reject(new Error('late'));
  await flush();
  assert.equal(flow.getState().front, null);
  assert.equal(ready.length, 0);
  assert.equal(failed.length, 0, 'a dropped side failing later tells nobody');
});

test('retaking the back: only the newest photo lands', async () => {
  const { flow, ready } = recordingFlow();
  press(flow, Promise.resolve('file://front.jpg'));
  const firstBack = deferred();
  const firstCapture = press(flow, firstBack.promise);
  const secondCapture = press(flow, Promise.resolve('file://back-2.jpg'));
  await flush();
  firstBack.resolve('file://back-1.jpg');
  await flush();

  assert.notEqual(firstCapture.id, secondCapture.id);
  assert.equal(flow.getState().back.uri, 'file://back-2.jpg');
  assert.deepEqual(
    ready.filter((capture) => capture.side === 'back').map((capture) => capture.uri),
    ['file://back-2.jpg'],
  );
});

test('gallery: a known file is ready at once; the finder swaps it while the side is held', async () => {
  const { flow, ready } = recordingFlow();
  const capture = flow.confirm('front', 'gallery', 'file://album.jpg');
  assert.equal(flow.getState().front.uri, 'file://album.jpg');
  await flush();
  assert.deepEqual(
    ready.map((c) => c.uri),
    ['file://album.jpg'],
  );

  const swapped = flow.swap(capture, 'file://album-tag.jpg');
  assert.ok(swapped);
  assert.notEqual(swapped.id, capture.id);
  assert.equal(flow.getState().front.uri, 'file://album-tag.jpg');
  assert.deepEqual(
    ready.map((c) => c.uri),
    ['file://album.jpg', 'file://album-tag.jpg'],
  );
  assert.equal(flow.swap(capture, 'file://stale.jpg'), null, 'a replaced capture cannot swap');

  flow.discard();
  assert.equal(flow.swap(swapped, 'file://after-discard.jpg'), null);
  assert.deepEqual(await flow.whenReady(), null);
});

test('a back with no front is refused', () => {
  const { flow } = recordingFlow();
  assert.equal(flow.confirm('back', 'camera', Promise.resolve('file://back.jpg')), null);
  assert.equal(flow.getState().back, null);
});

test('session: opened once, reused when the screen comes back', async () => {
  const opened = [];
  const slot = createScanSessionSlot((type) => {
    opened.push(type);
    return Promise.resolve({ scanId: `scan-${opened.length}` });
  });

  const first = slot.ensure('Diamond', 0);
  const again = slot.ensure('Diamond', 0);
  assert.equal(first, again);
  assert.deepEqual(opened, ['Diamond'], 'no duplicate session on re-focus');
  assert.equal(slot.releaseIfUsed(), false, 'an untouched session is kept');
  assert.equal(slot.ensure('Diamond', 0), first);
  assert.deepEqual(opened, ['Diamond']);
  assert.deepEqual(await first, { scanId: 'scan-1' });
});

test('session: another jewellery type or another account opens its own', () => {
  const opened = [];
  const slot = createScanSessionSlot((type) => {
    opened.push(type);
    return Promise.resolve({ scanId: `scan-${opened.length}` });
  });
  slot.ensure('Diamond', 0);
  slot.ensure('Gold', 0);
  assert.equal(slot.holds('Diamond', 0), false);
  slot.ensure('Gold', 1);
  assert.equal(slot.holds('Gold', 0), false, "the previous account's session is not reused");
  assert.equal(slot.holds('Gold', 1), true);
  assert.deepEqual(opened, ['Diamond', 'Gold', 'Gold']);
});

test('session: one a photo was sent to is let go after a discard; a fresh one opens', async () => {
  let count = 0;
  const slot = createScanSessionSlot(() => Promise.resolve({ scanId: `scan-${++count}` }));
  const first = slot.ensure('Diamond', 0);
  assert.equal(slot.claimForUpload('Diamond', 0, 'front'), first, 'uploads go to the open session');
  assert.equal(slot.releaseIfUsed(), true);
  assert.equal(slot.holds('Diamond', 0), false);

  const fresh = slot.ensure('Diamond', 0);
  assert.notEqual(fresh, first);
  assert.deepEqual(await fresh, { scanId: 'scan-2' });
});

test('session: a failed cut lets the session go only when that side was already sent', () => {
  let count = 0;
  const slot = createScanSessionSlot(() => Promise.resolve({ scanId: `scan-${++count}` }));
  slot.claimForUpload('Diamond', 0, 'front');
  assert.equal(slot.releaseIfUsed('back'), false, 'a first back failing leaves the front session alone');
  assert.equal(slot.holds('Diamond', 0), true);

  slot.claimForUpload('Diamond', 0, 'back');
  assert.equal(
    slot.releaseIfUsed('back'),
    true,
    'a retaken back failing: the earlier back still sits in the session',
  );
  assert.equal(slot.holds('Diamond', 0), false);
  assert.equal(slot.releaseIfUsed(), false, 'nothing held, nothing to let go');
});

test('session: taken by the scan, the slot is empty; a failed open is retried', async () => {
  let count = 0;
  const slot = createScanSessionSlot(() => {
    count += 1;
    return count === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ scanId: 'ok' });
  });

  const failing = slot.ensure('Diamond', 0);
  await assert.rejects(failing);
  await flush();
  assert.equal(slot.holds('Diamond', 0), false, 'a failed open is forgotten');

  const retried = slot.ensure('Diamond', 0);
  assert.deepEqual(await retried, { scanId: 'ok' });
  slot.release(failing);
  assert.equal(slot.holds('Diamond', 0), true, 'releasing another promise changes nothing');
  slot.release(retried);
  assert.equal(slot.holds('Diamond', 0), false);
  assert.equal(count, 2);
});
