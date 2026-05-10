/* ── Colors ── */
const COLORS = [
  '#6366f1',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#0ea5e9',
];
const getColor = i => COLORS[i % COLORS.length];
const buildColorMap = ps => {
  const m = {};
  ps.forEach ((p, i) => (m[p.id] = getColor (i)));
  return m;
};

/* ── Validation ── */
function validate (rows, quantum) {
  if (!rows || rows.length === 0)
    return {ok: false, msg: 'Add at least one process.'};
  const q = Number (quantum);
  if (quantum === '' || isNaN (q) || !isFinite (q))
    return {ok: false, msg: 'Time Quantum must be a valid number.'};
  if (q <= 0 || !Number.isInteger (q))
    return {ok: false, msg: 'Time Quantum must be a positive integer (> 0).'};
  const seen = new Set ();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], n = i + 1;
    if (r.id === '' || r.at === '' || r.bt === '' || r.pr === '')
      return {ok: false, msg: `Process #${n}: all fields are required.`};
    const id = r.id.trim ();
    if (id === '')
      return {ok: false, msg: `Process #${n}: ID cannot be blank.`};
    if (seen.has (id.toLowerCase ()))
      return {ok: false, msg: `Duplicate ID: "${id}". Each ID must be unique.`};
    seen.add (id.toLowerCase ());
    const at = Number (r.at);
    if (isNaN (at) || !Number.isInteger (at) || at < 0)
      return {
        ok: false,
        msg: `"${id}": Arrival Time must be a non-negative integer.`,
      };
    const bt = Number (r.bt);
    if (isNaN (bt) || !Number.isInteger (bt) || bt <= 0)
      return {
        ok: false,
        msg: `"${id}": Burst Time must be a positive integer.`,
      };
    const pr = Number (r.pr);
    if (isNaN (pr) || !Number.isInteger (pr) || pr < 1)
      return {ok: false, msg: `"${id}": Priority must be an integer >= 1.`};
  }
  return {ok: true, msg: ''};
}
const parseRows = rows =>
  rows.map (r => ({
    id: r.id.trim (),
    arrivalTime: parseInt (r.at, 10),
    burstTime: parseInt (r.bt, 10),
    priority: parseInt (r.pr, 10),
  }));

/* ── Round Robin ── */
function roundRobin (processes, quantum) {
  const ps = processes.map (p => ({
    ...p,
    rem: p.burstTime,
    firstStart: -1,
    completion: 0,
    done: false,
  }));
  const byArr = [...ps].sort ((a, b) => a.arrivalTime - b.arrivalTime);
  const queue = [], gantt = [];
  let time = 0, arrived = 0, finished = 0;
  const enqueue = () => {
    while (arrived < byArr.length && byArr[arrived].arrivalTime <= time) {
      queue.push (byArr[arrived]);
      arrived++;
    }
  };
  enqueue ();
  if (queue.length === 0 && arrived < byArr.length) {
    time = byArr[0].arrivalTime;
    enqueue ();
  }
  while (finished < ps.length) {
    if (queue.length === 0) {
      time = byArr[arrived].arrivalTime;
      enqueue ();
      continue;
    }
    const cur = queue.shift ();
    if (cur.firstStart === -1) cur.firstStart = time;
    const slice = Math.min (quantum, cur.rem);
    const bs = time;
    time += slice;
    cur.rem -= slice;
    gantt.push ({id: cur.id, start: bs, end: time});
    enqueue ();
    if (cur.rem === 0) {
      cur.completion = time;
      cur.done = true;
      finished++;
    } else queue.push (cur);
  }
  return {gantt, procs: ps.map (calcMetrics)};
}

/* ── Preemptive Priority ── */
/* Aging constants — invisible to the user, automatic in the background.
   AGING_INTERVAL : every this many wait-units a process gets its priority improved by 1
   AGING_MIN      : priority cannot go below this value (1 = highest, so floor is 1)       */
const AGING_INTERVAL = 10;
const AGING_MIN = 1;

function preemptivePriority (processes) {
  /* Deep copy. Each process gets:
     rem          → remaining burst time
     firstStart   → clock tick of first CPU access (-1 = not yet started)
     completion   → clock tick when fully done
     done         → boolean
     effectivePr  → working priority (starts equal to original, aging lowers it over time)
     waitedSince  → the time unit when this process last stopped running (for aging calc) */
  const ps = processes.map (p => ({
    ...p,
    rem: p.burstTime,
    firstStart: -1,
    completion: 0,
    done: false,
    effectivePr: p.priority,
    waitedSince: p.arrivalTime, // starts counting wait from arrival
  }));

  const raw = [];
  let time = Math.min (...ps.map (p => p.arrivalTime));
  let finished = 0;

  while (finished < ps.length) {
    /* ── collect processes that have arrived and are not done ── */
    const avail = ps.filter (p => p.arrivalTime <= time && !p.done);

    if (avail.length === 0) {
      /* CPU idle — jump to next arrival */
      time = ps
        .filter (p => !p.done)
        .reduce ((mn, p) => Math.min (mn, p.arrivalTime), Infinity);
      continue;
    }

    /* ── AGING: improve effectivePr for every waiting process ──
       For each process that is available but not currently chosen yet,
       we check how long it has been waiting without running.
       Every AGING_INTERVAL units of continuous waiting → effectivePr -= 1
       (lower number = higher priority, so subtracting = improvement).
       effectivePr cannot go below AGING_MIN (= 1).                       */
    avail.forEach (p => {
      const waitDuration = time - p.waitedSince;
      const agingSteps = Math.floor (waitDuration / AGING_INTERVAL);
      const improved = Math.max (AGING_MIN, p.priority - agingSteps);
      p.effectivePr = improved;
    });

    /* ── select highest effective priority; tie-break by original arrival ── */
    avail.sort (
      (a, b) =>
        a.effectivePr !== b.effectivePr
          ? a.effectivePr - b.effectivePr // lower effectivePr = higher priority
          : a.arrivalTime - b.arrivalTime // earlier arrival breaks tie
    );

    const cur = avail[0];

    /* record first CPU access */
    if (cur.firstStart === -1) cur.firstStart = time;

    /* reset waitedSince for the running process — it is no longer waiting */
    cur.waitedSince = time + 1;

    /* all OTHER available processes keep accumulating wait — nothing to reset */

    /* run for 1 unit */
    raw.push ({id: cur.id, start: time, end: time + 1});
    time++;
    cur.rem--;

    if (cur.rem === 0) {
      cur.completion = time;
      cur.done = true;
      finished++;
    }
  }

  /* ── merge consecutive same-process blocks into one Gantt bar ── */
  const gantt = [];
  if (raw.length > 0) {
    let cur = {...raw[0]};
    for (let i = 1; i < raw.length; i++) {
      if (raw[i].id === cur.id && raw[i].start === cur.end) {
        cur.end = raw[i].end;
      } else {
        gantt.push (cur);
        cur = {...raw[i]};
      }
    }
    gantt.push (cur);
  }

  return {gantt, procs: ps.map (calcMetrics)};
}

function calcMetrics (p) {
  const tat = p.completion - p.arrivalTime;
  const wt = tat - p.burstTime;
  const rt = p.firstStart - p.arrivalTime;
  return {...p, tat, wt, rt};
}
const avg = (arr, key) =>
  +(arr.reduce ((s, p) => s + p[key], 0) / arr.length).toFixed (2);

/* ── Render Gantt ── */
function renderGantt (gId, tId, lId, blocks, cmap) {
  const gc = document.getElementById (gId),
    tc = document.getElementById (tId),
    lc = document.getElementById (lId);
  gc.innerHTML = '';
  tc.innerHTML = '';
  lc.innerHTML = '';
  if (!blocks.length) {
    gc.textContent = 'No data.';
    return;
  }
  const total = blocks[blocks.length - 1].end;
  const first = blocks[0].start;
  if (first > 0) {
    const b = document.createElement ('div');
    b.className = 'gblk idle';
    b.style.width = first / total * 100 + '%';
    b.title = `Idle: 0 to ${first}`;
    b.innerHTML = '<span class="gblk-lbl">Idle</span>';
    gc.appendChild (b);
  }
  blocks.forEach ((blk, i) => {
    const dur = blk.end - blk.start, w = dur / total * 100;
    const b = document.createElement ('div');
    b.className = 'gblk';
    b.style.width = w + '%';
    b.style.background = cmap[blk.id] || '#888';
    b.style.transitionDelay = i * 28 + 'ms';
    b.title = `${blk.id}: ${blk.start} to ${blk.end} (${dur} units)`;
    b.innerHTML = `<span class="gblk-lbl">${blk.id}</span>`;
    gc.appendChild (b);
  });
  requestAnimationFrame (() =>
    requestAnimationFrame (() =>
      gc.querySelectorAll ('.gblk').forEach (b => b.classList.add ('on'))
    )
  );
  const pts = new Set ();
  if (first > 0) pts.add (0);
  blocks.forEach (b => {
    pts.add (b.start);
    pts.add (b.end);
  });
  [...pts].sort ((a, b) => a - b).forEach (t => {
    const s = document.createElement ('span');
    s.className = 'tick';
    s.style.left = t / total * 100 + '%';
    s.textContent = t;
    tc.appendChild (s);
  });
  const seen = new Set ();
  blocks.forEach (b => {
    if (seen.has (b.id)) return;
    seen.add (b.id);
    const it = document.createElement ('div');
    it.className = 'leg-item';
    it.innerHTML = `<div class="leg-dot" style="background:${cmap[b.id]}"></div>${b.id}`;
    lc.appendChild (it);
  });
}

/* ── Render Metrics Breakdown ──
   Sections: Completion Time / Turnaround Time / Waiting Time / Response Time
   Each section: header row with process IDs + "Average", data row with values
*/
function renderMetrics (containerId, procs, cmap, mvClass) {
  const cont = document.getElementById (containerId);
  const sorted = [...procs].sort ((a, b) =>
    a.id.localeCompare (b.id, undefined, {numeric: true})
  );

  function section (title, key, decimals) {
    const vals = sorted.map (p => parseFloat (p[key].toFixed (decimals)));
    const avgVal = (vals.reduce ((s, v) => s + v, 0) / vals.length).toFixed (
      decimals
    );
    let headers = '<th>Metric</th>';
    sorted.forEach (p => {
      headers += `<th><span class="pid-badge" style="background:${cmap[p.id]}">${p.id}</span></th>`;
    });
    headers += '<th>Average</th>';
    let cells = `<td>${title}</td>`;
    vals.forEach (v => {
      cells += `<td class="${mvClass} mv">${v}</td>`;
    });
    cells += `<td class="mv mv-avg">${avgVal}</td>`;
    return `<div class="mb-section">
      <div class="mb-header">${title}</div>
      <table class="mb-table">
        <thead><tr>${headers}</tr></thead>
        <tbody><tr>${cells}</tr></tbody>
      </table>
    </div>`;
  }

  cont.innerHTML =
    section ('Completion Time', 'completion', 0) +
    section ('Turnaround Time (TAT = CT - AT)', 'tat', 0) +
    section ('Waiting Time (WT = TAT - BT)', 'wt', 0) +
    section ('Response Time (RT = First Start - AT)', 'rt', 0);
}

/* ── Comparison ── */
function renderComparison (rrPs, prPs, q) {
  const rr = {
    wt: avg (rrPs, 'wt'),
    tat: avg (rrPs, 'tat'),
    rt: avg (rrPs, 'rt'),
  };
  const pr = {
    wt: avg (prPs, 'wt'),
    tat: avg (prPs, 'tat'),
    rt: avg (prPs, 'rt'),
  };
  const bWT = rr.wt <= pr.wt ? 'RR' : 'PR',
    bTAT = rr.tat <= pr.tat ? 'RR' : 'PR',
    bRT = rr.rt <= pr.rt ? 'RR' : 'PR';

  function pill (lbl, rrV, prV, better, isRR) {
    const win = isRR ? better === 'RR' : better === 'PR';
    const val = isRR ? rrV : prV;
    return `<div class="mpill ${win ? 'win' : ''}"><span class="pill-lbl">${lbl}</span><span class="pill-val">${val}</span>${win ? '<span class="pill-badge">✓ Better</span>' : ''}</div>`;
  }

  const maxPr = Math.max (...prPs.map (p => p.priority));
  const lowPs = prPs.filter (p => p.priority === maxPr);
  const avgLowWT = lowPs.reduce ((s, p) => s + p.wt, 0) / lowPs.length;
  const starvation = avgLowWT > pr.wt * 2;
  const wtDiff = Math.abs (rr.wt - pr.wt).toFixed (2),
    rtDiff = Math.abs (rr.rt - pr.rt).toFixed (2);
  const minPr = Math.min (...prPs.map (p => p.priority));
  const highPs = prPs.filter (p => p.priority === minPr);
  const avgHighWT = (highPs.reduce ((s, p) => s + p.wt, 0) /
    highPs.length).toFixed (2);
  const wtWin = bWT === 'RR' ? 'Round Robin' : 'Priority',
    rtWin = bRT === 'RR' ? 'Round Robin' : 'Priority';

  document.getElementById ('cmpContent').innerHTML = `
    <div class="cmp-top">
      <div class="cmp-col rr">
        <h3>🔄 Round Robin (Q=${q})</h3>
        ${pill ('Avg Waiting Time', rr.wt, pr.wt, bWT, true)}
        ${pill ('Avg Turnaround', rr.tat, pr.tat, bTAT, true)}
        ${pill ('Avg Response Time', rr.rt, pr.rt, bRT, true)}
      </div>
      <div class="vs-div">VS</div>
      <div class="cmp-col pr">
        <h3>⚡ Preemptive Priority</h3>
        ${pill ('Avg Waiting Time', rr.wt, pr.wt, bWT, false)}
        ${pill ('Avg Turnaround', rr.tat, pr.tat, bTAT, false)}
        ${pill ('Avg Response Time', rr.rt, pr.rt, bRT, false)}
      </div>
    </div>
    <div class="an-grid">
      <div class="an-card"><h4>⏳ Waiting Time</h4><p>${wtWin} achieved lower avg waiting time by ${wtDiff} units. ${bWT === 'RR' ? "Round Robin's time-sharing prevents long waits for any single process." : 'Priority scheduling completes urgent tasks faster, reducing their wait.'}</p></div>
      <div class="an-card"><h4>⚡ Response Time</h4><p>${rtWin} gave better avg response time by ${rtDiff} units. ${bRT === 'PR' ? 'High-priority processes get CPU immediately on arrival.' : 'Round Robin ensures every process gets CPU within one cycle.'}</p></div>
      <div class="an-card"><h4>🎯 Priority Advantage</h4><p>Highest-priority (priority ${minPr}) processes had avg WT=${avgHighWT} vs overall ${pr.wt}. ${parseFloat (avgHighWT) < pr.wt ? 'Preferential treatment clearly benefited urgent processes.' : 'Priority levels were close — advantage was minimal.'}</p></div>
      <div class="an-card"><h4>⚖ Fairness</h4><p>Round Robin distributes CPU in fixed ${q}-unit slices — no short-term starvation. Priority Scheduling may delay low-priority processes indefinitely if higher-priority work keeps arriving.</p></div>
    </div>
    <div class="st-box ${starvation ? 'st-danger' : 'st-ok'}">${starvation ? '⚠ Starvation Detected: Low-priority processes waited significantly longer than average. In a real system with continuous high-priority arrivals, they could wait indefinitely.' : '✓ No severe starvation detected. Starvation remains a theoretical risk in Priority Scheduling if high-priority processes continuously arrive.'}</div>`;

  renderConclusion (rr, pr, bWT, bTAT, bRT, starvation);
  return {
    rr,
    pr,
    bWT,
    bTAT,
    bRT,
    starvation,
    wtDiff,
    rtDiff,
    q,
    avgHighWT,
    minPr,
  };
}

function renderConclusion (rr, pr, bWT, bTAT, bRT, starvation) {
  const rrW = [bWT, bTAT, bRT].filter (x => x === 'RR').length;
  const prW = 3 - rrW,
    winner = rrW >= prW ? 'Round Robin' : 'Priority Scheduling',
    icon = rrW >= prW ? '🔄' : '⚡';
  document.getElementById ('concContent').innerHTML = `
    <div class="winner-box">${icon} <strong>${winner}</strong> performed better overall <span class="win-score">(${Math.max (rrW, prW)}/3 key metrics)</span></div>
    <div class="conc-list">
      <div class="c-pt"><span class="c-icon">📊</span><div><strong>Overall Performance</strong>${winner} achieved better results on ${Math.max (rrW, prW)} out of 3 metrics for this workload.</div></div>
      <div class="c-pt"><span class="c-icon">🎯</span><div><strong>Priority-Based Service</strong>${bRT === 'PR' ? 'Priority Scheduling improved urgent-task treatment. High-priority processes received CPU faster — ideal for real-time systems.' : 'For this workload, priority preemption did not significantly outperform Round Robin on response time.'}</div></div>
      <div class="c-pt"><span class="c-icon">⚖</span><div><strong>Fairness</strong>Round Robin provided more balanced service in fixed quantum slices. ${bWT === 'RR' ? 'This translated into better average waiting time.' : 'However, Priority urgency handling outweighed fairness benefits here.'}</div></div>
      <div class="c-pt"><span class="c-icon">${starvation ? '⚠' : '✅'}</span><div><strong>Starvation Risk</strong>${starvation ? 'Starvation was detected. Low-priority processes waited significantly longer. Aging mechanisms would be needed.' : 'No starvation observed. Priority Scheduling still carries inherent starvation risk with continuous high-priority arrivals.'}</div></div>
      <div class="c-pt"><span class="c-icon">💡</span><div><strong>Recommendation</strong>Use <strong>Round Robin</strong> for general-purpose OS and time-sharing systems where fairness matters. Use <strong>Priority Scheduling</strong> for real-time or critical systems where urgency is key.</div></div>
    </div>
    <div class="rule-note">Priority Rule: Lower number = Higher priority (1 = highest). Tie-break: Equal priority → earlier arrival time wins first.</div>`;
}

/* ── Global state ── */
let rrResult = null,
  prResult = null,
  colorMap = null,
  parsedProcs = null,
  currentQ = 3;

function getInputs () {
  const rows = Array.from (
    document.getElementById ('procBody').rows
  ).map (tr => {
    const ins = tr.querySelectorAll ('input');
    return {
      id: ins[0].value.trim (),
      at: ins[1].value.trim (),
      bt: ins[2].value.trim (),
      pr: ins[3].value.trim (),
    };
  });
  return {rows, quantum: document.getElementById ('quantum').value.trim ()};
}

function runRR () {
  hideErr ();
  const {rows, quantum} = getInputs ();
  const v = validate (rows, quantum);
  if (!v.ok) {
    showErr (v.msg);
    return;
  }
  parsedProcs = parseRows (rows);
  currentQ = parseInt (quantum, 10);
  colorMap = buildColorMap (parsedProcs);
  rrResult = roundRobin (parsedProcs, currentQ);
  renderGantt ('rrGantt', 'rrTicks', 'rrLegend', rrResult.gantt, colorMap);
  renderMetrics ('rrMetrics', rrResult.procs, colorMap, 'mv-rr');
  document.getElementById ('rrSection').classList.add ('show');
  checkReady ();
  setTimeout (
    () =>
      document
        .getElementById ('rrSection')
        .scrollIntoView ({behavior: 'smooth'}),
    50
  );
}

function runPR () {
  hideErr ();
  const {rows, quantum} = getInputs ();
  const v = validate (rows, quantum);
  if (!v.ok) {
    showErr (v.msg);
    return;
  }
  parsedProcs = parseRows (rows);
  currentQ = parseInt (quantum, 10);
  colorMap = buildColorMap (parsedProcs);
  prResult = preemptivePriority (parsedProcs);
  renderGantt ('prGantt', 'prTicks', 'prLegend', prResult.gantt, colorMap);
  renderMetrics ('prMetrics', prResult.procs, colorMap, 'mv-pr');
  document.getElementById ('prSection').classList.add ('show');
  checkReady ();
  setTimeout (
    () =>
      document
        .getElementById ('prSection')
        .scrollIntoView ({behavior: 'smooth'}),
    50
  );
}

function runComparison () {
  if (!rrResult || !prResult) {
    showErr ('Please run both Round Robin and Priority results first.');
    return;
  }
  hideErr ();
  renderComparison (rrResult.procs, prResult.procs, currentQ);
  document.getElementById ('cmpSection').classList.add ('show');
  setTimeout (
    () =>
      document
        .getElementById ('cmpSection')
        .scrollIntoView ({behavior: 'smooth'}),
    50
  );
}

function checkReady () {
  if (rrResult && prResult)
    document.getElementById ('cmpBtn').classList.add ('ready');
}

/* ── DOM Helpers ── */
let rowCount = 0;
function addRow (id = '', at = '0', bt = '', pr = '') {
  rowCount++;
  const pid = id || `P${rowCount}`;
  const body = document.getElementById ('procBody');
  const tr = document.createElement ('tr');
  tr.innerHTML = `<td><input class="pi pid-inp" type="text" value="${pid}" maxlength="10" placeholder="P${rowCount}"/></td><td><input class="pi" type="number" value="${at}" min="0" placeholder="0"/></td><td><input class="pi" type="number" value="${bt}" min="1" placeholder="1"/></td><td><input class="pi" type="number" value="${pr}" min="1" placeholder="1"/></td><td><button class="del-btn" onclick="delRow(this)">✕</button></td>`;
  body.appendChild (tr);
}
function delRow (btn) {
  const body = document.getElementById ('procBody');
  if (body.rows.length <= 1) {
    showErr ('At least one process is required.');
    return;
  }
  const tr = btn.closest ('tr');
  tr.style.opacity = '0';
  tr.style.transition = 'opacity .2s';
  setTimeout (() => tr.remove (), 210);
}
function clearAll () {
  document.getElementById ('procBody').innerHTML = '';
  rowCount = 0;
  addRow ();
  hideErr ();
  ['rrSection', 'prSection'].forEach (id =>
    document.getElementById (id).classList.remove ('show')
  );
  document.getElementById ('cmpSection').classList.remove ('show');
  document.getElementById ('cmpBtn').classList.remove ('ready');
  rrResult = null;
  prResult = null;
}
function showErr (msg) {
  const el = document.getElementById ('errBanner');
  el.innerHTML = '⚠ ' + msg;
  el.classList.add ('show');
  el.scrollIntoView ({behavior: 'smooth', block: 'nearest'});
}
function hideErr () {
  document.getElementById ('errBanner').classList.remove ('show');
}

/* ── Scenarios ── */
const SC = {
  A: {
    desc: 'A balanced mixed workload with processes arriving at different times.',
    q: 3,
    ps: [
      {id: 'P1', at: 0, bt: 8, pr: 3},
      {id: 'P2', at: 1, bt: 4, pr: 2},
      {id: 'P3', at: 2, bt: 9, pr: 4},
      {id: 'P4', at: 3, bt: 5, pr: 1},
      {id: 'P5', at: 4, bt: 2, pr: 3},
    ],
  },
  B: {
    desc: 'High-priority processes (P2, P3) preempt lower ones — urgency advantage clearly visible.',
    q: 4,
    ps: [
      {id: 'P1', at: 0, bt: 10, pr: 5},
      {id: 'P2', at: 1, bt: 6, pr: 1},
      {id: 'P3', at: 2, bt: 8, pr: 1},
      {id: 'P4', at: 3, bt: 4, pr: 2},
      {id: 'P5', at: 5, bt: 5, pr: 4},
    ],
  },
  C: {
    desc: 'All equal priorities — Round Robin distributes CPU time evenly showing maximum fairness.',
    q: 2,
    ps: [
      {id: 'P1', at: 0, bt: 6, pr: 2},
      {id: 'P2', at: 0, bt: 6, pr: 2},
      {id: 'P3', at: 0, bt: 6, pr: 2},
      {id: 'P4', at: 0, bt: 6, pr: 2},
    ],
  },
  D: {
    desc: 'P5 has lowest priority (5) — high-priority processes may starve it indefinitely in Priority Scheduling.',
    q: 3,
    ps: [
      {id: 'P1', at: 0, bt: 4, pr: 1},
      {id: 'P2', at: 1, bt: 3, pr: 1},
      {id: 'P3', at: 2, bt: 5, pr: 1},
      {id: 'P4', at: 3, bt: 2, pr: 1},
      {id: 'P5', at: 4, bt: 7, pr: 5},
    ],
  },
  E: {
    desc: 'Contains duplicate ID "P1", negative burst time, and Quantum=0. Click Run to see validation.',
    q: 0,
    ps: [
      {id: 'P1', at: 0, bt: 5, pr: 1},
      {id: 'P1', at: 2, bt: -3, pr: 2},
      {id: '', at: 1, bt: 4, pr: 0},
    ],
  },
};

function loadScenario (key) {
  const sc = SC[key];
  if (!sc) return;
  document.getElementById ('procBody').innerHTML = '';
  rowCount = 0;
  document.getElementById ('quantum').value = sc.q;
  sc.ps.forEach (p =>
    addRow (p.id, String (p.at), String (p.bt), String (p.pr))
  );
  const d = document.getElementById ('sc-desc');
  d.textContent = sc.desc;
  d.classList.add ('show');
  document
    .querySelectorAll ('.sc-btn')
    .forEach (b => b.classList.remove ('active'));
  document.getElementById (`sc-${key}`).classList.add ('active');
  hideErr ();
  ['rrSection', 'prSection'].forEach (id =>
    document.getElementById (id).classList.remove ('show')
  );
  document.getElementById ('cmpSection').classList.remove ('show');
  document.getElementById ('cmpBtn').classList.remove ('ready');
  rrResult = null;
  prResult = null;
}

/* ── Theme ── */
function toggleTheme () {
  const dark = document.body.classList.toggle ('dark');
  document.getElementById ('themeBtn').textContent = dark
    ? '☀ Light'
    : '🌙 Dark';
  try {
    localStorage.setItem ('simTheme', dark ? 'dark' : 'light');
  } catch (e) {}
}

/* ── Init ── */
(function () {
  try {
    if (localStorage.getItem ('simTheme') === 'dark') {
      document.body.classList.add ('dark');
      document.getElementById ('themeBtn').textContent = '☀ Light';
    }
  } catch (e) {}
  addRow ('P1', '0', '8', '3');
  addRow ('P2', '1', '4', '2');
  addRow ('P3', '2', '9', '4');
  addRow ('P4', '3', '5', '1');
}) ();
