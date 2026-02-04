// Simple client-side calendar with password-protected add/edit/delete
(function(){
  const STORAGE_KEY = 'calendar-events-v1';
  const grid = document.getElementById('calendar-grid');
  const label = document.getElementById('month-label');
  let current = new Date();

  function loadEvents(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }catch(e){ return []; }
  }
  function saveEvents(evts){ localStorage.setItem(STORAGE_KEY, JSON.stringify(evts)); }

  function isoDate(d){ return d.toISOString().slice(0,10); }

  function render(){
    grid.innerHTML = '';
    const year = current.getFullYear();
    const month = current.getMonth();
    label.textContent = current.toLocaleString(undefined,{month:'long',year:'numeric'});

    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();

    // blank cells for previous month
    for(let i=0;i<startDay;i++){ const blank = document.createElement('div'); blank.className='cal-cell'; grid.appendChild(blank); }

    const events = loadEvents();

    for(let d=1; d<=daysInMonth; d++){
      const date = new Date(year, month, d);
      const cell = document.createElement('div'); cell.className='cal-cell';
      const dateStr = isoDate(date);
      const dateEl = document.createElement('div'); dateEl.className='date'; dateEl.textContent = d;
      cell.appendChild(dateEl);

      const dayEvents = events.filter(e=>e.date===dateStr).sort((a,b)=> (a.time||'').localeCompare(b.time||''));
      dayEvents.forEach(evObj=>{
        const evEl = document.createElement('div'); evEl.className='event'; evEl.textContent = (evObj.time? evObj.time + ' — ' : '') + evObj.title;
        evEl.title = 'Click to edit or delete';
        evEl.addEventListener('click', async (evClick)=>{
          evClick.stopPropagation();
          const ok = await verifyPassword('Enter password to edit/delete event');
          if(!ok){ alert('Canceled or incorrect password'); return; }
          const action = prompt('Edit event title (leave empty to delete):', evObj.title);
          if(action === null) return; // cancel
          if(action === ''){ // delete
            const all = loadEvents();
            const filtered = all.filter(x=>!(x.id===evObj.id));
            saveEvents(filtered);
            render();
            return;
          }
          const newTime = prompt('Edit time (optional)', evObj.time||'') || '';
          const all = loadEvents();
          const eIdx = all.findIndex(x=>x.id===evObj.id);
          if(eIdx>=0){ all[eIdx].title = action; all[eIdx].time = newTime; saveEvents(all); render(); }
        });
        cell.appendChild(evEl);
      });

      cell.addEventListener('click', async ()=>{
        const ok = await verifyPassword('Enter password to add event');
        if(!ok){ alert('Canceled or incorrect password'); return; }
        const title = prompt('Event title (cancel to abort)');
        if(!title) return;
        const time = prompt('Optional time (e.g. 14:30)') || '';
        const evts = loadEvents();
        evts.push({id: String(Date.now()) + '-' + Math.random().toString(36).slice(2,6), date: dateStr, title: title, time: time});
        saveEvents(evts);
        render();
      });

      grid.appendChild(cell);
    }

    // fill remaining cells to complete weeks (optional)
    const totalCells = startDay + daysInMonth;
    const toFill = (7 - (totalCells % 7)) % 7;
    for(let i=0;i<toFill;i++){ const blank = document.createElement('div'); blank.className='cal-cell'; grid.appendChild(blank); }
  }

  document.getElementById('prev-month').addEventListener('click', ()=>{ current.setMonth(current.getMonth()-1); render(); });
  document.getElementById('next-month').addEventListener('click', ()=>{ current.setMonth(current.getMonth()+1); render(); });
  document.getElementById('today').addEventListener('click', ()=>{ current = new Date(); render(); });

  document.getElementById('export').addEventListener('click', ()=>{
    const data = loadEvents();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'calendar-events.json'; a.click(); URL.revokeObjectURL(url);
  });

  document.getElementById('import').addEventListener('click', async ()=>{
    const ok = await verifyPassword('Enter password to import events');
    if(!ok){ alert('Canceled or incorrect password'); return; }
    const fileInput = document.createElement('input'); fileInput.type='file'; fileInput.accept='application/json';
    fileInput.addEventListener('change', ()=>{
      const f = fileInput.files && fileInput.files[0]; if(!f) return;
      const r = new FileReader(); r.onload = ()=>{ try{ const parsed = JSON.parse(r.result); if(!Array.isArray(parsed)) throw new Error('Invalid format'); saveEvents(parsed); render(); alert('Imported'); }catch(e){ alert('Failed to import: '+e.message); } }; r.readAsText(f);
    });
    fileInput.click();
  });

  render();
})();