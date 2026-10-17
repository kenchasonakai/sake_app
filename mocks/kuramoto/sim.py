"""岩瀬酒造 蔵元カードゲーム（仮）の簡易シミュレーター。
設計書の数字とルールをそのまま使い、単純な方針で自動プレイする。
方針は人間より下手なので、結果は数字の傾向を見るためのもの。"""
import random, statistics, sys, collections

RICES = ["山田錦", "五百万石", "総の舞", "きたしずく", "愛山"]
PRICE = {"山田錦": 2, "五百万石": 1, "総の舞": 1, "きたしずく": 1, "愛山": 1, "麹": 1, "酵母": 1}
DECK = {"山田錦": 8, "五百万石": 7, "総の舞": 5, "きたしずく": 5, "愛山": 3, "麹": 14, "酵母": 10}

# name: (needs, gauge, revenue, specialist, tags)
SAKES = {
    "i240五百万石": ({"五百万石": 1, "麹": 1, "酵母": 1}, 2, 6, "船頭", {"i240"}),
    "i240総の舞": ({"総の舞": 1, "麹": 1, "酵母": 1}, 2, 7, "船頭", {"i240"}),
    "i240愛山": ({"愛山": 1, "麹": 1, "酵母": 1}, 2, 8, "船頭", {"i240"}),
    "i240きたしずく": ({"きたしずく": 1, "麹": 1, "酵母": 1}, 2, 7, "船頭", {"i240"}),
    "山廃純米辛口": ({"ANY": 1, "麹": 1}, 4, 12, "酛屋", {"山廃"}),
    "i240山廃山田錦": ({"山田錦": 1, "麹": 1, "酵母": 1}, 4, 12, "酛屋", {"山廃", "i240"}),
    "山廃純米大吟醸": ({"山田錦": 2, "麹": 1}, 6, 18, "酛屋", {"山廃", "大吟醸"}),
    "中汲み": ({"山田錦": 3, "麹": 1}, 6, 22, "船頭", set()),
    "秘蔵古酒20年": ({"ANY": 1, "麹": 1}, 8, 22, "蔵守", {"古酒"}),
    "平和の調べ": ({"ANY": 2, "麹": 1}, 6, 16, "蔵守", {"古酒"}),
}
RECRUITS = ["蔵人"] * 6 + ["酛屋"] * 2 + ["船頭"] * 2 + ["蔵守"] * 2 + ["麹屋", "仕入れ係", "帳場", "営業"]
SPECIALISTS = {"酛屋", "船頭", "蔵守"}
ABILITIES = {"麹屋", "仕入れ係", "帳場", "営業"}
CONTRACT = {r: (2 if r == "蔵人" else 4) for r in set(RECRUITS)}

EVENTS = [  # (name, weight)
    ("サミット", 1), ("美酒", 1), ("燗酒", 1), ("パーカー", 1), ("クラファン", 1), ("南部", 2), ("海外", 2),
    ("雑誌", 2), ("豊作", 2), ("見学", 2), ("値上がり", 2), ("故障", 2), ("停電", 2), ("離職", 2), ("麹不良", 1),
    ("取材", 2), ("新米", 2), ("試飲会", 2),
]


class Game:
    def __init__(self, seed, policy, P):
        self.r = random.Random(seed)
        self.policy = policy
        self.P = P  # parameter overrides
        self.money = P["start_money"]
        self.turn = 0
        self.deck = [c for c, n in DECK.items() for _ in range(n)]
        self.r.shuffle(self.deck)
        self.discard = []
        self.hand = [self.draw1() for _ in range(3)]
        self.rdeck = RECRUITS[:]
        self.r.shuffle(self.rdeck)
        self.rdiscard = []
        self.field = [self.rdeck.pop() for _ in range(3)]
        self.hired = [("蔵人", 0), ("蔵人", 0)]  # (role, hired_turn) ; initial ones turn 0
        self.brew = []  # list of [name, filled]
        self.ships = collections.Counter()
        self.buff = None  # (kind, value, cond)
        self.rice_up = 0
        self.bankrupt = None
        self.log_first_ship = None
        self.revenue_total = 0

    # --- cards
    def draw1(self):
        if not self.deck:
            if not self.discard:
                return None
            self.deck = self.discard
            self.discard = []
            self.r.shuffle(self.deck)
        return self.deck.pop()

    def roles(self):
        return [h[0] for h in self.hired]

    def has(self, role):
        return role in self.roles()

    def price(self, c):
        p = PRICE[c]
        if self.rice_up > 0 and c in RICES:
            p *= 2
        return p

    # --- materials planning
    def plan_pay(self, name, hand, koji_free):
        """手札から払えるか。払う札のリストと、足りない札（買う必要）を返す。"""
        needs = dict(SAKES[name][0])
        if koji_free and needs.get("麹"):
            needs["麹"] -= 1
        h = hand[:]
        pay, missing = [], []
        for k in ["麹", "酵母", "山田錦", "五百万石", "総の舞", "きたしずく", "愛山"]:
            for _ in range(needs.get(k, 0)):
                if k in h:
                    h.remove(k); pay.append(k)
                else:
                    missing.append(k)
        for _ in range(needs.get("ANY", 0)):
            cand = [c for c in h if c in RICES]
            if cand:
                # 安い米から使う（山田錦は温存）
                cand.sort(key=lambda c: (c == "山田錦", c))
                h.remove(cand[0]); pay.append(cand[0])
            else:
                missing.append("五百万石")  # 一番安い米を買う
        return pay, missing

    def capacity_for(self, name):
        sp = SAKES[name][3]
        cap = 0
        for role in self.roles():
            if role == "蔵人":
                cap += 1
            elif role == sp:
                cap += 2
        return cap

    def total_capacity(self):
        return sum(1 if r == "蔵人" else 2 if r in SPECIALISTS else 0 for r in self.roles())

    def sale_value(self, name):
        n = self.ships[name]
        steps = [1.0, 0.8, 0.6]
        if self.has("営業"):
            steps = [1.0, 1.0, 0.8]
        return SAKES[name][2] * steps[min(n, 2)]

    # --- turn steps
    def event(self):
        names, weights = zip(*EVENTS)
        e = self.r.choices(names, weights)[0]
        self.temp_extra, self.temp_minus = 0, 0
        def set_buff(b):
            if self.buff is None:
                self.buff = b
        if e == "サミット": set_buff(("mult", 1.5, None))
        elif e == "美酒": set_buff(("mult", 1.5, "i240"))
        elif e == "燗酒": set_buff(("mult", 1.5, "山廃"))
        elif e == "パーカー": set_buff(("mult", 2.0, "大吟醸"))
        elif e == "クラファン": self.hand += ["麹", "山田錦"]
        elif e == "南部": self.temp_extra = 1
        elif e == "海外": self.money += 5
        elif e == "雑誌": set_buff(("add", 3, None))
        elif e == "豊作":
            for _ in range(2):
                c = self.draw1()
                if c: self.hand.append(c)
        elif e == "見学": self.money += 2
        elif e == "値上がり": self.rice_up = 3
        elif e == "故障":
            prog = [b for b in self.brew if b[1] > 0]
            if prog and self.money < 6:
                prog[0][1] -= 1
            elif self.money >= 2:
                self.money -= 2
            elif prog:
                prog[0][1] -= 1
        elif e == "停電": self.temp_minus = 1
        elif e == "離職":
            later = [h for h in self.hired if h[1] > 0]
            if later:
                last = max(later, key=lambda h: h[1])
                self.hired.remove(last)
                self.rdiscard.append(last[0])
        elif e == "麹不良":
            if "麹" in self.hand: self.hand.remove("麹"); self.discard.append("麹")
        elif e == "取材":
            if self.buff is None and self.total_capacity() >= 3:
                self.temp_minus = 1; self.buff = ("add", 4, None)
        elif e == "新米":
            if self.money >= self.reserve() + 3:
                self.money -= 3; self.hand += ["山田錦", "山田錦"]
        elif e == "試飲会":
            if self.buff is None and self.money >= self.reserve() + 2:
                self.money -= 2; self.buff = ("mult", 1.5, None)

    def reserve(self):
        return len(self.hired) * self.P["reserve_turns"]

    def hire(self):
        pol = self.policy
        if self.turn > self.P["hire_until"] or pol == "none":
            return
        def wants(role):
            if pol == "kurabito": return role == "蔵人"
            if pol == "spec": return role in SPECIALISTS or role == "蔵人"
            if pol == "spec_only": return role in SPECIALISTS
            if pol == "all": return True
            if pol == "abilities": return role in ABILITIES or role == "蔵人"
            if pol.startswith("only:"): return role == pol[5:] or role == "蔵人"
            return False
        refreshed = False
        while True:
            cands = [r for r in self.field if wants(r)]
            # 専門職を優先
            cands.sort(key=lambda r: (r == "蔵人",))
            done = False
            for role in cands:
                cost = CONTRACT[role]
                gain = 1 if role == "蔵人" else 2 if role in SPECIALISTS else 0
                if gain and self.total_capacity() + gain > self.P["target_cap"]:
                    continue
                if not gain and sum(1 for r in self.roles() if r in ABILITIES) >= self.P["max_abilities"]:
                    continue
                if self.money - cost >= self.reserve() + 1 + self.P["hire_buffer"]:
                    self.money -= cost
                    self.hired.append((role, self.turn))
                    self.field.remove(role)
                    if not self.rdeck:
                        self.rdeck = self.rdiscard; self.rdiscard = []; self.r.shuffle(self.rdeck)
                    if self.rdeck: self.field.append(self.rdeck.pop())
                    done = True
                    break
            if done:
                continue
            if not refreshed and not cands and pol not in ("none", "kurabito") and self.money >= self.reserve() + 6:
                self.money -= 1
                self.rdiscard += self.field
                self.field = []
                for _ in range(3):
                    if not self.rdeck:
                        self.rdeck = self.rdiscard; self.rdiscard = []; self.r.shuffle(self.rdeck)
                    if self.rdeck: self.field.append(self.rdeck.pop())
                refreshed = True
                continue
            break

    def start_and_buy(self):
        """買う（2枚まで）と仕込みを始める、を一緒に計画する。"""
        buys_left = 2
        free_buy = 1 if self.has("帳場") else 0
        koji_free = 1 if self.has("麹屋") else 0
        turns_left = self.P["turns"] - self.turn + 1
        while len(self.brew) < 3:
            in_brew = {b[0] for b in self.brew}
            best = None
            for name, (needs, gauge, rev, sp, tags) in SAKES.items():
                if name in in_brew:
                    continue
                cap = self.capacity_for(name)
                # 他の仕込み中の酒と人を分け合うので、控えめに見積もる
                share = max(1, len(self.brew) + 1)
                est = max(1.0, cap / share) if cap else 0
                if est == 0 or gauge > est * turns_left:
                    continue
                pay, missing = self.plan_pay(name, self.hand, koji_free)
                if len(missing) > buys_left:
                    continue
                cost = sum(self.price(c) for c in missing)
                if free_buy and missing:
                    cost -= max(self.price(c) for c in missing)
                if self.money - cost < self.reserve():
                    continue
                value = self.sale_value(name)
                import math
                turns_needed = math.ceil(gauge / est)
                score = (value - cost) / turns_needed
                if best is None or score > best[0]:
                    best = (score, name, pay, missing, cost)
            if best is None:
                break
            _, name, pay, missing, cost = best
            for c in pay:
                self.hand.remove(c); self.discard.append(c)
            if missing:
                self.money -= cost
                buys_left -= len(missing)
                if free_buy: free_buy = 0
            if koji_free and SAKES[name][0].get("麹"):
                koji_free = 0
            self.brew.append([name, 0])

    def place(self):
        workers = []
        for role in self.roles():
            if role == "蔵人" or role in SPECIALISTS:
                workers.append(role)
        workers += ["蔵人"] * self.temp_extra
        for _ in range(self.temp_minus):
            if "蔵人" in workers: workers.remove("蔵人")
            elif workers: workers.pop()
        rem = {b[0]: SAKES[b[0]][1] - b[1] for b in self.brew}
        specs = [w for w in workers if w in SPECIALISTS]
        kura = [w for w in workers if w == "蔵人"]
        for s in specs:
            targets = [n for n in rem if SAKES[n][3] == s and rem[n] > 0]
            if not targets:
                continue
            targets.sort(key=lambda n: (rem[n] < 2, rem[n]))
            n = targets[0]
            rem[n] -= min(2, rem[n])
        for _ in kura:
            targets = [n for n in rem if rem[n] > 0]
            if not targets:
                break
            targets.sort(key=lambda n: rem[n])
            rem[targets[0]] -= 1
        for b in self.brew:
            b[1] = SAKES[b[0]][1] - rem[b[0]]

    def ship(self):
        keep = []
        for b in self.brew:
            name, filled = b
            if filled >= SAKES[name][1]:
                v = self.sale_value(name)
                if self.buff:
                    kind, val, cond = self.buff
                    if cond is None or cond in SAKES[name][4]:
                        v = v * val if kind == "mult" else v + val
                        self.buff = None
                v = int(v)
                self.money += v
                self.revenue_total += v
                self.ships[name] += 1
                if self.log_first_ship is None:
                    self.log_first_ship = self.turn
            else:
                keep.append(b)
        self.brew = keep

    def play(self):
        for t in range(1, self.P["turns"] + 1):
            self.turn = t
            self.event()
            for _ in range(2 + (1 if self.has("仕入れ係") else 0)):
                c = self.draw1()
                if c: self.hand.append(c)
            self.hire()
            self.start_and_buy()
            self.place()
            income_before = self.money
            self.ship()
            # 手札上限
            while len(self.hand) > 5:
                pri = {"麹": 5, "山田錦": 4, "酵母": 3}
                self.hand.sort(key=lambda c: pri.get(c, 1))
                self.discard.append(self.hand.pop(0))
            salary = len(self.hired) * self.P["salary"]
            if self.money < salary:
                self.bankrupt = t
                return None
            self.money -= salary
            if self.rice_up > 0:
                self.rice_up -= 1
        return self.money


def run(policy, n=2000, **over):
    P = dict(start_money=12, turns=20, salary=1, reserve_turns=2, hire_until=12, hire_buffer=0, target_cap=6, max_abilities=4)
    P.update(over)
    scores, bk, first, hires = [], 0, [], collections.Counter()
    by_role = collections.defaultdict(list)
    for seed in range(n):
        g = Game(seed, policy, P)
        s = g.play()
        roles = set(r for r, _ in g.hired)
        if s is None:
            bk += 1
            continue
        scores.append(s)
        if g.log_first_ship: first.append(g.log_first_ship)
        for r in roles: by_role[r].append(s)
        for r, _ in g.hired: hires[r] += 1
    q = statistics.quantiles(scores, n=10) if len(scores) > 10 else [0]*9
    return {
        "policy": policy, "mean": round(statistics.mean(scores), 1) if scores else None,
        "p10": round(q[0]), "median": round(statistics.median(scores)) if scores else None, "p90": round(q[-1]),
        "bankrupt%": round(100 * bk / n, 1), "first_ship": round(statistics.mean(first), 1) if first else None,
        "avg_with_role": {r: round(statistics.mean(v), 1) for r, v in sorted(by_role.items()) if r != "蔵人"},
    }

if __name__ == "__main__":
    import json
    rows = []
    rows.append(run("none"))
    for cap in [3, 4, 6, 8]:
        rows.append(dict(run("kurabito", target_cap=cap), note=f"蔵人だけ 置ける力{cap}まで"))
    for role in ["船頭", "酛屋", "蔵守"]:
        rows.append(dict(run("only:" + role, target_cap=6), note=f"{role}と蔵人 置ける力6まで"))
    rows.append(dict(run("spec", target_cap=6), note="専門職と蔵人 置ける力6まで"))
    rows.append(dict(run("spec", target_cap=8), note="専門職と蔵人 置ける力8まで"))
    for ab in ["麹屋", "仕入れ係", "帳場", "営業"]:
        rows.append(dict(run("only:" + ab, target_cap=2, max_abilities=1), note=f"{ab}だけ足す"))
    for r in rows:
        r.pop("avg_with_role", None)
        print(r)
