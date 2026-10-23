/* Animované "akvarelové" pozadie (vodové farby na papieri, WebGL; bez WebGL sa kreslí cez Canvas).
   Engine prevzatý z generátora prechodov (typ WATERCOLOR). Pozastaví sa mimo obrazovky,
   v skrytej karte a pri vypnutých animáciách v systéme. */
(function () {
var kn = {
  wetness: 68,
  pigment: 54,
  scale: 54,
  spread: 48,
  blooms: 28,
  granulation: 32,
  edges: 40,
  texture: 26,
  paperWarmth: 22,
  coverage: 76,
  seed: 17,
  angle: 330,
  layers: 5,
  technique: "wash",
};

function vt(e) {
  let t = e !== null && typeof e == "object" && !Array.isArray(e) ? e : {},
    n = (o, s = 0, r = 100) => {
      let i = t[o];
      return typeof i == "number" && Number.isFinite(i) ? Math.min(r, Math.max(s, i)) : kn[o];
    },
    a = t.technique;
  return {
    wetness: n("wetness"),
    pigment: n("pigment"),
    scale: n("scale"),
    spread: n("spread"),
    blooms: n("blooms"),
    granulation: n("granulation"),
    edges: n("edges"),
    texture: n("texture"),
    paperWarmth: n("paperWarmth"),
    coverage: n("coverage"),
    seed: Math.round(n("seed", 1, 9999)),
    angle: n("angle", 0, 360),
    layers: Math.round(n("layers", 2, 8)),
    technique: a === "wash" || a === "pools" || a === "veil" ? a : kn.technique,
  };
}

var qt = 256;

var Zt = 8;

var Rn = 960;

var Pr = (e, t = 0, n = 1) => Math.max(t, Math.min(n, e));

var Sa = (e, t, n) => {
  let a = Pr((n - e) / (t - e));
  return a * a * (3 - 2 * a);
};

function La(e) {
  let t = e >>> 0;
  return () => ((t = (Math.imul(t, 1664525) + 1013904223) >>> 0), t / 4294967296);
}

var st = new Uint8Array(qt * qt * 4);

var Or = La(1977);

for (let e = 0; e < st.length; e++) st[e] = Math.floor(Or() * 256);

function Dr(e) {
  let t = e.filter((n) => /^#[0-9a-f]{6}$/i.test(n)).slice(0, 12);
  return (t.length ? t : ["#387D99", "#8B79AD", "#DF929F", "#E4B879"]).map((n) => {
    let a = parseInt(n.slice(1), 16);
    return [(a >> 16) & 255, (a >> 8) & 255, a & 255].map(
      (o) => -Math.log(Math.max(0.025, o / 255)),
    );
  });
}

var Te = (e, t, n) => Math.sin(e * t + n) - Math.sin(n);

var Aa = (e) => (Number.isFinite(e) ? Math.max(0, Math.min(1e6, e)) : 0);

function ka(e) {
  return [
    0.32 * Te(e, 0.72, 0),
    0.3 * Te(e, 0.57, 1.3),
    0.28 * Te(e, 0.39, 0.7),
    0.3 * Te(e, 0.83, 2.1),
  ];
}

function Ra(e, t, n, a = 0) {
  let o = La(e.seed * 8191),
    s = Dr(t),
    i = [
      0,
      ...(n?.length === s.length - 1 &&
      n.every((u, p) => Number.isFinite(u) && u >= (n[p - 1] ?? 0) && u <= 1)
        ? n
        : s.slice(1).map((u, p) => (p + 1) / s.length)),
      1,
    ],
    c = s.map((u, p) => i[p + 1] - i[p]),
    d = s.map((u, p) => (i[p + 1] + i[p]) * 0.5),
    l = [];
  for (let u = 0; u < e.layers; u++) {
    let p = (u + 0.5) / e.layers,
      m = c.map((L, w) => L * Math.exp(-0.5 * ((p - d[w]) / (0.13 + 0.2 / e.layers)) ** 2)),
      f = Math.max(
        1e-8,
        m.reduce((L, w) => L + w, 0),
      ),
      b = [0, 1, 2].map((L) => s.reduce((w, I, E) => w + (I[L] * m[E]) / f, 0)),
      h = u * 1.71 + e.seed * 0.007,
      g = (o() - 0.5) * 2.5 + 0.12 * Te(a, 0.47, h),
      v = (0.12 + (e.coverage / 100) * 0.26) * (0.76 + o() * 0.46);
    l.push({
      x: (p - 0.5) * 1.4 + (o() - 0.5) * 0.2 + 0.09 * Te(a, 0.67, h),
      y:
        Math.sin(p * Math.PI * 2 + e.seed * 0.7) * 0.2 +
        (o() - 0.5) * 0.28 +
        0.075 * Te(a, 0.59, h + 1.6),
      rx: v * (e.technique === "veil" ? 1.7 : 1.22) * (1 + 0.09 * Te(a, 0.81, h)),
      ry: v * (e.technique === "pools" ? 0.84 : 1.1) * (1 + 0.09 * Te(a, 0.63, h + 1.8)),
      c: Math.cos(g),
      s: Math.sin(g),
      strength: 0.68 + o() * 0.4,
      color: b,
      bloom: [
        0.36 * Math.sin(u * 2.3 + 1) + 0.12 * Te(a, 0.41, h),
        0.36 * Math.cos(u * 1.7) + 0.12 * Te(a, 0.53, h + 1.2),
        0.04 * Te(a, 0.65, h),
      ],
    });
  }
  return l;
}

var Tr = `precision highp float;
uniform vec2 u_res;
uniform sampler2D u_noise;
uniform vec4 u_shape[8];
uniform vec4 u_pigment[8];
uniform vec2 u_turn[8];
uniform vec3 u_bloom[8];
uniform vec4 u_flow;
uniform float u_layers,u_seed,u_angle,u_scale,u_spread,u_wetness,u_pigmentStrength;
uniform float u_blooms,u_granulation,u_edges,u_texture,u_warmth,u_veil;
vec4 field(vec2 p) {
  vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  return texture2D(u_noise,(mod(floor(p),256.0)+f+0.5)/256.0);
}
void main(){
  vec2 uv=vec2(gl_FragCoord.x/u_res.x,1.0-gl_FragCoord.y/u_res.y);
  float aspect=u_res.x/u_res.y;
  vec2 paper=(uv-0.5)*vec2(aspect,1.0)/max(1.0,aspect);
  float cs=cos(u_angle),sn=sin(u_angle);
  vec2 p=vec2(paper.x*cs-paper.y*sn,paper.x*sn+paper.y*cs)*u_scale;
  vec2 offset=vec2(mod(u_seed*13.71,197.0),mod(u_seed*7.93,211.0));
  vec4 large=field(p*3.7+offset+u_flow.xy);
  vec4 mid=field(p*11.8+offset+large.rg*1.7+u_flow.zw);
  vec4 fine=field(p*43.0+offset+mid.rg*0.8+u_flow.xy*0.35);
  vec2 warp=((large.rg-0.5)*0.44+(mid.rg-0.5)*0.16+(fine.rg-0.5)*0.027)*(0.25+u_spread*1.4);
  float frequency=min(620.0,min(u_res.x,u_res.y)*0.45);
  vec4 tooth=field(paper*frequency+vec2(37.0,89.0));
  vec4 fiber=field(paper*min(210.0,frequency*0.45)+vec2(71.0,13.0));
  float grain=(tooth.r-0.5)*0.68+(fiber.g-0.5)*0.32;
  float feather=0.025+u_wetness*0.31+u_veil*0.13;
  vec3 absorption=vec3(0.0);
  for(int i=0;i<8;i++){
    if(float(i)>=u_layers) break;
    vec2 delta=p+warp-u_shape[i].xy;
    vec2 turn=u_turn[i];
    vec2 q=vec2(delta.x*turn.x-delta.y*turn.y,delta.x*turn.y+delta.y*turn.x)/u_shape[i].zw;
    float d=length(q)+(fine.b-0.5)*0.08;
    float mask=1.0-smoothstep(1.0-feather,1.0+feather,d);
    float cloud=mix(large.b,large.a,mod(float(i),2.0));
    float uneven=0.55+cloud*0.8+(mid.b-0.5)*0.34;
    float edgeDistance=(d-(0.97-feather*0.28))/(0.014+feather*0.13);
    float ridge=exp(-edgeDistance*edgeDistance);
    ridge*=u_edges*(0.12+mid.a*0.45)*(1.0-u_wetness*0.45);
    vec2 b=q-u_bloom[i].xy;
    float bd=length(b)+(mid.a-0.5)*0.42+(fine.a-0.5)*0.13;
    float bloomRadius=0.2+u_blooms*(0.32+u_bloom[i].z);
    float bloom=(1.0-smoothstep(bloomRadius-0.09,bloomRadius+0.08,bd))*u_blooms;
    float bloomDistance=(bd-bloomRadius-0.045)/0.036;
    float bloomEdge=exp(-bloomDistance*bloomDistance)*u_blooms*0.33;
    float granulate=max(0.15,1.0+grain*u_granulation*0.85+(fine.g-0.5)*u_granulation*0.32);
    float density=(mask*uneven*(1.0-bloom*0.78)+ridge+bloomEdge*mask)*granulate;
    density*=u_pigment[i].a*u_pigmentStrength;
    absorption+=u_pigment[i].rgb*density;
  }
  vec3 paperColor=mix(vec3(0.995,0.994,0.989),vec3(0.99,0.949,0.867),u_warmth);
  vec3 color=paperColor*exp(-absorption);
  color*=1.0+grain*u_texture*0.095+(fiber.b-0.5)*u_texture*0.026;
  gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);
}`;

var Ke = null;

function Br() {
  if (Ke === false || typeof document > "u") return null;
  if (Ke) return Ke.lost ? null : Ke;
  let e = document.createElement("canvas"),
    t = e.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
    });
  if (!t) return ((Ke = false), null);
  let n = t.createProgram();
  if (!n) return ((Ke = false), null);
  try {
    for (let [d, l] of [
      [
        t.VERTEX_SHADER,
        "attribute vec2 position; void main(){gl_Position=vec4(position,0.0,1.0);}",
      ],
      [t.FRAGMENT_SHADER, Tr],
    ]) {
      let u = t.createShader(d);
      if ((t.shaderSource(u, l), t.compileShader(u), !t.getShaderParameter(u, t.COMPILE_STATUS))) {
        let p = t.getShaderInfoLog(u);
        throw (t.deleteShader(u), new Error(p ?? "Watercolor shader could not compile"));
      }
      (t.attachShader(n, u), t.deleteShader(u));
    }
    if ((t.linkProgram(n), !t.getProgramParameter(n, t.LINK_STATUS)))
      throw new Error(t.getProgramInfoLog(n) ?? "Watercolor shader could not link");
    t.useProgram(n);
    let a = t.createBuffer();
    (t.bindBuffer(t.ARRAY_BUFFER, a),
      t.bufferData(t.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), t.STATIC_DRAW));
    let o = t.getAttribLocation(n, "position");
    (t.enableVertexAttribArray(o), t.vertexAttribPointer(o, 2, t.FLOAT, false, 0, 0));
    let s = t.createTexture();
    (t.bindTexture(t.TEXTURE_2D, s),
      t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MIN_FILTER, t.LINEAR),
      t.texParameteri(t.TEXTURE_2D, t.TEXTURE_MAG_FILTER, t.LINEAR),
      t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_S, t.REPEAT),
      t.texParameteri(t.TEXTURE_2D, t.TEXTURE_WRAP_T, t.REPEAT),
      t.texImage2D(t.TEXTURE_2D, 0, t.RGBA, qt, qt, 0, t.RGBA, t.UNSIGNED_BYTE, st));
    let r = {};
    for (let d of [
      "res",
      "noise",
      "shape",
      "pigment",
      "turn",
      "bloom",
      "flow",
      "layers",
      "seed",
      "angle",
      "scale",
      "spread",
      "wetness",
      "pigmentStrength",
      "blooms",
      "granulation",
      "edges",
      "texture",
      "warmth",
      "veil",
    ])
      r[d] = t.getUniformLocation(n, `u_${d}`);
    t.uniform1i(r.noise, 0);
    let i = t.getParameter(t.MAX_VIEWPORT_DIMS),
      c = {
        canvas: e,
        gl: t,
        program: n,
        uniforms: r,
        lost: false,
        shapes: new Float32Array(Zt * 4),
        colors: new Float32Array(Zt * 4),
        turns: new Float32Array(Zt * 2),
        blooms: new Float32Array(Zt * 3),
        maxSize: Math.min(
          t.getParameter(t.MAX_TEXTURE_SIZE),
          t.getParameter(t.MAX_RENDERBUFFER_SIZE),
          i[0],
          i[1],
        ),
      };
    return (
      e.addEventListener("webglcontextlost", (d) => {
        (d.preventDefault(), (c.lost = true));
      }),
      e.addEventListener("webglcontextrestored", () => {
        Ke = null;
      }),
      (Ke = c),
      c
    );
  } catch (a) {
    return (
      t.deleteProgram(n),
      t.getExtension("WEBGL_lose_context")?.loseContext(),
      console.warn("Watercolors is using its Canvas renderer.", a),
      (Ke = false),
      null
    );
  }
}

function Ia(e, t, n) {
  let a = Math.min(1, n / Math.max(e, t));
  return [Math.max(1, Math.round(e * a)), Math.max(1, Math.round(t * a))];
}

function Nt(e, t, n, a, o, s, r = "export", i = 0) {
  if (!(t > 0 && n > 0 && Number.isFinite(t) && Number.isFinite(n))) return;
  let c = vt(o),
    d = Aa(i),
    l = Br();
  if (!l) {
    Gr(e, t, n, a, c, s, r === "interactive" ? 320 : r === "preview" ? 640 : Rn, d);
    return;
  }
  let [u, p] = Ia(t, n, l.maxSize),
    { gl: m, canvas: f, program: b, uniforms: h } = l;
  (f.width !== u && (f.width = u),
    f.height !== p && (f.height = p),
    m.viewport(0, 0, u, p),
    m.useProgram(b),
    m.uniform2f(h.res, u, p));
  let { shapes: g, colors: v, turns: L, blooms: w } = l;
  (Ra(c, a, s, d).forEach((I, E) => {
    (g.set([I.x, I.y, I.rx, I.ry], E * 4),
      v.set([...I.color, I.strength], E * 4),
      L.set([I.c, I.s], E * 2),
      w.set(I.bloom, E * 3));
  }),
    m.uniform4fv(h.shape, g),
    m.uniform4fv(h.pigment, v),
    m.uniform2fv(h.turn, L),
    m.uniform3fv(h.bloom, w),
    m.uniform4fv(h.flow, ka(d)));
  for (let I of ["spread", "wetness", "blooms", "granulation", "edges", "texture"])
    m.uniform1f(h[I], c[I] / 100);
  (m.uniform1f(h.warmth, c.paperWarmth / 100),
    m.uniform1f(h.layers, c.layers),
    m.uniform1f(h.seed, c.seed),
    m.uniform1f(h.angle, (c.angle * Math.PI) / 180),
    m.uniform1f(h.scale, 1.75 - (c.scale / 100) * 1.2),
    m.uniform1f(h.pigmentStrength, (c.pigment / 100) * 1.05),
    m.uniform1f(h.veil, c.technique === "veil" ? 1 : 0),
    m.drawArrays(m.TRIANGLES, 0, 3),
    e.drawImage(f, 0, 0, t, n));
}

function Ft(e, t, n) {
  let a = Math.floor(e),
    o = Math.floor(t),
    s = e - a,
    r = t - o;
  ((s = s * s * (3 - 2 * s)), (r = r * r * (3 - 2 * r)));
  let i = a & 255,
    c = (a + 1) & 255,
    d = (o & 255) * 256,
    l = ((o + 1) & 255) * 256,
    u = st[(d + i) * 4 + n],
    p = st[(d + c) * 4 + n],
    m = st[(l + i) * 4 + n],
    f = st[(l + c) * 4 + n];
  return (u + (p - u) * s + (m - u + (u - p - m + f) * s) * r) / 255;
}

var wa = null;

var Ma = "";

function Gr(e, t, n, a, o, s, r = Rn, i = 0) {
  if (!(t > 0 && n > 0 && Number.isFinite(t) && Number.isFinite(n))) return;
  let c = Aa(i),
    d = ka(c),
    l = vt(o),
    u = Ra(l, a, s, c),
    [p, m] = Ia(t, n, Math.min(Rn, Math.max(1, r))),
    f = wa ?? (wa = document.createElement("canvas")),
    b = JSON.stringify([p, m, a, l, s, c]);
  if (Ma === b) {
    e.drawImage(f, 0, 0, t, n);
    return;
  }
  (f.width !== p && (f.width = p), f.height !== m && (f.height = m));
  let h = f.getContext("2d"),
    g = h.createImageData(p, m),
    v = p / m,
    L = Math.max(1, v),
    w = (l.angle * Math.PI) / 180,
    I = Math.cos(w),
    E = Math.sin(w),
    N = 1.75 - (l.scale / 100) * 1.2,
    M = (l.seed * 13.71) % 197,
    S = (l.seed * 7.93) % 211,
    A = 0.25 + (l.spread / 100) * 1.4,
    x = l.wetness / 100,
    y = 0.025 + x * 0.31 + (l.technique === "veil" ? 0.13 : 0),
    C = 0.014 + y * 0.13,
    F = Math.min(620, Math.min(p, m) * 0.45),
    $ = Math.min(210, F * 0.45),
    R = [
      0.995 - (0.005 * l.paperWarmth) / 100,
      0.994 - (0.045 * l.paperWarmth) / 100,
      0.989 - (0.122 * l.paperWarmth) / 100,
    ],
    k = new Float64Array(4),
    O = new Float64Array(4),
    P = new Float64Array(4);
  for (let D = 0; D < m; D++)
    for (let T = 0; T < p; T++) {
      let B = (((T + 0.5) / p - 0.5) * v) / L,
        G = ((D + 0.5) / m - 0.5) / L,
        _ = (B * I - G * E) * N,
        z = (B * E + G * I) * N;
      for (let V = 0; V < 4; V++) k[V] = Ft(_ * 3.7 + M + d[0], z * 3.7 + S + d[1], V);
      for (let V = 0; V < 4; V++)
        O[V] = Ft(_ * 11.8 + M + k[0] * 1.7 + d[2], z * 11.8 + S + k[1] * 1.7 + d[3], V);
      for (let V = 0; V < 4; V++)
        P[V] = Ft(_ * 43 + M + O[0] * 0.8 + d[0] * 0.35, z * 43 + S + O[1] * 0.8 + d[1] * 0.35, V);
      let Y = ((k[0] - 0.5) * 0.44 + (O[0] - 0.5) * 0.16 + (P[0] - 0.5) * 0.027) * A,
        Z = ((k[1] - 0.5) * 0.44 + (O[1] - 0.5) * 0.16 + (P[1] - 0.5) * 0.027) * A,
        Q = Ft(B * $ + 71, G * $ + 13, 1),
        K = (Ft(B * F + 37, G * F + 89, 0) - 0.5) * 0.68 + (Q - 0.5) * 0.32,
        J = Math.max(
          0.15,
          1 + ((K * l.granulation) / 100) * 0.85 + (((P[1] - 0.5) * l.granulation) / 100) * 0.32,
        ),
        te = 0,
        H = 0,
        j = 0;
      for (let V = 0; V < u.length; V++) {
        let X = u[V],
          ne = _ + Y - X.x,
          he = z + Z - X.y,
          fe = (ne * X.c - he * X.s) / X.rx,
          ve = (ne * X.s + he * X.c) / X.ry,
          ge = Math.sqrt(fe * fe + ve * ve) + (P[2] - 0.5) * 0.08;
        if (ge > 1 + y + 0.08) continue;
        let Oe = 1 - Sa(1 - y, 1 + y, ge),
          Le = 0.55 + k[V % 2 ? 3 : 2] * 0.8 + (O[2] - 0.5) * 0.34,
          Ge =
            ((Math.exp(-(((ge - (0.97 - y * 0.28)) / C) ** 2)) * l.edges) / 100) *
            (0.12 + O[3] * 0.45) *
            (1 - x * 0.45),
          Re = fe - X.bloom[0],
          ha = ve - X.bloom[1],
          Sn = 0.2 + (l.blooms / 100) * (0.32 + X.bloom[2]),
          fa = Math.sqrt(Re * Re + ha * ha) + (O[3] - 0.5) * 0.42 + (P[3] - 0.5) * 0.13,
          wr = ((1 - Sa(Sn - 0.09, Sn + 0.08, fa)) * l.blooms) / 100,
          Mr = ((Math.exp(-(((fa - Sn - 0.045) / 0.036) ** 2)) * l.blooms) / 100) * 0.33,
          wn =
            (((Oe * Le * (1 - wr * 0.78) + Ge + Mr * Oe) * J * X.strength * l.pigment) / 100) *
            1.05;
        ((te += X.color[0] * wn), (H += X.color[1] * wn), (j += X.color[2] * wn));
      }
      let U =
          1 +
          ((K * l.texture) / 100) * 0.095 +
          (((Ft(B * $ + 71, G * $ + 13, 2) - 0.5) * l.texture) / 100) * 0.026,
        W = (D * p + T) * 4;
      ((g.data[W] = R[0] * Math.exp(-te) * U * 255),
        (g.data[W + 1] = R[1] * Math.exp(-H) * U * 255),
        (g.data[W + 2] = R[2] * Math.exp(-j) * U * 255),
        (g.data[W + 3] = 255));
    }
  (h.putImageData(g, 0, 0), (Ma = b), e.drawImage(f, 0, 0, t, n));
}

function vs(e) {
  return Array.from({ length: Math.max(0, e - 1) }, (t, n) => (n + 1) / e);
}

function Ut(e, t) {
  if (e <= 1) return [50];
  let a = [0, ...(t && t.length === e - 1 ? t : vs(e)), 1];
  return Array.from({ length: e }, (o, s) => ((a[s] + a[s + 1]) / 2) * 100);
}

var ae = 20.75;

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
  Nt(
    ctx,
    W,
    H,
    stops,
    recipe.params ?? void 0,
    recipe.divs ?? void 0,
    interactive ? "interactive" : "preview",
    t - ae,
  );
}

function backgroundCss(recipe) {
  return or(recipe.stops, "WATERCOLOR", recipe.divs ?? void 0, recipe.mesh, recipe.cube ?? void 0);
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
    return fit(dw, dh, 720, true);
  }
  return fit(dw, dh, 1600, true);
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

window.AkvarelBg = { mount: mountGradient, render: render };
})();
