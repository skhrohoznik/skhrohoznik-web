/* Animované "pixelové" pozadie (mozaika s jemne sa meniacimi farbami).
   Engine prevzatý z generátora prechodov (typ PIXEL, štýl quilt). Pozastaví sa mimo obrazovky,
   v skrytej karte a pri vypnutých animáciách v systéme. */
(function () {
function be(e) {
  let t = parseInt(e.slice(1), 16);
  return [(t >> 16) & 255, (t >> 8) & 255, t & 255];
}

function tt(e) {
  let t = be(e).map((c) => {
      let d = c / 255;
      return d <= 0.04045 ? d / 12.92 : Math.pow((d + 0.055) / 1.055, 2.4);
    }),
    [n, a, o] = t,
    s = Math.cbrt(0.4122214708 * n + 0.5363325363 * a + 0.0514459929 * o),
    r = Math.cbrt(0.2119034982 * n + 0.6806995451 * a + 0.1073969566 * o),
    i = Math.cbrt(0.0883024619 * n + 0.2817188376 * a + 0.6299787005 * o);
  return [
    0.2104542553 * s + 0.793617785 * r - 0.0040720468 * i,
    1.9779984951 * s - 2.428592205 * r + 0.4505937099 * i,
    0.0259040371 * s + 0.7827717662 * r - 0.808675766 * i,
  ];
}

function Rt(e, t, n) {
  let a = Math.pow(e + 0.3963377774 * t + 0.2158037573 * n, 3),
    o = Math.pow(e - 0.1055613458 * t - 0.0638541728 * n, 3),
    s = Math.pow(e - 0.0894841775 * t - 1.291485548 * n, 3);
  return [
    4.0767416621 * a - 3.3077115913 * o + 0.2309699292 * s,
    -1.2684380046 * a + 2.6097574011 * o - 0.3413193965 * s,
    -0.0041960863 * a - 0.7034186147 * o + 1.707614701 * s,
  ].map((i) => {
    let c =
      i <= 0.0031308 ? i * 12.92 : 1.055 * Math.pow(Math.max(0, i), 0.4166666666666667) - 0.055;
    return Math.min(255, Math.max(0, Math.round(c * 255)));
  });
}

function ea(e, t, n) {
  let a = tt(e),
    o = tt(t);
  return Rt(a[0] + (o[0] - a[0]) * n, a[1] + (o[1] - a[1]) * n, a[2] + (o[2] - a[2]) * n);
}

function q(e, t, n) {
  let [a, o, s] = ea(e, "#FFFFFF", n);
  return `#${((1 << 24) | (a << 16) | (o << 8) | s).toString(16).slice(1)}`;
}

function pe(e, t) {
  let [n, a, o] = be(e);
  return `rgba(${n}, ${a}, ${o}, ${t})`;
}

function vs(e) {
  return Array.from({ length: Math.max(0, e - 1) }, (t, n) => (n + 1) / e);
}

function Ut(e, t) {
  if (e <= 1) return [50];
  let a = [0, ...(t && t.length === e - 1 ? t : vs(e)), 1];
  return Array.from({ length: e }, (o, s) => ((a[s] + a[s + 1]) / 2) * 100);
}

function re(e, t, n) {
  let a = Ut(e.length, t).map((o) => o / 100);
  if (n <= a[0]) return be(e[0]);
  if (n >= a[a.length - 1]) return be(e[e.length - 1]);
  for (let o = 0; o < a.length - 1; o++)
    if (n >= a[o] && n <= a[o + 1]) {
      let s = (n - a[o]) / Math.max(1e-6, a[o + 1] - a[o]);
      return ea(e[o], e[o + 1], s);
    }
  return be(e[e.length - 1]);
}

function Pe(e, t, n) {
  let [a, o, s] = re(e, t, n);
  return `#${((1 << 24) | ((a | 0) << 16) | ((o | 0) << 8) | (s | 0)).toString(16).slice(1)}`;
}

var ji = 13;

var Wt = 12;

var Ui = 0.82;

var Hi = 0.52;

var Vi = 0.86;

var Wi = 0.64;

var Ki = 0.14;

var lo = 0.22;

var Kt = 20;

var Yi = 0.09;

var _n = 30;

var Xi = 0.5;

var Zi = 0.032;

var qi = 2.4;

var Ji = 0.018;

var na = 1.1;

var Qi = 0.12;

var e0 = 0.075;

var t0 = 0.014;

function aa(e, t, n = ji) {
  let a = Math.min(e, t) / n,
    o = Math.max(4, Math.round(e / a)),
    s = Math.max(4, Math.round(t / a));
  return { cols: o, rows: s, cw: e / o, ch: t / s };
}

function Ae(e, t) {
  let n = Math.sin(e * 127.1 + t * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function n0(e, t, n, a, o = Wt, s = Kt) {
  let r = Math.max(2, Math.round(o)),
    i = (n + 0.5) / e.cols,
    c = (t + 0.5) / e.rows,
    d = Ui + 0.014 * Math.sin(a * 0.72),
    l = Hi + 0.01 * Math.cos(a * 0.58),
    u = 1 + Zi * Math.sin(a * qi),
    p = i + (c - l) * Ki + 0.028 * Math.sin(c * Math.PI * 1.15 + 0.35),
    m = Math.abs(p - d) / (Vi * u),
    f = Math.abs(c - l) / (Wi * u),
    b = 1 - ue(Math.max(m, f)),
    h = ue(i * 0.86 + (1 - Math.abs(c - l) * 2) * 0.14),
    g = ue(b * (1 - lo) + h * lo),
    v = Ae(t, n),
    L = Math.round(g * r),
    w = (Math.max(0, s - _n) / (100 - _n)) * Xi;
  if (w > 0) {
    let N = Ae(t * 3 + 17, n * 7 + 5);
    N < w && (L += N < w / 2 ? -1 : 1);
  }
  let I = (v - 0.5) * Yi * (Math.min(s, _n) / 100),
    E = Ji * Math.sin(a * na + v * Math.PI * 2);
  return ue(L / r + I + E);
}

function a0(e, t, n, a, o, s, r = Wt, i = Kt) {
  return ke(re(e, t, n0(n, a, o, s, r, i)));
}

function Rs(e, t, n, a, o, s, r = we, i = Wt, c = Kt) {
  let d = aa(t, n, B0(r));
  for (let u = 0; u < d.rows; u++)
    for (let p = 0; p < d.cols; p++)
      ((e.fillStyle = a0(a, o, d, u, p, s, i, c)),
        e.fillRect(
          Math.floor(p * d.cw),
          Math.floor(u * d.ch),
          Math.ceil(d.cw) + 1,
          Math.ceil(d.ch) + 1,
        ));
  let l = Math.max(0.65, Math.min(d.cw, d.ch) * t0);
  e.fillStyle = `rgba(255,255,255,${Qi})`;
  for (let u = 1; u < d.cols; u++) e.fillRect(Math.round(u * d.cw) - l, 0, l, n);
  for (let u = 1; u < d.rows; u++) e.fillRect(0, Math.round(u * d.ch) - l, t, l);
  e.fillStyle = pe(Pe(a, o, 0), e0);
  for (let u = 1; u < d.cols; u++) e.fillRect(Math.round(u * d.cw), 0, l, n);
  for (let u = 1; u < d.rows; u++) e.fillRect(0, Math.round(u * d.ch), t, l);
}

var o0 = 4;

var s0 = 100;

var r0 = 45;

var i0 = 0.5;

var l0 = 0.5;

var Is = 0.71;

var c0 = 0.57;

var Ns = 0.85;

var d0 = 0.63;

var u0 = 0.52;

var co = 0.14;

var p0 = 0.8;

var uo = 18;

var oa = 2.9;

var m0 = 6.5;

var h0 = 0.016;

var f0 = 0.026;

var g0 = 0.052;

var Xn = 0.568;

var $s = 0.658;

var Ps = 0.026;

var b0 = 0.26;

var y0 = 0.05;

var v0 = 0.62;

var F0 = 0.2;

var x0 = 0.03;

var po = 0.9;

var mo = 0.21;

var C0 = 0.55;

var E0 = 0.06;

var S0 = 0.41;

var w0 = 0.21;

var ho = 0.35;

var M0 = 0.75;

function L0(e) {
  return ue((e - (ae - po)) / po);
}

function A0(e, t) {
  if (t >= 1) return 1;
  let n = ue((t - (E0 + e * S0)) / w0);
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  let a = n - 1;
  return 1 + 2.2 * a * a * a + 1.2 * a * a;
}

function k0(e) {
  if (e >= 1) return 1;
  let t = ue((e - ho) / (M0 - ho));
  return t * t * (3 - 2 * t);
}

function R0(e) {
  if (e >= 1) return 1;
  let t = ue((e - mo) / (C0 - mo));
  return t * t * (3 - 2 * t);
}

function I0(e = we) {
  let t = e < 0 ? 0 : e > 100 ? 100 : e;
  return Math.round(8 + 0.12 * t);
}

function Cn(e) {
  return { x: i0 + 0.016 * Math.sin(e * 0.62), y: l0 + 0.013 * Math.cos(e * 0.54) };
}

function N0(e, t, n) {
  let a = Cn(n),
    o = 1 + 0.018 * Math.sin(n * 0.86),
    s = (e - a.x) / (Is * o),
    r = (t - a.y) / (c0 * o);
  return Math.pow(ue(Math.sqrt(s * s + r * r)), Ns);
}

function $0(e, t, n, a, o, s, r = 1) {
  let i = Cn(s);
  if (((e.fillStyle = ke(re(a, o, 1))), e.fillRect(0, 0, t, n), r <= 0)) return;
  let c = t * d0,
    d = n * u0,
    l = Math.max(0.08, d / Math.max(1, c));
  (e.save(), (e.globalAlpha = r), e.translate(t * i.x, n * i.y), e.scale(1, l));
  let u = e.createRadialGradient(0, 0, 0, 0, 0, c);
  for (let p = 0; p < uo; p++) {
    let m = p / (uo - 1);
    u.addColorStop(m, ke(re(a, o, co + (1 - co) * Math.pow(m, p0))));
  }
  ((e.fillStyle = u), e.fillRect(-t * 2, (-n * 2) / l, t * 4, (n * 4) / l), e.restore());
}

var nn = null;

function P0(e, t, n, a) {
  let o = `${e.toFixed(2)}|${t.toFixed(2)}|${n}|${a.toFixed(3)}`;
  if (nn && nn.key === o) return nn.sprite;
  let s = Math.ceil(e * 0.2),
    r = (v) => {
      let L = document.createElement("canvas");
      return ((L.width = L.height = Math.max(1, Math.ceil(v))), L);
    },
    i = r(e + s * 2),
    c = i.getContext("2d");
  (c.translate(s, s),
    (c.shadowColor = pe(n, 0.1)),
    (c.shadowBlur = e * 0.09),
    (c.shadowOffsetY = e * 0.05),
    _e(c, e, e, t),
    (c.fillStyle = "#000"),
    c.fill(),
    (c.shadowColor = "rgba(0,0,0,0)"),
    (c.globalCompositeOperation = "destination-out"),
    _e(c, e, e, t),
    c.fill());
  let d = r(e),
    l = d.getContext("2d");
  (_e(l, e, e, t), l.clip());
  let u = 0.07 + a * 0.26,
    p = l.createRadialGradient(e * 0.3, e * 0.243, 0, e * 0.3, e * 0.243, e * 0.78);
  for (let v = 0; v <= 4; v++) {
    let L = v / 4;
    p.addColorStop(L, `rgba(255,255,255,${(u * Math.pow(1 - L, 1.8)).toFixed(3)})`);
  }
  ((l.fillStyle = p), l.fillRect(0, 0, e, e));
  let m = 0.04 + a * 0.12,
    f = l.createRadialGradient(e * 0.76, e * 0.81, 0, e * 0.76, e * 0.81, e * 0.82);
  for (let v = 0; v <= 4; v++) {
    let L = v / 4;
    f.addColorStop(L, pe(n, m * Math.pow(1 - L, 1.8)));
  }
  ((l.fillStyle = f), l.fillRect(0, 0, e, e));
  let b = l.createRadialGradient(e * 0.47, e * 0.46, 0, e * 0.47, e * 0.46, e * 0.56);
  (b.addColorStop(0.9, pe(n, 0)),
    b.addColorStop(1, pe(n, 0.08)),
    (l.fillStyle = b),
    l.fillRect(0, 0, e, e));
  let h = l.createRadialGradient(e * 0.53, e * 0.54, 0, e * 0.53, e * 0.54, e * 0.56);
  (h.addColorStop(0.93, "rgba(255,255,255,0)"),
    h.addColorStop(1, "rgba(255,255,255,0.16)"),
    (l.fillStyle = h),
    l.fillRect(0, 0, e, e));
  let g = { shadow: i, overlay: d, pad: s };
  return ((nn = { key: o, sprite: g }), g);
}

function O0(e, t, n, a, o, s, r = 1) {
  if (r <= 0) return;
  let i = Cn(s),
    c = Math.sin(s * oa),
    d = 1.0175 + 0.0175 * c,
    l = Pe(a, o, v0),
    u = q(l, "#FFFFFF", 0.38),
    p = t * Xn * d,
    m = n * $s * d,
    f = Math.max(0.08, m / Math.max(1, p));
  (e.save(),
    (e.globalCompositeOperation = "screen"),
    (e.globalAlpha = (b0 + y0 * c) * r),
    e.translate(t * i.x, n * (i.y + Ps)),
    e.scale(1, f));
  let b = e.createRadialGradient(0, 0, 0, 0, 0, p);
  (b.addColorStop(0, pe(l, 0.75)),
    b.addColorStop(0.42, pe(u, 0.28)),
    b.addColorStop(1, pe(u, 0)),
    (e.fillStyle = b),
    e.fillRect(-t * 2, (-n * 2) / f, t * 4, (n * 4) / f),
    e.restore());
}

function D0(e, t, n, a, o, s, r = 1) {
  if (r <= 0) return;
  let i = Cn(s),
    c = Math.sin(s * oa),
    d = 1.0175 + 0.0175 * c,
    l = t * Xn * d,
    u = n * $s * d,
    p = Math.max(0.08, u / Math.max(1, l)),
    m = (b) => Pe(a, o, Math.pow(ue(b * (Xn / Is)), Ns));
  (e.save(),
    (e.globalAlpha = (F0 + x0 * c) * r),
    e.translate(t * i.x, n * (i.y + Ps)),
    e.scale(1, p));
  let f = e.createRadialGradient(0, 0, 0, 0, 0, l);
  (f.addColorStop(0, pe(m(0.1), 0)),
    f.addColorStop(0.28, pe(m(0.28), 0.4)),
    f.addColorStop(0.5, pe(m(0.5), 1)),
    f.addColorStop(0.72, pe(m(0.72), 0.35)),
    f.addColorStop(0.95, pe(m(0.95), 0)),
    (e.fillStyle = f),
    e.fillRect(-t * 2, (-n * 2) / p, t * 4, (n * 4) / p),
    e.restore());
}

function Os(e, t, n, a, o, s, r = we, i = o0, c = s0, d = r0) {
  let l = L0(s),
    u = R0(l),
    p = k0(l);
  ($0(e, t, n, a, o, s, u), O0(e, t, n, a, o, s, p));
  let m = aa(t, n, I0(r)),
    f = Math.min(m.cw, m.ch),
    b = ue(i / 100),
    h = ue(c / 100),
    g = ue(d / 100),
    v = Math.max(2, f * (1 - b)),
    L = (v / 2) * h,
    w = a[0],
    I = P0(v, L, w, g);
  for (let E = 0; E < m.rows; E++)
    for (let N = 0; N < m.cols; N++) {
      let M = (N + 0.5) / m.cols,
        S = (E + 0.5) / m.rows,
        A = (M - 0.5) / 0.5,
        x = (S - 0.52) / 0.52,
        y = Math.min(1, Math.sqrt(A * A + x * x) / Math.SQRT2),
        C = A0(y, l);
      if (C < 0.02) continue;
      let F = s * oa - y * m0,
        R = f * (f0 + g0 * (1 - y)) * Math.sin(F),
        k = 1 + h0 * Math.sin(F - 0.7),
        O = C < 1 ? C : k,
        P = N * m.cw + (m.cw - v) / 2,
        D = E * m.ch + (m.ch - v) / 2 + R,
        T = P + v / 2,
        B = D + v / 2,
        G = v * O,
        _ = (v + I.pad * 2) * O,
        z = Pe(a, o, N0(M, S, s));
      (C < 1 && (e.globalAlpha = Math.min(1, C * 1.4)),
        e.drawImage(I.shadow, T - _ / 2, B - _ / 2, _, _),
        e.save(),
        e.translate(T - G / 2, B - G / 2),
        _e(e, G, G, L * O),
        (e.fillStyle = z),
        e.fill(),
        e.restore(),
        e.drawImage(I.overlay, T - G / 2, B - G / 2, G, G),
        C < 1 && (e.globalAlpha = 1));
    }
  D0(e, t, n, a, o, s, p);
}

var Yt = 50;

function T0(e = we) {
  let t = e < 0 ? 0 : e > 100 ? 100 : e;
  return Math.round(6 + 0.08 * t);
}

function B0(e = we) {
  let t = e < 0 ? 0 : e > 100 ? 100 : e;
  return Math.round(8 + 0.1 * t);
}

var G0 = 0.4;

var z0 = 0.78;

var Ds = 0.72;

var Ts = 0.62;

var fo = 14;

var _0 = 0.024;

var j0 = 0.045;

var go = 0.016;

var U0 = 0.19;

var H0 = 0.28;

var V0 = 0.09;

var W0 = 0.075;

var K0 = 0.045;

var Y0 = 0.28;

var X0 = 3.5;

var Z0 = 0.5;

var q0 = 2.6;

var J0 = 0.32;

var Q0 = 0.011;

var e1 = 1.35;

var t1 = 0.34;

var n1 = 128.1;

var a1 = 0.68;

var o1 = 0.36;

var s1 = 0.17;

var bo = 1.15;

var yo = 0.05;

function Bs(e) {
  return { x: G0 + 0.024 * Math.sin(e * 0.62), y: z0 + _0 * Math.cos(e * 0.54) };
}

function vo(e, t, n) {
  let a = Bs(n),
    o = (e - a.x) / Ds,
    s = (t - a.y) / Ts;
  return ue(Math.sqrt(o * o + s * s));
}

function r1(e, t, n = Yt) {
  let a = (t + 0.5) / e.cols,
    o = n < 0 ? 0 : n > 100 ? 100 : n,
    s = Math.floor(e.rows * 0.78 * (1 - o / 100)),
    r = a < 0.4 ? 0 : a < 0.5 ? 1 : a < 0.7 ? 2 : 1;
  return Math.min(e.rows - 1, s + r);
}

function i1(e, t, n = Yt) {
  let a = ue((t - (ae - bo)) / bo),
    o = [];
  for (let i = 0; i < e.rows; i++)
    for (let c = 0; c < e.cols; c++) {
      let d = r1(e, c, n);
      if (i < d) continue;
      let l = (i - d) / Math.max(1, e.rows - d - 1);
      Ae(i * 5 + 11, c * 13 + 7) < Y0 * Math.pow(1 - l, X0) ||
        o.push({ r: i, c, start: d, h: Ae(i, c) });
    }
  let s = null;
  if (a < 1) {
    let i = [...o].sort((c, d) => c.h - d.h || c.r - d.r || c.c - d.c);
    s = new Map(i.map((c, d) => [c.r * 4096 + c.c, i.length > 1 ? d / (i.length - 1) : 0]));
  }
  let r = [];
  for (let { r: i, c, start: d, h: l } of o) {
    let u = 1;
    if (s) {
      let h = s.get(i * 4096 + c);
      if (((u = me((a - h * (1 - yo)) / yo)), u <= 0.01)) continue;
    }
    let p = j0 * Math.sin(t * na + l * Math.PI * 2),
      m = (i - d) / Math.max(1, e.rows - d - 1),
      f = Z0 * me(1 - (i - d) / q0),
      b = ue(0.88 + m * 0.06 + (l - 0.5) * 0.04 + p) * u;
    r.push({ x: c * e.cw, y: i * e.ch, r: i, c, alpha: b, pop: u, veil: f });
  }
  return r;
}

function _e(e, t, n, a) {
  let o = Math.min(a, t / 2, n / 2);
  (e.beginPath(),
    e.moveTo(o, 0),
    e.arcTo(t, 0, t, n, o),
    e.arcTo(t, n, 0, n, o),
    e.arcTo(0, n, 0, 0, o),
    e.arcTo(0, 0, t, 0, o),
    e.closePath());
}

var Fo = null;

var xo = null;

var l1 = 0.14;

var c1 = 0.09;

var d1 = 0.03;

var Co = 0.16;

function Eo(e, t, n, a, o, s) {
  let r = Bs(s);
  ((e.fillStyle = ke(re(a, o, 1))), e.fillRect(0, 0, t, n));
  let i = t * Ds,
    c = n * Ts,
    d = Math.max(0.08, c / Math.max(1, i));
  (e.save(), e.translate(t * r.x, n * r.y), e.scale(1, d));
  let l = e.createRadialGradient(0, 0, 0, 0, 0, i);
  for (let u = 0; u < fo; u++) {
    let p = u / (fo - 1);
    l.addColorStop(p, ke(re(a, o, p)));
  }
  ((e.fillStyle = l), e.fillRect(-t * 2, (-n * 2) / d, t * 4, (n * 4) / d), e.restore());
}

function Gs(e, t, n, a, o, s, r = we, i = Yt) {
  let c = aa(t, n, T0(r)),
    d = Math.min(c.cw, c.ch),
    l = c.cw * (1 - go),
    u = c.ch * (1 - go),
    p = (c.cw - l) / 2,
    m = (c.ch - u) / 2,
    f = Math.min(l, u) * U0,
    b = i1(c, s, i);
  ((e.fillStyle = ke(re(a, o, 1))),
    e.fillRect(0, 0, t, n),
    (e.globalAlpha = a1),
    Eo(e, t, n, a, o, s),
    (e.globalAlpha = 1));
  let h = Fo ?? (Fo = document.createElement("canvas"));
  (h.width !== t && (h.width = t), h.height !== n && (h.height = n));
  let g = h.getContext("2d");
  (g.setTransform(1, 0, 0, 1, 0, 0),
    (g.globalAlpha = 1),
    (g.filter = "none"),
    g.clearRect(0, 0, t, n));
  let v = Pe(a, o, 0);
  for (let G of b) {
    let _ = 0.82 + 0.18 * G.pop;
    (g.save(),
      g.translate(G.x + p + l / 2, G.y + m + u / 2 + d * K0),
      g.scale(_, _),
      g.translate(-l / 2, -u / 2),
      _e(g, l, u, f),
      (g.globalAlpha = G.alpha * 0.14),
      (g.fillStyle = v),
      g.fill(),
      g.restore());
  }
  ((g.globalAlpha = 1),
    (e.filter = `blur(${(2 * d * W0).toFixed(1)}px)`),
    e.drawImage(h, 0, 0),
    (e.filter = "none"));
  let L = xo ?? (xo = document.createElement("canvas"));
  (L.width !== t && (L.width = t), L.height !== n && (L.height = n));
  let w = L.getContext("2d");
  (w.setTransform(1, 0, 0, 1, 0, 0),
    (w.globalAlpha = 1),
    (w.filter = "none"),
    w.clearRect(0, 0, t, n),
    Eo(w, t, n, a, o, s),
    (w.fillStyle = `rgba(255,255,255,${d1})`),
    w.fillRect(0, 0, t, n));
  let [I, E, N] = re(a, o, 0),
    M = [I, E, N],
    S = [255, 255, 255],
    A = (G, _, z) => [G[0] + (_[0] - G[0]) * z, G[1] + (_[1] - G[1]) * z, G[2] + (_[2] - G[2]) * z],
    x = (n1 * Math.PI) / 180,
    y = Math.sin(x),
    C = -Math.cos(x),
    F = (Math.abs(y) * l + Math.abs(C) * u) / 2,
    $ = e.createRadialGradient(l * 0.3, u * 0.24, 0, l * 0.3, u * 0.24, d * 0.85);
  ($.addColorStop(0, `rgba(255,255,255,${H0})`),
    $.addColorStop(0.55, "rgba(255,255,255,0.05)"),
    $.addColorStop(1, "rgba(255,255,255,0)"));
  let R = e.createRadialGradient(l * 0.72, u * 0.86, 0, l * 0.72, u * 0.86, d * 0.9);
  (R.addColorStop(0, `rgba(${I | 0},${E | 0},${N | 0},${V0})`),
    R.addColorStop(0.6, `rgba(${I | 0},${E | 0},${N | 0},0.03)`),
    R.addColorStop(1, `rgba(${I | 0},${E | 0},${N | 0},0)`));
  let k = e.createLinearGradient(0, 0, 0, u);
  (k.addColorStop(0, "rgba(255,255,255,0.22)"),
    k.addColorStop(0.16, "rgba(255,255,255,0.1)"),
    k.addColorStop(0.48, "rgba(255,255,255,0)"));
  let O = e.createRadialGradient(l * 0.21, u * 0.15, 0, l * 0.21, u * 0.15, d * 0.1);
  (O.addColorStop(0, `rgba(255,255,255,${t1})`),
    O.addColorStop(0.7, "rgba(255,255,255,0.1)"),
    O.addColorStop(1, "rgba(255,255,255,0)"));
  for (let G of b) {
    let _ = 0.82 + 0.18 * G.pop,
      z = Q0 * Math.sin(s * e1 + Ae(G.c + 5, G.r + 43) * Math.PI * 2),
      Y = _ * (1 + z),
      Z = _ * (1 - z),
      Q = G.x + c.cw / 2,
      K = G.y + c.ch / 2,
      J = (Ae(G.c + 37, G.r + 11) - 0.5) * 0.03,
      te = ue(vo((Q - y * F) / t, (K - C * F) / n, s) + J),
      H = ue(vo((Q + y * F) / t, (K + C * F) / n, s) + J),
      j = A(re(a, o, te), S, G.veil),
      U = A(re(a, o, H), S, G.veil),
      W = A(j, S, o1),
      V = A(A(j, U, 0.5), S, 0.06),
      X = A(U, M, s1 * (1 - G.veil)),
      ne = e.createLinearGradient(l / 2 - y * F, u / 2 - C * F, l / 2 + y * F, u / 2 + C * F);
    (ne.addColorStop(0, ke(W)),
      ne.addColorStop(0.5, ke(V)),
      ne.addColorStop(1, ke(X)),
      e.save(),
      e.translate(G.x + p + l / 2, G.y + m + u / 2),
      e.scale(Y, Z),
      e.translate(-l / 2, -u / 2));
    let he = d * Co * (0.7 + 0.6 * (Ae(G.c + 91, G.r + 53) - 0.5)),
      fe = d * Co * (0.55 + 0.6 * (Ae(G.c + 17, G.r + 71) - 0.5)),
      ve = 0.84,
      ge = l * ve,
      Oe = u * ve,
      Le = Math.max(0, Math.min(t - ge, G.x + p + (l - ge) / 2 - he)),
      Ge = Math.max(0, Math.min(n - Oe, G.y + m + (u - Oe) / 2 - fe));
    ((e.globalAlpha = G.alpha * l1),
      _e(e, l, u, f),
      e.clip(),
      e.drawImage(L, Le, Ge, ge, Oe, 0, 0, l, u),
      (e.globalAlpha = G.alpha * c1),
      (e.fillStyle = ne),
      _e(e, l, u, f),
      e.fill(),
      (e.globalAlpha = G.alpha),
      _e(e, l, u, f),
      (e.fillStyle = $),
      e.fill(),
      (e.fillStyle = R),
      e.fill(),
      _e(e, l, u, f),
      (e.fillStyle = k),
      e.fill(),
      _e(e, l, u, f),
      (e.fillStyle = O),
      e.fill());
    let Re = e.createLinearGradient(0, 0, l, u);
    (Re.addColorStop(0, "rgba(255,255,255,0.55)"),
      Re.addColorStop(0.42, "rgba(255,255,255,0.2)"),
      Re.addColorStop(0.72, pe(v, 0.1)),
      Re.addColorStop(1, pe(v, 0.26)),
      _e(e, l, u, f),
      (e.strokeStyle = Re),
      (e.lineWidth = Math.max(1.2, d * 0.022)),
      e.stroke(),
      e.restore());
  }
  let P = Math.floor(c.rows * 0.78 * (1 - ue(i / 100))),
    D = (P - 1.6) * c.ch,
    T = (P + 1.2) * c.ch,
    B = e.createLinearGradient(0, D, 0, T);
  (B.addColorStop(0, "rgba(255,255,255,0)"),
    B.addColorStop(0.45, `rgba(255,255,255,${J0})`),
    B.addColorStop(0.7, "rgba(255,255,255,0.1)"),
    B.addColorStop(1, "rgba(255,255,255,0)"),
    (e.fillStyle = B),
    e.fillRect(0, Math.max(0, D), t, T - Math.max(0, D)));
}

var we = 50;

function ue(e) {
  return e < 0 ? 0 : e > 1 ? 1 : e;
}

function ke([e, t, n]) {
  return `rgb(${e | 0},${t | 0},${n | 0})`;
}

var ae = 20.75;

var me = (e) => {
  let t = Math.min(1, Math.max(0, e));
  return t * t * (3 - 2 * t);
};

var Tl = 1.2;

function or(e, t, n, a, o) {
  let s = Ut(e.length, n),
    r = e.map((i, c) => `${i} ${s[c].toFixed(1)}%`).join(", ");
  return `linear-gradient(${e[0]}, ${e[0]})`;
}

var kt = 256;

var Hn = null;

var Vn = null;

function ac() {
  if (Hn) return Hn;
  let e = document.createElement("canvas");
  e.width = e.height = kt;
  let t = e.getContext("2d"),
    n = t.createImageData(kt, kt),
    a = n.data;
  for (let o = 0; o < a.length; o += 4) {
    let s = Math.round(((Math.random() + Math.random()) / 2) * 255);
    ((a[o] = a[o + 1] = a[o + 2] = s), (a[o + 3] = 255));
  }
  return (t.putImageData(n, 0, 0), (Hn = e), e);
}

function sr() {
  return (Vn == null && (Vn = ac().toDataURL()), Vn);
}

var rr = (e) => (Math.max(0, Math.min(100, e)) / 100) * 0.5;

function render(canvas, recipe, t = recipe.startT ?? ae, interactive = false) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width,
    H = canvas.height,
    stops = recipe.stops;
  {
    const style = recipe.pixelStyle ?? "quilt";
    if (style === "glass")
      Gs(ctx, W, H, stops, recipe.divs ?? void 0, t, recipe.size ?? we, recipe.cover ?? Yt);
    else if (style === "orbs")
      Os(
        ctx,
        W,
        H,
        stops,
        recipe.divs ?? void 0,
        t,
        recipe.size ?? we,
        recipe.cover ?? Yt,
        recipe.rings ?? Wt,
        recipe.weave ?? Kt,
      );
    else
      Rs(
        ctx,
        W,
        H,
        stops,
        recipe.divs ?? void 0,
        t,
        recipe.size ?? we,
        recipe.rings ?? Wt,
        recipe.weave ?? Kt,
      );
  }
}

function backgroundCss(recipe) {
  return or(recipe.stops, "PIXEL", recipe.divs ?? void 0, recipe.mesh, recipe.cube ?? void 0);
}

function backingSize(cssW, cssH, animating = false, recipe = null) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const dw = Math.round(cssW * dpr),
    dh = Math.round(cssH * dpr);
  const fit = (w, h, cap, byLongest) => {
    const k = Math.min(1, cap / Math.max(1, byLongest ? Math.max(w, h) : w));
    return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
  };
  if (animating) {
    return fit(dw, dh, 2560, false);
  }
  return fit(dw, dh, 2560, false);
}

function mountGradient(host, recipe) {
  host.style.position = "relative";
  host.style.overflow = "hidden";
  host.style.isolation = "isolate";
  const field = document.createElement("div");
  Object.assign(field.style, {
    position: "absolute",
    inset: "0",
    background: backgroundCss(recipe),
  });
  const blur = Math.max(0, recipe.fieldBlur);
  if (blur > 0) {
    field.style.filter = `blur(${blur}px)`;
    field.style.transform = `scale(${1 + blur / 200})`;
  }
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    display: "block",
  });
  field.appendChild(canvas);
  host.appendChild(field);
  if (recipe.grain > 0) {
    const grain = document.createElement("div");
    Object.assign(grain.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      backgroundImage: `url(${sr()})`,
      backgroundSize: `${kt}px ${kt}px`,
      imageRendering: "pixelated",
      mixBlendMode: "overlay",
      opacity: String(rr(recipe.grain)),
    });
    host.appendChild(grain);
  }
  let t = recipe.startT ?? ae;
  const speed = Math.max(0, Math.min(100, recipe.speed));
  const animates = speed > 0;
  const draw = (animating) => {
    const box = host.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    const [w, h] = backingSize(box.width, box.height, animating, recipe);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    render(canvas, recipe, t, animating);
  };
  const motionOk = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0,
    last = 0,
    visible = true;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) {
      last = 0;
      return;
    }
    if (last) t += (speed / 100) * Tl * Math.min(0.05, (now - last) / 1000);
    last = now;
    draw(true);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
  });
  io.observe(host);
  const ro = new ResizeObserver(() => {
    if (!raf) draw(false);
  });
  ro.observe(host);
  if (animates && motionOk()) raf = requestAnimationFrame(frame);
  else draw(false);
  return () => {
    cancelAnimationFrame(raf);
    raf = 0;
    io.disconnect();
    ro.disconnect();
    field.remove();
    host.replaceChildren();
  };
}

window.PixelBg = { mount: mountGradient, render: render };
})();
