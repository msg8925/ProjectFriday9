/* =====================================================================
   Marking engine. Contains NO answers — it marks against an answer key.
   The same file runs in two places:
     • Google Apps Script (as Marking.gs) — the real marking, on the server
     • the test page, only for the teacher's local preview (no server set up)
   ===================================================================== */
function markSubmission(KEY, answers) {
  answers = answers || {};
  var res = { parts: {}, total: 0, max: 0, answered: 0, partCount: KEY.parts.length, solutions: {}, revise: [] };
  var bySec = {}, bySkill = {};
  function add(map, k, s, m) { map[k] = map[k] || { score: 0, max: 0 }; map[k].score += s; map[k].max += m; }
  KEY.parts.forEach(function (p) {
    var r = markPart_(p, answers[p.id]);
    res.parts[p.id] = r;
    res.total += r.score; res.max += p.marks;
    if (r.status !== 'none') res.answered++;
    add(bySec, p.section, r.score, p.marks); add(bySkill, p.skill, r.score, p.marks);
    if (r.score < p.marks) res.revise.push({ section: p.section, topic: p.topic, q: p.full, lost: p.marks - r.score });
    res.solutions[p.id] = { key: p.key, answer: p.answer, explain: p.explain };
  });
  res.percent = res.max ? Math.round(res.total / res.max * 1000) / 10 : 0;
  res.grade = gradeFor_(KEY.meta.gradeBoundaries, res.percent);
  res.bySection = KEY.sections.map(function (s) { var v = bySec[s.id] || { score: 0, max: 0 }; return { id: s.id, name: s.name, score: v.score, max: v.max }; });
  res.bySkill = KEY.skills.map(function (s) { var v = bySkill[s.id] || { score: 0, max: 0 }; return { id: s.id, name: s.name, score: v.score, max: v.max }; }).filter(function (s) { return s.max; });
  res.byQuestion = KEY.parts.map(function (p) { return { id: p.id, q: p.full, score: res.parts[p.id].score, max: p.marks }; });
  return res;
}

function answered_(a) {
  if (a == null || a === '') return false;
  if (Array.isArray(a)) return a.length > 0;
  if (typeof a === 'object') { for (var k in a) if (a[k] !== '' && a[k] != null) return true; return false; }
  return true;
}

function markPart_(p, a) {
  var r = { score: 0, max: p.marks, items: {}, status: 'none' };
  if (!answered_(a)) return r;
  var K = p.key, got = 0, i;
  switch (p.type) {
    case 'mcq':
      if (String(a) === String(K)) r.score = p.marks; break;
    case 'bits':
      var bits = String(a).replace(/[^01]/g, '');
      for (i = 0; i < K.length; i++) r.items[i] = bits.charAt(i) === K.charAt(i);
      if (bits === K) r.score = p.marks; break;
    case 'errline':
      if (Number(a) === K) r.score = p.marks; break;
    case 'select': case 'tick': case 'match':
      for (i = 0; i < K.length; i++) { var ok = a[i] != null && a[i] !== '' && String(a[i]) === String(K[i]); r.items[i] = ok; if (ok) got++; }
      r.score = Math.floor(got * p.marks / K.length); break;
    case 'order':
      if (!Array.isArray(a)) break;
      for (i = 0; i < K.length; i++) { r.items[i] = a[i] === K[i]; if (r.items[i]) got++; }
      if (p.scoring === 'pairs') {
        // credit each item that directly follows the item it should follow
        var pos = {}, pairs = 0;
        for (i = 0; i < K.length; i++) pos[K[i]] = i;
        for (i = 0; i < a.length - 1; i++) if (pos[a[i + 1]] === pos[a[i]] + 1) pairs++;
        r.score = Math.floor(pairs * p.marks / (K.length - 1));
      } else r.score = got === K.length ? p.marks : (p.marks > 1 && got >= K.length - 2 && isOneSwap_(a, K)) ? p.marks - 1 : 0;
      break;
  }
  r.status = r.score >= p.marks ? 'full' : r.score > 0 ? 'part' : 'zero';
  return r;
}
function isOneSwap_(a, K) {
  if (a.length !== K.length) return false;
  var diff = [];
  for (var i = 0; i < K.length; i++) if (a[i] !== K[i]) diff.push(i);
  return diff.length === 2 && a[diff[0]] === K[diff[1]] && a[diff[1]] === K[diff[0]];
}
function gradeFor_(bounds, percent) {
  var b = (bounds || []).slice().sort(function (x, y) { return y.min - x.min; });
  for (var i = 0; i < b.length; i++) if (percent >= b[i].min) return b[i].grade;
  return 'U';
}
