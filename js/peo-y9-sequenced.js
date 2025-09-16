(function(){
  const section = document.getElementById('peo-y9-sequenced');
  if(!section){ return; }

  const heading = section.querySelector('h2');
  const weekSelect = section.querySelector('#sequenceWeek');
  const searchInput = section.querySelector('#searchSeq');
  const teacherModeBtn = section.querySelector('#toggleTeacherMode2');
  const favoritesBtn = section.querySelector('#showFavorites2');
  const printBtn = section.querySelector('#printSelected2');
  const grid = section.querySelector('#seqGrid');
  const resultsSummary = createResultsSummary(searchInput);

  const STORAGE_KEYS = {
    teacherMode: 'peoY9Seq.teacherMode',
    favorites: 'peoY9Seq.favorites',
    selected: 'peoY9Seq.selected'
  };

  const state = {
    items: [],
    weekFilter: 'all',
    searchTerm: '',
    favoritesOnly: false,
    teacherMode: getStoredBoolean(STORAGE_KEYS.teacherMode, false),
    favorites: getStoredArray(STORAGE_KEYS.favorites),
    selected: getStoredArray(STORAGE_KEYS.selected),
    expanded: new Set()
  };

  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  const TOPIC_ACCENTS = {
    'media-literacy': { color: '#1d4ed8', chip: '#2563eb', text: '#ffffff', icon: '📰' },
    'political-parties': { color: '#7c3aed', chip: '#6d28d9', text: '#ffffff', icon: '🏛️' },
    'parliament-law-making': { color: '#0ea5e9', chip: '#0284c7', text: '#ffffff', icon: '📜' },
    integration: { color: '#059669', chip: '#047857', text: '#ffffff', icon: '🔗' },
    'courts-justice': { color: '#dc2626', chip: '#b91c1c', text: '#ffffff', icon: '⚖️' },
    'citizen-participation': { color: '#f97316', chip: '#ea580c', text: '#ffffff', icon: '🤝' },
    assessment: { color: '#9333ea', chip: '#7e22ce', text: '#ffffff', icon: '🧭' }
  };

  const DEFAULT_ACCENT = { color: '#334155', chip: '#475569', text: '#ffffff', icon: '⭐' };

  let printArea = document.querySelector('.peo-print-area');
  if(!printArea){
    printArea = document.createElement('section');
    printArea.className = 'peo-print-area';
    printArea.setAttribute('aria-hidden', 'true');
    document.body.appendChild(printArea);
  }

  attachEventListeners();
  updateTeacherModeButton();
  updateFavoritesButton();
  if(searchInput){ searchInput.value = state.searchTerm; }
  focusHeadingForHash();

  fetch('data/peo-y9-sequenced.json')
    .then(function(response){
      if(!response.ok){ throw new Error('Network response was not ok'); }
      return response.json();
    })
    .then(function(data){
      initialiseData(data);
      populateWeekSelect();
      renderSequence();
    })
    .catch(function(error){
      console.error('Unable to load PEO sequenced activities', error);
      if(grid){
        grid.innerHTML = '';
        const message = document.createElement('div');
        message.className = 'empty-state';
        message.textContent = 'We could not load the sequenced plan right now. Please refresh to try again.';
        grid.appendChild(message);
      }
    });

  function attachEventListeners(){
    if(weekSelect){
      weekSelect.addEventListener('change', function(event){
        state.weekFilter = event.target.value || 'all';
        renderSequence();
      });
    }

    if(searchInput){
      searchInput.addEventListener('input', debounce(function(event){
        state.searchTerm = (event.target.value || '').trim().toLowerCase();
        renderSequence();
      }, 150));
    }

    if(teacherModeBtn){
      teacherModeBtn.addEventListener('click', function(){
        state.teacherMode = !state.teacherMode;
        setStoredBoolean(STORAGE_KEYS.teacherMode, state.teacherMode);
        updateTeacherModeButton();
        renderSequence();
      });
    }

    if(favoritesBtn){
      favoritesBtn.addEventListener('click', function(){
        state.favoritesOnly = !state.favoritesOnly;
        updateFavoritesButton();
        renderSequence();
      });
    }

    if(printBtn){
      printBtn.addEventListener('click', handlePrint);
    }

    window.addEventListener('hashchange', focusHeadingForHash);
    window.addEventListener('afterprint', cleanUpPrintMode);
  }

  function initialiseData(data){
    if(!data || !Array.isArray(data.sequence)){ return; }
    state.items = data.sequence.slice().sort(function(a, b){
      if(a.week !== b.week){ return a.week - b.week; }
      if(a.lessonOrder !== b.lessonOrder){ return a.lessonOrder - b.lessonOrder; }
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    });
    pruneStoredIds();
  }

  function populateWeekSelect(){
    if(!weekSelect){ return; }
    weekSelect.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All weeks';
    weekSelect.appendChild(allOption);

    const weeks = Array.from(new Set(state.items.map(function(item){ return item.week; }))).sort(function(a, b){ return a - b; });
    weeks.forEach(function(week){
      const option = document.createElement('option');
      option.value = String(week);
      option.textContent = 'Week ' + week;
      weekSelect.appendChild(option);
    });

    weekSelect.value = state.weekFilter;
  }

  function renderSequence(){
    if(!grid){ return; }
    grid.innerHTML = '';

    if(!state.items.length){
      updateResultsSummary(resultsSummary, 0);
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No sequenced activities available yet.';
      grid.appendChild(empty);
      return;
    }

    const filtered = state.items.filter(function(item){
      if(state.weekFilter !== 'all' && String(item.week) !== state.weekFilter){ return false; }
      if(state.favoritesOnly && !isFavorite(item.id)){ return false; }
      if(state.searchTerm){
        const searchTarget = [
          item.title,
          (item.objectives || []).join(' '),
          item.visibleLearning ? item.visibleLearning.learningIntentions : '',
          item.visibleLearning ? (item.visibleLearning.successCriteria || []).join(' ') : '',
          (item.tags || []).join(' ')
        ].join(' ').toLowerCase();
        if(searchTarget.indexOf(state.searchTerm) === -1){ return false; }
      }
      return true;
    });

    updateResultsSummary(resultsSummary, filtered.length);

    if(!filtered.length){
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No activities match your filters yet.';
      grid.appendChild(empty);
      return;
    }

    let currentWeek = null;
    filtered.forEach(function(item){
      if(currentWeek !== item.week){
        currentWeek = item.week;
        grid.appendChild(createWeekLabel(item.week));
      }
      grid.appendChild(buildCard(item));
    });
  }

  function buildCard(item){
    const accent = TOPIC_ACCENTS[item.topicId] || DEFAULT_ACCENT;
    const card = document.createElement('article');
    card.className = 'activity-card sequence-card';
    card.style.setProperty('--sequence-accent', accent.color);
    if(isFavorite(item.id)){
      card.classList.add('favorited');
    }

    const header = document.createElement('div');
    header.className = 'activity-header sequence-header';

    const bodyId = 'seq-' + item.id;
    const isExpanded = state.expanded.has(item.id);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'activity-toggle sequence-toggle';
    toggle.setAttribute('aria-controls', bodyId);
    toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');

    const title = document.createElement('span');
    title.className = 'activity-title';
    setHighlightedText(title, item.title);
    toggle.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'activity-meta sequence-meta';

    const weekChip = document.createElement('span');
    weekChip.className = 'sequence-chip sequence-chip--week';
    setHighlightedText(weekChip, 'Week ' + item.week + ' · Lesson ' + item.lessonOrder);
    meta.appendChild(weekChip);

    if(item.duration){
      const duration = document.createElement('span');
      duration.className = 'duration-pill';
      duration.textContent = item.duration;
      meta.appendChild(duration);
    }

    const topicChip = document.createElement('span');
    topicChip.className = 'topic-chip sequence-topic';
    topicChip.style.backgroundColor = accent.chip;
    topicChip.style.color = accent.text;
    const topicIcon = document.createElement('span');
    topicIcon.className = 'sequence-topic-icon';
    topicIcon.setAttribute('aria-hidden', 'true');
    topicIcon.textContent = accent.icon;
    const topicLabel = document.createElement('span');
    topicLabel.className = 'topic-label';
    setHighlightedText(topicLabel, item.topicTitle);
    topicChip.appendChild(topicIcon);
    topicChip.appendChild(topicLabel);
    meta.appendChild(topicChip);

    toggle.appendChild(meta);

    const content = buildCardBody(item, bodyId, isExpanded);

    toggle.addEventListener('click', function(){
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      const nextState = !expanded;
      toggle.setAttribute('aria-expanded', nextState ? 'true' : 'false');
      content.hidden = !nextState;
      if(nextState){
        state.expanded.add(item.id);
      } else {
        state.expanded.delete(item.id);
      }
    });

    header.appendChild(toggle);

    const actions = document.createElement('div');
    actions.className = 'sequence-actions';

    const favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.className = 'favorite-btn';
    const favState = isFavorite(item.id);
    favoriteButton.setAttribute('aria-pressed', favState ? 'true' : 'false');
    favoriteButton.setAttribute('aria-label', favState ? 'Remove from favourites' : 'Add to favourites');
    favoriteButton.title = favState ? 'Remove from favourites' : 'Add to favourites';
    favoriteButton.innerHTML = '<span class="star" aria-hidden="true">' + (favState ? '★' : '☆') + '</span><span class="favorite-label">' + (favState ? 'Saved' : 'Save') + '</span>';
    favoriteButton.addEventListener('click', function(){
      toggleFavorite(item.id);
      renderSequence();
    });
    actions.appendChild(favoriteButton);

    const selectId = 'seq-select-' + item.id;
    const selectLabel = document.createElement('label');
    selectLabel.className = 'sequence-select';
    selectLabel.setAttribute('for', selectId);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = selectId;
    checkbox.checked = isSelected(item.id);
    checkbox.addEventListener('change', function(event){
      toggleSelected(item.id, event.target.checked);
    });
    const labelText = document.createElement('span');
    labelText.textContent = 'Include for print';
    selectLabel.appendChild(checkbox);
    selectLabel.appendChild(labelText);
    actions.appendChild(selectLabel);

    header.appendChild(actions);

    card.appendChild(header);
    card.appendChild(content);

    return card;
  }

  function buildCardBody(item, bodyId, isExpanded){
    const body = document.createElement('div');
    body.className = 'activity-body sequence-body';
    body.id = bodyId;
    body.hidden = !isExpanded;

    if(item.grouping){
      const grouping = document.createElement('p');
      grouping.className = 'grouping-label';
      grouping.appendChild(document.createTextNode('Grouping: '));
      const groupingValue = document.createElement('span');
      setHighlightedText(groupingValue, item.grouping);
      grouping.appendChild(groupingValue);
      body.appendChild(grouping);
    }

    if(item.visibleLearning){
      if(item.visibleLearning.learningIntentions){
        const liHeading = document.createElement('h3');
        liHeading.textContent = 'Learning Intentions';
        body.appendChild(liHeading);

        const liParagraph = document.createElement('p');
        setHighlightedText(liParagraph, item.visibleLearning.learningIntentions);
        body.appendChild(liParagraph);
      }

      if(Array.isArray(item.visibleLearning.successCriteria) && item.visibleLearning.successCriteria.length){
        const scHeading = document.createElement('h3');
        scHeading.textContent = 'Success Criteria';
        body.appendChild(scHeading);

        const scList = document.createElement('ul');
        item.visibleLearning.successCriteria.forEach(function(criteria){
          const li = document.createElement('li');
          setHighlightedText(li, criteria);
          scList.appendChild(li);
        });
        body.appendChild(scList);
      }
    }

    if(Array.isArray(item.objectives) && item.objectives.length){
      const objectivesHeading = document.createElement('h3');
      objectivesHeading.textContent = 'Objectives';
      body.appendChild(objectivesHeading);

      const objectivesList = document.createElement('ul');
      item.objectives.forEach(function(obj){
        const li = document.createElement('li');
        setHighlightedText(li, obj);
        objectivesList.appendChild(li);
      });
      body.appendChild(objectivesList);
    }

    if(Array.isArray(item.materials) && item.materials.length){
      const materialsHeading = document.createElement('h3');
      materialsHeading.textContent = 'Materials';
      body.appendChild(materialsHeading);

      const materialsList = document.createElement('ul');
      item.materials.forEach(function(material){
        const li = document.createElement('li');
        setHighlightedText(li, material);
        materialsList.appendChild(li);
      });
      body.appendChild(materialsList);
    }

    if(Array.isArray(item.steps) && item.steps.length){
      const stepsHeading = document.createElement('h3');
      stepsHeading.textContent = 'Steps';
      body.appendChild(stepsHeading);

      const stepsList = document.createElement('ol');
      item.steps.forEach(function(step){
        const li = document.createElement('li');
        setHighlightedText(li, step);
        stepsList.appendChild(li);
      });
      body.appendChild(stepsList);
    }

    if(item.assessment){
      const assessment = document.createElement('p');
      const label = document.createElement('strong');
      label.textContent = 'Assessment:';
      assessment.appendChild(label);
      assessment.appendChild(document.createTextNode(' '));
      const assessmentText = document.createElement('span');
      setHighlightedText(assessmentText, item.assessment);
      assessment.appendChild(assessmentText);
      body.appendChild(assessment);
    }

    if(Array.isArray(item.links) && item.links.length){
      const linksWrap = document.createElement('div');
      const headingEl = document.createElement('h3');
      headingEl.textContent = 'Links';
      linksWrap.appendChild(headingEl);

      const list = document.createElement('div');
      list.className = 'links-list';
      item.links.forEach(function(link){
        if(!link || !link.url){ return; }
        const anchor = document.createElement('a');
        const labelText = link.label || link.url;
        anchor.href = link.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        setHighlightedText(anchor, labelText);
        const icon = document.createElement('span');
        icon.className = 'outbound-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '↗';
        const srOnly = document.createElement('span');
        srOnly.className = 'sr-only';
        srOnly.textContent = ' opens in a new tab';
        anchor.appendChild(icon);
        anchor.appendChild(srOnly);
        list.appendChild(anchor);
      });
      linksWrap.appendChild(list);
      body.appendChild(linksWrap);
    }

    if(state.teacherMode && Array.isArray(item.teacherTips) && item.teacherTips.length){
      const tipsWrap = document.createElement('div');
      tipsWrap.className = 'teacher-tip';
      const headingEl = document.createElement('strong');
      headingEl.textContent = 'Teacher Tips';
      tipsWrap.appendChild(headingEl);

      const tipsList = document.createElement('ul');
      item.teacherTips.forEach(function(tip){
        const li = document.createElement('li');
        setHighlightedText(li, tip);
        tipsList.appendChild(li);
      });
      tipsWrap.appendChild(tipsList);
      body.appendChild(tipsWrap);
    }

    return body;
  }

  function createWeekLabel(week){
    const container = document.createElement('div');
    container.className = 'week-label';
    container.setAttribute('role', 'heading');
    container.setAttribute('aria-level', '3');
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🗓️';
    container.appendChild(icon);
    container.appendChild(document.createTextNode('Week ' + week));
    return container;
  }

  function toggleFavorite(id){
    const index = state.favorites.indexOf(id);
    if(index === -1){
      state.favorites.push(id);
    } else {
      state.favorites.splice(index, 1);
    }
    setStoredArray(STORAGE_KEYS.favorites, state.favorites);
    updateFavoritesButton();
  }

  function toggleSelected(id, isChecked){
    const index = state.selected.indexOf(id);
    if(isChecked && index === -1){
      state.selected.push(id);
    }
    if(!isChecked && index > -1){
      state.selected.splice(index, 1);
    }
    setStoredArray(STORAGE_KEYS.selected, state.selected);
  }

  function handlePrint(){
    const items = getSelectedItems();
    if(!items.length){
      window.alert('Select at least one activity to print or export.');
      return;
    }
    buildPrintArea(items);
    document.body.classList.add('peo-printing');
    printArea.setAttribute('aria-hidden', 'false');
    window.print();
    setTimeout(cleanUpPrintMode, 1000);
  }

  function getSelectedItems(){
    const selectedSet = new Set(state.selected);
    const items = state.items.filter(function(item){
      return selectedSet.has(item.id);
    });
    items.sort(function(a, b){
      if(a.week !== b.week){ return a.week - b.week; }
      if(a.lessonOrder !== b.lessonOrder){ return a.lessonOrder - b.lessonOrder; }
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    });
    return items;
  }

  function buildPrintArea(items){
    printArea.innerHTML = '';
    const title = document.createElement('h1');
    title.textContent = 'PEO Year 9 – Sequenced Activities';
    printArea.appendChild(title);

    const formatter = new Intl.DateTimeFormat('en-AU', { dateStyle: 'full', timeZone: 'Australia/Melbourne' });
    const meta = document.createElement('p');
    meta.className = 'print-meta';
    meta.textContent = 'Printed: ' + formatter.format(new Date()) + ' – PEO Y9 Sequenced';
    printArea.appendChild(meta);

    items.forEach(function(item){
      const container = document.createElement('article');
      container.className = 'peo-print-activity';

      const headingEl = document.createElement('h2');
      headingEl.textContent = item.title;
      container.appendChild(headingEl);

      const metaLine = document.createElement('p');
      let details = 'Week ' + item.week + ' · Lesson ' + item.lessonOrder;
      if(item.duration){ details += ' • Duration: ' + item.duration; }
      details += ' • Topic: ' + item.topicTitle;
      if(item.grouping){ details += ' • Grouping: ' + item.grouping; }
      metaLine.textContent = details;
      container.appendChild(metaLine);

      if(item.visibleLearning && item.visibleLearning.learningIntentions){
        const liHeading = document.createElement('h3');
        liHeading.textContent = 'Learning Intentions';
        container.appendChild(liHeading);

        const liParagraph = document.createElement('p');
        liParagraph.textContent = item.visibleLearning.learningIntentions;
        container.appendChild(liParagraph);
      }

      if(item.visibleLearning && Array.isArray(item.visibleLearning.successCriteria) && item.visibleLearning.successCriteria.length){
        const scHeading = document.createElement('h3');
        scHeading.textContent = 'Success Criteria';
        container.appendChild(scHeading);

        const scList = document.createElement('ul');
        item.visibleLearning.successCriteria.forEach(function(criteria){
          const li = document.createElement('li');
          li.textContent = criteria;
          scList.appendChild(li);
        });
        container.appendChild(scList);
      }

      if(Array.isArray(item.objectives) && item.objectives.length){
        const objectivesHeading = document.createElement('h3');
        objectivesHeading.textContent = 'Objectives';
        container.appendChild(objectivesHeading);

        const objectivesList = document.createElement('ul');
        item.objectives.forEach(function(obj){
          const li = document.createElement('li');
          li.textContent = obj;
          objectivesList.appendChild(li);
        });
        container.appendChild(objectivesList);
      }

      if(Array.isArray(item.materials) && item.materials.length){
        const materialsHeading = document.createElement('h3');
        materialsHeading.textContent = 'Materials';
        container.appendChild(materialsHeading);

        const materialsList = document.createElement('ul');
        item.materials.forEach(function(material){
          const li = document.createElement('li');
          li.textContent = material;
          materialsList.appendChild(li);
        });
        container.appendChild(materialsList);
      }

      if(Array.isArray(item.steps) && item.steps.length){
        const stepsHeading = document.createElement('h3');
        stepsHeading.textContent = 'Steps';
        container.appendChild(stepsHeading);

        const stepsList = document.createElement('ol');
        item.steps.forEach(function(step){
          const li = document.createElement('li');
          li.textContent = step;
          stepsList.appendChild(li);
        });
        container.appendChild(stepsList);
      }

      if(item.assessment){
        const assessment = document.createElement('p');
        const label = document.createElement('strong');
        label.textContent = 'Assessment:';
        assessment.appendChild(label);
        assessment.appendChild(document.createTextNode(' ' + item.assessment));
        container.appendChild(assessment);
      }

      if(Array.isArray(item.links) && item.links.length){
        const linksHeading = document.createElement('h3');
        linksHeading.textContent = 'Links';
        container.appendChild(linksHeading);

        const list = document.createElement('ul');
        item.links.forEach(function(link){
          if(!link || !link.url){ return; }
          const li = document.createElement('li');
          const anchor = document.createElement('a');
          anchor.href = link.url;
          anchor.textContent = link.label || link.url;
          li.appendChild(anchor);
          list.appendChild(li);
        });
        container.appendChild(list);
      }

      if(state.teacherMode && Array.isArray(item.teacherTips) && item.teacherTips.length){
        const tipsHeading = document.createElement('h3');
        tipsHeading.textContent = 'Teacher Tips';
        container.appendChild(tipsHeading);

        const tipsList = document.createElement('ul');
        item.teacherTips.forEach(function(tip){
          const li = document.createElement('li');
          li.textContent = tip;
          tipsList.appendChild(li);
        });
        container.appendChild(tipsList);
      }

      printArea.appendChild(container);
    });
  }

  function cleanUpPrintMode(){
    document.body.classList.remove('peo-printing');
    if(printArea){
      printArea.setAttribute('aria-hidden', 'true');
      printArea.innerHTML = '';
    }
  }

  function pruneStoredIds(){
    const validIds = new Set(state.items.map(function(item){ return item.id; }));
    state.favorites = state.favorites.filter(function(id){ return validIds.has(id); });
    state.selected = state.selected.filter(function(id){ return validIds.has(id); });
    setStoredArray(STORAGE_KEYS.favorites, state.favorites);
    setStoredArray(STORAGE_KEYS.selected, state.selected);
  }

  function updateTeacherModeButton(){
    if(!teacherModeBtn){ return; }
    teacherModeBtn.setAttribute('aria-pressed', state.teacherMode ? 'true' : 'false');
    teacherModeBtn.textContent = state.teacherMode ? 'Teacher Mode: On' : 'Teacher Mode: Off';
  }

  function updateFavoritesButton(){
    if(!favoritesBtn){ return; }
    favoritesBtn.setAttribute('aria-pressed', state.favoritesOnly ? 'true' : 'false');
    favoritesBtn.textContent = state.favoritesOnly ? 'Show Favourites: On' : 'Show Favourites';
  }

  function isFavorite(id){
    return state.favorites.indexOf(id) > -1;
  }

  function isSelected(id){
    return state.selected.indexOf(id) > -1;
  }

  function createResultsSummary(input){
    if(!input || !input.parentNode){ return null; }
    const summary = document.createElement('span');
    summary.className = 'search-results-count';
    summary.setAttribute('role', 'status');
    summary.setAttribute('aria-live', 'polite');
    summary.textContent = '';
    input.insertAdjacentElement('afterend', summary);
    return summary;
  }

  function updateResultsSummary(summaryEl, count){
    if(!summaryEl){ return; }
    const value = typeof count === 'number' && !isNaN(count) ? count : 0;
    summaryEl.textContent = value === 1 ? '1 result' : value + ' results';
  }

  function setHighlightedText(element, text){
    if(!element){ return; }
    const value = text == null ? '' : String(text);
    element.textContent = '';
    if(!value){
      return;
    }

    if(!state.searchTerm){
      element.textContent = value;
      return;
    }

    const term = state.searchTerm;
    const pattern = escapeRegExp(term);
    if(!pattern){
      element.textContent = value;
      return;
    }

    const regex = new RegExp('(' + pattern + ')', 'ig');
    const parts = value.split(regex);
    const termLower = term.toLowerCase();
    parts.forEach(function(part){
      if(!part){ return; }
      if(part.toLowerCase() === termLower){
        const mark = document.createElement('mark');
        mark.textContent = part;
        element.appendChild(mark);
      } else {
        element.appendChild(document.createTextNode(part));
      }
    });
  }

  function escapeRegExp(str){
    return str.replace(/[.*+?^${}()|[\]\]/g, '\$&');
  }

  function focusHeadingForHash(){
    if(window.location.hash !== '#peo-y9-sequenced' || !heading){ return; }
    if(typeof heading.focus === 'function'){
      heading.focus({ preventScroll: true });
    }
    heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function debounce(fn, wait){
    let timeout;
    return function(){
      const context = this;
      const args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(function(){
        fn.apply(context, args);
      }, wait);
    };
  }

  function getStoredBoolean(key, fallback){
    try {
      const value = localStorage.getItem(key);
      if(value === null){ return fallback; }
      return value === 'true';
    } catch(e){
      return fallback;
    }
  }

  function setStoredBoolean(key, value){
    try {
      localStorage.setItem(key, value ? 'true' : 'false');
    } catch(e){}
  }

  function getStoredArray(key){
    try {
      const value = localStorage.getItem(key);
      if(!value){ return []; }
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch(e){
      return [];
    }
  }

  function setStoredArray(key, arr){
    try {
      localStorage.setItem(key, JSON.stringify(arr));
    } catch(e){}
  }

  setTimeout(focusHeadingForHash, 150);
})();
