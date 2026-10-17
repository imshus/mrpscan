/**
 * The camera's cut from the red frame down to the paper tag itself, at the
 * owner's asking: the framed photo still carried the fingers and whatever the
 * tag lay on around the small white tag with the figures (DIA WT, GR. WT,
 * NET WT, ...). components/scanner/TagCameraPreview.tsx shows this a small
 * copy of each framed side, 160px wide (the work size below, so the 2x2
 * average of step 1 is already done by the phone's scaler), and cuts the
 * full-size frame to the box it gives (paperCropRect). On the phone, no model
 * and no network; the gallery path keeps the server's finder (utils/tagCrop.ts).
 *
 * Plain logic with no imports, so node loads this very file in a test
 * (utils/__tests__/paperCrop.test.mjs). findPaperBox below is the detector
 * exactly as it was benchmarked (92 synthetic and real frames, no figure ever
 * cut, no false crop); change it only together with that benchmark.
 *
 * findPaperBox: find the white paper tag that carries the printed data (GR. WT, NET WT, ...) in a
 * small RGBA photo and return the box to crop to, as fractions of the image, or null = do not crop.
 *
 * Classical image processing only (no model, no network), sized for a ~320x200 input on a phone.
 * Pure and dependency-free: typed arrays, no allocation inside the pixel loops.
 *
 * How it works (all on a half-size "work" image, ~160x100):
 *   1. Luma + colour saturation per work pixel.
 *   2. Morphological closing (max then min over 5x5) = the paper as if the print were not there.
 *      Its gradient is the edge map used to find the paper boundary.
 *   3. Ink = pixels clearly darker than the closed image (thin dark strokes). Ink pixels are grouped
 *      into blobs; character-like blobs (letter sized, not lines/specks) are the text evidence.
 *   4. Seed = the patch with the most character ink on the brightest ground; it gives the text
 *      height, the paper brightness and the paper colour.
 *   5. Text block = character cells linked to the seed (gaps up to ~5 character heights). If it does
 *      not look like several lines of dark print, refuse.
 *   6. Paper = flood from the seed text over the edge map, recording the region for a ladder of edge
 *      thresholds (one pass, bucket queue). The paper is the most permissive threshold whose region
 *      is bounded (<= 2 frame sides), not most of the frame, and holds the text; then step down while
 *      a stricter threshold still works and is clearly smaller (that extra area was a leak).
 *   7. Crop = paper box + the kept text with a margin, plus any text that continues outside the
 *      region (a hard shadow edge or a finger can stop the flood part-way across the tag).
 *   8. Refuse when unsure: grouped print-like characters left outside the crop (another text block),
 *      or no bounded paper and the tag seems to fill the frame. Without a bounded paper but on a
 *      same-coloured background (white wall) the crop is the text block plus a margin.
 * Losing printed text is far worse than not cropping, so every doubtful branch either widens the
 * crop or returns null.
 */
export type Box = { x0: number; y0: number; x1: number; y1: number };

// Edge-strength thresholds tried for the paper flood, most permissive first.
const EDGE_STEPS = [40, 30, 22, 16, 11, 8, 6, 4, 3];
const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

export function findPaperBox(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Box | null {
  // work image ~16k pixels (2x2 average for a 320x200 input)
  const f = Math.max(1, Math.round(Math.sqrt((width * height) / 16000)));
  const W = Math.floor(width / f), H = Math.floor(height / f), n = W * H;
  if (W < 40 || H < 30 || rgba.length < width * height * 4) return null;

  // ---- 1. luma (L) and saturation (S, max-min of RGB) at work resolution
  const L = new Uint8Array(n), S = new Uint8Array(n);
  if (f === 2 && LITTLE_ENDIAN && rgba.byteOffset % 4 === 0) {
    // fast path: read each RGBA pixel as one 32-bit word (0xAABBGGRR) and sum red+blue and green
    // of the 2x2 block in separate 16-bit lanes
    const u = new Uint32Array(rgba.buffer, rgba.byteOffset, width * height);
    for (let y = 0; y < H; y++) {
      let p = 2 * y * width, q = p + width, o = y * W;
      for (let x = 0; x < W; x++, p += 2, q += 2, o++) {
        const a = u[p], b = u[p + 1], c = u[q], d = u[q + 1];
        const rb = (a & 0xff00ff) + (b & 0xff00ff) + (c & 0xff00ff) + (d & 0xff00ff);
        const g = ((a & 0xff00) + (b & 0xff00) + (c & 0xff00) + (d & 0xff00)) >> 8;
        const r = rb & 0xffff, bl = rb >>> 16;
        L[o] = (r * 77 + g * 150 + bl * 29 + 512) >> 10;
        let mx = r > g ? r : g; if (bl > mx) mx = bl;
        let mn = r < g ? r : g; if (bl < mn) mn = bl;
        S[o] = (mx - mn + 2) >> 2;
      }
    }
  } else {
    const ff = f * f, sr = new Int32Array(W), sg = new Int32Array(W), sb = new Int32Array(W);
    for (let y = 0; y < H; y++) {
      sr.fill(0); sg.fill(0); sb.fill(0);
      for (let dy = 0; dy < f; dy++) {
        let p = (y * f + dy) * width * 4;
        for (let x = 0; x < W; x++) {
          for (let dx = 0; dx < f; dx++, p += 4) { sr[x] += rgba[p]; sg[x] += rgba[p + 1]; sb[x] += rgba[p + 2]; }
        }
      }
      for (let x = 0, o = y * W; x < W; x++, o++) {
        const r = sr[x], g = sg[x], b = sb[x];
        L[o] = ((r * 77 + g * 150 + b * 29) / ff + 128) >> 8;
        let mx = r > g ? r : g; if (b > mx) mx = b;
        let mn = r < g ? r : g; if (b < mn) mn = b;
        S[o] = ((mx - mn) / ff + 0.5) | 0;
      }
    }
  }

  // ---- 2. closing C (strokes up to 4 work px wide vanish, edges of big shapes stay put) and the
  // gradient G of C: inside the paper G is ~0 even under the print; the paper outline is a ridge
  const C = new Uint8Array(n), T = new Uint8Array(n);
  for (let y = 0; y < H; y++) max5(L, T, y * W, 1, W);
  for (let x = 0; x < W; x++) max5(T, C, x, W, H);
  for (let y = 0; y < H; y++) min5(C, T, y * W, 1, W);
  for (let x = 0; x < W; x++) min5(T, C, x, W, H);
  const G = new Uint8Array(n);
  for (let y = 1; y < H - 1; y++) {
    let i = y * W + 1;
    for (let x = 1; x < W - 1; x++, i++) {
      let gx = C[i + 1] - C[i - 1], gy = C[i + W] - C[i - W];
      if (gx < 0) gx = -gx; if (gy < 0) gy = -gy;
      G[i] = gx > gy ? gx : gy;
    }
  }
  for (let x = 0; x < W; x++) { G[x] = G[W + x]; G[(H - 1) * W + x] = G[(H - 2) * W + x]; }
  for (let y = 0; y < H; y++) { G[y * W] = G[y * W + 1]; G[y * W + W - 1] = G[y * W + W - 2]; }

  // ---- 3. ink and ink blobs
  // Cells of 4x4 work pixels index everything coarse; cellC = brightest closed value in the cell.
  const CW = (W + 3) >> 2, CH = (H + 3) >> 2, cn = CW * CH;
  const cellC = new Uint8Array(cn);
  const ink = new Uint8Array(n);
  let nInk = 0;
  for (let y = 0; y < H; y++) {
    const row = (y >> 2) * CW, edgeRow = y === 0 || y === H - 1;
    for (let x = 0, i = y * W; x < W; x++, i++) {
      const c = C[i], ci = row + (x >> 2);
      if (c > cellC[ci]) cellC[ci] = c;
      const d = c - L[i];
      // dark relative to the local paper (>= 12 levels and >= 10%); the frame border stays ink-free
      // so blob tracing below needs no bounds checks
      if (c >= 50 && d >= 12 && d * 10 >= c && !edgeRow && x > 0 && x < W - 1) { ink[i] = 1; nInk++; }
    }
  }
  if (nInk < 20) return null;
  const lab = new Int32Array(n);   // blob id + 1 per ink pixel
  const px = new Int32Array(nInk); // ink pixels, grouped by blob: blob k owns px[bStart[k] .. bEnd[k])
  const nbMax = nInk + 1;
  const bStart = new Int32Array(nbMax), bEnd = new Int32Array(nbMax);
  const bx0 = new Int16Array(nbMax), by0 = new Int16Array(nbMax), bx1 = new Int16Array(nbMax), by1 = new Int16Array(nbMax);
  const bPeak = new Uint8Array(nbMax); // darkest point, as levels below the local paper
  const bC = new Uint8Array(nbMax);    // mean local paper level behind the blob
  // 0 = line / clutter, 1 = small mark, 2 = character-like, 3 = character of the text's size
  const bKind = new Uint8Array(nbMax);
  let nb = 0, top = 0;
  const maxH = Math.max(8, (H / 4) | 0);
  for (let s = W; s < n - W; s++) {
    if (!ink[s] || lab[s]) continue;
    const id = nb++, tag = id + 1;
    let qh = top, peak = 0, sc = 0;
    bStart[id] = top;
    px[top++] = s; lab[s] = tag;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    while (qh < top) {
      const i = px[qh++], y = (i / W) | 0, x = i - y * W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const c = C[i], d = c - L[i];
      if (d > peak) peak = d;
      sc += c;
      let j = i - W - 1;
      if (ink[j] && !lab[j]) { lab[j] = tag; px[top++] = j; }
      j++; if (ink[j] && !lab[j]) { lab[j] = tag; px[top++] = j; }
      j++; if (ink[j] && !lab[j]) { lab[j] = tag; px[top++] = j; }
      j = i - 1; if (ink[j] && !lab[j]) { lab[j] = tag; px[top++] = j; }
      j = i + 1; if (ink[j] && !lab[j]) { lab[j] = tag; px[top++] = j; }
      j = i + W - 1; if (ink[j] && !lab[j]) { lab[j] = tag; px[top++] = j; }
      j++; if (ink[j] && !lab[j]) { lab[j] = tag; px[top++] = j; }
      j++; if (ink[j] && !lab[j]) { lab[j] = tag; px[top++] = j; }
    }
    bEnd[id] = top;
    const cnt = top - bStart[id];
    bx0[id] = x0; by0[id] = y0; bx1[id] = x1; by1[id] = y1; bPeak[id] = peak; bC[id] = sc / cnt;
    // character-like: at least 3 px tall, not huge, not a long thin line, reasonably filled
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (bh >= 3 && bh <= maxH && bw <= 8 * bh && cnt >= 4 && cnt * 8 >= bw * bh) bKind[id] = 2;
  }
  const cellOf = (id: number) => ((by0[id] + by1[id]) >> 3) * CW + ((bx0[id] + bx1[id]) >> 3);

  // ---- 4. seed: the 3x3-cell window with the most character ink, weighted towards bright ground
  // (the tag is the whitest thing with print on it)
  const cellMass = new Float32Array(cn);
  for (let id = 0; id < nb; id++) {
    if (bKind[id] !== 2) continue;
    for (let t = bStart[id]; t < bEnd[id]; t++) {
      const i = px[t], y = (i / W) | 0;
      cellMass[(y >> 2) * CW + ((i - y * W) >> 2)] += C[i] - L[i];
    }
  }
  let best = -1, bestScore = 0;
  for (let cy = 0; cy < CH; cy++) {
    for (let cx = 0; cx < CW; cx++) {
      let sum = 0;
      for (let yy = cy > 0 ? cy - 1 : 0; yy <= cy + 1 && yy < CH; yy++) {
        for (let xx = cx > 0 ? cx - 1 : 0; xx <= cx + 1 && xx < CW; xx++) sum += cellMass[yy * CW + xx];
      }
      const b = cellC[cy * CW + cx] / 255;
      if (sum * b * b > bestScore) { bestScore = sum * b * b; best = cy * CW + cx; }
    }
  }
  if (best < 0) return null;
  const scx = best % CW, scy = (best / CW) | 0;
  const wx0 = Math.max(0, (scx - 1) * 4), wy0 = Math.max(0, (scy - 1) * 4);
  const wx1 = Math.min(W, (scx + 2) * 4), wy1 = Math.min(H, (scy + 2) * 4);
  // text height (median blob height), paper level Pc (closed value under the print) and paper
  // saturation Ps (non-ink pixels) from the seed window
  const hs: number[] = [];
  let Pc = 0, pn = 0;
  for (let id = 0; id < nb; id++) {
    if (bKind[id] !== 2 || bx1[id] < wx0 || bx0[id] >= wx1 || by1[id] < wy0 || by0[id] >= wy1) continue;
    hs.push(by1[id] - by0[id] + 1);
    for (let t = bStart[id]; t < bEnd[id]; t++) { Pc += C[px[t]]; pn++; }
  }
  let Ps = 0, sn = 0;
  for (let y = wy0; y < wy1; y++) for (let x = wx0; x < wx1; x++) { const i = y * W + x; if (!ink[i]) { Ps += S[i]; sn++; } }
  Pc = pn ? Pc / pn : cellC[best];
  Ps = sn ? Ps / sn : 0;
  hs.sort((a, b) => a - b);
  const hc = hs.length ? hs[hs.length >> 1] : 5;
  const h25 = hs.length ? hs[hs.length >> 2] : 4;
  // characters of the text's size (generous range: tilted words make taller boxes)
  const hLo = Math.max(3, h25 * 0.6), hHi = hc * 2.5;
  const cellCons = new Uint16Array(cn), cellChars = new Uint8Array(cn);
  for (let id = 0; id < nb; id++) {
    const bh = by1[id] - by0[id] + 1, bw = bx1[id] - bx0[id] + 1;
    if (bKind[id] === 2 && bh >= hLo && bh <= hHi) {
      bKind[id] = 3;
      for (let t = bStart[id]; t < bEnd[id]; t++) {
        const i = px[t], y = (i / W) | 0;
        cellCons[(y >> 2) * CW + ((i - y * W) >> 2)]++;
      }
      const c = cellOf(id);
      cellCons[c]++;
      cellChars[c]++;
    } else if (bKind[id] === 0 && bh <= hHi && bw <= 6 * hc) bKind[id] = 1;
  }

  // ---- 5. text block: character cells linked to the seed, gaps up to ~5 character heights
  const LINK = Math.max(3, Math.ceil((5 * hc) / 4)); // in cells
  const cq = new Int32Array(cn), cTmp = new Uint8Array(cn), cDil = new Uint8Array(cn), cVis = new Uint8Array(cn);
  const block = new Uint8Array(cn);
  for (let c = 0; c < cn; c++) if (cellCons[c] && cellC[c] >= Pc * 0.5) block[c] = 1;
  for (let cy = Math.max(0, scy - 1); cy <= Math.min(CH - 1, scy + 1); cy++) {
    for (let cx = Math.max(0, scx - 1); cx <= Math.min(CW - 1, scx + 1); cx++) if (block[cy * CW + cx]) block[cy * CW + cx] = 2;
  }
  linkCells(block, CW, CH, LINK, LINK, cTmp, cDil, cVis, cq);
  let nChar = 0;
  for (let c = 0; c < cn; c++) if (block[c] === 3) nChar += cellChars[c];
  let tx0 = W, ty0 = H, tx1 = -1, ty1 = -1, hiCon = 0, allCon = 0, nBC = 0;
  const blockChars = new Int32Array(nb); // block characters on paper-bright ground
  for (let id = 0; id < nb; id++) {
    if (!bKind[id] || block[cellOf(id)] !== 3) continue;
    if (bx0[id] < tx0) tx0 = bx0[id]; if (by0[id] < ty0) ty0 = by0[id];
    if (bx1[id] > tx1) tx1 = bx1[id]; if (by1[id] > ty1) ty1 = by1[id];
    if (bKind[id] !== 3) continue;
    for (let t = bStart[id]; t < bEnd[id]; t++) { const i = px[t]; allCon++; if (C[i] - L[i] >= 40) hiCon++; }
    if (bC[id] >= Pc * 0.85) blockChars[nBC++] = id;
  }
  // print = at least 6 characters over more than one line (2 text heights; tilted words inflate the
  // median height, so the lower quartile caps it) on reasonably bright paper, with a fair share of
  // truly dark ink (wood grain, scratches and stains are faint)
  if (nChar < 6 || ty1 - ty0 + 1 < 2 * Math.min(hc, 1.5 * h25) || Pc < 110 || hiCon < allCon * 0.15) return null;

  // ---- 6. paper region: bottleneck flood from the seed text over G.
  // A pixel's level = the strongest edge that must be crossed to reach it from the seed, so
  // region(t) = pixels with level < t, for every t at once. Pixels much darker than the paper or of
  // another colour (skin, wood, a cream tag's wall) are walls.
  const cMin = Pc * 0.5, sTol = Math.max(14, Ps * 0.6);
  const maxLv = EDGE_STEPS[0], nT = EDGE_STEPS.length;
  const cost = T; // reuse
  for (let i = 0; i < n; i++) {
    const ds = S[i] - Ps;
    cost[i] = C[i] >= cMin && (ink[i] === 1 || (ds <= sTol && ds >= -sTol)) ? G[i] : 255;
  }
  const head = new Int32Array(256).fill(-1), next = new Int32Array(n), lvl = new Uint8Array(n);
  for (let y = wy0; y < wy1; y++) {
    for (let x = wx0; x < wx1; x++) {
      const i = y * W + x;
      if (ink[i] && bKind[lab[i] - 1] === 3 && !lvl[i]) { const c = G[i]; next[i] = head[c]; head[c] = i; lvl[i] = 255; }
    }
  }
  const snap = new Int32Array(nT * 4); // region box per threshold
  let rx0 = W, ry0 = H, rx1 = -1, ry1 = -1, ti = nT - 1;
  for (let lv = 0; lv < maxLv; lv++) {
    while (ti >= 0 && EDGE_STEPS[ti] === lv) { const o = ti-- * 4; snap[o] = rx0; snap[o + 1] = ry0; snap[o + 2] = rx1; snap[o + 3] = ry1; }
    let i = head[lv];
    while (i >= 0) {
      head[lv] = next[i];
      lvl[i] = lv + 1;
      const y = (i / W) | 0, x = i - y * W;
      if (x < rx0) rx0 = x; if (x > rx1) rx1 = x; if (y < ry0) ry0 = y; if (y > ry1) ry1 = y;
      // the region may reach the frame edge but never travels along it
      if (x > 0 && y > 0 && x < W - 1 && y < H - 1) {
        let j = i - 1, c: number;
        if (!lvl[j]) { c = cost[j]; if (c < maxLv) { if (c < lv) c = lv; next[j] = head[c]; head[c] = j; lvl[j] = 255; } }
        j = i + 1;
        if (!lvl[j]) { c = cost[j]; if (c < maxLv) { if (c < lv) c = lv; next[j] = head[c]; head[c] = j; lvl[j] = 255; } }
        j = i - W;
        if (!lvl[j]) { c = cost[j]; if (c < maxLv) { if (c < lv) c = lv; next[j] = head[c]; head[c] = j; lvl[j] = 255; } }
        j = i + W;
        if (!lvl[j]) { c = cost[j]; if (c < maxLv) { if (c < lv) c = lv; next[j] = head[c]; head[c] = j; lvl[j] = 255; } }
      }
      i = head[lv];
    }
  }
  while (ti >= 0) { const o = ti-- * 4; snap[o] = rx0; snap[o + 1] = ry0; snap[o + 2] = rx1; snap[o + 3] = ry1; }
  // a threshold's region is acceptable when bounded (touches at most two frame sides), not most of
  // the frame, and its box holds >= 90% of the block's characters that sit on bright paper
  const valid = new Uint8Array(nT), areaK = new Float64Array(nT);
  for (let k = 0; k < nT; k++) {
    const o = k * 4, x0 = snap[o], y0 = snap[o + 1], x1 = snap[o + 2], y1 = snap[o + 3];
    if (x1 < 0) continue;
    const sides = (x0 <= 0 ? 1 : 0) + (y0 <= 0 ? 1 : 0) + (x1 >= W - 1 ? 1 : 0) + (y1 >= H - 1 ? 1 : 0);
    areaK[k] = ((x1 - x0 + 1) * (y1 - y0 + 1)) / n;
    let inside = 0;
    for (let t = 0; t < nBC; t++) {
      const id = blockChars[t], cx = (bx0[id] + bx1[id]) >> 1, cy = (by0[id] + by1[id]) >> 1;
      if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) inside++;
    }
    if (sides <= 2 && areaK[k] <= 0.85 && inside >= nBC * 0.9) valid[k] = 1;
  }
  // most permissive valid threshold, then step down while a stricter one is still valid and >10%
  // smaller: the extra area was a leak (e.g. into a pale finger). The paper itself is a plateau.
  let pick = -1;
  for (let k = 0; k < nT; k++) if (valid[k]) { pick = k; break; }
  while (pick >= 0 && pick + 1 < nT && valid[pick + 1] && areaK[pick + 1] < areaK[pick] * 0.9) pick++;

  // ---- 7. crop: paper box (or, without one, the text block) ...
  const m = Math.max(2, Math.round(hc * 0.8)); // text margin, work px
  let ox0: number, oy0: number, ox1: number, oy1: number;
  if (pick >= 0) {
    const o = pick * 4;
    ox0 = snap[o] - 2; oy0 = snap[o + 1] - 2; ox1 = snap[o + 2] + 3; oy1 = snap[o + 3] + 3;
  } else {
    ox0 = tx0 - m; oy0 = ty0 - m; ox1 = tx1 + 1 + m; oy1 = ty1 + 1 + m;
  }
  // ... plus all text. Characters are judged by RELATIVE darkness (peak / local paper level), which
  // a shadow does not change. "Kept" = inside the paper region (or the block when there is none).
  const gT = pick >= 0 ? EDGE_STEPS[pick] : 0;
  const kept = new Uint8Array(nb), ratio = new Float32Array(nb);
  const rs: number[] = [];
  for (let id = 0; id < nb; id++) {
    if (bKind[id] !== 3) continue;
    ratio[id] = bPeak[id] / (bC[id] || 1);
    if (pick >= 0) {
      let k = 0;
      for (let t = bStart[id]; t < bEnd[id]; t++) { const v = lvl[px[t]]; if (v && v <= gT) k++; }
      kept[id] = k * 2 >= bEnd[id] - bStart[id] ? 1 : 0;
    } else kept[id] = block[cellOf(id)] === 3 ? 1 : 0;
    if (kept[id]) rs.push(ratio[id]);
  }
  rs.sort((a, b) => a - b);
  // "print-like" = relative darkness >= 70% of the kept text's median
  const rMin = rs.length ? rs[rs.length >> 1] * 0.7 : 0.3;
  // per cell: ink of print-like characters vs other ink (stone specks, wood grain, outlines, ...),
  // and how many print-like characters cover the cell
  const isT = new Uint8Array(nb);
  const cellTxt = new Uint16Array(cn), cellClut = new Uint16Array(cn), cellCov = new Uint8Array(cn);
  for (let id = 0; id < nb; id++) {
    const t = bKind[id] === 3 && ratio[id] >= rMin ? 1 : 0;
    isT[id] = t;
    const tgt = t ? cellTxt : cellClut;
    for (let k = bStart[id]; k < bEnd[id]; k++) {
      const i = px[k], y = (i / W) | 0, c = (y >> 2) * CW + ((i - y * W) >> 2);
      if (tgt[c] < 65535) tgt[c]++;
    }
    if (t) {
      for (let cy = by0[id] >> 2; cy <= by1[id] >> 2; cy++) {
        for (let cx = bx0[id] >> 2; cx <= bx1[id] >> 2; cx++) { const c = cy * CW + cx; if (cellCov[c] < 255) cellCov[c]++; }
      }
    }
  }
  // Kept text always goes into the crop (a character can straddle the region's edge). A print-like
  // character outside qualifies when at least two others are close by (it sits in a word or a line)
  // and print clearly outweighs clutter around it (granite specks or wood grain rarely manage both);
  // qualified characters linked to kept text are added to the crop.
  const g = Math.max(1, Math.ceil((1.5 * hc) / 4));
  const qual = new Uint8Array(nb), reach = new Uint8Array(cn);
  for (let id = 0; id < nb; id++) {
    if (!isT[id]) continue;
    const fx0 = bx0[id] >> 2, fy0 = by0[id] >> 2, fx1 = bx1[id] >> 2, fy1 = by1[id] >> 2;
    if (kept[id]) {
      if (bx0[id] - m < ox0) ox0 = bx0[id] - m; if (by0[id] - m < oy0) oy0 = by0[id] - m;
      if (bx1[id] + 1 + m > ox1) ox1 = bx1[id] + 1 + m; if (by1[id] + 1 + m > oy1) oy1 = by1[id] + 1 + m;
      for (let cy = fy0; cy <= fy1; cy++) for (let cx = fx0; cx <= fx1; cx++) reach[cy * CW + cx] = 2;
      continue;
    }
    let cov = 0, txt = 0, clut = 0;
    for (let cy = Math.max(0, fy0 - g); cy <= Math.min(CH - 1, fy1 + g); cy++) {
      for (let cx = Math.max(0, fx0 - g); cx <= Math.min(CW - 1, fx1 + g); cx++) {
        const c = cy * CW + cx;
        cov += cellCov[c];
        if (cy >= fy0 - 1 && cy <= fy1 + 1 && cx >= fx0 - 1 && cx <= fx1 + 1) { txt += cellTxt[c]; clut += cellClut[c]; }
      }
    }
    if (cov >= (fy1 - fy0 + 1) * (fx1 - fx0 + 1) + 2 && txt >= 2 * clut) {
      qual[id] = 1;
      for (let cy = fy0; cy <= fy1; cy++) for (let cx = fx0; cx <= fx1; cx++) { const c = cy * CW + cx; if (!reach[c]) reach[c] = 1; }
    }
  }
  linkCells(reach, CW, CH, LINK, LINK, cTmp, cDil, cVis, cq);
  let outside = 0;
  for (let id = 0; id < nb; id++) {
    if (!qual[id]) continue;
    let linked = false;
    for (let cy = by0[id] >> 2; cy <= by1[id] >> 2 && !linked; cy++) {
      for (let cx = bx0[id] >> 2; cx <= bx1[id] >> 2; cx++) if (reach[cy * CW + cx] === 3) { linked = true; break; }
    }
    if (linked) {
      if (bx0[id] - m < ox0) ox0 = bx0[id] - m; if (by0[id] - m < oy0) oy0 = by0[id] - m;
      if (bx1[id] + 1 + m > ox1) ox1 = bx1[id] + 1 + m; if (by1[id] + 1 + m > oy1) oy1 = by1[id] + 1 + m;
    } else {
      const cx = (bx0[id] + bx1[id]) >> 1, cy = (by0[id] + by1[id]) >> 1;
      if (cx < ox0 || cx >= ox1 || cy < oy0 || cy >= oy1) outside++;
    }
  }

  // ---- 8. refuse when unsure
  // grouped print-like characters left outside the crop: there is another text block
  if (outside >= 2) return null;
  if (pick < 0) {
    // No bounded paper. If the frame border has the paper's own colour, the tag fills the frame:
    // nothing to crop. Otherwise (tag on a white wall, edge too faint) keep the text block.
    let same = 0, tot = 0;
    const tst = (i: number) => {
      tot++;
      const dc = C[i] - Pc, ds = S[i] - Ps;
      if (dc <= 8 && dc >= -8 && ds <= 10 && ds >= -10) same++;
    };
    for (let x = 0; x < W; x++) { tst(x); tst((H - 1) * W + x); }
    for (let y = 1; y < H - 1; y++) { tst(y * W); tst(y * W + W - 1); }
    if (same >= tot * 0.4 || (ox1 - ox0) * (oy1 - oy0) >= n * 0.6) return null;
  }
  const box = { x0: Math.max(0, ox0 / W), y0: Math.max(0, oy0 / H), x1: Math.min(1, ox1 / W), y1: Math.min(1, oy1 / H) };
  // a crop that keeps > 90% of the frame is not worth doing
  if ((box.x1 - box.x0) * (box.y1 - box.y0) > 0.9) return null;
  return box;
}

// Link cells that lie within (lx, ly) cells of each other. mark: 0 = empty, 1 = candidate,
// 2 = seed; on return every candidate or seed connected to a seed through such links is 3.
// Dilating the occupied cells by half the link distance and flooding the dilated mask costs
// O(cells) instead of O(cells x window).
function linkCells(mark: Uint8Array, CW: number, CH: number, lx: number, ly: number,
  tmp: Uint8Array, dil: Uint8Array, vis: Uint8Array, q: Int32Array) {
  const rx = (lx + 1) >> 1, ry = (ly + 1) >> 1, n = CW * CH;
  for (let cy = 0; cy < CH; cy++) {
    const o = cy * CW;
    let last = -1e9; // last occupied column seen
    for (let cx = 0; cx < CW + rx; cx++) {
      if (cx < CW && mark[o + cx]) last = cx;
      const t = cx - rx;
      if (t >= 0) tmp[o + t] = cx - last <= 2 * rx ? 1 : 0;
    }
  }
  for (let cx = 0; cx < CW; cx++) {
    let last = -1e9;
    for (let cy = 0; cy < CH + ry; cy++) {
      if (cy < CH && tmp[cy * CW + cx]) last = cy;
      const t = cy - ry;
      if (t >= 0) dil[t * CW + cx] = cy - last <= 2 * ry ? 1 : 0;
    }
  }
  vis.fill(0);
  let qh = 0, qt = 0;
  for (let c = 0; c < n; c++) if (mark[c] === 2) { vis[c] = 1; q[qt++] = c; }
  while (qh < qt) {
    const c = q[qh++], cx = c % CW;
    if (cx > 0 && dil[c - 1] && !vis[c - 1]) { vis[c - 1] = 1; q[qt++] = c - 1; }
    if (cx < CW - 1 && dil[c + 1] && !vis[c + 1]) { vis[c + 1] = 1; q[qt++] = c + 1; }
    if (c >= CW && dil[c - CW] && !vis[c - CW]) { vis[c - CW] = 1; q[qt++] = c - CW; }
    if (c + CW < n && dil[c + CW] && !vis[c + CW]) { vis[c + CW] = 1; q[qt++] = c + CW; }
  }
  for (let c = 0; c < n; c++) if (mark[c] && vis[c]) mark[c] = 3;
}

// Max / min over a 5-sample window (radius 2) along one row (stride 1) or column (stride W),
// edges clamped. The window slides through local variables so each sample is read once.
function max5(s: Uint8Array, d: Uint8Array, start: number, stride: number, count: number) {
  let i = start;
  let w0 = s[i], w1 = w0, w2 = w0;
  let w3 = count > 1 ? s[i + stride] : w2;
  let w4 = count > 2 ? s[i + 2 * stride] : w3;
  let j = i + 3 * stride;
  for (let k = 0; k < count; k++) {
    let m = w0 > w1 ? w0 : w1;
    if (w2 > m) m = w2;
    if (w3 > m) m = w3;
    if (w4 > m) m = w4;
    d[i] = m;
    i += stride;
    w0 = w1; w1 = w2; w2 = w3; w3 = w4;
    if (k + 3 < count) { w4 = s[j]; j += stride; }
  }
}
function min5(s: Uint8Array, d: Uint8Array, start: number, stride: number, count: number) {
  let i = start;
  let w0 = s[i], w1 = w0, w2 = w0;
  let w3 = count > 1 ? s[i + stride] : w2;
  let w4 = count > 2 ? s[i + 2 * stride] : w3;
  let j = i + 3 * stride;
  for (let k = 0; k < count; k++) {
    let m = w0 < w1 ? w0 : w1;
    if (w2 < m) m = w2;
    if (w3 < m) m = w3;
    if (w4 < m) m = w4;
    d[i] = m;
    i += stride;
    w0 = w1; w1 = w2; w2 = w3; w3 = w4;
    if (k + 3 < count) { w4 = s[j]; j += stride; }
  }
}

/**
 * Width of the copy the phone hands findPaperBox. The finder works on a ~160px
 * image whatever it is given (a 320px copy it first halves itself, step 1), so
 * the phone hands it that size directly: the JavaScript JPEG decode, the slow
 * part on the phone, is then a quarter of a 320px one. Checked both ways: on
 * the finder's benchmark (92 frames) 92/92 at either size, through a 4:2:0
 * JPEG as the phone saves it; on its stress set (~2,000 variations) no worse
 * at 160 than at 320 (text lost 2 vs 4 times, all under deep shadows stacked
 * on hard frames; false crops 13 vs 14; misses 66 vs 71).
 */
export const PAPER_FINDER_WIDTH = 160;

/**
 * The resize widths that take a framed photo `width` px wide down to the
 * finder's copy: one step of less than half, then halvings. Android scales
 * with a 2x2 bilinear sample, which over one big step reads only some of the
 * pixels — thin print can drop out of the copy — while each halving averages
 * all four pixels it folds, as the finder itself would. Empty when the photo
 * is no wider than the copy (nothing worth cutting).
 */
export function paperFinderWidths(width: number): number[] {
  if (!(width > PAPER_FINDER_WIDTH)) return [];
  const steps = [PAPER_FINDER_WIDTH];
  while (steps[0] * 2 < width) steps.unshift(steps[0] * 2);
  return steps;
}

/** A crop in whole pixels, as the image manipulator takes it. */
export type PixelCrop = { originX: number; originY: number; width: number; height: number };

/**
 * The finder's box (fractions of the small copy it looked at) as a crop of the
 * full-size photo `width` x `height`. Fractions do not change with scale, so
 * the box lands on the big photo where the finder saw the paper. Every edge is
 * rounded outward: a pixel of air costs nothing, a pixel of a figure costs a
 * field. Null when the box is not a real rectangle, or already the whole photo.
 */
export function paperCropRect(box: Box, width: number, height: number): PixelCrop | null {
  if (!(width > 0 && height > 0)) return null;
  const { x0, y0, x1, y1 } = box;
  if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
  const left = Math.max(0, Math.floor(x0 * width));
  const top = Math.max(0, Math.floor(y0 * height));
  const right = Math.min(width, Math.ceil(x1 * width));
  const bottom = Math.min(height, Math.ceil(y1 * height));
  if (right - left < 2 || bottom - top < 2) return null;
  if (left === 0 && top === 0 && right === width && bottom === height) return null;
  return { originX: left, originY: top, width: right - left, height: bottom - top };
}
