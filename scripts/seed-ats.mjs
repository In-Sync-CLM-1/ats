// Comprehensive ATS demo seed — active-desk look for video walkthrough
// 6 clients · 10 mandates · 55+ candidates · 200+ calls spread across June 2026
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from './lib/env.mjs';

const env = loadEnv(new URL('../.env', import.meta.url));
const here = dirname(fileURLToPath(import.meta.url));
const SB_URL = 'https://htdwkhtfdifwajdkkpul.supabase.co';
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
const sb = createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

async function rest(method, path, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}
const get = (p) => rest('GET', p);
const post = (p, b) => rest('POST', p, b);
const patch = (p, b) => rest('PATCH', p, b);
const upsert = (p, b, conflict) => fetch(`${SB_URL}/rest/v1/${p}${conflict ? `?on_conflict=${conflict}` : ''}`, {
  method: 'POST',
  headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify(b),
}).then(async r => { const t = await r.text(); if (!r.ok) throw new Error(`UPSERT ${p} -> ${r.status}: ${t}`); return t ? JSON.parse(t) : null; });

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_PASSWORD = 'AtsDemo#2026';

// Date helpers — all activity is dated RELATIVE TO THE RECORDING DAY so that
// "today" and "this month" KPIs are alive no matter when the video is re-shot.
// demoDay(d) maps the old June-calendar day d (1..29) onto the last 30 days:
// d=29 → yesterday, d=1 → 29 days ago.
function daysAgo(n, hour = 10, minute = 0) {
  const dt = new Date();
  dt.setDate(dt.getDate() - n);
  dt.setHours(hour, minute, 0, 0);
  return dt.toISOString();
}
function demoDay(day, hour = 10, minute = 0) {
  return daysAgo(30 - day, hour, minute);
}
// "Today" (recording day) in LOCAL time — .toISOString() alone gives the UTC
// date, which is YESTERDAY when seeding late-night IST and turns every
// next_call_date into an overdue red flag on My Desk.
const TODAY = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// ── 1. Org ───────────────────────────────────────────────────────────────────
console.log('1. Updating org...');
await fetch(`${SB_URL}/rest/v1/organizations?id=eq.${ORG_ID}`, {
  method: 'PATCH',
  headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ name: 'TechCorp Solutions', slug: 'techcorp', logo_url: 'https://ats-6t2.pages.dev/techcorp-logo.png' }),
});

// ── 2. Siddharth Roy (org admin) ─────────────────────────────────────────────
console.log('2. Org admin...');
const ORG_ADMIN_EMAIL = 'siddharth.roy@insync-demo.in';
const { data: allUsers } = await sb.auth.admin.listUsers();
const foundAdmin = allUsers?.users?.find(u => u.email === ORG_ADMIN_EMAIL);
let ORG_ADMIN_ID;
if (foundAdmin) {
  ORG_ADMIN_ID = foundAdmin.id;
  await sb.auth.admin.updateUserById(ORG_ADMIN_ID, { password: DEMO_PASSWORD });
  console.log(`   existing ${ORG_ADMIN_ID}`);
} else {
  const { data: c } = await sb.auth.admin.createUser({ email: ORG_ADMIN_EMAIL, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { full_name: 'Siddharth Roy' } });
  ORG_ADMIN_ID = c.user.id;
  console.log(`   created ${ORG_ADMIN_ID}`);
}
await upsert('profiles', { id: ORG_ADMIN_ID, email: ORG_ADMIN_EMAIL, full_name: 'Siddharth Roy', onboarding_completed: true, org_id: ORG_ID }, 'id');
await upsert('org_memberships', { org_id: ORG_ID, user_id: ORG_ADMIN_ID, role: 'org_admin' }, 'org_id,user_id');
await upsert('user_roles', { user_id: ORG_ADMIN_ID, role: 'admin', org_id: ORG_ID }, 'user_id,role');

// ── 3. Recruiters ─────────────────────────────────────────────────────────────
console.log('3. Recruiters...');
const REC_DEFS = [
  { email: 'aarav.mehta@insync-demo.in', full_name: 'Aarav Mehta', phone: '9811234560' },
  { email: 'neha.kapoor@insync-demo.in', full_name: 'Neha Kapoor', phone: '9822345671' },
  { email: 'divya.rao@insync-demo.in',   full_name: 'Divya Rao',   phone: '9833456782' },
];
const recMap = {};
for (const rec of REC_DEFS) {
  const found = allUsers?.users?.find(u => u.email === rec.email);
  let uid;
  if (found) { uid = found.id; await sb.auth.admin.updateUserById(uid, { password: DEMO_PASSWORD }); }
  else {
    const { data: c } = await sb.auth.admin.createUser({ email: rec.email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { full_name: rec.full_name } });
    uid = c.user.id;
  }
  recMap[rec.full_name] = uid;
  await upsert('profiles', { id: uid, email: rec.email, full_name: rec.full_name, phone: rec.phone, onboarding_completed: true, org_id: ORG_ID }, 'id');
  await upsert('org_memberships', { org_id: ORG_ID, user_id: uid, role: 'member' }, 'org_id,user_id');
  await upsert('user_roles', { user_id: uid, role: 'manager', org_id: ORG_ID }, 'user_id,role');
  console.log(`   ${rec.full_name}: ${uid}`);
}
const AARAV_ID = recMap['Aarav Mehta'];
const NEHA_ID  = recMap['Neha Kapoor'];
const DIVYA_ID = recMap['Divya Rao'];

// ── 4. Clients ────────────────────────────────────────────────────────────────
console.log('4. Clients...');
const CLIENT_DEFS = [
  { company_name: 'TechCorp Solutions',          contact_name: 'Rohan Kapoor',    contact_number: '9900112233', email_id: 'hiring@techcorp.in',       industry_sector: 'Technology',            head_office_location: 'Whitefield, Bangalore 560066' },
  { company_name: 'Meridian Financial Services', contact_name: 'Pooja Agarwal',   contact_number: '9811234500', email_id: 'talent@meridianfin.in',    industry_sector: 'BFSI',                  head_office_location: 'Lower Parel, Mumbai 400013' },
  { company_name: 'HealthFirst Diagnostics',     contact_name: 'Dr. Nitin Sood',  contact_number: '9822345611', email_id: 'hr@healthfirst.in',        industry_sector: 'Healthcare',            head_office_location: 'Banjara Hills, Hyderabad 500034' },
  { company_name: 'RapidShip Logistics',         contact_name: 'Vikram Malhotra', contact_number: '9833456722', email_id: 'careers@rapidship.in',     industry_sector: 'Logistics & Supply Chain', head_office_location: 'Golf Course Road, Gurgaon 122001' },
  { company_name: 'DesignHive Creative Agency',  contact_name: 'Prerna Sethi',    contact_number: '9844567833', email_id: 'studio@designhive.in',     industry_sector: 'Media & Design',        head_office_location: 'Koramangala, Bangalore 560095' },
  { company_name: 'Pinnacle Realty Group',       contact_name: 'Suresh Mehra',    contact_number: '9855678944', email_id: 'hr@pinnaclegroup.in',      industry_sector: 'Real Estate',           head_office_location: 'BKC, Mumbai 400051' },
];
const clientIds = {};
for (const cl of CLIENT_DEFS) {
  const ex = await get(`clients?company_name=eq.${encodeURIComponent(cl.company_name)}&org_id=eq.${ORG_ID}&select=id`);
  if (ex?.length) { clientIds[cl.company_name] = ex[0].id; }
  else { const r = await post('clients', { ...cl, org_id: ORG_ID, created_by: ORG_ADMIN_ID }); clientIds[cl.company_name] = r[0].id; }
  console.log(`   ${cl.company_name}`);
}
const C = (n) => clientIds[n];

// ── 5. Mandates ───────────────────────────────────────────────────────────────
console.log('5. Mandates...');
const MANDATE_DEFS = [
  { job_title: 'Senior Frontend Developer',    client: 'TechCorp Solutions',          rec: AARAV_ID, loc: 'Bangalore',  mode: 'hybrid',  type: 'permanent', pos: 3, filled: 2, submitted: 18, minExp: 3, maxExp: 7,  minCtc: 8,  maxCtc: 18, skills: ['React','TypeScript','Node.js'],                       qual: 'B.Tech / B.E.',     pri: 'High',     status: 'open', received: '2026-06-01', closure: '2026-07-10', desc: 'Senior React developer to build scalable web applications.' },
  { job_title: 'Full Stack Developer',         client: 'TechCorp Solutions',          rec: AARAV_ID, loc: 'Bangalore',  mode: 'hybrid',  type: 'permanent', pos: 2, filled: 0, submitted: 11, minExp: 2, maxExp: 5,  minCtc: 7,  maxCtc: 15, skills: ['React','Node.js','PostgreSQL'],                      qual: 'B.Tech / B.E.',     pri: 'High',     status: 'open', received: '2026-06-03', closure: '2026-07-15', desc: 'Full stack developer to own product features end to end.' },
  { job_title: 'Credit Risk Analyst',          client: 'Meridian Financial Services', rec: NEHA_ID,  loc: 'Mumbai',     mode: 'onsite',  type: 'permanent', pos: 1, filled: 0, submitted: 7,  minExp: 2, maxExp: 6,  minCtc: 9,  maxCtc: 20, skills: ['Risk Modeling','Excel','SQL','Credit Analysis'],     qual: 'MBA Finance / CA',   pri: 'Critical', status: 'open', received: '2026-06-05', closure: '2026-07-03', desc: 'Assess credit risk for retail and MSME lending portfolios.' },
  { job_title: 'DevOps / Cloud Engineer',      client: 'TechCorp Solutions',          rec: AARAV_ID, loc: 'Bangalore',  mode: 'hybrid',  type: 'permanent', pos: 2, filled: 1, submitted: 9,  minExp: 3, maxExp: 8,  minCtc: 10, maxCtc: 22, skills: ['Kubernetes','AWS','Terraform','CI/CD'],              qual: 'B.Tech / B.E.',     pri: 'High',     status: 'open', received: '2026-06-08', closure: '2026-07-20', desc: 'Build and maintain cloud infrastructure and deployment pipelines.' },
  { job_title: 'Talent Acquisition Specialist',client: 'HealthFirst Diagnostics',     rec: NEHA_ID,  loc: 'Hyderabad',  mode: 'onsite',  type: 'permanent', pos: 1, filled: 0, submitted: 5,  minExp: 2, maxExp: 5,  minCtc: 5,  maxCtc: 10, skills: ['Sourcing','ATS','Naukri','Stakeholder Management'],  qual: 'MBA HR',            pri: 'Medium',   status: 'open', received: '2026-06-10', closure: '2026-07-25', desc: 'End-to-end hiring for tech and non-tech roles at HealthFirst.' },
  { job_title: 'Supply Chain Analyst',         client: 'RapidShip Logistics',         rec: DIVYA_ID, loc: 'Gurgaon',    mode: 'onsite',  type: 'permanent', pos: 2, filled: 0, submitted: 6,  minExp: 1, maxExp: 4,  minCtc: 5,  maxCtc: 10, skills: ['Logistics','ERP','Data Analysis','Vendor Management'],qual: 'B.E. / MBA Ops',    pri: 'High',     status: 'open', received: '2026-06-12', closure: '2026-07-08', desc: 'Optimize supply chain and vendor relationships at RapidShip.' },
  { job_title: 'UI/UX Designer',               client: 'DesignHive Creative Agency',  rec: DIVYA_ID, loc: 'Bangalore',  mode: 'hybrid',  type: 'permanent', pos: 1, filled: 0, submitted: 8,  minExp: 2, maxExp: 5,  minCtc: 6,  maxCtc: 14, skills: ['Figma','User Research','Prototyping','Design Systems'],qual: 'B.Des / BFA',       pri: 'Medium',   status: 'open', received: '2026-06-14', closure: '2026-07-28', desc: 'Design user-centered digital experiences for diverse clients.' },
  { job_title: 'Python Data Scientist',        client: 'TechCorp Solutions',          rec: AARAV_ID, loc: 'Bangalore',  mode: 'hybrid',  type: 'permanent', pos: 3, filled: 0, submitted: 14, minExp: 2, maxExp: 6,  minCtc: 10, maxCtc: 24, skills: ['Python','ML','Pandas','TensorFlow','SQL'],           qual: 'M.Tech / B.Tech CS',pri: 'High',     status: 'open', received: '2026-06-15', closure: '2026-07-07', desc: 'Build ML models to drive product intelligence and analytics.' },
  { job_title: 'Area Sales Manager',           client: 'Meridian Financial Services', rec: NEHA_ID,  loc: 'Pune',       mode: 'remote',  type: 'permanent', pos: 2, filled: 1, submitted: 12, minExp: 4, maxExp: 10, minCtc: 10, maxCtc: 25, skills: ['B2B Sales','BFSI','Team Management','Client Acquisition'],qual: 'MBA',            pri: 'Critical', status: 'open', received: '2026-06-02', closure: '2026-07-05', desc: 'Drive loan product sales across Maharashtra — SME and retail.' },
  { job_title: 'Operations Head',              client: 'RapidShip Logistics',         rec: DIVYA_ID, loc: 'Gurgaon',    mode: 'onsite',  type: 'permanent', pos: 1, filled: 0, submitted: 4,  minExp: 8, maxExp: 15, minCtc: 25, maxCtc: 45, skills: ['P&L Management','Last-mile Logistics','Team Leadership'],qual: 'MBA Operations',  pri: 'High',     status: 'open', received: '2026-06-18', closure: '2026-07-12', desc: 'Lead operations across the North India distribution network.' },
];
const mandateIds = {};
for (const md of MANDATE_DEFS) {
  const ex = await get(`mandates?job_title=eq.${encodeURIComponent(md.job_title)}&org_id=eq.${ORG_ID}&select=id`);
  if (ex?.length) {
    mandateIds[md.job_title] = ex[0].id;
    await patch(`mandates?id=eq.${ex[0].id}`, { assigned_recruiter_id: md.rec, profiles_submitted: md.submitted, positions_filled: md.filled });
  } else {
    const r = await post('mandates', {
      job_title: md.job_title, client_id: C(md.client), job_location: md.loc, work_mode: md.mode,
      employment_type: md.type, number_of_positions: md.pos, positions_filled: md.filled,
      profiles_submitted: md.submitted, min_experience_years: md.minExp, max_experience_years: md.maxExp,
      min_ctc_lakhs: md.minCtc, max_ctc_lakhs: md.maxCtc, mandatory_skills: md.skills,
      minimum_qualification: md.qual, job_description: md.desc, priority_level: md.pri.toLowerCase(),
      mandate_status: md.status, mandate_received_date: md.received, target_closure_date: md.closure,
      assigned_recruiter_id: md.rec, org_id: ORG_ID, created_by: ORG_ADMIN_ID,
    });
    mandateIds[md.job_title] = r[0].id;
  }
  console.log(`   ${md.job_title}`);
}
const M = (t) => mandateIds[t];
const mandateId = M('Senior Frontend Developer');
const clientId  = C('TechCorp Solutions');
// The hero mandate is "raised today": newest-first ordering puts it at the TOP
// of the careers page and the mandate list, and its header reads today's date.
await patch(`mandates?id=eq.${mandateId}`, {
  created_at: daysAgo(0, 9), mandate_received_date: TODAY,
  target_closure_date: daysAgo(-21, 9).slice(0, 10),
});

// ── 6. Priya Sharma (main hero candidate) ────────────────────────────────────
console.log('6. Priya Sharma...');
const ex6 = await get(`candidates?email=eq.priya.sharma.demo%40gmail.com&org_id=eq.${ORG_ID}&select=id`);
let candidateId;
const PRIYA_FIELDS = {
  interview_stage: 'Interview', current_status: 'applied', is_onboarded: false,
  assigned_recruiter: null, next_call_date: TODAY,
  position_applied_for: 'Senior Frontend Developer', notice_period_days: 30,
  current_ctc_lakhs: 8.0, expected_ctc_lakhs: 12.0,
  designation: 'Frontend Developer', current_company: 'Zenlabs Software',
  total_experience_years: 5.5, rating: 4,
  current_location: 'Bangalore', location: 'Bangalore', city: 'Bangalore', state: 'Karnataka',
  highest_qualification: 'B.Tech Computer Science',
  key_skills: 'React, TypeScript, Node.js, Redux, GraphQL',
  source: 'Referral',
};
if (ex6?.length) {
  candidateId = ex6[0].id;
  await patch(`candidates?id=eq.${candidateId}`, {
    ...PRIYA_FIELDS,
    assigned_recruiter: AARAV_ID, source_recruiter_id: AARAV_ID,
  });
  console.log(`   refreshed ${candidateId}`);
} else {
  const r = await post('candidates', {
    first_name: 'Priya', last_name: 'Sharma', email: 'priya.sharma.demo@gmail.com', phone: '9876543210',
    ...PRIYA_FIELDS,
    org_id: ORG_ID, assigned_recruiter: AARAV_ID, source_recruiter_id: AARAV_ID,
    created_by: ORG_ADMIN_ID,
    created_at: daysAgo(6, 11),
  });
  candidateId = r[0].id;
  console.log(`   created ${candidateId}`);
}

// ── 7. AI score for Priya ─────────────────────────────────────────────────────
console.log('7. AI score...');
await upsert('candidate_ai_scores', {
  candidate_id: candidateId, org_id: ORG_ID, score: 61, category: 'promising',
  breakdown: { 'Interview Stage': 23, 'Call Engagement': 15, 'Profile Completeness': 16, 'Application Quality': 7 },
  reasoning: 'Candidate has progressed to interview stage with a solid profile and referral-sourced application indicating genuine interest. Call engagement is positive and skills align well to the mandate.',
  scored_at: new Date().toISOString(),
}, 'candidate_id');

// ── 8. Bolna call log for Priya ───────────────────────────────────────────────
console.log('8. Bolna call...');
const ex8 = await get(`call_logs?demandcom_id=eq.${candidateId}&call_method=eq.bolna&select=id`);
const callAnalysis = {
  summary: 'Actively exploring opportunities. CTC 8L current, 12L expected. 30-day notice (negotiable). Open to hybrid in Bangalore. Engaged and positive throughout.',
  next_step: 'Send formal offer letter', interest_level: 'high', expected_ctc: 1200000, notice_period_days: 30,
};
const transcript = `Agent: Hi, may I speak with Priya?
Priya: Yes, speaking.
Agent: Hi Priya, I'm calling from In-Sync regarding the Senior Frontend Developer position at TechCorp Solutions. Do you have a few minutes?
Priya: Yes of course, go ahead.
Agent: Are you currently open to new opportunities?
Priya: Yes, I have been exploring for a while now.
Agent: What is your current CTC?
Priya: I'm at eight lakhs currently.
Agent: And expected CTC for the right role?
Priya: Twelve to thirteen lakhs.
Agent: Your notice period?
Priya: Thirty days, but negotiable. I can try for an early release.
Agent: The role is hybrid from Bangalore. Is that comfortable?
Priya: Yes absolutely, I'm based in Bangalore.
Agent: Excellent. We'll share the offer details by email shortly. Thank you Priya.
Priya: Thank you, looking forward to it.`;
// Screening call = 2 days before recording; a manual first-touch call by Aarav
// the day before that. IMPORTANT: any confirmation call from a previous take is
// deleted so the tension scene can re-create it live during recording.
await rest('DELETE', `call_logs?demandcom_id=eq.${candidateId}&bolna_execution_id=eq.demo-confirm-${candidateId.slice(0,8)}`);
const bolnaFields = {
  status: 'completed', conversation_duration: 305, transcript, analysis_json: callAnalysis,
  analysis_quality_score: 82, initiated_by: AARAV_ID, disposition: 'Connected',
  start_time: daysAgo(2, 15), end_time: daysAgo(2, 15, 5), created_at: daysAgo(2, 15),
};
if (ex8?.length) {
  await patch(`call_logs?id=eq.${ex8[0].id}`, bolnaFields);
} else {
  await post('call_logs', {
    demandcom_id: candidateId, org_id: ORG_ID, from_number: 'bolna-ai', to_number: '9876543210',
    direction: 'outbound-api', call_method: 'bolna',
    bolna_execution_id: `demo-exec-${candidateId.slice(0,8)}`,
    ...bolnaFields,
  });
}
// Manual first-touch call by Aarav (assessment conversation), 3 days ago
const exManual = await get(`call_logs?demandcom_id=eq.${candidateId}&call_method=eq.phone&select=id`);
const manualFields = {
  status: 'completed', conversation_duration: 260, disposition: 'Connected',
  subdisposition: 'Interested', initiated_by: AARAV_ID,
  start_time: daysAgo(3, 12, 10), end_time: daysAgo(3, 12, 14), created_at: daysAgo(3, 12, 10),
};
if (exManual?.length) {
  await patch(`call_logs?id=eq.${exManual[0].id}`, manualFields);
} else {
  await post('call_logs', {
    demandcom_id: candidateId, org_id: ORG_ID, from_number: '08039591920', to_number: '9876543210',
    direction: 'outbound-api', call_method: 'phone', call_sid: `demo-priya-manual`,
    ...manualFields,
  });
}

// ── 9. Siddharth's desk candidates (7 more alongside Priya) ─────────────────
console.log('9. Siddharth desk candidates...');
const DESK_CANDIDATES = [
  { fn: 'Kavya',  ln: 'Nair',    phone: '9871000001', desig: 'React Developer',         cur: 7,  exp: 11, stage: 'Interview',   src: 'LinkedIn',           pos: 'Senior Frontend Developer', next: TODAY, day: 16 },
  { fn: 'Rohan',  ln: 'Mehta',   phone: '9871000002', desig: 'Software Engineer',        cur: 5,  exp: 9,  stage: 'Screening',   src: 'Naukri',             pos: 'Full Stack Developer',       next: TODAY, day: 20 },
  { fn: 'Arjun',  ln: 'Sethi',   phone: '9871000003', desig: 'Tech Lead',                cur: 10, exp: 16, stage: 'Interview',   src: 'LinkedIn',           pos: 'Python Data Scientist',      next: null,         day: 18, email: 'arjun.sethi.sid@ats-demo.in' },
  { fn: 'Sunita', ln: 'Menon',   phone: '9871000004', desig: 'Product Manager',          cur: 12, exp: 18, stage: 'Offer',       src: 'Referral',           pos: 'Senior Frontend Developer',  next: null,         day: 10, email: 'sunita.menon.sid@ats-demo.in' },
  { fn: 'Anisha', ln: 'Gupta',   phone: '9871000005', desig: 'UI Designer',              cur: 6,  exp: 10, stage: 'Offer',       src: 'LinkedIn',           pos: 'UI/UX Designer',             next: null,         day: 22 },
  { fn: 'Ravi',   ln: 'Bose',    phone: '9871000006', desig: 'Backend Developer',        cur: 7,  exp: 11, stage: 'Shortlisted', src: 'Job Portal',         pos: 'DevOps / Cloud Engineer',    next: null,         day: 24, email: 'ravi.bose.sid@ats-demo.in' },
  { fn: 'Tarun',  ln: 'Sharma',  phone: '9871000007', desig: 'Sales Head',               cur: 18, exp: 24, stage: 'Selected',    src: 'Employee Referral',  pos: 'Area Sales Manager',         next: null,         day: 8 },
];
// Shared realism pools — company / location / rating / experience derived per candidate
const COMPANY_POOL = ['Infosys', 'TCS', 'Wipro', 'HCLTech', 'Accenture', 'Cognizant', 'Zoho', 'Freshworks', 'Flipkart', 'Swiggy', 'Razorpay', 'PhonePe', 'Mindtree', 'Persistent Systems', 'Mphasis'];
const LOCATION_POOL = ['Bangalore', 'Pune', 'Hyderabad', 'Mumbai', 'Chennai', 'Gurgaon', 'Noida', 'Bangalore', 'Pune', 'Hyderabad'];
const RATING_POOL = [4, 3, 5, 4, 3, 4, 5, 3, 4, 4];
const expFromCtc = (ctcLakhs) => Math.min(20, Math.max(1, Math.round(ctcLakhs * 0.7)));
const enrichAt = (i, ctc) => ({
  current_company: COMPANY_POOL[i % COMPANY_POOL.length],
  current_location: LOCATION_POOL[i % LOCATION_POOL.length],
  rating: RATING_POOL[i % RATING_POOL.length],
  total_experience_years: expFromCtc(ctc),
});

const deskIds = [candidateId];
for (let di = 0; di < DESK_CANDIDATES.length; di++) {
  const d = DESK_CANDIDATES[di];
  const emailKey = d.email || `${d.fn.toLowerCase()}.${d.ln.toLowerCase()}.sid@ats-demo.in`;
  const ex = await get(`candidates?email=eq.${encodeURIComponent(emailKey)}&org_id=eq.${ORG_ID}&select=id`);
  const enrich = { ...enrichAt(di, d.cur), source_recruiter_id: ORG_ADMIN_ID };
  let cid;
  if (ex?.length) {
    cid = ex[0].id;
    await patch(`candidates?id=eq.${cid}`, { interview_stage: d.stage, assigned_recruiter: ORG_ADMIN_ID, next_call_date: d.next, position_applied_for: d.pos, ...enrich });
  } else {
    const r = await post('candidates', {
      first_name: d.fn, last_name: d.ln, email: emailKey, phone: d.phone,
      designation: d.desig, current_ctc_lakhs: d.cur, expected_ctc_lakhs: d.exp,
      interview_stage: d.stage, current_status: 'applied', source: d.src,
      position_applied_for: d.pos, next_call_date: d.next, notice_period_days: 30,
      org_id: ORG_ID, assigned_recruiter: ORG_ADMIN_ID, created_by: ORG_ADMIN_ID,
      created_at: demoDay(d.day, 11), ...enrich,
    });
    cid = r[0].id;
  }
  deskIds.push(cid);
}
console.log(`   ${deskIds.length} desk candidates`);

// ── 10. Bulk candidate pool ────────────────────────────────────────────────────
console.log('10. Bulk candidates...');
// [ fn, ln, email_suffix, phone, desig, cur, exp, stage, src, pos_title, notice, rec_id, created_day, hired? ]
const BULK = [
  // Aarav's pool (20) — Senior, active, Interview/Offer heavy
  ['Vikram',    'Singh',    'vikram.singh.aarav',    '9880100001', 'Data Scientist',        11, 18, 'Interview',   'LinkedIn',          'Python Data Scientist',      45, AARAV_ID,  2,  false],
  ['Meghna',    'Roy',      'meghna.roy.aarav',      '9880100002', 'Frontend Developer',    9,  14, 'Offer',       'LinkedIn',          'Senior Frontend Developer',  30, AARAV_ID,  3,  false],
  ['Sumit',     'Verma',    'sumit.verma.aarav',     '9880100003', 'Full Stack Developer',  8,  13, 'Interview',   'Naukri',            'Full Stack Developer',        60, AARAV_ID,  4,  false],
  ['Pallavi',   'Mishra',   'pallavi.mishra.aarav',  '9880100004', 'DevOps Engineer',       10, 16, 'Screening',   'LinkedIn',          'DevOps / Cloud Engineer',    30, AARAV_ID,  5,  false],
  ['Karthik',   'Nair',     'karthik.nair.aarav',    '9880100005', 'Python Developer',      9,  15, 'Interview',   'Job Portal',        'Python Data Scientist',      45, AARAV_ID,  6,  false],
  ['Nisha',     'Mehta',    'nisha.mehta.aarav',     '9880100006', 'Sales Manager',         14, 20, 'Offer',       'Referral',          'Area Sales Manager',         30, AARAV_ID,  7,  false],
  ['Aryan',     'Das',      'aryan.das.aarav',       '9880100007', 'Backend Developer',     8,  14, 'Selected',    'LinkedIn',          'Full Stack Developer',       15, AARAV_ID,  8,  false],
  ['Shilpa',    'Joshi',    'shilpa.joshi.aarav',    '9880100008', 'Credit Analyst',        10, 16, 'Interview',   'Job Portal',        'Credit Risk Analyst',        30, AARAV_ID,  9,  false],
  ['Tanvi',     'Shah',     'tanvi.shah.aarav',      '9880100009', 'UI/UX Designer',        7,  12, 'Shortlisted', 'LinkedIn',          'UI/UX Designer',             60, AARAV_ID,  10, false],
  ['Pradeep',   'Rao',      'pradeep.rao.aarav',     '9880100010', 'Full Stack Developer',  9,  14, 'Screening',   'Job Portal',        'Full Stack Developer',       30, AARAV_ID,  11, false],
  ['Ananya',    'Pillai',   'ananya.pillai.aarav',   '9880100011', 'Data Scientist',        12, 18, 'Interview',   'Referral',          'Python Data Scientist',      45, AARAV_ID,  12, false],
  ['Saurabh',   'Kumar',    'saurabh.kumar.aarav',   '9880100012', 'DevOps Engineer',       11, 17, 'Shortlisted', 'LinkedIn',          'DevOps / Cloud Engineer',    30, AARAV_ID,  13, false],
  ['Ritu',      'Bansal',   'ritu.bansal.aarav',     '9880100013', 'Sales Manager',         12, 18, 'Interview',   'Walk-in',           'Area Sales Manager',         30, AARAV_ID,  14, false],
  ['Mohan',     'Iyer',     'mohan.iyer.aarav',      '9880100014', 'Frontend Developer',    10, 16, 'Offer',       'Employee Referral', 'Senior Frontend Developer',  60, AARAV_ID,  15, false],
  ['Deepika',   'Patel',    'deepika.patel.aarav',   '9880100015', 'Credit Analyst',        11, 18, 'Selected',    'LinkedIn',          'Credit Risk Analyst',        30, AARAV_ID,  16, true ],
  ['Ajay',      'Sharma',   'ajay.sharma.aarav',     '9880100016', 'Operations Manager',    20, 30, 'Screening',   'Referral',          'Operations Head',            45, AARAV_ID,  17, false],
  ['Swathi',    'Reddy',    'swathi.reddy.aarav',    '9880100017', 'Supply Chain Analyst',  6,  10, 'Shortlisted', 'LinkedIn',          'Supply Chain Analyst',       60, AARAV_ID,  18, false],
  ['Nikhil',    'Bose',     'nikhil.bose.aarav',     '9880100018', 'Full Stack Developer',  8,  13, 'Interview',   'Job Portal',        'Full Stack Developer',       30, AARAV_ID,  19, false],
  ['Priyanka',  'Nair',     'priyanka.nair.aarav',   '9880100019', 'Frontend Developer',    9,  14, 'Interview',   'LinkedIn',          'Senior Frontend Developer',  30, AARAV_ID,  20, false],
  ['Raghav',    'Menon',    'raghav.menon.aarav',    '9880100020', 'Python Developer',      13, 20, 'Offer',       'Referral',          'Python Data Scientist',      15, AARAV_ID,  21, false],
  // Neha's pool (15)
  ['Aditya',    'Sharma',   'aditya.sharma.neha',    '9880200001', 'Full Stack Developer',  9,  14, 'Interview',   'LinkedIn',          'Full Stack Developer',       30, NEHA_ID,   4,  false],
  ['Lavanya',   'Iyer',     'lavanya.iyer.neha',     '9880200002', 'UI/UX Designer',        8,  13, 'Offer',       'LinkedIn',          'UI/UX Designer',             30, NEHA_ID,   5,  false],
  ['Sameer',    'Khan',     'sameer.khan.neha',      '9880200003', 'Credit Analyst',        10, 16, 'Interview',   'Job Portal',        'Credit Risk Analyst',        60, NEHA_ID,   6,  false],
  ['Pooja',     'Malhotra', 'pooja.malhotra.neha',   '9880200004', 'Supply Chain Analyst',  6,  9,  'Screening',   'LinkedIn',          'Supply Chain Analyst',       30, NEHA_ID,   7,  false],
  ['Nitin',     'Gupta',    'nitin.gupta.neha',      '9880200005', 'Sales Manager',         12, 18, 'Shortlisted', 'Walk-in',           'Area Sales Manager',         45, NEHA_ID,   8,  false],
  ['Vaishali',  'Singh',    'vaishali.singh.neha',   '9880200006', 'DevOps Engineer',       11, 17, 'Interview',   'LinkedIn',          'DevOps / Cloud Engineer',    30, NEHA_ID,   9,  false],
  ['Rohit',     'Kumar',    'rohit.kumar.neha',      '9880200007', 'Data Scientist',        10, 16, 'Screening',   'Naukri',            'Python Data Scientist',      45, NEHA_ID,   10, false],
  ['Isha',      'Patel',    'isha.patel.neha',       '9880200008', 'Frontend Developer',    10, 16, 'Offer',       'Employee Referral', 'Senior Frontend Developer',  30, NEHA_ID,   11, false],
  ['Manish',    'Rao',      'manish.rao.neha',       '9880200009', 'Operations Manager',    22, 32, 'Screening',   'Referral',          'Operations Head',            60, NEHA_ID,   12, false],
  ['Divya',     'Shah',     'divya.shah.neha',       '9880200010', 'Frontend Developer',    8,  13, 'Interview',   'LinkedIn',          'Senior Frontend Developer',  30, NEHA_ID,   13, false],
  ['Harish',    'Nair',     'harish.nair.neha',      '9880200011', 'Full Stack Developer',  9,  14, 'Shortlisted', 'LinkedIn',          'Full Stack Developer',       45, NEHA_ID,   14, false],
  ['Preethi',   'Menon',    'preethi.menon.neha',    '9880200012', 'Credit Analyst',        11, 18, 'Selected',    'Job Portal',        'Credit Risk Analyst',        0,  NEHA_ID,   15, true ],
  ['Sanjay',    'Pillai',   'sanjay.pillai.neha',    '9880200013', 'UI Designer',           7,  11, 'Screening',   'Walk-in',           'UI/UX Designer',             30, NEHA_ID,   16, false],
  ['Arjuna',    'Krishnan', 'arjuna.krishnan.neha',  '9880200014', 'Python Developer',      11, 17, 'Shortlisted', 'LinkedIn',          'Python Data Scientist',      30, NEHA_ID,   17, false],
  ['Shivani',   'Bajaj',    'shivani.bajaj.neha',    '9880200015', 'Sales Manager',         13, 20, 'Interview',   'Referral',          'Area Sales Manager',         30, NEHA_ID,   18, false],
  // Divya's pool (10)
  ['Rajan',     'Mehta',    'rajan.mehta.divya',     '9880300001', 'Supply Chain Analyst',  6,  9,  'Screening',   'LinkedIn',          'Supply Chain Analyst',       30, DIVYA_ID,  7,  false],
  ['Gayatri',   'Verma',    'gayatri.verma.divya',   '9880300002', 'Frontend Developer',    7,  11, 'Screening',   'Naukri',            'Senior Frontend Developer',  60, DIVYA_ID,  8,  false],
  ['Vivek',     'Bhat',     'vivek.bhat.divya',      '9880300003', 'Operations Head',       26, 38, 'Applied',     'LinkedIn',          'Operations Head',            90, DIVYA_ID,  9,  false],
  ['Ramya',     'Iyer',     'ramya.iyer.divya',      '9880300004', 'Full Stack Developer',  7,  11, 'Shortlisted', 'LinkedIn',          'Full Stack Developer',       30, DIVYA_ID,  10, false],
  ['Chandan',   'Singh',    'chandan.singh.divya',   '9880300005', 'DevOps Engineer',       9,  14, 'Screening',   'Job Portal',        'DevOps / Cloud Engineer',    30, DIVYA_ID,  11, false],
  ['Neha',      'Desai',    'neha.desai.divya',      '9880300006', 'Credit Analyst',        9,  14, 'Interview',   'LinkedIn',          'Credit Risk Analyst',        45, DIVYA_ID,  12, false],
  ['Aakar',     'Gupta',    'aakar.gupta.divya',     '9880300007', 'Sales Manager',         11, 17, 'Shortlisted', 'Walk-in',           'Area Sales Manager',         60, DIVYA_ID,  13, false],
  ['Bhavna',    'Sharma',   'bhavna.sharma.divya',   '9880300008', 'Data Scientist',        10, 16, 'Screening',   'LinkedIn',          'Python Data Scientist',      30, DIVYA_ID,  14, false],
  ['Tushar',    'Nair',     'tushar.nair.divya',     '9880300009', 'UI Designer',           6,  10, 'Applied',     'Referral',          'UI/UX Designer',             30, DIVYA_ID,  15, false],
  ['Yamini',    'Reddy',    'yamini.reddy.divya',    '9880300010', 'Frontend Developer',    8,  13, 'Interview',   'LinkedIn',          'Senior Frontend Developer',  30, DIVYA_ID,  16, false],
];

// 10a. Remove LEGACY junk candidates from older seeds (the "Not Specified" rows
// with no experience/rating that sat on top of the Candidates list on video).
console.log('10a. Removing legacy candidates...');
const legacy = await get(`candidates?org_id=eq.${ORG_ID}&email=like.*.demo%40ats-demo.in&select=id`) || [];
if (legacy.length) {
  const ids = legacy.map(c => c.id).join(',');
  await rest('DELETE', `call_logs?demandcom_id=in.(${ids})`);
  await rest('DELETE', `mandate_candidates?candidate_id=in.(${ids})`);
  await rest('DELETE', `candidate_ai_scores?candidate_id=in.(${ids})`);
  await rest('DELETE', `candidate_resumes?candidate_id=in.(${ids})`).catch(() => {});
  await rest('DELETE', `candidates?id=in.(${ids})`);
  console.log(`   deleted ${legacy.length} legacy candidates`);
}

// Fetch existing candidates by email prefix to avoid re-creating
const allCandidateEmails = new Set(
  (await get(`candidates?org_id=eq.${ORG_ID}&select=email&limit=500`) || []).map(c => c.email)
);
const bulkCandidateIds = [];
let aaravToday = 0; // schedule a few of Aarav's candidates for TODAY so his My Desk "Action Today" is live
let bi = 0;
for (const [fn, ln, emailSlug, phone, desig, cur, exp, stage, src, pos, notice, recId, day, hired] of BULK) {
  const email = `${emailSlug}@ats-demo.in`;
  let nextCall = null;
  if (recId === AARAV_ID && aaravToday < 4) { nextCall = TODAY; aaravToday++; }
  const enrich = { ...enrichAt(bi + 3, cur), source_recruiter_id: recId };
  bi++;
  let cid;
  if (allCandidateEmails.has(email)) {
    const ex = await get(`candidates?email=eq.${encodeURIComponent(email)}&org_id=eq.${ORG_ID}&select=id`);
    cid = ex[0].id;
    await patch(`candidates?id=eq.${cid}`, { interview_stage: stage, assigned_recruiter: recId, current_status: hired ? 'hired' : 'applied', next_call_date: nextCall, ...enrich });
  } else {
    const r = await post('candidates', {
      first_name: fn, last_name: ln, email, phone,
      designation: desig, current_ctc_lakhs: cur, expected_ctc_lakhs: exp,
      interview_stage: stage, current_status: hired ? 'hired' : 'applied',
      source: src, position_applied_for: pos, notice_period_days: notice,
      org_id: ORG_ID, assigned_recruiter: recId, created_by: recId, next_call_date: nextCall,
      created_at: demoDay(day, 10 + (bulkCandidateIds.length % 6)), ...enrich,
    });
    cid = r[0].id;
  }
  bulkCandidateIds.push({ cid, recId, pos, stage, fn, ln });
}
console.log(`   ${bulkCandidateIds.length} bulk candidates`);

// ── 11. Call logs — historical spread over the last 30 days ──────────────────
console.log('11. Call logs...');
// Old takes seeded calls on fixed June dates; wipe demo phone logs (keep Priya's)
// and regenerate relative to the recording day so month/today KPIs are alive.
await rest('DELETE', `call_logs?org_id=eq.${ORG_ID}&call_method=eq.phone&call_sid=like.demo-*&demandcom_id=neq.${candidateId}`);
// Fetch existing call pairs for dedup
const existingPairs = new Set(
  (await get(`call_logs?org_id=eq.${ORG_ID}&select=demandcom_id,initiated_by&limit=3000`) || [])
    .filter(cl => cl.demandcom_id && cl.initiated_by)
    .map(cl => `${cl.demandcom_id}:${cl.initiated_by}`)
);

// Day schedules per recruiter per candidate (call days in June)
// [call1_day, call2_day, call3_day, call4_day?]
const AARAV_SCHEDULE = [
  [5,14,22,27],[6,15,23,28],[7,16,24,28],[8,17,25,29],[9,18,24,27],
  [10,19,25,28],[11,20,26,29],[12,21,25,28],[13,22,26,27],[14,23,27,29],
  [15,23,26,28],[16,24,27,29],[17,24,26,28],[18,25,27,29],[19,25,27,28],
  [20,25,26,28],[21,26,28,29],[22,25,27,28],[23,26,27,29],[24,26,28,29],
];
const NEHA_SCHEDULE = [
  [8,18,26],[10,20,27],[12,22,27],[14,23,28],[16,24,27],
  [18,24,28],[19,25,29],[20,26,28],[21,26,29],[22,27,28],
  [23,27,29],[24,27,28],[25,28,29],[26,27,29],[27,28,29],
];
const DIVYA_SCHEDULE = [
  [12,22,27],[15,24,28],[18,25,28],[20,26,29],[22,26,28],
  [23,27,29],[24,27,28],[25,27,29],[26,28,29],[27,28,29],
];

const SUBDISPOSITIONS = ['Interested', 'Follow-up Scheduled', 'Details Shared', 'Considering Offer'];
let dispSeq = 0;
async function addCall(cid, recId, day, hour = 10, minute = 0, connected = true) {
  if (existingPairs.has(`${cid}:${recId}:${day}:${hour}`)) return;
  const st = demoDay(day, hour, minute);
  const dur = connected ? 90 + Math.floor(Math.random() * 180) : 0;
  // ~85% of calls carry a logged outcome; the rest stay pending (realistic desk)
  const hasDisposition = dispSeq++ % 7 !== 6;
  const disposition = !hasDisposition ? null : connected
    ? (dispSeq % 9 === 0 ? 'Callback Requested' : 'Connected')
    : (dispSeq % 5 === 0 ? 'Not Interested' : 'Not Reachable');
  await post('call_logs', {
    demandcom_id: cid, org_id: ORG_ID,
    from_number: '08039591920', to_number: `977${String(10000000 + day * 100 + hour).slice(1)}`,
    status: connected ? 'completed' : 'no-answer',
    direction: 'outbound-api', call_method: 'phone',
    call_sid: `demo-${cid.slice(0,6)}-${day}-${hour}`,
    conversation_duration: dur,
    disposition,
    subdisposition: disposition === 'Connected' ? SUBDISPOSITIONS[dispSeq % SUBDISPOSITIONS.length] : null,
    start_time: st, end_time: connected ? demoDay(day, hour, minute + Math.floor(dur/60)) : st,
    initiated_by: recId,
    created_at: st,
  });
  existingPairs.add(`${cid}:${recId}:${day}:${hour}`);
}

const aaravCandidates = bulkCandidateIds.filter(b => b.recId === AARAV_ID);
const nehaCandidates  = bulkCandidateIds.filter(b => b.recId === NEHA_ID);
const divyaCandidates = bulkCandidateIds.filter(b => b.recId === DIVYA_ID);

let callCount = 0;
// Last scheduled call of every second candidate is a no-answer → overall
// connection rate lands ~70-75% instead of an implausible 100%.
for (let i = 0; i < aaravCandidates.length; i++) {
  const days = AARAV_SCHEDULE[i] || [15, 22, 27];
  const hours = [9, 11, 14, 16];
  for (let j = 0; j < days.length; j++) {
    await addCall(aaravCandidates[i].cid, AARAV_ID, days[j], hours[j % 4], j * 7, j < days.length - 1 || i % 2 === 0);
    callCount++;
  }
}
for (let i = 0; i < nehaCandidates.length; i++) {
  const days = NEHA_SCHEDULE[i] || [18, 24, 28];
  const hours = [10, 13, 15];
  for (let j = 0; j < days.length; j++) {
    await addCall(nehaCandidates[i].cid, NEHA_ID, days[j], hours[j % 3], j * 5, j < days.length - 1 || i % 2 === 1);
    callCount++;
  }
}
for (let i = 0; i < divyaCandidates.length; i++) {
  const days = DIVYA_SCHEDULE[i] || [22, 27];
  const hours = [9, 14, 16];
  for (let j = 0; j < days.length; j++) {
    await addCall(divyaCandidates[i].cid, DIVYA_ID, days[j], hours[j % 3], j * 10, j < days.length - 1 || i % 2 === 0);
    callCount++;
  }
}
// TODAY's calls (the actual recording day, morning hours) so the Calling
// Dashboard KPIs are live: ~13 calls, ~70% connected, dispositions logged.
const TODAY_PLAN = [
  // [pool, poolIdx, recId, hour, min, connected, disposition, subdisposition]
  [aaravCandidates, 0, AARAV_ID, 9, 5,  true,  'Connected', 'Interested'],
  [aaravCandidates, 1, AARAV_ID, 9, 25, true,  'Connected', 'Follow-up Scheduled'],
  [aaravCandidates, 2, AARAV_ID, 9, 50, false, 'Not Reachable', null],
  [aaravCandidates, 3, AARAV_ID, 10, 10, true,  'Connected', 'Details Shared'],
  [aaravCandidates, 4, AARAV_ID, 10, 35, true,  'Callback Requested', null],
  [aaravCandidates, 5, AARAV_ID, 11, 0,  false, 'Not Reachable', null],
  [nehaCandidates,  0, NEHA_ID,  9, 15, true,  'Connected', 'Interested'],
  [nehaCandidates,  1, NEHA_ID,  9, 45, true,  'Connected', 'Considering Offer'],
  [nehaCandidates,  2, NEHA_ID,  10, 20, false, 'Not Interested', null],
  [nehaCandidates,  3, NEHA_ID,  11, 5,  true,  'Connected', 'Follow-up Scheduled'],
  [divyaCandidates, 0, DIVYA_ID, 9, 35, true,  'Connected', 'Interested'],
  [divyaCandidates, 1, DIVYA_ID, 10, 45, true,  'Callback Requested', null],
  [divyaCandidates, 2, DIVYA_ID, 11, 30, null,  null, null], // pending disposition
];
for (const [pool, idx, recId, hour, min, connected, disposition, subdisposition] of TODAY_PLAN) {
  const c = pool[idx];
  if (!c) continue;
  const isConn = connected !== false;
  const dur = isConn ? 100 + ((hour * 60 + min) % 160) : 0;
  const st = daysAgo(0, hour, min);
  await post('call_logs', {
    demandcom_id: c.cid, org_id: ORG_ID,
    from_number: '08039591920', to_number: `988${String(10000000 + hour * 137 + min).slice(1)}`,
    status: isConn ? 'completed' : 'no-answer',
    direction: 'outbound-api', call_method: 'phone',
    call_sid: `demo-today-${c.cid.slice(0,6)}-${hour}${min}`,
    conversation_duration: dur, disposition, subdisposition,
    start_time: st, end_time: isConn ? daysAgo(0, hour, min + Math.ceil(dur / 60)) : st,
    initiated_by: recId, created_at: st,
  });
  callCount++;
}
console.log(`   ${callCount} call logs created`);

// ── 12. Onboarding form ────────────────────────────────────────────────────────
console.log('12. Onboarding form...');
const ex12 = await get(`onboarding_forms?org_id=eq.${ORG_ID}&is_active=eq.true&select=id,slug`);
let formId, formSlug;
if (ex12?.length) { formId = ex12[0].id; formSlug = ex12[0].slug; }
else {
  formSlug = 'onboard-insync-2026';
  const r = await post('onboarding_forms', {
    org_id: ORG_ID, title: 'New Hire Onboarding',
    description: 'Please fill in your details and upload the required documents.',
    slug: formSlug, is_active: true, created_by: ORG_ADMIN_ID,
  });
  formId = r[0].id;
}

// ── 13. Onboarding submission for Priya ───────────────────────────────────────
console.log('13. Onboarding submission...');
const aiReview = {
  risk_score: 12, recommendation: 'Approve',
  findings: ['PAN format valid (ABCPS1234F)', 'Aadhaar format valid (12 digits)', 'IFSC HDFC0001234 is valid', 'Bank account complete', 'No fraud signals detected'],
  summary: 'All documents appear complete and valid. Identity details internally consistent. Recommend approval.',
};
const ex13 = await get(`onboarding_submissions?candidate_id=eq.${candidateId}&select=id`);
if (ex13?.length) {
  await patch(`onboarding_submissions?id=eq.${ex13[0].id}`, { status: 'documents_under_review', ai_review_result: aiReview, ai_review_at: new Date().toISOString() });
} else {
  await post('onboarding_submissions', {
    form_id: formId, org_id: ORG_ID, candidate_id: candidateId,
    full_name: 'Priya Sharma', gender: 'Female', date_of_birth: '1998-03-15',
    marital_status: 'Single', blood_group: 'B+',
    qualifications: 'B.Tech Computer Science, VIT University, 2020',
    contact_number: '9876543210', personal_email: 'priya.sharma.demo@gmail.com', email_verified: true,
    pan_number: 'ABCPS1234F', aadhar_number: '123456789012', uan_number: '',
    father_name: 'Rajesh Sharma', mother_name: 'Sunita Sharma', emergency_contact_number: '9812345678',
    present_address: '42 Koramangala 5th Block, Bangalore 560095',
    permanent_address: '12 Civil Lines, Jaipur 302006',
    bank_name: 'HDFC Bank', account_number: '50100987654321', ifsc_code: 'HDFC0001234', branch_name: 'Koramangala Branch',
    status: 'documents_under_review', ai_review_result: aiReview, ai_review_at: new Date().toISOString(),
  });
}

// ── 14. Mandate candidates (pipeline chart) ───────────────────────────────────
console.log('14. Mandate candidates...');
// Map interview_stage → mandate_candidates.current_stage (must match Dashboard pipelineStages)
const stageMap = {
  'Applied': 'submitted', 'Screening': 'shortlisted', 'Shortlisted': 'shortlisted',
  'Interview': 'interviewing', 'Offer': 'selected', 'Selected': 'selected', 'Hired': 'hired',
};
// Map position title → mandate id
const posToMandate = {};
for (const md of MANDATE_DEFS) { posToMandate[md.job_title] = M(md.job_title); }

// Collect all candidates with their positions
const allForPipeline = [
  { id: candidateId, stage: 'Interview', pos: 'Senior Frontend Developer' },
  ...DESK_CANDIDATES.map((d, i) => ({ id: deskIds[i+1], stage: d.stage, pos: d.pos })),
  ...bulkCandidateIds.map(b => ({ id: b.cid, stage: b.stage, pos: b.pos })),
];
// Fetch all existing (mandate_id, candidate_id) pairs across our mandates
const allMandateIds = Object.values(mandateIds).join(',');
const ex14rows = await get(`mandate_candidates?mandate_id=in.(${allMandateIds})&select=mandate_id,candidate_id&limit=2000`);
const ex14set = new Set((ex14rows || []).map(r => `${r.mandate_id}:${r.candidate_id}`));
let mcCount = 0;
for (const c of allForPipeline) {
  const mid = posToMandate[c.pos] || mandateId;
  if (ex14set.has(`${mid}:${c.id}`)) continue;
  const mcStage = stageMap[c.stage] || 'submitted';
  const status  = c.stage === 'Rejected' ? 'inactive' : 'active';
  try {
    await post('mandate_candidates', { mandate_id: mid, candidate_id: c.id, current_stage: mcStage, status, created_by: ORG_ADMIN_ID });
    mcCount++;
  } catch (e) { /* skip FK conflicts */ }
}
console.log(`   ${mcCount} linked`);

// ── 15. Demo team ─────────────────────────────────────────────────────────────
console.log('15. Team...');
const ex15 = await get(`teams?name=eq.Talent+Acquisition+Alpha&org_id=eq.${ORG_ID}&select=id`);
let teamId;
if (ex15?.length) {
  teamId = ex15[0].id;
} else {
  const r = await post('teams', { name: 'Talent Acquisition Alpha', description: 'Core recruiting team for tech and finance mandates', team_lead_id: ORG_ADMIN_ID, is_active: true, org_id: ORG_ID, created_by: ORG_ADMIN_ID });
  teamId = r[0].id;
}
for (const uid of [ORG_ADMIN_ID, AARAV_ID, NEHA_ID, DIVYA_ID]) {
  const ex = await get(`team_members?team_id=eq.${teamId}&user_id=eq.${uid}&select=id`);
  if (!ex?.length) await post('team_members', { team_id: teamId, user_id: uid, role_in_team: 'member', is_active: true });
}

// ── 16. Pipeline stages ───────────────────────────────────────────────────────
console.log('16. Pipeline stages...');
const STAGES = [
  { name: 'Applied',      stage_order: 1, stage_type: 'candidate', color: '#94a3b8', description: 'New application received' },
  { name: 'Screening',    stage_order: 2, stage_type: 'candidate', color: '#f59e0b', description: 'Initial screening call or review' },
  { name: 'Interview',    stage_order: 3, stage_type: 'candidate', color: '#3b82f6', description: 'Interview rounds in progress' },
  { name: 'Offer',        stage_order: 4, stage_type: 'candidate', color: '#8b5cf6', description: 'Offer letter extended' },
  { name: 'Selected',     stage_order: 5, stage_type: 'candidate', color: '#10b981', description: 'Candidate selected and confirmed' },
  { name: 'Joined',       stage_order: 6, stage_type: 'candidate', color: '#059669', description: 'Candidate has joined the organisation' },
];
const ex16 = await get(`pipeline_stages?org_id=eq.${ORG_ID}&select=name`);
const existingStageNames = new Set((ex16 || []).map(s => s.name));
for (const s of STAGES) {
  if (!existingStageNames.has(s.name)) {
    await post('pipeline_stages', { ...s, org_id: ORG_ID, is_active: true });
  }
}

// ── 17. WhatsApp templates ────────────────────────────────────────────────────
console.log('17. WhatsApp templates...');
const WA_TEMPLATES = [
  { name: 'Initial Outreach', category: 'Sourcing', merge_tags: ['{{candidate_name}}','{{job_title}}','{{company}}'],
    body: `Hi {{candidate_name}}, I'm reaching out from In-Sync regarding an exciting opportunity — {{job_title}} at {{company}}. The role offers great growth potential and a competitive package. Would you be open to a quick 10-minute call this week? 🙏` },
  { name: 'Interview Confirmation', category: 'Interview', merge_tags: ['{{candidate_name}}','{{interview_date}}','{{interview_time}}','{{meeting_link}}'],
    body: `Hi {{candidate_name}}, your interview is confirmed for {{interview_date}} at {{interview_time}}. Meeting link: {{meeting_link}}. Please keep your resume handy. Best of luck! 👍` },
  { name: 'Offer Follow-up', category: 'Offer', merge_tags: ['{{candidate_name}}','{{offer_amount}}','{{joining_date}}'],
    body: `Hi {{candidate_name}}, just following up on the offer letter sent earlier. Your package is ₹{{offer_amount}} LPA with a joining date of {{joining_date}}. Do let us know if you have any questions — happy to help! 😊` },
];
const ex17 = await get(`whatsapp_templates?org_id=eq.${ORG_ID}&select=name`);
const existingWA = new Set((ex17 || []).map(t => t.name));
for (const t of WA_TEMPLATES) {
  if (!existingWA.has(t.name)) {
    await post('whatsapp_templates', { ...t, org_id: ORG_ID, is_active: true, created_by: ORG_ADMIN_ID });
  }
}

// ── 18. Email templates ───────────────────────────────────────────────────────
console.log('18. Email templates...');
const EMAIL_TEMPLATES = [
  { name: 'Formal Offer Letter', subject: 'Offer of Employment — {{job_title}} at {{company}}', category: 'Offer',
    merge_tags: ['{{candidate_name}}','{{job_title}}','{{company}}','{{ctc}}','{{joining_date}}'],
    body_html: `<p>Dear {{candidate_name}},</p><p>We are delighted to offer you the position of <strong>{{job_title}}</strong> at <strong>{{company}}</strong>.</p><p><strong>CTC:</strong> ₹{{ctc}} LPA<br><strong>Joining Date:</strong> {{joining_date}}</p><p>Please confirm your acceptance within 3 working days. Looking forward to welcoming you to the team!</p><p>Warm regards,<br>In-Sync Talent Team</p>`,
    body_text: `Dear {{candidate_name}}, We are pleased to offer you the role of {{job_title}} at {{company}}. CTC: {{ctc}} LPA. Joining: {{joining_date}}.` },
  { name: 'Interview Invitation', subject: 'Interview Invitation — {{job_title}} at {{company}}', category: 'Interview',
    merge_tags: ['{{candidate_name}}','{{job_title}}','{{company}}','{{interview_date}}','{{meeting_link}}'],
    body_html: `<p>Dear {{candidate_name}},</p><p>We would like to invite you for an interview for the role of <strong>{{job_title}}</strong> at <strong>{{company}}</strong>.</p><p><strong>Date & Time:</strong> {{interview_date}}<br><strong>Meeting Link:</strong> <a href="{{meeting_link}}">{{meeting_link}}</a></p><p>Please confirm your availability. We look forward to speaking with you.</p>`,
    body_text: `Dear {{candidate_name}}, Interview for {{job_title}} at {{company}} on {{interview_date}}. Link: {{meeting_link}}` },
  { name: 'Document Request', subject: 'Action Required: Documents for Onboarding — {{company}}', category: 'Onboarding',
    merge_tags: ['{{candidate_name}}','{{company}}','{{onboarding_link}}'],
    body_html: `<p>Dear {{candidate_name}},</p><p>Congratulations and welcome to <strong>{{company}}</strong>! To complete your onboarding, please submit your documents via the secure link below:</p><p><a href="{{onboarding_link}}">{{onboarding_link}}</a></p><p>Documents required: PAN card, Aadhaar, Bank details, and educational certificates.</p><p>Please complete this within 48 hours. Reach out if you need any assistance.</p>`,
    body_text: `Dear {{candidate_name}}, Please complete your onboarding for {{company}} here: {{onboarding_link}}` },
];
const ex18 = await get(`email_templates?org_id=eq.${ORG_ID}&select=name`);
const existingEmail = new Set((ex18 || []).map(t => t.name));
for (const t of EMAIL_TEMPLATES) {
  if (!existingEmail.has(t.name)) {
    await post('email_templates', { ...t, org_id: ORG_ID, is_active: true, created_by: ORG_ADMIN_ID });
  }
}

// ── 19. Referral code ─────────────────────────────────────────────────────────
const adminProfile = await get(`profiles?id=eq.${ORG_ADMIN_ID}&select=referral_code`);
const referralCode = adminProfile?.[0]?.referral_code
  || (await get(`profiles?id=eq.${AARAV_ID}&select=referral_code`))?.[0]?.referral_code
  || '2f648768';

// ── 20. Write seed-state.json ─────────────────────────────────────────────────
const state = {
  orgId: ORG_ID, orgAdminId: ORG_ADMIN_ID,
  referralCode, clientId, mandateId, candidateId, formId, formSlug,
  recruiterIds: REC_DEFS.map(r => ({ id: recMap[r.full_name], name: r.full_name })),
  seededAt: new Date().toISOString(),
};
writeFileSync(join(here, 'seed-state.json'), JSON.stringify(state, null, 2));

console.log('\n✓ Seed complete.');
console.log(`  Login: siddharth.roy@insync-demo.in / ${DEMO_PASSWORD}`);
console.log(`  Referral: ${referralCode}  Candidate: ${candidateId}`);
console.log(`  Careers: /careers/in-sync-demo  Apply: /apply/${referralCode}`);
