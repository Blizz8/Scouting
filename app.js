// Small helper utilities
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const escapeHtml = s => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// --- Password utilities (client-side, stored hashed in localStorage) ---
async function hashString(str){
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function hasPassword(){ return !!localStorage.getItem('scout-pass'); }
async function verifyPassword(promptText = 'Enter password'){
  if(!hasPassword()) return true; // no password set
  const attempt = prompt(promptText);
  if(attempt === null) return false;
  const hash = await hashString(attempt);
  return hash === localStorage.getItem('scout-pass');
}

async function setPasswordFlow(){
  if(hasPassword()){
    const ok = await verifyPassword('Enter current password');
    if(!ok){ alert('Incorrect password'); return; }
  }
  const a = prompt('Enter new password (cancel to abort)');
  if(!a) return;
  const b = prompt('Confirm new password');
  if(a !== b){ alert('Passwords do not match'); return; }
  const h = await hashString(a);
  localStorage.setItem('scout-pass', h);
  alert('Password set');
}
async function clearPasswordFlow(){
  if(!hasPassword()){ alert('No password is set'); return; }
  const ok = await verifyPassword('Enter current password to clear');
  if(!ok){ alert('Incorrect password'); return; }
  localStorage.removeItem('scout-pass');
  alert('Password cleared');
}

// --- List storage helpers (shared) ---
function getListEntries(){
  const raw = localStorage.getItem('list-entries');
  if(!raw) return [
    {id:'25', text:'Team Number: 25\nTeam Name: Raider Robotix\nLeader: John Doe\nAuto Strat: Aggressive climber\nAuto Climb?: Yes\nScore Accuracy?: High\nShooting Cycle Number?: 5\nDefense Rating?: 8\nClimb Time?: 10 seconds\nEndgame Climb?: Yes', meta:{teamName:'Raider Robotix', leader:'John Doe', autoStrat:'Aggressive climber'}},
    {id:'87', text:'Team Number: 87\nTeam Name: Diablo\nLeader: Jane Smith\nAuto Strat: Balanced scorer\nAuto Climb?: No\nScore Accuracy?: Medium\nShooting Cycle Number?: 3\nDefense Rating?: 7\nClimb Time?: 15 seconds\nEndgame Climb?: No', meta:{teamName:'Diablo', leader:'Jane Smith', autoStrat:'Balanced scorer'}},
    {id:'102', text:'Team Number: 102\nTeam Name: The Gearheads\nLeader: Bob Johnson\nAuto Strat: Defensive specialist\nAuto Climb?: Yes\nScore Accuracy?: High\nShooting Cycle Number?: 6\nDefense Rating?: 9\nClimb Time?: 8 seconds\nEndgame Climb?: Yes', meta:{teamName:'The Gearheads', leader:'Bob Johnson', autoStrat:'Defensive specialist'}}
  ];
  return JSON.parse(raw);
}
function setListEntries(arr){
  localStorage.setItem('list-entries', JSON.stringify(arr));
}
function addOrUpdateListEntry(id, text, meta){
  id = String(id).trim();
  const entries = getListEntries();
  const idx = entries.findIndex(e=>String(e.id).trim() === id);
  if(idx>=0){ entries[idx].text = text; entries[idx].meta = Object.assign({}, entries[idx].meta || {}, meta || {}); }
  else { entries.push({id, text, meta: meta||{}}); }
  setListEntries(entries);
}
function removeListEntryById(id){
  id = String(id);
  let entries = getListEntries();
  entries = entries.filter(e=>String(e.id) !== id);
  setListEntries(entries);
}

// --- List (page2) ---
function initListPage(){
  const list = $('#number-list');
  if(!list) return;

  const savedList = $('#saved-list');
  const addBtn = $('#add-entry');
  const setPwdBtn = $('#set-password');
  const clearPwdBtn = $('#clear-password');

  setPwdBtn.addEventListener('click', setPasswordFlow);
  clearPwdBtn.addEventListener('click', clearPasswordFlow);
  if(addBtn) addBtn.addEventListener('click', ()=>{ addEntry(); });

  function renderList(){
    const entries = getListEntries();
    // sort: numeric if possible
    entries.sort((a,b)=>{
      const na = Number(a.id), nb = Number(b.id);
      if(!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a.id).localeCompare(String(b.id));
    });

    list.innerHTML = entries.map(e=>`<li data-id="${escapeHtml(String(e.id))}"><button class="num-btn">${escapeHtml(String(e.id))}</button> <button class="del btn-inline" data-id="${escapeHtml(String(e.id))}">Delete</button>
      <div class="info" hidden>
        <textarea rows="6">${escapeHtml(e.text||'')}</textarea>
        <div class="controls"><button class="save">Save</button></div>
      </div>
    </li>`).join('');

    $$('#number-list li').forEach(li=>{
      const id = String(li.dataset.id);
      const btn = li.querySelector('.num-btn');
      const del = li.querySelector('.del');
      const info = li.querySelector('.info');
      const ta = li.querySelector('textarea');
      const saveBtn = li.querySelector('.save');

      btn.addEventListener('click', ()=> info.hidden = !info.hidden );

      saveBtn.addEventListener('click', async ()=>{
        const ok = await verifyPassword('Enter password to save changes');
        if(!ok){ alert('Canceled or incorrect password'); return; }
        const entries = getListEntries();
        const idx = entries.findIndex(x=>String(x.id)===id);
        if(idx>=0){ entries[idx].text = ta.value; setListEntries(entries); renderList(); renderSavedList(); alert('Saved'); }
      });

      del.addEventListener('click', async ()=>{
        const ok = await verifyPassword('Enter password to delete this entry');
        if(!ok){ alert('Canceled or incorrect password'); return; }
        removeListEntryById(id);
        renderList(); renderSavedList();
      });
    });
  }

  function renderSavedList(){
    const entries = getListEntries();
    if(!entries.length){ savedList.innerHTML = '<li>(no entries)</li>'; return; }
    savedList.innerHTML = entries.map(e=>`<li><strong>${escapeHtml(String(e.id))}:</strong> ${escapeHtml(e.meta?.teamName || e.text || '(empty)')}</li>`).join('');
  }

  function addEntry(){
    const entries = getListEntries();
    // make a numeric-ish id if possible
    const numericIds = entries.map(x=>Number(x.id)).filter(n=>!Number.isNaN(n));
    const max = numericIds.length?Math.max(...numericIds):0;
    const next = String(max+1);
    entries.push({id:next,text:''});
    setListEntries(entries);
    renderList(); renderSavedList();
    setTimeout(()=>{ const li = $(`#number-list li[data-id="${next}"]`); if(li) li.querySelector('.num-btn').click(); }, 50);
  }

  renderList();
  renderSavedList();

  // Check for team parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const teamParam = urlParams.get('team');
  if(teamParam){
    const li = $(`#number-list li[data-id="${teamParam}"]`);
    if(li){
      li.querySelector('.num-btn').click();
    }
  }
}

// --- Form (page3) ---
const defaultQuestions = [
  {label:'Team Number', name:'teamNumber', required:true},
  {label:'Team Name', name:'teamName', required:true},
  {label:'Leader', name:'leader', required:true},
  {label:'Auto Strat', name:'autoStrat', required:true},
  {label:'Auto Climb?', name:'autoClimb', required:false},
  {label:'Score Accuracy?', name:'scoreAccuracy', required:false},
  {label:'Shooting Cycle Number?', name:'shootingCycleNumber', required:false},
  {label:'Defense Rating?', name:'defenseRating', required:false},
  {label:'Climb Time?', name:'climbTime', required:false},
  {label:'Endgame Climb?', name:'endgameClimb', required:false}
];

function loadQuestions(){
  const raw = localStorage.getItem('form-questions-v2');
  let qs = raw ? JSON.parse(raw) : defaultQuestions.slice();
  // Ensure defaults are included
  const defaultMap = new Map(defaultQuestions.map(q => [q.name, q]));
  const userQs = qs.filter(q => !defaultMap.has(q.name));
  qs = defaultQuestions.concat(userQs);
  // Remove duplicates based on name
  const seen = new Set();
  qs = qs.filter(q => {
    if(seen.has(q.name)) return false;
    seen.add(q.name);
    return true;
  });
  // Save the clean list
  localStorage.setItem('form-questions-v2', JSON.stringify(qs));
  return qs;
}
function saveQuestions(arr){
  localStorage.setItem('form-questions-v2', JSON.stringify(arr));
}

function initFormPage(){
  const form = $('#scout-form');
  if(!form) return;
  const subsList = $('#subs-list');
  const questionsContainer = $('#questions');
  const addQ = $('#add-question');
  const resetDefaults = $('#reset-defaults');
  const setPwdBtn = $('#set-password');
  const clearPwdBtn = $('#clear-password');

  setPwdBtn.addEventListener('click', setPasswordFlow);
  clearPwdBtn.addEventListener('click', clearPasswordFlow);
  addQ.addEventListener('click', ()=>{ addQuestionPrompt(); });

  // teams.json upload support (useful when serving as file:// or when fetch fails)
  const teamsFileEl = document.getElementById('teamsFile');
  const teamsFileMsg = document.getElementById('teamsFileMsg');
  if(teamsFileEl){
    teamsFileEl.addEventListener('change', e=>{
      const f = e.target.files && e.target.files[0];
      if(!f){ teamsFileMsg.style.display='none'; teamsFileMsg.textContent=''; return; }
      const reader = new FileReader();
      reader.onload = ()=>{
        try{
          const json = JSON.parse(reader.result);
          if(!Array.isArray(json)) throw new Error('teams.json must be an array');
          window.__TEAMS__ = json;
          teamsFileMsg.style.display='inline';
          teamsFileMsg.textContent='teams.json loaded from file.';
          teamsFileMsg.style.color = '#6f6';
        }catch(err){ teamsFileMsg.style.display='inline'; teamsFileMsg.textContent='Failed to parse teams.json: '+err.message; teamsFileMsg.style.color='#f66'; }
      };
      reader.readAsText(f);
    });
  }
  resetDefaults.addEventListener('click', ()=>{ saveQuestions(defaultQuestions.slice()); renderQuestions(); alert('Defaults restored'); });

  let editingIndex = null;

  function renderQuestions(){
    const qs = loadQuestions();
    questionsContainer.innerHTML = qs.map((q,idx)=>`<div class="q" data-idx="${idx}"><input class="q-label" value="${escapeHtml(q.label)}"> <input name="${escapeHtml(q.name)}" placeholder="${escapeHtml(q.label)}" ${q.required? 'required':''}> ${q.required? '': `<button class="remove-q btn-inline" data-idx="${idx}">Remove</button>`}</div>`).join('');

    // label edits
    $$('#questions .q-label').forEach((inp, i)=> inp.addEventListener('blur', ()=>{
      const qs = loadQuestions(); qs[i].label = inp.value || 'Question?'; saveQuestions(qs); renderQuestions();
    }));

    // removals
    $$('#questions .remove-q').forEach(btn=>btn.addEventListener('click', async ()=>{
      const idx = Number(btn.dataset.idx);
      const ok = await verifyPassword('Enter password to remove question');
      if(!ok){ alert('Canceled or incorrect password'); return; }
      const qs = loadQuestions(); qs.splice(idx,1); saveQuestions(qs); renderQuestions();
    }));
  }

  function addQuestionPrompt(){
    const label = prompt('Question label (e.g. "What is your team number?")');
    if(!label) return;
    const qs = loadQuestions();
    const name = 'c' + Date.now();
    qs.push({label:label, name:name, required:false});
    saveQuestions(qs); renderQuestions();
    setTimeout(()=>{ const lastInp = $(`#questions .q[data-idx="${qs.length-1}"] input[name]`); if(lastInp) lastInp.focus(); }, 50);
  }

  function loadSubs(){
    const raw = localStorage.getItem('submissions');
    return raw?JSON.parse(raw):[];
  }
  function saveSubs(arr){
    localStorage.setItem('submissions', JSON.stringify(arr));
    renderSubs();
  }

  function renderSubs(){
    const subs = loadSubs();
    if(!subs.length){ subsList.innerHTML = '<li>No submissions yet</li>'; return; }
    subsList.innerHTML = subs.map((s,idx)=>`<li><strong>#${idx+1}</strong> ${Object.values(s).map(v=>escapeHtml(v)).join(' | ')} <button data-idx="${idx}" class="edit">Edit</button> <button data-idx="${idx}" class="del">Delete</button></li>`).join('');

    $$('#subs-list .del').forEach(btn=>btn.addEventListener('click', async ()=>{
      const idx = Number(btn.dataset.idx);
      const ok = await verifyPassword('Enter password to delete submission');
      if(!ok){ alert('Canceled or incorrect password'); return; }
      const subs = loadSubs(); subs.splice(idx,1); saveSubs(subs);
    }));

    $$('#subs-list .edit').forEach(btn=>btn.addEventListener('click', async ()=>{
      const idx = Number(btn.dataset.idx);
      const ok = await verifyPassword('Enter password to edit submission');
      if(!ok){ alert('Canceled or incorrect password'); return; }
      const subs = loadSubs(); const data = subs[idx];
      // fill form
      Object.keys(data).forEach((k,i)=>{ const el = form.querySelector(`[name="${k}"]`); if(el) el.value = data[k]; });
      editingIndex = idx;
      form.querySelector('[type="submit"]').textContent = 'Save';
      window.scrollTo({top:0,behavior:'smooth'});
    }));
  }

  form.addEventListener('submit', e => { e.preventDefault(); submitPitForm(); }); // prevent default submit and call submit function

  window.submitPitForm = async ()=>{
    // Ensure questions' labels are persisted
    const labelInputs = $$('#questions .q-label');
    const qs = loadQuestions();
    labelInputs.forEach((inp,i)=>{ qs[i].label = inp.value || qs[i].label; });
    saveQuestions(qs);

    const data = Object.fromEntries(new FormData(form).entries());

    // require team number
    const teamNum = (data['teamNumber'] || data['c-teamNumber'] || '').trim();
    if(!teamNum){ alert('Team Number is required'); return; }

    // validate team number and team name (if available)
    if(window.teamRegistration && typeof window.teamRegistration.validateTeamNumberAndName === 'function'){
      try {
        const result = await window.teamRegistration.validateTeamNumberAndName(teamNum, data['teamName'] || '');
        if(!result.ok){
          if(result.reason === 'team-number-not-registered'){
            alert('Team number is not registered.');
            return;
          }
          if(result.reason === 'team-name-mismatch'){
            alert('Team name does not match the registered nickname. Expected: ' + result.expected);
            return;
          }
        }
      } catch(err){
        alert('Validation failed: ' + err.message);
        return;
      }
    }

    // build summary text and meta
    const questions = loadQuestions();
    const lines = questions.map(q=>`${q.label}: ${data[q.name] || ''}`);
    const summary = lines.join('\n');
    const meta = { teamName: data['teamName'] || '', leader: data['leader'] || '', autoStrat: data['autoStrat'] || '' };

    // save to list (data sheet)
    addOrUpdateListEntry(teamNum, summary, meta);
    // also save submission copy
    const subs = loadSubs();
    if(editingIndex === null){ subs.push(data); } else { subs[editingIndex] = data; editingIndex = null; $('#submit-btn').textContent = 'Submit'; }
    saveSubs(subs);

    form.reset();
    renderSubs();

    // refresh list page UI (if present)
    try{ if(typeof renderList === 'function') renderList(); }catch(e){}
    try{ if(typeof renderSavedList === 'function') renderSavedList(); }catch(e){}

    alert('Submission saved and data sheet updated');
  };

  $('#submit-btn').addEventListener('click', () => submitPitForm());

  $('#clear-all').addEventListener('click', ()=>{
    if(!confirm('Clear all saved submissions?')) return;
    localStorage.removeItem('submissions');
    renderSubs();
  });

  renderQuestions();
  renderSubs();
}

// --- Post-Match (page5) ---
const defaultPostMatchColumns = [
  {label:'Match', name:'match'},
  {label:'Team Number', name:'team'},
  {label:'Score', name:'score'}
];

function loadPostMatchColumns(){
  const raw = localStorage.getItem('post-match-columns');
  if(!raw) return defaultPostMatchColumns.slice();
  return JSON.parse(raw);
}
function savePostMatchColumns(arr){
  localStorage.setItem('post-match-columns', JSON.stringify(arr));
}

function initPostMatchPage(){
  const form = $('#post-match-form');
  if(!form) return;
  const tableHead = $('#table-head');
  const tableBody = $('#table-body');
  const addColumnBtn = $('#add-column');
  const addRowBtn = $('#add-row');
  const setPwdBtn = $('#set-password');
  const clearPwdBtn = $('#clear-password');
  const subsList = $('#subs-list');

  setPwdBtn.addEventListener('click', setPasswordFlow);
  clearPwdBtn.addEventListener('click', clearPasswordFlow);
  addColumnBtn.addEventListener('click', ()=>{ addColumnPrompt(); });
  addRowBtn.addEventListener('click', ()=>{ addRow(); });

  function renderTable(){
    const cols = loadPostMatchColumns();
    tableHead.innerHTML = '<tr>' + cols.map(c => `<th>${escapeHtml(c.label)}</th>`).join('') + '<th>Actions</th></tr>';

    // For simplicity, assume one row for now, or load rows
    // For now, just render the inputs in tbody
    // To make it dynamic, perhaps store rows in localStorage too.

    // For simplicity, let's have fixed rows, but allow adding.
    // Actually, to make it like Google form, perhaps multiple rows.

    // For now, render one row, and add row adds more.
    // But to persist, need to store the data.

    // Perhaps on submit, save the table data as array of rows.

    // For now, render with inputs.
    const numRows = tableBody.children.length || 1;
    for(let i=0; i<numRows; i++){
      renderRow(i);
    }
  }

  function renderRow(idx){
    const cols = loadPostMatchColumns();
    const tr = tableBody.children[idx] || document.createElement('tr');
    tr.innerHTML = cols.map(c => `<td><input name="${escapeHtml(c.name)}-${idx}" placeholder="${escapeHtml(c.label)}"></td>`).join('') + `<td><button type="button" class="remove-row" data-idx="${idx}">Remove</button></td>`;
    if(!tableBody.children[idx]) tableBody.appendChild(tr);
  }

  function addColumnPrompt(){
    const label = prompt('Column label');
    if(!label) return;
    const cols = loadPostMatchColumns();
    const name = 'col' + Date.now();
    cols.push({label, name});
    savePostMatchColumns(cols);
    renderTable();
  }

  function addRow(){
    const idx = tableBody.children.length;
    renderRow(idx);
  }

  // Remove row
  tableBody.addEventListener('click', e=>{
    if(e.target.classList.contains('remove-row')){
      const idx = Number(e.target.dataset.idx);
      tableBody.children[idx].remove();
      // Renumber
      Array.from(tableBody.children).forEach((tr, i)=>{
        tr.querySelector('.remove-row').dataset.idx = i;
        Array.from(tr.querySelectorAll('input')).forEach(inp=>{
          const nameParts = inp.name.split('-');
          nameParts[1] = i;
          inp.name = nameParts.join('-');
        });
      });
    }
  });

  form.addEventListener('submit', e => { e.preventDefault(); submitPostMatchForm(); }); // prevent default submit and call submit function

  window.submitPostMatchForm = async () => {
    const data = Object.fromEntries(new FormData(form).entries());
    // Group by row
    const rows = {};
    Object.keys(data).forEach(k=>{
      const [col, idx] = k.split('-');
      if(!rows[idx]) rows[idx] = {};
      rows[idx][col] = data[k];
    });
    const submissions = Object.values(rows).filter(r=>Object.values(r).some(v=>v));

    // Save to localStorage for post-match
    const existing = JSON.parse(localStorage.getItem('post-match-submissions') || '[]');
    existing.push(...submissions);
    localStorage.setItem('post-match-submissions', JSON.stringify(existing));

    // Also save team results into the shared list (for list page lookup)
    submissions.forEach(row=>{
      const teamId = (row.team || row.teamNumber || row['Team Number'] || row['team-number'] || '').trim();
      if(!teamId) return;
      const summary = Object.entries(row).map(([k,v])=>`${k}: ${v}`).join('\n');
      // Append to existing entry if present
      const entries = getListEntries();
      const idx = entries.findIndex(e=>String(e.id).trim() === teamId);
      if(idx >= 0){
        entries[idx].text += '\n\n--- Match Data ---\n' + summary;
        entries[idx].meta = Object.assign({}, entries[idx].meta || {}, { score: row.score || '' });
      } else {
        entries.push({id: teamId, text: summary, meta: { teamName: row.teamName || row['Team Name'] || '', score: row.score || '' }});
      }
      setListEntries(entries);
    });

    renderSubs();
    alert('Submitted');
  };

  function renderSubs(){
    const subs = JSON.parse(localStorage.getItem('post-match-submissions') || '[]');
    if(!subs.length){ subsList.innerHTML = '<li>No submissions</li>'; return; }
    subsList.innerHTML = subs.map((s,idx)=>`<li>${Object.entries(s).map(([k,v])=>`${k}: ${v}`).join(', ')} <button data-idx="${idx}" class="del">Delete</button></li>`).join('');
  }

  $('#clear-all').addEventListener('click', ()=>{
    if(!confirm('Clear all?')) return;
    localStorage.removeItem('post-match-submissions');
    renderSubs();
  });

  renderTable();
  renderSubs();
}

// --- Events (page4) ---
function initEventsPage(){
  const teams = $$('.team-number');
  teams.forEach(span => {
    span.style.cursor = 'pointer';
    span.addEventListener('click', () => {
      const teamNumber = span.textContent.trim();
      window.location.href = 'page2.html?team=' + encodeURIComponent(teamNumber);
    });
  });
}

// Init based on page
if(document.querySelector('#scout-form')) initFormPage();
if(document.querySelector('#post-match-form')) initPostMatchPage();
if(document.querySelector('#number-list')) initListPage();
if(document.querySelector('#teams')) initEventsPage();

// --- List (page2) ---
function getListEntries(){
  const raw = localStorage.getItem('list-entries');
  return raw ? JSON.parse(raw) : [];
}
function setListEntries(arr){
  localStorage.setItem('list-entries', JSON.stringify(arr));
}

function addOrUpdateListEntry(id, text, meta = {}){
  const entries = getListEntries();
  const idx = entries.findIndex(e => String(e.id).trim() === String(id).trim());
  if(idx >= 0){
    entries[idx].text = text;
    entries[idx].meta = { ...entries[idx].meta, ...meta };
  } else {
    entries.push({ id, text, meta });
  }
  setListEntries(entries);
}

function initListPage(){
  const listEl = $('#number-list');
  const addBtn = $('#add-entry');
  const setPwdBtn = $('#set-password');
  const clearPwdBtn = $('#clear-password');
  const savedList = $('#saved-list');

  setPwdBtn.addEventListener('click', setPasswordFlow);
  clearPwdBtn.addEventListener('click', clearPasswordFlow);

  function renderList(){
    const entries = getListEntries();
    if(!entries.length){
      listEl.innerHTML = '<li>No entries yet. Add one or submit data from other pages.</li>';
      return;
    }
    listEl.innerHTML = entries.map((e, idx) => `
      <li data-id="${escapeHtml(e.id)}">
        <span class="num-btn">${escapeHtml(e.id)}</span> - ${escapeHtml(e.meta.teamName || 'Unknown')}
        <button class="edit-btn" data-idx="${idx}">Edit</button>
        <button class="del-btn" data-idx="${idx}">Delete</button>
      </li>
    `).join('');

    // Click to show info
    $$('.num-btn').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.parentElement.dataset.id;
      const entry = entries.find(e => String(e.id).trim() === String(id).trim());
      if(entry){
        $('#info-content').textContent = entry.text;
        $('#team-info').style.display = 'block';
      }
    }));

    // Edit
    $$('.edit-btn').forEach(btn => btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.idx);
      const ok = await verifyPassword('Enter password to edit');
      if(!ok) return;
      const entry = entries[idx];
      const newText = prompt('Edit info:', entry.text);
      if(newText !== null){
        entry.text = newText;
        setListEntries(entries);
        renderList();
      }
    }));

    // Delete
    $$('.del-btn').forEach(btn => btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.idx);
      const ok = await verifyPassword('Enter password to delete');
      if(!ok) return;
      entries.splice(idx, 1);
      setListEntries(entries);
      renderList();
    }));
  }

  addBtn.addEventListener('click', () => {
    const id = prompt('Team number:');
    if(!id) return;
    const text = prompt('Info:');
    if(text === null) return;
    addOrUpdateListEntry(id, text);
    renderList();
  });

  // Check for team param
  const urlParams = new URLSearchParams(window.location.search);
  const teamParam = urlParams.get('team');
  if(teamParam){
    const li = $(`#number-list li[data-id="${teamParam}"]`);
    if(li){
      li.querySelector('.num-btn').click();
    }
  }

  renderList();
}