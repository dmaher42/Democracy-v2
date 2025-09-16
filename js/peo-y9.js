(function(){
  const section = document.getElementById('peo-y9');
  if(!section){ return; }

  const heading = section.querySelector('h2');
  const searchInput = section.querySelector('#searchActivities');
  const topicSelect = section.querySelector('#filterTopic');
  const typeSelect = section.querySelector('#filterType');
  const teacherModeBtn = section.querySelector('#toggleTeacherMode');
  const printBtn = section.querySelector('#printSelected');
  const favoritesBtn = section.querySelector('#filterFavorites');
  const grid = section.querySelector('#activitiesGrid');
  const resultsSummary = createResultsSummary(searchInput);

  const STORAGE_KEYS = {
    teacherMode: 'peoY9.teacherMode',
    favorites: 'peoY9.favorites',
    selected: 'peoY9.selected'
  };

  const teacherTips = {
    'news-diet-challenge': 'Provide curated examples for students needing support and encourage an extension group to contrast public vs. commercial broadcasters.',
    'frayer-model': 'Pre-teach key vocabulary for EAL/D students and offer a digital template for students who type faster than they write.',
    'bill-simulation': 'Assign timekeeper and reflection roles so every student contributes; record debate snippets for formative feedback.',
    'mock-hearing': 'Rotate students through observer and advocate roles across repeats to deepen understanding of due process.',
    'petition-plan': 'Model a SMART goal together before release and have teacher check-ins on respectful communication strategies.',
    'civics-inquiry-project': 'Conference midway to approve inquiry questions and suggest differentiation options for presentation formats.'
  };

  const state = {
    topics: [],
    activities: [],
    topicFilter: 'all',
    typeFilter: 'all',
    searchTerm: '',
    favoritesOnly: false,
    teacherMode: getStoredBoolean(STORAGE_KEYS.teacherMode, false),
    favorites: getStoredArray(STORAGE_KEYS.favorites),
    selectedForPrint: getStoredArray(STORAGE_KEYS.selected)
  };

  const printArea = document.createElement('section');
  printArea.className = 'peo-print-area';
  printArea.setAttribute('aria-hidden', 'true');
  document.body.appendChild(printArea);

  const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  attachEventListeners();
  updateTeacherModeButton();
  updateFavoritesButton();
  focusHeadingForHash();

  fetch('data/peo-y9-activities.json')
    .then(function(response){
      if(!response.ok){ throw new Error('Network response was not ok'); }
      return response.json();
    })
    .then(function(data){
      initialiseData(data);
      populateFilters();
      renderActivities({ preserveOpen: false });
    })
    .catch(function(error){
      console.error('Unable to load PEO activities', error);
      grid.innerHTML = '';
      const message = document.createElement('div');
      message.className = 'empty-state';
      message.textContent = 'We could not load the PEO activities right now. Please refresh to try again.';
      grid.appendChild(message);
    });

  function initialiseData(data){
    if(!data || !Array.isArray(data.topics)){ return; }
    state.topics = data.topics.slice();
    state.activities = state.topics.flatMap(function(topic, index){
      const activities = Array.isArray(topic.activities) ? topic.activities : [];
      return activities.map(function(activity){
        return { topic: topic, activity: activity, topicIndex: index };
      });
    });
    pruneStoredIds();
  }

  function pruneStoredIds(){
    const validIds = new Set(state.activities.map(function(entry){ return entry.activity.id; }));
    state.favorites = state.favorites.filter(function(id){ return validIds.has(id); });
    state.selectedForPrint = state.selectedForPrint.filter(function(id){ return validIds.has(id); });
    setStoredArray(STORAGE_KEYS.favorites, state.favorites);
    setStoredArray(STORAGE_KEYS.selected, state.selectedForPrint);
  }

  function attachEventListeners(){
    if(searchInput){
      searchInput.addEventListener('input', debounce(function(event){
        state.searchTerm = (event.target.value || '').trim().toLowerCase();
        renderActivities();
      }, 150));
    }

    if(topicSelect){
      topicSelect.addEventListener('change', function(event){
        state.topicFilter = event.target.value || 'all';
        renderActivities();
      });
    }

    if(typeSelect){
      typeSelect.addEventListener('change', function(event){
        state.typeFilter = event.target.value || 'all';
        renderActivities();
      });
    }

    if(favoritesBtn){
      favoritesBtn.addEventListener('click', function(){
        state.favoritesOnly = !state.favoritesOnly;
        updateFavoritesButton();
        renderActivities();
      });
    }

    if(teacherModeBtn){
      teacherModeBtn.addEventListener('click', function(){
        state.teacherMode = !state.teacherMode;
        setStoredBoolean(STORAGE_KEYS.teacherMode, state.teacherMode);
        updateTeacherModeButton();
        renderActivities();
      });
    }

    if(printBtn){
      printBtn.addEventListener('click', handlePrint);
    }

    window.addEventListener('hashchange', focusHeadingForHash);
    window.addEventListener('afterprint', cleanUpPrintMode);
  }

  function populateFilters(){
    if(topicSelect){
      topicSelect.innerHTML = '';
      const allOption = document.createElement('option');
      allOption.value = 'all';
      allOption.textContent = 'All topics';
      topicSelect.appendChild(allOption);

      state.topics.forEach(function(topic){
        const option = document.createElement('option');
        option.value = topic.id;
        option.textContent = topic.title;
        topicSelect.appendChild(option);
      });

      topicSelect.value = state.topicFilter;
    }

    if(typeSelect){
      typeSelect.innerHTML = '';
      const allOption = document.createElement('option');
      allOption.value = 'all';
      allOption.textContent = 'All types';
      typeSelect.appendChild(allOption);

      const types = Array.from(new Set(state.activities.flatMap(function(entry){
        return Array.isArray(entry.activity.type) ? entry.activity.type : [];
      })));
      types.sort(function(a, b){
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
      });

      types.forEach(function(type){
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
      });

      typeSelect.value = state.typeFilter;
    }
  }

  function renderActivities(options){
    options = options || {};
    const preserveOpen = options.preserveOpen !== false;
    const openIds = preserveOpen ? getOpenActivityIds() : new Set();

    grid.innerHTML = '';
    if(!state.activities.length){
      updateResultsSummary(resultsSummary, 0);
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No activities available.';
      grid.appendChild(empty);
      return;
    }

    const filtered = state.activities.filter(function(entry){
      const activity = entry.activity;
      if(state.favoritesOnly && !isFavorite(activity.id)){ return false; }
      if(state.topicFilter !== 'all' && entry.topic.id !== state.topicFilter){ return false; }
      if(state.typeFilter !== 'all' && !(Array.isArray(activity.type) && activity.type.includes(state.typeFilter))){ return false; }
      if(state.searchTerm){
        const haystack = [
          activity.title,
          (activity.objectives || []).join(' '),
          (activity.tags || []).join(' ')
        ].join(' ').toLowerCase();
        if(!haystack.includes(state.searchTerm)){ return false; }
      }
      return true;
    });

    updateResultsSummary(resultsSummary, filtered.length);

    if(!filtered.length){
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No activities match your filters yet. Try adjusting your search or filters.';
      grid.appendChild(empty);
      return;
    }

    filtered.sort(function(a, b){
      const favDelta = Number(isFavorite(b.activity.id)) - Number(isFavorite(a.activity.id));
      if(favDelta !== 0){ return favDelta; }
      if(a.topicIndex !== b.topicIndex){ return a.topicIndex - b.topicIndex; }
      return a.activity.title.localeCompare(b.activity.title, undefined, { sensitivity: 'base' });
    });

    filtered.forEach(function(entry){
      const activity = entry.activity;
      const topic = entry.topic;
      const isFav = isFavorite(activity.id);
      const isSelected = state.selectedForPrint.includes(activity.id);
      const bodyId = 'activity-' + activity.id;
      const article = document.createElement('article');
      article.className = 'activity-card' + (isFav ? ' favorited' : '');

      const header = document.createElement('div');
      header.className = 'activity-header';

      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'activity-toggle';
      toggleBtn.type = 'button';
      toggleBtn.setAttribute('aria-expanded', openIds.has(activity.id) ? 'true' : 'false');
      toggleBtn.setAttribute('aria-controls', bodyId);

      const titleSpan = document.createElement('span');
      titleSpan.className = 'activity-title';
      setHighlightedText(titleSpan, activity.title);
      toggleBtn.appendChild(titleSpan);

      const meta = document.createElement('div');
      meta.className = 'activity-meta';

      if(isFav){
        const favFlag = document.createElement('span');
        favFlag.className = 'favorite-flag';
        const star = document.createElement('span');
        star.className = 'star';
        star.setAttribute('aria-hidden', 'true');
        star.textContent = '★';
        const flagLabel = document.createElement('span');
        flagLabel.textContent = 'Favourite';
        favFlag.appendChild(star);
        favFlag.appendChild(flagLabel);
        meta.appendChild(favFlag);
      }

      const topicChip = document.createElement('span');
      topicChip.className = 'topic-chip';
      topicChip.style.backgroundColor = topic.color || '#0f172a';
      const topicLabel = document.createElement('span');
      topicLabel.className = 'topic-label';
      setHighlightedText(topicLabel, topic.title);
      topicChip.appendChild(topicLabel);
      meta.appendChild(topicChip);

      if(activity.duration){
        const duration = document.createElement('span');
        duration.className = 'duration-pill';
        duration.textContent = activity.duration;
        meta.appendChild(duration);
      }

      if(Array.isArray(activity.type)){
        activity.type.forEach(function(type){
          const typeChip = document.createElement('span');
          typeChip.className = 'type-chip';
          setHighlightedText(typeChip, type);
          meta.appendChild(typeChip);
        });
      }

      toggleBtn.appendChild(meta);
      header.appendChild(toggleBtn);

      const favoriteButton = document.createElement('button');
      favoriteButton.className = 'favorite-btn';
      favoriteButton.type = 'button';
      favoriteButton.setAttribute('aria-pressed', isFav ? 'true' : 'false');
      favoriteButton.setAttribute('aria-label', (isFav ? 'Remove' : 'Save') + ' ' + activity.title + ' to favourites');
      favoriteButton.innerHTML = '<span class="star" aria-hidden="true">★</span><span class="favorite-label">' + (isFav ? 'Saved' : 'Save') + '</span>';
      favoriteButton.addEventListener('click', function(){
        toggleFavorite(activity.id);
        renderActivities();
      });
      header.appendChild(favoriteButton);

      article.appendChild(header);

      const actions = document.createElement('div');
      actions.className = 'activity-actions';
      if(activity.grouping){
        const grouping = document.createElement('span');
        grouping.className = 'grouping-label';
        grouping.appendChild(document.createTextNode('Grouping: '));
        const groupingValue = document.createElement('span');
        setHighlightedText(groupingValue, activity.grouping);
        grouping.appendChild(groupingValue);
        actions.appendChild(grouping);
      }

      const selectLabel = document.createElement('label');
      selectLabel.setAttribute('for', 'select-' + activity.id);
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'select-' + activity.id;
      checkbox.checked = isSelected;
      checkbox.addEventListener('change', function(event){
        toggleSelected(activity.id, event.target.checked);
      });
      const labelText = document.createElement('span');
      labelText.textContent = 'Select for print';
      selectLabel.appendChild(checkbox);
      selectLabel.appendChild(labelText);
      actions.appendChild(selectLabel);
      article.appendChild(actions);

      const body = document.createElement('div');
      body.className = 'activity-body';
      body.id = bodyId;
      body.dataset.activityId = activity.id;
      body.hidden = !openIds.has(activity.id);

      if(activity.objectives && activity.objectives.length){
        const objectivesWrap = document.createElement('div');
        const headingEl = document.createElement('h3');
        headingEl.textContent = 'Learning objectives';
        const list = document.createElement('ul');
        activity.objectives.forEach(function(item){
          const li = document.createElement('li');
          setHighlightedText(li, item);
          list.appendChild(li);
        });
        objectivesWrap.appendChild(headingEl);
        objectivesWrap.appendChild(list);
        body.appendChild(objectivesWrap);
      }

      if(activity.materials && activity.materials.length){
        const materialsWrap = document.createElement('div');
        const headingEl = document.createElement('h3');
        headingEl.textContent = 'Materials';
        const list = document.createElement('ul');
        activity.materials.forEach(function(item){
          const li = document.createElement('li');
          setHighlightedText(li, item);
          list.appendChild(li);
        });
        materialsWrap.appendChild(headingEl);
        materialsWrap.appendChild(list);
        body.appendChild(materialsWrap);
      }

      if(activity.steps && activity.steps.length){
        const stepsWrap = document.createElement('div');
        const headingEl = document.createElement('h3');
        headingEl.textContent = 'Steps';
        const list = document.createElement('ol');
        activity.steps.forEach(function(item){
          const li = document.createElement('li');
          setHighlightedText(li, item);
          list.appendChild(li);
        });
        stepsWrap.appendChild(headingEl);
        stepsWrap.appendChild(list);
        body.appendChild(stepsWrap);
      }

      if(activity.assessment){
        const assessment = document.createElement('p');
        const label = document.createElement('strong');
        label.textContent = 'Assessment:';
        assessment.appendChild(label);
        assessment.appendChild(document.createTextNode(' '));
        const assessmentText = document.createElement('span');
        setHighlightedText(assessmentText, activity.assessment);
        assessment.appendChild(assessmentText);
        body.appendChild(assessment);
      }

      if(activity.links && activity.links.length){
        const linksWrap = document.createElement('div');
        const headingEl = document.createElement('h3');
        headingEl.textContent = 'Links';
        const list = document.createElement('div');
        list.className = 'links-list';
        activity.links.forEach(function(link){
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
        linksWrap.appendChild(headingEl);
        linksWrap.appendChild(list);
        body.appendChild(linksWrap);
      }

      const tipText = teacherTips[activity.id];
      if(tipText){
        const tip = document.createElement('div');
        tip.className = 'teacher-tip';
        if(!state.teacherMode){ tip.hidden = true; }
        const strong = document.createElement('strong');
        strong.textContent = 'Teacher tips';
        const text = document.createElement('p');
        setHighlightedText(text, tipText);
        tip.appendChild(strong);
        tip.appendChild(text);
        body.appendChild(tip);
      }

      article.appendChild(body);

      toggleBtn.addEventListener('click', function(){
        const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        toggleBtn.setAttribute('aria-expanded', isExpanded ? 'false' : 'true');
        body.hidden = isExpanded;
      });

      grid.appendChild(article);
    });
  }

  function getOpenActivityIds(){
    const bodies = grid ? grid.querySelectorAll('.activity-body') : [];
    const open = new Set();
    bodies.forEach(function(body){
      if(!body.hidden && body.dataset && body.dataset.activityId){
        open.add(body.dataset.activityId);
      }
    });
    return open;
  }

  function toggleFavorite(activityId){
    const index = state.favorites.indexOf(activityId);
    if(index === -1){
      state.favorites.push(activityId);
    } else {
      state.favorites.splice(index, 1);
    }
    setStoredArray(STORAGE_KEYS.favorites, state.favorites);
    updateFavoritesButton();
  }

  function toggleSelected(activityId, isSelected){
    const idx = state.selectedForPrint.indexOf(activityId);
    if(isSelected && idx === -1){
      state.selectedForPrint.push(activityId);
    }
    if(!isSelected && idx > -1){
      state.selectedForPrint.splice(idx, 1);
    }
    setStoredArray(STORAGE_KEYS.selected, state.selectedForPrint);
  }

  function handlePrint(){
    if(!state.selectedForPrint.length){
      window.alert('Select at least one activity to print or export.');
      return;
    }
    buildPrintArea();
    document.body.classList.add('peo-printing');
    printArea.setAttribute('aria-hidden', 'false');
    window.print();
    setTimeout(cleanUpPrintMode, 1000);
  }

  function buildPrintArea(){
    printArea.innerHTML = '';
    const title = document.createElement('h1');
    title.textContent = 'PEO Year 9 Activities';
    const formatter = new Intl.DateTimeFormat('en-AU', { dateStyle: 'full', timeZone: 'Australia/Adelaide' });
    const meta = document.createElement('p');
    meta.className = 'print-meta';
    meta.textContent = 'Generated ' + formatter.format(new Date());
    printArea.appendChild(title);
    printArea.appendChild(meta);

    const selectedSet = new Set(state.selectedForPrint);
    const selectedEntries = state.activities.filter(function(entry){
      return selectedSet.has(entry.activity.id);
    });

    selectedEntries.sort(function(a, b){
      if(a.topicIndex !== b.topicIndex){ return a.topicIndex - b.topicIndex; }
      return a.activity.title.localeCompare(b.activity.title, undefined, { sensitivity: 'base' });
    });

    selectedEntries.forEach(function(entry){
      const activity = entry.activity;
      const topic = entry.topic;
      const container = document.createElement('article');
      container.className = 'peo-print-activity';

      const headingEl = document.createElement('h2');
      headingEl.textContent = activity.title;
      container.appendChild(headingEl);

      const topicLine = document.createElement('p');
      let topicText = 'Topic: ' + topic.title + ' • Duration: ' + (activity.duration || 'N/A');
      if(activity.grouping){
        topicText += ' • Grouping: ' + activity.grouping;
      }
      topicLine.textContent = topicText;
      container.appendChild(topicLine);

      if(activity.objectives && activity.objectives.length){
        const label = document.createElement('strong');
        label.textContent = 'Objectives';
        container.appendChild(label);
        const list = document.createElement('ul');
        activity.objectives.forEach(function(item){
          const li = document.createElement('li');
          li.textContent = item;
          list.appendChild(li);
        });
        container.appendChild(list);
      }

      if(activity.steps && activity.steps.length){
        const stepsHeading = document.createElement('strong');
        stepsHeading.textContent = 'Steps';
        container.appendChild(stepsHeading);
        const list = document.createElement('ol');
        activity.steps.forEach(function(item){
          const li = document.createElement('li');
          li.textContent = item;
          list.appendChild(li);
        });
        container.appendChild(list);
      }

      if(activity.materials && activity.materials.length){
        const materialsHeading = document.createElement('strong');
        materialsHeading.textContent = 'Materials';
        container.appendChild(materialsHeading);
        const list = document.createElement('ul');
        activity.materials.forEach(function(item){
          const li = document.createElement('li');
          li.textContent = item;
          list.appendChild(li);
        });
        container.appendChild(list);
      }

      if(activity.assessment){
        const assess = document.createElement('p');
        const bold = document.createElement('strong');
        bold.textContent = 'Assessment:';
        assess.appendChild(bold);
        assess.appendChild(document.createTextNode(' ' + activity.assessment));
        container.appendChild(assess);
      }

      if(activity.links && activity.links.length){
        const linksHeading = document.createElement('strong');
        linksHeading.textContent = 'Links';
        container.appendChild(linksHeading);
        const list = document.createElement('ul');
        activity.links.forEach(function(link){
          if(!link || !link.url){ return; }
          const li = document.createElement('li');
          const anchor = document.createElement('a');
          anchor.href = link.url;
          anchor.textContent = link.label || link.url;
          anchor.target = '_blank';
          anchor.rel = 'noopener noreferrer';
          li.appendChild(anchor);
          list.appendChild(li);
        });
        container.appendChild(list);
      }

      printArea.appendChild(container);
    });
  }

  function cleanUpPrintMode(){
    document.body.classList.remove('peo-printing');
    printArea.setAttribute('aria-hidden', 'true');
    printArea.innerHTML = '';
  }

  function focusHeadingForHash(){
    if(window.location.hash !== '#peo-y9' || !heading){ return; }
    if(typeof heading.focus === 'function'){
      heading.focus({ preventScroll: true });
    }
    heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function updateTeacherModeButton(){
    if(!teacherModeBtn){ return; }
    teacherModeBtn.setAttribute('aria-pressed', state.teacherMode ? 'true' : 'false');
    teacherModeBtn.textContent = state.teacherMode ? 'Teacher Mode: On' : 'Teacher Mode: Off';
  }

  function updateFavoritesButton(){
    if(!favoritesBtn){ return; }
    favoritesBtn.setAttribute('aria-pressed', state.favoritesOnly ? 'true' : 'false');
    favoritesBtn.textContent = state.favoritesOnly ? 'Favorites: On' : 'Favorites';
  }

  function isFavorite(activityId){
    return state.favorites.includes(activityId);
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
    const termPattern = escapeRegExp(term);
    if(!termPattern){
      element.textContent = value;
      return;
    }

    const regex = new RegExp('(' + termPattern + ')', 'ig');
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
  function debounce(fn, wait){
    let timeout;
    return function(){
      const args = arguments;
      const context = this;
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
