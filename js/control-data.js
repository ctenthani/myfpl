/* BT42.195km Race 2026 — Control Room data (from Project Planner) */

window.BT42_DATA = {
  raceDate: '2026-09-27T06:30:00+02:00',
  eventName: 'BT42.195km Race 2026',
  chair: 'Chifundo Tenthani',
  meetLink: 'https://meet.google.com/ixu-kyfn-pvc',
  chairOnlyNote: 'Chair-only Control Room. Do not share the PIN outside Organising Committee leadership.',

  dashboardDefaults: {
    registrationsTarget: 450,
    registrationsActual: 0,
    marathonTarget: 120,
    marathonActual: 0,
    sponsorshipTargetMk: 30000000,
    sponsorshipActualMk: 0,
    satisfactionTarget: 85,
    mediaNotes: 'National TV/radio + strong social coverage',
    safetyStatus: 'On track — zero major incidents target'
  },

  deadlines: [
    { id: 'dl01', when: '2026-08-13', title: 'OC kick-off complete', detail: 'Roles confirmed, budget draft agreed, registration approach locked.', critical: true },
    { id: 'dl02', when: '2026-08-15', title: 'Sponsor packages final', detail: 'Platinum/Gold/Silver/In-kind benefits sheet ready to send.', critical: true },
    { id: 'dl03', when: '2026-08-18', title: 'Registration LIVE', detail: 'Form live on Netlify; payment instructions published; marketing launch.', critical: true },
    { id: 'dl04', when: '2026-08-21', title: 'Priority sponsor outreach done', detail: 'Premier Bet, Airtel, TNM, NBM, Standard Bank, FCB, NBS contacted.', critical: true },
    { id: 'dl05', when: '2026-08-25', title: 'Medical Lead + timing supplier', detail: 'Medical provider appointed; timing/chip contract signed.', critical: true },
    { id: 'dl06', when: '2026-08-27', title: 'Sponsorship deep-dive meeting', detail: 'Pipeline reviewed; LOIs chased; risk register updated.', critical: false },
    { id: 'dl07', when: '2026-09-01', title: 'Media partnerships locked', detail: 'Radio/print partners confirmed; content calendar running.', critical: false },
    { id: 'dl08', when: '2026-09-03', title: 'Core sponsorships signed', detail: 'Soft deadline for cash sponsors; pivot plan if gaps remain.', critical: true },
    { id: 'dl09', when: '2026-09-08', title: 'Operations readiness review', detail: 'Course, medical, water stations, bibs/medals status locked.', critical: true },
    { id: 'dl10', when: '2026-09-12', title: 'Course marking window opens', detail: 'Final route confirmed with authorities; marking materials ready.', critical: true },
    { id: 'dl11', when: '2026-09-15', title: 'Race-day run sheet final', detail: 'Minute-by-minute plan, emergency contacts, volunteer roster complete.', critical: true },
    { id: 'dl12', when: '2026-09-16', title: 'Prize-giving & results process ready', detail: 'Script, podium protocol, verification team briefed.', critical: false },
    { id: 'dl13', when: '2026-09-17', title: 'Pre-race briefing (on-site)', detail: 'Marshals, medical, media, start lists final.', critical: true },
    { id: 'dl14', when: '2026-09-18', title: 'Packet pickup / final checks', detail: 'Equipment, water, radios, weather contingency confirmed.', critical: true },
    { id: 'dl15', when: '2026-09-27', title: 'RACE DAY', detail: 'Execute run sheet. Safety first. Document issues for debrief.', critical: true },
    { id: 'dl16', when: '2026-09-24', title: 'Post-race debrief', detail: 'Feedback, finance, sponsor reports, 2027 recommendations.', critical: true }
  ],

  chairMeetingNotes: [
    {
      meetingId: 1, date: '2026-08-13', title: 'Kick-off — Chair briefing notes',
      notes: [
        'Open by confirming your formal appointment with MNCS and thanking the room.',
        'State the non-negotiables: safety/medical cover, clear route approvals, registration open by 18 Aug (race is 27 Sep).',
        'Ask each lead to own one workstream: Technical, Medical, Logistics, Marketing, Sponsorship, Finance, Volunteers, Digital.',
        'Agree a single source of truth: this Control Room + one shared OC WhatsApp group.',
        'Decision needed today: registration platform (Netlify Forms + mobile money) and indicative fees.',
        'Assign who sends Premier Bet and bank/telecom outreach this week.',
        'Close with action list, owners, and next meeting 19 Aug.'
      ],
      decisionsNeeded: [
        'Registration go-live date and fee structure',
        'Prize pool ceiling vs sponsorship targets',
        'Who owns sponsor pipeline day-to-day'
      ]
    },
    {
      meetingId: 2, date: '2026-08-19', title: 'Registration & marketing — Chair notes',
      notes: [
        'Confirm registration is live or blocked — if blocked, name the blocker and deadline.',
        'Review first 48–72h marketing push: social, radio, MNCS channels.',
        'Check sponsor outreach started; demand one status per priority target.',
        'Medical Lead still TBC? Escalate today — medical cannot slip past 25 Aug.',
        'Volunteer plan: schools, clubs, corporate volunteers — who is recruiting?',
        'Ask Digital to demo form + payment instructions on a phone.'
      ],
      decisionsNeeded: [
        'Any fee waiver / community free slots',
        'Theme/tagline final wording for all assets'
      ]
    },
    {
      meetingId: 3, date: '2026-08-27', title: 'Sponsorship deep dive — Chair notes',
      notes: [
        'Walk the pipeline: who was contacted, who replied, who is cold.',
        'Protect prize money: do not announce figures you cannot fund.',
        'Push for LOIs by 5 Sep soft deadline; prepare Plan B (lower prizes / more in-kind).',
        'Technical: timing supplier and route clarity before September.',
        'Risk register: weather, medical gaps, low registration, sponsor drop-out.'
      ],
      decisionsNeeded: [
        'Minimum viable prize pool if sponsorship is short',
        'Whether to extend soft deadline or cut costs'
      ]
    },
    {
      meetingId: 4, date: '2026-09-02', title: 'Operations mid-point — Chair notes',
      notes: [
        'Registration numbers vs target — marketing boost if behind.',
        'Police/traffic and course map must be on track for 5 Sep approvals.',
        'Medical deployment plan should exist in draft; lock by 5 Sep.',
        'Production orders (medals, bibs, shirts) — confirm lead times.',
        'Packet pickup location and staffing plan.'
      ],
      decisionsNeeded: [
        'Packet pickup venue and hours',
        'Any course changes requiring re-approval'
      ]
    },
    {
      meetingId: 5, date: '2026-09-09', title: 'Race week readiness — Chair notes',
      notes: [
        'Treat this as go / no-go on readiness, not final numbers.',
        'Volunteer roster and briefing dates must be real, not aspirational.',
        'Contingencies: heat, storms, road incidents, ambulance failure.',
        'Media plan: who talks to press; who owns live updates.',
        'Sponsor activation: who hosts each partner on the day.'
      ],
      decisionsNeeded: [
        'Weather contingency trigger (who decides, when)',
        'Spokesperson for media on race day'
      ]
    },
    {
      meetingId: 6, date: '2026-09-15', title: 'Final logistics lock — Chair notes',
      notes: [
        'No new major ideas — only close open loops.',
        'Course marking schedule and materials confirmed.',
        'Water delivery and station staffing locked.',
        'Security/traffic sign-off status.',
        'Test any app notifications or results path once.'
      ],
      decisionsNeeded: [
        'Any last supplier substitutions',
        'Confirm packet pickup is fully staffed'
      ]
    },
    {
      meetingId: 7, date: '2026-09-17', title: 'Pre-race briefing — Chair notes',
      notes: [
        'On-site: calm, clear, short. People need roles, not long speeches.',
        'Hand out printed run sheets and emergency contact lists.',
        'Medical and marshal briefings — confirm radios work.',
        'Start lists and seed/elite process clear to Technical.',
        'Remind everyone: safety first; Chair/Race Control can stop or delay.'
      ],
      decisionsNeeded: [
        'Final go for published start times',
        'Any last-minute course or medical changes'
      ]
    },
    {
      meetingId: 8, date: '2026-09-24', title: 'Debrief — Chair notes',
      notes: [
        'Start with thanks; keep the tone constructive.',
        'Capture what to keep, what to fix, what to drop for 2027.',
        'Finance: reconciliation timeline and sponsor reports.',
        'Participant feedback themes — one page summary.',
        'Handover pack for MNCS and next year’s chair if different.'
      ],
      decisionsNeeded: [
        'Recommended date window for 2027',
        'Which sponsors to prioritise for renewal'
      ]
    }
  ],

  checklist: [
    { id: 'G01', cat: 'Governance', task: 'Confirm formal Chair appointment letter from MNCS', owner: 'Chair / MNCS', due: '13 Aug', status: 'todo' },
    { id: 'G02', cat: 'Governance', task: 'Finalise OC organogram & role descriptions', owner: 'Chair', due: '15 Aug', status: 'todo' },
    { id: 'G03', cat: 'Governance', task: 'Open or confirm event bank account / payment handling', owner: 'Finance', due: '20 Aug', status: 'todo' },
    { id: 'G04', cat: 'Governance', task: 'Insurance (public liability / event) confirmed', owner: 'Finance / MNCS', due: '05 Sep', status: 'todo' },
    { id: 'R01', cat: 'Registration', task: 'Decide platform (web + Netlify Forms / Sheet)', owner: 'Tech / Chair', due: '15 Aug', status: 'done' },
    { id: 'R02', cat: 'Registration', task: 'Registration form live (online)', owner: 'Tech', due: '18 Aug', status: 'todo' },
    { id: 'R03', cat: 'Registration', task: 'Mobile money payment instructions published', owner: 'Tech / Finance', due: '18 Aug', status: 'todo' },
    { id: 'R04', cat: 'Registration', task: 'Early-bird pricing & cut-off dates published', owner: 'Marketing', due: '18 Aug', status: 'todo' },
    { id: 'R05', cat: 'Registration', task: 'Daily registration dashboard shared with OC', owner: 'Tech', due: 'Ongoing', status: 'todo' },
    { id: 'S01', cat: 'Sponsorship', task: 'Finalise sponsorship packages (Platinum / Gold / Silver / In-kind)', owner: 'Marketing', due: '15 Aug', status: 'todo' },
    { id: 'S02', cat: 'Sponsorship', task: 'Priority target list & outreach sequence agreed', owner: 'Marketing / Chair', due: '15 Aug', status: 'todo' },
    { id: 'S03', cat: 'Sponsorship', task: 'Approach Premier Bet for renewal / Platinum', owner: 'Chair / Marketing', due: '18 Aug', status: 'todo' },
    { id: 'S04', cat: 'Sponsorship', task: 'Approach Airtel, TNM, NBM, Standard Bank, FCB, NBS', owner: 'Marketing', due: '20 Aug', status: 'todo' },
    { id: 'S05', cat: 'Sponsorship', task: 'Approach beverage / water partners (Quench, Kasupe)', owner: 'Marketing', due: '22 Aug', status: 'todo' },
    { id: 'S06', cat: 'Sponsorship', task: 'Signed agreements or LOIs for core sponsors', owner: 'Marketing', due: '05 Sep', status: 'todo' },
    { id: 'S07', cat: 'Sponsorship', task: 'Sponsor branding assets collected & approved', owner: 'Marketing', due: '15 Sep', status: 'todo' },
    { id: 'T01', cat: 'Course & Tech', task: 'Confirm exact route with MNCS / city authorities', owner: 'Technical', due: '20 Aug', status: 'todo' },
    { id: 'T02', cat: 'Course & Tech', task: 'Police & traffic management approval obtained', owner: 'Technical / Chair', due: '05 Sep', status: 'todo' },
    { id: 'T03', cat: 'Course & Tech', task: 'Timing system / chip supplier contracted', owner: 'Technical', due: '25 Aug', status: 'todo' },
    { id: 'T04', cat: 'Course & Tech', task: 'Course measurement / certification (if required)', owner: 'Technical', due: '10 Sep', status: 'todo' },
    { id: 'T05', cat: 'Course & Tech', task: 'Course marking plan & materials ready', owner: 'Technical', due: '18 Sep', status: 'todo' },
    { id: 'T06', cat: 'Course & Tech', task: 'Water / aid station locations finalised (~every 5 km)', owner: 'Logistics', due: '10 Sep', status: 'todo' },
    { id: 'M01', cat: 'Medical', task: 'Lead medical officer / organisation confirmed', owner: 'Medical Lead', due: '25 Aug', status: 'todo' },
    { id: 'M02', cat: 'Medical', task: 'Ambulance coverage & first-aid posts plan', owner: 'Medical Lead', due: '05 Sep', status: 'todo' },
    { id: 'M03', cat: 'Medical', task: 'Medical brief for marshals & volunteers prepared', owner: 'Medical Lead', due: '20 Sep', status: 'todo' },
    { id: 'M04', cat: 'Medical', task: 'Emergency contact & evacuation protocol documented', owner: 'Medical / Chair', due: '20 Sep', status: 'todo' },
    { id: 'L01', cat: 'Logistics', task: 'Medals design & order placed', owner: 'Logistics', due: '25 Aug', status: 'todo' },
    { id: 'L02', cat: 'Logistics', task: 'Race T-shirts / bibs ordered', owner: 'Logistics', due: '01 Sep', status: 'todo' },
    { id: 'L03', cat: 'Logistics', task: 'Water, cups, electrolytes, ice ordered', owner: 'Logistics', due: '10 Sep', status: 'todo' },
    { id: 'L04', cat: 'Logistics', task: 'Finish-line infrastructure confirmed', owner: 'Logistics', due: '15 Sep', status: 'todo' },
    { id: 'L05', cat: 'Logistics', task: 'Volunteer recruitment drive launched', owner: 'Volunteer Coord', due: '20 Aug', status: 'todo' },
    { id: 'L06', cat: 'Logistics', task: 'Volunteer briefing materials & roster complete', owner: 'Volunteer Coord', due: '22 Sep', status: 'todo' },
    { id: 'C01', cat: 'Marketing', task: 'Event theme / tagline finalised', owner: 'Marketing', due: '15 Aug', status: 'todo' },
    { id: 'C02', cat: 'Marketing', task: 'Social media accounts / pages ready & content calendar', owner: 'Marketing', due: '18 Aug', status: 'todo' },
    { id: 'C03', cat: 'Marketing', task: 'Press release / media advisory for registration launch', owner: 'Marketing', due: '18 Aug', status: 'todo' },
    { id: 'C04', cat: 'Marketing', task: 'Radio & print partnerships secured', owner: 'Marketing', due: '01 Sep', status: 'todo' },
    { id: 'C05', cat: 'Marketing', task: 'Athlete / influencer ambassador outreach', owner: 'Marketing', due: '25 Aug', status: 'todo' },
    { id: 'C06', cat: 'Marketing', task: 'Race-week media plan & live coverage', owner: 'Marketing', due: '18 Sep', status: 'todo' },
    { id: 'D01', cat: 'Race Day', task: 'Detailed race-day run sheet (minute-by-minute)', owner: 'Chair / Technical', due: '20 Sep', status: 'todo' },
    { id: 'D02', cat: 'Race Day', task: 'Packet pickup / expo logistics locked', owner: 'Logistics', due: '20 Sep', status: 'todo' },
    { id: 'D03', cat: 'Race Day', task: 'Results process & verification team ready', owner: 'Technical', due: '22 Sep', status: 'todo' },
    { id: 'D04', cat: 'Race Day', task: 'Prize-giving script & podium protocol', owner: 'Chair / Marketing', due: '22 Sep', status: 'todo' },
    { id: 'D05', cat: 'Post-Race', task: 'Participant feedback survey distributed', owner: 'Marketing', due: '27 Sep', status: 'todo' },
    { id: 'D06', cat: 'Post-Race', task: 'Sponsor report & thank-you letters', owner: 'Marketing / Chair', due: '05 Oct', status: 'todo' },
    { id: 'D07', cat: 'Post-Race', task: 'Financial reconciliation complete', owner: 'Finance', due: '10 Oct', status: 'todo' },
    { id: 'D08', cat: 'Post-Race', task: 'Full debrief report for MNCS & 2027 handover', owner: 'Chair', due: '15 Oct', status: 'todo' }
  ],

  meetings: [
    { id: 1, date: '2026-08-13', time: '14:00–16:00', type: 'In-person / Hybrid', focus: 'Kick-off & Structure', agenda: ['Formal confirmation of Chair & OC roles', 'Review of previous edition learnings', 'Draft budget & prize structure', 'Route & date confirmation (27 Sep)', 'Sponsorship strategy & target list', 'Registration platform decision', 'Immediate action items & owners'], attendees: 'Chair, MNCS reps, Technical Lead, Marketing, Finance, Medical lead' },
    { id: 2, date: '2026-08-19', time: '14:00–15:30', type: 'Virtual or Hybrid', focus: 'Registration & Marketing Launch', agenda: ['Registration system live status', 'Marketing calendar & first campaign assets', 'Sponsor outreach progress report', 'Volunteer recruitment plan', 'Medical & safety preliminary plan', 'App / website review'], attendees: 'Full OC + digital/tech lead' },
    { id: 3, date: '2026-08-27', time: '14:00–16:00', type: 'In-person', focus: 'Sponsorship Deep Dive', agenda: ['Sponsor pipeline & signed letters of intent', 'Benefits packages finalisation', 'Prize money confirmation vs budget', 'Course & logistics detailed plan', 'Timing system & chip supplier', 'Risk register review'], attendees: 'Chair, Finance, Marketing, Technical, MNCS' },
    { id: 4, date: '2026-09-02', time: '14:00–15:30', type: 'Hybrid', focus: 'Operations Mid-Point', agenda: ['Registration numbers & marketing performance', 'Final course map & police/traffic plan', 'Medical deployment plan', 'Water stations & logistics', 'Bibs, medals, T-shirts production status', 'Packet pickup plan'], attendees: 'Full OC' },
    { id: 5, date: '2026-09-09', time: '14:00–16:00', type: 'In-person', focus: 'Race Week Readiness', agenda: ['Final participant projections', 'Volunteer roster & briefing schedule', 'Communication plan (SMS/App/Radio)', 'Contingency scenarios (weather, medical)', 'Media & live coverage plan', 'Sponsor activation on race day'], attendees: 'Full OC + key suppliers' },
    { id: 6, date: '2026-09-15', time: '14:00–15:30', type: 'Hybrid', focus: 'Final Logistics Lock', agenda: ['Course marking schedule', 'Equipment & water delivery timeline', 'Security & traffic final sign-off', 'Elite athlete support (if any)', 'Packet pickup logistics', 'Results process test'], attendees: 'Technical, Logistics, Medical, Chair' },
    { id: 7, date: '2026-09-17', time: '10:00–12:00', type: 'On-site / Stadium', focus: 'Pre-Race Briefing', agenda: ['Final numbers & start lists', 'Marshal & volunteer final briefing', 'Medical team briefing', 'Media & results process', 'Race-day roles confirmation', 'Emergency contacts & radios'], attendees: 'All key operational leads + lead volunteers' },
    { id: 8, date: '2026-09-24', time: '14:00–16:00', type: 'In-person / Hybrid', focus: 'Post-Race Debrief', agenda: ['What went well / what to improve', 'Financial reconciliation', 'Participant & sponsor feedback summary', 'Results verification & records', 'Recommendations for 2027', 'Thank-you communications'], attendees: 'Full OC + MNCS' }
  ],

  sponsors: [
    { priority: 1, org: 'Premier Bet Malawi', category: 'Betting / Gaming', tier: 'Platinum', status: 'To Contact', value: 'K15m+ (prev)', notes: 'Strong previous partner — start here' },
    { priority: 1, org: 'Airtel Malawi', category: 'Telecom / Mobile Money', tier: 'Platinum / Gold', status: 'To Contact', value: 'Cash + data/SMS + payment', notes: 'High strategic fit for app & payments' },
    { priority: 1, org: 'TNM', category: 'Telecom / Mobile Money', tier: 'Gold / Platinum', status: 'To Contact', value: 'Cash + Mpamba + airtime', notes: 'Long sports history' },
    { priority: 2, org: 'National Bank of Malawi (NBM)', category: 'Banking', tier: 'Gold', status: 'To Contact', value: 'Cash package', notes: 'Large sports packages recently' },
    { priority: 2, org: 'Standard Bank Malawi', category: 'Banking', tier: 'Gold', status: 'To Contact', value: 'Cash / in-kind', notes: 'Previous race involvement history' },
    { priority: 2, org: 'First Capital Bank (FCB)', category: 'Banking', tier: 'Gold / Silver', status: 'To Contact', value: 'Cash', notes: 'Active football sponsor' },
    { priority: 2, org: 'NBS Bank', category: 'Banking', tier: 'Silver / Gold', status: 'To Contact', value: 'Cash', notes: 'Charity Shield & league experience' },
    { priority: 3, org: 'Carlsberg Malawi / Quench', category: 'Beverage', tier: 'Gold (hydration)', status: 'To Contact', value: 'Product + cash', notes: 'Natural race partner' },
    { priority: 3, org: 'Island Beverages (Kasupe)', category: 'Beverage / Water', tier: 'Silver / In-kind', status: 'To Contact', value: 'Water supply', notes: 'Golf & event experience' },
    { priority: 3, org: 'Old Mutual Malawi', category: 'Insurance / FS', tier: 'Silver', status: 'To Contact', value: 'Cash / athlete support', notes: 'Past athlete sponsorship' },
    { priority: 4, org: 'Media houses (Times, Nation, MBC)', category: 'Media', tier: 'In-kind / Partnership', status: 'To Contact', value: 'Coverage', notes: 'Essential for reach' }
  ],

  budget: {
    currency: 'MWK',
    note: 'Figures from 2026 BT42.195km Race budget worksheet (adapted for 27 Sep 2026). Tentative until Chair/Finance confirm.',
    expenditure: [
      { cat: 'Protocol', item: 'Medals, ceremony, DC, supplies', est: 1246000 },
      { cat: 'Marketing', item: 'Branding, media, T-shirts, streaming, PA, events', est: 13336986 },
      { cat: 'Security', item: 'Police, vehicles, service charges', est: 2055000 },
      { cat: 'Technical', item: 'Officials, water, route, equipment', est: 3227000 },
      { cat: 'Transport', item: 'Fuel and drivers', est: 1511000 },
      { cat: 'Volunteers (ops)', item: 'Fuel, facilitators, recruitment', est: 530000 },
      { cat: 'Catering', item: 'Volunteers, VIP, athletes, water', est: 1550000 },
      { cat: 'Medical', item: 'Personnel, equipment, toilets', est: 819000 },
      { cat: 'AM Executive Officials', item: 'Travel / accommodation (TBC)', est: 0 },
      { cat: 'Venue & permits', item: 'City clearance, Kamuzu Stadium, staff', est: 595000 },
      { cat: 'Volunteer allowances', item: 'Race-day volunteer allowances', est: 2000000 },
      { cat: 'Organising Committee', item: 'Meetings, airtime, tokens, postmortem', est: 8330000 },
      { cat: 'Prize money', item: 'Main race, 10 km, 5 km, veterans', est: 18350000 }
    ],
    income: [
      { source: 'Sponsorship (target)', target: 40000000 },
      { source: 'Entry fees (estimate)', target: 8000000 },
      { source: 'Other / in-kind', target: 5550000 }
    ]
  },

  runsheet: [
    { time: '04:30', activity: 'Core team arrive, set-up begins', location: 'Kamuzu Stadium', lead: 'Logistics + Technical' },
    { time: '05:00', activity: 'Water stations & course marking teams deploy', location: 'Full course', lead: 'Technical / Logistics' },
    { time: '05:30', activity: 'Medical team & ambulances in position', location: 'Key points + stadium', lead: 'Medical Lead' },
    { time: '05:45', activity: 'Volunteer marshals briefing', location: 'Stadium', lead: 'Volunteer Coord' },
    { time: '06:00', activity: 'Packet pickup / late registration closes', location: 'Stadium registration area', lead: 'Registration Lead' },
    { time: '06:15', activity: 'Elite / seeded athletes call room', location: 'Near start', lead: 'Technical' },
    { time: '06:30', activity: 'Marathon start (target)', location: 'Start line', lead: 'Starter / Technical' },
    { time: '06:45–07:00', activity: '10 km start (staggered)', location: 'Start line', lead: 'Starter' },
    { time: '07:15–07:30', activity: '5 km Fun Run start', location: 'Start line', lead: 'Starter' },
    { time: '07:30 onwards', activity: 'Live updates, lead vehicle, media', location: 'Course', lead: 'Marketing / Technical' },
    { time: '~08:45–09:30', activity: 'First marathon finishers expected', location: 'Finish line', lead: 'Timing + Announcer' },
    { time: 'Ongoing', activity: '5 km & 10 km finishers, medals, recovery', location: 'Finish area', lead: 'Logistics + Medical' },
    { time: '10:30–11:30', activity: 'Prize-giving ceremony', location: 'Stadium podium / stage', lead: 'Chair + MC' },
    { time: '12:00', activity: 'Course clear & equipment recovery begins', location: 'Full course', lead: 'Logistics' },
    { time: '13:00+', activity: 'Core team debrief hot-wash (quick)', location: 'Stadium', lead: 'Chair' }
  ],

  roles: [
    { role: 'Chair of Organising Committee', name: 'Chifundo Tenthani', responsibilities: 'Overall leadership, MNCS liaison, final decisions' },
    { role: 'Vice Chairperson', name: 'Kenneth Dzekedzeke', responsibilities: 'Support Chair; stand in when unavailable; cross-workstream follow-up' },
    { role: 'Coordinator', name: 'Ruth Mzengo', responsibilities: 'OC coordination and follow-through on actions' },
    { role: 'Technical / Course Lead', name: 'Kenneth Dzekedzeke', responsibilities: 'Route, timing, course marking, results (with Francis Muthali)' },
    { role: 'Technical member', name: 'Francis Muthali', responsibilities: 'Support Technical Chair on course and race operations' },
    { role: 'Transport Lead', name: 'Charity Kayauni', responsibilities: 'Vehicle roster, transfers, fuel logistics (with Chiumia Limbikani)' },
    { role: 'Transport member', name: 'Chiumia Limbikani', responsibilities: 'Support transport operations' },
    { role: 'Protocol Lead', name: 'Ireen Luka', responsibilities: 'Ceremonies, VIP/guest hosting, programmes (with Chiletso Chigwenembe, Susan)' },
    { role: 'Protocol member', name: 'Chiletso Chigwenembe', responsibilities: 'Support protocol and ceremonies' },
    { role: 'Marketing & Publicity Lead', name: 'Mzee Makawa', responsibilities: 'Brand, media, content (with Edgar Ntulumbwa, Faith Mlauzi, Limbani Matola)' },
    { role: 'Marketing member', name: 'Edgar Ntulumbwa', responsibilities: 'Publicity and media support' },
    { role: 'Marketing member', name: 'Faith Mlauzi', responsibilities: 'Publicity and media support' },
    { role: 'Marketing member', name: 'Limbani Matola', responsibilities: 'Publicity; medals liaison' },
    { role: 'Medical Lead', name: 'Isaac Chapweteka', responsibilities: 'Medical protocol, ambulances, first aid' },
    { role: 'Security Lead', name: 'George Luhanga', responsibilities: 'Crowd control, police liaison, course security (with Theresiwe Hara)' },
    { role: 'Security member', name: 'Theresiwe Hara', responsibilities: 'Support security operations' },
    { role: 'Catering Lead', name: 'Charity Chirwa', responsibilities: 'Officials/volunteer meals, athlete refreshments, hospitality' },
    { role: 'Volunteer Coordinator', name: 'Gracian Mkandawire', responsibilities: 'Recruitment, briefing, race-day deployment' },
    { role: 'Secretariat', name: 'Jessie Ganizan', responsibilities: 'OC administration and documentation' },
    { role: 'Secretariat', name: 'Nicholas Kanyenda', responsibilities: 'OC administration and documentation' },
    { role: 'Finance & Registration', name: 'Ardron Msowoya', responsibilities: 'Budget, payments, registration data' },
    { role: 'Finance & Registration', name: 'Bertha Limbani', responsibilities: 'Budget, payments, registration support' },
    { role: 'Finance & Registration', name: 'Chisomo Massa', responsibilities: 'Registration and finance support' },
    { role: 'MNCS Link / Official', name: '', responsibilities: 'Institutional support, approvals, continuity' },
    { role: 'Digital / App Lead', name: '', responsibilities: 'Website, app, live updates, results publishing' }
  ],

  successMetrics: [
    { metric: 'Registrations', target: '≥ 450 total (Marathon ≥ 120)' },
    { metric: 'Sponsorship Cash', target: '≥ MK 25–40 million (or equivalent value)' },
    { metric: 'Safety Incidents', target: 'Zero major medical emergencies' },
    { metric: 'Participant Satisfaction', target: '≥ 85% positive feedback' },
    { metric: 'Media Reach', target: 'National TV/radio + strong social coverage' },
    { metric: 'App / Web Usage', target: '≥ 60% of registrants use digital platform' }
  ]
};
