# Problem brief: Ẹ̀rí ("witness, proof")

**Challenge:** Every Vote, Every Voice · **Live demo:** https://eri-hackathon.netlify.app

## The link we chose

**What happens to a result after it leaves the polling unit.**

A Nigerian result is first written on the EC8A sheet at the polling unit, in front of agents and voters. It is then
read out and added up again at the ward (EC8B), the LGA (EC8C) and the state (EC8D) before it is declared (EC8E).
Between the wall at the polling unit and the final announcement, nobody outside the collation room can check that
the numbers still match what was counted.

## Why it matters

- **Trust breaks here.** People photograph the sheet on the wall, then weeks later hear a total they cannot connect to it.
  When a number changes, nobody can prove where or when.
- **Rumours move faster than proof.** A forwarded photo of a "result sheet" spreads in minutes. Checking it takes a lawyer or a party.
- **The evidence is scattered.** Photos sit on phones, agents' notes on paper, and collation read-outs only in the room.
  By the time a petition is filed, it is hard to rebuild what each hop said.
- **It is checkable.** Every hop is a sum of the hop below. If a ward announces more than its polling units posted,
  the arithmetic exposes it, with no guessing about who is right.

## Who it affects

| Person | Their problem today | What Ẹ̀rí gives them |
|---|---|---|
| **Voter / citizen** (Amaka) | Saw the result on the wall, cannot tell if it was counted | Type the polling-unit code: see the evidence, what was announced next, and whether they match |
| **Witness / party agent** | Their sheet is the only proof, and it goes unseen after they leave | Submit the EC8A by SMS, photo or form; get an alert in their own language if the number changes |
| **Observer / civil society** | Cannot follow the numbers live across a collation centre | Proof Tree and Live Ear: spoken figures become a live, hop-by-hop check |
| **Lawyer / tribunal** | Evidence is hard to assemble | A one-click evidence pack (figures, witnesses, photos, timeline) |

It works for **basic phones** (SMS over 2G, USSD `*347*PU#`), **voters who don't read English** (alerts in English, Pidgin,
Hausa, Yorùbá, Igbo, plus an optional voice call) and **poor networks** (a short SMS with a checksum, no app, no data).

## What we built (core feature)

**The Proof Tree.** Witness figures for each polling unit are combined (the biggest agreeing group wins; disagreement is shown as
*Contested*). Each hop above is compared with the sum of what is witnessed below it. A hop is **Traced**, **Partly proven**,
**Contested** or **Flagged**. When a collation read-out differs from a witnessed sheet, or a ward announces more than its
units posted and the extra cannot come from unwitnessed units, the witnesses are alerted and the public trail shows it.

**Example in the prototype (fictional figures):** PU 034's witnessed APC count is 175 but it is read out at ward collation as 225.
Ward 04 announces APC 3,120 while its 10 witnessed units total 1,880: **+1,240 unexplained**. The witnesses at that polling unit are alerted by SMS.

## What it is not

It does not declare, predict or rank results. Every public page carries the "Unofficial, INEC declares the official result"
notice. It complements INEC's IReV and citizen platforms such as E Don Kast; it does not replace them.

## Scale

The Abuja Municipal prototype covers 1 LGA, 4 wards and 40 polling units. Nigeria has about 176,000 polling units. The design is
per polling unit and per hop, so coverage grows by adding witnesses and partner observers, with no change to the method.
