# CPU Scheduling Simulator
### Round Robin vs Preemptive Priority Scheduling
**OS Project C3 — Algorithm Comparison**

---

## 🚀 How to Run

No installation. No setup. No internet required.

```
1. Download  cpu-scheduler.html
2. Double-click it
3. It opens in your browser — done
```

Works on Chrome, Firefox, Edge, and Safari.

---

## 🗺️ Page Layout — What You See

```
┌─────────────────────────────────────────────┐
│  Top Bar — logo + dark mode toggle          │
├─────────────────────────────────────────────┤
│  Hero — title                               │
├─────────────────────────────────────────────┤
│  Preset Scenarios — A B C D E              │
├─────────────────────────────────────────────┤
│  Process Configuration                      │
│    • Time Quantum input                     │
│    • Process table (ID / AT / BT / PR)      │
│    • Add Process / Clear All                │
├─────────────────────────────────────────────┤
│  ▶ Show Round Robin Results                 │
│  ▶ Show Priority Results                    │
│  ⚖ Compare Both Algorithms  (unlocks after  │
│     both results are shown)                 │
├─────────────────────────────────────────────┤
│  🔄 Round Robin Results (shown on demand)   │
│    Gantt Chart                              │
│    Completion Time  |  TAT  |  WT  |  RT   │
├─────────────────────────────────────────────┤
│  ⚡ Priority Results  (shown on demand)     │
│    Gantt Chart                              │
│    Completion Time  |  TAT  |  WT  |  RT   │
├─────────────────────────────────────────────┤
│  Comparison Analysis  (shown on demand)     │
│  Conclusion           (shown on demand)     │
└─────────────────────────────────────────────┘
```

---

## 📋 Step-by-Step Usage

### Step 1 — Load a Scenario or Enter Your Own Data

**Option A — Use a preset scenario:**

Click one of the five buttons at the top:

| Button | What it tests |
|--------|--------------|
| **A — Normal** | Balanced mixed workload, different burst times and priorities |
| **B — Urgency** | Two processes with priority 1 preempt everything else |
| **C — Fairness** | All processes have equal priority — RR shines here |
| **D — Starvation** | One process with priority 5 risks being starved |
| **E — Invalid** | Broken input — click Run to see validation in action |

When you click a scenario button, the table fills automatically with the preset data and the Time Quantum is set for you.

**Option B — Enter your own processes:**

Fill the table manually. Each row is one process:

| Field | What to enter | Rules |
|-------|--------------|-------|
| **Process ID** | Any name: P1, TaskA, Job3 | Must be unique, max 10 chars |
| **Arrival Time** | When the process arrives | Integer ≥ 0 |
| **Burst Time** | How long it needs the CPU | Integer > 0 |
| **Priority** | Importance level | Integer ≥ 1 · Lower = more important |

> **Priority Rule:** `1` is the highest priority. `5` beats `10`. Lower number always wins.

Use **+ Add Process** to add rows. Use **✕** on any row to delete it.

---

### Step 2 — Set the Time Quantum

The **Time Quantum** field controls how long each process runs per turn in Round Robin.

```
Quantum = 3  →  each process gets 3 time units, then the next one goes
Quantum = 1  →  very fine-grained, maximum context switching
Quantum = 10 →  long slices, behaves closer to FCFS
```

> The quantum has **no effect** on Priority Scheduling. It only affects Round Robin.

---

### Step 3 — Run the Algorithms

You can run them in any order. They are independent.

#### ▶ Show Round Robin Results

Click this button to simulate Round Robin with your current input.

What appears below the button:
- **Gantt Chart** — colored bar showing which process ran at each time unit. Hover any block to see exact start/end times.
- **Completion Time** — when each process finished, plus the average
- **Turnaround Time (TAT = CT − AT)** — total time in system, plus average
- **Waiting Time (WT = TAT − BT)** — time spent waiting, plus average
- **Response Time (RT = First Start − AT)** — time until first CPU access, plus average

#### ▶ Show Priority Results

Same as above but runs Preemptive Priority Scheduling.

**What makes Priority different:**
- At every single time unit, the algorithm checks all arrived processes
- The one with the lowest priority number gets the CPU
- If a higher-priority process arrives mid-execution, it **immediately preempts** the current one
- **Aging is built in automatically:** any process that waits more than 10 units gets its effective priority improved by 1, preventing starvation — no configuration needed

---

### Step 4 — Compare

Once **both** result sections are visible, the Compare button activates:

```
⚖ Compare Both Algorithms
```

Click it to see:

**Comparison Analysis**
- Side-by-side avg WT / TAT / RT for both algorithms
- Green "✓ Better" badge on the winner of each metric
- Four analysis cards: Waiting Time, Response Time, Priority Advantage, Fairness
- Starvation alert (red if detected, green if not)

**Conclusion**
- Overall winner (based on most metrics won)
- Priority-Based Service analysis
- Fairness analysis
- Starvation risk assessment
- Recommendation: when to use each algorithm

---

## 📊 Understanding the Metrics

| Metric | Formula | What it means |
|--------|---------|--------------|
| **CT** — Completion Time | clock time when done | When did this process finish? |
| **TAT** — Turnaround Time | `CT − Arrival Time` | How long was it in the system total? |
| **WT** — Waiting Time | `TAT − Burst Time` | How long did it wait doing nothing? |
| **RT** — Response Time | `First Start − Arrival Time` | How long until it first touched the CPU? |

> All four metrics: **lower is better.**

The average row (shown in green) is the key number for comparing algorithms.

---

## 🔬 How Each Algorithm Works

### 🔄 Round Robin

```
Ready Queue: [P1, P2, P3, P4]
Quantum = 3

Time 0:  P1 runs for 3 units → not done → goes back to queue end
Time 3:  P2 runs for 3 units → done → removed
Time 6:  P3 runs for 3 units → not done → goes back
Time 9:  P4 runs for 3 units → done → removed
Time 12: P1 runs again ...
```

**Key property:** Every process gets exactly `quantum` units per turn. No process can run for longer without giving others a chance. Completely **ignores priority**.

---

### ⚡ Preemptive Priority Scheduling

```
Priority rule: lower number = higher priority (1 is highest)

Time 0:  P1 (priority 3) starts running
Time 1:  P2 arrives with priority 1 → immediately preempts P1
Time 1:  P2 runs until done
Time 7:  P3 arrives with priority 1 → preempts whoever is running
...
```

**Key property:** The most important process always runs. Lower-priority work waits until nothing more important is available.

**Aging (automatic, invisible):**
Every 10 time units a process waits continuously, its effective priority improves by 1. This prevents any process from waiting forever — it will eventually become the highest priority available.

```
Example:
P5 has priority 5, has been waiting 30 units
→  effective priority = 5 − floor(30/10) = 5 − 3 = 2
→  now competes with priority-2 processes
```

---

## 🧪 Test Scenarios Explained

### Scenario A — Normal Workload
**Purpose:** See how both algorithms handle a typical mixed load.
**What to look for:** Which algorithm gives lower average WT? Does priority affect execution order noticeably?

```
P1: AT=0  BT=8  Priority=3
P2: AT=1  BT=4  Priority=2
P3: AT=2  BT=9  Priority=4
P4: AT=3  BT=5  Priority=1  ← highest priority
P5: AT=4  BT=2  Priority=3
Quantum = 3
```

---

### Scenario B — Urgency Case
**Purpose:** Show how Priority Scheduling favors urgent processes.
**What to look for:** P2 and P3 (priority 1) should finish with very low WT and RT in Priority mode. Round Robin treats them the same as P1.

```
P1: AT=0  BT=10  Priority=5  ← lowest priority
P2: AT=1  BT=6   Priority=1  ← tied for highest
P3: AT=2  BT=8   Priority=1  ← tied for highest
P4: AT=3  BT=4   Priority=2
P5: AT=5  BT=5   Priority=4
Quantum = 4
```

---

### Scenario C — Fairness Case
**Purpose:** Show Round Robin's perfect fairness when all processes are equal.
**What to look for:** In Round Robin, all four processes should have identical WT. In Priority, they run sequentially (like FCFS) — clearly unfair.

```
P1: AT=0  BT=6  Priority=2
P2: AT=0  BT=6  Priority=2
P3: AT=0  BT=6  Priority=2
P4: AT=0  BT=6  Priority=2
Quantum = 2
```

---

### Scenario D — Starvation Case
**Purpose:** Demonstrate that low-priority processes suffer in Priority Scheduling.
**What to look for:** P5 (priority 5) must wait for all priority-1 processes to complete before it runs. Aging kicks in after 10 units — watch if it gets its priority improved.

```
P1: AT=0  BT=4  Priority=1
P2: AT=1  BT=3  Priority=1
P3: AT=2  BT=5  Priority=1
P4: AT=3  BT=2  Priority=1
P5: AT=4  BT=7  Priority=5  ← at risk of starvation
Quantum = 3
```

---

### Scenario E — Invalid Input
**Purpose:** Test the validation system.
**What to look for:** Click either Run button. The simulator should reject the input and show a specific error message. No simulation runs.

```
Problems in this scenario:
• Duplicate ID "P1" (appears twice)
• Negative Burst Time (-3)
• Empty Process ID
• Time Quantum = 0
```

---

## ⚠️ Validation Rules

The simulator rejects invalid input **before** running. Error messages tell you exactly what is wrong.

| What is rejected | Why |
|-----------------|-----|
| No processes at all | Nothing to simulate |
| Quantum ≤ 0 | Round Robin needs a positive quantum |
| Quantum not a whole number | Must be integer |
| Empty fields | All four fields required per process |
| Duplicate Process IDs | Each process must be identifiable |
| Arrival Time < 0 | Processes cannot arrive before time 0 |
| Burst Time ≤ 0 | A process must need at least 1 unit |
| Priority < 1 | Minimum priority value is 1 |
| Non-integer values | All fields must be whole numbers |

---

## 🌙 Dark Mode

Click the **🌙 Dark** button in the top-right corner to switch to dark mode. Your preference is saved automatically and restored next time you open the file.

---

## 📁 Project Files

| File | Purpose |
|------|---------|
| `cpu-scheduler.html` | The simulator — open this in any browser |
| `project-report.docx` | Full written report with results and analysis |
| `js-explanation.md` | JavaScript code explained function by function |
| `js-explanation.txt` | Same explanation in plain text |
| `project-guide.txt` | Detailed usage guide |
| `README.md` | This file |

---

## 🔑 Key Differences at a Glance

| | Round Robin | Priority Scheduling |
|--|------------|-------------------|
| **How it picks next process** | First in queue (FIFO) | Lowest priority number |
| **Uses priority?** | ❌ No | ✅ Yes — core rule |
| **Fairness** | ✅ High — equal turns | ❌ Low — urgent first |
| **Starvation risk** | ✅ None | ⚠️ Yes (mitigated by aging) |
| **Best for** | General OS, time-sharing | Real-time, critical systems |
| **Quantum matters?** | ✅ Yes — critical setting | ❌ No effect |

---

> **Priority Rule used throughout:** Lower number = Higher priority. Priority `1` is the most important. Equal priorities are broken by earlier arrival time.
