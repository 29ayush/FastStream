import {SubtitleTrack} from '../../SubtitleTrack.mjs';
import {Localize} from '../../modules/Localize.mjs';
import {EventEmitter} from '../../modules/eventemitter.mjs';
import {AlertPolyfill} from '../../utils/AlertPolyfill.mjs';
import {InterfaceUtils} from '../../utils/InterfaceUtils.mjs';
import {RequestUtils} from '../../utils/RequestUtils.mjs';
import {WebUtils} from '../../utils/WebUtils.mjs';
import {OptionsStore} from '../../options/OptionsStore.mjs';
import {DOMElements} from '../DOMElements.mjs';
import {createDropdown} from '../components/Dropdown.mjs';
import {createPagesBar} from '../components/PagesBar.mjs';

const API_KEY = 'jolY3ZCVYguxFxl8CkIKl52zpHJT2eTw';
const SUBS_WYZIE_SEARCH_URL = 'https://sub.wyzie.io/search';
const SUBS_WYZIE_MAX_RECENT_IMDB_IDS = 5;
const SubtitleSearchProviders = {
  OPEN_SUBTITLES: 'opensubtitles',
  SUBS_WYZIE: 'subswyzie',
};
const SubtitleSearchProviderLabels = {
  [SubtitleSearchProviders.OPEN_SUBTITLES]: 'OpenSubtitles',
  [SubtitleSearchProviders.SUBS_WYZIE]: 'SubsWyzie',
};
const SubsWyzieSourceModes = {
  RECENT: 'recent',
  CUSTOM: 'custom',
};

export const OpenSubtitlesSearchEvents = {
  TRACK_DOWNLOADED: 'trackDownloaded',
};

export class OpenSubtitlesSearch extends EventEmitter {
  constructor(client) {
    super();
    this.subui = {};
    this.client = client;
    this.version = client.version;
    this.optionsReady = OptionsStore.init().catch((e) => {
      console.error('Failed to load options for subtitle search', e);
    });
    this.setupUI();
  }

  openUI() {
    InterfaceUtils.closeWindows();
    DOMElements.subuiContainer.style.display = '';
    if (this.getSelectedProvider() === SubtitleSearchProviders.SUBS_WYZIE) {
      this.getSubsWyziePrimaryInput().focus();
    } else {
      this.subui.search.focus();
    }
  }

  closeUI() {
    DOMElements.subuiContainer.style.display = 'none';
  }

  isOpen() {
    return DOMElements.subuiContainer.style.display !== 'none';
  }

  toggleUI() {
    if (!this.isOpen()) {
      this.openUI();
    } else {
      this.closeUI();
    }
  }

  setupUI() {
    DOMElements.subuiContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    DOMElements.subuiContainer.addEventListener('dblclick', (e) => {
      e.stopPropagation();
    });

    DOMElements.subuiContainer.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });

    const closeBtn = DOMElements.subuiContainer.getElementsByClassName('close_button')[0];
    closeBtn.addEventListener('click', (e) => {
      this.closeUI();
    });

    WebUtils.setupTabIndex(closeBtn);
    const contentContainer = DOMElements.subuiContainer.getElementsByClassName('content_container')[0];

    this.subui.searchContainer = document.createElement('div');
    this.subui.searchContainer.classList.add('subtitle-search-container');

    contentContainer.appendChild(this.subui.searchContainer);

    const providerSelector = createDropdown(SubtitleSearchProviders.OPEN_SUBTITLES,
        'Provider', SubtitleSearchProviderLabels, () => {
          this.onProviderChanged();
        },
    );
    providerSelector.classList.add('subtitle-provider-selector');
    this.subui.providerSelector = providerSelector;
    this.subui.searchContainer.appendChild(providerSelector);

    const openSubtitlesContainer = document.createElement('div');
    openSubtitlesContainer.classList.add('subtitle-opensubtitles-container');
    this.subui.searchContainer.appendChild(openSubtitlesContainer);
    this.subui.openSubtitlesContainer = openSubtitlesContainer;

    const wyzieContainer = document.createElement('div');
    wyzieContainer.classList.add('subtitle-wyzie-container');
    this.subui.searchContainer.appendChild(wyzieContainer);
    this.subui.wyzieContainer = wyzieContainer;

    const wyzieImdbHeadingRow = document.createElement('div');
    wyzieImdbHeadingRow.classList.add('subtitle-wyzie-heading-row', 'subtitle-wyzie-imdb-heading-row');
    ['IMDb'].forEach((heading) => {
      const headingElement = document.createElement('div');
      headingElement.textContent = heading;
      wyzieImdbHeadingRow.appendChild(headingElement);
    });
    wyzieContainer.appendChild(wyzieImdbHeadingRow);

    const wyzieImdbValuesRow = document.createElement('div');
    wyzieImdbValuesRow.classList.add('subtitle-wyzie-values-row', 'subtitle-wyzie-imdb-values-row');
    wyzieContainer.appendChild(wyzieImdbValuesRow);

    const wyzieStatus = document.createElement('div');
    wyzieStatus.classList.add('subtitle-wyzie-source-status');
    wyzieContainer.appendChild(wyzieStatus);
    this.subui.wyzieStatus = wyzieStatus;

    const wyzieEpisodeHeadingRow = document.createElement('div');
    wyzieEpisodeHeadingRow.classList.add('subtitle-wyzie-heading-row', 'subtitle-wyzie-episode-heading-row');
    [
      Localize.getMessage('player_opensubtitles_seasonnum'),
      Localize.getMessage('player_opensubtitles_episodenum'),
      Localize.getMessage('player_opensubtitles_language'),
    ].forEach((heading) => {
      const headingElement = document.createElement('div');
      headingElement.textContent = heading;
      wyzieEpisodeHeadingRow.appendChild(headingElement);
    });
    wyzieContainer.appendChild(wyzieEpisodeHeadingRow);

    const wyzieEpisodeValuesRow = document.createElement('div');
    wyzieEpisodeValuesRow.classList.add('subtitle-wyzie-values-row', 'subtitle-wyzie-episode-values-row');
    wyzieContainer.appendChild(wyzieEpisodeValuesRow);

    const wyzieSearchRow = document.createElement('div');
    wyzieSearchRow.classList.add('subtitle-wyzie-search-row');
    wyzieContainer.appendChild(wyzieSearchRow);

    const searchInput = WebUtils.create('input', null, 'text_input');
    searchInput.placeholder = Localize.getMessage('player_opensubtitles_search_placeholder');
    searchInput.classList.add('subtitle-search-input');
    searchInput.ariaLabel = searchInput.placeholder;
    searchInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    openSubtitlesContainer.appendChild(searchInput);

    this.subui.search = searchInput;

    const searchBtn = WebUtils.create('div', null, 'textbutton subtitle-search-btn');
    searchBtn.textContent = Localize.getMessage('player_opensubtitles_searchbtn');
    WebUtils.setupTabIndex(searchBtn);
    openSubtitlesContainer.appendChild(searchBtn);


    const seasonInput = WebUtils.create('input', null, 'text_input');
    seasonInput.placeholder = Localize.getMessage('player_opensubtitles_seasonnum');
    seasonInput.classList.add('subtitle-season-input');
    seasonInput.style.display = 'none';
    seasonInput.ariaLabel = seasonInput.placeholder;
    seasonInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    this.subui.seasonInput = seasonInput;

    const episodeInput = WebUtils.create('input', null, 'text_input');
    episodeInput.placeholder = Localize.getMessage('player_opensubtitles_episodenum');
    episodeInput.classList.add('subtitle-episode-input');
    episodeInput.style.display = 'none';
    episodeInput.ariaLabel = episodeInput.placeholder;
    episodeInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    this.subui.episodeInput = episodeInput;

    const typeSelector = createDropdown('all',
        'Type', {
          'all': Localize.getMessage('player_opensubtitles_type_all'),
          'movie': Localize.getMessage('player_opensubtitles_type_movie'),
          'episode': Localize.getMessage('player_opensubtitles_type_episode'),
        }, (val) => {
          if (val === 'episode') {
            seasonInput.style.display = '';
            episodeInput.style.display = '';
          } else {
            seasonInput.style.display = 'none';
            episodeInput.style.display = 'none';
          }
        },
    );

    this.subui.typeSelector = typeSelector;

    typeSelector.classList.add('subtitle-type-selector');

    openSubtitlesContainer.appendChild(typeSelector);
    openSubtitlesContainer.appendChild(seasonInput);
    openSubtitlesContainer.appendChild(episodeInput);


    const languageInput = WebUtils.create('input', null, 'text_input');
    languageInput.placeholder = Localize.getMessage('player_opensubtitles_language');
    languageInput.classList.add('subtitle-language-input');
    languageInput.ariaLabel = languageInput.placeholder;
    openSubtitlesContainer.appendChild(languageInput);
    this.subui.languageInput = languageInput;
    languageInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    const yearInput = WebUtils.create('input', null, 'text_input');
    yearInput.placeholder = Localize.getMessage('player_opensubtitles_year');
    yearInput.classList.add('subtitle-year-input');
    yearInput.ariaLabel = yearInput.placeholder;
    openSubtitlesContainer.appendChild(yearInput);
    this.subui.yearInput = yearInput;
    yearInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });

    const sortSelector = createDropdown('download_count',
        Localize.getMessage('player_opensubtitles_sortby'), {
          'download_count': Localize.getMessage('player_opensubtitles_sortby_downloads'),
          'upload_date': Localize.getMessage('player_opensubtitles_sortby_date'),
          'rating': Localize.getMessage('player_opensubtitles_sortby_rating'),
          'votes': Localize.getMessage('player_opensubtitles_sortby_votes'),
        },
    );
    sortSelector.classList.add('subtitle-sort-selector');
    openSubtitlesContainer.appendChild(sortSelector);


    const sortDirectionSelector = createDropdown('desc',
        Localize.getMessage('player_opensubtitles_sort'), {
          'desc': Localize.getMessage('player_opensubtitles_sort_desc'),
          'asc': Localize.getMessage('player_opensubtitles_sort_asc'),
        },
    );

    sortDirectionSelector.classList.add('subtitle-sort-direction-selector');
    openSubtitlesContainer.appendChild(sortDirectionSelector);

    const wyzieImdbPicker = document.createElement('div');
    wyzieImdbPicker.classList.add('subtitle-wyzie-imdb-picker');
    wyzieImdbPicker.dataset.mode = SubsWyzieSourceModes.CUSTOM;
    wyzieImdbPicker.dataset.id = '';
    wyzieImdbPicker.tabIndex = 0;
    wyzieImdbPicker.role = 'listbox';
    wyzieImdbPicker.ariaLabel = 'SubsWyzie IMDb source';

    const wyzieImdbPickerButton = document.createElement('div');
    wyzieImdbPickerButton.classList.add('subtitle-wyzie-imdb-picker-button');
    const wyzieImdbPickerText = document.createElement('span');
    wyzieImdbPickerText.classList.add('subtitle-wyzie-imdb-picker-text');
    wyzieImdbPickerButton.appendChild(wyzieImdbPickerText);
    const wyzieImdbPickerArrow = document.createElement('span');
    wyzieImdbPickerArrow.classList.add('subtitle-wyzie-imdb-picker-arrow');
    wyzieImdbPickerArrow.textContent = 'v';
    wyzieImdbPickerButton.appendChild(wyzieImdbPickerArrow);
    wyzieImdbPicker.appendChild(wyzieImdbPickerButton);

    const wyzieImdbPickerMenu = document.createElement('div');
    wyzieImdbPickerMenu.classList.add('subtitle-wyzie-imdb-picker-menu');
    wyzieImdbPicker.appendChild(wyzieImdbPickerMenu);
    wyzieImdbPickerButton.addEventListener('click', (e) => {
      wyzieImdbPicker.focus();
      e.stopPropagation();
    });
    wyzieImdbPicker.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.shiftSubsWyzieImdbChoice(e.key === 'ArrowDown' ? 1 : -1);
      }
    });
    wyzieImdbValuesRow.appendChild(wyzieImdbPicker);
    this.subui.wyzieImdbPicker = wyzieImdbPicker;
    this.subui.wyzieImdbPickerText = wyzieImdbPickerText;
    this.subui.wyzieImdbPickerMenu = wyzieImdbPickerMenu;

    const wyzieCustomFields = document.createElement('div');
    wyzieCustomFields.classList.add('subtitle-wyzie-custom-fields');
    wyzieImdbValuesRow.appendChild(wyzieCustomFields);
    this.subui.wyzieCustomFields = wyzieCustomFields;

    const wyzieImdbInput = WebUtils.create('input', null, 'text_input');
    wyzieImdbInput.placeholder = 'IMDb ID';
    wyzieImdbInput.classList.add('subtitle-wyzie-imdb-input');
    wyzieImdbInput.ariaLabel = wyzieImdbInput.placeholder;
    wyzieImdbInput.autocapitalize = 'off';
    wyzieImdbInput.autocomplete = 'off';
    wyzieImdbInput.autocorrect = 'off';
    wyzieImdbInput.spellcheck = false;
    wyzieImdbInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    wyzieImdbInput.addEventListener('change', () => {
      this.updateSubsWyzieSourceStatus();
    });
    wyzieImdbInput.addEventListener('input', () => {
      this.updateSubsWyzieSourceStatus();
    });
    wyzieCustomFields.appendChild(wyzieImdbInput);
    this.subui.wyzieImdbInput = wyzieImdbInput;

    const wyzieLabelInput = WebUtils.create('input', null, 'text_input');
    wyzieLabelInput.placeholder = 'Label';
    wyzieLabelInput.classList.add('subtitle-wyzie-label-input');
    wyzieLabelInput.ariaLabel = 'IMDb label';
    wyzieLabelInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    wyzieCustomFields.appendChild(wyzieLabelInput);
    this.subui.wyzieLabelInput = wyzieLabelInput;

    const wyzieSeasonInput = WebUtils.create('input', null, 'text_input');
    wyzieSeasonInput.placeholder = Localize.getMessage('player_opensubtitles_seasonnum');
    wyzieSeasonInput.classList.add('subtitle-wyzie-season-input');
    wyzieSeasonInput.ariaLabel = wyzieSeasonInput.placeholder;
    wyzieSeasonInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    wyzieEpisodeValuesRow.appendChild(wyzieSeasonInput);
    this.subui.wyzieSeasonInput = wyzieSeasonInput;

    const wyzieEpisodeInput = WebUtils.create('input', null, 'text_input');
    wyzieEpisodeInput.placeholder = Localize.getMessage('player_opensubtitles_episodenum');
    wyzieEpisodeInput.classList.add('subtitle-wyzie-episode-input');
    wyzieEpisodeInput.ariaLabel = wyzieEpisodeInput.placeholder;
    wyzieEpisodeInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    wyzieEpisodeValuesRow.appendChild(wyzieEpisodeInput);
    this.subui.wyzieEpisodeInput = wyzieEpisodeInput;

    const wyzieLanguageInput = WebUtils.create('input', null, 'text_input');
    wyzieLanguageInput.placeholder = Localize.getMessage('player_opensubtitles_language');
    wyzieLanguageInput.classList.add('subtitle-wyzie-language-input');
    wyzieLanguageInput.ariaLabel = wyzieLanguageInput.placeholder;
    wyzieLanguageInput.value = 'en';
    wyzieLanguageInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    wyzieEpisodeValuesRow.appendChild(wyzieLanguageInput);
    this.subui.wyzieLanguageInput = wyzieLanguageInput;

    const wyzieSearchBtn = WebUtils.create('div', null, 'textbutton subtitle-search-btn subtitle-wyzie-search-btn');
    wyzieSearchBtn.textContent = Localize.getMessage('player_opensubtitles_searchbtn');
    WebUtils.setupTabIndex(wyzieSearchBtn);
    wyzieSearchRow.appendChild(wyzieSearchBtn);
    this.subui.wyzieSearchBtn = wyzieSearchBtn;

    this.subui.openSubtitlesElements = [
      openSubtitlesContainer,
    ];

    this.subui.subsWyzieElements = [
      wyzieContainer,
    ];

    const searchOnEnter = (e) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        document.activeElement?.blur?.();
        this.queryCurrentProvider();
      }
    };

    this.subui.search.addEventListener('keydown', searchOnEnter, true);
    languageInput.addEventListener('keydown', searchOnEnter, true);
    yearInput.addEventListener('keydown', searchOnEnter, true);
    seasonInput.addEventListener('keydown', searchOnEnter, true);
    episodeInput.addEventListener('keydown', searchOnEnter, true);
    typeSelector.addEventListener('keydown', searchOnEnter, true);
    sortSelector.addEventListener('keydown', searchOnEnter, true);
    sortDirectionSelector.addEventListener('keydown', searchOnEnter, true);
    wyzieImdbInput.addEventListener('keydown', searchOnEnter, true);
    wyzieLabelInput.addEventListener('keydown', searchOnEnter, true);
    wyzieSeasonInput.addEventListener('keydown', searchOnEnter, true);
    wyzieEpisodeInput.addEventListener('keydown', searchOnEnter, true);
    wyzieLanguageInput.addEventListener('keydown', searchOnEnter, true);

    searchBtn.addEventListener('click', (e) => {
      this.queryCurrentProvider();
    });

    wyzieSearchBtn.addEventListener('click', (e) => {
      this.queryCurrentProvider();
    });

    this.subui.results = document.createElement('div');
    this.subui.results.classList.add('subtitle-results');
    contentContainer.appendChild(this.subui.results);

    this.subui.pages = document.createElement('div');
    this.subui.pages.classList.add('subtitle-pages');
    contentContainer.appendChild(this.subui.pages);

    this.updateSubsWyzieImdbPicker();
    this.loadFromSession();
    this.updateSearchProvider();
    this.optionsReady.then(() => {
      this.loadSubsWyzieFromOptions();
      this.loadSubtitleSearchProvider();
    });
  }

  loadFromSession() {
    const inputDataStr = sessionStorage.getItem('subtitleSearch');
    if (!inputDataStr) {
      return;
    }

    const inputData = JSON.parse(inputDataStr);

    this.subui.search.value = inputData.query;
    this.subui.languageInput.value = inputData.language;
    Array.from(this.subui.typeSelector.children[1].children).find((el) => el.dataset.val === inputData.type)?.click();
    this.subui.yearInput.value = inputData.year;
    this.subui.seasonInput.value = inputData.season;
    this.subui.episodeInput.value = inputData.episode;
  }

  saveToSession() {
    const inputData = {
      query: this.subui.search.value,
      language: this.subui.languageInput.value,
      type: this.subui.typeSelector.dataset.val,
      year: this.subui.yearInput.value,
      season: this.subui.seasonInput.value,
      episode: this.subui.episodeInput.value,
    };

    sessionStorage.setItem('subtitleSearch', JSON.stringify(inputData));
  }

  getSelectedProvider() {
    return this.subui.providerSelector.dataset.val || SubtitleSearchProviders.OPEN_SUBTITLES;
  }

  onProviderChanged() {
    const provider = this.getSelectedProvider();
    this.updateSearchProvider(true);
    OptionsStore.set({
      subtitleSearchProvider: provider,
    }).then(() => {
      if (this.client?.options) {
        this.client.options.subtitleSearchProvider = provider;
      }
    }).catch((e) => {
      console.error('Failed to save subtitle provider', e);
    });
  }

  loadSubtitleSearchProvider() {
    const provider = OptionsStore.get()?.subtitleSearchProvider || SubtitleSearchProviders.OPEN_SUBTITLES;
    this.setProviderDropdown(provider);
    this.updateSearchProvider();
  }

  setProviderDropdown(provider) {
    if (!Object.values(SubtitleSearchProviders).includes(provider)) {
      provider = SubtitleSearchProviders.OPEN_SUBTITLES;
    }

    const selector = this.subui.providerSelector;
    selector.dataset.val = provider;
    const label = SubtitleSearchProviderLabels[provider];
    const labelElement = selector.querySelector('.dropdown_text');
    if (labelElement) {
      labelElement.textContent = label;
    }
    selector.ariaLabel = 'Provider: ' + label;

    selector.querySelectorAll('.items [data-val]').forEach((item) => {
      item.style.backgroundColor = item.dataset.val === provider ? 'var(--popwindow-dropdown-item-selected-background-color)' : '';
    });
  }

  updateSearchProvider(focus = false) {
    const provider = this.getSelectedProvider();
    const isSubsWyzie = provider === SubtitleSearchProviders.SUBS_WYZIE;

    this.subui.openSubtitlesElements.forEach((element) => {
      if (element === this.subui.seasonInput || element === this.subui.episodeInput) {
        element.style.display = !isSubsWyzie && this.subui.typeSelector.dataset.val === 'episode' ? '' : 'none';
      } else {
        element.style.display = isSubsWyzie ? 'none' : '';
      }
    });

    this.subui.subsWyzieElements.forEach((element) => {
      element.style.display = isSubsWyzie ? '' : 'none';
    });

    this.subui.results.replaceChildren();
    this.subui.pages.replaceChildren();

    if (focus) {
      if (isSubsWyzie) {
        this.getSubsWyziePrimaryInput().focus();
      } else {
        this.subui.search.focus();
      }
    }
  }

  queryCurrentProvider() {
    if (this.getSelectedProvider() === SubtitleSearchProviders.SUBS_WYZIE) {
      this.querySubsWyzie(this.getSubsWyzieQuery()).catch((e) => {
        console.error(e);
        AlertPolyfill.toast('error', Localize.getMessage('player_subtitles_addtrack_error'), e?.message);
      });
      return;
    }

    this.queryOpenSubtitles(this.getOpenSubtitlesQuery()).catch((e) => {
      console.error(e);
      AlertPolyfill.toast('error', Localize.getMessage('player_subtitles_addtrack_error'), e?.message);
    });
    this.saveToSession();
  }

  getOpenSubtitlesQuery() {
    return {
      query: this.subui.search.value,
      type: this.subui.typeSelector.dataset.val,
      season: this.subui.seasonInput.value,
      episode: this.subui.episodeInput.value,
      language: this.subui.languageInput.value,
      year: this.subui.yearInput.value,
      sortBy: this.subui.searchContainer.querySelector('.subtitle-sort-selector').dataset.val,
      sortDirection: this.subui.searchContainer.querySelector('.subtitle-sort-direction-selector').dataset.val,
      page: 1,
    };
  }

  getSubsWyzieQuery() {
    const sourceMode = this.getSubsWyzieSourceMode();
    const recentEntry = sourceMode === SubsWyzieSourceModes.RECENT ? this.getSelectedSubsWyzieRecentEntry() : null;
    const imdbId = recentEntry?.id || this.subui.wyzieImdbInput.value;
    return {
      imdbId: this.normalizeImdbId(imdbId),
      label: sourceMode === SubsWyzieSourceModes.RECENT ? recentEntry?.label || '' : this.subui.wyzieLabelInput.value.trim(),
      season: this.subui.wyzieSeasonInput.value.trim(),
      episode: this.subui.wyzieEpisodeInput.value.trim(),
      language: (this.subui.wyzieLanguageInput.value.trim() || 'en').toLowerCase(),
    };
  }

  normalizeImdbId(value) {
    const trimmed = (value || '').trim();
    if (/^\d+$/.test(trimmed)) {
      return 'tt' + trimmed;
    }
    return trimmed;
  }

  getXhrErrorMessage(xhr, fallback) {
    const response = xhr?.response;
    if (typeof response === 'string' && response) {
      return response;
    }

    if (response?.error) {
      return Array.isArray(response.error) ? response.error.join(', ') : String(response.error);
    }

    if (response?.message) {
      return String(response.message);
    }

    return xhr?.statusText || fallback;
  }

  isSubsWyzieNoResultsResponse(xhr) {
    const response = xhr?.response;
    const message = [
      response?.message,
      response?.details,
    ].filter(Boolean).join(' ').toLowerCase();

    return Number(response?.code) === 400 && message.includes('no subtitles found');
  }

  requestSubsWyzie(query, apiKey, includeLanguage = true) {
    const requestQuery = {
      id: query.imdbId,
      key: apiKey,
    };

    if (query.season) {
      requestQuery.season = query.season;
    }

    if (query.episode) {
      requestQuery.episode = query.episode;
    }

    if (includeLanguage) {
      requestQuery.language = query.language || 'en';
    }

    return RequestUtils.request({
      responseType: 'json',
      url: SUBS_WYZIE_SEARCH_URL,
      query: requestQuery,
    });
  }

  getSubsWyzieSubtitlesFromResponse(response, fallbackErrorMessage) {
    if (response.status < 200 || response.status >= 300) {
      if (this.isSubsWyzieNoResultsResponse(response)) {
        return [];
      }

      throw new Error(this.getXhrErrorMessage(response, fallbackErrorMessage));
    }

    if (!Array.isArray(response.response)) {
      if (this.isSubsWyzieNoResultsResponse(response)) {
        return [];
      }

      throw new Error(this.getXhrErrorMessage(response, 'Unexpected response'));
    }

    return response.response;
  }

  filterSubsWyzieSubtitlesByLanguage(subtitles, language) {
    const normalizedLanguage = (language || 'en').toLowerCase();
    return subtitles.filter((item) => {
      return (item.language || '').toLowerCase() === normalizedLanguage;
    });
  }

  getSubsWyziePrimaryInput() {
    return this.getSubsWyzieSourceMode() === SubsWyzieSourceModes.CUSTOM ?
      this.subui.wyzieImdbInput :
      this.subui.wyzieSeasonInput;
  }

  getSubsWyzieSourceMode() {
    return this.subui.wyzieImdbPicker?.dataset.mode || SubsWyzieSourceModes.CUSTOM;
  }

  getSubsWyzieRecentImdbIds() {
    const recent = OptionsStore.get()?.subsWyzieRecentImdbIds;
    if (!Array.isArray(recent)) {
      return [];
    }

    return recent.filter((entry) => entry?.id);
  }

  getSelectedSubsWyzieRecentEntry() {
    const selectedId = this.subui.wyzieImdbPicker?.dataset.id;
    return this.getSubsWyzieRecentImdbIds().find((entry) => entry.id === selectedId) || null;
  }

  getSubsWyzieChoiceLabel(entry) {
    if (!entry) {
      return 'Custom';
    }

    return entry.label ? `${entry.label} (${entry.id})` : entry.id;
  }

  getSubsWyzieChoiceList() {
    return [
      {mode: SubsWyzieSourceModes.CUSTOM, id: ''},
      ...this.getSubsWyzieRecentImdbIds().map((entry) => {
        return {mode: SubsWyzieSourceModes.RECENT, id: entry.id};
      }),
    ];
  }

  shiftSubsWyzieImdbChoice(indexAmount) {
    const choices = this.getSubsWyzieChoiceList();
    const currentMode = this.getSubsWyzieSourceMode();
    const currentId = this.subui.wyzieImdbPicker.dataset.id || '';
    let currentIndex = choices.findIndex((choice) => {
      return choice.mode === currentMode && choice.id === currentId;
    });
    if (currentIndex === -1) {
      currentIndex = 0;
    }

    const nextIndex = (currentIndex + indexAmount + choices.length) % choices.length;
    const nextChoice = choices[nextIndex];
    this.selectSubsWyzieImdbChoice(nextChoice.mode, nextChoice.id);
  }

  updateSubsWyzieImdbPicker() {
    const recent = this.getSubsWyzieRecentImdbIds();
    const previousMode = this.getSubsWyzieSourceMode();
    const previousId = this.subui.wyzieImdbPicker.dataset.id || '';
    const menu = this.subui.wyzieImdbPickerMenu;
    menu.replaceChildren();

    const addChoice = (mode, id, label, deletable = false) => {
      const item = document.createElement('div');
      item.classList.add('subtitle-wyzie-imdb-picker-item');
      item.dataset.mode = mode;
      item.dataset.id = id;
      item.role = 'option';

      const labelElement = document.createElement('span');
      labelElement.classList.add('subtitle-wyzie-imdb-picker-item-label');
      labelElement.textContent = label;
      item.appendChild(labelElement);

      if (deletable) {
        const deleteButton = document.createElement('button');
        deleteButton.classList.add('subtitle-wyzie-imdb-picker-delete');
        deleteButton.type = 'button';
        deleteButton.textContent = 'x';
        deleteButton.ariaLabel = 'Delete ' + label;
        deleteButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.deleteSubsWyzieRecentImdbId(id).catch((error) => {
            console.error('Failed to delete SubsWyzie recent IMDb ID', error);
          });
        });
        item.appendChild(deleteButton);
      }

      item.addEventListener('click', (e) => {
        this.selectSubsWyzieImdbChoice(mode, id);
        this.subui.wyzieImdbPicker.blur();
        e.stopPropagation();
      });

      menu.appendChild(item);
    };

    addChoice(SubsWyzieSourceModes.CUSTOM, '', 'Custom');

    if (!recent.length) {
      const emptyItem = document.createElement('div');
      emptyItem.classList.add('subtitle-wyzie-imdb-picker-empty');
      emptyItem.textContent = 'No recent IMDb IDs saved';
      menu.appendChild(emptyItem);
    }

    recent.forEach((entry) => {
      addChoice(SubsWyzieSourceModes.RECENT, entry.id, this.getSubsWyzieChoiceLabel(entry), true);
    });

    let nextMode = previousMode;
    let nextId = previousId;
    if (nextMode === SubsWyzieSourceModes.RECENT && !recent.some((entry) => entry.id === nextId)) {
      nextMode = recent[0] ? SubsWyzieSourceModes.RECENT : SubsWyzieSourceModes.CUSTOM;
      nextId = recent[0]?.id || '';
    }

    const shouldSyncFields = nextMode !== previousMode || nextId !== previousId;
    this.selectSubsWyzieImdbChoice(nextMode, nextId, {syncFields: shouldSyncFields});
  }

  selectSubsWyzieImdbChoice(mode, imdbId = '', {syncFields = true} = {}) {
    const normalizedId = this.normalizeImdbId(imdbId);
    let entry = null;
    if (mode === SubsWyzieSourceModes.RECENT) {
      entry = this.getSubsWyzieRecentImdbIds().find((item) => item.id === normalizedId) || null;
      if (!entry) {
        mode = SubsWyzieSourceModes.CUSTOM;
      }
    }

    this.subui.wyzieImdbPicker.dataset.mode = mode;
    this.subui.wyzieImdbPicker.dataset.id = entry?.id || '';

    if (entry && syncFields) {
      this.populateSubsWyzieFromRecent(entry.id);
    }

    const isCustom = mode === SubsWyzieSourceModes.CUSTOM;
    const pickerLabel = isCustom ? 'Custom' : this.getSubsWyzieChoiceLabel(entry);
    this.subui.wyzieImdbPickerText.textContent = pickerLabel;
    this.subui.wyzieImdbPicker.ariaLabel = 'SubsWyzie IMDb source: ' + pickerLabel;
    this.subui.wyzieCustomFields.style.display = isCustom ? '' : 'none';

    this.subui.wyzieImdbPickerMenu.querySelectorAll('.subtitle-wyzie-imdb-picker-item').forEach((item) => {
      item.classList.toggle('is-selected', item.dataset.mode === mode && (item.dataset.id || '') === (entry?.id || ''));
    });
    this.updateSubsWyzieSourceStatus();
  }

  populateSubsWyzieFromRecent(imdbId) {
    const normalizedId = this.normalizeImdbId(imdbId);
    const entry = this.getSubsWyzieRecentImdbIds().find((item) => item.id === normalizedId);
    if (!entry) {
      return;
    }

    this.subui.wyzieImdbInput.value = entry.id;
    this.subui.wyzieLabelInput.value = entry.label || '';
    this.subui.wyzieSeasonInput.value = entry.season || '';
    this.subui.wyzieEpisodeInput.value = entry.episode || '';
    this.subui.wyzieLanguageInput.value = entry.language || 'en';
    this.updateSubsWyzieSourceStatus();
  }

  loadSubsWyzieFromOptions() {
    this.updateSubsWyzieImdbPicker();

    const recent = this.getSubsWyzieRecentImdbIds();
    if (recent[0]) {
      this.selectSubsWyzieImdbChoice(SubsWyzieSourceModes.RECENT, recent[0].id);
      return;
    }

    this.subui.wyzieLanguageInput.value = 'en';
    this.selectSubsWyzieImdbChoice(SubsWyzieSourceModes.CUSTOM);
  }

  updateSubsWyzieSourceStatus() {
    this.subui.wyzieStatus.textContent = '';
  }

  async deleteSubsWyzieRecentImdbId(imdbId) {
    await this.optionsReady;

    const normalizedId = this.normalizeImdbId(imdbId);
    const isDeletingSelected = this.getSubsWyzieSourceMode() === SubsWyzieSourceModes.RECENT &&
      this.subui.wyzieImdbPicker.dataset.id === normalizedId;
    const newRecent = this.getSubsWyzieRecentImdbIds().filter((entry) => entry.id !== normalizedId);
    await OptionsStore.set({
      subsWyzieRecentImdbIds: newRecent,
    });

    if (this.client?.options) {
      this.client.options.subsWyzieRecentImdbIds = newRecent;
    }

    if (isDeletingSelected && !newRecent.length) {
      this.subui.wyzieImdbInput.value = '';
      this.subui.wyzieLabelInput.value = '';
    }

    this.updateSubsWyzieImdbPicker();
  }

  async persistSubsWyzieQuery(query) {
    await this.optionsReady;

    const sourceMode = this.getSubsWyzieSourceMode();
    const recent = this.getSubsWyzieRecentImdbIds();
    const existing = recent.find((entry) => entry.id === query.imdbId);
    const newEntry = {
      id: query.imdbId,
      label: query.label || existing?.label || '',
      season: query.season,
      episode: query.episode,
      language: query.language || 'en',
    };

    const newRecent = [
      newEntry,
      ...recent.filter((entry) => entry.id !== query.imdbId),
    ].slice(0, SUBS_WYZIE_MAX_RECENT_IMDB_IDS);

    await OptionsStore.set({
      subsWyzieRecentImdbIds: newRecent,
    });

    if (this.client?.options) {
      this.client.options.subsWyzieRecentImdbIds = newRecent;
    }

    this.updateSubsWyzieImdbPicker();
    if (sourceMode === SubsWyzieSourceModes.RECENT) {
      this.selectSubsWyzieImdbChoice(SubsWyzieSourceModes.RECENT, query.imdbId, {syncFields: false});
    }
    this.updateSubsWyzieSourceStatus();
  }

  async queryOpenSubtitles(query) {
    const defaulQuery = {
      page: '1',
      type: 'all',
    };
    const translatedQuery = {
      query: '' + query.query,
      type: '' + query.type,
      languages: '' + query.language,
      year: '' + query.year,
      order_by: '' + query.sortBy,
      order_direction: '' + query.sortDirection,
      page: '' + query.page,
    };

    if (query.type === 'episode') {
      translatedQuery.season_number = '' + query.season;
      translatedQuery.episode_number = '' + query.episode;
    }
    console.log(translatedQuery);

    // sort query alphabetically
    const sortedQuery = {};
    Object.keys(translatedQuery).sort().forEach(function(key) {
      if (translatedQuery[key].length > 0 && translatedQuery[key] !== defaulQuery[key]) {
        sortedQuery[key] = translatedQuery[key];
      }
    });

    this.subui.results.replaceChildren();
    const container = document.createElement('div');
    container.textContent = Localize.getMessage('player_opensubtitles_searching');
    this.subui.results.appendChild(container);

    let response;
    try {
      response = (await RequestUtils.request({
        usePlusForSpaces: true,
        responseType: 'json',
        url: 'https://api.opensubtitles.com/api/v1/subtitles',
        query: sortedQuery,
        headers: {
          'Api-Key': API_KEY,
        },
        header_commands: [
          {
            operation: 'set',
            header: 'User-Agent',
            value: 'FastStream V' + this.version,
          },
        ],
      })).response;

      if (response.errors) {
        container.textContent = Localize.getMessage('player_opensubtitles_error', [response.errors.join(', ')]);
        return;
      }
    } catch (e) {
      console.log(e);
      if (!chrome?.extension) {
        container.textContent = Localize.getMessage('player_opensubtitles_disabled');
      } else {
        container.textContent = Localize.getMessage('player_opensubtitles_error_down');
      }
      return;
    }


    this.subui.results.replaceChildren();
    this.subui.pages.replaceChildren();

    if (response.data.length === 0) {
      const container = document.createElement('div');
      container.textContent = Localize.getMessage('player_opensubtitles_noresults');
      this.subui.results.appendChild(container);
      return;
    }

    if (response.total_pages > 1) {
      const responseBar = createPagesBar(response.page, response.total_pages, (page) => {
        query.page = page;
        this.subui.pages.replaceChildren();
        this.subui.pages.appendChild(createPagesBar(page, response.total_pages, ()=>{
          this.queryOpenSubtitles(query);
        }));
        this.queryOpenSubtitles(query);
      });
      this.subui.pages.appendChild(responseBar);
    }

    response.data.forEach((item) => {
      const container = document.createElement('div');
      container.classList.add('subtitle-result-container');
      this.subui.results.appendChild(container);

      const lang = document.createElement('div');
      lang.classList.add('subtitle-result-lang');
      lang.textContent = item.attributes.language;
      container.appendChild(lang);

      const title = document.createElement('div');
      title.classList.add('subtitle-result-title');
      title.textContent = item.attributes.feature_details.movie_name + ' (' + item.attributes.feature_details.year + ')';
      container.appendChild(title);

      const user = document.createElement('div');
      user.classList.add('subtitle-result-user');
      user.textContent = item.attributes.uploader.name;
      container.appendChild(user);


      const rank = document.createElement('div');
      rank.classList.add('subtitle-result-rank');
      rank.textContent = item.attributes.ratings;
      container.appendChild(rank);

      WebUtils.setupTabIndex(container);
      container.addEventListener('click', async (e) => {
        console.log(item.attributes.files[0].file_id);
        let body;
        if (item.downloading) {
          return;
        }

        item.downloading = true;

        AlertPolyfill.toast('info', Localize.getMessage('player_subtitles_addtrack_downloading'));

        try {
          let link = item.cached_download_link;
          if (!link) {
            const data = (await RequestUtils.request({
              type: 'POST',
              url: 'https://api.opensubtitles.com/api/v1/download',
              responseType: 'json',
              headers: {
                'Api-Key': API_KEY,
                'Content-Type': 'application/json',
              },

              header_commands: [
                {
                  operation: 'set',
                  header: 'User-Agent',
                  value: 'FastStream V' + this.version,
                },
              ],

              data: JSON.stringify({
                file_id: item.attributes.files[0].file_id,
                sub_format: 'webvtt',
              }),
            })).response;

            if (!data.link && data.remaining <= 0) {
              item.downloading = false;
              await AlertPolyfill.alert(Localize.getMessage('player_opensubtitles_quota', [data.reset_time]), 'warning');
              if (await AlertPolyfill.confirm(Localize.getMessage('player_opensubtitles_askopen'), 'question')) {
                window.open(item.attributes.url);
              }
              return;
            }

            if (!data.link) {
              throw new Error('No link');
            }

            item.cached_download_link = data.link;
            link = data.link;
          }

          body = (await RequestUtils.request({
            url: link,

            header_commands: [
              {
                operation: 'set',
                header: 'User-Agent',
                value: 'FastStream V' + this.version,
              },
            ],
          }));

          if (body.status < 200 || body.status >= 300) {
            throw new Error('Bad status code');
          }

          body = body.responseText;

          if (!body) {
            throw new Error('No body');
          }
        } catch (e) {
          console.log(e);
          if (DOMElements.subuiContainer.style.display === 'none') return;
          item.downloading = false;
          await AlertPolyfill.alert(Localize.getMessage('player_opensubtitles_down_alert'), 'error');
          if (await AlertPolyfill.confirm(Localize.getMessage('player_opensubtitles_askopen'), 'question')) {
            window.open(item.attributes.url);
          }
          return;
        }

        item.downloading = false;
        try {
          const track = new SubtitleTrack(item.attributes.uploader.name + ' - ' + item.attributes.feature_details.movie_name, item.attributes.language);
          track.loadText(body);
          this.emit(OpenSubtitlesSearchEvents.TRACK_DOWNLOADED, track);
          AlertPolyfill.toast('success', Localize.getMessage('player_subtitles_addtrack_success'));
        } catch (e) {
          AlertPolyfill.toast('error', Localize.getMessage('player_subtitles_addtrack_error'), e?.message);
        }
      });
    });
  }

  async querySubsWyzie(query) {
    this.subui.results.replaceChildren();
    this.subui.pages.replaceChildren();

    const container = document.createElement('div');
    this.subui.results.appendChild(container);

    if (!query.imdbId) {
      container.textContent = 'Enter an IMDb ID.';
      return;
    }

    await this.optionsReady;
    const apiKey = (OptionsStore.get()?.subsWyzieApiKey || '').trim();
    if (!apiKey) {
      container.textContent = 'Add a SubsWyzie API key in preferences.';
      return;
    }

    container.textContent = Localize.getMessage('player_opensubtitles_searching');

    let response;
    try {
      response = await this.requestSubsWyzie(query, apiKey);
    } catch (e) {
      console.log(e);
      container.textContent = Localize.getMessage('player_opensubtitles_error_down');
      return;
    }

    let subtitles;
    try {
      subtitles = this.getSubsWyzieSubtitlesFromResponse(response, 'Request failed');
      if (!subtitles.length && this.isSubsWyzieNoResultsResponse(response)) {
        const fallbackResponse = await this.requestSubsWyzie(query, apiKey, false);
        subtitles = this.filterSubsWyzieSubtitlesByLanguage(
            this.getSubsWyzieSubtitlesFromResponse(fallbackResponse, 'Request failed'),
            query.language,
        );
      }
    } catch (e) {
      console.log(e);
      container.textContent = Localize.getMessage('player_opensubtitles_error', [e?.message || 'Request failed']);
      return;
    }

    subtitles.sort((a, b) => {
      return (Number(b.downloadCount) || 0) - (Number(a.downloadCount) || 0);
    });

    await this.persistSubsWyzieQuery(query);

    this.subui.results.replaceChildren();

    if (!subtitles.length) {
      const emptyContainer = document.createElement('div');
      emptyContainer.textContent = Localize.getMessage('player_opensubtitles_noresults');
      this.subui.results.appendChild(emptyContainer);
      return;
    }

    subtitles.forEach((item) => {
      const resultContainer = document.createElement('div');
      resultContainer.classList.add('subtitle-result-container');
      this.subui.results.appendChild(resultContainer);

      const lang = document.createElement('div');
      lang.classList.add('subtitle-result-lang');
      lang.textContent = item.language || query.language || 'en';
      resultContainer.appendChild(lang);

      const title = document.createElement('div');
      title.classList.add('subtitle-result-title');
      title.textContent = item.fileName || item.release || item.media || 'SubsWyzie subtitle';
      resultContainer.appendChild(title);

      const source = document.createElement('div');
      source.classList.add('subtitle-result-user');
      source.textContent = item.source || item.display || item.format || 'SubsWyzie';
      resultContainer.appendChild(source);

      const rank = document.createElement('div');
      rank.classList.add('subtitle-result-rank');
      rank.textContent = String(Number(item.downloadCount) || 0);
      resultContainer.appendChild(rank);

      WebUtils.setupTabIndex(resultContainer);
      resultContainer.addEventListener('click', async () => {
        if (item.downloading) {
          return;
        }

        const url = item.url || item.downloadUrl || item.link;
        if (!url) {
          AlertPolyfill.toast('error', Localize.getMessage('player_subtitles_addtrack_error'), 'No download URL');
          return;
        }

        item.downloading = true;
        AlertPolyfill.toast('info', Localize.getMessage('player_subtitles_addtrack_downloading'));

        try {
          const body = await RequestUtils.request({
            url,
          });

          if (body.status < 200 || body.status >= 300) {
            throw new Error('Bad status code');
          }

          if (!body.responseText) {
            throw new Error('No body');
          }

          const track = new SubtitleTrack(item.fileName || item.release || 'SubsWyzie subtitle', item.language || query.language || 'en');
          track.loadText(body.responseText);
          this.emit(OpenSubtitlesSearchEvents.TRACK_DOWNLOADED, track);
          AlertPolyfill.toast('success', Localize.getMessage('player_subtitles_addtrack_success'));
        } catch (e) {
          console.log(e);
          AlertPolyfill.toast('error', Localize.getMessage('player_subtitles_addtrack_error'), e?.message);
        }

        item.downloading = false;
      });
    });
  }

  setMediaInfo(info) {
    if (!info) {
      return;
    }

    if (info.name) {
      this.subui.search.value = info.name;
    }

    if (info.season) {
      this.subui.seasonInput.value = info.season;
      if (!this.subui.wyzieSeasonInput.value) {
        this.subui.wyzieSeasonInput.value = info.season;
      }
    }

    if (info.episode) {
      this.subui.episodeInput.value = info.episode;
      if (!this.subui.wyzieEpisodeInput.value) {
        this.subui.wyzieEpisodeInput.value = info.episode;
      }
    }
  }

  setLanguageInputValue(value) {
    this.subui.languageInput.value = value;
  }
}
