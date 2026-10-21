# Spelling corrections for the in-review "(R)" questionnaires

**Status: done, live in production 2026-10-21** (list approved 2026-10-21; content issues left as is by decision).

Follow-up to `SPELLING_PLAN.md`, which only covered the 7 released questionnaires. The 19 in-review
questionnaires (`REVIEW_QUESTIONNAIRES_PLAN.md`) were seeded with only the generic spacing clean-up.

## Decisions (same as SPELLING_PLAN.md)

- Real typos, spacing/punctuation, clear grammar/word errors only. No changes to meaning, no rewrites of TM Forum wording.
- British/American spellings stay as in the source (fulfilment/fulfillment, behaviour, analyse).
- Placeholders such as "xyz"/"abc" (GB1529) and product names (VoLTE, WeChat, iOAM) stay unchanged.
- Sub-scenario names are never changed.
- Corrections go in `backend/prisma/seed/textCorrections.ts`, each scoped with `only:` to the questionnaire codes it fixes, so the 7 released questionnaires are unaffected.

## How the text was checked

- All 19 parsed questionnaires (1,450 text items, ~33,000 words, after the existing corrections) were checked against a dictionary
  and searched for spacing/punctuation patterns. The deduplicated text (~27,000 words) was also read in full for grammar and wrong-word errors.
- Every "Before" string below was checked to occur in its questionnaire: 231 distinct fixes, 347 occurrences in total.

## Not corrected: content issues in the source (your call)

These are not spelling problems. Fixing them would change the content, so they are listed only:

1. **GB1521E IP Planning, Q5 question text** contains what looks like a leftover reviewer comment: "Notes: why capacity demand is generated here?"
2. **GB1525D Transport (OTN) Quality Optimization guideline** is the generic Service Assurance template text ("assess the autonomy level of Service Assurance High Value Scenarios. To be used as the Template of Service Assurance Questionnaires"), not OTN Quality Optimization text.
3. **GB1525E IP Quality Optimization, Q3** has Cognitive Activity "Perceived" instead of "Awareness", so it appears as its own group in the stepper and results.
4. **GB1503A Individual Services SA, Q1** answering guideline is just "A)".
5. **GB1526A Energy Efficiency KEI note** refers to spreadsheet cells ("E16:", "F16-Option A:").
6. **GB1525A RAN Quality, Q1** guideline option C runs into D ("Human manually evaluate D) the effect…").
7. **GB1521E, Q5** guideline (D) says "Recovery solutions", copied from Fault Management.
8. **KEI ranges with gaps or overlaps:** GB1502D (30–50 % and 35–55 % not covered; 50–60 % between C and D), GB1505A MTTR (C ">= 4 hour" overlaps D ">= 8 hour").
9. **Sentences broken across two lines:** GB1525E Q1 option D, GB1503H Q3/Q4 option B.

## Steps

1. ~~Read all text; prepare the before/after list~~ — done (below).
2. ~~Approval~~ — approved 2026-10-21; the content issues above stay as they are.
3. ~~Branch `feature/review-questionnaire-spelling`: add the approved fixes to `textCorrections.ts`. `textCorrections.test.ts` already fails if a fix stops matching, and checks that codes, weights and criteria are untouched. Then typecheck, lint and test.~~ — done (231 entries, all 19 questionnaires added to `textCorrections.test.ts`; 736 tests pass).
4. ~~Local `npm run db:seed:questionnaires`, merge, push~~ — done: typos gone from the DB and the API response, answers unchanged (row count and content hash identical).
5. ~~Backup + production re-seed~~ — done 2026-10-21: on-demand Cloud SQL backup `1792608033293`, then `db:seed:questionnaires` via the Cloud SQL proxy. No image build/deploy needed (the corrections run at seed time; the seed is not in the image) — Cloud Run stays on `anlet-00014-xdx`. Verified in the production DB: 0 typos left; 581 answers, 25 comments, 9 KEI answers unchanged (same content hash). Rollback: restore backup `1792608033293`, or revert the commit and re-run the questionnaires-only seed.

## Before / after list

### GB1521E IP Network Planning (14)

| # | Kind | Before | After |
|---|---|---|---|
| 1 | spacing | architecture(physical | architecture (physical |
| 2 | spacing | environments(e.g. | environments (e.g. |
| 3 | spacing | solutions(plans) | solutions (plans) |
| 4 | spacing | package(topology, capacity and etc.) | package (topology, capacity, etc.) |
| 5 | spacing | etc.),, | etc.), |
| 6 | spacing | multi vendor | multi-vendor |
| 7 | grammar | Planning system that support the process | Planning system that supports the process |
| 8 | grammar | in autonomous way | in an autonomous way |
| 9 | grammar | AI models correlates | AI models correlate |
| 10 | grammar | support generation plan (design | support generation of plan (design |
| 11 | grammar | the planning system automatically generates the planning documents | The planning system automatically generates the planning documents |
| 12 | grammar | the planning system automatically generate documents package | The planning system automatically generates the documents package |
| 13 | grammar | with human assistant | with human assistance |
| 14 | grammar | the plan documents are made by human | The plan documents are made by humans |

### GB1522A Wireless Network Deployment (15)

| # | Kind | Before | After |
|---|---|---|---|
| 15 | spelling | is dependant on | is dependent on |
| 16 | spelling | and mare require | and may require |
| 17 | spelling |  and or  |  and/or  |
| 18 | grammar | related policies and evaluates the Fulfillment | related policies and evaluate the Fulfillment |
| 19 | grammar | control information are manually defined | control information is manually defined |
| 20 | grammar | collected and translated it into input | collected and translated into input |
| 21 | grammar | there is enough available resources | there are enough available resources |
| 22 | grammar | in case they found differences | in case they find differences |
| 23 | grammar | but its the optimal | but it's the optimal |
| 24 | grammar | in case of multiple options/solutions are targeted | in case multiple options/solutions are targeted |
| 25 | grammar | to automatically executes | to automatically execute |
| 26 | grammar | The System ensured | The System ensures |
| 27 | grammar | supports commissioning & ensure acceptable | supports commissioning & ensures acceptable |
| 28 | grammar | requires require Human | requires Human |
| 29 | grammar | recommended to go this questionnaire | recommended to go through this questionnaire |

### GB1522B Core Network Deployment (6)

| # | Kind | Before | After |
|---|---|---|---|
| 30 | grammar | related policies and evaluates the Fulfillment | related policies and evaluate the Fulfillment |
| 31 | grammar | but its the optimal | but it's the optimal |
| 32 | grammar | present to correlates & validates | present to correlate & validate |
| 33 | grammar | its able to adjust in case its found differences | it's able to adjust in case it finds differences |
| 34 | grammar | Run Book Automations requires further | Run Book Automations and require further |
| 35 | grammar | was considered reaching its top score | was considered to reach its top score |

### GB1524A Wireless Network Change Management (9)

| # | Kind | Before | After |
|---|---|---|---|
| 36 | spelling | manually defines rules | manually defined rules |
| 37 | spelling | and my need Human | and may need Human |
| 38 | spacing | 1)Parameter | 1) Parameter |
| 39 | spacing | Updates& Patches | Updates & Patches |
| 40 | spacing | Intent Translation, & Intent Fulfilment | Intent Translation & Intent Fulfilment |
| 41 | grammar | Service Capabilities who are not available, require consensus | Service Capabilities that are not available require consensus |
| 42 | grammar | Prior to set the Intent | Prior to setting the Intent |
| 43 | grammar | impacts and evaluate subsequent risk | impacts and evaluates subsequent risk |
| 44 | grammar | changes that has been | changes that have been |

### GB1524B Core Network Change Management (10)

| # | Kind | Before | After |
|---|---|---|---|
| 45 | spelling | requirment | requirement |
| 46 | spelling | excuted | executed |
| 47 | spelling | manually defines rules | manually defined rules |
| 48 | spacing | upgrade、NEs | upgrade, NEs |
| 49 | spacing | NEs /associated | NEs/associated |
| 50 | spacing | templates.. | templates. |
| 51 | spacing | inspection).E.g.: | inspection). E.g.: |
| 52 | grammar | Prior to set the Intent | Prior to setting the Intent |
| 53 | grammar | impacts and evaluate subsequent risk | impacts and evaluates subsequent risk |
| 54 | grammar | includes but not limited to | includes but is not limited to |

### GB1524E IP Network Change Management (19)

| # | Kind | Before | After |
|---|---|---|---|
| 55 | spelling | manually defines rules | manually defined rules |
| 56 | spelling | ETST ENI035 | ETSI GR ENI 035 |
| 57 | spacing | 1.Normal | 1. Normal |
| 58 | spacing | 2.Emergency | 2. Emergency |
| 59 | spacing | 3.Expedited | 3. Expedited |
| 60 | spacing | meeting);4.Standard | meeting); 4. Standard |
| 61 | spacing | follow a standard procedure. | follow a standard procedure). |
| 62 | spacing | Sub-scenario-1. Device | Sub-scenario-1: Device |
| 63 | spacing | Provisioning :add | Provisioning: add |
| 64 | spacing | Note4; | Note4: |
| 65 | spacing | evaluation& Decision | evaluation & Decision |
| 66 | spacing | (1)online | (1) online |
| 67 | spacing | intervention.. | intervention. |
| 68 | spacing | roll-back(if | roll-back (if |
| 69 | grammar | but need Human intervention | but needs Human intervention |
| 70 | grammar | both syntax and semantic. | both syntax and semantics. |
| 71 | grammar | The syntax and semantic of | The syntax and semantics of |
| 72 | grammar | based online simulation | based on online simulation |
| 73 | grammar | in whole network | in the whole network |

### GB1525A RAN Network Quality Optimization (26)

| # | Kind | Before | After |
|---|---|---|---|
| 74 | spelling | optimiztaion | optimization |
| 75 | spelling | coverge hole, overlapped cell,overshoot | coverage hole, overlapped cell, overshoot |
| 76 | spelling | not limiited to | not limited to |
| 77 | spelling | >4 hourss | >4 hours |
| 78 | spelling | high load, inference and equipment fault | high load, interference and equipment fault |
| 79 | spacing | fulfilment？ | fulfilment? |
| 80 | spacing | capability）× 100% | capability) × 100% |
| 81 | spacing | implemented,assisted | implemented, assisted |
| 82 | spacing | actions).The system | actions). The system |
| 83 | grammar | The root causes including but not limited to | The root causes include but are not limited to |
| 84 | grammar | solutions including but not limited to | solutions include but are not limited to |
| 85 | grammar | network parameters including but not limited to | network parameters include but are not limited to |
| 86 | grammar | along with it is availability | along with its availability |
| 87 | grammar | which aligned with integrity | which are aligned with integrity |
| 88 | grammar | Human manually evaluate the effect | Human manually evaluates the effect |
| 89 | grammar | How does the system collects data? | How does the system collect data? |
| 90 | grammar | How does the system identifies RAN | How does the system identify RAN |
| 91 | spacing | performance /service | performance/service |
| 92 | grammar | issues and diagnoses root cause based on | issues and diagnose root cause based on |
| 93 | grammar | identified or and predicted | identified or predicted |
| 94 | grammar | (considering of the coordination | (considering the coordination |
| 95 | grammar | actions and support the capability | actions and supports the capability |
| 96 | grammar | CSP provide All closed-loop | CSP provides all closed-loop |
| 97 | grammar | CSP provide the optimization | CSP provides the optimization |
| 98 | grammar | each of the optimization work order needs | each optimization work order needs |
| 99 | grammar | Total number of optimization work order) | Total number of optimization work orders) |

### GB1525D Transport (OTN) Network Quality Optimization (9)

| # | Kind | Before | After |
|---|---|---|---|
| 100 | spelling | underlaying | underlying |
| 101 | spacing | actions(such as | actions (such as |
| 102 | grammar | monitors Service quality and detect anomalies | monitors Service quality and detects anomalies |
| 103 | grammar | only learns of service interrupt when | only learns of service interruption when |
| 104 | grammar | People manually identified risks | People manually identify risks |
| 105 | grammar | where fibers co-routes affect a large number of service. | where fibers co-route affect a large number of services. |
| 106 | grammar | or can continuously learns | or can continuously learn |
| 107 | grammar | rules, and decision-making are manually executed | rules, and decision-making is manually executed |
| 108 | grammar | implements optimizing solution that require | implements an optimizing solution that requires |

### GB1525E IP Network Quality Optimization (34)

| # | Kind | Before | After |
|---|---|---|---|
| 109 | spelling | serveral | several |
| 110 | spelling | capabitlities | capabilities |
| 111 | spelling | questionnarie | questionnaire |
| 112 | spelling | Network KPI inculde | Network KPIs include |
| 113 | spelling | eveluates | evaluates |
| 114 | spelling | quaity | quality |
| 115 | spelling | (e.g., ifit, iOAM) | (e.g., IFIT, iOAM) |
| 116 | spelling | Other Subscenario | Other Sub-scenario |
| 117 | spelling | subscenario | sub-scenario |
| 118 | spelling | quality got promoted | quality got improved |
| 119 | spacing | flows(e.g. | flows (e.g. |
| 120 | spacing | degradation(e.g. | degradation (e.g. |
| 121 | spacing | AI Models ,without human intervention(e.g. | AI Models, without human intervention (e.g. |
| 122 | spacing | verification(e.g. | verification (e.g. |
| 123 | spacing | FRR(Fast reroute) | FRR (Fast reroute) |
| 124 | spacing | network/ service | network/service |
| 125 | spacing | <= 30min | <= 30 min |
| 126 | spacing | >30min, <= 2hour | >30 min, <= 2 hours |
| 127 | spacing | >2hour | >2 hours |
| 128 | grammar | includes but not limited to | includes but is not limited to |
| 129 | grammar | include but not limited to | include but are not limited to |
| 130 | grammar | when the quality of paths decrease | when the quality of paths decreases |
| 131 | grammar | (do not affect the overall score) | (does not affect the overall score) |
| 132 | grammar | policy that traverse the congested | policy that traverses the congested |
| 133 | grammar | policy that carrying the VPN | policy that carries the VPN |
| 134 | grammar | supports collect and display | supports collecting and displaying |
| 135 | grammar | System identify KPI degradation | System identifies KPI degradation |
| 136 | grammar | and manually identify KPI degradation | and KPI degradation is manually identified |
| 137 | grammar | intelligently locate the root cause | intelligently locates the root cause |
| 138 | grammar | Does the system automatically generates | Does the system automatically generate |
| 139 | grammar | and make decision. | and make a decision. |
| 140 | grammar | in a period more than 1 month | in a period of more than 1 month |
| 141 | grammar | records that are failed caused by | records that failed because of |
| 142 | grammar | degradation scenario that are caused | degradation scenarios that are caused |

### GB1526A RAN Energy Efficiency Optimization (16)

| # | Kind | Before | After |
|---|---|---|---|
| 143 | spelling | indicactor | indicator |
| 144 | spelling | Intent gardrails | Intent guardrails |
| 145 | spelling | (e..g, cell) | (e.g. cell) |
| 146 | spelling | energy savings actions | energy saving actions |
| 147 | spacing | (ex for data quality check ...) | (e.g. for data quality checks) |
| 148 | grammar | control information are manually defined | control information is manually defined |
| 149 | grammar | related information are collected | related information is collected |
| 150 | grammar | includes but not limited to | includes but is not limited to |
| 151 | grammar | include but not limited to | include but are not limited to |
| 152 | grammar | frequencies band/carrier | frequency bands/carriers |
| 153 | grammar | Human manually select candidate energy-saving objects (e.g. NE/CELL) and confirm | Human manually selects candidate energy-saving objects (e.g. NE/CELL) and confirms |
| 154 | grammar | (B) The intelligently (mostly | (B) The System intelligently (mostly |
| 155 | grammar | issues and analyze their root cause | issues and analyzes their root cause |
| 156 | grammar | actions, and analyze their root cause | actions, and analyzes their root cause |
| 157 | grammar | rules. the root cause | rules. The root cause |
| 158 | grammar | in hour's level time period | in an hour-level time period |

### GB1528A RAN Routine Maintenance (11)

| # | Kind | Before | After |
|---|---|---|---|
| 159 | spelling | remotely peformed | remotely performed |
| 160 | spelling | Maintenace | Maintenance |
| 161 | spelling | deviaiton | deviation |
| 162 | spelling | confrmation | confirmation |
| 163 | spacing | (e.g memory clearing .....) | (e.g. memory clearing...) |
| 164 | spacing | Software level & features,) | Software level & features) |
| 165 | spacing | How Does the System | How does the System |
| 166 | grammar | Collection the data about | Collection of the data about |
| 167 | grammar | deviations as result of | deviations as a result of |
| 168 | grammar | The System Identifies Routine Maintenance risks and analyse their impact | The System identifies Routine Maintenance risks and analyses their impact |
| 169 | grammar | evaluate the recommends solutions | evaluate the recommended solutions |

### GB1529 Proactive Security (13)

| # | Kind | Before | After |
|---|---|---|---|
| 170 | spelling | identifiying | identifying |
| 171 | spelling | Traffic infos | Traffic info |
| 172 | spelling | To what extend the System | To what extent the System |
| 173 | spelling | find-out | find out |
| 174 | spacing | (e.g: policies, rules, actions ...). | (e.g. policies, rules, actions...)? |
| 175 | spacing | Sub-scenario1: | Sub-scenario 1: |
| 176 | spacing | Sub-scenario2: | Sub-scenario 2: |
| 177 | spacing | Sub-scenario3: | Sub-scenario 3: |
| 178 | grammar | assess the network in secure way | assess the network in a secure way |
| 179 | grammar | monitoring system detect this activity | monitoring system detects this activity |
| 180 | grammar | defined baselines and standard. | defined baselines and standards. |
| 181 | grammar | Humans is assisted | Humans are assisted |
| 182 | grammar | Threat Hunting, is about | Threat Hunting is about |

### GB1502D Private Line Service Delivery (2)

| # | Kind | Before | After |
|---|---|---|---|
| 183 | spacing | such as SLA monitoring | such as SLA monitoring? |
| 184 | spacing | statistical period ] / | statistical period / |

### GB1503A Individual Services Service Assurance (7)

| # | Kind | Before | After |
|---|---|---|---|
| 185 | spelling | behanivour | behaviour |
| 186 | spacing | deterioration,VoLTE | deterioration, VoLTE |
| 187 | spacing | [ performance | [performance |
| 188 | spacing | [ Represent how | [represents how |
| 189 | grammar | does not require specifically probe measurements | does not require specific probe measurements |
| 190 | grammar | VoLTE/VoNR call drop rate) and detect performance degradation, outage or anomalies without | VoLTE/VoNR call drop rate) and detects performance degradation, outage or anomalies without |
| 191 | grammar | VoLTE/VoNR call drop rate) and detect performance degradation, outage or anomalies based | VoLTE/VoNR call drop rate) and detects performance degradation, outage or anomalies based |

### GB1503B Home Broadband Service Assurance (14)

| # | Kind | Before | After |
|---|---|---|---|
| 192 | spelling | Home bBroadband | Home Broadband |
| 193 | spelling | Automatiion | Automation |
| 194 | spelling | Some issus may | Some issues may |
| 195 | spelling | video conferening | video conferencing |
| 196 | spacing | etc.. | etc. |
| 197 | spacing | And MEF LSO | and MEF LSO |
| 198 | spacing | issues×Total | issues × Total |
| 199 | spacing | capability)× 100% | capability) × 100% |
| 200 | spacing | (e.g. throughput and latency). | (e.g. throughput and latency)? |
| 201 | spacing | severity of service degradation) | severity of service degradation)? |
| 202 | grammar | can automatically resolved? | can automatically resolve? |
| 203 | grammar | The Sum of issue resolved | The Sum of issues resolved |
| 204 | grammar | this issue partly fulfill | this issue partly fulfills |
| 205 | spacing | reflects the objective customer experience, | reflects the objective customer experience. |

### GB1503H IP Private Line Service Assurance (10)

| # | Kind | Before | After |
|---|---|---|---|
| 206 | spelling | alliviate | alleviate |
| 207 | spelling | guaranteee | guarantee |
| 208 | spacing | type(e.g. | type (e.g. |
| 209 | spacing | requirement(e.g. | requirement (e.g. |
| 210 | spacing | severity/ priority | severity/priority |
| 211 | spacing | congestion/ give | congestion/give |
| 212 | spacing | analysis(RCA) should within | analysis (RCA) should be within |
| 213 | grammar | at minute-level and detect anomalies | at minute-level and detects anomalies |
| 214 | grammar | predicts SLA violation and give suggestion | predicts SLA violation and gives suggestions |
| 215 | grammar | How does the System evaluates solution | How does the System evaluate solution |

### GB1504A Individual Services Complaint Handling (13)

| # | Kind | Before | After |
|---|---|---|---|
| 216 | spelling | Core problem transimission problem ,OTT problem | Core problem, transmission problem, OTT problem |
| 217 | spelling | who may complaint due to | who may complain due to |
| 218 | spacing | cases.The System | cases. The System |
| 219 | spacing | (B)The System | (B) The System |
| 220 | spacing | (A)The system | (A) The system |
| 221 | spacing | contextualizes ...In this context | contextualizes... In this context |
| 222 | spacing | sentiment .. It links | sentiment. It links |
| 223 | spacing | multi channel | multi-channel |
| 224 | spacing | Multi channel | Multi-channel |
| 225 | grammar | The System process complaint intents | The System processes complaint intents |
| 226 | grammar | Complaint intents processed based on | Complaint intents are processed based on |
| 227 | grammar | The system determine the impact | The system determines the impact |
| 228 | grammar | then conduct customer follow-ups | then conducts customer follow-ups |

### GB1504B Home Broadband Complaint Handling

No errors found.


### GB1505A Individual Service Fault Management (12)

| # | Kind | Before | After |
|---|---|---|---|
| 229 | spelling | anomal event | anomalous event |
| 230 | spelling | fault occured | fault occurred |
| 231 | spacing | Ticket(TT) | Ticket (TT) |
| 232 | spacing | Sub-scenario-1:Service | Sub-scenario-1: Service |
| 233 | spacing | > 1 hour, < 4 hour | > 1 hour, < 4 hours |
| 234 | spacing | > = 4 hour | >= 4 hours |
| 235 | spacing | > = 8 hour | >= 8 hours |
| 236 | spacing | On site recovery | On-site recovery |
| 237 | grammar | recommend an optimum solution | recommends an optimum solution |
| 238 | grammar | The system support on-site instruction | The system supports on-site instruction |
| 239 | grammar | Each of the trouble ticket needs | Each trouble ticket needs |
| 240 | grammar | with fault detect and recovery time | with fault detection and recovery time |
